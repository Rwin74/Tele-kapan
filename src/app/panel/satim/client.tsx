'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Search, Plus, RotateCcw } from 'lucide-react'

export default function SatimClient({ initialData, isOwner, shopId }: { initialData: any[], isOwner: boolean, shopId: string }) {
  const [data, setData] = useState(initialData)
  const [search, setSearch] = useState('')
  const [returnDialogId, setReturnDialogId] = useState<string | null>(null)
  const [returnReason, setReturnReason] = useState('')
  const [loading, setLoading] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  const handleReturn = async () => {
    if (!returnDialogId || !returnReason) return
    setLoading(true)

    try {
      const { error } = await supabase.from('returns').insert({
        sale_id: returnDialogId,
        shop_id: shopId,
        return_reason: returnReason,
      })

      if (error) throw new Error(error.message)

      toast.success('İade/İptal işlemi başarıyla tamamlandı. Cihaz tekrar stoka alındı.')
      setReturnDialogId(null)
      setReturnReason('')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'İade/İptal gerçekleştirilemedi.')
    } finally {
      setLoading(false)
    }
  }

  const filtered = data.filter(item => 
    item.customer_name?.toLowerCase().includes(search.toLowerCase()) || 
    item.inventory?.imei_1?.includes(search) ||
    item.inventory?.model?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-black/20 p-4 rounded-lg border border-white/5">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
          <Input 
            placeholder="Müşteri, IMEI veya Model ara..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-black/40 border-white/10 text-white"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Link href="/panel/satim/takas" className="w-full sm:w-auto">
            <Button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center justify-center">
              <RotateCcw className="mr-2 h-4 w-4" /> Takas ile Satış
            </Button>
          </Link>
          <Link href="/panel/satim/yeni" className="w-full sm:w-auto">
            <Button className="w-full bg-primary hover:bg-primary/90 flex items-center justify-center">
              <Plus className="mr-2 h-4 w-4" /> Yeni Satış Yap
            </Button>
          </Link>
        </div>
      </div>

      <div className="border border-white/10 rounded-lg overflow-hidden glass">
        <Table>
          <TableHeader className="bg-black/40">
            <TableRow className="border-white/10">
              <TableHead className="text-white/60">Tarih</TableHead>
              <TableHead className="text-white/60">Müşteri</TableHead>
              <TableHead className="text-white/60">Cihaz</TableHead>
              <TableHead className="text-white/60 text-right">Fiyat</TableHead>
              {isOwner && <TableHead className="text-white/60 text-right">Kâr</TableHead>}
              <TableHead className="text-white/60 text-right">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="border-white/10 hover:bg-white/5">
                <TableCell colSpan={isOwner ? 6 : 5} className="h-24 text-center text-white/50">
                  Satış kaydı bulunamadı.
                </TableCell>
              </TableRow>
            ) : filtered.map((item) => {
              const profit = item.sale_price - (item.inventory?.total_cost || 0)
              
              return (
                <TableRow key={item.id} className="border-white/10 hover:bg-white/5 transition-colors">
                  <TableCell className="text-white/80 text-sm whitespace-nowrap">
                    {new Date(item.sale_date).toLocaleDateString('tr-TR')}
                  </TableCell>
                  <TableCell className="text-white">
                    <div>{item.customer_name || 'İsimsiz'}</div>
                    <div className="text-xs text-white/50">{item.customer_phone || '-'}</div>
                  </TableCell>
                  <TableCell className="text-white/80">
                    <div className="font-medium">{item.inventory?.brand} {item.inventory?.model}</div>
                    <div className="text-xs text-white/50">{item.inventory?.imei_1}</div>
                  </TableCell>
                  <TableCell className="text-right font-bold text-white whitespace-nowrap">
                    {item.sale_price} ₺
                  </TableCell>
                  {isOwner && (
                    <TableCell className={`text-right font-bold whitespace-nowrap ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {profit} ₺
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <Button 
                       variant="outline" 
                       size="sm" 
                       onClick={() => setReturnDialogId(item.id)}
                       className="bg-transparent border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                     >
                       <RotateCcw className="mr-1 w-3 h-3" /> İade Al
                     </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!returnDialogId} onOpenChange={(open) => !open && setReturnDialogId(null)}>
        <DialogContent className="glass-card border-white/10 bg-black/80 text-white">
          <DialogHeader>
            <DialogTitle>Satışı İptal Et / İade Al</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm text-yellow-500/80 mb-2">
              Bu işlem cihazı tekrar stoka ekleyecektir. Lütfen iade sebebini belirtin.
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-white/80">İade/İptal Nedeni</Label>
              <Input 
                id="reason" 
                value={returnReason}
                onChange={e => setReturnReason(e.target.value)}
                className="bg-black/50 border-white/10 text-white" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReturnDialogId(null)} className="text-white/70 hover:text-white">Vazgeç</Button>
            <Button onClick={handleReturn} disabled={loading || !returnReason} className="bg-red-500 hover:bg-red-600 text-white">
              {loading ? 'İşleniyor...' : 'İadeyi Onayla'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
