import { createClient } from '@/utils/supabase/server'
import StokClient from './client'

export default async function StokPage() {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch inventory
  const { data: inventory, error } = await supabase
    .from('inventory')
    .select(`
      *,
      users:added_by (full_name)
    `)
    .eq('status', 'in_stock')
    .order('created_at', { ascending: false })

  // Also get the user role to conditionally hide cost for Staff
  const { data: profile } = await supabase.from('users').select('role, shop_id').eq('id', user.id).single()
  const isOwner = profile?.role === 'owner' || profile?.role === 'super_admin'

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Stok Yönetimi</h2>
        <p className="text-white/60 mt-2">Dükkandaki cihazları görüntüleyin ve masraf ekleyin.</p>
      </div>

      <StokClient initialData={inventory || []} isOwner={isOwner} shopId={profile?.shop_id!} />
    </div>
  )
}
