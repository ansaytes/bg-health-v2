-- BG-Health migration: manager role + pekerja_nik on ergo_survey
-- Jalankan di Supabase SQL Editor jika kolom/constraint belum ada.

-- 1) Kolom NIK pekerja yang diamati pada survei ergonomi
ALTER TABLE public.ergo_survey
  ADD COLUMN IF NOT EXISTS pekerja_nik text;

-- 2) Jika ada CHECK constraint pada user_profiles.role, perbarui agar mengizinkan 'manager'.
--    Nama constraint bisa berbeda; sesuaikan jika error.
DO $$
BEGIN
  -- Drop constraint lama yang membatasi role (jika ada)
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_profiles_role_check'
      AND conrelid = 'public.user_profiles'::regclass
  ) THEN
    ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_role_check;
  END IF;

  ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_role_check
    CHECK (role IN (
      'superuser',
      'administrator',
      'manager',
      'pic',
      'viewer',
      'employee'
    ));
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
  WHEN undefined_table THEN
    RAISE NOTICE 'Tabel user_profiles tidak ditemukan — lewati constraint role.';
END $$;

-- 3) Index opsional untuk filter status persetujuan
CREATE INDEX IF NOT EXISTS idx_ergo_survey_status ON public.ergo_survey (status);
CREATE INDEX IF NOT EXISTS idx_ergo_survey_pekerja_nik ON public.ergo_survey (pekerja_nik);
