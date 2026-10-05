-- ========================================================================================
-- TABEL INVENTORY BATCHES (Sistem FEFO/FIFO)
-- ========================================================================================

CREATE TABLE IF NOT EXISTS public.inventory_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    sisa_stok INTEGER NOT NULL DEFAULT 0,
    tanggal_masuk DATE NOT NULL,
    tanggal_expired DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migrasi data stok yang sudah ada di inventory_items ke tabel batches (sebagai batch perdana)
INSERT INTO public.inventory_batches (item_id, sisa_stok, tanggal_masuk, tanggal_expired)
SELECT id, stock, COALESCE(tanggal_masuk, CURRENT_DATE), COALESCE(tanggal_expired, CURRENT_DATE + interval '1 year')
FROM public.inventory_items
WHERE stock > 0;

-- Buat View untuk memudahkan pengambilan data ringkasan stok dari Next.js (API)
CREATE OR REPLACE VIEW public.v_inventory_summary AS
SELECT
    i.id,
    i.name,
    i.category,
    i.unit,
    i.avg_monthly_usage,
    COALESCE(SUM(b.sisa_stok), 0) AS total_stock,
    (
        SELECT b.tanggal_expired
        FROM public.inventory_batches b
        WHERE b.item_id = i.id AND b.sisa_stok > 0
        ORDER BY b.tanggal_expired ASC
        LIMIT 1
    ) AS closest_expired_date,
    (
        SELECT b.tanggal_masuk
        FROM public.inventory_batches b
        WHERE b.item_id = i.id AND b.sisa_stok > 0
        ORDER BY b.tanggal_expired ASC
        LIMIT 1
    ) AS closest_tanggal_masuk
FROM public.inventory_items i
LEFT JOIN public.inventory_batches b ON i.id = b.item_id
GROUP BY i.id, i.name, i.category, i.unit, i.avg_monthly_usage;

-- Kita tidak lagi butuh kolom stock, tanggal_masuk, tanggal_expired di tabel master
-- karena sudah ditangani oleh batches. (Tapi untuk amannya kita tidak hapus kolomnya dulu, dibiarkan saja)
