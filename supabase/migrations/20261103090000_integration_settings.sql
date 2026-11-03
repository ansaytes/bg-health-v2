CREATE TABLE IF NOT EXISTS public.integration_settings (
  key TEXT PRIMARY KEY CHECK (key IN ('ai', 'google_drive')),
  config JSONB NOT NULL DEFAULT '{}'::JSONB,
  secret_ciphertext TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.integration_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_settings TO service_role;

ALTER TABLE public.kunjungan_berobat
  ADD COLUMN IF NOT EXISTS kategori TEXT;
