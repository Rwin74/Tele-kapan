import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'

export default async function TenantPage({ params }: { params: { tenant: string } }) {
  const tenantSlug = params.tenant
  const cookieStore = cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  // Tenant var mı veritabanında kontrol edelim
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('*, licenses(status, activated_at, duration_months)')
    .eq('shop_slug', tenantSlug)
    .single()

  if (error || !tenant) {
    // Tenant yoksa 404 sayfasına yönlendir
    notFound()
  }

  // İsteğe bağlı olarak lisans kontrolü yapılabilir (Süresi dolmuş mu?)
  const license = tenant.licenses;
  const isExpired = license && license.status === 'expired';

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto py-16 px-4 sm:py-24 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-base font-semibold text-indigo-600 tracking-wide uppercase">
            Mağaza Paneli
          </h2>
          <p className="mt-1 text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
            {tenant.shop_name}
          </p>
          <p className="max-w-xl mt-5 mx-auto text-xl text-gray-500">
            {tenantSlug}.sitemiz.com adresinden erişiliyor.
          </p>
          
          {isExpired && (
             <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
               Dikkat: Dükkanınızın lisans süresi dolmuştur. Lütfen sistem yöneticisiyle iletişime geçin.
             </div>
          )}

          <div className="mt-10">
             {/* 
                Buraya tenant'a özel Panel / Yönetim ekranı bileşenlerinizi ekleyebilirsiniz.
                Şu anki projenizdeki mevcut `/panel` tasarımı veya farklı komponentler gelebilir.
             */}
             <a href={`/${tenantSlug}/login`} className="text-base font-medium text-indigo-600 hover:text-indigo-500">
                Giriş Yap &rarr;
             </a>
          </div>
        </div>
      </div>
    </div>
  )
}
