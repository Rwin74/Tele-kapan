'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/useAppStore'
import { ShieldAlert, LogOut } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function PendingApprovalPage() {
  const { user, clearAuth } = useAppStore()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    clearAuth()
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="glass-card w-full max-w-md border-amber-500/20">
        <CardHeader className="space-y-2 text-center pb-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20 text-amber-500">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Cihaz Onayı Bekleniyor</CardTitle>
          <CardDescription className="text-white/60">
            {user?.full_name ? `Merhaba ${user.full_name},` : 'Merhaba,'} bu cihazdan sisteme giriş yapabilmeniz için yöneticinizin onayına ihtiyaç vardır.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <div className="p-4 bg-black/40 rounded-lg border border-white/5 text-sm text-white/70">
            Lütfen yöneticinize (Dükkan Sahibine) cihazınızı onaylatın. Onay verildikten sonra tekrar giriş yapabilirsiniz.
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleLogout}
            variant="outline"
            className="w-full bg-transparent border-white/20 hover:bg-white/10 text-white" 
          >
            <LogOut className="mr-2 h-4 w-4" /> Çıkış Yap
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
