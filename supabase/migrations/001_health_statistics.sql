-- ═══════════════════════════════════════════════════════════════
-- Migration: Health Statistics Tables
-- Jalankan di Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Tabel aggregate bulanan (seluruh site)
CREATE TABLE IF NOT EXISTS health_statistics (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tahun INT NOT NULL,
  bulan INT NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  man_power INT DEFAULT 0,
  man_hours BIGINT DEFAULT 0,
  tk_sakit INT DEFAULT 0,
  absensi_sakit INT DEFAULT 0,
  spell INT DEFAULT 0,
  rkk NUMERIC(8,4) DEFAULT 0,
  cmr NUMERIC(8,4) DEFAULT 0,
  mfr NUMERIC(12,2) DEFAULT 0,
  ssr NUMERIC(8,4) DEFAULT 0,
  asr NUMERIC(12,2) DEFAULT 0,
  fr_pak NUMERIC(8,4) DEFAULT 0,
  kaptk NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tahun, bulan)
);

-- 2. Tabel per-site ASR
CREATE TABLE IF NOT EXISTS health_statistics_sites (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tahun INT NOT NULL,
  bulan INT NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  jobsite VARCHAR(100) NOT NULL,
  man_power INT DEFAULT 0,
  asr NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tahun, bulan, jobsite)
);

-- 3. Views untuk API
CREATE OR REPLACE VIEW v_kpi_all_site AS
SELECT
  id, tahun, bulan, man_power, man_hours, tk_sakit, absensi_sakit,
  rkk, cmr, mfr, ssr, asr, fr_pak, kaptk, created_at, updated_at
FROM health_statistics
ORDER BY tahun, bulan;

CREATE OR REPLACE VIEW v_kpi_per_site AS
SELECT
  id, tahun, bulan, jobsite, man_power, asr, created_at, updated_at
FROM health_statistics_sites
ORDER BY tahun, bulan, asr DESC;

-- 4. Enable RLS
ALTER TABLE health_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_statistics_sites ENABLE ROW LEVEL SECURITY;

-- 5. Policies — semua user yang login bisa baca, hanya admin yang tulis
CREATE POLICY "Anyone can read health_statistics" ON health_statistics
  FOR SELECT USING (true);
CREATE POLICY "Admins can insert health_statistics" ON health_statistics
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can update health_statistics" ON health_statistics
  FOR UPDATE USING (true);
CREATE POLICY "Admins can delete health_statistics" ON health_statistics
  FOR DELETE USING (true);

CREATE POLICY "Anyone can read health_statistics_sites" ON health_statistics_sites
  FOR SELECT USING (true);
CREATE POLICY "Admins can insert health_statistics_sites" ON health_statistics_sites
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can update health_statistics_sites" ON health_statistics_sites
  FOR UPDATE USING (true);
CREATE POLICY "Admins can delete health_statistics_sites" ON health_statistics_sites
  FOR DELETE USING (true);

-- 6. Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER health_statistics_updated_at
  BEFORE UPDATE ON health_statistics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER health_statistics_sites_updated_at
  BEFORE UPDATE ON health_statistics_sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
