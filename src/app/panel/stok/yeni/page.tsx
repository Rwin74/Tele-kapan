'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/utils/supabase/client'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { ChevronLeft, UploadCloud, X, Search } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import imageCompression from 'browser-image-compression'
import { generatePDF } from '@/lib/pdfGenerator'

const cosmeticPresets = ["Kusursuz", "Kılcal Çizikler", "Kasa Vuruk", "Ekran Değişmiş", "Pil Değişmiş", "Arka Cam Kırık"];

const formSchema = z.object({
  brand: z.string().min(1, 'Marka zorunludur.'),
  model: z.string().min(1, 'Model zorunludur.'),
  storage: z.string().min(1, 'Hafıza seçilmelidir.'),
  warranty_status: z.string().min(1, 'Garanti durumu seçilmelidir.'),
  imei_1: z.string().min(15, 'IMEI 1 en az 15 hane olmalıdır.').max(15, 'IMEI 1 15 haneyi geçemez.'),
  imei_2: z.string().max(15).optional(),
  battery_health: z.string().optional(),
  cosmetic_condition: z.string().optional(),
  purchase_price: z.string().optional(),
  sale_price: z.string().optional(),
  
  // V1.1 Seller Info
  seller_shop_name: z.string().optional(),
  seller_name: z.string().optional(),
  seller_tc: z.string().optional(),
  seller_phone: z.string().optional(),
  
  // V1.1 Device Origin
  device_origin: z.string().min(1, 'Cihaz kökeni seçilmelidir.')
})

export default function YeniCihazPage() {
  const [loading, setLoading] = useState(false)
  const [photos, setPhotos] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [uploadedSaleData, setUploadedSaleData] = useState<any>(null) // State holding data for PDF
  
  const router = useRouter()
  const supabase = createClient()
  const { shop, user } = useAppStore()
  const [isStoreDevice, setIsStoreDevice] = useState(false)

  useEffect(() => {
    if (shop?.use_as_default_owner) {
      setIsStoreDevice(true)
    }
  }, [shop])

  const { register, handleSubmit, setValue, formState: { errors }, watch } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema)
  })

  // Watch fields needed for PDF
  const watchAllFields = watch()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newPhotos = [...photos, ...acceptedFiles]
    setPhotos(newPhotos)
    setPreviewUrls(newPhotos.map(file => URL.createObjectURL(file)))
  }, [photos])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 5
  })

  const removePhoto = (index: number) => {
    const newPhotos = [...photos]
    newPhotos.splice(index, 1)
    setPhotos(newPhotos)
    setPreviewUrls(newPhotos.map(file => URL.createObjectURL(file)))
  }

  const uploadImages = async (): Promise<string[]> => {
    if (photos.length === 0) return []
    
    const uploadedUrls: string[] = []
    
    // Compression Options
    const options = {
      maxSizeMB: 0.15, // 150 KB max
      maxWidthOrHeight: 1200,
      useWebWorker: true,
    }

    try {
      for (const file of photos) {
        toast.info(`Sıkıştırılıyor: ${file.name}`)
        const compressedFile = await imageCompression(file, options)
        
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`
        const filePath = `${shop?.id}/${fileName}`

        toast.info(`Yükleniyor: ${file.name}`)
        const { data, error } = await supabase.storage.from('device-images').upload(filePath, compressedFile)
        
        if (error) throw error
        
        const { data: { publicUrl } } = supabase.storage.from('device-images').getPublicUrl(filePath)
        uploadedUrls.push(publicUrl)
      }
      return uploadedUrls
    } catch (error: any) {
      console.error(error)
      throw new Error("Resim yükleme sırasında hata oluştu. " + error.message)
    }
  }

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!shop?.id) return toast.error('Dükkan bilgisi bulunamadı.')
    
    // Custom Validation
    if (isStoreDevice) {
      if (!values.purchase_price) return toast.error('Mağaza cihazları için Alış Fiyatı zorunludur.')
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const price = values.purchase_price ? parseFloat(values.purchase_price) : 0
      const salePrice = values.sale_price ? parseFloat(values.sale_price) : null
      
      let actualSellerShopName = values.seller_shop_name
      let actualSellerName = values.seller_name
      let actualSellerTc = values.seller_tc
      let actualSellerPhone = values.seller_phone

      if (isStoreDevice) {
        actualSellerShopName = shop.default_store_name || shop.name
        actualSellerName = ''
        actualSellerTc = '-'
        actualSellerPhone = '-'
      }
      
      // Upload Images to Cloud
      const uploadedImageUrls = await uploadImages()
      
      // Save to Inventory
      const { data: insertedDevice, error } = await supabase.from('inventory').insert({
        shop_id: shop.id,
        brand: values.brand,
        model: `${values.model} (${values.storage})`,
        imei_1: values.imei_1,
        imei_2: values.imei_2 || null,
        battery_health: values.battery_health ? parseInt(values.battery_health) : null,
        cosmetic_condition: `Garanti: ${values.warranty_status}${values.cosmetic_condition ? ` | ${values.cosmetic_condition}` : ''}`,
        purchase_price: price,
        total_cost: price, // Initial total cost defaults to purchase price
        sale_price: salePrice,
        is_store_device: isStoreDevice,
        store_name: isStoreDevice ? (shop.default_store_name || shop.name) : null,
        added_by: user?.id,
        status: 'in_stock',
        seller_name: `${actualSellerShopName}${actualSellerName ? ` (${actualSellerName})` : ''}`,
        seller_tc: actualSellerTc,
        seller_phone: actualSellerPhone,
        device_origin: values.device_origin,
        photos: uploadedImageUrls
      }).select().single()

      if (error) throw new Error(error.message)

      setUploadedSaleData({ ...values, id: insertedDevice?.id })

      toast.success('Cihaz başarıyla kaydedildi. Alım Onay Belgesi oluşturuluyor...')

      // Generate PDF
      setTimeout(async () => {
        await generatePDF('purchase-contract-template', `Alim_Belgesi_${values.imei_1}`)
        router.push('/panel/stok')
      }, 500)

    } catch (err: any) {
      toast.error(err.message || 'Hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto fade-in">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="bg-transparent border-[#2a2a2a] text-white hover:bg-white/10 hover:text-white">
          <Link href="/panel/stok"><ChevronLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Yeni Cihaz Alımı (v1.1)</h2>
          <p className="text-emerald-400/80 text-sm mt-1">Yasal kalkan devrede. Lütfen satıcı bilgilerini ve cihaz fotoğraflarını eksiksiz girin.</p>
        </div>
      </div>

      <div className="flex items-center gap-3 py-2 bg-white/5 p-4 rounded-lg border border-white/10">
        <input 
          type="checkbox" 
          id="isStoreDevice" 
          checked={isStoreDevice} 
          onChange={e => setIsStoreDevice(e.target.checked)} 
          className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500"
        />
        <label htmlFor="isStoreDevice" className="text-white font-medium cursor-pointer select-none">
          Bu benim kendi cihazım (Mağaza Cihazı)
        </label>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Satıcı Bilgileri (YASAL KALKAN) */}
        {!isStoreDevice && (
          <Card className="glass-card">
            <CardHeader>
            <CardTitle className="text-white">1. Tedarikçi (B2B) Bilgileri</CardTitle>
            <CardDescription className="text-white/50">Cihazı satın aldığınız dükkan ve yetkili kişi bilgileri.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
               <Label htmlFor="seller_shop_name" className="text-white/80">Dükkan Adı (Opsiyonel)</Label>
               <Input id="seller_shop_name" {...register('seller_shop_name')} className="bg-[#0f0f0f] border-[#222] text-white placeholder:text-white/20" placeholder="Örn: Ahmet İletişim" />
               {errors.seller_shop_name && <p className="text-red-400 text-xs">{errors.seller_shop_name.message}</p>}
            </div>
            <div className="space-y-2">
               <Label htmlFor="seller_name" className="text-white/80">Ad Soyad (Opsiyonel)</Label>
               <Input id="seller_name" {...register('seller_name')} className="bg-[#0f0f0f] border-[#222] text-white placeholder:text-white/20" placeholder="Teslim Eden Kişi" />
               {errors.seller_name && <p className="text-red-400 text-xs">{errors.seller_name.message}</p>}
            </div>
            <div className="space-y-2">
               <Label htmlFor="seller_tc" className="text-white/80">T.C. Kimlik No (Opsiyonel)</Label>
               <Input id="seller_tc" maxLength={11} {...register('seller_tc')} className="bg-[#0f0f0f] border-[#222] text-white placeholder:text-white/20" placeholder="11 Haneli" />
               {errors.seller_tc && <p className="text-red-400 text-xs">{errors.seller_tc.message}</p>}
            </div>
            <div className="space-y-2">
               <Label htmlFor="seller_phone" className="text-white/80">Telefon (Opsiyonel)</Label>
               <Input id="seller_phone" {...register('seller_phone')} className="bg-[#0f0f0f] border-[#222] text-white placeholder:text-white/20" placeholder="0555..." />
               {errors.seller_phone && <p className="text-red-400 text-xs">{errors.seller_phone.message}</p>}
            </div>
          </CardContent>
        </Card>
        )}

        {/* Cihaz Bilgileri */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-white">2. Cihaz Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label className="text-white/80">Cihaz Kökeni *</Label>
              <Select onValueChange={(val) => setValue('device_origin', val, { shouldValidate: true })}>
                <SelectTrigger className="bg-[#0f0f0f] border-[#222] text-white">
                  <SelectValue placeholder="Cihaz Tipi (TR / Yurtdışı)" />
                </SelectTrigger>
                <SelectContent className="bg-black/95 border-[#222] text-white">
                  <SelectItem value="TR Cihazı (Garantili/Garantisiz)">TR Cihazı (Garantili/Garantisiz)</SelectItem>
                  <SelectItem value="Yurtdışı (Kayıtlı)">Yurtdışı (Kayıtlı)</SelectItem>
                  <SelectItem value="Yurtdışı (Kayıtsız/Server Kayıtlı)">Yurtdışı (Kayıtsız/Server Kayıtlı)</SelectItem>
                </SelectContent>
              </Select>
              {errors.device_origin && <p className="text-red-400 text-xs">{errors.device_origin.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand" className="text-white/80">Marka *</Label>
              <Input id="brand" {...register('brand')} className="bg-[#0f0f0f] border-[#222] text-white placeholder:text-white/20" placeholder="Apple" />
              {errors.brand && <p className="text-red-400 text-xs">{errors.brand.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="model" className="text-white/80">Model *</Label>
              <Input id="model" {...register('model')} className="bg-[#0f0f0f] border-[#222] text-white placeholder:text-white/20" placeholder="iPhone 13 Pro" />
              {errors.model && <p className="text-red-400 text-xs">{errors.model.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">Hafıza (Storage) *</Label>
              <Select onValueChange={(val) => setValue('storage', val, { shouldValidate: true })}>
                <SelectTrigger className="bg-[#0f0f0f] border-[#222] text-white">
                  <SelectValue placeholder="Seçiniz" />
                </SelectTrigger>
                <SelectContent className="bg-black/95 border-[#222] text-white">
                  <SelectItem value="64GB">64 GB</SelectItem>
                  <SelectItem value="128GB">128 GB</SelectItem>
                  <SelectItem value="256GB">256 GB</SelectItem>
                  <SelectItem value="512GB">512 GB</SelectItem>
                  <SelectItem value="1TB">1 TB</SelectItem>
                </SelectContent>
              </Select>
              {errors.storage && <p className="text-red-400 text-xs">{errors.storage.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">Garanti Durumu *</Label>
              <Select onValueChange={(val) => setValue('warranty_status', val, { shouldValidate: true })}>
                <SelectTrigger className="bg-[#0f0f0f] border-[#222] text-white">
                  <SelectValue placeholder="Seçiniz" />
                </SelectTrigger>
                <SelectContent className="bg-black/95 border-[#222] text-white">
                  <SelectItem value="Garantili (Kutulu/Faturalı)">Garantili (Kutulu/Faturalı)</SelectItem>
                  <SelectItem value="Garantisi Bitmiş">Garantisi Bitmiş</SelectItem>
                  <SelectItem value="Yurtdışı / Garantisiz">Yurtdışı / Garantisiz</SelectItem>
                </SelectContent>
              </Select>
              {errors.warranty_status && <p className="text-red-400 text-xs">{errors.warranty_status.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="imei_1" className="text-white/80">IMEI 1 *</Label>
              <div className="flex gap-2">
                <Input id="imei_1" {...register('imei_1')} className="bg-[#0f0f0f] border-[#222] text-white placeholder:text-white/20" placeholder="15 haneli" />
                <Button type="button" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 px-3 shrink-0" onClick={() => {
                  const val = watchAllFields.imei_1;
                  if(val && val.toString().length > 5) {
                    navigator.clipboard.writeText(val.toString());
                    window.open('https://www.turkiye.gov.tr/imei-sorgulama', '_blank');
                    toast.success("IMEI kopyalandı, e-Devlet açılıyor...");
                  } else {
                    toast.error("Lütfen önce geçerli bir IMEI girin.");
                  }
                }} title="BTK Sorgula"><Search className="h-4 w-4 mr-1 md:hidden xl:inline-block" /> BTK</Button>
              </div>
              {errors.imei_1 && <p className="text-red-400 text-xs">{errors.imei_1.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="imei_2" className="text-white/80">IMEI 2 (Varsa)</Label>
              <div className="flex gap-2">
                <Input id="imei_2" {...register('imei_2')} className="bg-[#0f0f0f] border-[#222] text-white placeholder:text-white/20" placeholder="Seçmeli" />
                <Button type="button" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 px-3 shrink-0" onClick={() => {
                  const val = watchAllFields.imei_2;
                  if(val && val.toString().length > 5) {
                    navigator.clipboard.writeText(val.toString());
                    window.open('https://www.turkiye.gov.tr/imei-sorgulama', '_blank');
                    toast.success("IMEI kopyalandı, e-Devlet açılıyor...");
                  } else {
                    toast.error("Lütfen önce geçerli bir IMEI girin.");
                  }
                }} title="BTK Sorgula"><Search className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="battery_health" className="text-white/80">Pil Sağlığı (%)</Label>
              <Input id="battery_health" type="number" {...register('battery_health')} className="bg-[#0f0f0f] border-[#222] text-white placeholder:text-white/20" placeholder="85" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cosmetic_condition" className="text-white/80">Kozmetik Durum Özeti</Label>
              <Input id="cosmetic_condition" {...register('cosmetic_condition')} className="bg-[#0f0f0f] border-[#222] text-white placeholder:text-white/20" placeholder="Klavye, kasa yanlarında çizik..." />
              <div className="flex flex-wrap gap-2 mt-2">
                 {cosmeticPresets.map(preset => (
                     <button type="button" key={preset} onClick={() => {
                         const current = watchAllFields.cosmetic_condition || '';
                         setValue('cosmetic_condition', current ? `${current}, ${preset}` : preset, { shouldValidate: true })
                     }} className="text-xs bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-md border border-white/10 transition-colors">
                        {preset}
                     </button>
                 ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchase_price" className="text-white/80 text-emerald-400 font-bold">Alış Fiyatı (₺) {isStoreDevice ? '*' : ''}</Label>
              <Input id="purchase_price" type="number" {...register('purchase_price')} className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400 text-xl font-bold placeholder:text-emerald-400/20" placeholder="15000" />
              {errors.purchase_price && <p className="text-red-400 text-xs">{errors.purchase_price.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale_price" className="text-white/80 text-amber-400 font-bold">Satış Fiyatı (₺) (Opsiyonel)</Label>
              <Input id="sale_price" type="number" {...register('sale_price')} className="bg-amber-500/10 border-amber-500/30 text-amber-400 text-xl font-bold placeholder:text-amber-400/20" placeholder="Örn: 18000" />
            </div>
          </CardContent>
        </Card>

        {/* Görsel Hafıza (Fotoğraflar) */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-white border-l-4 border-emerald-500 pl-3">3. Görsel Hafıza (Cihaz Kanıt Fotoğrafları)</CardTitle>
            <CardDescription className="text-white/50 pl-4">Cihazın kozmetik durumu ileride sorun yaşamamak için kaydedilir. Resimler cihazınızda sıkıştırılarak yer tassarrufu sağlanır.</CardDescription>
          </CardHeader>
          <CardContent>
             <div 
               {...getRootProps()} 
               className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-[#333] hover:border-[#555] bg-[#0c0c0c]'}`}
             >
               <input {...getInputProps()} />
               <UploadCloud className="mx-auto h-12 w-12 text-white/40 mb-4" />
               <p className="text-white/70">Fotoğrafları sürükleyip bırakın veya seçmek için tıklayın.</p>
               <p className="text-xs text-white/40 mt-1">Sadece Resim Formatları - Maksimum 5 Görsel</p>
             </div>

             {/* Preview Uploaded Images */}
             {previewUrls.length > 0 && (
               <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
                 {previewUrls.map((url, index) => (
                   <div key={index} className="relative group rounded-md overflow-hidden border border-[#222] aspect-square bg-[#050505]">
                     <img src={url} alt={`preview-${index}`} className="object-cover w-full h-full opacity-80" />
                     <button 
                       type="button" 
                       onClick={() => removePhoto(index)}
                       className="absolute top-1 right-1 bg-black/60 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                     >
                       <X className="h-4 w-4" />
                     </button>
                   </div>
                 ))}
               </div>
             )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 pb-12">
          <Button type="button" variant="outline" className="border-[#222] text-white hover:bg-white/5" asChild>
            <Link href="/panel/stok">İptal</Link>
          </Button>
          <Button type="submit" disabled={loading} className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold uppercase tracking-wide px-8">
            {loading ? 'Yükleniyor ve Kaydediliyor...' : 'Sisteme Kaydet & Belge Çıkar'}
          </Button>
        </div>
      </form>

      {/* GİZLİ PDF ŞABLONU (ALIM SÖZLEŞMESİ) */}
      <div style={{ display: 'none' }}>
        <div id="purchase-contract-template" style={{ width: '800px', backgroundColor: '#ffffff', color: '#000000', padding: '40px', fontFamily: 'sans-serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '20px', marginBottom: '20px' }}>
            <div>
              {shop?.logo_url && <img src={shop.logo_url} style={{ maxHeight: '60px', marginBottom: '10px' }} />}
              <h1 style={{ fontSize: '24px', margin: 0, fontWeight: 'bold' }}>{shop?.name || 'TELE-KAPAN ŞUBESİ'}</h1>
              <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#555' }}>V.D / No: {shop?.tax_info || '-'}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ fontSize: '18px', margin: 0, color: '#333' }}>2. EL CİHAZ ALIM SÖZLEŞMESİ (Yasal)</h2>
              <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>Tarih: {new Date().toLocaleDateString('tr-TR')}</p>
              {uploadedSaleData?.id && <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#888' }}>Ref: {uploadedSaleData.id.substring(0,8)}</p>}
            </div>
          </div>
          
          <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '5px', marginTop: '20px' }}>SATICI BİLGİLERİ (Satan Kişi)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <tbody>
              <tr><td style={{ padding: '8px', border: '1px solid #ccc', width: '30%', backgroundColor:'#f9f9f9' }}><strong>Tedarikçi Dükkan:</strong></td><td style={{ padding: '8px', border: '1px solid #ccc' }}>{isStoreDevice ? (shop?.default_store_name || shop?.name) : `${watchAllFields.seller_shop_name} ${watchAllFields.seller_name ? `(${watchAllFields.seller_name})` : ''}`}</td></tr>
              <tr><td style={{ padding: '8px', border: '1px solid #ccc', backgroundColor:'#f9f9f9' }}><strong>T.C. Kimlik No:</strong></td><td style={{ padding: '8px', border: '1px solid #ccc' }}>{isStoreDevice ? '-' : watchAllFields.seller_tc}</td></tr>
              <tr><td style={{ padding: '8px', border: '1px solid #ccc', backgroundColor:'#f9f9f9' }}><strong>İletişim:</strong></td><td style={{ padding: '8px', border: '1px solid #ccc' }}>{isStoreDevice ? '-' : watchAllFields.seller_phone}</td></tr>
            </tbody>
          </table>

          <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '5px', marginTop: '20px' }}>CİHAZ BİLGİLERİ</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <tbody>
              <tr><td style={{ padding: '8px', border: '1px solid #ccc', width: '30%', backgroundColor:'#f9f9f9' }}><strong>Marka / Model:</strong></td><td style={{ padding: '8px', border: '1px solid #ccc' }}>{watchAllFields.brand} {watchAllFields.model} ({watchAllFields.storage})</td></tr>
              <tr><td style={{ padding: '8px', border: '1px solid #ccc', backgroundColor:'#f9f9f9' }}><strong>Garanti / Kozmetik:</strong></td><td style={{ padding: '8px', border: '1px solid #ccc' }}>{watchAllFields.warranty_status} | {watchAllFields.cosmetic_condition || 'Belirtilmedi'}</td></tr>
              <tr><td style={{ padding: '8px', border: '1px solid #ccc', backgroundColor:'#f9f9f9' }}><strong>Cihaz Kökeni:</strong></td><td style={{ padding: '8px', border: '1px solid #ccc' }}>{watchAllFields.device_origin}</td></tr>
              <tr><td style={{ padding: '8px', border: '1px solid #ccc', backgroundColor:'#f9f9f9' }}><strong>IMEI 1:</strong></td><td style={{ padding: '8px', border: '1px solid #ccc' }}>{watchAllFields.imei_1}</td></tr>
              <tr><td style={{ padding: '8px', border: '1px solid #ccc', backgroundColor:'#f9f9f9' }}><strong>IMEI 2:</strong></td><td style={{ padding: '8px', border: '1px solid #ccc' }}>{watchAllFields.imei_2 || '-'}</td></tr>
              <tr><td style={{ padding: '8px', border: '1px solid #ccc', backgroundColor:'#f9f9f9' }}><strong>Alış Tutarı:</strong></td><td style={{ padding: '8px', border: '1px solid #ccc' }}>{watchAllFields.purchase_price} TL</td></tr>
            </tbody>
          </table>

          <div style={{ marginTop: '40px', fontSize: '12px', lineHeight: '1.6', color: '#222', border: '1px solid #ddd', padding: '15px' }}>
            <strong>İkinci El Alım-Satım Sözleşmesi ve KVKK Açık Rıza Beyanı:</strong><br /><br />
            Yukarıda marka, model ve seri (IMEI) numarası belirtilen iletişim cihazının mülkiyeti tarafıma ait iken, hür irademle <strong>{shop?.name || 'isimli mağazaya'}</strong> satışını ve devrini gerçekleştirdim. 
            Bu cihazın daha önce herhangi bir yasadışı işlemde kullanılmadığını, &quot;hırsızlık malı&quot; veya &quot;kayıtdışı&quot; olmadığını, yurtiçi kullanım kurallarına uyduğunu kabul ederim. Cihazın her türlü idari, adli ve hukuki sorumluluğunun satış tarihine kadar bana ait olduğunu beyan ve taahhüt ederim.<br /><br />
            KVKK kapsamında (6698 sayılı kanun) şahsıma ait kimlik, isim ve iletişim bilgilerince resmi denetim kurumlarına ve adli makamlara dükkan sahibince teslim edilebilmesine <strong>Açık Rızam</strong> vardır. Cihaz bedelini nakden veya banka aracılığıyla eksiksiz olarak tahsil ettim.
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px', padding: '0 40px' }}>
            <div style={{ textAlign: 'center' }}>
              <strong>SATICI (Cihazı Teslim Eden)</strong><br /><br />
              İmza
            </div>
            <div style={{ textAlign: 'center' }}>
              <strong>MAĞAZA YETKİLİSİ</strong><br /><br />
              Kaşe / İmza
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
