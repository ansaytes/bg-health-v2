-- =====================================================================
-- BG-HEALTH v2 : MODUL HEARING CONSERVATION (HC) + ERGONOMI
-- Target  : Supabase (PostgreSQL 15+). Jalankan di SQL Editor.
-- Sumber  : BG/QSHE/STD/033, INK/015, STD/036, INK/013, FORM/116-118, SOP/028
-- Aman dijalankan ulang. TIDAK mengubah tabel yang sudah ada (mcu_records dll).
--
-- Prinsip:
--  * Audiometri per frekuensi TIDAK diduplikasi: dibaca dari mcu_records
--    (kolom acr_500..acl_8k). Modul ini hanya menyimpan baseline & kasus STS.
--  * Identitas karyawan mengikuti pola mcu_records: nik_hash (HMAC) untuk
--    pencarian, nik/nama terenkripsi (AES-256-GCM dari lib/encryption.ts).
--  * RLS aktif tanpa policy: hanya service role (API route) yang bisa akses.
-- =====================================================================

-- 1. HC: MASTER AREA KERJA --------------------------------------------
create table if not exists hc_area (
  id             uuid primary key default gen_random_uuid(),
  site           text not null,                    -- nama jobsite / 'Head Office'
  nama_area      text not null,
  sumber_bising  text,
  aktif          boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (site, nama_area)
);

-- 2. HC: NOISE MAPPING (INK/015 6.1-6.2; STD/033 6.2, 6.6) -------------
create table if not exists hc_noise_survey (
  id                       uuid primary key default gen_random_uuid(),
  area_id                  uuid not null references hc_area(id) on delete restrict,
  tanggal                  date not null,
  tipe                     text not null default 'BERKALA' check (tipe in ('BERKALA','PERUBAHAN_PROSES')),
  petugas                  text not null,
  slm_merk_tipe            text,
  slm_serial               text,
  slm_kelas                smallint not null default 2 check (slm_kelas in (1,2)),
  sertifikat_kalibrasi_sd  date,
  kalibrasi_sebelum_db     numeric(4,1),
  kalibrasi_sesudah_db     numeric(4,1),
  rambu_terpasang          boolean not null default false,
  apt_tersedia             boolean not null default false,
  apt_nrr_tersedia         smallint,
  catatan                  text,
  status                   text not null default 'FINAL' check (status in ('DRAFT','FINAL')),
  created_by               text,
  created_at               timestamptz not null default now()
);
create index if not exists ix_hc_ns_area_tgl on hc_noise_survey (area_id, tanggal desc);

create table if not exists hc_noise_point (
  id            uuid primary key default gen_random_uuid(),
  survey_id     uuid not null references hc_noise_survey(id) on delete cascade,
  kode_titik    text not null,
  deskripsi     text,
  leq_dba       numeric(5,1) not null check (leq_dba between 30 and 140),
  durasi_menit  smallint not null check (durasi_menit >= 5),     -- INK/015: min 5-10 menit/titik
  -- STD/033 6.2: Hijau <82 | Kuning 82-85 | Merah >85 dB(A)
  zona          text generated always as (
                  case when leq_dba < 82 then 'HIJAU' when leq_dba <= 85 then 'KUNING' else 'MERAH' end
                ) stored,
  unique (survey_id, kode_titik)
);

-- 3. HC: KLASIFIKASI KARYAWAN TERPAJAN (STD/033 6.3) -------------------
--    A = rutin >= 4 jam/hari di zona Kuning/Merah | B = insidental | C = tidak terpajan
create table if not exists hc_exposure_class (
  id                 uuid primary key default gen_random_uuid(),
  nik_hash           text not null,                 -- HMAC NIK Karyawan (sama dgn mcu_records.nik_karyawan_hash)
  national_id_hash   text,                          -- HMAC NIK KTP (untuk MCU lama yang bercampur)
  nik_enc            text,
  nama_enc           text,
  site               text,
  departemen         text,
  jabatan            text,
  area_id            uuid references hc_area(id) on delete set null,
  kategori           text not null check (kategori in ('A','B','C')),
  jam_per_hari_zona  numeric(3,1),
  tanggal_penetapan  date not null,
  catatan            text,
  created_by         text,
  created_at         timestamptz not null default now(),
  unique (nik_hash, tanggal_penetapan),
  constraint ck_hc_ec_jam check (kategori <> 'A' or coalesce(jam_per_hari_zona, 0) >= 4)
);
create index if not exists ix_hc_ec_kategori on hc_exposure_class (kategori);

-- 4. HC: BASELINE AUDIOMETRI (menunjuk salah satu baris mcu_records) ---
create table if not exists hc_baseline (
  nik_hash       text primary key,
  mcu_record_id  text not null,                     -- = mcu_records.id (disimpan sebagai teks agar tipe PK apa pun aman)
  tanggal        date,
  catatan        text,
  created_by     text,
  created_at     timestamptz not null default now()
);

-- 5. HC: KASUS STS & TINDAK LANJUT (INK/015 6.4 butir 8-10, 6.5; SOP/028) --
create table if not exists hc_sts_case (
  id                           uuid primary key default gen_random_uuid(),
  nik_hash                     text not null,
  nik_enc                      text,
  nama_enc                     text,
  site                         text,
  mcu_record_id                text not null unique,     -- audiometri berkala yang menunjukkan STS
  tanggal_deteksi              date not null,
  telinga                      text not null check (telinga in ('KANAN','KIRI','KEDUA')),
  geser_kanan                  numeric(5,1),
  geser_kiri                   numeric(5,1),
  berbasis_estimasi            boolean not null default false,
  status                       text not null default 'SUSPEK'
                               check (status in ('SUSPEK','RETEST_DIJADWALKAN','TERKONFIRMASI','TIDAK_TERKONFIRMASI')),
  retest_deadline              date generated always as (tanggal_deteksi + 30) stored,   -- maks 30 hari
  retest_mcu_record_id         text,
  riwayat_non_okupasi          text,
  dilaporkan_qshe_manager_tgl  date,
  rujuk_tht                    boolean not null default false,
  rujuk_tht_tgl                date,
  kajian_pak                   text not null default 'BELUM' check (kajian_pak in ('BELUM','DALAM_KAJIAN','PAK','BUKAN_PAK')),
  dilaporkan_disnaker_tgl      date,
  catatan                      text,
  created_by                   text,
  created_at                   timestamptz not null default now()
);
create index if not exists ix_hc_sts_status on hc_sts_case (status);

-- 6. ERGONOMI: SURVEI (STD/036 6.6-6.10; INK/013; FORM/116-118) -------
create table if not exists ergo_survey (
  id                        uuid primary key default gen_random_uuid(),
  metode                    text not null check (metode in ('RULA','ROSA','WERA')),
  sumber                    text not null default 'INTERNAL' check (sumber in ('INTERNAL','PIHAK_KETIGA')),
  site                      text not null,
  area_kerja                text not null,
  tanggal                   date not null,
  departemen                text not null,
  aktivitas                 text not null,           -- ROSA: pekerjaan/jabatan yang dinilai
  personil_pengukur         text not null,
  kualifikasi_pengukur      text not null,
  pekerja_diamati           text not null,
  foto_url                  text,
  -- 4 syarat keabsahan hasil (STD/036 pasal 6.10)
  ok_personil_kompeten      boolean not null default false,   -- pasal 6.8
  ok_metode_sesuai          boolean not null default false,   -- pasal 6.6
  ok_kondisi_representatif  boolean not null default false,   -- pasal 6.7
  ok_dokumentasi_lengkap    boolean not null default false,   -- pasal 6.9
  sah                       boolean generated always as (
                              ok_personil_kompeten and ok_metode_sesuai and ok_kondisi_representatif and ok_dokumentasi_lengkap
                            ) stored,
  input                     jsonb not null,           -- nilai input per segmen/komponen
  hasil                     jsonb not null,           -- skor antara dihitung server (lib/hc-ergo.ts)
  skor_akhir                smallint not null,
  klasifikasi               text not null check (klasifikasi in ('RENDAH','SEDANG','TINGGI','SANGAT_TINGGI')),
  perlu_pica                boolean not null,
  batas_tindak_hari_kerja   smallint,                 -- hanya RULA (FORM/116)
  status                    text not null default 'MENUNGGU_PERSETUJUAN'
                            check (status in ('DRAFT','MENUNGGU_PERSETUJUAN','DISETUJUI','DITOLAK_ULANG')),
  dibuat_oleh               text,
  disetujui_oleh            text,
  tgl_disetujui             date,
  pica_no                   text,
  created_at                timestamptz not null default now(),
  constraint ck_ergo_skor check (
    (metode = 'RULA' and skor_akhir between 1 and 7) or
    (metode = 'ROSA' and skor_akhir between 1 and 10) or
    (metode = 'WERA' and skor_akhir between 18 and 54)),
  constraint ck_ergo_approve check (status <> 'DISETUJUI' or sah)    -- hasil tidak sah wajib diulang
);
create index if not exists ix_ergo_site_tgl on ergo_survey (site, tanggal desc);
create index if not exists ix_ergo_metode on ergo_survey (metode);

create table if not exists ergo_recommendation (
  id               uuid primary key default gen_random_uuid(),
  survey_id        uuid not null references ergo_survey(id) on delete cascade,
  problem          text not null,
  tindakan         text not null,
  pic              text not null,
  due_date         date not null,
  status           text not null default 'OPEN' check (status in ('OPEN','PROGRESS','CLOSED')),
  pica_no          text,
  tgl_closed       date,
  batas_verifikasi date,                               -- maks 30 hari kerja sejak laporan disetujui
  verifikasi_tgl   date,
  verifikasi_ket   text,
  created_at       timestamptz not null default now()
);
create index if not exists ix_ergo_rec_status on ergo_recommendation (status, due_date);

-- 7. VIEW: zona terkini per area (titik TERTINGGI pada survei FINAL terbaru) --
--    Jatuh tempo: Kuning/Merah 6 bulan, Hijau 12 bulan (STD/033 6.6)
create or replace view v_hc_area_zona_terkini as
select a.id as area_id, a.site, a.nama_area, a.sumber_bising,
       s.id as survey_id, s.tanggal as tanggal_ukur, z.leq_max, z.zona,
       s.rambu_terpasang, s.apt_tersedia, s.apt_nrr_tersedia,
       case when s.id is null then null
            else (s.tanggal + case when z.zona = 'HIJAU' then interval '12 months' else interval '6 months' end)::date end as jatuh_tempo,
       case when s.id is null then true
            when (s.tanggal + case when z.zona = 'HIJAU' then interval '12 months' else interval '6 months' end)::date < current_date then true
            else false end as terlambat
from hc_area a
left join lateral (
  select x.* from hc_noise_survey x
  where x.area_id = a.id and x.status = 'FINAL'
  order by x.tanggal desc, x.created_at desc limit 1
) s on true
left join lateral (
  select max(p.leq_dba) as leq_max,
         case when max(p.leq_dba) < 82 then 'HIJAU' when max(p.leq_dba) <= 85 then 'KUNING' else 'MERAH' end as zona
  from hc_noise_point p where p.survey_id = s.id
) z on true
where a.aktif;

-- 8. KEAMANAN: RLS aktif tanpa policy + cabut akses anon/authenticated ---
alter table hc_area              enable row level security;
alter table hc_noise_survey      enable row level security;
alter table hc_noise_point       enable row level security;
alter table hc_exposure_class    enable row level security;
alter table hc_baseline          enable row level security;
alter table hc_sts_case          enable row level security;
alter table ergo_survey          enable row level security;
alter table ergo_recommendation  enable row level security;
alter view  v_hc_area_zona_terkini set (security_invoker = true);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on hc_area, hc_noise_survey, hc_noise_point, hc_exposure_class, hc_baseline,
                  hc_sts_case, ergo_survey, ergo_recommendation, v_hc_area_zona_terkini from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on hc_area, hc_noise_survey, hc_noise_point, hc_exposure_class, hc_baseline,
                  hc_sts_case, ergo_survey, ergo_recommendation, v_hc_area_zona_terkini from authenticated;
  end if;
end $$;
