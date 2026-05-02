import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  // 1. Supabase Session İşlemleri
  const supabaseResponse = await updateSession(request);
  const url = request.nextUrl.clone();
  
  // 2. Gelen isteğin host adını al
  const hostname = request.headers.get('host') || '';
  
  // 3. Ortama göre ana domain belirleme (PRODUCTION vs LOCAL)
  // Gerçek alan adınız (bunu ortam değişkenlerine ekleyebilirsiniz NEXT_PUBLIC_ROOT_DOMAIN olarak)
  const isLocalhost = hostname.includes('localhost');
  const mainDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || (isLocalhost ? 'localhost:3000' : 'sitemiz.com'); 
  
  // 4. Subdomain'i çözümle
  let currentHost = hostname;

  // Eğer Vercel'in kendi ana URL'si üzerinden doğrudan giriş yapılıyorsa (tele-kapan.vercel.app gibi)
  // Ve özel bir custom domain kullanılmıyorsa bunu ana site olarak kabul et.
  if (hostname.endsWith('.vercel.app') && !hostname.includes('.' + mainDomain)) {
      // Vercel domainleri genellikle ana app olur (subdomain custom domain ile yapılır)
      // Ancak ilerde Vercel wildcard eklerseniz burayı iptal edebilirsiniz.
      currentHost = 'app';
  } else {
    // Custom domain veya localhost üzerinden geliyorsa tenant'ı çözümle
    currentHost = hostname.replace(`.${mainDomain}`, '');
    // Eğer port varsa veya sadece mainDomain girilmişse (örn: sitemiz.com, localhost:3000)
    if (currentHost === mainDomain || currentHost === "") {
       currentHost = "app"; 
    }
  }

  // 5. Belirli rotalar için rewrite etme (Ana site veya özel paneller)
  // Eğer kullanıcı ana sitemize geldiyse normal akış devam etsin
  if (currentHost === 'app' || hostname === mainDomain) {
    return supabaseResponse; 
  }

  // 6. Subdomain varsa (Örn: ahmetiletisim.sitemiz.com)
  // /api veya state assetleri için rewrite YAPMA
  const isApiOrNext = url.pathname.startsWith('/api') || url.pathname.startsWith('/_next');
  
  if (!isApiOrNext) {
       // Orijinal pathname önüne subdomain'i ekliyoruz: /[tenant]/...
       url.pathname = `/${currentHost}${url.pathname}`;
       
       const response = NextResponse.rewrite(url, {
           request: { headers: request.headers }
       });

       // Sadece rewrite döneceğimiz için, supabaseSession'dan gelen cookieleri kopyalamalıyız.
       supabaseResponse.cookies.getAll().forEach((cookie) => {
           response.cookies.set(cookie.name, cookie.value, cookie)
       });

       return response;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
