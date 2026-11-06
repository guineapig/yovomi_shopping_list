export interface YuvomiUser {
  id: number
  username: string
  display_name: string
  avatar_color?: string
  avatar_data?: string | null
  role?: string
  family_role?: string
}

export interface Session {
  serverUrl: string
  credential: string
  user: YuvomiUser | null
}

export interface ShoppingListSummary {
  id: number
  name: string
  created_by: number
  created_at: string
  updated_at: string
  item_total: number
  item_checked: number
  accepts_new_items: 0 | 1
}

export interface ShoppingCategory {
  id: number
  name: string
  icon: string
  sort_order: number
  created_at: string
}

export interface ShoppingItem {
  id: number
  list_id: number
  name: string
  quantity: string | null
  category: string
  is_checked: 0 | 1
  notes: string | null
  url: string | null
  price_cents: number | null
  store_id: number | null
  sort_order: number
  added_from_meal: number | null
  created_at: string
  updated_at: string
  tags?: string[]
}

export interface ShoppingItemsResponse {
  data: ShoppingItem[]
  list: { id: number; name: string; created_by: number; created_at: string; updated_at: string }
  categories: ShoppingCategory[]
  version: number
}

export interface ShoppingSuggestion {
  name: string
  category: string
  quantity: string | null
}

export interface ShoppingItemCreateInput {
  name: string
  quantity?: string | null
  category?: string | null
  notes?: string | null
  url?: string | null
}

export interface ShoppingItemUpdateInput {
  is_checked?: boolean
  name?: string
  quantity?: string | null
  category?: string
  notes?: string | null
  url?: string | null
  price_cents?: number | null
  store_id?: number | null
  list_id?: number | null
}
