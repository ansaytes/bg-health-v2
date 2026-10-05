-- Employee protected columns and MCU formula contract.
-- Apply this migration after backing up the existing employees table.
-- birth_date intentionally remains DATE for database age calculations and is
-- the only requested identity field not encrypted.

ALTER TABLE public.employees
  ALTER COLUMN nik TYPE TEXT,
  ALTER COLUMN national_id TYPE TEXT,
  ALTER COLUMN phone_number TYPE TEXT,
  ALTER COLUMN place_of_birth TYPE TEXT,
  ALTER COLUMN birth_date TYPE DATE USING NULLIF(birth_date::TEXT, '')::DATE,
  ALTER COLUMN address TYPE TEXT;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS nik_hash TEXT,
  ADD COLUMN IF NOT EXISTS national_id_hash TEXT;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_nik_hash_key UNIQUE (nik_hash);

CREATE INDEX IF NOT EXISTS employees_national_id_hash_idx
  ON public.employees (national_id_hash)
  WHERE national_id_hash IS NOT NULL;

COMMENT ON COLUMN public.employees.nik IS
  'AES-256-GCM ciphertext; lookup uses nik_hash';
COMMENT ON COLUMN public.employees.national_id IS
  'AES-256-GCM ciphertext; lookup uses national_id_hash';
COMMENT ON COLUMN public.employees.phone_number IS
  'AES-256-GCM ciphertext';
COMMENT ON COLUMN public.employees.place_of_birth IS
  'AES-256-GCM ciphertext';
COMMENT ON COLUMN public.employees.birth_date IS
  'Native DATE retained for age calculations; not encrypted by design.';
COMMENT ON COLUMN public.employees.address IS
  'AES-256-GCM ciphertext';

COMMENT ON TABLE public.mcu_records IS
  'MCU_FIELDS schema. Calculated fields are populated server-side by applyMCUCalculations before insert/update.';

COMMENT ON COLUMN public.mcu_records.bmi IS
  'Formula: BB / (TB/100)^2, rounded to 1 decimal.';
COMMENT ON COLUMN public.mcu_records.mchc IS
  'Formula: Hb / Hematokrit * 100, rounded to 1 decimal.';
COMMENT ON COLUMN public.mcu_records.fvc_pct IS
  'Formula: FVC ACT / FVC PRED * 100, rounded to 1 decimal.';
COMMENT ON COLUMN public.mcu_records.fev1_pct IS
  'Formula: FEV1 ACT / FEV1 PRED * 100, rounded to 1 decimal.';
COMMENT ON COLUMN public.mcu_records.fev1_fvc_act IS
  'Formula: FEV1 ACT / FVC ACT, rounded to 2 decimals.';
COMMENT ON COLUMN public.mcu_records.fev1_fvc_pct IS
  'Formula: FEV1/FVC ACT / FEV1/FVC PRED * 100, rounded to 1 decimal.';
COMMENT ON COLUMN public.mcu_records.diabetes IS
  'Formula: Ya when GDP >= 126, GD2PP >= 200, or HbA1c >= 6.5; otherwise Tidak.';
COMMENT ON COLUMN public.mcu_records.tgl_expired IS
  'Formula: EDATE(Tanggal MCU, 12 months).';
COMMENT ON COLUMN public.mcu_records.diagnosa_medis IS
  'Formula-driven clinical summary translated from RAW_DATA diagnostic formula DH.';
COMMENT ON COLUMN public.mcu_records.item_fu IS
  'Formula-driven follow-up item summary translated from RAW_DATA formula DK.';
