-- 1. Storage için device-images bucket oluştur
INSERT INTO storage.buckets (id, name, public) 
VALUES ('device-images', 'device-images', true) 
ON CONFLICT (id) DO NOTHING;

-- 2. Herkesin okuyabilmesi için Public Access politikası
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'device-images' );

-- 3. Authenticated kullanıcıların dosya yükleyebilmesi için Insert politikası
CREATE POLICY "Auth Insert" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'device-images' AND auth.role() = 'authenticated' );

-- 4. Authenticated kullanıcıların kendi dosyalarını güncelleyebilmesi veya silebilmesi (isteğe bağlı)
CREATE POLICY "Auth Update" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'device-images' AND auth.role() = 'authenticated' );

CREATE POLICY "Auth Delete" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'device-images' AND auth.role() = 'authenticated' );
