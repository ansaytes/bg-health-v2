-- ============================================================
-- Migration: kunjungan kontrol ProKawan + wa_log
-- ============================================================
-- kunjungan_kontrol: satu baris per kunjungan kontrol peserta ProKawan,
-- berisi jadwal, tanggal aktual, evidence (link dokumen dokter), dan hasil.
-- Dipakai untuk menilai kepatuhan peserta dan mengirim pengingat WA.

CREATE TABLE IF NOT EXISTS kunjungan_kontrol (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nik_hash TEXT NOT NULL,
    nik_enc TEXT,
    nama_enc TEXT,
    site TEXT,
    department TEXT,
    jabatan TEXT,
    zona_risiko TEXT CHECK (zona_risiko IN ('Kuning','Merah')),
    jadwal_tanggal DATE NOT NULL,
    aktual_tanggal DATE,
    evidence_url TEXT,
    catatan TEXT,
    hasil TEXT CHECK (hasil IN ('MEMBAIK','STABIL','MEMBURUK','BELUM')),
    no_wa TEXT,
    wa_sent_at TIMESTAMPTZ,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kunjungan_nik ON kunjungan_kontrol(nik_hash);
CREATE INDEX IF NOT EXISTS idx_kunjungan_jadwal ON kunjungan_kontrol(jadwal_tanggal);

ALTER TABLE kunjungan_kontrol ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kunjungan_kontrol' AND policyname = 'kunjungan_all_authenticated') THEN
        CREATE POLICY kunjungan_all_authenticated ON kunjungan_kontrol FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;
