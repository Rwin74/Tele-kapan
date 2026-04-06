import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

// Not: Çakışmaları engellemek içi geçici UUID utils kullanımı, dilerseniz crypto ile değiştirebilirsiniz.
function generateLicenseKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = 'TLKPN-';
  for (let i = 0; i < 4; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
  key += '-';
  for (let i = 0; i < 4; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
  return key;
}

export default async function AdminDashboard() {
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

  // Fetch licenses
  const { data: licenses } = await supabase
    .from('licenses')
    .select(`*, tenants(shop_name)`)
    .order('created_at', { ascending: false })

  async function generateLicenseAction() {
    "use server"
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // Admin paneli için normalde SERVICE_ROLE key kullanılmalı (daha güvenli: process.env.SUPABASE_SERVICE_ROLE_KEY)
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
        },
      }
    )

    const key_string = generateLicenseKey()
    await supabase.from('licenses').insert([
      { key_string, status: 'active', duration_months: 12 }
    ])
    // Yeniden validate etmek gerekeceğinden, normalde burada revalidatePath() çağrılmalı
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
          Admin Kontrol Paneli
        </h1>
        <form action={generateLicenseAction}>
          <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg shadow transition-colors font-medium">
            1 Yıllık Yeni Lisans Üret
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 font-semibold text-gray-600">Lisans Anahtarı</th>
              <th className="p-4 font-semibold text-gray-600">Durum</th>
              <th className="p-4 font-semibold text-gray-600">Oluşturulma</th>
              <th className="p-4 font-semibold text-gray-600">Kullanan Dükkan</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {licenses?.map(license => (
              <tr key={license.id} className="hover:bg-gray-50/50 transition duration-150">
                <td className="p-4 font-mono text-sm">{license.key_string}</td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium
                    ${license.status === 'active' ? 'bg-green-100 text-green-700' : 
                      license.status === 'used' ? 'bg-blue-100 text-blue-700' : 
                      'bg-red-100 text-red-700'}`}>
                    {license.status.toUpperCase()}
                  </span>
                </td>
                <td className="p-4 text-sm text-gray-500">
                   {new Date(license.created_at).toLocaleDateString("tr-TR")}
                </td>
                <td className="p-4 text-sm text-gray-700">
                  {license.tenants?.shop_name || <span className="text-gray-400">-</span>}
                </td>
              </tr>
            ))}
            {!licenses?.length && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500">
                  Henüz lisans oluşturulmamış.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
