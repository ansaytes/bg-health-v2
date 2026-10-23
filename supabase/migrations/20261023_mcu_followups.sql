-- ==============================================================================
-- Migrasi: mcu_followups & 7 Kualifikasi Klinis STD-006 Rev.002
-- Tanggal: 2026-10-23
-- Deskripsi:
-- 1. Snapshot backup kolom Follow-Up lama dari mcu_records
-- 2. Pembuatan tabel relasional mcu_followups
-- 3. Backfill data FU lama (FU 1, 2, 3) ke tabel mcu_followups
-- 4. Penambahan 7 kolom kualifikasi klinis baru STD-006 Rev.002 ke mcu_records
-- 5. Drop kolom FU lama dari mcu_records (eksekusi setelah verifikasi backfill)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SNAPSHOT BACKUP DATA FU LAMA
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mcu_records_snapshot_fu_20261023 AS
SELECT 
    id AS mcu_record_id,
    nik_karyawan,
    tgl_mcu,
    tgl_fu1, lokasi_fu1, hasil_fu1, kesimpulan_fu1, link_fu1, rek_fu2,
    tgl_fu2, lokasi_fu2, hasil_fu2, kesimpulan_fu2, link_fu2, rek_fu3,
    tgl_fu3, lokasi_fu3, hasil_fu3, kesimpulan_fu3, link_fu3, rek_fu4,
    pemeriksaan_lain,
    NOW() AS snapshot_created_at
FROM mcu_records
WHERE 
    tgl_fu1 IS NOT NULL OR hasil_fu1 IS NOT NULL OR lokasi_fu1 IS NOT NULL OR
    tgl_fu2 IS NOT NULL OR hasil_fu2 IS NOT NULL OR lokasi_fu2 IS NOT NULL OR
    tgl_fu3 IS NOT NULL OR hasil_fu3 IS NOT NULL OR lokasi_fu3 IS NOT NULL OR
    pemeriksaan_lain IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. PEMBUATAN TABEL BARU mcu_followups
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mcu_followups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mcu_record_id UUID NOT NULL REFERENCES mcu_records(id) ON DELETE CASCADE,
    nik_karyawan TEXT NOT NULL,
    kunjungan_ke INTEGER NOT NULL CHECK (kunjungan_ke > 0),
    tgl_fu DATE,
    lokasi_fu TEXT,
    dokter_pemeriksa TEXT,
    -- Menyimpan nilai terukur ulang: { "sistol": 130, "diastol": 85, "gulaDarahPuasa": 110 }
    -- Key sesuai dengan field.id pada MCU_FIELDS
    hasil_parameters JSONB DEFAULT '{}'::jsonb,
    catatan TEXT,
    kesimpulan TEXT, -- 'Normal' | 'Terkontrol' | 'Belum Terkontrol' | 'Perlu Rujukan' dll
    link_dokumen TEXT,
    rekomendasi_berikutnya TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_mcu_followup_record_visit UNIQUE (mcu_record_id, kunjungan_ke)
);

CREATE INDEX IF NOT EXISTS idx_mcu_followups_record_id ON mcu_followups(mcu_record_id);
CREATE INDEX IF NOT EXISTS idx_mcu_followups_nik ON mcu_followups(nik_karyawan);
CREATE INDEX IF NOT EXISTS idx_mcu_followups_tgl ON mcu_followups(tgl_fu);

-- Enable RLS
ALTER TABLE mcu_followups ENABLE ROW LEVEL SECURITY;

-- Policy (bisa diakses user terautentikasi / service role)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'mcu_followups' AND policyname = 'Allow authenticated users full access'
    ) THEN
        CREATE POLICY "Allow authenticated users full access" ON mcu_followups
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'mcu_followups' AND policyname = 'Allow service role full access'
    ) THEN
        CREATE POLICY "Allow service role full access" ON mcu_followups
            FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. BACKFILL DATA FU LAMA KE mcu_followups
-- ------------------------------------------------------------------------------
-- FU Kunjungan 1
INSERT INTO mcu_followups (mcu_record_id, nik_karyawan, kunjungan_ke, tgl_fu, lokasi_fu, catatan, kesimpulan, link_dokumen, rekomendasi_berikutnya)
SELECT 
    id,
    COALESCE(nik_karyawan, 'UNKNOWN'),
    1,
    CASE 
        WHEN tgl_fu1::TEXT ~ '^\d{4}-\d{2}-\d{2}$' THEN tgl_fu1::DATE 
        ELSE NULL 
    END,
    lokasi_fu1,
    hasil_fu1,
    kesimpulan_fu1,
    link_fu1,
    rek_fu2
FROM mcu_records
WHERE (tgl_fu1 IS NOT NULL OR hasil_fu1 IS NOT NULL OR lokasi_fu1 IS NOT NULL OR kesimpulan_fu1 IS NOT NULL)
ON CONFLICT (mcu_record_id, kunjungan_ke) DO NOTHING;

-- FU Kunjungan 2
INSERT INTO mcu_followups (mcu_record_id, nik_karyawan, kunjungan_ke, tgl_fu, lokasi_fu, catatan, kesimpulan, link_dokumen, rekomendasi_berikutnya)
SELECT 
    id,
    COALESCE(nik_karyawan, 'UNKNOWN'),
    2,
    CASE 
        WHEN tgl_fu2::TEXT ~ '^\d{4}-\d{2}-\d{2}$' THEN tgl_fu2::DATE 
        ELSE NULL 
    END,
    lokasi_fu2,
    hasil_fu2,
    kesimpulan_fu2,
    link_fu2,
    rek_fu3
FROM mcu_records
WHERE (tgl_fu2 IS NOT NULL OR hasil_fu2 IS NOT NULL OR lokasi_fu2 IS NOT NULL OR kesimpulan_fu2 IS NOT NULL)
ON CONFLICT (mcu_record_id, kunjungan_ke) DO NOTHING;

-- FU Kunjungan 3
INSERT INTO mcu_followups (mcu_record_id, nik_karyawan, kunjungan_ke, tgl_fu, lokasi_fu, catatan, kesimpulan, link_dokumen, rekomendasi_berikutnya)
SELECT 
    id,
    COALESCE(nik_karyawan, 'UNKNOWN'),
    3,
    CASE 
        WHEN tgl_fu3::TEXT ~ '^\d{4}-\d{2}-\d{2}$' THEN tgl_fu3::DATE 
        ELSE NULL 
    END,
    lokasi_fu3,
    hasil_fu3,
    kesimpulan_fu3,
    link_fu3,
    rek_fu4
FROM mcu_records
WHERE (tgl_fu3 IS NOT NULL OR hasil_fu3 IS NOT NULL OR lokasi_fu3 IS NOT NULL OR kesimpulan_fu3 IS NOT NULL)
ON CONFLICT (mcu_record_id, kunjungan_ke) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 4. TAMBAHKAN 7 KOLOM KUALIFIKASI KLINIS STD-006 Rev.002 KE mcu_records
-- ------------------------------------------------------------------------------
ALTER TABLE mcu_records
    ADD COLUMN IF NOT EXISTS dm_komplikasi TEXT,
    ADD COLUMN IF NOT EXISTS mental_konfirmasi TEXT,
    ADD COLUMN IF NOT EXISTS artritis_urat TEXT,
    ADD COLUMN IF NOT EXISTS diagnosis_hati TEXT,
    ADD COLUMN IF NOT EXISTS obesitas_fungsional TEXT,
    ADD COLUMN IF NOT EXISTS status_terapi_ess TEXT,
    ADD COLUMN IF NOT EXISTS epilepsi_kepatuhan TEXT;

-- ------------------------------------------------------------------------------
-- 5. DROP KOLOM FU LAMA (Jalankan setelah snapshot & kode terverifikasi aman)
-- ------------------------------------------------------------------------------
-- PERHATIAN: Pastikan aplikasi sudah menggunakan tabel mcu_followups sebelum
-- menjalankan blok DROP di bawah ini.
/*
ALTER TABLE mcu_records
    DROP COLUMN IF EXISTS tgl_fu1,
    DROP COLUMN IF EXISTS lokasi_fu1,
    DROP COLUMN IF EXISTS hasil_fu1,
    DROP COLUMN IF EXISTS kesimpulan_fu1,
    DROP COLUMN IF EXISTS link_fu1,
    DROP COLUMN IF EXISTS rek_fu2,
    DROP COLUMN IF EXISTS tgl_fu2,
    DROP COLUMN IF EXISTS lokasi_fu2,
    DROP COLUMN IF EXISTS hasil_fu2,
    DROP COLUMN IF EXISTS kesimpulan_fu2,
    DROP COLUMN IF EXISTS link_fu2,
    DROP COLUMN IF EXISTS rek_fu3,
    DROP COLUMN IF EXISTS tgl_fu3,
    DROP COLUMN IF EXISTS lokasi_fu3,
    DROP COLUMN IF EXISTS hasil_fu3,
    DROP COLUMN IF EXISTS kesimpulan_fu3,
    DROP COLUMN IF EXISTS link_fu3,
    DROP COLUMN IF EXISTS rek_fu4,
    DROP COLUMN IF EXISTS pemeriksaan_lain;
*/
