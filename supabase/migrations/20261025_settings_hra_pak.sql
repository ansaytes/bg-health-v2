-- ============================================================
-- Migrasi: app_settings + HRA Rev.01 + Register PAK
-- ============================================================
-- Bagian 1: app_settings — pengaturan aplikasi (key-value, superuser-only).
-- Bagian 2: hra_assessments — Health Hazard Risk Assessment FORM/069 Rev.001.
-- Bagian 3: pak_cases — Register PAK (INK/017, lifecycle PAK-01/02/03).
-- Jalankan di Supabase SQL Editor.

-- ─────────────────────────────────────────────────────────────
-- 1. APP_SETTINGS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

-- Satu baris settings utama; upsert dari aplikasi.
INSERT INTO app_settings (key, value) VALUES ('app', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'settings_read') THEN
        CREATE POLICY settings_read ON app_settings FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'settings_write_superuser') THEN
        CREATE POLICY settings_write_superuser ON app_settings FOR ALL TO authenticated
            USING (
                EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'superuser')
            )
            WITH CHECK (
                EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'superuser')
            );
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 2. HRA — FORM/069 Rev.001
-- ─────────────────────────────────────────────────────────────
-- Satu HRA per site + departemen + tanggal. Baris hazard tersimpan di
-- hra_hazards (1:N). P dan R dihitung aplikasi dari jam paparan + kontrol
-- (catatan penilaian Rev.01), lalu disimpan sebagai snapshot.

CREATE TABLE IF NOT EXISTS hra_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lokasi_kerja TEXT NOT NULL,
    divisi_departemen TEXT NOT NULL,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    no_dokumen TEXT NOT NULL DEFAULT 'BG/QSHE/FORM/069',
    no_revisi TEXT NOT NULL DEFAULT '001',
    tgl_penerbitan DATE,
    tgl_persetujuan DATE,
    dibuat_oleh TEXT,
    diperiksa_oleh TEXT,
    disetujui_oleh TEXT,
    -- Batas pemeriksaan ulang (FORM/069: "WAJIB diperiksa ulang paling lambat").
    batas_review DATE,
    catatan_penilaian JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (lokasi_kerja, divisi_departemen, tanggal)
);

CREATE TABLE IF NOT EXISTS hra_hazards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hra_id UUID NOT NULL REFERENCES hra_assessments(id) ON DELETE CASCADE,
    no_urut INTEGER NOT NULL,
    jenis_pekerjaan TEXT NOT NULL,
    -- Fisika / Kimia / Biologi / Ergonomi / Psikososial (bisa gabung "A / B").
    jenis_hazard TEXT NOT NULL,
    sumber_hazard TEXT NOT NULL,
    -- Kelompok/jabatan yang terpapar — kunci pencocokan ke karyawan.
    kelompok_berisiko TEXT NOT NULL,
    efek_kesehatan TEXT NOT NULL,
    efek_akut TEXT,
    efek_kronis TEXT,
    -- Initial risk. P ditentukan dari jam paparan (Rev.01 catatan 1).
    init_p INTEGER NOT NULL CHECK (init_p BETWEEN 1 AND 5),
    init_e INTEGER NOT NULL CHECK (init_e BETWEEN 1 AND 5),
    init_r INTEGER NOT NULL,
    -- Kontrol yang sudah berjalan (dipakai engine menurunkan P: APD/admin -1,
    -- engineering/substitusi -2 — catatan 6).
    tindakan_pencegahan TEXT NOT NULL,
    kontrol_tingkat TEXT DEFAULT 'APD' CHECK (kontrol_tingkat IN ('APD','ADMINISTRATIF','ENGINEERING','SUBSTITUSI','ELIMINASI','TIDAK_ADA')),
    res_p INTEGER NOT NULL CHECK (res_p BETWEEN 1 AND 5),
    res_e INTEGER NOT NULL CHECK (res_e BETWEEN 1 AND 5),
    res_r INTEGER NOT NULL,
    regulasi TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hra_hazards_hra ON hra_hazards(hra_id);
CREATE INDEX IF NOT EXISTS idx_hra_hazards_kelompok ON hra_hazards(kelompok_berisiko);

ALTER TABLE hra_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hra_hazards ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hra_assessments' AND policyname = 'hra_all_authenticated') THEN
        CREATE POLICY hra_all_authenticated ON hra_assessments FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hra_hazards' AND policyname = 'hra_hazards_all_authenticated') THEN
        CREATE POLICY hra_hazards_all_authenticated ON hra_hazards FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 3. REGISTER PAK — INK/017 (PAK-01 / PAK-02 / PAK-03)
-- ─────────────────────────────────────────────────────────────
-- Satu kasus = satu baris pak_cases. Lifecycle:
--   DITERIMA -> DITRIASE (PAK-01, <=1 hari kerja) -> PENEGAKAN (PAK-02)
--   -> DIAGNOSIS (PAK | DUGAAN_PAK | BUKAN_PAK)
--   -> TAHAP_I (<=2x24 jam) -> TAHAP_II (sembuh/cacat/meninggal) / DITUTUP

CREATE TABLE IF NOT EXISTS pak_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- PAK-BGMMYY-NNN; MMYY dari tanggal diterima.
    id_register TEXT NOT NULL UNIQUE,
    -- Penerimaan (PAK-01 bagian A)
    tanggal_diterima TIMESTAMPTZ NOT NULL,
    diterima_oleh TEXT NOT NULL,
    lokasi TEXT CHECK (lokasi IN ('Head Office','Jobsite')),
    jobsite_nama TEXT,
    -- Sumber dugaan (5 opsi PAK-01 A)
    sumber_dugaan TEXT NOT NULL CHECK (sumber_dugaan IN ('MCU','PELAYANAN_INTERNAL','BEROBAT_LUAR','PIHAK_LAIN','KLUSTER_HRA')),
    sumber_detail TEXT,
    pelapor_nama TEXT,
    pelapor_telepon TEXT,
    -- Data minimal (PAK-01 bagian B)
    nik_hash TEXT,
    nik_enc TEXT,
    nama_enc TEXT,
    jabatan TEXT,
    department TEXT,
    jenis_pekerjaan TEXT,
    masa_kerja_tahun INTEGER,
    masa_kerja_bulan INTEGER,
    sumber_pajanan TEXT,
    diagnosis_klinis TEXT,
    diagnosis_tgl DATE,
    diagnosis_faskes TEXT,
    diagnosis_dokter TEXT,
    hasil_mcu_pemicu TEXT,
    status_bpjs_tk TEXT,
    upah TEXT,
    mcu_record_id UUID REFERENCES mcu_records(id) ON DELETE SET NULL,
    -- Triase (PAK-01 bagian C) — maks 1 hari kerja sejak diterima
    triase_keputusan TEXT CHECK (triase_keputusan IN ('TIDAK_MEMENUHI','PERLU_TAMBAHAN','LANJUT_PAK02')),
    triase_alasan TEXT,
    triase_tgl TIMESTAMPTZ,
    triase_dokter TEXT,
    triase_batas TIMESTAMPTZ,
    -- Penegakan diagnosis (PAK-02, 7 langkah Permenkes 56/2016)
    telaah7 JSONB DEFAULT '[]'::jsonb,
    dokumen_pendukung JSONB DEFAULT '[]'::jsonb,
    konsultasi TEXT,
    -- Kesimpulan (PAK-02 bagian E)
    diagnosis_okupasi TEXT CHECK (diagnosis_okupasi IN ('PAK','DUGAAN_PAK','BUKAN_PAK')),
    diagnosis_tegak_tgl TIMESTAMPTZ,
    kelaikan_kerja TEXT CHECK (kelaikan_kerja IN ('Fit','Fit with Note','Currently Unfit','Unfit')),
    tindak_lanjut_pengendalian TEXT,
    dokter_perusahaan TEXT,
    -- Laporan (PAK-03)
    laporan_medis_tgl TIMESTAMPTZ,
    laporan_medis_batas TIMESTAMPTZ,
    tahap1_batas TIMESTAMPTZ,
    tahap1_selesai_tgl TIMESTAMPTZ,
    tahap1_tepat_waktu BOOLEAN,
    tahap1_bukti JSONB DEFAULT '[]'::jsonb,
    kesimpulan_bpjs TEXT CHECK (kesimpulan_bpjs IN ('PAK','BUKAN_PAK','MENUNGGU')),
    kesimpulan_bpjs_tgl DATE,
    tahap2_selesai_tgl TIMESTAMPTZ,
    tahap2_bukti JSONB DEFAULT '[]'::jsonb,
    -- Status lifecycle (turunan; diupdate aplikasi)
    status TEXT NOT NULL DEFAULT 'DITERIMA' CHECK (status IN ('DITERIMA','DITRIASE','PENEGAKAN','PAK','DUGAAN_PAK','BUKAN_PAK','TAHAP_I','TAHAP_II','DITUTUP')),
    -- Verifikasi dokumen HRA unit kerja (INK/017 Lampiran 1): petugas konfirmasi
    -- manual bahwa pajanan pada HRA sesuai dengan keluhan/diagnosis karyawan.
    hra_verified BOOLEAN DEFAULT FALSE,
    hra_verified_by TEXT,
    hra_verified_tgl TIMESTAMPTZ,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pak_cases_nik ON pak_cases(nik_hash);
CREATE INDEX IF NOT EXISTS idx_pak_cases_status ON pak_cases(status);
CREATE INDEX IF NOT EXISTS idx_pak_cases_tgl ON pak_cases(tanggal_diterima);

ALTER TABLE pak_cases ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pak_cases' AND policyname = 'pak_write_admin') THEN
        -- Tulis: superuser + administrator saja (keputusan role).
        CREATE POLICY pak_write_admin ON pak_cases FOR ALL TO authenticated
            USING (
                EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid()
                        AND up.role IN ('superuser','administrator'))
            )
            WITH CHECK (
                EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid()
                        AND up.role IN ('superuser','administrator'))
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pak_cases' AND policyname = 'pak_read_manager') THEN
        -- Baca: + manager (read-only, menandatangani laporan Tahap I).
        CREATE POLICY pak_read_manager ON pak_cases FOR SELECT TO authenticated
            USING (
                EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid()
                        AND up.role IN ('superuser','administrator','manager','pic'))
            );
    END IF;
END $$;
