import { ApiError, useYuvomiApi } from './useYuvomiApi'
import { useOfflineStore, type OutboxEntry } from './useOfflineStore'
import type { ShoppingCategory, ShoppingItem, ShoppingItemCreateInput } from '~/types/yuvomi'

export type SyncStatus = 'loading' | 'saved' | 'offline' | 'syncing' | 'pending'

let tempIdCounter = -1
function nextTempId() {
  return tempIdCounter--
}

/** Loads one shopping list, keeps a local optimistic copy, and syncs an outbox of edits. */
export function useShoppingList(listId: number) {
  const api = useYuvomiApi()
  const store = useOfflineStore()

  const items = ref<ShoppingItem[]>([])
  const categories = ref<ShoppingCategory[]>([])
  const listName = ref<string>('')
  const version = ref<number>(0)
  const status = ref<SyncStatus>('loading')
  const errorMessage = ref<string | null>(null)
  const outbox = ref<OutboxEntry[]>([])

  // Mirrors the server's read order: category (shop order) -> checked-last-within-category -> sort_order.
  function sortItems() {
    const catOrder = new Map(categories.value.map((c) => [c.name, c.sort_order]))
    items.value.sort((a, b) => {
      const ca = catOrder.get(a.category) ?? 0
      const cb = catOrder.get(b.category) ?? 0
      if (a.category !== b.category) return ca - cb
      if (a.is_checked !== b.is_checked) return a.is_checked - b.is_checked
      return a.sort_order - b.sort_order
    })
  }

  function refreshStatus() {
    if (!navigator.onLine) {
      status.value = 'offline'
      return
    }
    status.value = outbox.value.length > 0 ? 'pending' : 'saved'
  }

  async function persistOutbox() {
    await store.setOutbox(outbox.value)
    refreshStatus()
  }

  async function loadFromCache() {
    const cached = await store.getCachedList(listId)
    if (cached) {
      items.value = cached.data
      categories.value = cached.categories
      listName.value = cached.list.name
      version.value = cached.version
      sortItems()
    }
    outbox.value = (await store.getOutbox()).filter((e) => e.listId === listId)
  }

  async function load() {
    await loadFromCache()
    if (!navigator.onLine) {
      status.value = items.value.length || listName.value ? 'offline' : 'offline'
      return
    }
    try {
      const res = await api.listItems(listId)
      items.value = res.data
      categories.value = res.categories
      listName.value = res.list.name
      version.value = res.version
      sortItems()
      await store.setCachedList(listId, res)
      errorMessage.value = null
      refreshStatus()
    } catch (err) {
      errorMessage.value = err instanceof ApiError ? err.message : 'Verbindung fehlgeschlagen.'
      status.value = 'offline'
    }
  }

  async function saveSnapshot() {
    await store.setCachedList(listId, {
      data: items.value,
      categories: categories.value,
      list: { id: listId, name: listName.value, created_by: 0, created_at: '', updated_at: '' },
      version: version.value,
    })
  }

  async function addItem(input: ShoppingItemCreateInput) {
    const tempId = nextTempId()
    const optimistic: ShoppingItem = {
      id: tempId,
      list_id: listId,
      name: input.name,
      quantity: input.quantity ?? null,
      category: input.category ?? categories.value[0]?.name ?? 'Sonstiges',
      is_checked: 0,
      notes: input.notes ?? null,
      url: input.url ?? null,
      price_cents: null,
      store_id: null,
      sort_order: 0,
      added_from_meal: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [],
    }
    items.value.push(optimistic)
    sortItems()
    await saveSnapshot()

    outbox.value.push({ id: `c-${tempId}`, listId, kind: 'create', tempId, payload: input, createdAt: Date.now() })
    await persistOutbox()
    await flush()
  }

  async function toggleChecked(item: ShoppingItem) {
    item.is_checked = item.is_checked ? 0 : 1
    sortItems()
    await saveSnapshot()
    await queueUpdate(item.id, { is_checked: !!item.is_checked })
    await flush()
  }

  async function queueUpdate(itemId: number, payload: Record<string, unknown>) {
    if (itemId < 0) {
      const createEntry = outbox.value.find((e) => e.kind === 'create' && e.tempId === itemId)
      if (createEntry) {
        createEntry.payload = { ...createEntry.payload, ...payload }
        await persistOutbox()
        return
      }
    }
    const existing = outbox.value.find((e) => e.kind === 'update' && e.itemId === itemId)
    if (existing) {
      existing.payload = { ...existing.payload, ...payload }
    } else {
      outbox.value.push({ id: `u-${itemId}-${Date.now()}`, listId, kind: 'update', itemId, payload, createdAt: Date.now() })
    }
    await persistOutbox()
  }

  async function removeItem(item: ShoppingItem) {
    items.value = items.value.filter((i) => i.id !== item.id)
    await saveSnapshot()

    if (item.id < 0) {
      outbox.value = outbox.value.filter((e) => !(e.kind === 'create' && e.tempId === item.id))
    } else {
      outbox.value = outbox.value.filter((e) => !(e.itemId === item.id && e.kind === 'update'))
      outbox.value.push({ id: `d-${item.id}`, listId, kind: 'delete', itemId: item.id, createdAt: Date.now() })
    }
    await persistOutbox()
    await flush()
  }

  function isPermanentError(err: unknown) {
    return err instanceof ApiError && [400, 404, 409].includes(err.status)
  }

  async function flush() {
    if (!navigator.onLine || outbox.value.length === 0) {
      refreshStatus()
      return
    }
    status.value = 'syncing'
    const remaining: OutboxEntry[] = [...outbox.value]
    const done: string[] = []

    for (const entry of remaining) {
      try {
        if (entry.kind === 'create') {
          const res = await api.createItem(entry.listId, entry.payload as ShoppingItemCreateInput)
          const local = items.value.find((i) => i.id === entry.tempId)
          const wantedChecked = local?.is_checked === 1
          if (local) Object.assign(local, res.data, { id: res.data.id })
          if (wantedChecked) {
            try {
              await api.updateItem(res.data.id, { is_checked: true })
              if (local) local.is_checked = 1
            } catch {
              outbox.value.push({ id: `u-${res.data.id}-${Date.now()}`, listId, kind: 'update', itemId: res.data.id, payload: { is_checked: true }, createdAt: Date.now() })
            }
          }
        } else if (entry.kind === 'update' && entry.itemId !== undefined) {
          await api.updateItem(entry.itemId, entry.payload)
        } else if (entry.kind === 'delete' && entry.itemId !== undefined) {
          await api.deleteItem(entry.itemId)
        } else if (entry.kind === 'deleteChecked') {
          await api.deleteCheckedItems(entry.listId, entry.payload?.ids)
        }
        done.push(entry.id)
      } catch (err) {
        if (isPermanentError(err)) {
          done.push(entry.id)
          continue
        }
        break // transient failure: keep this and later entries, retry later
      }
    }

    outbox.value = outbox.value.filter((e) => !done.includes(e.id))
    await persistOutbox()
    sortItems()
    await saveSnapshot()
  }

  async function pollVersion() {
    if (!navigator.onLine || outbox.value.length > 0) return
    try {
      const res = await api.listVersions()
      const remote = res.data.find((v) => v.list_id === listId)
      if (remote && remote.version !== version.value) {
        await load()
      }
    } catch {
      // Silent: a failed poll just tries again next tick.
    }
  }

  let pollHandle: ReturnType<typeof setInterval> | undefined
  function startPolling(intervalMs = 8000) {
    pollHandle = setInterval(pollVersion, intervalMs)
  }
  function stopPolling() {
    if (pollHandle) clearInterval(pollHandle)
  }

  function onOnline() {
    flush().then(() => pollVersion())
  }
  function onOffline() {
    refreshStatus()
  }

  onMounted(() => {
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    startPolling()
  })
  onUnmounted(() => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    stopPolling()
  })

  return {
    items,
    categories,
    listName,
    status,
    errorMessage,
    outboxCount: computed(() => outbox.value.length),
    load,
    addItem,
    toggleChecked,
    removeItem,
    flush,
  }
}
