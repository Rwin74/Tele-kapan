'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useAppStore } from '@/store/useAppStore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Settings2, ShieldCheck, Trash2 } from 'lucide-react'

export default function AyarlarPage() {
  const supabase = createClient()
  const { shop, user, setShop } = useAppStore()
  const [devices, setDevices] = useState<any[]>([])
  const isOwner = user?.role === 'owner' || user?.role === 'super_admin'

  const [defaultStoreName, setDefaultStoreName] = useState(shop?.default_store_name || '')
  const [useAsDefaultOwner, setUseAsDefaultOwner] = useState(shop?.use_as_default_owner || false)
  const [loadingSettings, setLoadingSettings] = useState(false)

  useEffect(() => {
    if (shop) {
      setDefaultStoreName(shop.default_store_name || '')
      setUseAsDefaultOwner(shop.use_as_default_owner || false)
    }
  }, [shop])

  useEffect(() => {
    if (shop?.id && isOwner) {
      fetchDevices()
    }
  }, [shop?.id])

  const fetchDevices = async () => {
    const { data } = await supabase
      .from('devices')
      .select('*, users(full_name, role)')
      .eq('shop_id', shop?.id)
      .order('created_at', { ascending: false })
    
    if (data) setDevices(data)
  }

  const updateDeviceApproval = async (deviceId: string, isApproved: boolean) => {
    const { error } = await supabase
      .from('devices')
      .update({ is_approved: isApproved })
      .eq('id', deviceId)

    if (error) {
      toast.error('Cihaz durumu güncellenemedi.')
    } else {
      toast.success('Cihaz onayı güncellendi.')
      fetchDevices()
    }
  }

  const updateStoreSettings = async () => {
    if (!shop?.id) return
    setLoadingSettings(true)
    const { error } = await supabase
      .from('shops')
      .update({
        default_store_name: defaultStoreName,
        use_as_default_owner: useAsDefaultOwner
      })
      .eq('id', shop.id)
      
    setLoadingSettings(false)
    if (error) {
      toast.error('Ayarlar güncellenemedi: ' + error.message)
    } else {
      toast.success('Ayarlar başarıyla kaydedildi.')
      setShop({
        ...shop,
        default_store_name: defaultStoreName,
        use_as_default_owner: useAsDefaultOwner
      })
    }
  }

  return (
    <div className="space-y-8 fade-in max-w-4xl">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Ayarlar</h2>
        <p className="text-white/60 mt-2">Dükkan bilgileri ve güvenlik (Cihaz Onay) ayarları.</p>
      </div>

      <Card className="glass-card border-white/5">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            Mağaza Bilgileri
          </CardTitle>
          <CardDescription className="text-white/50">Şirketinizin genel unvan ve adres detayları.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-white/50 block">Dükkan Adı</span>
              <span className="text-white font-medium">{shop?.name}</span>
            </div>
            <div className="space-y-1">
              <span className="text-white/50 block">Vergi No / Daire</span>
              <span className="text-white font-medium">{shop?.tax_info || 'Girilmemiş'}</span>
            </div>
            <div className="space-y-1 col-span-2">
              <span className="text-white/50 block">Adres</span>
              <span className="text-white font-medium">{shop?.address || 'Girilmemiş'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {isOwner && (
        <Card className="glass-card border-white/5 border-emerald-500/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-emerald-500" />
              Varsayılan Mağaza Cihazı Ayarları
            </CardTitle>
            <CardDescription className="text-white/50">Cihaz eklerken varsayılan olarak kendi dükkanınızı satıcı olarak ayarlayın.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-white/80 text-sm">Varsayılan Dükkan Adı (Sözleşmeler için)</label>
              <input 
                value={defaultStoreName} 
                onChange={e => setDefaultStoreName(e.target.value)} 
                className="flex h-10 w-full rounded-md border border-[#222] bg-[#0f0f0f] px-3 py-2 text-sm text-white placeholder:text-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" 
                placeholder="Örn: Benim Mağazam İletişim"
              />
            </div>
            <div className="flex items-center gap-3 py-2">
              <input 
                type="checkbox" 
                id="useAsDefault" 
                checked={useAsDefaultOwner} 
                onChange={e => setUseAsDefaultOwner(e.target.checked)} 
                className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500"
              />
              <label htmlFor="useAsDefault" className="text-white/80 text-sm cursor-pointer select-none">
                Yeni cihaz eklerken "Mağaza Cihazı" olarak işaretle
              </label>
            </div>
            <Button onClick={updateStoreSettings} disabled={loadingSettings} className="bg-emerald-500 hover:bg-emerald-400 text-black">
              {loadingSettings ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
            </Button>
          </CardContent>
        </Card>
      )}

      {isOwner && (
        <Card className="glass-card border-white/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
              Cihaz Yönetimi & Onayları
            </CardTitle>
            <CardDescription className="text-white/50">
              Uygulamaya giriş yapmaya çalışan donanımları/tarayıcıları buradan onaylayın veya engelleyin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {devices.length === 0 ? (
                <div className="text-white/50 text-sm">Hiçbir cihaz kaydı bulunamadı.</div>
              ) : devices.map(device => (
                <div key={device.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg bg-black/40 border border-white/5 gap-4">
                  <div>
                    <p className="text-white font-medium">{device.users?.full_name} <span className="text-xs text-white/50 uppercase ml-2 px-2 py-0.5 rounded bg-white/10">{device.users?.role}</span></p>
                    <p className="text-xs text-white/50 mt-1">Cihaz ID: {device.device_identifier.split('-')[0]}***</p>
                    <p className="text-xs text-white/50">Son Giriş: {device.last_login ? new Date(device.last_login).toLocaleString('tr-TR') : 'Hiç giriş yapmadı'}</p>
                  </div>
                  <div className="flex gap-2">
                    {device.is_approved ? (
                      <Button variant="outline" size="sm" onClick={() => updateDeviceApproval(device.id, false)} className="bg-transparent border-red-500/30 text-red-400 hover:bg-red-500/10">
                        Erişimi Kes
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => updateDeviceApproval(device.id, true)} className="bg-primary hover:bg-primary/90 text-white">
                        Onayla
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
