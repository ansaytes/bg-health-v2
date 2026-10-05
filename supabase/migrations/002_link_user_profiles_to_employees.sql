-- Link application users to the active employee master data.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS employee_nik_hash text,
  ADD COLUMN IF NOT EXISTS site text;

CREATE INDEX IF NOT EXISTS user_profiles_employee_nik_hash_idx
  ON public.user_profiles(employee_nik_hash);

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('superuser', 'administrator', 'pic', 'viewer'));
