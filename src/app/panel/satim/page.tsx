import { createClient } from '@/utils/supabase/server'
import SatimClient from './client'

export default async function SatimPage() {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch sales
  const { data: sales } = await supabase
    .from('sales')
    .select(`
      *,
      inventory:inventory_id(brand, model, imei_1, total_cost),
      users:sold_by(full_name)
    `)
    .order('sale_date', { ascending: false })

  const { data: profile } = await supabase.from('users').select('role, shop_id').eq('id', user.id).single()
  const isOwner = profile?.role === 'owner' || profile?.role === 'super_admin'

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Satış ve İade Yönetimi</h2>
        <p className="text-white/60 mt-2">Satış geçmişinizi görün, sözleşme basın veya iptal/iade işlemi yapın.</p>
      </div>

      <SatimClient initialData={sales || []} isOwner={isOwner} shopId={profile?.shop_id!} />
    </div>
  )
}
