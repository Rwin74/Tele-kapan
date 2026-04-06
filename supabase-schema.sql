-- TELE-KAPAN: Supabase Veritabanı Şeması ve RLS Kuralları --

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLES

-- Shops Table
CREATE TABLE public.shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    address TEXT,
    tax_info TEXT, -- VKN / Vergi Dairesi
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users / Profiles Table (References auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'owner', 'staff')),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Devices Table (For strictly checking HTTP-Only cookie UUIDs)
CREATE TABLE public.devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    device_identifier UUID NOT NULL UNIQUE, -- Stored in HTTP-Only Cookie
    is_approved BOOLEAN DEFAULT false,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Table (Stoklar)
CREATE TABLE public.inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    imei_1 TEXT,
    imei_2 TEXT,
    battery_health INT,
    cosmetic_condition TEXT,
    purchase_price NUMERIC(10,2) DEFAULT 0,
    total_cost NUMERIC(10,2) DEFAULT 0,
    status TEXT DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'sold', 'returned', 'scrapped')),
    device_origin TEXT,
    added_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses Table (Masraflar)
CREATE TABLE public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    cost_amount NUMERIC(10,2) NOT NULL,
    added_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    date TIMESTAMPTZ DEFAULT NOW()
);

-- Sales Table (Satışlar)
CREATE TABLE public.sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    sold_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    sale_price NUMERIC(10,2) NOT NULL,
    payment_method TEXT,
    customer_name TEXT,
    customer_tc TEXT,
    customer_phone TEXT,
    sale_date TIMESTAMPTZ DEFAULT NOW()
);

-- Returns Table (İadeler)
CREATE TABLE public.returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    return_reason TEXT,
    date TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TRIGGERS

-- A. Masraf Eklendiğinde -> Stok'un (inventory) total_cost değerini artır.
CREATE OR REPLACE FUNCTION public.update_inventory_cost_on_expense()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.inventory
    SET total_cost = total_cost + NEW.cost_amount
    WHERE id = NEW.inventory_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_add_expense
AFTER INSERT ON public.expenses
FOR EACH ROW EXECUTE PROCEDURE public.update_inventory_cost_on_expense();

-- B. Cihaz Satıldığında -> Stok'un (inventory) status değerini 'sold' yap
CREATE OR REPLACE FUNCTION public.mark_inventory_sold()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.inventory
    SET status = 'sold'
    WHERE id = NEW.inventory_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_sale_inventory
AFTER INSERT ON public.sales
FOR EACH ROW EXECUTE PROCEDURE public.mark_inventory_sold();

-- C. İade Geldiğinde -> Stok'un (inventory) status değerini tekrar 'in_stock' yap
CREATE OR REPLACE FUNCTION public.process_return()
RETURNS TRIGGER AS $$
DECLARE
    inv_id UUID;
BEGIN
    -- Gets the inventory_id from the linked sale
    SELECT inventory_id INTO inv_id FROM public.sales WHERE id = NEW.sale_id;
    
    UPDATE public.inventory
    SET status = 'in_stock'
    WHERE id = inv_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_return_inventory
AFTER INSERT ON public.returns
FOR EACH ROW EXECUTE PROCEDURE public.process_return();

-- D. Auth User Insert Trigger (Yeni kullanıcı kayıt olduğunda profiles/users tablosuna da kaydet)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  -- We assume shop_id and role are sent in raw_user_meta_data during signup/user creation
  INSERT INTO public.users (id, shop_id, role, full_name, email, is_active)
  VALUES (
    new.id, 
    (new.raw_user_meta_data->>'shop_id')::UUID, 
    COALESCE(new.raw_user_meta_data->>'role', 'staff'),
    COALESCE(new.raw_user_meta_data->>'full_name', 'Bilinmeyen Kullanıcı'),
    new.email,
    true
  );
  RETURN new;
END;
$$ language plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- E. Trade-In Transaction RPC (Takas Motoru)
CREATE OR REPLACE FUNCTION public.process_trade_in(
    old_device_data JSONB,
    sold_device_id UUID,
    trade_in_sale_price NUMERIC,
    price_diff_paid NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_inventory_id UUID;
    new_sale_id UUID;
    auth_uid UUID := auth.uid();
    v_shop_id UUID;
BEGIN
    SELECT shop_id INTO v_shop_id FROM public.users WHERE id = auth_uid LIMIT 1;
    IF v_shop_id IS NULL THEN
        RAISE EXCEPTION 'Yetkisiz işlem: Kullanıcının dükkanı bulunamadı.';
    END IF;

    INSERT INTO public.inventory (
        shop_id, brand, model, imei_1, imei_2, 
        battery_health, cosmetic_condition, purchase_price, total_cost, 
        status, added_by, seller_name, seller_tc, seller_phone, device_origin
    ) VALUES (
        v_shop_id, old_device_data->>'brand', old_device_data->>'model', old_device_data->>'imei_1', old_device_data->>'imei_2', 
        NULLIF(old_device_data->>'battery_health', '')::INT, old_device_data->>'cosmetic_condition', (old_device_data->>'purchase_price')::NUMERIC, (old_device_data->>'purchase_price')::NUMERIC, 
        'in_stock', auth_uid, old_device_data->>'seller_name', old_device_data->>'seller_tc', old_device_data->>'seller_phone', old_device_data->>'device_origin'
    ) RETURNING id INTO new_inventory_id;

    INSERT INTO public.sales (
        inventory_id, shop_id, sold_by, sale_price, payment_method, 
        customer_name, customer_tc, customer_phone
    ) VALUES (
        sold_device_id, v_shop_id, auth_uid, trade_in_sale_price, 'Takas (Fark: ' || price_diff_paid || ' TL)', 
        old_device_data->>'seller_name', old_device_data->>'seller_tc', old_device_data->>'seller_phone'
    ) RETURNING id INTO new_sale_id;

    RETURN jsonb_build_object('success', true, 'new_inventory_id', new_inventory_id, 'new_sale_id', new_sale_id);
END;
$$;

-- 4. ROW LEVEL SECURITY (RLS)
-- To enable multi-tenant architecture safely.

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

-- Function to get current user's shop_id from the users table.
CREATE OR REPLACE FUNCTION public.get_auth_user_shop_id()
RETURNS UUID AS $$
    SELECT shop_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS TEXT AS $$
    SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- SHOPS: Owner and Staff can SELECT their own shop.
CREATE POLICY "Users can view their own shop" ON public.shops
FOR SELECT USING (id = public.get_auth_user_shop_id());

CREATE POLICY "Owners can update their own shop" ON public.shops
FOR UPDATE USING (id = public.get_auth_user_shop_id() AND public.get_auth_user_role() = 'owner');

-- USERS: Users can view other users in the same shop.
CREATE POLICY "Users can view users in same shop" ON public.users
FOR SELECT USING (shop_id = public.get_auth_user_shop_id());

CREATE POLICY "Owners can insert users in same shop" ON public.users
FOR INSERT WITH CHECK (shop_id = public.get_auth_user_shop_id() AND public.get_auth_user_role() = 'owner');

CREATE POLICY "Owners can update users in same shop" ON public.users
FOR UPDATE USING (shop_id = public.get_auth_user_shop_id() AND public.get_auth_user_role() = 'owner');

-- DEVICES
CREATE POLICY "Users can view devices in same shop" ON public.devices
FOR SELECT USING (shop_id = public.get_auth_user_shop_id());

CREATE POLICY "Owners can approve/update devices in same shop" ON public.devices
FOR UPDATE USING (shop_id = public.get_auth_user_shop_id() AND public.get_auth_user_role() = 'owner');

CREATE POLICY "Users can insert devices for themselves" ON public.devices
FOR INSERT WITH CHECK (user_id = auth.uid());

-- INVENTORY
CREATE POLICY "All shop users can view inventory" ON public.inventory
FOR SELECT USING (shop_id = public.get_auth_user_shop_id());

CREATE POLICY "All shop users can insert inventory" ON public.inventory
FOR INSERT WITH CHECK (shop_id = public.get_auth_user_shop_id());

CREATE POLICY "All shop users can update inventory" ON public.inventory
FOR UPDATE USING (shop_id = public.get_auth_user_shop_id());

CREATE POLICY "Only owners can delete inventory" ON public.inventory
FOR DELETE USING (shop_id = public.get_auth_user_shop_id() AND public.get_auth_user_role() = 'owner');

-- EXPENSES
CREATE POLICY "All shop users can view expenses" ON public.expenses
FOR SELECT USING (shop_id = public.get_auth_user_shop_id());

CREATE POLICY "All shop users can insert expenses" ON public.expenses
FOR INSERT WITH CHECK (shop_id = public.get_auth_user_shop_id());

CREATE POLICY "Only owners can delete expenses" ON public.expenses
FOR DELETE USING (shop_id = public.get_auth_user_shop_id() AND public.get_auth_user_role() = 'owner');

-- SALES
CREATE POLICY "All shop users can view sales" ON public.sales
FOR SELECT USING (shop_id = public.get_auth_user_shop_id());

CREATE POLICY "All shop users can insert sales" ON public.sales
FOR INSERT WITH CHECK (shop_id = public.get_auth_user_shop_id());

CREATE POLICY "Only owners can delete sales" ON public.sales
FOR DELETE USING (shop_id = public.get_auth_user_shop_id() AND public.get_auth_user_role() = 'owner');

-- RETURNS
CREATE POLICY "All shop users can view returns" ON public.returns
FOR SELECT USING (shop_id = public.get_auth_user_shop_id());

CREATE POLICY "All shop users can insert returns" ON public.returns
FOR INSERT WITH CHECK (shop_id = public.get_auth_user_shop_id());

CREATE POLICY "Only owners can delete returns" ON public.returns
FOR DELETE USING (shop_id = public.get_auth_user_shop_id() AND public.get_auth_user_role() = 'owner');
