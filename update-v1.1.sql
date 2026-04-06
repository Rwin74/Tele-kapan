-- TELE-KAPAN v1.1 REVİZYON SQL (Yasal Kalkan ve Görsel Hafıza) --

-- 1. YENİ SÜTUNLARIN EKLENMESİ

-- Inventory (Stok) tablosuna Satıcı Bilgileri ve Cihaz Fotoğrafları ekle
ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS seller_name TEXT,
ADD COLUMN IF NOT EXISTS seller_tc TEXT,
ADD COLUMN IF NOT EXISTS seller_phone TEXT,
ADD COLUMN IF NOT EXISTS photos TEXT[], -- Yüklenen Storage URL'lerini tutar
ADD COLUMN IF NOT EXISTS device_origin TEXT;

-- Status Enum Güncellemesi
ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_status_check;
ALTER TABLE public.inventory ADD CONSTRAINT inventory_status_check CHECK (status IN ('in_stock', 'sold', 'returned', 'scrapped'));

-- Expenses (Masraflar) tablosuna Tamir Parçaları ve Tamir Görselleri ekle
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS replaced_parts TEXT[], -- ["Ekran", "Batarya"] gibi değerler
ADD COLUMN IF NOT EXISTS repair_photos TEXT[];


-- 2. STORAGE BUCKET (device-images) OLUŞTURMA VE RLS POLİTİKALARI --

-- Eğer varsa önce bucket politikalarını düşürelim ki çakışmasın
-- Supabase, storage tablolarını storage şemasında tutar.
DROP POLICY IF EXISTS "Authenticated users can upload device images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view device images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update/delete their uploads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their uploads" ON storage.objects;
INSERT INTO storage.buckets (id, name, public) 
VALUES ('device-images', 'device-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Bucket için RLS politikaları (Public bucket ama insert yapabilmek için yetki gerekir)
-- Sadece TeleKapan (kayıtlı) kullanıcıları dosya yükleyebilir.
CREATE POLICY "Authenticated users can upload device images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'device-images'
);

-- Herkes public şekilde okuyabilir (Public bucket avantajı)
CREATE POLICY "Anyone can view device images"
ON storage.objects FOR SELECT TO public
USING (
    bucket_id = 'device-images'
);

-- Sahipler ve Resmi Personel kendi dükkanının objelerini silebilir mi? 
-- (Şimdilik authenticated'a silme/düzenleme yetkisi verelim)
CREATE POLICY "Authenticated users can update/delete their uploads"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'device-images');

CREATE POLICY "Authenticated users can delete their uploads"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'device-images');
