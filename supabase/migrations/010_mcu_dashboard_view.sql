ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS nik_hash TEXT,
  ADD COLUMN IF NOT EXISTS national_id_hash TEXT,
  ADD COLUMN IF NOT EXISTS client TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS employees_nik_hash_uidx
  ON public.employees(nik_hash);

CREATE INDEX IF NOT EXISTS employees_national_id_hash_idx
  ON public.employees(national_id_hash)
  WHERE national_id_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS employees_client_site_idx
  ON public.employees(client, site_name);

DROP VIEW IF EXISTS public.monitor_mcu;

CREATE VIEW public.monitor_mcu AS
WITH manpower AS (
  SELECT
    e.id AS employee_id,
    e.nik,
    e.nik_hash,
    e.national_id_hash,
    e.nama,
    e.gender AS jenis_kelamin,
    e.age AS usia,
    e.job_position AS jabatan,
    e.site_name AS site,
    e.area AS area_raw,
    e.client,
    lower(coalesce(e.job_position, '')) ~
      '(wakar|cook|masak|juru masak|clean|cleaning|cs|security|sec)' AS exempt
  FROM public.employees e
  WHERE lower(coalesce(e.division, '')) = 'mining'
    AND lower(coalesce(e.employment_status, '')) = 'aktif'
    AND lower(coalesce(e.employee_status, '')) IN ('pkwt', 'permanen')
    AND e.site_name IS NOT NULL
),
ranked_records AS (
  SELECT
    e.employee_id,
    r.id AS record_id,
    r.nik_karyawan,
    r.nik_karyawan_hash,
    r.national_id_hash,
    r.status_mcu,
    r.tgl_mcu,
    r.tgl_expired,
    r.kes_vendor,
    r.perlu_fu,
    r.rek_fu,
    r.item_fu,
    r.diagnosa_medis,
    r.fram_score,
    r.fram_prob,
    r.fram_kat,
    r.zonasi,
    r.kesimpulan_fu1,
    r.kesimpulan_fu2,
    r.kesimpulan_fu3,
    r.tgl_fu1,
    r.tgl_fu2,
    r.tgl_fu3,
    r.created_at,
    row_number() OVER (
      PARTITION BY e.employee_id
      ORDER BY r.tgl_mcu DESC NULLS LAST, r.created_at DESC NULLS LAST
    ) AS record_rank
  FROM manpower e
  LEFT JOIN public.mcu_records r
    ON (
      (e.nik_hash IS NOT NULL AND r.nik_karyawan_hash = e.nik_hash)
      OR (e.national_id_hash IS NOT NULL AND r.national_id_hash = e.national_id_hash)
    )
   AND (lower(coalesce(r.status_mcu, '')) LIKE '%pre%'
     OR lower(coalesce(r.status_mcu, '')) LIKE '%ann%')
),
record_history AS (
  SELECT
    employee_id,
    count(record_id)::INTEGER AS total_mcu,
    count(record_id) FILTER (
      WHERE extract(year FROM tgl_mcu) = 2024
        AND (status_mcu ILIKE '%pre%' OR status_mcu ILIKE '%ann%')
    )::INTEGER AS mcu_2024_count,
    count(record_id) FILTER (
      WHERE extract(year FROM tgl_mcu) = 2025
        AND (status_mcu ILIKE '%pre%' OR status_mcu ILIKE '%ann%')
    )::INTEGER AS mcu_2025_count,
    count(record_id) FILTER (
      WHERE extract(year FROM tgl_mcu) = 2026
        AND (status_mcu ILIKE '%pre%' OR status_mcu ILIKE '%ann%')
    )::INTEGER AS mcu_2026_count,
    max(tgl_mcu) FILTER (WHERE extract(year FROM tgl_mcu) = 2024) AS mcu_2024,
    max(tgl_mcu) FILTER (WHERE extract(year FROM tgl_mcu) = 2025) AS mcu_2025,
    max(tgl_mcu) FILTER (WHERE extract(year FROM tgl_mcu) = 2026) AS mcu_2026
  FROM ranked_records
  GROUP BY employee_id
)
SELECT
  e.employee_id,
  coalesce(l.nik_karyawan, e.nik) AS nik_karyawan,
  e.nama,
  e.jenis_kelamin,
  e.usia,
  e.jabatan,
  e.site,
  e.area_raw,
  e.client,
  e.exempt,
  h.total_mcu,
  h.mcu_2024_count,
  h.mcu_2025_count,
  h.mcu_2026_count,
  h.mcu_2024,
  h.mcu_2025,
  h.mcu_2026,
  l.tgl_mcu AS mcu_terakhir,
  l.status_mcu AS kategori_mcu_terakhir,
  l.kes_vendor AS hasil_mcu,
  l.perlu_fu,
  l.rek_fu AS rekomendasi_fu,
  l.item_fu,
  l.diagnosa_medis AS diagnosa,
  l.fram_score,
  l.fram_prob,
  l.fram_kat AS frs_kategori,
  l.zonasi AS zona_risiko,
  coalesce(l.tgl_expired, l.tgl_mcu + INTERVAL '1 year')::DATE AS masa_berlaku_mcu,
  CASE
    WHEN e.exempt THEN 'Exempt'
    WHEN l.tgl_mcu IS NULL THEN 'No Data'
    WHEN coalesce(l.tgl_expired, l.tgl_mcu + INTERVAL '1 year')::DATE < CURRENT_DATE THEN 'Expired'
    ELSE 'Valid'
  END AS status_mcu,
  CASE
    WHEN e.exempt THEN 'Exempt'
    WHEN l.record_id IS NULL OR nullif(trim(l.kes_vendor), '') IS NULL THEN 'Belum Review'
    WHEN lower(coalesce(l.perlu_fu, '')) IN ('tidak', 'no', 'false') THEN 'Tidak Perlu FU'
    WHEN lower(coalesce(
      nullif(trim(l.kesimpulan_fu3), ''),
      nullif(trim(l.kesimpulan_fu2), ''),
      nullif(trim(l.kesimpulan_fu1), ''),
      ''
    ))
      IN ('fit to work', 'unfit') THEN 'Selesai FU'
    WHEN lower(coalesce(l.perlu_fu, '')) IN ('ya', 'yes', 'true') THEN 'Perlu FU'
    WHEN l.tgl_fu1 IS NOT NULL OR l.tgl_fu2 IS NOT NULL OR l.tgl_fu3 IS NOT NULL THEN 'Selesai FU'
    ELSE 'Belum Review'
  END AS status_follow_up,
  s.tanggal_jadwal AS jadwal_mcu_selanjutnya
FROM manpower e
JOIN record_history h ON h.employee_id = e.employee_id
LEFT JOIN ranked_records l ON l.employee_id = e.employee_id AND l.record_rank = 1
LEFT JOIN public.mcu_schedules s ON s.nik_karyawan_hash = e.nik_hash;

COMMENT ON VIEW public.monitor_mcu IS
  'Satu baris per karyawan aktif Mining; gabungan manpower, seluruh histori mcu_records, dan jadwal untuk dashboard MCU.';

REVOKE ALL ON public.monitor_mcu FROM anon, authenticated;
GRANT SELECT ON public.monitor_mcu TO service_role;