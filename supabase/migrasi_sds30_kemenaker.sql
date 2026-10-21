-- =====================================================================
-- BG-HEALTH v2 : MIGRASI SDS ZUNG (20 item)  ->  SDS-30 KEMENAKER
-- Target  : Supabase (PostgreSQL 15+). Jalankan di SQL Editor.
-- Sifat   : Aman dijalankan ulang (idempotent). Tidak menyentuh SRQ-20,
--           DASS-21, ESS, maupun tabel lain.
--
-- LATAR BELAKANG
--   Tabel mcu_mental_health sebelumnya menampung kolom sds_1 .. sds_20
--   (Zung Self-Rating Depression Scale, indeks 20-80). Program diganti ke
--   SDS-30 sesuai Lampiran Permenaker No. 5 Tahun 2018 (K3 Lingkungan Kerja):
--   30 item skala 1-7, 6 indikator x 5 item, skor indikator 5-35.
--   Kategori derajat stres per indikator (halaman 207):
--     skor <= 9   ringan | skor 10-24 sedang | skor > 24 berat
--   Instrumen ini mengukur FAKTOR PSIKOLOGI KERJA, bukan depresi.
--
-- PENTING: jalankan SELURUH file ini sekaligus. Perintah pertama menghapus
--   tabel lama; bila ada pernyataan setelahnya yang gagal, transaksi akan
--   mengembalikan semuanya (ROLLBACK) dan data lama tetap utuh.
--
-- PERINGATAN: perintah ini MENGHAPUS seluruh isi mcu_mental_health.
--   Jalankan hanya bila konfirmasi bahwa belum ada data yang diisi.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Pengaman: batalkan bila tabel ternyata masih berisi data.
--    Hapus blok ini bila memang ingin mengosongkan data yang ada.
-- ---------------------------------------------------------------------
do $$
declare
  jumlah bigint;
begin
  select count(*) into jumlah from public.mcu_mental_health;
  if jumlah > 0 then
    raise exception
      'Dibatalkan: mcu_mental_health masih berisi % baris. Kosongkan dulu bila memang ingin migrasi.', jumlah;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Hapus tabel lama (kolomnya hanya cocok untuk SDS 20 item)
-- ---------------------------------------------------------------------
drop table if exists public.mcu_mental_health cascade;

-- ---------------------------------------------------------------------
-- 2. Bangun ulang tabel dengan struktur SDS-30
--    Kolom item mengikuti pola sds_1 ... sds_30 (hasil pemetaan id sds1..sds30).
-- ---------------------------------------------------------------------
create table public.mcu_mental_health (
  id                    uuid primary key default gen_random_uuid(),

  -- Identitas karyawan: pola sama dengan mcu_records dan mcu_ess
  nik_karyawan_hash     text not null,
  national_id_hash      text,
  nik_enc               text,
  nama_enc              text,
  site                  text,
  department            text,
  jabatan               text,

  tgl_pemeriksaan       date not null,

  -- ── SRQ-20 (20 item Ya/Tidak) ────────────────────────────────────
  srq_1  smallint check (srq_1  in (0, 1)),
  srq_2  smallint check (srq_2  in (0, 1)),
  srq_3  smallint check (srq_3  in (0, 1)),
  srq_4  smallint check (srq_4  in (0, 1)),
  srq_5  smallint check (srq_5  in (0, 1)),
  srq_6  smallint check (srq_6  in (0, 1)),
  srq_7  smallint check (srq_7  in (0, 1)),
  srq_8  smallint check (srq_8  in (0, 1)),
  srq_9  smallint check (srq_9  in (0, 1)),
  srq_10 smallint check (srq_10 in (0, 1)),
  srq_11 smallint check (srq_11 in (0, 1)),
  srq_12 smallint check (srq_12 in (0, 1)),
  srq_13 smallint check (srq_13 in (0, 1)),
  srq_14 smallint check (srq_14 in (0, 1)),
  srq_15 smallint check (srq_15 in (0, 1)),
  srq_16 smallint check (srq_16 in (0, 1)),
  srq_17 smallint check (srq_17 in (0, 1)),
  srq_18 smallint check (srq_18 in (0, 1)),
  srq_19 smallint check (srq_19 in (0, 1)),
  srq_20 smallint check (srq_20 in (0, 1)),
  skor_srq20            smallint check (skor_srq20 between 0 and 20),

  -- ── DASS-21 (21 item skala 0-3, tiga subskala) ───────────────────
  dass_1  smallint check (dass_1  between 0 and 3),
  dass_2  smallint check (dass_2  between 0 and 3),
  dass_3  smallint check (dass_3  between 0 and 3),
  dass_4  smallint check (dass_4  between 0 and 3),
  dass_5  smallint check (dass_5  between 0 and 3),
  dass_6  smallint check (dass_6  between 0 and 3),
  dass_7  smallint check (dass_7  between 0 and 3),
  dass_8  smallint check (dass_8  between 0 and 3),
  dass_9  smallint check (dass_9  between 0 and 3),
  dass_10 smallint check (dass_10 between 0 and 3),
  dass_11 smallint check (dass_11 between 0 and 3),
  dass_12 smallint check (dass_12 between 0 and 3),
  dass_13 smallint check (dass_13 between 0 and 3),
  dass_14 smallint check (dass_14 between 0 and 3),
  dass_15 smallint check (dass_15 between 0 and 3),
  dass_16 smallint check (dass_16 between 0 and 3),
  dass_17 smallint check (dass_17 between 0 and 3),
  dass_18 smallint check (dass_18 between 0 and 3),
  dass_19 smallint check (dass_19 between 0 and 3),
  dass_20 smallint check (dass_20 between 0 and 3),
  dass_21 smallint check (dass_21 between 0 and 3),
  dass_depresi          smallint,
  dass_ansietas         smallint,
  dass_stres            smallint,
  dass_tertinggi        text,

  -- ── SDS-30 (30 item skala 1-7; 6 indikator x 5 item, skor 5-35) ──
  sds_1  smallint check (sds_1  between 1 and 7),
  sds_2  smallint check (sds_2  between 1 and 7),
  sds_3  smallint check (sds_3  between 1 and 7),
  sds_4  smallint check (sds_4  between 1 and 7),
  sds_5  smallint check (sds_5  between 1 and 7),
  sds_6  smallint check (sds_6  between 1 and 7),
  sds_7  smallint check (sds_7  between 1 and 7),
  sds_8  smallint check (sds_8  between 1 and 7),
  sds_9  smallint check (sds_9  between 1 and 7),
  sds_10 smallint check (sds_10 between 1 and 7),
  sds_11 smallint check (sds_11 between 1 and 7),
  sds_12 smallint check (sds_12 between 1 and 7),
  sds_13 smallint check (sds_13 between 1 and 7),
  sds_14 smallint check (sds_14 between 1 and 7),
  sds_15 smallint check (sds_15 between 1 and 7),
  sds_16 smallint check (sds_16 between 1 and 7),
  sds_17 smallint check (sds_17 between 1 and 7),
  sds_18 smallint check (sds_18 between 1 and 7),
  sds_19 smallint check (sds_19 between 1 and 7),
  sds_20 smallint check (sds_20 between 1 and 7),
  sds_21 smallint check (sds_21 between 1 and 7),
  sds_22 smallint check (sds_22 between 1 and 7),
  sds_23 smallint check (sds_23 between 1 and 7),
  sds_24 smallint check (sds_24 between 1 and 7),
  sds_25 smallint check (sds_25 between 1 and 7),
  sds_26 smallint check (sds_26 between 1 and 7),
  sds_27 smallint check (sds_27 between 1 and 7),
  sds_28 smallint check (sds_28 between 1 and 7),
  sds_29 smallint check (sds_29 between 1 and 7),
  sds_30 smallint check (sds_30 between 1 and 7),

  -- Total 30 item (30-210). Bukan dasar kategori; penilaian resmi per indikator.
  -- Nama kolom dipertahankan agar view dan kode pembaca indeks_sds tidak berubah.
  indeks_sds            smallint check (indeks_sds between 30 and 210),

  -- ── Ringkasan & status ───────────────────────────────────────────
  psy_srq               boolean not null default false,
  psy_dass21            boolean not null default false,
  psy_sds               boolean not null default false,
  ringkasan_hasil       text,
  perlu_rujukan         boolean,
  catatan               text,
  created_by            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Satu responden satu baris per tanggal pemeriksaan (upsert kode memakai kunci ini)
  unique (nik_karyawan_hash, tgl_pemeriksaan)
);

-- ---------------------------------------------------------------------
-- 3. Indeks
-- ---------------------------------------------------------------------
create index if not exists ix_mcu_mh_tanggal   on public.mcu_mental_health (tgl_pemeriksaan desc);
create index if not exists ix_mcu_mh_site      on public.mcu_mental_health (site);
create index if not exists ix_mcu_mh_rujukan   on public.mcu_mental_health (perlu_rujukan) where perlu_rujukan;

-- ---------------------------------------------------------------------
-- 4. RLS: aktif tanpa policy → hanya service role (API route) yang akses
-- ---------------------------------------------------------------------
alter table public.mcu_mental_health enable row level security;

-- ---------------------------------------------------------------------
-- 5. updated_at otomatis
-- ---------------------------------------------------------------------
create or replace function public.mcu_mental_health_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_mcu_mh_touch on public.mcu_mental_health;
create trigger trg_mcu_mh_touch
  before update on public.mcu_mental_health
  for each row execute function public.mcu_mental_health_touch_updated_at();

-- ---------------------------------------------------------------------
-- 6. Komentar dokumentasi
-- ---------------------------------------------------------------------
comment on table public.mcu_mental_health is
  'Skrining kesehatan mental: SRQ-20, DASS-21, dan SDS-30 (Permenaker 5/2018).';
comment on column public.mcu_mental_health.sds_1 is
  'SDS-30 item 1..30, skala 1-7 (1=sangat tidak pernah, 7=selalu).';
comment on column public.mcu_mental_health.indeks_sds is
  'Total 30 item SDS-30: 30-210. Kategori dinilai per indikator: <=9 ringan, 10-24 sedang, >24 berat.';

commit;

-- =====================================================================
-- VERIFIKASI (jalankan terpisah setelah COMMIT)
-- =====================================================================
-- select count(*) as kolom_sds30
--   from information_schema.columns
--  where table_schema = 'public'
--    and table_name = 'mcu_mental_health'
--    and column_name like 'sds\_%';
-- -- harus 30
--
-- select column_name, data_type
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'mcu_mental_health'
--  order by ordinal_position;
