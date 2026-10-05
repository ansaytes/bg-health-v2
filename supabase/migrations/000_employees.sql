-- Base employee directory schema. Employee identities are encrypted by the
-- sync process; hash columns and their indexes are added by later migrations.
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nik text NOT NULL,
  nama text NOT NULL,
  gender text,
  department text,
  division text,
  job_position text,
  level_golongan text,
  tanggal_pkwt date,
  masa_kerja text,
  employee_status text,
  employment_status text,
  tanggal_resign date,
  national_id text,
  phone_number text,
  place_of_birth text,
  birth_date date,
  age integer,
  last_education text,
  place_of_hire text,
  site_name text,
  client text,
  address text,
  religion text,
  area text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS employees_site_name_idx
  ON public.employees (site_name);
CREATE INDEX IF NOT EXISTS employees_employment_status_idx
  ON public.employees (employment_status);
CREATE INDEX IF NOT EXISTS employees_department_idx
  ON public.employees (department);
