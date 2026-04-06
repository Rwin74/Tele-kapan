-- TELE-KAPAN v1.2 REVİZYON SQL (Takas İşlem Motoru) --

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
    -- Get shop_id from the user executing
    SELECT shop_id INTO v_shop_id FROM public.users WHERE id = auth_uid LIMIT 1;
    IF v_shop_id IS NULL THEN
        RAISE EXCEPTION 'Yetkisiz işlem: Kullanıcının dükkanı bulunamadı.';
    END IF;

    -- 1. Insert the OLD device into inventory
    INSERT INTO public.inventory (
        shop_id, brand, model, imei_1, imei_2, 
        battery_health, cosmetic_condition, purchase_price, total_cost, 
        status, added_by, seller_name, seller_tc, seller_phone, device_origin
    ) VALUES (
        v_shop_id,
        old_device_data->>'brand',
        old_device_data->>'model',
        old_device_data->>'imei_1',
        old_device_data->>'imei_2',
        NULLIF(old_device_data->>'battery_health', '')::INT,
        old_device_data->>'cosmetic_condition',
        (old_device_data->>'purchase_price')::NUMERIC,
        (old_device_data->>'purchase_price')::NUMERIC,
        'in_stock',
        auth_uid,
        old_device_data->>'seller_name',
        old_device_data->>'seller_tc',
        old_device_data->>'seller_phone',
        old_device_data->>'device_origin'
    ) RETURNING id INTO new_inventory_id;

    -- 2. Insert the NEW device sale
    INSERT INTO public.sales (
        inventory_id, shop_id, sold_by, sale_price, payment_method, 
        customer_name, customer_tc, customer_phone
    ) VALUES (
        sold_device_id,
        v_shop_id,
        auth_uid,
        trade_in_sale_price,
        'Takas (Fark: ' || price_diff_paid || ' TL)',
        old_device_data->>'seller_name',
        old_device_data->>'seller_tc',
        old_device_data->>'seller_phone'
    ) RETURNING id INTO new_sale_id;

    -- Note: The trigger public.mark_inventory_sold() will automatically set sold_device status to 'sold' upon sales insert.

    RETURN jsonb_build_object(
        'success', true,
        'new_inventory_id', new_inventory_id,
        'new_sale_id', new_sale_id
    );
END;
$$;
