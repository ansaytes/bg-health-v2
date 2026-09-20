-- ════════════════════════════════════════════════════════════════════
-- BG-Health v2 — Migration 005
-- Normalized health_indicators + sick_employees + aggregation views
-- Replaces: lagging_indicators, health_statistics, health_statistics_sites,
--           absensi_sakit, sick_employees (old shape from 004)
-- ════════════════════════════════════════════════════════════════════

BEGIN;

-- Drop legacy / superseded tables and views
DROP VIEW IF EXISTS v_health_all_site CASCADE;
DROP VIEW IF EXISTS v_health_ytd_per_site CASCADE;
DROP VIEW IF EXISTS v_top_asr_sites CASCADE;

DROP TABLE IF EXISTS lagging_indicators CASCADE;
DROP TABLE IF EXISTS health_statistics CASCADE;
DROP TABLE IF EXISTS health_statistics_sites CASCADE;
DROP TABLE IF EXISTS health_indicators CASCADE;
DROP TABLE IF EXISTS sick_employees CASCADE;
DROP TABLE IF EXISTS absensi_sakit CASCADE;

-- ════════════════════════════════════════════════════════════════════
-- Table: health_indicators
-- 1 row = 1 site + 1 bulan + 1 tahun (all 9 leading + 7 lagging columns)
-- Mirrors Excel jobsite sheet rows 5-22 (one row per month per site)
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE health_indicators (
  id            BIGSERIAL PRIMARY KEY,
  tahun         INTEGER NOT NULL,
  bulan         INTEGER NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  jobsite       TEXT    NOT NULL DEFAULT 'All Site',

  -- ── LEADING (9 cols; Excel rows 6-14) ──
  man_power              INTEGER NOT NULL DEFAULT 0,    -- row 6
  man_hours              BIGINT  NOT NULL DEFAULT 0,    -- row 7
  kunjungan_klinik       INTEGER NOT NULL DEFAULT 0,    -- row 8
  tk_sakit               INTEGER NOT NULL DEFAULT 0,    -- row 9
  absensi_sakit          INTEGER NOT NULL DEFAULT 0,    -- row 10
  spell                  INTEGER NOT NULL DEFAULT 0,    -- row 11
  penyakit_akibat_kerja  INTEGER NOT NULL DEFAULT 0,    -- row 12
  kejadian_penyakit_tk   INTEGER NOT NULL DEFAULT 0,    -- row 13
  layak_bekerja          INTEGER NOT NULL DEFAULT 0,    -- row 14

  -- ── LAGGING (7 cols; Excel rows 16-22, stored as raw ratio/decimal) ──
  rkk     NUMERIC(10,8) NOT NULL DEFAULT 0,   -- row 16  Rasio Kelayakan Kerja (0-1)
  cmr     NUMERIC(10,8) NOT NULL DEFAULT 0,   -- row 17  Angka Kesakitan Kasar (0-1)
  mfr     NUMERIC(14,4) NOT NULL DEFAULT 0,   -- row 18  Kekerapan Kesakitan (per 10^6 man-hours)
  ssr     NUMERIC(10,4) NOT NULL DEFAULT 0,   -- row 19  Keparahan Penyakit (days per TK Sakit)
  asr     NUMERIC(14,4) NOT NULL DEFAULT 0,   -- row 20  Keparahan Absensi (per 10^6 man-hours)
  fr_pak  NUMERIC(10,8) NOT NULL DEFAULT 0,   -- row 21  Frekuensi PAK (0-1)
  kaptk   INTEGER       NOT NULL DEFAULT 0,   -- row 22  Kejadian Akibat Penyakit TK (count)

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tahun, bulan, jobsite)
);

CREATE INDEX idx_hi_tahun_bulan ON health_indicators(tahun, bulan);
CREATE INDEX idx_hi_jobsite     ON health_indicators(jobsite);
CREATE INDEX idx_hi_asr_top     ON health_indicators(tahun, bulan, asr DESC) WHERE asr > 0;

ALTER TABLE health_indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hi_public_read" ON health_indicators FOR SELECT USING (true);
CREATE POLICY "hi_auth_all"    ON health_indicators FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION hi_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_hi_touch_updated_at
  BEFORE UPDATE ON health_indicators
  FOR EACH ROW EXECUTE FUNCTION hi_touch_updated_at();

COMMENT ON TABLE  health_indicators IS 'Monthly leading + lagging health indicators per site per bulan';
COMMENT ON COLUMN health_indicators.jobsite IS 'Nama jobsite. "All Site" = aggregate row (manual or via view)';
COMMENT ON COLUMN health_indicators.man_power              IS 'Leading row 6 - Man Power';
COMMENT ON COLUMN health_indicators.man_hours              IS 'Leading row 7 - Man Hours';
COMMENT ON COLUMN health_indicators.kunjungan_klinik        IS 'Leading row 8 - Total Kunjungan Klinik';
COMMENT ON COLUMN health_indicators.tk_sakit               IS 'Leading row 9 - Tenaga Kerja Sakit';
COMMENT ON COLUMN health_indicators.absensi_sakit           IS 'Leading row 10 - Total Absensi Sakit (days)';
COMMENT ON COLUMN health_indicators.spell                   IS 'Leading row 11 - Spell count (Kepdirjen 185/2019)';
COMMENT ON COLUMN health_indicators.penyakit_akibat_kerja  IS 'Leading row 12 - Penyakit Akibat Kerja count';
COMMENT ON COLUMN health_indicators.kejadian_penyakit_tk   IS 'Leading row 13 - Kejadian Akibat Penyakit Tenaga Kerja count';
COMMENT ON COLUMN health_indicators.layak_bekerja           IS 'Leading row 14 - Layak Bekerja count';
COMMENT ON COLUMN health_indicators.rkk   IS 'Lagging row 16 - Rasio Kelayakan Kerja = layak_bekerja/man_power (0-1)';
COMMENT ON COLUMN health_indicators.cmr   IS 'Lagging row 17 - Angka Kesakitan Kasar = tk_sakit/man_power (0-1)';
COMMENT ON COLUMN health_indicators.mfr   IS 'Lagging row 18 - Kekerapan Kesakitan = (tk_sakit*10^6)/man_hours';
COMMENT ON COLUMN health_indicators.ssr   IS 'Lagging row 19 - Keparahan Penyakit = absensi_sakit/tk_sakit';
COMMENT ON COLUMN health_indicators.asr   IS 'Lagging row 20 - Keparahan Absensi = (absensi_sakit*10^6)/man_hours';
COMMENT ON COLUMN health_indicators.fr_pak IS 'Lagging row 21 - Frekuensi PAK = penyakit_akibat_kerja/man_power (0-1)';
COMMENT ON COLUMN health_indicators.kaptk IS 'Lagging row 22 - Kejadian Akibat Penyakit Tenaga Kerja count';


-- ════════════════════════════════════════════════════════════════════
-- Table: sick_employees
-- Mirrors Excel sheet "Data Karyawan Sakit" + diagnosis fields (not in Excel,
-- needed for Spell auto-calculation).
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE sick_employees (
  id            BIGSERIAL PRIMARY KEY,
  nik           TEXT,
  nama          TEXT NOT NULL,
  jobsite       TEXT NOT NULL,
  jabatan       TEXT,

  -- Periode A
  tgl_mulai_a    DATE,
  tgl_selesai_a  DATE,
  hari_a         INTEGER NOT NULL DEFAULT 0,
  diag_a         TEXT,

  -- Periode B
  tgl_mulai_b    DATE,
  tgl_selesai_b  DATE,
  hari_b         INTEGER NOT NULL DEFAULT 0,
  diag_b         TEXT,

  -- Periode C
  tgl_mulai_c    DATE,
  tgl_selesai_c  DATE,
  hari_c         INTEGER NOT NULL DEFAULT 0,
  diag_c         TEXT,

  jumlah_spell  INTEGER NOT NULL DEFAULT 0,
  is_pak         BOOLEAN NOT NULL DEFAULT FALSE,

  bulan          INTEGER,
  tahun          INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_se_jobsite      ON sick_employees(jobsite);
CREATE INDEX idx_se_tgl_a        ON sick_employees(tgl_mulai_a);
CREATE INDEX idx_se_bulan_tahun  ON sick_employees(bulan, tahun);
CREATE INDEX idx_se_nama         ON sick_employees(nama);

ALTER TABLE sick_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "se_public_read" ON sick_employees FOR SELECT USING (true);
CREATE POLICY "se_auth_all"     ON sick_employees FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION se_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_se_touch_updated_at
  BEFORE UPDATE ON sick_employees
  FOR EACH ROW EXECUTE FUNCTION se_touch_updated_at();

COMMENT ON TABLE  sick_employees IS 'Data Karyawan Sakit - sick employee list';
COMMENT ON COLUMN sick_employees.diag_a  IS 'Diagnosa periode A (not in Excel, used for Spell auto-calculation)';
COMMENT ON COLUMN sick_employees.is_pak  IS 'Whether this absence is classified as Penyakit Akibat Kerja';
COMMENT ON COLUMN sick_employees.bulan  IS 'Bulan index 1-12 used for dashboard filtering (period 21st-20th)';


-- ════════════════════════════════════════════════════════════════════
-- View: v_health_all_site
-- Aggregates per-site rows into an "All Site" rollup.
-- Leading = SUM, Lagging = recomputed from aggregated leading.
-- Mirrors what the GAS reads from the "All Site" Excel sheet.
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_health_all_site AS
SELECT
  tahun,
  bulan,
  'All Site'::TEXT AS jobsite,

  SUM(man_power)              AS man_power,
  SUM(man_hours)              AS man_hours,
  SUM(kunjungan_klinik)       AS kunjungan_klinik,
  SUM(tk_sakit)               AS tk_sakit,
  SUM(absensi_sakit)          AS absensi_sakit,
  SUM(spell)                  AS spell,
  SUM(penyakit_akibat_kerja)  AS penyakit_akibat_kerja,
  SUM(kejadian_penyakit_tk)   AS kejadian_penyakit_tk,
  SUM(layak_bekerja)          AS layak_bekerja,

  CASE WHEN SUM(man_power) > 0
       THEN SUM(layak_bekerja)::NUMERIC / SUM(man_power) ELSE 0 END AS rkk,
  CASE WHEN SUM(man_power) > 0
       THEN SUM(tk_sakit)::NUMERIC / SUM(man_power) ELSE 0 END AS cmr,
  CASE WHEN SUM(man_hours) > 0
       THEN (SUM(tk_sakit)::NUMERIC * 1000000) / SUM(man_hours) ELSE 0 END AS mfr,
  CASE WHEN SUM(tk_sakit) > 0
       THEN SUM(absensi_sakit)::NUMERIC / SUM(tk_sakit) ELSE 0 END AS ssr,
  CASE WHEN SUM(man_hours) > 0
       THEN (SUM(absensi_sakit)::NUMERIC * 1000000) / SUM(man_hours) ELSE 0 END AS asr,
  CASE WHEN SUM(man_power) > 0
       THEN SUM(penyakit_akibat_kerja)::NUMERIC / SUM(man_power) ELSE 0 END AS fr_pak,
  SUM(kaptk) AS kaptk
FROM health_indicators
WHERE jobsite <> 'All Site'
GROUP BY tahun, bulan;


-- ════════════════════════════════════════════════════════════════════
-- View: v_health_ytd_per_site
-- YTD totals per site per year (12 months → 1 row). Mirrors Excel col P.
-- Counts: SUM. Lagging ratios/rates: AVG over months with data.
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_health_ytd_per_site AS
SELECT
  tahun,
  jobsite,
  SUM(man_power)              AS man_power_ytd,
  SUM(man_hours)              AS man_hours_ytd,
  SUM(kunjungan_klinik)       AS kunjungan_klinik_ytd,
  SUM(tk_sakit)               AS tk_sakit_ytd,
  SUM(absensi_sakit)          AS absensi_sakit_ytd,
  SUM(spell)                  AS spell_ytd,
  SUM(penyakit_akibat_kerja)  AS penyakit_akibat_kerja_ytd,
  SUM(kejadian_penyakit_tk)   AS kejadian_penyakit_tk_ytd,
  SUM(layak_bekerja)          AS layak_bekerja_ytd,
  AVG(rkk)    FILTER (WHERE man_power > 0)  AS rkk_ytd,
  AVG(cmr)    FILTER (WHERE man_power > 0)  AS cmr_ytd,
  AVG(mfr)    FILTER (WHERE man_hours > 0)  AS mfr_ytd,
  AVG(ssr)    FILTER (WHERE tk_sakit > 0)   AS ssr_ytd,
  AVG(asr)    FILTER (WHERE man_hours > 0)  AS asr_ytd,
  AVG(fr_pak) FILTER (WHERE man_power > 0)  AS fr_pak_ytd,
  SUM(kaptk)  AS kaptk_ytd
FROM health_indicators
GROUP BY tahun, jobsite;


-- ════════════════════════════════════════════════════════════════════
-- View: v_top_asr_sites
-- Jobsites with ASR > 0, used by the ASR ranking chart.
-- Final ORDER BY + LIMIT 10 applied in the API route.
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_top_asr_sites AS
SELECT tahun, bulan, jobsite, asr, man_power, man_hours
FROM health_indicators
WHERE jobsite <> 'All Site'
  AND asr > 0;

COMMIT;
