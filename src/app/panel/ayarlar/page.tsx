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
  const { shop, user } = useAppStore()
  const [devices, setDevices] = useState<any[]>([])
  const isOwner = user?.role === 'owner' || user?.role === 'super_admin'

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
          <div className="grid grid-cols-2 gap-4 text-sm">
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
                <div key={device.id} className="flex items-center justify-between p-4 rounded-lg bg-black/40 border border-white/5">
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
