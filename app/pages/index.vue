<script setup lang="ts">
import { ApiError } from '~/composables/useYuvomiApi'
import type { ShoppingListSummary } from '~/types/yuvomi'

const api = useYuvomiApi()
const store = useOfflineStore()
const { session, clearSession } = useSession()

const lists = ref<ShoppingListSummary[]>([])
const online = ref(navigator.onLine)
const errorMessage = ref<string | null>(null)
const newListName = ref('')
const creating = ref(false)

async function load() {
  const cached = await store.getCachedLists()
  if (cached) lists.value = cached
  try {
    const res = await api.listShoppingLists()
    lists.value = res.data
    await store.setCachedLists(res.data)
    errorMessage.value = null
  } catch (err) {
    online.value = false
    errorMessage.value = err instanceof ApiError ? err.message : 'Offline – zeige gespeicherten Stand.'
  }
}

async function createList() {
  const name = newListName.value.trim()
  if (!name) return
  creating.value = true
  try {
    await api.createShoppingList(name)
    newListName.value = ''
    await load()
  } catch (err) {
    errorMessage.value = err instanceof ApiError ? err.message : 'Liste konnte nicht erstellt werden.'
  } finally {
    creating.value = false
  }
}

function onOnline() {
  online.value = true
  load()
}
function onOffline() {
  online.value = false
}

onMounted(() => {
  load()
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
})
onUnmounted(() => {
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
})

function logout() {
  clearSession()
  navigateTo('/login')
}
</script>

<template>
  <div class="screen">
    <div class="topbar">
      <h1>Einkaufslisten</h1>
      <span class="status-pill" :class="{ offline: !online }">
        <span class="dot" />
        {{ online ? 'Verbunden' : 'Offline' }}
      </span>
    </div>

    <div v-if="errorMessage" class="alert">{{ errorMessage }}</div>

    <div class="card" style="margin-bottom: 16px;">
      <div v-if="lists.length === 0" class="empty-state">Noch keine Einkaufsliste vorhanden.</div>
      <NuxtLink v-for="list in lists" :key="list.id" :to="`/list/${list.id}`" class="list-row">
        <div>
          <div class="name">{{ list.name }}</div>
          <div class="meta">{{ list.item_total - list.item_checked }} offen · {{ list.item_checked }} erledigt</div>
        </div>
        <span style="color: var(--text-muted);">›</span>
      </NuxtLink>
    </div>

    <form class="quick-add" style="margin-top: 0;" @submit.prevent="createList">
      <input v-model="newListName" type="text" placeholder="Neue Liste, z. B. „Wocheneinkauf“" />
      <button class="btn icon" type="submit" :disabled="creating || !newListName.trim()" aria-label="Liste anlegen">+</button>
    </form>

    <div class="spacer" />

    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 24px;">
      <span style="color: var(--text-muted); font-size: 0.85rem;">
        {{ session?.user?.display_name ?? session?.user?.username }} · {{ session?.serverUrl }}
      </span>
      <button class="btn ghost" type="button" @click="logout">Abmelden</button>
    </div>
  </div>
</template>
