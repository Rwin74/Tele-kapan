import { create } from 'zustand'

export type UserRole = 'super_admin' | 'owner' | 'staff'

interface UserProfile {
  id: string
  shop_id: string
  role: UserRole
  full_name: string
  email: string
  is_active: boolean
}

interface ShopDetails {
  id: string
  name: string
  logo_url: string | null
  address: string | null
  tax_info: string | null
}

interface AppState {
  user: UserProfile | null
  shop: ShopDetails | null
  setUser: (user: UserProfile | null) => void
  setShop: (shop: ShopDetails | null) => void
  clearAuth: () => void
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  shop: null,
  setUser: (user) => set({ user }),
  setShop: (shop) => set({ shop }),
  clearAuth: () => set({ user: null, shop: null }),
}))
