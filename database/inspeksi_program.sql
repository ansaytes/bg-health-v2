-- ============================================================
-- Program Inspeksi: rencana, PICA & checklist baru
-- ============================================================
-- Jalankan di Supabase → SQL Editor. Semua perintah idempoten
-- (if not exists / on conflict do nothing), sehingga aman diulang.
--
-- Isi:
--   1. inspeksi_jadwal  — rencana vs realisasi inspeksi (Fondasi A)
--   2. pica             — temuan yang harus ditutup (Fondasi B)
--   3. p3k_katalog / p3k_site          — Kotak P3K (Fondasi C)
--   4. ambulans_katalog / ambulans_site — Ambulans & tanggap darurat
--   5. ergonomi_sarana_katalog / ergonomi_sarana_site — Sarana ergonomi
--
-- Setelah selesai, muat ulang cache skema PostgREST:
notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 1. RENCANA & REALISASI INSPEKSI
-- ------------------------------------------------------------
-- Satu baris = satu kewajiban inspeksi untuk satu objek pada satu periode.
-- Hasil pemeriksaannya TIDAK disimpan di sini — baris ini hanya mencatat
-- bahwa pemeriksaan itu dijadwalkan, kapan selesai, dan oleh siapa.
create table if not exists public.inspeksi_jadwal (
  id            bigserial primary key,
  jenis         text not null,              -- sarana_klinik | sanitasi | p3k | ambulans | ergonomi | kalibrasi
  site          text,
  objek_id      text,                       -- id katalog / id aset pada modul asalnya
  objek_nama    text,
  periode       text,                       -- YYYY-MM, dipakai untuk completion rate per bulan
  tanggal_rencana date not null,            -- due date: batas akhir yang disepakati
  tanggal_selesai date,                     -- kapan benar-benar selesai (null = belum)
  status        text not null default 'rencana',  -- rencana | selesai | dibatalkan
  petugas       text,                       -- nama/email inspektur yang mengerjakan
  frekuensi_hari integer,                   -- salinan frekuensi saat jadwal dibuat
  catatan       text,
  -- Waktu laporan dibuat & diverifikasi, untuk reporting lead time.
  waktu_lapor   timestamptz,
  waktu_verifikasi timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Satu objek boleh punya BEBERAPA jadwal dalam satu periode (frekuensi
-- mingguan = 4 jadwal/bulan), tetapi tidak boleh ada dua jadwal dengan
-- tanggal rencana yang sama untuk objek yang sama.
--
-- CATATAN soal `coalesce`:
-- PostgreSQL menolak `coalesce(kolom, '')` di dalam UNIQUE INDEX karena
-- fungsi itu tidak ditandai IMMUTABLE (error 42P17: "functions in index
-- expression must be marked IMMUTABLE"). Karena itu kolom yang bisa NULL
-- diberi DEFAULT '' dan NOT NULL, sehingga coalesce tidak diperlukan.
alter table public.inspeksi_jadwal alter column site set default '';
update public.inspeksi_jadwal set site = '' where site is null;
alter table public.inspeksi_jadwal alter column site set not null;

alter table public.inspeksi_jadwal alter column objek_id set default '';
update public.inspeksi_jadwal set objek_id = '' where objek_id is null;
alter table public.inspeksi_jadwal alter column objek_id set not null;

alter table public.inspeksi_jadwal alter column periode set default '';
update public.inspeksi_jadwal set periode = '' where periode is null;
alter table public.inspeksi_jadwal alter column periode set not null;

drop index if exists public.inspeksi_jadwal_unik;
create unique index if not exists inspeksi_jadwal_unik
  on public.inspeksi_jadwal (jenis, site, objek_id, periode, tanggal_rencana);
create index if not exists inspeksi_jadwal_periode on public.inspeksi_jadwal (periode);
create index if not exists inspeksi_jadwal_rencana on public.inspeksi_jadwal (tanggal_rencana);

-- ------------------------------------------------------------
-- 2. PICA (temuan ketidaksesuaian)
-- ------------------------------------------------------------
create table if not exists public.pica (
  id             bigserial primary key,
  kode           text,                       -- nomor tampil, mis. PICA-2026-0001
  sumber         text,                       -- inspeksi | temuan_lain | manual
  jenis_inspeksi text,                       -- jenis modul asal temuan
  site           text,
  objek_id       text,
  objek_nama     text,
  deskripsi      text not null,
  tingkat        text not null default 'minor',   -- kritis | mayor | minor
  departemen     text,                       -- penanggung jawab perbaikan
  pic_nama       text,                       -- orang yang bertanggung jawab
  tanggal_dibuat date not null default current_date,
  due_date       date,
  tanggal_closed date,
  status         text not null default 'open',    -- open | in_progress | closed | dismissed
  akar_masalah   text,
  tindakan       text,
  verifikasi_oleh text,
  -- Kunci pengulangan: jenis objek + nama objek. Dipakai mendeteksi
  -- "temuan yang paling sering berulang" (Top 5 PICA Recurrence).
  kunci_berulang text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists pica_status on public.pica (status);
create index if not exists pica_due on public.pica (due_date);
create index if not exists pica_berulang on public.pica (kunci_berulang);

-- ------------------------------------------------------------
-- 2b. Kolom FORM-039 (BG-QSHE-FORM-039 Rev.000)
-- ------------------------------------------------------------
-- Formulir PICA di lapangan memakai nama kolom sendiri. Kolom berikut
-- disediakan agar isi formulir bisa dicatat apa adanya, tanpa memaksa
-- pengisi memetakan ulang ke istilah database.
--
--   PENYIMPANGAN / DEVIASI      → deskripsi
--   FOTO PENYIMPANGAN           → foto_url
--   AKAR MASALAH                → akar_masalah
--   TINDAKAN PERBAIKAN          → tindakan
--   DOKUMENTASI TINDAKAN        → dokumentasi_url
--   TINDAKAN PENCEGAHAN         → tindakan_pencegahan
--   PIC PENANGGUNG JAWAB        → pic_nama  (+ pic_tindak_lanjut)
--   BATAS WAKTU                 → due_date
--   STATUS                      → status
--   Inisiator / Jenis PICA      → inisiator / jenis_pica
--   Dept./Section, Lokasi       → departemen / lokasi
--   Dibuat oleh / Disetujui oleh → dibuat_oleh / disetujui_oleh
alter table public.pica
  add column if not exists nomor integer,
  add column if not exists inisiator text,
  add column if not exists jenis_pica text,
  add column if not exists lokasi text,
  add column if not exists foto_url text,
  add column if not exists dokumentasi_url text,
  add column if not exists tindakan_pencegahan text,
  add column if not exists pic_tindak_lanjut text,
  add column if not exists dibuat_oleh text,
  add column if not exists disetujui_oleh text,
  add column if not exists auto_dibuat boolean not null default false;

-- Setiap PICA otomatis diberi kunci idempotensi dari sumbernya, sehingga
-- menekan "Buat PICA dari temuan" berulang tidak menghasilkan PICA ganda.
--
-- `kunci_sumber` diisi oleh aplikasi, bukan dihitung di dalam index: cast
-- `::text` pada date dan `coalesce` sama-sama tidak IMMUTABLE (error 42P17).
alter table public.pica add column if not exists kunci_sumber text;

create unique index if not exists pica_sumber_unik
  on public.pica (kunci_sumber)
  where kunci_sumber is not null;

-- ------------------------------------------------------------
-- 3. KOTAK P3K
-- ------------------------------------------------------------
-- Katalog isi P3K mengikuti Permenaker 15/2008 Lampiran.
create table if not exists public.p3k_katalog (
  id           bigserial primary key,
  nama         text not null,
  kategori     text not null default 'isi',  -- isi | obat | alat | administrasi
  satuan       text,
  jumlah_standar numeric,
  wajib        boolean not null default true,
  urutan       integer not null default 0
);

create table if not exists public.p3k_site (
  id             bigserial primary key,
  site           text not null,
  lokasi         text not null,              -- mis. "Workshop A", "Mess Blok 1"
  katalog_id     bigint references public.p3k_katalog(id) on delete cascade,
  status         text not null default 'tidak_ada', -- ada | tidak_ada | rusak | tidak_diperlukan
  jumlah         numeric,
  -- Tanggal kedaluwarsa obat/alkes pada kotak ini.
  tanggal_expired date,
  kondisi_kotak  text,                       -- bersih | kotor | rusak
  ada_buku_catatan boolean,
  catatan        text,
  tanggal_inspeksi date,
  updated_at     timestamptz not null default now()
);

create unique index if not exists p3k_site_unik
  on public.p3k_site (site, lokasi, katalog_id);

-- ------------------------------------------------------------
-- 4. AMBULANS & TANGGAP DARURAT MEDIS
-- ------------------------------------------------------------
create table if not exists public.ambulans_katalog (
  id           bigserial primary key,
  nama         text not null,
  kategori     text not null default 'medis', -- medis | kendaraan | sanitasi
  wajib        boolean not null default true,
  urutan       integer not null default 0
);

create table if not exists public.ambulans_site (
  id             bigserial primary key,
  site           text not null,
  unit           text not null,              -- nomor/kode unit ambulans
  katalog_id     bigint references public.ambulans_katalog(id) on delete cascade,
  status         text not null default 'tidak_ada', -- ada | tidak_ada | rusak | tidak_diperlukan
  kondisi        text,                       -- keterangan kondisi
  catatan        text,
  tanggal_inspeksi date,
  updated_at     timestamptz not null default now()
);

create unique index if not exists ambulans_site_unik
  on public.ambulans_site (site, unit, katalog_id);

-- Status kesiapan per unit (Ready / Standby with Note / Breakdown).
create table if not exists public.ambulans_unit (
  id             bigserial primary key,
  site           text not null,
  unit           text not null,
  status_kesiapan text not null default 'standby', -- ready | standby | breakdown
  bbm_persen     numeric,                    -- minimal 75% (3/4 tangki)
  catatan        text,
  diperbarui_oleh text,
  updated_at     timestamptz not null default now()
);

create unique index if not exists ambulans_unit_unik
  on public.ambulans_unit (site, unit);

-- ------------------------------------------------------------
-- 5. SARANA ERGONOMI OPERASIONAL
-- ------------------------------------------------------------
-- Inventaris kelayakan sarana ergonomi (bukan penilaian postur per pekerja).
create table if not exists public.ergonomi_sarana_katalog (
  id           bigserial primary key,
  nama         text not null,
  kategori     text not null default 'operator', -- operator | kantor | manual_handling
  wajib        boolean not null default true,
  urutan       integer not null default 0
);

create table if not exists public.ergonomi_sarana_site (
  id             bigserial primary key,
  site           text not null,
  katalog_id     bigint references public.ergonomi_sarana_katalog(id) on delete cascade,
  jumlah         numeric,
  layak          numeric,                    -- jumlah unit yang layak
  rusak          numeric,                    -- jumlah unit yang rusak
  catatan        text,
  tanggal_inspeksi date,
  updated_at     timestamptz not null default now()
);

create unique index if not exists ergonomi_sarana_site_unik
  on public.ergonomi_sarana_site (site, katalog_id);

-- ------------------------------------------------------------
-- 6. KATALOG BAWAAN (hanya diisi bila belum ada)
-- ------------------------------------------------------------
insert into public.p3k_katalog (nama, kategori, satuan, jumlah_standar, urutan) values
  ('Kasa steril terbungkus',            'isi',  'pak',   5,  1),
  ('Perban (lebar 5 cm)',               'isi',  'buah',  2,  2),
  ('Perban (lebar 10 cm)',              'isi',  'buah',  2,  3),
  ('Plester (lebar 1,25 cm)',           'isi',  'buah',  2,  4),
  ('Plester cepat',                     'isi',  'buah',  10, 5),
  ('Kapas (25 gram)',                   'isi',  'bungkus', 1, 6),
  ('Pembalut segitiga',                 'isi',  'buah',  2,  7),
  ('Sarung tangan sekali pakai',        'isi',  'pasang', 4, 8),
  ('Masker',                            'isi',  'buah',  2,  9),
  ('Pinset',                            'alat', 'buah',  1,  10),
  ('Gunting pembalut',                  'alat', 'buah',  1,  11),
  ('Peniti',                            'isi',  'buah',  12, 12),
  ('Larutan antiseptik (povidone iodine)', 'obat', 'botol', 1, 13),
  ('Alkohol 70%',                       'obat', 'botol', 1,  14),
  ('Obat luka bakar',                   'obat', 'tube',  1,  15),
  ('Salep / krim antiseptik',           'obat', 'tube',  1,  16),
  ('Buku catatan penggunaan P3K',       'administrasi', 'buku', 1, 17),
  ('Daftar isi kotak P3K',              'administrasi', 'lembar', 1, 18)
on conflict do nothing;

insert into public.ambulans_katalog (nama, kategori, urutan) values
  ('AED (Automated External Defibrillator)', 'medis', 1),
  ('Tabung oksigen + regulator/tekanan',     'medis', 2),
  ('Suction pump',                           'medis', 3),
  ('Stretcher / tandu',                      'medis', 4),
  ('Spinal board',                           'medis', 5),
  ('Kotak P3K dalam ambulans',               'medis', 6),
  ('Rem (fungsi dan kebocoran)',             'kendaraan', 7),
  ('Ban (tebal bunga & tekanan)',            'kendaraan', 8),
  ('Sirine dan lampu rotator',               'kendaraan', 9),
  ('BBM minimal 3/4 tangki',                 'kendaraan', 10),
  ('Sanitasi kabin pasien',                  'sanitasi', 11),
  ('Tabung oksigen portabel',                'medis', 12)
on conflict do nothing;

insert into public.ergonomi_sarana_katalog (nama, kategori, urutan) values
  ('Suspension seat alat berat / unit tambang', 'operator', 1),
  ('Stasiun kerja kantor (kursi & meja ergonomis)', 'kantor', 2),
  ('Alat bantu manual handling (trolley, lift)', 'manual_handling', 3),
  ('Penopang kaki (footrest) area kerja',       'kantor', 4),
  ('Alat bantu angkat vakum / crane kecil',     'manual_handling', 5)
on conflict do nothing;
