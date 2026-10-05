-- ========================================================================================
-- 1. Tabel Kunjungan Berobat
-- ========================================================================================
-- Drop view yang bergantung pada kolom diagnosa sebelum mengubah tipe datanya
DROP VIEW IF EXISTS public.v_rujuk_rs CASCADE;

-- Ubah kolom diagnosa dan jenis_obat menjadi TEXT agar bisa menyimpan JSON Array
ALTER TABLE public.kunjungan_berobat ALTER COLUMN diagnosa TYPE TEXT;
ALTER TABLE public.kunjungan_berobat ALTER COLUMN jenis_obat TYPE TEXT;

-- Buat ulang view yang telah dihapus
CREATE OR REPLACE VIEW public.v_rujuk_rs AS
SELECT nik, nama, departemen, jobsite, tanggal, diagnosa, nama_rs
FROM public.kunjungan_berobat
WHERE rujuk_rs = true
ORDER BY tanggal DESC;

COMMENT ON VIEW public.v_rujuk_rs IS 'Karyawan yang dirujuk ke rumah sakit';

-- ========================================================================================
-- 2. Tabel Inventory Items (Stok Obat & BHP)
-- ========================================================================================
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Obat', 'Bahan Medis', 'Lainnya')),
    stock INTEGER NOT NULL DEFAULT 0,
    unit TEXT NOT NULL,

    -- Tanggal barang masuk & Kedaluwarsa
    tanggal_masuk DATE,
    tanggal_expired DATE,

    -- Rata-rata pemakaian bulanan (untuk menentukan batas stok aman: 3x rata-rata)
    avg_monthly_usage INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ========================================================================================
-- 3. Tabel Inventory Transactions (Riwayat Masuk/Keluar Stok) - Opsional / Future proofing
-- ========================================================================================
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('IN', 'OUT')),
    quantity INTEGER NOT NULL,
    reference_id TEXT, -- ID kunjungan jika OUT, atau nomor faktur jika IN
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger untuk update updated_at di inventory_items
CREATE OR REPLACE FUNCTION update_inventory_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_inventory_items_modtime ON public.inventory_items;
CREATE TRIGGER update_inventory_items_modtime
    BEFORE UPDATE ON public.inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_updated_at_column();
