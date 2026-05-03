'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { ChevronLeft } from 'lucide-react'
import { generatePDF } from '@/lib/pdfGenerator'

export default function YeniSatisPage() {
  const [stockItems, setStockItems] = useState<any[]>([])
  const [selectedDevice, setSelectedDevice] = useState<any>(null)
  
  // Form State
  const [customerName, setCustomerName] = useState('')
  const [customerTc, setCustomerTc] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Nakit')
  const [loading, setLoading] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()
  const { shop, user } = useAppStore()

  useEffect(() => {
    const fetchStock = async () => {
      if (!shop?.id) return
      const { data } = await supabase
        .from('inventory')
        .select('*')
        .eq('shop_id', shop.id)
        .eq('status', 'in_stock')
        .order('created_at', { ascending: false })
      if (data) setStockItems(data)
    }
    fetchStock()
  }, [shop?.id, supabase])

  const handleSale = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shop?.id || !selectedDevice) return toast.error('Lütfen satılacak cihazı seçin.')
    if (!customerTc && !confirm('T.C. Kimlik No girmediniz, devam etmek istiyor musunuz?')) return
    setLoading(true)

    try {
      const price = parseFloat(salePrice)
      if (isNaN(price) || price <= 0) throw new Error("Geçerli bir satış tutarı giriniz.")

      const { data: saleData, error } = await supabase.from('sales').insert({
        inventory_id: selectedDevice.id,
        shop_id: shop.id,
        sold_by: user?.id,
        sale_price: price,
        payment_method: paymentMethod,
        customer_name: customerName,
        customer_tc: customerTc,
        customer_phone: customerPhone
      }).select().single()

      if (error) throw new Error(error.message)

      toast.success('Satış başarıyla gerçekleştirildi! Sözleşme indiriliyor...')
      
      // Auto Generate PDF
      await generatePDF('contract-template', `Satis_Sozlesmesi_${itemToSafeString(selectedDevice.imei_1)}`)
      
      router.push('/panel/satim')
    } catch (err: any) {
      toast.error(err.message || 'Satış işlemi başarısız oldu.')
    } finally {
      setLoading(false)
    }
  }

  const itemToSafeString = (val?: string) => val ? val.replace(/[^a-zA-Z0-9]/g, '') : 'Bilinmeyen'

  return (
    <div className="space-y-6 max-w-5xl mx-auto fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="text-white hover:bg-white/10">
          <Link href="/panel/satim"><ChevronLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Yeni Satış İşlemi</h2>
          <p className="text-white/60 mt-1">Stoktaki cihazı seçip satışı gerçekleştirin ve sözleşme basın.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="glass-card border-white/5 h-fit">
          <CardHeader>
            <CardTitle className="text-white">Satış Formu</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSale} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white/80">Satılacak Cihaz Seçimi *</Label>
                <Select onValueChange={(val) => setSelectedDevice(stockItems.find(i => i.id === val))}>
                  <SelectTrigger className="bg-black/50 border-white/10 text-white">
                    <SelectValue placeholder="Stoktaki cihazları ara..." />
                  </SelectTrigger>
                  <SelectContent className="bg-black/90 border-white/10 text-white text-sm max-h-64">
                    {stockItems.map(item => (
                      <SelectItem key={item.id} value={item.id} className="hover:bg-white/10 focus:bg-white/10 focus:text-white data-[state=checked]:text-white">
                        {item.brand} {item.model} - {item.imei_1} 
                        {(user?.role === 'owner' || user?.role === 'super_admin') && ` (Maliyet: ${item.total_cost}₺)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_name" className="text-white/80">Müşteri Ad Soyad *</Label>
                <Input id="customer_name" required value={customerName} onChange={e => setCustomerName(e.target.value)} className="bg-black/50 border-white/10 text-white" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer_tc" className="text-white/80">T.C. Kimlik No</Label>
                  <Input id="customer_tc" maxLength={11} value={customerTc} onChange={e => setCustomerTc(e.target.value)} className="bg-black/50 border-white/10 text-white" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_phone" className="text-white/80">Telefon *</Label>
                  <Input id="customer_phone" required value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="bg-black/50 border-white/10 text-white" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sale_price" className="text-white/80">Satış Fiyatı (₺) *</Label>
                  <Input id="sale_price" type="number" required value={salePrice} onChange={e => setSalePrice(e.target.value)} className="bg-black/50 border-white/10 text-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Ödeme Yöntemi</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="bg-black/50 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black/90 border-white/10 text-white">
                      <SelectItem value="Nakit">Nakit</SelectItem>
                      <SelectItem value="Kredi Kartı">Kredi Kartı</SelectItem>
                      <SelectItem value="Banka Transferi (Havale/EFT)">Banka Transferi (Havale/EFT)</SelectItem>
                      <SelectItem value="Parçalı">Parçalı Ödeme</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-4">
                <Button type="submit" disabled={loading || !selectedDevice} className="w-full bg-primary hover:bg-primary/90 text-white uppercase font-bold tracking-wide">
                  {loading ? 'İşleniyor...' : 'Siparişi Tamamla & Sözleşme Yazdır'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Cihaz Önizleme Kartı */}
        <Card className="glass-card border-white/5 opacity-80 h-fit">
          <CardHeader>
            <CardTitle className="text-white/80 text-lg">Cihaz Önizlemesi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-white/70 text-sm">
            {selectedDevice ? (
              <>
                <p><strong className="text-white">Marka/Model:</strong> {selectedDevice.brand} {selectedDevice.model}</p>
                <p><strong className="text-white">IMEI 1:</strong> {selectedDevice.imei_1}</p>
                {selectedDevice.imei_2 && <p><strong className="text-white">IMEI 2:</strong> {selectedDevice.imei_2}</p>}
                <p><strong className="text-white">Kondisyon:</strong> %{selectedDevice.battery_health} Pil, {selectedDevice.cosmetic_condition || '-'}</p>
                {(user?.role === 'owner') && (
                  <p><strong className="text-white">Toplam Maliyet:</strong> {selectedDevice.total_cost} ₺</p>
                )}
              </>
            ) : (
              <p>Lütfen listeden satılacak cihazı seçin.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* GİZLİ PDF ŞABLONU */}
      <div style={{ display: 'none' }}>
        <div id="contract-template" style={{ width: '800px', backgroundColor: '#ffffff', color: '#000000', padding: '40px', fontFamily: 'sans-serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '20px', marginBottom: '20px' }}>
            <div>
              {shop?.logo_url && <img src={shop.logo_url} style={{ maxHeight: '60px', marginBottom: '10px' }} />}
              <h1 style={{ fontSize: '24px', margin: 0, fontWeight: 'bold' }}>{shop?.name || 'TELE-KAPAN ŞUBESİ'}</h1>
              <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#555' }}>{shop?.address}</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#555' }}>V.D / No: {shop?.tax_info || '-'}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ fontSize: '18px', margin: 0, color: '#333' }}>ALIM-SATIM SÖZLEŞMESİ</h2>
              <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>Tarih: {new Date().toLocaleDateString('tr-TR')}</p>
            </div>
          </div>
          
          <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '5px', marginTop: '20px' }}>ALICI BİLGİLERİ</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <tbody>
              <tr><td style={{ padding: '8px', border: '1px solid #eee', width: '30%' }}><strong>Ad Soyad:</strong></td><td style={{ padding: '8px', border: '1px solid #eee' }}>{customerName}</td></tr>
              <tr><td style={{ padding: '8px', border: '1px solid #eee' }}><strong>T.C. Kimlik No:</strong></td><td style={{ padding: '8px', border: '1px solid #eee' }}>{customerTc || '-'}</td></tr>
              <tr><td style={{ padding: '8px', border: '1px solid #eee' }}><strong>Telefon:</strong></td><td style={{ padding: '8px', border: '1px solid #eee' }}>{customerPhone}</td></tr>
            </tbody>
          </table>

          <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '5px', marginTop: '20px' }}>CİHAZ BİLGİLERİ</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <tbody>
              <tr><td style={{ padding: '8px', border: '1px solid #eee', width: '30%' }}><strong>Marka / Model:</strong></td><td style={{ padding: '8px', border: '1px solid #eee' }}>{selectedDevice?.brand} {selectedDevice?.model}</td></tr>
              <tr><td style={{ padding: '8px', border: '1px solid #eee' }}><strong>IMEI 1:</strong></td><td style={{ padding: '8px', border: '1px solid #eee' }}>{selectedDevice?.imei_1}</td></tr>
              <tr><td style={{ padding: '8px', border: '1px solid #eee' }}><strong>IMEI 2:</strong></td><td style={{ padding: '8px', border: '1px solid #eee' }}>{selectedDevice?.imei_2 || '-'}</td></tr>
            </tbody>
          </table>

          <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '5px', marginTop: '20px' }}>SATIŞ BİLGİLERİ</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <tbody>
              <tr><td style={{ padding: '8px', border: '1px solid #eee', width: '30%' }}><strong>Satış Tutarı:</strong></td><td style={{ padding: '8px', border: '1px solid #eee' }}>{salePrice} TL</td></tr>
              <tr><td style={{ padding: '8px', border: '1px solid #eee' }}><strong>Ödeme Şekli:</strong></td><td style={{ padding: '8px', border: '1px solid #eee' }}>{paymentMethod}</td></tr>
            </tbody>
          </table>

          <div style={{ marginTop: '40px', fontSize: '12px', lineHeight: '1.6', color: '#444' }}>
            <strong>İkinci El Alım-Satım Sözleşmesi ve KVKK Açık Rıza Beyanı:</strong><br />
            Yukarıda marka, model ve seri (IMEI) numarası belirtilen iletişim cihazının, mülkiyeti tarafıma ait iken {shop?.name || 'mağazaya'} satışını ve devrini gerçekleştirdim / mağazadan teslim aldım. Bu cihazın daha önce herhangi bir yasadışı işlemde kullanılmadığını, hırsızlık malı olmadığını ve hukuki tüm sorumluluğun tarafıma ait olduğunu beyan ve kabul ederim. 6698 sayılı KVKK kapsamında şahsıma ait kimlik ve iletişim bilgilerimin, gerekli yasal bildirimler ve sözleşme süreçlerinin yürütülmesi amacıyla işlenmesine açık rızam vardır.
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px', padding: '0 40px' }}>
            <div style={{ textAlign: 'center' }}>
              <strong>MÜŞTERİ (ALICI/SATICI)</strong><br />
              İmza
            </div>
            <div style={{ textAlign: 'center' }}>
              <strong>MAĞAZA YETKİLİSİ</strong><br />
              Kaşe / İmza
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
