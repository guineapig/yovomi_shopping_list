<script setup lang="ts">
import { ApiError, useYuvomiApi } from '~/composables/useYuvomiApi'
import type { ShoppingItem, ShoppingSuggestion } from '~/types/yuvomi'

const route = useRoute()
const listId = Number(route.params.id)
const api = useYuvomiApi()

const { items, categories, listName, status, errorMessage, outboxCount, load, addItem, toggleChecked, removeItem } =
  useShoppingList(listId)

// Includes a fallback group for item categories not (yet) present in `categories`,
// e.g. the very first item added while offline before any category list was cached.
const grouped = computed(() => {
  const known = [...categories.value].sort((a, b) => a.sort_order - b.sort_order)
  const groups = known.map((cat) => ({ category: cat, items: items.value.filter((i) => i.category === cat.name) }))
  const knownNames = new Set(known.map((c) => c.name))
  const orphanNames = [...new Set(items.value.filter((i) => !knownNames.has(i.category)).map((i) => i.category))]
  for (const name of orphanNames) {
    groups.push({
      category: { id: -1 - groups.length, name, icon: '', sort_order: 9999, created_at: '' },
      items: items.value.filter((i) => i.category === name),
    })
  }
  return groups.filter((g) => g.items.length > 0)
})

const statusLabel = computed(() => {
  switch (status.value) {
    case 'offline': return 'Offline – lokal gespeichert'
    case 'syncing': return 'Synchronisiere …'
    case 'pending': return `${outboxCount.value} Änderung${outboxCount.value === 1 ? '' : 'en'} ausstehend`
    case 'saved': return 'Gespeichert'
    default: return 'Lädt …'
  }
})

const newItemName = ref('')
const newItemQuantity = ref('')
const suggestions = ref<ShoppingSuggestion[]>([])
const showSuggestions = ref(false)
let suggestTimer: ReturnType<typeof setTimeout> | undefined

watch(newItemName, (q) => {
  if (suggestTimer) clearTimeout(suggestTimer)
  if (!q.trim()) {
    suggestions.value = []
    showSuggestions.value = false
    return
  }
  suggestTimer = setTimeout(async () => {
    try {
      const res = await api.suggestions(q.trim())
      suggestions.value = res.data
      showSuggestions.value = suggestions.value.length > 0
    } catch {
      // Offline or request failed: quick-add still works without suggestions.
    }
  }, 220)
})

function pickSuggestion(s: ShoppingSuggestion) {
  newItemName.value = s.name
  newItemQuantity.value = s.quantity ?? ''
  showSuggestions.value = false
  submitQuickAdd(s.category)
}

async function submitQuickAdd(category?: string) {
  const name = newItemName.value.trim()
  if (!name) return
  await addItem({ name, quantity: newItemQuantity.value.trim() || null, category: category ?? null })
  newItemName.value = ''
  newItemQuantity.value = ''
  showSuggestions.value = false
}

async function onCheckboxClick(item: ShoppingItem) {
  await toggleChecked(item)
}

async function onDelete(item: ShoppingItem) {
  await removeItem(item)
}

onMounted(() => {
  load()
})
</script>

<template>
  <div class="screen">
    <div class="topbar">
      <NuxtLink to="/" class="btn ghost icon" aria-label="Zurück">←</NuxtLink>
      <h1 style="flex: 1; text-align: center;">{{ listName || 'Einkaufsliste' }}</h1>
      <span style="width: 40px;" />
    </div>

    <div style="text-align: center; margin-bottom: 14px;">
      <span class="status-pill" :class="status">
        <span class="dot" />
        {{ statusLabel }}
      </span>
    </div>

    <div v-if="errorMessage && status === 'offline'" class="alert">{{ errorMessage }}</div>

    <div class="card" style="margin-bottom: 16px; flex: 1;">
      <div v-if="grouped.length === 0" class="empty-state">Diese Liste ist leer. Füge unten etwas hinzu.</div>
      <div v-for="group in grouped" :key="group.category.id" class="category-group">
        <div class="category-heading">{{ group.category.name }}</div>
        <div
          v-for="item in group.items"
          :key="item.id"
          class="item-row"
          :class="{ checked: item.is_checked }"
        >
          <button
            class="item-checkbox"
            :class="{ checked: item.is_checked }"
            :aria-label="item.is_checked ? 'Als offen markieren' : 'Als erledigt markieren'"
            @click="onCheckboxClick(item)"
          >
            <span v-if="item.is_checked">✓</span>
          </button>
          <div class="item-info">
            <div class="item-name">{{ item.name }}</div>
            <div v-if="item.quantity" class="item-quantity">{{ item.quantity }}</div>
          </div>
          <button class="item-delete" aria-label="Löschen" @click="onDelete(item)">✕</button>
        </div>
      </div>
    </div>

    <form class="quick-add" @submit.prevent="submitQuickAdd()">
      <input v-model="newItemName" type="text" placeholder="Artikel hinzufügen …" autocomplete="off" />
      <input v-model="newItemQuantity" type="text" placeholder="Menge" style="max-width: 90px;" autocomplete="off" />
      <button class="btn icon" type="submit" :disabled="!newItemName.trim()" aria-label="Hinzufügen">+</button>

      <div v-if="showSuggestions" class="suggestions">
        <button v-for="s in suggestions" :key="s.name" type="button" @click="pickSuggestion(s)">
          {{ s.name }} <span style="color: var(--text-muted);">· {{ s.category }}</span>
        </button>
      </div>
    </form>
  </div>
</template>
