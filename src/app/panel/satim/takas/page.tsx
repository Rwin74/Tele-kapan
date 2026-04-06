'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { ChevronLeft, ArrowRightLeft } from 'lucide-react'
import { generatePDF } from '@/lib/pdfGenerator'

export default function TakasPage() {
  const [stockItems, setStockItems] = useState<any[]>([])
  const [selectedDevice, setSelectedDevice] = useState<any>(null)
  
  // Takas Right Side (Selling)
  const [tradeInSalePrice, setTradeInSalePrice] = useState('')
  
  // Takas Left Side (Receiving)
  const [oldDevice, setOldDevice] = useState({
    brand: '', model: '', imei_1: '', imei_2: '',
    cosmetic_condition: '', purchase_price: '', device_origin: '',
    seller_name: '', seller_tc: '', seller_phone: ''
  })
  
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

  const oldPrice = parseFloat(oldDevice.purchase_price) || 0
  const newPrice = parseFloat(tradeInSalePrice) || 0
  const priceDifference = newPrice - oldPrice

  const handleTakas = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shop?.id) return
    if (!selectedDevice) return toast.error('Lütfen müşteriye verilecek cihazı seçin.')
    if (!oldDevice.brand || !oldDevice.model || !oldDevice.imei_1 || !oldDevice.purchase_price || !oldDevice.seller_name || !oldDevice.seller_phone || !oldDevice.device_origin) {
      return toast.error('Lütfen alınan cihaz ve müşteri bilgilerini (Zorunlu alanları) eksiksiz girin.')
    }
    if (oldDevice.imei_1.length < 15) return toast.error('IMEI 15 hane olmalıdır.')
    if (newPrice <= 0) return toast.error('Net Satış Fiyatı (verilen cihazın bedeli) sıfırdan büyük olmalı.')

    setLoading(true)

    try {
      const { data, error } = await supabase.rpc('process_trade_in', {
        old_device_data: oldDevice,
        sold_device_id: selectedDevice.id,
        trade_in_sale_price: newPrice,
        price_diff_paid: Math.abs(priceDifference)
      })

      if (error) throw error

      toast.success('Takas işlemi başarıyla tamamlandı! Sözleşme hazırlanıyor...')

      // Auto Generate PDF
      const safeString = oldDevice.imei_1.replace(/[^a-zA-Z0-9]/g, '')
      setTimeout(async () => {
        await generatePDF('trade-in-contract-template', `Takas_Belgesi_${safeString}`)
        router.push('/panel/satim')
      }, 500)

    } catch (err: any) {
      toast.error('Hata: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleOldField = (field: string, val: string) => setOldDevice(p => ({ ...p, [field]: val }))

  return (
    <div className="space-y-6 max-w-7xl mx-auto fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="text-white hover:bg-white/10 border border-white/10">
          <Link href="/panel/satim"><ChevronLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ArrowRightLeft className="h-6 w-6 text-blue-400" /> Takas ile Satış Motoru
          </h2>
          <p className="text-white/60 text-sm mt-1">Sol tarafa müşterinin bıraktığı cihazı, sağ tarafa alacağı cihazı girin.</p>
        </div>
      </div>

      <form onSubmit={handleTakas} className="space-y-6">
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          
          {/* Müşterinin Verdiği Cihaz (ALINAN) */}
          <Card className="glass-card border-blue-500/20 shadow-lg shadow-blue-500/5">
            <CardHeader className="border-b border-white/5 bg-blue-500/5">
              <CardTitle className="text-blue-400 flex items-center gap-2">1. Müşterinin Bıraktığı Cihaz</CardTitle>
              <CardDescription className="text-white/50">Müşteri ve takas edilecek (alınan) eski cihaz bilgileri.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label className="text-white/80">Ad Soyad (Müşteri) *</Label>
                   <Input value={oldDevice.seller_name} onChange={e => handleOldField('seller_name', e.target.value)} className="bg-black/50 border-[#222] text-white" />
                 </div>
                 <div className="space-y-2">
                   <Label className="text-white/80">Telefon *</Label>
                   <Input value={oldDevice.seller_phone} onChange={e => handleOldField('seller_phone', e.target.value)} className="bg-black/50 border-[#222] text-white" />
                 </div>
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">T.C. Kimlik No</Label>
                <Input value={oldDevice.seller_tc} maxLength={11} onChange={e => handleOldField('seller_tc', e.target.value)} className="bg-black/50 border-[#222] text-white" />
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                 <div className="space-y-2">
                   <Label className="text-white/80">Marka *</Label>
                   <Input value={oldDevice.brand} onChange={e => handleOldField('brand', e.target.value)} className="bg-black/50 border-[#222] text-white" placeholder="Apple" />
                 </div>
                 <div className="space-y-2">
                   <Label className="text-white/80">Model *</Label>
                   <Input value={oldDevice.model} onChange={e => handleOldField('model', e.target.value)} className="bg-black/50 border-[#222] text-white" placeholder="iPhone 11" />
                 </div>
              </div>

              <div className="space-y-2">
                 <Label className="text-white/80">Cihaz Kökeni *</Label>
                 <Select onValueChange={(v) => handleOldField('device_origin', v)}>
                   <SelectTrigger className="bg-black/50 border-[#222] text-white">
                     <SelectValue placeholder="Seçiniz..." />
                   </SelectTrigger>
                   <SelectContent className="bg-black/95 border-[#222] text-white">
                     <SelectItem value="TR Cihazı (Garantili/Garantisiz)">TR Cihazı (Garantili/Garantisiz)</SelectItem>
                     <SelectItem value="Yurtdışı (Kayıtlı)">Yurtdışı (Kayıtlı)</SelectItem>
                     <SelectItem value="Yurtdışı (Kayıtsız/Server Kayıtlı)">Yurtdışı (Kayıtsız/Server Kayıtlı)</SelectItem>
                   </SelectContent>
                 </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label className="text-white/80">IMEI 1 *</Label>
                   <Input value={oldDevice.imei_1} maxLength={15} onChange={e => handleOldField('imei_1', e.target.value)} className="bg-black/50 border-[#222] text-white" />
                 </div>
                 <div className="space-y-2">
                   <Label className="text-white/80">Kozmetik Durum</Label>
                   <Input value={oldDevice.cosmetic_condition} onChange={e => handleOldField('cosmetic_condition', e.target.value)} className="bg-black/50 border-[#222] text-white" placeholder="Temiz, çiziksiz" />
                 </div>
              </div>

              <div className="space-y-2 pt-2">
                 <Label className="text-blue-400 font-bold">Cihazın Bize Geliş (Sayım) Fiyatı (₺) *</Label>
                 <Input type="number" value={oldDevice.purchase_price} onChange={e => handleOldField('purchase_price', e.target.value)} className="bg-blue-500/10 border-blue-500/30 text-blue-400 font-bold text-lg h-12" placeholder="Örn: 9000" />
              </div>
            </CardContent>
          </Card>

          {/* Müşterinin Aldığı Cihaz (VERİLEN) */}
          <div className="space-y-6">
            <Card className="glass-card border-emerald-500/20 shadow-lg shadow-emerald-500/5">
              <CardHeader className="border-b border-white/5 bg-emerald-500/5">
                <CardTitle className="text-emerald-400 flex items-center gap-2">2. Müşterinin Aldığı Cihaz</CardTitle>
                <CardDescription className="text-white/50">Stoklarımızdan müşteriye satılacak cihazın bilgileri.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-white/80">Stoktan Cihaz Seçin *</Label>
                  <Select onValueChange={(val) => setSelectedDevice(stockItems.find(i => i.id === val))}>
                    <SelectTrigger className="bg-black/50 border-[#222] text-white h-12">
                      <SelectValue placeholder="Marka, model veya imei..." />
                    </SelectTrigger>
                    <SelectContent className="bg-black/95 border-[#222] text-white max-h-64">
                      {stockItems.map(item => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.brand} {item.model} - {item.imei_1} {(user?.role === 'owner') && `(Mlyt: ${item.total_cost}₺)`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedDevice && (
                  <div className="p-3 bg-black/40 border border-white/5 rounded-md text-sm text-white/70">
                    <p><strong className="text-white">Ek Bilgi:</strong> {selectedDevice.device_origin || 'Belirtilmemiş'}</p>
                    <p><strong className="text-white">Kondisyon:</strong> %{selectedDevice.battery_health} Pil, {selectedDevice.cosmetic_condition || '-'}</p>
                  </div>
                )}

                <div className="space-y-2 pt-2">
                   <Label className="text-emerald-400 font-bold">Verilen Cihazın Satış Fiyatı (₺) *</Label>
                   <Input type="number" value={tradeInSalePrice} onChange={e => setTradeInSalePrice(e.target.value)} className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold text-lg h-12" placeholder="Örn: 25000" />
                </div>
              </CardContent>
            </Card>

            {/* Fiyat Farkı ve Onay Paneli */}
            <Card className="glass-card border-white/10 bg-[#080808]">
              <CardContent className="pt-6">
                 <div className="flex justify-between items-center bg-black/50 p-4 rounded border border-white/5 mb-6">
                    <div>
                      <div className="text-white/60 text-sm">Alınan Cihaz Bedeli:</div>
                      <div className="text-white font-medium">{oldPrice.toLocaleString()} ₺</div>
                    </div>
                    <div className="text-center">
                      <ArrowRightLeft className="w-6 h-6 text-white/20 mx-auto" />
                    </div>
                    <div className="text-right">
                      <div className="text-white/60 text-sm">Satılan Cihaz Bedeli:</div>
                      <div className="text-white font-medium">{newPrice.toLocaleString()} ₺</div>
                    </div>
                 </div>

                 <div className={`text-center p-4 rounded-md border ${priceDifference >= 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                    <div className="text-sm font-bold uppercase tracking-wider mb-1">
                      {priceDifference > 0 ? "Müşteriden Alınacak Fark" : priceDifference < 0 ? "Müşteriye Ödenecek Fark" : "Kafa Kafaya (Fark Yok)"}
                    </div>
                    <div className="text-4xl font-extrabold">{Math.abs(priceDifference).toLocaleString()} ₺</div>
                 </div>

                 <Button type="submit" disabled={loading || !selectedDevice} className="w-full mt-6 h-14 text-lg bg-white text-black hover:bg-gray-200 font-bold uppercase tracking-widest shadow-xl">
                   {loading ? 'İşleniyor...' : 'Takası Tamamla ve Belge Yazdır'}
                 </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>

      {/* GİZLİ PDF ŞABLONU (TAKAS SÖZLEŞMESİ) */}
      <div style={{ display: 'none' }}>
        <div id="trade-in-contract-template" style={{ width: '800px', backgroundColor: '#ffffff', color: '#000000', padding: '40px', fontFamily: 'sans-serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '20px', marginBottom: '20px' }}>
            <div>
              {shop?.logo_url && <img src={shop.logo_url} style={{ maxHeight: '60px', marginBottom: '10px' }} />}
              <h1 style={{ fontSize: '24px', margin: 0, fontWeight: 'bold' }}>{shop?.name || 'TELE-KAPAN ŞUBESİ'}</h1>
              <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#555' }}>V.D / No: {shop?.tax_info || '-'}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ fontSize: '18px', margin: 0, color: '#333' }}>2. EL CEP TELEFONU TAKAS (DEĞİŞİM) SÖZLEŞMESİ</h2>
              <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>Tarih: {new Date().toLocaleDateString('tr-TR')}</p>
            </div>
          </div>
          
          <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '5px', marginTop: '20px' }}>MÜŞTERİ BİLGİLERİ</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <tbody>
              <tr><td style={{ padding: '8px', border: '1px solid #ccc', width: '30%', backgroundColor:'#f9f9f9' }}><strong>Ad Soyad:</strong></td><td style={{ padding: '8px', border: '1px solid #ccc' }}>{oldDevice.seller_name}</td></tr>
              <tr><td style={{ padding: '8px', border: '1px solid #ccc', backgroundColor:'#f9f9f9' }}><strong>T.C. Kimlik No:</strong></td><td style={{ padding: '8px', border: '1px solid #ccc' }}>{oldDevice.seller_tc || '-'}</td></tr>
              <tr><td style={{ padding: '8px', border: '1px solid #ccc', backgroundColor:'#f9f9f9' }}><strong>İletişim:</strong></td><td style={{ padding: '8px', border: '1px solid #ccc' }}>{oldDevice.seller_phone}</td></tr>
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: '20px', marginTop: '30px' }}>
            <div style={{ flex: 1 }}>
               <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '5px', color: '#d32f2f' }}>MÜŞTERİNİN VERDİĞİ CİHAZ (ALINAN)</h3>
               <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                 <tbody>
                   <tr><td style={{ padding: '6px', border: '1px solid #eee', width: '40%' }}><strong>Marka/Model:</strong></td><td style={{ padding: '6px', border: '1px solid #eee' }}>{oldDevice.brand} {oldDevice.model}</td></tr>
                   <tr><td style={{ padding: '6px', border: '1px solid #eee' }}><strong>IMEI 1:</strong></td><td style={{ padding: '6px', border: '1px solid #eee' }}>{oldDevice.imei_1}</td></tr>
                   <tr><td style={{ padding: '6px', border: '1px solid #eee' }}><strong>Köken:</strong></td><td style={{ padding: '6px', border: '1px solid #eee' }}>{oldDevice.device_origin}</td></tr>
                   <tr><td style={{ padding: '6px', border: '1px solid #eee', backgroundColor: '#fff0f0' }}><strong>Sayım Fiyatı:</strong></td><td style={{ padding: '6px', border: '1px solid #eee' }}>{oldPrice} TL</td></tr>
                 </tbody>
               </table>
            </div>

            <div style={{ flex: 1 }}>
               <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '5px', color: '#2e7d32' }}>MÜŞTERİNİN ALDIĞI CİHAZ (VERİLEN)</h3>
               <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                 <tbody>
                   <tr><td style={{ padding: '6px', border: '1px solid #eee', width: '40%' }}><strong>Marka/Model:</strong></td><td style={{ padding: '6px', border: '1px solid #eee' }}>{selectedDevice?.brand} {selectedDevice?.model}</td></tr>
                   <tr><td style={{ padding: '6px', border: '1px solid #eee' }}><strong>IMEI 1:</strong></td><td style={{ padding: '6px', border: '1px solid #eee' }}>{selectedDevice?.imei_1}</td></tr>
                   <tr><td style={{ padding: '6px', border: '1px solid #eee' }}><strong>Köken:</strong></td><td style={{ padding: '6px', border: '1px solid #eee' }}>{selectedDevice?.device_origin}</td></tr>
                   <tr><td style={{ padding: '6px', border: '1px solid #eee', backgroundColor: '#f0fdf4' }}><strong>Satış Fiyatı:</strong></td><td style={{ padding: '6px', border: '1px solid #eee' }}>{newPrice} TL</td></tr>
                 </tbody>
               </table>
            </div>
          </div>

          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f5f5f5', border: '1px solid #ddd', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>HESAP ÖZETİ</h3>
            <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
              Nihai Fark Tutarı: <span style={{ color: priceDifference >= 0 ? '#2e7d32' : '#d32f2f' }}>{Math.abs(priceDifference).toLocaleString()} TL 
              {priceDifference >= 0 ? ' (Müşteri Tarafından Ödenecek/Ödenmiş)' : ' (Müşteriye Ödenecek/Ödenmiş)'}</span>
            </p>
          </div>

          <div style={{ marginTop: '40px', fontSize: '11px', lineHeight: '1.5', color: '#444' }}>
            <strong>Takas ve KVKK Açık Rıza Sözleşmesi:</strong><br />
            1) Müşteri (Satıcı/Alıcı), yukarıda &quot;Verdiği Cihaz&quot; başlığı altında tanımlanan cihazı mülkiyeti kendisine ait iken kendi hür iradesiyle Mağazaya devrettiğini; bu cihazın çalıntı/kayıtdışı olmadığını ve geçmiş kullanımdan doğacak tüm (adli/idari/TR yasal) sorumluluğun kendisine ait olduğunu beyan ve taahhüt eder.<br />
            2) Müşteri, yukarıda &quot;Aldığı Cihaz&quot; başlığı altındaki cihazı belirtilen değer ve çalışma durumunu bilerek (test ederek) teslim almıştır.<br />
            3) KVKK (6698) uyarınca şahsıma ait kimlik ve iletişim bilgilerinin, yetkili adli birimlerin cihaz sorgu taleplerinde kullanılabilmesi için işlenmesine AÇIK RIZAM vardır.<br />
            4) Hesap özetinde belirtilen tutar eksiksiz olarak taraflarca tahsil/teslim edilerek mutabakata varılmıştır. 
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px', padding: '0 40px' }}>
            <div style={{ textAlign: 'center' }}>
              <strong>MÜŞTERİ (Takas Yapan)</strong><br /><br /><br />
              İmza
            </div>
            <div style={{ textAlign: 'center' }}>
              <strong>MAĞAZA YETKİLİSİ</strong><br /><br /><br />
              Kaşe / İmza
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
