'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
// Eğer next/navigation yoksa next/router değil next/navigation kullanılmalı App Router'da
import { useRouter } from 'next/navigation'

export default function ActivatePage() {
  const [step, setStep] = useState(1)
  const [licenseKey, setLicenseKey] = useState('')
  const [shopName, setShopName] = useState('')
  const [shopSlug, setShopSlug] = useState('')
  const [error, setError] = useState('')
  const [licenseId, setLicenseId] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const router = useRouter()
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShopName(e.target.value)
    setShopSlug(generateSlug(e.target.value))
  }

  const verifyLicense = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const { data: license, error: fetchErr } = await supabase
      .from('licenses')
      .select('id, status')
      .eq('key_string', licenseKey)
      .single()

    setIsLoading(false)

    if (fetchErr || !license) {
      setError('Geçersiz lisans anahtarı.')
      return
    }

    if (license.status !== 'active') {
      setError('Bu lisans anahtarı zaten kullanılmış veya süresi dolmuş.')
      return
    }

    setLicenseId(license.id)
    setStep(2)
  }

  const createTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    // 1. Slug benzersiz mi kontrol et
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('shop_slug', shopSlug)
      .single()

    if (existingTenant) {
      setError('Bu dükkan alan adı (slug) zaten alınmış. Lütfen başka bir ad deneyin.')
      setIsLoading(false)
      return
    }

    // 2. Tenant oluştur
    const { data: newTenant, error: insertErr } = await supabase
      .from('tenants')
      .insert([
        { shop_name: shopName, shop_slug: shopSlug, license_id: licenseId }
      ])
      .select()
      .single()

    if (insertErr || !newTenant) {
      setError('Dükkan oluşturulurken bir hata oluştu.')
      setIsLoading(false)
      return
    }

    // 3. Lisansı güncelle
    const { error: updateErr } = await supabase
      .from('licenses')
      .update({ status: 'used', tenant_id: newTenant.id, activated_at: new Date().toISOString() })
      .eq('id', licenseId)

    setIsLoading(false)

    if (updateErr) {
      setError('Lisans durumu güncellenirken bir hata oluştu.')
      return
    }

    // İşlem başarılı, yönlendir
    // İleride Subdomain yapısı live oldugunda: window.location.href = `http://${shopSlug}.sitemiz.com/panel` yapılabilir
    setStep(3)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sisteme Hoş Geldiniz
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Hesabınızı aktifleştirmek için adımları takip edin.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {step === 1 && (
            <form className="space-y-6" onSubmit={verifyLicense}>
              <div>
                <label htmlFor="license" className="block text-sm font-medium text-gray-700">
                  Lisans Anahtarınız
                </label>
                <div className="mt-1">
                  <input
                    id="license"
                    name="license"
                    type="text"
                    required
                    placeholder="TLKPN-XXXX-YYYY"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {isLoading ? 'Kontrol ediliyor...' : 'Lisansı Doğrula'}
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form className="space-y-6" onSubmit={createTenant}>
              <div>
                <label htmlFor="shopName" className="block text-sm font-medium text-gray-700">
                  Dükkan / Mağaza Adı
                </label>
                <div className="mt-1">
                  <input
                    id="shopName"
                    name="shopName"
                    type="text"
                    required
                    placeholder="Örn: Ahmet İletişim"
                    value={shopName}
                    onChange={handleNameChange}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Mağaza URL Adresiniz
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    type="text"
                    readOnly
                    value={shopSlug}
                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-l-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300 bg-gray-50"
                  />
                  <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                    .sitemiz.com
                  </span>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading || !shopSlug}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {isLoading ? 'Kaydediliyor...' : 'Kurulumu Tamamla'}
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="mt-2 text-lg leading-6 font-medium text-gray-900">Kurulum Başarılı!</h3>
              <div className="mt-2 text-sm text-gray-500">
                <p>Mağazanız başarıyla oluşturuldu.</p>
                <p className="mt-2 font-medium">Bize özel adresiniz:</p>
                <p className="text-indigo-600 font-bold">{shopSlug}.sitemiz.com</p>
              </div>
              <div className="mt-6">
                <a
                 // Temporarily link to panel on the same host for debug if subdomain routing isn't set up yet locally
                  href={`/panel`} 
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                >
                  Panele Git
                </a>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
