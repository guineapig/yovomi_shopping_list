import type {
  ShoppingCategory,
  ShoppingItem,
  ShoppingItemCreateInput,
  ShoppingItemUpdateInput,
  ShoppingItemsResponse,
  ShoppingListSummary,
  ShoppingSuggestion,
} from '~/types/yuvomi'

export class ApiError extends Error {
  status: number
  reason?: string

  constructor(status: number, message: string, reason?: string) {
    super(message)
    this.status = status
    this.reason = reason
  }
}

/**
 * Typed calls against the Shopping module, routed through our own `/api/y/*`
 * proxy so the browser never needs the self-hosted Yuvomi server to send
 * CORS headers it was never configured to send.
 */
export function useYuvomiApi() {
  const { session, clearSession } = useSession()

  async function call<T>(path: string, opts: { method?: string; body?: unknown; query?: Record<string, string> } = {}): Promise<T> {
    const current = session.value
    if (!current) throw new ApiError(401, 'Nicht angemeldet.')

    try {
      const res = await $fetch(`/api/y/${path}`, {
        method: (opts.method ?? 'GET') as any,
        body: opts.body as any,
        query: opts.query,
        headers: {
          authorization: `Bearer ${current.credential}`,
          'x-yuvomi-base': current.serverUrl,
        },
      })
      return res as T
    } catch (err: any) {
      const status = err?.response?.status ?? err?.statusCode ?? 0
      const data = err?.response?._data ?? err?.data
      if (status === 401) {
        clearSession()
      }
      throw new ApiError(status, data?.error ?? err?.message ?? 'Anfrage fehlgeschlagen.', data?.reason)
    }
  }

  return {
    listShoppingLists: () => call<{ data: ShoppingListSummary[] }>('shopping'),
    createShoppingList: (name: string) => call<{ data: ShoppingListSummary }>('shopping', { method: 'POST', body: { name } }),
    renameShoppingList: (listId: number, name: string) => call(`shopping/${listId}`, { method: 'PUT', body: { name } }),
    deleteShoppingList: (listId: number) => call(`shopping/${listId}`, { method: 'DELETE' }),

    listCategories: () => call<{ data: ShoppingCategory[] }>('shopping/categories'),

    listItems: (listId: number) => call<ShoppingItemsResponse>(`shopping/${listId}/items`),
    createItem: (listId: number, input: ShoppingItemCreateInput) =>
      call<{ data: ShoppingItem }>(`shopping/${listId}/items`, { method: 'POST', body: input }),
    updateItem: (itemId: number, input: ShoppingItemUpdateInput) =>
      call<{ data: ShoppingItem; list_change: { list_id: number; before: number; after: number } }>(
        `shopping/items/${itemId}`,
        { method: 'PATCH', body: input },
      ),
    deleteItem: (itemId: number) => call(`shopping/items/${itemId}`, { method: 'DELETE' }),
    deleteCheckedItems: (listId: number, ids?: number[]) =>
      call<{ deleted: number }>(`shopping/${listId}/items/checked`, { method: 'DELETE', body: ids ? { ids } : undefined }),

    listVersions: () => call<{ data: { list_id: number; version: number }[] }>('shopping/versions'),

    suggestions: (q: string) => call<{ data: ShoppingSuggestion[] }>('shopping/suggestions', { query: { q } }),
  }
}
