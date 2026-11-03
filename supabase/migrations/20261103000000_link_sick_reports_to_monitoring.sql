ALTER TABLE public.sakit_episode
  ADD COLUMN IF NOT EXISTS kunjungan_id TEXT,
  ADD COLUMN IF NOT EXISTS sick_employee_id TEXT;

ALTER TABLE public.sakit_rekomendasi
  DROP COLUMN IF EXISTS no_dokumen;

ALTER TABLE public.kunjungan_berobat
  ADD COLUMN IF NOT EXISTS izin_absen BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.sakit_episode
  DROP CONSTRAINT IF EXISTS sakit_episode_sumber_laporan_check;

ALTER TABLE public.sakit_episode
  ADD CONSTRAINT sakit_episode_sumber_laporan_check
  CHECK (sumber_laporan IN (
    'SKS',
    'SURAT_PERNYATAAN_MANDIRI',
    'RUMAH_SAKIT',
    'KECELAKAAN_KERJA',
    'KUNJUNGAN_KLINIK',
    'LAPORAN_SITE',
    'LAINNYA'
  ));

CREATE INDEX IF NOT EXISTS idx_sakit_episode_kunjungan
  ON public.sakit_episode(kunjungan_id)
  WHERE kunjungan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sakit_episode_sick_employee
  ON public.sakit_episode(sick_employee_id)
  WHERE sick_employee_id IS NOT NULL;
