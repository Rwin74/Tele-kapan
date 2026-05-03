'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Plus, Search, DollarSign, UploadCloud, X, Image as ImageIcon, ChevronLeft } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import imageCompression from 'browser-image-compression'

export default function StokClient({ initialData, isOwner, shopId }: { initialData: any[], isOwner: boolean, shopId: string }) {
  const [data, setData] = useState(initialData)
  const [search, setSearch] = useState('')
  const [expenseDialogId, setExpenseDialogId] = useState<string | null>(null)
  
  // Masraf States
  const [expenseDesc, setExpenseDesc] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [replacedParts, setReplacedParts] = useState('')
  const [repairPhotos, setRepairPhotos] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  
  // Satış States
  const [sellDialogId, setSellDialogId] = useState<string | null>(null)
  const [sellPriceInput, setSellPriceInput] = useState('')
  
  // Yeni Özellik States
  const [photoDialogId, setPhotoDialogId] = useState<string | null>(null)
  const [additionalPhotos, setAdditionalPhotos] = useState<File[]>([])
  const [additionalPreviewUrls, setAdditionalPreviewUrls] = useState<string[]>([])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)

  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [editingPriceType, setEditingPriceType] = useState<'purchase' | 'sale' | null>(null)
  const [editingPriceValue, setEditingPriceValue] = useState('')

  // Galeri States
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>([])
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [scale, setScale] = useState(1)

  const [loading, setLoading] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  const openGallery = (photos: string[]) => {
    setGalleryPhotos(photos)
    setGalleryIndex(0)
    setScale(1)
    setGalleryOpen(true)
  }

  // Sürükle Bırak Mantığı (Repair Photos)
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newPhotos = [...repairPhotos, ...acceptedFiles]
    setRepairPhotos(newPhotos)
    setPreviewUrls(newPhotos.map(file => URL.createObjectURL(file)))
  }, [repairPhotos])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 3
  })

  const removePhoto = (index: number) => {
    const newPhotos = [...repairPhotos]
    newPhotos.splice(index, 1)
    setRepairPhotos(newPhotos)
    setPreviewUrls(newPhotos.map(file => URL.createObjectURL(file)))
  }

  const uploadImages = async (): Promise<string[]> => {
    if (repairPhotos.length === 0) return []
    const uploadedUrls: string[] = []
    const options = { maxSizeMB: 0.15, maxWidthOrHeight: 1200, useWebWorker: true }

    for (const file of repairPhotos) {
      const compressedFile = await imageCompression(file, options)
      const fileName = `repair_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`
      const filePath = `${shopId}/${fileName}`
      
      const { error } = await supabase.storage.from('device-images').upload(filePath, compressedFile)
      if (error) throw error
      
      const { data: { publicUrl } } = supabase.storage.from('device-images').getPublicUrl(filePath)
      uploadedUrls.push(publicUrl)
    }
    return uploadedUrls
  }

  const handleAddExpense = async () => {
    if (!expenseDialogId || !expenseDesc || !expenseAmount) return
    setLoading(true)

    try {
      const amount = parseFloat(expenseAmount)
      if (isNaN(amount) || amount <= 0) throw new Error("Geçerli bir masraf tutarı giriniz.")

      const { data: { user } } = await supabase.auth.getUser()

      // Resimleri Upload Et
      let uploadedImageUrls: string[] = []
      if (repairPhotos.length > 0) {
        toast.info("Tamir kanıt resimleri yükleniyor...")
        uploadedImageUrls = await uploadImages()
      }

      // Parçaları diziye çevir (örn: "Ekran, Batarya" -> ["Ekran", "Batarya"])
      const partsArray = replacedParts.split(',').map(p => p.trim()).filter(p => p !== '')

      const { error } = await supabase.from('expenses').insert({
        inventory_id: expenseDialogId,
        shop_id: shopId,
        description: expenseDesc,
        cost_amount: amount,
        added_by: user?.id,
        replaced_parts: partsArray.length > 0 ? partsArray : null,
        repair_photos: uploadedImageUrls.length > 0 ? uploadedImageUrls : null
      })

      if (error) throw new Error(error.message)

      toast.success('Masraf ve kanıtlar başarıyla eklendi!')
      resetExpenseDialog()
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Masraf eklenemedi.')
    } finally {
      setLoading(false)
    }
  }

  const resetExpenseDialog = () => {
    setExpenseDialogId(null)
    setExpenseDesc('')
    setExpenseAmount('')
    setReplacedParts('')
    setRepairPhotos([])
    setPreviewUrls([])
  }

  const handleScrapDevice = async (id: string) => {
    // We are using window.confirm for simplicity, which matches the user's req (Dialog/Modal).
    if (!window.confirm("Bu cihazı yedek parçaya ayırmak istediğinize emin misiniz? Cihaz satış listesinden düşecektir.")) return;
    
    try {
      const { error } = await supabase.from('inventory').update({ status: 'scrapped' }).eq('id', id);
      if (error) throw error;
      
      toast.success("Cihaz hurdaya (yedek parçaya) ayrıldı ve stok listesinden düşürüldü.");
      setData(prev => prev.filter(item => item.id !== id));
      router.refresh();
    } catch (err: any) {
      toast.error("İşlem başarısız: " + err.message);
    }
  }

  const handleMarkAsSold = async () => {
    if (!sellDialogId) return
    const amount = parseFloat(sellPriceInput)
    if (isNaN(amount) || amount <= 0) return toast.error("Geçerli bir satış fiyatı girin.")

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { error } = await supabase.from('sales').insert({
        inventory_id: sellDialogId,
        shop_id: shopId,
        sold_by: user?.id,
        sale_price: amount,
        payment_method: 'Nakit/Diğer (Hızlı Satış)',
        customer_name: 'Hızlı Satış',
        customer_tc: '-',
        customer_phone: '-'
      })

      if (error) throw error

      toast.success('Cihaz satıldı olarak işaretlendi!')
      
      setData(prev => prev.map(item => {
        if (item.id === sellDialogId) {
          return {
            ...item,
            status: 'sold',
            is_sold: true,
            sale_price: amount,
            profit: amount - item.purchase_price
          }
        }
        return item
      }))
      
      setSellDialogId(null)
      setSellPriceInput('')
    } catch (err: any) {
      toast.error(err.message || 'Hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  const promptPriceReduce = async (id: string, currentPrice: number | null) => {
     const val = window.prompt("Yeni satış fiyatını girin:", currentPrice ? String(currentPrice) : "")
     if (!val) return
     const numVal = parseFloat(val)
     if (isNaN(numVal)) return toast.error("Geçersiz fiyat")
     
     try {
       const { error } = await supabase.from('inventory').update({ sale_price: numVal }).eq('id', id)
       if (error) throw error
       setData(prev => prev.map(i => i.id === id ? { ...i, sale_price: numVal } : i))
       toast.success("Satış fiyatı güncellendi")
     } catch(err:any) {
       toast.error("İşlem başarısız: " + err.message)
     }
  }

  const handleDeleteDevice = async (id: string) => {
    if (!window.confirm("Bu cihazı tamamen SİLMEK istediğinize emin misiniz? Bu işlem geri alınamaz!")) return;
    try {
      const { error } = await supabase.from('inventory').delete().eq('id', id);
      if (error) throw error;
      toast.success("Cihaz tamamen silindi.");
      setData(prev => prev.filter(item => item.id !== id));
      router.refresh();
    } catch (err: any) {
      toast.error("Silme başarısız: " + err.message);
    }
  }

  const handleEditPriceSubmit = async (id: string, type: 'purchase' | 'sale') => {
    const val = parseFloat(editingPriceValue)
    if (isNaN(val)) {
      setEditingPriceId(null)
      setEditingPriceType(null)
      return toast.error("Geçerli bir rakam girin")
    }
    
    try {
      const item = data.find(i => i.id === id)
      if (!item) return

      let finalUpdate = {}
      if (type === 'purchase') {
        const expenseSum = (item.total_cost || 0) - (item.purchase_price || 0)
        finalUpdate = { purchase_price: val, total_cost: val + expenseSum }
      } else {
        finalUpdate = { sale_price: val }
      }

      const { error } = await supabase.from('inventory').update(finalUpdate).eq('id', id)
      if (error) throw error
      
      toast.success("Fiyat güncellendi")
      setData(prev => prev.map(i => i.id === id ? { ...i, ...finalUpdate } : i))
    } catch(err:any) {
      toast.error(err.message)
    } finally {
      setEditingPriceId(null)
      setEditingPriceType(null)
    }
  }

  const handleUploadAdditionalPhotos = async () => {
    if (!photoDialogId || additionalPhotos.length === 0) return
    setUploadingPhotos(true)
    try {
      const item = data.find(i => i.id === photoDialogId)
      if (!item) throw new Error("Cihaz bulunamadı")

      const options = { maxSizeMB: 0.15, maxWidthOrHeight: 1200, useWebWorker: true }
      const newUrls: string[] = []

      for (const file of additionalPhotos) {
        const compressedFile = await imageCompression(file, options)
        const fileName = `add_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`
        const filePath = `${shopId}/${fileName}`
        
        const { error } = await supabase.storage.from('device-images').upload(filePath, compressedFile)
        if (error) throw error
        
        const { data: { publicUrl } } = supabase.storage.from('device-images').getPublicUrl(filePath)
        newUrls.push(publicUrl)
      }

      const updatedPhotos = [...(item.photos || []), ...newUrls]
      
      const { error: dbError } = await supabase.from('inventory').update({ photos: updatedPhotos }).eq('id', photoDialogId)
      if (dbError) throw dbError

      toast.success("Fotoğraflar eklendi")
      setData(prev => prev.map(i => i.id === photoDialogId ? { ...i, photos: updatedPhotos } : i))
      setPhotoDialogId(null)
      setAdditionalPhotos([])
      setAdditionalPreviewUrls([])
    } catch(err:any) {
      toast.error(err.message)
    } finally {
      setUploadingPhotos(false)
    }
  }

  const handleGmailExport = () => {
    const lines = filtered.map(item => `- ${item.brand} ${item.model} | IMEI: ${item.imei_1} | Durum: ${item.status === 'in_stock' ? 'Stokta' : 'Satıldı'} | Alış: ${item.purchase_price} | Satış: ${item.sale_price || '-'}`)
    const body = encodeURIComponent("Güncel Stok Listesi:\n\n" + lines.join("\n"))
    const subject = encodeURIComponent("Tele-Kapan Stok Listesi")
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=&su=${subject}&body=${body}`, '_blank')
  }

  const filtered = data.filter(item => 
    item.brand.toLowerCase().includes(search.toLowerCase()) || 
    item.model.toLowerCase().includes(search.toLowerCase()) ||
    item.imei_1?.includes(search)
  )

  const totalDevices = data.length
  const totalSold = data.filter(item => item.status === 'sold').length
  const totalProfit = data.filter(item => item.status === 'sold').reduce((sum, item) => sum + (item.profit || 0), 0)

  return (
    <div className="space-y-4">
      {/* Özet Kartları */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
        <div className="glass-card bg-[#0a0a0a]/80 border-white/5 rounded-xl p-4">
          <p className="text-white/50 text-sm mb-1">Toplam Cihaz</p>
          <p className="text-2xl font-bold text-white">{totalDevices}</p>
        </div>
        <div className="glass-card bg-[#0a0a0a]/80 border-white/5 rounded-xl p-4">
          <p className="text-white/50 text-sm mb-1">Satılan</p>
          <p className="text-2xl font-bold text-emerald-400">{totalSold}</p>
        </div>
        {isOwner && (
          <div className="glass-card bg-[#0a0a0a]/80 border-white/5 rounded-xl p-4 col-span-2 sm:col-span-1">
            <p className="text-white/50 text-sm mb-1">Toplam Kâr</p>
            <p className="text-2xl font-bold text-amber-400">{totalProfit} ₺</p>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-black/40 p-4 rounded-lg border border-white/5">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-emerald-500/50" />
          <Input 
            placeholder="Marka, model veya IMEI ara..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[#0c0c0c] border-[#222] text-white focus-visible:ring-emerald-500"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={handleGmailExport} variant="outline" className="w-full sm:w-auto bg-transparent border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300">
            Gmail ile Paylaş
          </Button>
          <Link href="/panel/stok/yeni" className="w-full sm:w-auto">
            <Button className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold">
              <Plus className="mr-2 h-4 w-4" /> Yeni Cihaz Alımı Yap
            </Button>
          </Link>
        </div>
      </div>

      <div className="border border-[#222] rounded-lg glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader className="bg-[#050505]">
            <TableRow className="border-[#222]">
              <TableHead className="text-white/60">Marka / Model</TableHead>
              <TableHead className="text-white/60">IMEI</TableHead>
              <TableHead className="text-white/60">Durum</TableHead>
              {isOwner && <TableHead className="text-white/60 text-right">Alış / Toplam</TableHead>}
              {isOwner && <TableHead className="text-white/60 text-right">Satış / Kâr</TableHead>}
              <TableHead className="text-white/60 text-right">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="border-[#222] hover:bg-white/5">
                <TableCell colSpan={isOwner ? 5 : 4} className="h-24 text-center text-white/50">
                  Stokta cihaz bulunamadı.
                </TableCell>
              </TableRow>
            ) : filtered.map((item) => (
              <TableRow key={item.id} className="border-[#222] hover:bg-[#0c0c0c] transition-colors">
                <TableCell className="font-medium text-white">
                  <div className="flex items-center gap-3">
                    {item.photos && item.photos.length > 0 && (
                       <div 
                         className="w-10 h-10 rounded border border-white/10 overflow-hidden cursor-pointer shrink-0 group relative" 
                         onClick={() => openGallery(item.photos)}
                       >
                         <img src={item.photos[0]} alt="thumbnail" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <ImageIcon className="w-4 h-4 text-white" />
                         </div>
                       </div>
                    )}
                    <div>
                      {item.brand} {item.model}
                      {item.seller_name && <div className="text-[10px] text-emerald-400/60 mt-1">Satıcı: {item.seller_name}</div>}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-white/80 text-xs">
                  {item.imei_1}<br/>
                  {item.imei_2 && <span className="text-white/50">{item.imei_2}</span>}
                </TableCell>
                <TableCell className="text-white/80 text-xs">
                   {item.status === 'sold' ? (
                     <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider border border-green-500/30">Satıldı</span>
                   ) : (
                     <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider border border-yellow-500/30">Stokta</span>
                   )}
                </TableCell>
                {isOwner && (
                  <TableCell className="text-right text-white text-xs">
                    <div 
                      className="text-white/50 block cursor-pointer hover:bg-white/10 rounded px-1 transition-colors group relative"
                      onClick={() => { setEditingPriceId(item.id); setEditingPriceType('purchase'); setEditingPriceValue(String(item.purchase_price)) }}
                    >
                      Alış: {editingPriceId === item.id && editingPriceType === 'purchase' ? (
                        <input 
                          type="number" 
                          autoFocus 
                          value={editingPriceValue} 
                          onChange={e => setEditingPriceValue(e.target.value)} 
                          onBlur={() => handleEditPriceSubmit(item.id, 'purchase')} 
                          onKeyDown={e => e.key === 'Enter' && handleEditPriceSubmit(item.id, 'purchase')} 
                          className="w-16 bg-black border border-white/20 text-white rounded px-1" 
                        />
                      ) : (
                        <span>{item.purchase_price} ₺</span>
                      )}
                    </div>
                    <span className="font-bold">Maliyet: {item.total_cost} ₺</span>
                  </TableCell>
                )}
                {isOwner && (
                  <TableCell className="text-right text-white text-xs">
                    {item.status === 'sold' || item.sale_price ? (
                      <>
                        <div 
                          className="text-white/50 block cursor-pointer hover:bg-white/10 rounded px-1 transition-colors group relative"
                          onClick={() => { setEditingPriceId(item.id); setEditingPriceType('sale'); setEditingPriceValue(String(item.sale_price)) }}
                        >
                          Satış: {editingPriceId === item.id && editingPriceType === 'sale' ? (
                            <input 
                              type="number" 
                              autoFocus 
                              value={editingPriceValue} 
                              onChange={e => setEditingPriceValue(e.target.value)} 
                              onBlur={() => handleEditPriceSubmit(item.id, 'sale')} 
                              onKeyDown={e => e.key === 'Enter' && handleEditPriceSubmit(item.id, 'sale')} 
                              className="w-16 bg-black border border-white/20 text-white rounded px-1" 
                            />
                          ) : (
                            <span>{item.sale_price} ₺</span>
                          )}
                        </div>
                        {item.status === 'sold' && <span className="text-amber-400 font-bold tracking-wide">Kâr: {item.profit} ₺</span>}
                      </>
                    ) : (
                      <span className="text-white/30 cursor-pointer hover:bg-white/10 rounded px-1" onClick={() => promptPriceReduce(item.id, null)}>Fiyat Belirle</span>
                    )}
                  </TableCell>
                )}
                <TableCell className="text-right">
                   <div className="flex items-center justify-end gap-2 flex-wrap sm:flex-nowrap">
                     {item.status === 'in_stock' && (
                       <>
                         <Button 
                           variant="outline" 
                           size="sm" 
                           onClick={() => promptPriceReduce(item.id, item.sale_price)}
                           className="bg-transparent border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 text-xs px-2"
                         >
                           Fiyat Düşür
                         </Button>
                         <Button 
                           variant="outline" 
                           size="sm" 
                           onClick={() => {
                             setSellDialogId(item.id)
                             setSellPriceInput(item.sale_price ? String(item.sale_price) : '')
                           }}
                           className="bg-transparent border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400 text-xs px-2"
                           title="Satıldı Olarak İşaretle"
                         >
                           Satış Yap
                         </Button>
                       </>
                     )}
                     <Button 
                       variant="outline" 
                       size="sm" 
                       onClick={() => setPhotoDialogId(item.id)}
                       className="bg-transparent border-white/10 text-white/70 hover:bg-white/10 hover:text-white text-xs px-2"
                     >
                       <ImageIcon className="w-3 h-3 md:mr-1" /><span className="hidden md:inline">Resim Ekle</span>
                     </Button>
                     <Button 
                       variant="outline" 
                       size="sm" 
                       onClick={() => setExpenseDialogId(item.id)}
                       className="bg-transparent border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                     >
                       <DollarSign className="mr-1 w-3 h-3" /> Log/Masraf Ekle
                     </Button>
                     {isOwner && (
                       <>
                         <Button 
                           variant="outline" 
                           size="sm" 
                           onClick={() => handleScrapDevice(item.id)}
                           className="bg-transparent border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300 text-xs px-2"
                           title="Yedek Parçaya Ayır / Hurdaya Çıkar"
                         >
                           Yedek Parça
                         </Button>
                         <Button 
                           variant="outline" 
                           size="sm" 
                           onClick={() => handleDeleteDevice(item.id)}
                           className="bg-transparent border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-400 text-xs px-2"
                           title="Sistemi Tamamen Sil"
                         >
                           Sil
                         </Button>
                       </>
                     )}
                   </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </div>

      <Dialog open={!!expenseDialogId} onOpenChange={(open) => !open && resetExpenseDialog()}>
        <DialogContent className="glass-card border-[#222] bg-[#0c0c0c] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-emerald-400">Tamir & Masraf Kaydı</DialogTitle>
            <DialogDescription className="text-white/50">Yapılan işlemi, tutarı ve var ise kanıt fotoğraflarını yükleyin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="desc" className="text-white/80">Tamir/Masraf İşlemi (Örn: Ekran değişimi yapıldı)</Label>
              <Input id="desc" value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} className="bg-[#050505] border-[#222] text-white" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parts" className="text-white/80">Değişen Parçalar (İsteğe bağlı, virgülle ayırın)</Label>
              <Input id="parts" value={replacedParts} onChange={e => setReplacedParts(e.target.value)} placeholder="Örn: Orijinal İçi Dolu Kasa, Revize Ekran..." className="bg-[#050505] border-[#222] text-white text-xs" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-emerald-400 font-bold">Maliyet Tutarı (₺) *</Label>
              <Input id="amount" type="number" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold" />
            </div>

            {/* Tamir Fotoğrafları Yükleme Alanı */}
            <div className="space-y-2 pt-2">
               <Label className="text-white/80">Kanıt Görselleri (Eski Parça / Fatura vb.)</Label>
               <div {...getRootProps()} className={`border-2 border-dashed rounded p-4 text-center cursor-pointer transition-colors ${isDragActive ? 'border-emerald-500 bg-emerald-500/10' : 'border-[#333] hover:border-[#555] bg-[#050505]'}`}>
                 <input {...getInputProps()} />
                 <UploadCloud className="mx-auto h-6 w-6 text-white/30 mb-2" />
                 <p className="text-white/50 text-xs">Resimleri buraya sürükleyip bırakın</p>
               </div>
               {previewUrls.length > 0 && (
                 <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                   {previewUrls.map((url, index) => (
                     <div key={index} className="relative group rounded overflow-hidden border border-[#222] w-16 h-16 shrink-0 bg-black">
                       <img src={url} alt={`preview-${index}`} className="object-cover w-full h-full opacity-70" />
                       <button type="button" onClick={() => removePhoto(index)} className="absolute inset-0 m-auto w-6 h-6 bg-red-500/80 rounded-full text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                         <X className="h-3 w-3" />
                       </button>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={resetExpenseDialog} className="text-white/70 hover:text-white hover:bg-white/5">İptal</Button>
            <Button onClick={handleAddExpense} disabled={loading || !expenseDesc || !expenseAmount} className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold">
              {loading ? 'Yükleniyor...' : 'Sisteme İşle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Satış Dialog */}
      <Dialog open={!!sellDialogId} onOpenChange={(open) => !open && setSellDialogId(null)}>
        <DialogContent className="glass-card border-[#222] bg-[#0c0c0c] text-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-amber-400">Hızlı Satış Yap</DialogTitle>
            <DialogDescription className="text-white/50">Cihazın satış fiyatını girin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sell_amount" className="text-amber-400 font-bold">Satış Fiyatı (₺) *</Label>
              <Input id="sell_amount" type="number" value={sellPriceInput} onChange={e => setSellPriceInput(e.target.value)} className="bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSellDialogId(null)} className="text-white/70 hover:text-white hover:bg-white/5">İptal</Button>
            <Button onClick={handleMarkAsSold} disabled={loading || !sellPriceInput} className="bg-amber-500 hover:bg-amber-400 text-black font-bold">
              {loading ? 'İşleniyor...' : 'Satış Yap'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resim Ekleme Dialog */}
      <Dialog open={!!photoDialogId} onOpenChange={(open) => {
        if(!open) {
          setPhotoDialogId(null)
          setAdditionalPhotos([])
          setAdditionalPreviewUrls([])
        }
      }}>
        <DialogContent className="glass-card border-[#222] bg-[#0c0c0c] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-emerald-400">Sonradan Resim Ekle</DialogTitle>
            <DialogDescription className="text-white/50">Cihaza ekstra kanıt/kozmetik fotoğrafı ekleyebilirsiniz.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
               <div className="relative border-2 border-dashed border-[#333] hover:border-[#555] bg-[#050505] rounded p-6 text-center cursor-pointer transition-colors">
                 <input 
                   type="file" 
                   multiple 
                   accept="image/*" 
                   className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                   onChange={(e) => {
                     if(e.target.files) {
                       const filesArr = Array.from(e.target.files)
                       setAdditionalPhotos(prev => [...prev, ...filesArr])
                       setAdditionalPreviewUrls(prev => [...prev, ...filesArr.map(f => URL.createObjectURL(f))])
                     }
                   }}
                 />
                 <UploadCloud className="mx-auto h-6 w-6 text-white/30 mb-2" />
                 <p className="text-white/50 text-sm">Resimleri seçmek için tıklayın</p>
               </div>
               {additionalPreviewUrls.length > 0 && (
                 <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                   {additionalPreviewUrls.map((url, index) => (
                     <div key={index} className="relative group rounded overflow-hidden border border-[#222] w-16 h-16 shrink-0 bg-black">
                       <img src={url} alt={`preview-${index}`} className="object-cover w-full h-full opacity-70" />
                       <button type="button" onClick={() => {
                         const nP = [...additionalPhotos]
                         nP.splice(index, 1)
                         setAdditionalPhotos(nP)
                         const nU = [...additionalPreviewUrls]
                         nU.splice(index, 1)
                         setAdditionalPreviewUrls(nU)
                       }} className="absolute inset-0 m-auto w-6 h-6 bg-red-500/80 rounded-full text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                         <X className="h-3 w-3" />
                       </button>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setPhotoDialogId(null); setAdditionalPhotos([]); setAdditionalPreviewUrls([]) }} className="text-white/70 hover:text-white hover:bg-white/5">İptal</Button>
            <Button onClick={handleUploadAdditionalPhotos} disabled={uploadingPhotos || additionalPhotos.length === 0} className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold">
              {uploadingPhotos ? 'Yükleniyor...' : 'Resimleri Kaydet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resim Galerisi (Lightbox) */}
      <Dialog open={galleryOpen} onOpenChange={(open) => {
        if(!open) setGalleryOpen(false)
      }}>
        <DialogContent className="max-w-4xl p-1 bg-black/95 border-[#222]">
          <DialogTitle className="sr-only">Cihaz Görseli</DialogTitle>
          <DialogDescription className="sr-only">Cihazın yüksek çözünürlüklü fotoğrafları arasında geçiş yapabilirsiniz.</DialogDescription>
          {galleryPhotos.length > 0 && (
            <div className="relative w-full h-[80vh] flex flex-col items-center justify-center overflow-hidden">
               {galleryPhotos.length > 1 && (
                 <>
                   <button 
                     onClick={(e) => { e.stopPropagation(); setGalleryIndex(prev => prev > 0 ? prev - 1 : galleryPhotos.length - 1); setScale(1) }} 
                     className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 p-2 rounded-full text-white hover:bg-black"
                   >
                     <ChevronLeft className="w-8 h-8" />
                   </button>
                   <button 
                     onClick={(e) => { e.stopPropagation(); setGalleryIndex(prev => prev < galleryPhotos.length - 1 ? prev + 1 : 0); setScale(1) }} 
                     className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 p-2 rounded-full text-white hover:bg-black"
                   >
                     <ChevronLeft className="w-8 h-8 rotate-180" />
                   </button>
                 </>
               )}
               
               <div className="absolute top-4 right-4 z-10 flex gap-2">
                 <button onClick={() => setScale(prev => Math.min(prev + 0.5, 3))} className="bg-black/80 p-2 rounded text-white hover:bg-black font-bold text-lg w-10 h-10 flex items-center justify-center border border-white/10">+</button>
                 <button onClick={() => setScale(prev => Math.max(prev - 0.5, 1))} className="bg-black/80 p-2 rounded text-white hover:bg-black font-bold text-lg w-10 h-10 flex items-center justify-center border border-white/10">-</button>
               </div>

               <p className="absolute top-4 left-4 z-10 bg-black/80 px-3 py-1 rounded text-white text-sm border border-white/10">
                 {galleryIndex + 1} / {galleryPhotos.length}
               </p>

               <div className="w-full h-full flex items-center justify-center overflow-auto scrollbar-hide cursor-zoom-in" onClick={() => setScale(prev => prev === 1 ? 2 : 1)}>
                 <img 
                   src={galleryPhotos[galleryIndex]} 
                   alt={`gallery-${galleryIndex}`} 
                   className="max-w-full max-h-full object-contain transition-transform duration-300"
                   style={{ transform: `scale(${scale})` }}
                 />
               </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
