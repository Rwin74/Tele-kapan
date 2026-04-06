'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAppStore } from '@/store/useAppStore'
import { createClient } from '@/utils/supabase/client'
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  BarChart3, 
  Settings, 
  LogOut,
  Menu
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, shop, clearAuth, setUser, setShop } = useAppStore()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const syncAuth = async () => {
      if (!user) {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const { data: profile } = await supabase
            .from('users')
            .select('*, shops(*)')
            .eq('id', session.user.id)
            .single()
            
          if (profile) {
            setUser(profile as any)
            if (profile.shops) setShop(profile.shops as any)
          }
        }
      }
    }
    syncAuth()
  }, [user, setUser, setShop])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    clearAuth()
    router.push('/login')
  }

  const navItems = [
    { name: 'Dashboard', href: '/panel', icon: LayoutDashboard },
    { name: 'Stok Yönetimi', href: '/panel/stok', icon: Package },
    { name: 'Satış & İade', href: '/panel/satim', icon: ShoppingCart },
    ...(user?.role === 'owner' || user?.role === 'super_admin' ? [
      { name: 'Raporlar', href: '/panel/raporlar', icon: BarChart3 }
    ] : []),
    { name: 'Ayarlar', href: '/panel/ayarlar', icon: Settings },
  ]

  return (
    <div className="flex min-h-screen bg-transparent">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-white/10 glass-panel transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 flex flex-col ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center px-6 border-b border-white/10 shrink-0">
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">Tele-Kapan</h1>
        </div>
        
        <div className="px-6 py-4 border-b border-white/10 shrink-0">
          <p className="text-sm font-medium text-white">{shop?.name || 'Yükleniyor...'}</p>
          <p className="text-xs text-white/50 uppercase tracking-wider mt-1">{user?.role === 'owner' ? 'Yönetici' : 'Personel'}</p>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/panel' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                  isActive 
                    ? 'bg-primary/20 text-primary font-medium shadow-sm shadow-primary/10' 
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <item.icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-white/50'}`} />
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-white/10 shrink-0">
          <Button 
            onClick={handleLogout} 
            variant="ghost" 
            className="w-full justify-start text-white/70 hover:text-white hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <LogOut className="mr-3 h-4 w-4" />
            Çıkış Yap
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex w-full flex-col min-w-0">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-white/10 glass px-4 lg:px-6 sticky top-0 z-30">
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden text-white hover:bg-white/10"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <div className="text-sm text-right hidden sm:block">
              <p className="text-white font-medium">{user?.full_name}</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shadow-sm shadow-primary/20">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 pb-24 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
