-- ═══════════════════════════════════════════════════════════════════
-- LAGGING INDICATORS TABLE
-- Structure matches the Excel spreadsheet: each row = 1 indicator per site per year
-- Columns: site, tahun, indicator_type, indicator_name, jan..dec, ytd
-- ═══════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS lagging_indicators CASCADE;

CREATE TABLE lagging_indicators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tahun INTEGER NOT NULL,
  site TEXT NOT NULL,
  indicator_type TEXT NOT NULL CHECK (indicator_type IN ('leading', 'lagging')),
  indicator_name TEXT NOT NULL,
  jan DOUBLE PRECISION DEFAULT 0,
  feb DOUBLE PRECISION DEFAULT 0,
  mar DOUBLE PRECISION DEFAULT 0,
  apr DOUBLE PRECISION DEFAULT 0,
  may DOUBLE PRECISION DEFAULT 0,
  jun DOUBLE PRECISION DEFAULT 0,
  jul DOUBLE PRECISION DEFAULT 0,
  aug DOUBLE PRECISION DEFAULT 0,
  sep DOUBLE PRECISION DEFAULT 0,
  oct DOUBLE PRECISION DEFAULT 0,
  nov DOUBLE PRECISION DEFAULT 0,
  dec DOUBLE PRECISION DEFAULT 0,
  ytd DOUBLE PRECISION DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tahun, site, indicator_type, indicator_name)
);

-- RLS
ALTER TABLE lagging_indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON lagging_indicators FOR SELECT USING (true);
CREATE POLICY "Allow authenticated full" ON lagging_indicators FOR ALL USING (auth.role() = 'authenticated');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_lagging_indicators_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lagging_indicators_updated_at
  BEFORE UPDATE ON lagging_indicators
  FOR EACH ROW EXECUTE FUNCTION update_lagging_indicators_updated_at();

-- Indexes
CREATE INDEX idx_lagging_indicators_site ON lagging_indicators(site);
CREATE INDEX idx_lagging_indicators_tahun ON lagging_indicators(tahun);
CREATE INDEX idx_lagging_indicators_type ON lagging_indicators(indicator_type);
CREATE INDEX idx_lagging_indicators_unique ON lagging_indicators(tahun, site, indicator_type, indicator_name);

COMMENT ON TABLE lagging_indicators IS 'Lagging & Leading indicators per site per year dari spreadsheet Excel';
COMMENT ON COLUMN lagging_indicators.indicator_type IS 'leading atau lagging';
COMMENT ON COLUMN lagging_indicators.indicator_name IS 'Nama indikator: Man Power, RKK, CMR, MFR, SSR, ASR, FR PAK, KAPTK, dll';
COMMENT ON COLUMN lagging_indicators.ytd IS 'Year-to-date / Total (untuk leading)';
