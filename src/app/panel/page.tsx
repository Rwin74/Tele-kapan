import { createClient } from '@/utils/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, ShoppingCart, Smartphone, Activity } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('users').select('shop_id, role').eq('id', user.id).single()
  const shopId = profile?.shop_id

  if (!shopId) return <div className="p-4 text-white">Dükkan bilgisi alınamadı. Lütfen daha sonra deneyin.</div>

  const { count: inStockCount } = await supabase
    .from('inventory')
    .select('*', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .eq('status', 'in_stock')

  const { count: salesCount } = await supabase
    .from('sales')
    .select('*', { count: 'exact', head: true })
    .eq('shop_id', shopId)

  // Sadece Owner maliyeti/karı görebilir, o yüzden owner checks.
  let isOwner = profile.role === 'owner' || profile.role === 'super_admin'

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Panel Özeti</h2>
        <p className="text-white/60 mt-2">Dükkanınızın güncel durumunu buradan takip edebilirsiniz.</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card border-white/5 hover:border-primary/30 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/70">
              Stoktaki Cihazlar
            </CardTitle>
            <Smartphone className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{inStockCount || 0}</div>
            <p className="text-xs text-white/40 mt-1">
              Satışa hazır envanter
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/5 hover:border-primary/30 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/70">
              Toplam Satış İşlemi
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{salesCount || 0}</div>
            <p className="text-xs text-white/40 mt-1">
              Sistemdeki toplam satış
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mt-8">
        <Card className="glass-card border-white/5 lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-white">Son Aktiviteler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center p-8 text-center border border-white/5 rounded-lg bg-black/20">
               <Activity className="h-10 w-10 text-white/20 mb-4" />
               <p className="text-white/50 text-sm">Aktivite modülü yakında aktif edilecektir.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
