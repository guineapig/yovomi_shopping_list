import { get, set } from 'idb-keyval'
import type { ShoppingItemsResponse, ShoppingListSummary } from '~/types/yuvomi'

export interface OutboxEntry {
  id: string
  listId: number
  kind: 'create' | 'update' | 'delete' | 'deleteChecked'
  itemId?: number
  tempId?: number
  payload?: any
  createdAt: number
}

const listKey = (id: number) => `list:${id}`

/** Vue's reactive Proxy objects fail IndexedDB's structured-clone step; store plain data only. */
function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

/**
 * Pure IndexedDB storage for "last known good" reads and a pending-writes
 * outbox. Holds no policy - callers decide when to read from cache, when to
 * enqueue, and how to flush.
 */
export function useOfflineStore() {
  async function getCachedList(listId: number): Promise<ShoppingItemsResponse | null> {
    return (await get(listKey(listId))) ?? null
  }

  async function setCachedList(listId: number, data: ShoppingItemsResponse): Promise<void> {
    await set(listKey(listId), toPlain(data))
  }

  async function getCachedLists(): Promise<ShoppingListSummary[] | null> {
    return (await get('lists:overview')) ?? null
  }

  async function setCachedLists(data: ShoppingListSummary[]): Promise<void> {
    await set('lists:overview', toPlain(data))
  }

  async function getOutbox(): Promise<OutboxEntry[]> {
    return (await get('outbox')) ?? []
  }

  async function setOutbox(entries: OutboxEntry[]): Promise<void> {
    await set('outbox', toPlain(entries))
  }

  return { getCachedList, setCachedList, getCachedLists, setCachedLists, getOutbox, setOutbox }
}
