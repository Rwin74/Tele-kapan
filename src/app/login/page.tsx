'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { checkDeviceApproval } from '@/app/actions/auth'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { toast } from 'sonner'
import { LockKeyhole, Mail } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { setUser, setShop } = useAppStore()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    // Use Supabase Browser Client
    const supabase = createClient()

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw new Error(error.message)
      }

      if (data.user) {
        // Fetch User profile to get shop_id
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*, shops(*)')
          .eq('id', data.user.id)
          .single()
          
        if (profileError || !profile) {
          throw new Error('Kullanıcı profili bulunamadı.')
        }

        setUser({
          id: profile.id,
          shop_id: profile.shop_id,
          role: profile.role as any,
          full_name: profile.full_name,
          email: profile.email,
          is_active: profile.is_active
        })

        if (profile.shops) {
          setShop({
            id: profile.shops.id,
            name: profile.shops.name,
            logo_url: profile.shops.logo_url,
            address: profile.shops.address,
            tax_info: profile.shops.tax_info
          })
        }

        // Run Device Check
        const deviceCheck = await checkDeviceApproval(profile.id, profile.shop_id)

        if (deviceCheck.status === 'pending') {
          toast.warning('Cihaz onayı bekleniyor. Lütfen yöneticiye başvurun.')
          router.push('/pending-approval')
          return
        }

        if (deviceCheck.status === 'error') {
          throw new Error(deviceCheck.message)
        }

        toast.success('Giriş başarılı, panele yönlendiriliyorsunuz.')
        router.push('/panel')
      }
    } catch (err: any) {
      toast.error(err.message || 'Giriş işlemi sırasında hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="glass-card w-full max-w-md border-primary/20">
        <CardHeader className="space-y-2 text-center pb-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-primary">
            <LockKeyhole className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Tele-Kapan'a Giriş</CardTitle>
          <CardDescription className="text-white/60">
            Dükkanınızı yönetmek için bilgilerinizi girin.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/80">E-posta</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="isim@sirket.com" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 bg-black/50 border-white/10 text-white placeholder:text-white/30"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-white/80">Şifre</Label>
              </div>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
                <Input 
                  id="password" 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 bg-black/50 border-white/10 text-white"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold transition-all shadow-lg shadow-primary/25" 
              disabled={loading}
            >
              {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
