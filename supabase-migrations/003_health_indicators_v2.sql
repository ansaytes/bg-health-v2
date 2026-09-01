-- ================================================================
-- Migration 003: Unified Health Indicators + Sick Employees
-- Drop old tables, create new structure matching Excel layout
-- ================================================================

-- Drop old tables and views if they exist
DROP TABLE IF EXISTS health_statistics_sites CASCADE;
DROP TABLE IF EXISTS health_statistics CASCADE;
DROP VIEW IF EXISTS v_kpi_all_site CASCADE;
DROP VIEW IF EXISTS v_kpi_per_site CASCADE;
DROP VIEW IF EXISTS v_top_asr CASCADE;

-- ================================================================
-- Table: health_indicators
-- One row per (tahun, bulan, jobsite) with ALL leading + lagging indicators
-- jobsite = 'All Site' for aggregate data
-- ================================================================
CREATE TABLE health_indicators (
  id            BIGSERIAL PRIMARY KEY,
  tahun         INTEGER NOT NULL,
  bulan         INTEGER NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  jobsite       TEXT NOT NULL DEFAULT 'All Site',

  -- Leading Indicators (row 6-14 in Excel)
  man_power             NUMERIC DEFAULT 0,
  man_hours             NUMERIC DEFAULT 0,
  kunjungan_klinik      NUMERIC DEFAULT 0,
  tk_sakit              NUMERIC DEFAULT 0,
  absensi_sakit         NUMERIC DEFAULT 0,
  spell                 NUMERIC DEFAULT 0,
  penyakit_akibat_kerja NUMERIC DEFAULT 0,
  kejadian_penyakit_tk  NUMERIC DEFAULT 0,
  layak_bekerja         NUMERIC DEFAULT 0,

  -- Lagging Indicators (row 16-22 in Excel)
  rkk           NUMERIC DEFAULT 0,
  cmr           NUMERIC DEFAULT 0,
  mfr           NUMERIC DEFAULT 0,
  ssr           NUMERIC DEFAULT 0,
  asr           NUMERIC DEFAULT 0,
  fr_pak        NUMERIC DEFAULT 0,
  kaptk         NUMERIC DEFAULT 0,

  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tahun, bulan, jobsite)
);

-- Index for common queries
CREATE INDEX idx_hi_tahun_bulan ON health_indicators(tahun, bulan);
CREATE INDEX idx_hi_jobsite ON health_indicators(jobsite);
CREATE INDEX idx_hi_asr ON health_indicators(tahun, bulan, asr) WHERE asr > 0;

-- ================================================================
-- Table: sick_employees
-- Data from 'Data Karyawan Sakit' sheet
-- ================================================================
CREATE TABLE sick_employees (
  id                    BIGSERIAL PRIMARY KEY,
  nik                   TEXT,
  nama                  TEXT NOT NULL,
  jobsite               TEXT,
  jabatan               TEXT,
  tanggal_mulai_a       DATE,
  tanggal_selesai_a     DATE,
  jumlah_hari_a         INTEGER DEFAULT 0,
  tanggal_mulai_b       DATE,
  tanggal_selesai_b     DATE,
  jumlah_hari_b         INTEGER DEFAULT 0,
  tanggal_mulai_c       DATE,
  tanggal_selesai_c     DATE,
  jumlah_hari_c         INTEGER DEFAULT 0,
  jumlah_spell          INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sick_jobsite ON sick_employees(jobsite);
CREATE INDEX idx_sick_tanggal ON sick_employees(tanggal_mulai_a);

-- ================================================================
-- RLS Policies (optional - enable if needed)
-- ================================================================
-- ALTER TABLE health_indicators ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sick_employees ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow read for authenticated users" ON health_indicators FOR SELECT USING (auth.role() = 'authenticated');
-- CREATE POLICY "Allow insert for authenticated users" ON health_indicators FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- CREATE POLICY "Allow update for authenticated users" ON health_indicators FOR UPDATE USING (auth.role() = 'authenticated');
-- CREATE POLICY "Allow delete for authenticated users" ON health_indicators FOR DELETE USING (auth.role() = 'authenticated');
-- CREATE POLICY "Allow read for authenticated users" ON sick_employees FOR SELECT USING (auth.role() = 'authenticated');
