-- 1. Lisanslar Tablosu (licenses)
CREATE TYPE license_status AS ENUM ('active', 'used', 'expired');

CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_string VARCHAR(20) NOT NULL UNIQUE, -- Örn: TLKPN-XXXX-YYYY
  duration_months INT NOT NULL DEFAULT 12,
  status license_status NOT NULL DEFAULT 'active',
  activated_at TIMESTAMP WITH TIME ZONE,
  tenant_id UUID, -- Kullanıldıktan sonra tenants tablosuyla ilişkilendirilecek
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Dükkanlar/Müşteriler Tablosu (tenants)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_slug VARCHAR(64) NOT NULL UNIQUE, -- Örn: 'ahmetiletisim'
  shop_name VARCHAR(100) NOT NULL, -- Örn: 'Ahmet İletişim'
  license_id UUID NOT NULL REFERENCES licenses(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Foreign Key ilişkisi için tenent_id güncellemesi
ALTER TABLE licenses 
ADD CONSTRAINT fk_tenant 
FOREIGN KEY (tenant_id) 
REFERENCES tenants(id) 
ON DELETE SET NULL;
