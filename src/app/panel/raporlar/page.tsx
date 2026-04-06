import { createClient } from '@/utils/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { redirect } from 'next/navigation'
import { BarChart, Wallet, CreditCard, PieChart } from 'lucide-react'

export default async function RaporlarPage() {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('users').select('shop_id, role').eq('id', user.id).single()
  
  if (profile?.role !== 'owner' && profile?.role !== 'super_admin') {
    redirect('/panel')
  }

  const shopId = profile.shop_id

  // Fetch all completed sales for metrics
  const { data: sales } = await supabase
    .from('sales')
    .select(`
      sale_price,
      sale_date,
      inventory:inventory_id(total_cost)
    `)
    .eq('shop_id', shopId)

  // Fetch scrapped parts for cost inclusion
  const { data: scrapped } = await supabase
    .from('inventory')
    .select('total_cost')
    .eq('shop_id', shopId)
    .eq('status', 'scrapped')

  // Calcs
  let totalRevenue = 0
  let totalCost = 0
  let scrappedCost = 0
  
  sales?.forEach(s => {
    totalRevenue += Number(s.sale_price || 0)
    if (s.inventory && !Array.isArray(s.inventory)) { // Type check safety
      totalCost += Number((s.inventory as any).total_cost || 0)
    }
  })

  scrapped?.forEach(i => {
    totalCost += Number(i.total_cost || 0)
    scrappedCost += Number(i.total_cost || 0)
  })

  const totalProfit = totalRevenue - totalCost

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Finansal Raporlar</h2>
        <p className="text-white/60 mt-2">Dükkanınızın dönemsel ciro ve kâr/zarar analizleri.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card border-white/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/70">
              Toplam Ciro
            </CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{totalRevenue.toLocaleString('tr-TR')} ₺</div>
          </CardContent>
        </Card>
        
        <Card className="glass-card border-white/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/70">
              Toplam Cihaz Maliyeti
            </CardTitle>
            <CreditCard className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{totalCost.toLocaleString('tr-TR')} ₺</div>
            <p className="text-xs text-white/40 mt-1">Stok, masraf ve {(scrappedCost || 0).toLocaleString('tr-TR')} ₺ hurda (parça) maliyeti dahil</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/70">
              Net Kâr (Satılanlardan)
            </CardTitle>
            <PieChart className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalProfit.toLocaleString('tr-TR')} ₺
            </div>
            <p className="text-xs text-white/40 mt-1">Brüt kâr hesaplaması</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card border-white/5 mt-8">
        <CardHeader>
          <CardTitle className="text-white">Aylık Satış Dağılımı</CardTitle>
          <CardDescription className="text-white/50">Grafik modülü yapılandırılıyor.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center border border-white/5 bg-black/20 rounded">
            <BarChart className="h-12 w-12 text-white/20" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
