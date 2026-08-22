-- ═══════════════════════════════════════════════════════════
--  QSHE Department — Supabase Schema
--  PT. BAGONG DEKAKA MAKMUR
--  Versi: 1.0
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
--  TABEL 1: man_power
--  Master denominator semua KPI kesehatan.
--  Satu baris = satu jobsite per bulan.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS man_power (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jobsite         text NOT NULL,
  bulan           smallint NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  tahun           integer NOT NULL,
  man_power       integer NOT NULL DEFAULT 0,
  hari_kerja      integer NOT NULL DEFAULT 0,
  man_hours       integer GENERATED ALWAYS AS (man_power * hari_kerja) STORED,
  kunjungan_klinik integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_man_power_site_month UNIQUE (jobsite, bulan, tahun)
);

COMMENT ON TABLE man_power IS 'Data Man Power per Site per Bulan — denominator KPI';
COMMENT ON COLUMN man_power.man_hours IS 'Computed: man_power × hari_kerja';
COMMENT ON COLUMN man_power.kunjungan_klinik IS 'Total kunjungan FAS/Klinik bulan itu';

-- ─────────────────────────────────────────────
--  TABEL 2: absensi_sakit
--  Data karyawan sakit dengan max 3 periode (A/B/C).
--  Satu baris = satu karyawan per bulan.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS absensi_sakit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nik             text NOT NULL,
  nama            text NOT NULL,
  jobsite         text NOT NULL,
  jabatan         text,
  bulan           smallint NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  tahun           integer NOT NULL,

  -- Periode A
  tgl_mulai_a     date,
  tgl_selesai_a   date,
  hari_a          smallint NOT NULL DEFAULT 0,
  diag_a          text,

  -- Periode B
  tgl_mulai_b     date,
  tgl_selesai_b   date,
  hari_b          smallint NOT NULL DEFAULT 0,
  diag_b          text,

  -- Periode C
  tgl_mulai_c     date,
  tgl_selesai_c   date,
  hari_c          smallint NOT NULL DEFAULT 0,
  diag_c          text,

  -- Computed
  total_hari      smallint GENERATED ALWAYS AS (hari_a + hari_b + hari_c) STORED,
  spell           smallint NOT NULL DEFAULT 1,
  is_pak          boolean NOT NULL DEFAULT false,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_absensi_nik_month UNIQUE (nik, bulan, tahun)
);

COMMENT ON TABLE absensi_sakit IS 'Data Karyawan Sakit — max 3 periode per baris';
COMMENT ON COLUMN absensi_sakit.spell IS 'Jumlah spell (1-3). Hitung otomatis dari form, bukan DB trigger';
COMMENT ON COLUMN absensi_sakit.is_pak IS 'Penyakit Akibat Kerja (PAK)';
COMMENT ON COLUMN absensi_sakit.diag_a IS 'Diagnosa periode A — untuk kalkulasi spell continuity';

-- ─────────────────────────────────────────────
--  TABEL 3: kunjungan_berobat
--  Satu baris = satu event kunjungan klinik.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kunjungan_berobat (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nik             text NOT NULL,
  nama            text NOT NULL,
  departemen      text,
  jobsite         text NOT NULL,
  tanggal         date NOT NULL,
  diagnosa        text,
  jenis_obat      text,
  rujuk_rs        boolean NOT NULL DEFAULT false,
  nama_rs         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE kunjungan_berobat IS 'Data Kunjungan Berobat — satu baris per kunjungan';
COMMENT ON COLUMN kunjungan_berobat.jenis_obat IS 'Jenis obat, jika multiple gunakan separator | ';

-- ═══════════════════════════════════════════════
--  INDEXES — optimasi query filter & agregasi
-- ═══════════════════════════════════════════════

-- man_power: lookup per periode & site
CREATE INDEX IF NOT EXISTS idx_mp_site_bulan_tahun ON man_power (jobsite, bulan, tahun);
CREATE INDEX IF NOT EXISTS idx_mp_bulan_tahun ON man_power (bulan, tahun);

-- absensi_sakit: filter per site, bulan, tahun
CREATE INDEX IF NOT EXISTS idx_abs_site ON absensi_sakit (jobsite);
CREATE INDEX IF NOT EXISTS idx_abs_bulan_tahun ON absensi_sakit (bulan, tahun);
CREATE INDEX IF NOT EXISTS idx_abs_site_bulan_tahun ON absensi_sakit (jobsite, bulan, tahun);
CREATE INDEX IF NOT EXISTS idx_abs_pak ON absensi_sakit (is_pak) WHERE is_pak = true;

-- kunjungan_berobat: filter per site, tanggal, rujuk
CREATE INDEX IF NOT EXISTS idx_kb_site ON kunjungan_berobat (jobsite);
CREATE INDEX IF NOT EXISTS idx_kb_tanggal ON kunjungan_berobat (tanggal);
CREATE INDEX IF NOT EXISTS idx_kb_bulan_tahun ON kunjungan_berobat (
  EXTRACT(MONTH FROM tanggal), EXTRACT(YEAR FROM tanggal)
);
CREATE INDEX IF NOT EXISTS idx_kb_rujuk ON kunjungan_berobat (rujuk_rs) WHERE rujuk_rs = true;
CREATE INDEX IF NOT EXISTS idx_kb_diagnosa ON kunjungan_berobat (diagnosa);

-- ═══════════════════════════════════════════════
--  VIEWS — KPI otomatis untuk Dashboard
-- ═══════════════════════════════════════════════

-- View: Ringkasan per site per bulan
CREATE OR REPLACE VIEW v_kpi_per_site AS
SELECT
  mp.jobsite,
  mp.bulan,
  mp.tahun,
  mp.man_power,
  mp.man_hours,
  mp.hari_kerja,
  mp.kunjungan_klinik,

  -- Absensi
  COALESCE(ab.total_karyawan_sakit, 0) AS total_karyawan_sakit,
  COALESCE(ab.total_hari_absensi, 0) AS total_hari_absensi,
  COALESCE(ab.total_spell, 0) AS total_spell,
  COALESCE(ab.total_pak, 0) AS total_pak,
  COALESCE(ab.karyawan_lebih_3hari, 0) AS karyawan_lebih_3hari,

  -- KPI
  CASE WHEN mp.man_hours > 0
    THEN ROUND((COALESCE(ab.total_hari_absensi, 0)::numeric * 1000) / mp.man_hours, 2)
    ELSE 0
  END AS rkk,

  CASE WHEN mp.man_hours > 0
    THEN ROUND((mp.kunjungan_klinik::numeric * 1000) / mp.man_hours, 2)
    ELSE 0
  END AS cmr,

  CASE WHEN mp.man_power > 0
    THEN ROUND(COALESCE(ab.total_hari_absensi, 0)::numeric / mp.man_power, 2)
    ELSE 0
  END AS asr,

  CASE WHEN mp.man_power > 0
    THEN ROUND((COALESCE(ab.total_pak, 0)::numeric / mp.man_power) * 100, 2)
    ELSE 0
  END AS fr_pak,

  CASE WHEN mp.man_power > 0
    THEN ROUND((COALESCE(ab.karyawan_lebih_3hari, 0)::numeric * 1000) / mp.man_power, 2)
    ELSE 0
  END AS kaptk

FROM man_power mp
LEFT JOIN (
  SELECT
    jobsite, bulan, tahun,
    COUNT(*) AS total_karyawan_sakit,
    SUM(total_hari) AS total_hari_absensi,
    SUM(spell) AS total_spell,
    COUNT(*) FILTER (WHERE is_pak = true) AS total_pak,
    COUNT(*) FILTER (WHERE total_hari > 3) AS karyawan_lebih_3hari
  FROM absensi_sakit
  GROUP BY jobsite, bulan, tahun
) ab ON mp.jobsite = ab.jobsite AND mp.bulan = ab.bulan AND mp.tahun = ab.tahun;

COMMENT ON VIEW v_kpi_per_site IS 'KPI per site per bulan — RKK, CMR, ASR, FR PAK, KAPTK dihitung otomatis';


-- View: Agregasi ALL SITE per bulan (untuk dashboard total)
CREATE OR REPLACE VIEW v_kpi_all_site AS
SELECT
  bulan,
  tahun,
  SUM(man_power) AS total_man_power,
  SUM(man_hours) AS total_man_hours,
  SUM(kunjungan_klinik) AS total_kunjungan_klinik,
  SUM(total_karyawan_sakit) AS total_karyawan_sakit,
  SUM(total_hari_absensi) AS total_hari_absensi,
  SUM(total_spell) AS total_spell,
  SUM(total_pak) AS total_pak,

  CASE WHEN SUM(man_hours) > 0
    THEN ROUND((SUM(total_hari_absensi)::numeric * 1000) / SUM(man_hours), 2)
    ELSE 0
  END AS rkk,

  CASE WHEN SUM(man_hours) > 0
    THEN ROUND((SUM(kunjungan_klinik)::numeric * 1000) / SUM(man_hours), 2)
    ELSE 0
  END AS cmr,

  CASE WHEN SUM(total_karyawan_sakit) > 0
    THEN ROUND(SUM(total_spell)::numeric / SUM(total_karyawan_sakit), 2)
    ELSE 0
  END AS ssr,

  CASE WHEN SUM(total_karyawan_sakit) > 0
    THEN ROUND(SUM(total_hari_absensi)::numeric / SUM(total_karyawan_sakit), 2)
    ELSE 0
  END AS mfr,

  CASE WHEN SUM(man_power) > 0
    THEN ROUND(SUM(total_hari_absensi)::numeric / SUM(man_power), 2)
    ELSE 0
  END AS asr,

  CASE WHEN SUM(man_power) > 0
    THEN ROUND((SUM(total_pak)::numeric / SUM(man_power)) * 100, 2)
    ELSE 0
  END AS fr_pak,

  CASE WHEN SUM(man_power) > 0
    THEN ROUND((SUM(karyawan_lebih_3hari)::numeric * 1000) / SUM(man_power), 2)
    ELSE 0
  END AS kaptk

FROM v_kpi_per_site
GROUP BY bulan, tahun;

COMMENT ON VIEW v_kpi_all_site IS 'KPI agregasi seluruh site per bulan';


-- View: Top 10 ASR (untuk chart ranking)
CREATE OR REPLACE VIEW v_top_asr AS
SELECT jobsite, bulan, tahun, asr, total_hari_absensi, man_power
FROM v_kpi_per_site
ORDER BY asr DESC
LIMIT 10;

COMMENT ON VIEW v_top_asr IS 'Top 10 jobsite dengan ASR tertinggi';


-- View: List karyawan sakit (untuk sick list dashboard)
CREATE OR REPLACE VIEW v_sick_list AS
SELECT
  a.nik,
  a.nama,
  a.jobsite,
  a.jabatan,
  a.total_hari,
  a.spell,
  a.is_pak,
  COALESCE(a.diag_a, '') AS diag_a,
  COALESCE(a.diag_b, '') AS diag_b,
  COALESCE(a.diag_c, '') AS diag_c,
  a.bulan,
  a.tahun
FROM absensi_sakit a
ORDER BY a.total_hari DESC;

COMMENT ON VIEW v_sick_list IS 'List karyawan sakit diurutkan dari hari terbanyak';


-- View: Kunjungan dengan rujukan RS
CREATE OR REPLACE VIEW v_rujuk_rs AS
SELECT nik, nama, departemen, jobsite, tanggal, diagnosa, nama_rs
FROM kunjungan_berobat
WHERE rujuk_rs = true
ORDER BY tanggal DESC;

COMMENT ON VIEW v_rujuk_rs IS 'Karyawan yang dirujuk ke rumah sakit';


-- ═══════════════════════════════════════════════
--  UPDATED_AT trigger (auto-update timestamp)
-- ═══════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_man_power_updated
  BEFORE UPDATE ON man_power
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_absensi_sakit_updated
  BEFORE UPDATE ON absensi_sakit
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_kunjungan_berobat_updated
  BEFORE UPDATE ON kunjungan_berobat
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ═══════════════════════════════════════════════
--  ROW LEVEL SECURITY (RLS)
--  Aktifkan setelah menambahkan Supabase Auth.
--  Uncomment baris di bawah saat production.
-- ═══════════════════════════════════════════════

-- ALTER TABLE man_power ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE absensi_sakit ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE kunjungan_berobat ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Authenticated users can read man_power"
--   ON man_power FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "Authenticated users can insert man_power"
--   ON man_power FOR INSERT TO authenticated WITH CHECK (true);
-- CREATE POLICY "Authenticated users can update man_power"
--   ON man_power FOR UPDATE TO authenticated USING (true);
-- CREATE POLICY "Authenticated users can delete man_power"
--   ON man_power FOR DELETE TO authenticated USING (true);

-- CREATE POLICY "Authenticated users can read absensi_sakit"
--   ON absensi_sakit FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "Authenticated users can insert absensi_sakit"
--   ON absensi_sakit FOR INSERT TO authenticated WITH CHECK (true);
-- CREATE POLICY "Authenticated users can update absensi_sakit"
--   ON absensi_sakit FOR UPDATE TO authenticated USING (true);
-- CREATE POLICY "Authenticated users can delete absensi_sakit"
--   ON absensi_sakit FOR DELETE TO authenticated USING (true);

-- CREATE POLICY "Authenticated users can read kunjungan_berobat"
--   ON kunjungan_berobat FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "Authenticated users can insert kunjungan_berobat"
--   ON kunjungan_berobat FOR INSERT TO authenticated WITH CHECK (true);
-- CREATE POLICY "Authenticated users can update kunjungan_berobat"
--   ON kunjungan_berobat FOR UPDATE TO authenticated USING (true);
-- CREATE POLICY "Authenticated users can delete kunjungan_berobat"
--   ON kunjungan_berobat FOR DELETE TO authenticated USING (true);
