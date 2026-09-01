DROP TABLE IF EXISTS lagging_indicators CASCADE;
DROP TABLE IF EXISTS health_indicators CASCADE;
DROP TABLE IF EXISTS health_statistics_sites CASCADE;
DROP TABLE IF EXISTS health_statistics CASCADE;
DROP VIEW IF EXISTS v_kpi_all_site CASCADE;
DROP VIEW IF EXISTS v_kpi_per_site CASCADE;
DROP VIEW IF EXISTS v_top_asr CASCADE;

CREATE TABLE health_indicators (
  id            BIGSERIAL PRIMARY KEY,
  tahun         INTEGER NOT NULL,
  bulan         INTEGER NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  jobsite       TEXT NOT NULL DEFAULT 'All Site',
  man_power             NUMERIC DEFAULT 0,
  man_hours             NUMERIC DEFAULT 0,
  kunjungan_klinik      NUMERIC DEFAULT 0,
  tk_sakit              NUMERIC DEFAULT 0,
  absensi_sakit         NUMERIC DEFAULT 0,
  spell                 NUMERIC DEFAULT 0,
  penyakit_akibat_kerja NUMERIC DEFAULT 0,
  kejadian_penyakit_tk  NUMERIC DEFAULT 0,
  layak_bekerja         NUMERIC DEFAULT 0,
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

CREATE INDEX idx_hi_tahun_bulan ON health_indicators(tahun, bulan);
CREATE INDEX idx_hi_jobsite ON health_indicators(jobsite);
CREATE INDEX idx_hi_asr ON health_indicators(tahun, bulan, asr) WHERE asr > 0;

ALTER TABLE health_indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hi_public_read" ON health_indicators FOR SELECT USING (true);
CREATE POLICY "hi_auth_all" ON health_indicators FOR ALL USING (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION hi_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_hi_updated_at
  BEFORE UPDATE ON health_indicators
  FOR EACH ROW EXECUTE FUNCTION hi_updated_at();

COMMENT ON TABLE health_indicators IS 'Leading + Lagging health indicators per site per bulan';
COMMENT ON COLUMN health_indicators.jobsite IS 'Nama jobsite, All Site = aggregate seluruh site';
COMMENT ON COLUMN health_indicators.rkk IS 'Rasio Kelayakan Kerja = layak_bekerja / man_power';
COMMENT ON COLUMN health_indicators.cmr IS 'Case Mortality Rate x 1000';
COMMENT ON COLUMN health_indicators.mfr IS 'Manhour Fatality Rate';
COMMENT ON COLUMN health_indicators.ssr IS 'Sick Shift Rate';
COMMENT ON COLUMN health_indicators.asr IS 'Absence Severity Rate';
COMMENT ON COLUMN health_indicators.fr_pak IS 'Frequency Rate Penyakit Akibat Kerja';
COMMENT ON COLUMN health_indicators.kaptk IS 'Kejadian Akibat Penyakit Tenaga Kerja';
