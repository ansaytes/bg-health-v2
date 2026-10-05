ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS site TEXT;

CREATE TABLE IF NOT EXISTS public.mcu_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nik_karyawan TEXT NOT NULL,
  nik_karyawan_hash TEXT NOT NULL,
  national_id TEXT,
  national_id_hash TEXT,
  nama TEXT NOT NULL,
  jenis_kelamin TEXT,
  usia NUMERIC,
  jabatan TEXT,
  site TEXT NOT NULL,
  tanggal_jadwal DATE NOT NULL,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (nik_karyawan_hash)
);

CREATE TABLE IF NOT EXISTS public.mcu_schedule_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.mcu_schedules(id) ON DELETE CASCADE,
  changed_by UUID,
  old_date DATE,
  new_date DATE NOT NULL,
  note TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS mcu_schedules_site_idx ON public.mcu_schedules(site);
CREATE INDEX IF NOT EXISTS mcu_schedule_history_schedule_idx ON public.mcu_schedule_history(schedule_id, changed_at DESC);

DROP VIEW IF EXISTS public.monitor_mcu;
CREATE VIEW public.monitor_mcu AS
WITH ranked AS (
  SELECT m.*,
    row_number() OVER (
      PARTITION BY coalesce(m.nik_karyawan_hash, m.national_id_hash)
      ORDER BY m.tgl_mcu DESC NULLS LAST, m.created_at DESC
    ) AS rn,
    count(*) OVER (PARTITION BY coalesce(m.nik_karyawan_hash, m.national_id_hash)) AS total_mcu
  FROM public.mcu_records m
  WHERE extract(year FROM m.tgl_mcu) = 2026
)
SELECT
  row_number() OVER (ORDER BY r.site, r.nama) AS no,
  r.nik_karyawan AS nik,
  r.national_id AS id_ktp,
  r.nama,
  r.jenis_kelamin,
  r.usia,
  r.jabatan,
  NULL::TEXT AS "user",
  r.site,
  NULL::TEXT AS area,
  NULL::TEXT AS masa_kerja,
  r.total_mcu,
  NULL::DATE AS mcu_2024,
  NULL::DATE AS mcu_2025,
  r.tgl_mcu AS mcu_2026,
  NULL::DATE AS pre_employee,
  NULL::DATE AS annual,
  r.tgl_mcu AS mcu_terakhir,
  r.status_mcu AS kategori_mcu_terakhir,
  r.kes_vendor AS kesimpulan_mcu,
  CASE WHEN r.perlu_fu IN ('Ya', 'ya', 'YES', 'yes', 'true') THEN 'Perlu Follow Up' ELSE 'Selesai' END AS status_follow_up_terakhir,
  r.kesimpulan_fu3 AS kesimpulan_fu_terakhir,
  r.tgl_expired AS masa_berlaku_mcu,
  r.zonasi AS kategori,
  s.tanggal_jadwal AS jadwal_mcu_selanjutnya,
  CASE
    WHEN lower(coalesce(r.jabatan, '')) ~
      '(wakar|cook|masak|juru masak|clean|cleaning|cs|security|sec)'
      THEN 'Tidak Perlu Mine Permit'
    WHEN r.tgl_mcu IS NULL AND s.tanggal_jadwal IS NULL
      THEN 'MCU Tidak Ditemukan, Belum Dijadwalkan MCU'
    WHEN r.tgl_mcu IS NULL AND s.tanggal_jadwal >= CURRENT_DATE
      THEN 'MCU Tidak Ditemukan, Dijadwalkan MCU '
        || (s.tanggal_jadwal - CURRENT_DATE) || ' Hari Lagi'
    WHEN r.tgl_mcu IS NULL
      THEN 'MCU Tidak Ditemukan, Jadwal MCU Terlewat '
        || abs(s.tanggal_jadwal - CURRENT_DATE) || ' Hari'
    WHEN s.tanggal_jadwal IS NULL
      AND coalesce(r.tgl_expired, r.tgl_mcu + INTERVAL '1 year')::DATE >= CURRENT_DATE
      THEN 'MCU Valid, Belum Dijadwalkan MCU Ulang'
    WHEN s.tanggal_jadwal IS NULL
      THEN 'MCU Expired, Belum Dijadwalkan MCU Ulang'
    WHEN coalesce(r.tgl_expired, r.tgl_mcu + INTERVAL '1 year')::DATE >= CURRENT_DATE
      AND s.tanggal_jadwal >= CURRENT_DATE
      THEN 'MCU Valid, Dijadwalkan ' || (s.tanggal_jadwal - CURRENT_DATE) || ' Hari Lagi'
    WHEN coalesce(r.tgl_expired, r.tgl_mcu + INTERVAL '1 year')::DATE >= CURRENT_DATE
      AND (s.tanggal_jadwal - r.tgl_mcu) < 0
      THEN 'MCU Valid, Pelaksanaan Terlambat '
        || abs(s.tanggal_jadwal - r.tgl_mcu) || ' Hari'
    WHEN coalesce(r.tgl_expired, r.tgl_mcu + INTERVAL '1 year')::DATE >= CURRENT_DATE
      AND (s.tanggal_jadwal - r.tgl_mcu) > 0
      AND (coalesce(r.tgl_expired, r.tgl_mcu + INTERVAL '1 year')::DATE - CURRENT_DATE) >= 100
      THEN 'MCU Valid, Pelaksanaan ' || (s.tanggal_jadwal - r.tgl_mcu) || ' Hari Lebih Cepat'
    WHEN coalesce(r.tgl_expired, r.tgl_mcu + INTERVAL '1 year')::DATE >= CURRENT_DATE
      AND (s.tanggal_jadwal - r.tgl_mcu) = 0
      THEN 'MCU Valid, Pelaksanaan Tepat Waktu'
    WHEN coalesce(r.tgl_expired, r.tgl_mcu + INTERVAL '1 year')::DATE >= CURRENT_DATE
      THEN 'MCU Valid, Jadwal Terlewat ' || abs(s.tanggal_jadwal - CURRENT_DATE) || ' Hari'
    WHEN s.tanggal_jadwal >= CURRENT_DATE
      THEN 'MCU Expired, Dijadwalkan ' || (s.tanggal_jadwal - CURRENT_DATE) || ' Hari Lagi'
    ELSE 'MCU Expired, Jadwal Terlewat ' || abs(s.tanggal_jadwal - CURRENT_DATE) || ' Hari'
  END AS notifikasi_jadwal,
  r.zonasi AS kategori_zona_status_kesehatan,
  r.catatan AS catatan,
  r.diagnosa_medis AS diagnosa,
  r.fram_prob AS frs
FROM ranked r
LEFT JOIN public.mcu_schedules s ON s.nik_karyawan_hash = r.nik_karyawan_hash
WHERE r.rn = 1;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check CHECK (role IN ('superuser', 'administrator', 'pic', 'viewer'));
