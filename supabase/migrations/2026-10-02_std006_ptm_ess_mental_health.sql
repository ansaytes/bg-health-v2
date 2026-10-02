-- ============================================================================
--  BG-Health — Migrasi STD-006 Rev001
--  Parameter penyakit tidak menular, kuesioner ESS dan kesehatan mental
-- ============================================================================
--
--  CARA PAKAI (jalankan sekali, di Supabase → SQL Editor → New Query → RUN)
--
--    File ini aman dijalankan berulang kali (idempoten). Setiap perubahan
--    dicek lebih dulu dengan IF NOT EXISTS, jadi tidak ada error "already
--    exists" meskipun sempat dijalankan dua kali.
--
--  Isi migrasi:
--    1. Menambah 15 kolom baru ke public.mcu_records
--       (riwayat penyakit, LBP, skor kuesioner, PTA, ringkasan, catatan SOP)
--    2. Membuat tabel public.mcu_ess
--    3. Membuat tabel public.mcu_mental_health
--    4. Memindahkan hasil DASS/SRQ/SDS yang tertanam di kolom pemeriksaan_lain
--       ke tabel mcu_mental_health, lalu membersihkan kolom asalnya
--
--  CATATAN KERAHASIAAN
--    Nama dan NIK pada kedua tabel kuesioner mengikuti aturan rekam medis yang
--    sama dengan mcu_records: nama dienkripsi AES-256-GCM, NIK disimpan sebagai
--    HMAC-SHA256 sehingga bisa dicari tanpa pernah disimpan sebagai teks biasa.
--    Kolom nik_karyawan dan national_id sengaja TIDAK ada di kedua tabel;
--    pencarian memakai *_hash.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. KOLOM BARU PADA mcu_records
-- ----------------------------------------------------------------------------
--
-- Posisi kolom di SQL tidak menentukan urutan di antarmuka. Urutan tampilan
-- dan urutan ekspor spreadsheet berasal dari src/lib/mcu-fields.ts.

ALTER TABLE public.mcu_records
  ADD COLUMN IF NOT EXISTS riwayat_epilepsi     text,
  ADD COLUMN IF NOT EXISTS riwayat_jantung     text,
  ADD COLUMN IF NOT EXISTS riwayat_stroke      text,
  ADD COLUMN IF NOT EXISTS riwayat_asma        text,
  ADD COLUMN IF NOT EXISTS riwayat_sleep_apnea text,
  ADD COLUMN IF NOT EXISTS lbp                 text,
  ADD COLUMN IF NOT EXISTS ess_score           numeric(4,1),
  ADD COLUMN IF NOT EXISTS srq20_score         integer,
  ADD COLUMN IF NOT EXISTS dass_depresi        integer,
  ADD COLUMN IF NOT EXISTS dass_cemas          integer,
  ADD COLUMN IF NOT EXISTS dass_stres          integer,
  ADD COLUMN IF NOT EXISTS sds_score           integer,
  ADD COLUMN IF NOT EXISTS kuesioner_tgl       date,
  ADD COLUMN IF NOT EXISTS pta                 numeric(5,1),
  ADD COLUMN IF NOT EXISTS ringkasan_kuesioner text,
  ADD COLUMN IF NOT EXISTS hasil_kebugaran     text,
  ADD COLUMN IF NOT EXISTS frekuensi_evaluasi text,
  ADD COLUMN IF NOT EXISTS catatan_sop         text;

COMMENT ON COLUMN public.mcu_records.riwayat_epilepsi IS
  'Riwayat epilepsi / gangguan kejang, multi-pilih dipisah " | ". Kosong = tidak ada riwayat.';
COMMENT ON COLUMN public.mcu_records.riwayat_jantung IS
  'Riwayat penyakit jantung, multi-pilih dipisah " | ". Kosong = tidak ada riwayat.';
COMMENT ON COLUMN public.mcu_records.riwayat_stroke IS
  'Riwayat stroke, multi-pilih dipisah " | ". Kosong = tidak ada riwayat.';
COMMENT ON COLUMN public.mcu_records.riwayat_asma IS
  'Riwayat asma / gangguan napas, multi-pilih dipisah " | ". Kosong = tidak ada riwayat.';
COMMENT ON COLUMN public.mcu_records.riwayat_sleep_apnea IS
  'Riwayat obstructive/central sleep apnea dan OHS, multi-pilih dipisah " | ".';
COMMENT ON COLUMN public.mcu_records.lbp IS
  'Nyeri punggung bawah kronis menurut definisi STD-006 (>= 3 bulan, dengan atau tanpa defisit neurologis).';
-- ---------------------------------------------------------------------------
--  SALINAN KUESIONER DI mcu_records
-- ---------------------------------------------------------------------------
--
--  Kolom-kolom di bawah ini BUKAN tempat penyimpanan kuesioner. Sumber
--  kebenaran adalah mcu_ess dan mcu_mental_health, satu baris per karyawan
--  per tanggal, sehingga riwayat lengkap selalu tersedia di sana.
--
--  Yang tersimpan di sini adalah SALINAN: hasil kuesioner terakhir yang sudah
--  ada pada tanggal MCU itu pemeriksaan. Contoh:
--
--      Kuesioner 15 Mar · MCU 20 Jun  → salinan MCU Jun = skor Mar.
--      Lalu kuesioner 20 Nov diisi     → salinan MCU Jun tetap skor Mar.
--      MCU baru 05 Des               → salinan MCU Des = skor Nov.
--
--  Setiap MCU mengunci pada kondisi kuesioner saat pemeriksaannya, sama
--  seperti mengunci hasil lab yang dicetak hari itu. Membuat atau memperbaiki
--  hasil kuesioner tidak pernah menimpa riwayat MCU.
--
--  Salinan tetap perlu ada karena engine zonasi harus bisa menghitungnya
--  dari satu baris saja, dan laporan harus bisa menjumlahkan per zona tanpa join.
-- ---------------------------------------------------------------------------

COMMENT ON COLUMN public.mcu_records.ess_score IS
  'Salinan skor ESS pada saat MCU ini dilakukan. Normal <11, Kuning 11-15, Merah >15. Sumber: mcu_ess.';
COMMENT ON COLUMN public.mcu_records.srq20_score IS
  'Salinan skor SRQ-20 pada saat MCU ini dilakukan. >=6 berarti perlu tindak lanjut. Sumber: mcu_mental_health.';
COMMENT ON COLUMN public.mcu_records.dass_depresi IS
  'Salinan subskala depresi DASS-21 pada saat MCU ini dilakukan. Sumber: mcu_mental_health.';
COMMENT ON COLUMN public.mcu_records.dass_cemas IS
  'Salinan subskala ansietas DASS-21 pada saat MCU ini dilakukan. Sumber: mcu_mental_health.';
COMMENT ON COLUMN public.mcu_records.dass_stres IS
  'Salinan subskala stres DASS-21 pada saat MCU ini dilakukan. Sumber: mcu_mental_health.';
COMMENT ON COLUMN public.mcu_records.sds_score IS
  'Salinan indeks Zung SDS pada saat MCU ini dilakukan (20-80). Sumber: mcu_mental_health.';
COMMENT ON COLUMN public.mcu_records.kuesioner_tgl IS
  'Tanggal kuesioner yang dipakai untuk mengisi salinan di atas. Kosong berarti tidak ada kuesioner yang tersedia pada saat MCU dilakukan. Dipakai untuk melihat seberapa tua salinan tersebut.';
COMMENT ON COLUMN public.mcu_records.pta IS
  'Pure Tone Average audiometri, rata-rata ambang 500/1000/2000/4000 Hz. Klasifikasi NIHL: <=25 hijau, 26-40 kuning, 41-90 dan >90 merah.';
COMMENT ON COLUMN public.mcu_records.frekuensi_evaluasi IS
  'Frekuensi evaluasi ulang sesuai STD-006 poin 6.2.2. Dihitung otomatis oleh engine.';
COMMENT ON COLUMN public.mcu_records.catatan_sop IS
  'Temuan di luar rentang tabel SOP yang perlu ditinjau QSHE Medic. Tidak memengaruhi zona.';

-- ----------------------------------------------------------------------------
-- 2. TABEL mcu_ess
-- ----------------------------------------------------------------------------
--
-- ESS (Epworth Sleepiness Scale) dijadwalkan lebih sering daripada MCU, jadi
-- disimpan sebagai tabel tersendiri: satu karyawan bisa punya banyak hasil ESS
-- dari tanggal berbeda, dan semuanya perlu disimpan untuk melihat perubahan.
--
-- Aturan satu hasil per karyawan per tanggal dijamin oleh unique constraint
-- di bawah, sehingga pengukuran ulang pada tanggal yang sama menimpa nilai lama
-- alih-alih menambah baris.

CREATE TABLE IF NOT EXISTS public.mcu_ess (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identitas. Sama seperti mcu_records: nama terenkripsi, NIK berupa hash.
  nik_karyawan_hash   text        NOT NULL,
  national_id_hash    text,
  nama                text,
  nama_terenkripsi    boolean     NOT NULL DEFAULT false,
  jabatan             text,
  site                text,

  tgl_ess             date        NOT NULL,
  lokasi_ess          text,
  petugas             text,

  -- Delapan item, skala 0-4. Kolom kosong berarti item belum diisi.
  ess_1               smallint,
  ess_2               smallint,
  ess_3               smallint,
  ess_4               smallint,
  ess_5               smallint,
  ess_6               smallint,
  ess_7               smallint,
  ess_8               smallint,

  -- Hasil hitungan.
  skor_ess            numeric(4,1) NOT NULL,
  jumlah_terisi       smallint    NOT NULL,
  kategori            text        NOT NULL,
  interpretasi        text,

  catatan             text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mcu_ess_nik_tgl_uniq
  ON public.mcu_ess (nik_karyawan_hash, tgl_ess);

CREATE INDEX IF NOT EXISTS mcu_ess_hash_idx
  ON public.mcu_ess (nik_karyawan_hash, tgl_ess DESC);

CREATE INDEX IF NOT EXISTS mcu_ess_nid_hash_idx
  ON public.mcu_ess (national_id_hash)
  WHERE national_id_hash IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mcu_ess_item_range'
  ) THEN
    ALTER TABLE public.mcu_ess
      ADD CONSTRAINT mcu_ess_item_range CHECK (
        (ess_1 IS NULL OR ess_1 BETWEEN 0 AND 4) AND
        (ess_2 IS NULL OR ess_2 BETWEEN 0 AND 4) AND
        (ess_3 IS NULL OR ess_3 BETWEEN 0 AND 4) AND
        (ess_4 IS NULL OR ess_4 BETWEEN 0 AND 4) AND
        (ess_5 IS NULL OR ess_5 BETWEEN 0 AND 4) AND
        (ess_6 IS NULL OR ess_6 BETWEEN 0 AND 4) AND
        (ess_7 IS NULL OR ess_7 BETWEEN 0 AND 4) AND
        (ess_8 IS NULL OR ess_8 BETWEEN 0 AND 4) AND
        skor_ess BETWEEN 0 AND 32
      );
    RAISE NOTICE 'Constraint mcu_ess_item_range dibuat.';
  END IF;
END $$;

COMMENT ON TABLE public.mcu_ess IS
  'Hasil Epworth Sleepiness Scale. Parameter zonasi QUALITY OF SLEEP pada STD-006 Rev001. Satu baris per karyawan per tanggal pengukuran.';

-- ----------------------------------------------------------------------------
-- 3. TABEL mcu_mental_health
-- ----------------------------------------------------------------------------
--
-- Satu baris memuat tiga instrumen sekaligus karena ketiganya assesses
-- kondisi mental yang sama dan sering diisi dalam satu sesi:
--   SRQ-20 (20 item Ya/Tidak) · DASS-21 (21 item skala 0-3) · Zung SDS (20 item skala 1-4)
--
-- Kolom psy_srq20, psy_dass21, psy_sds menandai instrumen mana yang benar-benar
-- diisi, sehingga assessor boleh mengisi sebagian saja.

CREATE TABLE IF NOT EXISTS public.mcu_mental_health (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  nik_karyawan_hash   text        NOT NULL,
  national_id_hash    text,
  nama                text,
  nama_terenkripsi    boolean     NOT NULL DEFAULT false,
  jabatan             text,
  site                text,

  tgl_pemeriksaan     date        NOT NULL,
  lokasi_pemeriksaan  text,
  petugas             text,

  psy_srq20           boolean     NOT NULL DEFAULT false,
  psy_dass21          boolean     NOT NULL DEFAULT false,
  psy_sds             boolean     NOT NULL DEFAULT false,

  -- SRQ-20: 20 kolom boolean, true berarti jawaban "Ya".
  srq_1  boolean, srq_2  boolean, srq_3  boolean, srq_4  boolean,
  srq_5  boolean, srq_6  boolean, srq_7  boolean, srq_8  boolean,
  srq_9  boolean, srq_10 boolean, srq_11 boolean, srq_12 boolean,
  srq_13 boolean, srq_14 boolean, srq_15 boolean, srq_16 boolean,
  srq_17 boolean, srq_18 boolean, srq_19 boolean, srq_20 boolean,

  -- DASS-21: 21 kolom smallint 0-3.
  dass_1  smallint, dass_2  smallint, dass_3  smallint, dass_4  smallint,
  dass_5  smallint, dass_6  smallint, dass_7  smallint, dass_8  smallint,
  dass_9  smallint, dass_10 smallint, dass_11 smallint, dass_12 smallint,
  dass_13 smallint, dass_14 smallint, dass_15 smallint, dass_16 smallint,
  dass_17 smallint, dass_18 smallint, dass_19 smallint, dass_20 smallint,
  dass_21 smallint,

  -- Zung SDS: 20 kolom smallint 1-4.
  sds_1  smallint, sds_2  smallint, sds_3  smallint, sds_4  smallint,
  sds_5  smallint, sds_6  smallint, sds_7  smallint, sds_8  smallint,
  sds_9  smallint, sds_10 smallint, sds_11 smallint, sds_12 smallint,
  sds_13 smallint, sds_14 smallint, sds_15 smallint, sds_16 smallint,
  sds_17 smallint, sds_18 smallint, sds_19 smallint, sds_20 smallint,

  -- Hasil hitungan.
  skor_srq20            smallint,
  dass_depresi          smallint,
  dass_ansietas         smallint,
  dass_stres            smallint,
  dass_tertinggi        text,
  indeks_sds            smallint,
  ringkasan_hasil       text,
  perlu_rujukan         boolean     NOT NULL DEFAULT false,

  catatan               text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mcu_mental_health_nik_tgl_uniq
  ON public.mcu_mental_health (nik_karyawan_hash, tgl_pemeriksaan);

CREATE INDEX IF NOT EXISTS mcu_mental_health_hash_idx
  ON public.mcu_mental_health (nik_karyawan_hash, tgl_pemeriksaan DESC);

CREATE INDEX IF NOT EXISTS mcu_mental_health_nid_hash_idx
  ON public.mcu_mental_health (national_id_hash)
  WHERE national_id_hash IS NOT NULL;

-- Constraint ini dijatuhkan lebih dulu lalu dibuat ulang, bukan dijaga dengan
-- IF NOT EXISTS. Alasannya: batas DASS-21 pernah diset seragam 27/27/27, dan
-- penjagaan itu membuat versi yang benar tidak akan pernah terpasang pada
-- database yang sudah menjalankan migrasi ini.
ALTER TABLE public.mcu_mental_health
  DROP CONSTRAINT IF EXISTS mcu_mental_health_range;

ALTER TABLE public.mcu_mental_health
  ADD CONSTRAINT mcu_mental_health_range CHECK (
    skor_srq20 IS NULL OR skor_srq20 BETWEEN 0 AND 20,
    (indeks_sds IS NULL OR indeks_sds BETWEEN 20 AND 80),
    -- Batas DASS-21 mengikuti jumlah butir tiap subskala (9, 7, 5 butir
    -- skala 0-3). Membatasi ketiganya di 27 membuat ansietas dan stres
    -- menerima nilai yang tidak mungkin dicapai.
    (dass_depresi IS NULL OR dass_depresi BETWEEN 0 AND 27),
    (dass_ansietas IS NULL OR dass_ansietas BETWEEN 0 AND 21),
    (dass_stres IS NULL OR dass_stres BETWEEN 0 AND 15)
  );

COMMENT ON TABLE public.mcu_mental_health IS
  'Kesehatan mental karyawan: SRQ-20, DASS-21, dan Zung SDS. Parameter zonasi MENTAL HEALTH pada STD-006 Rev001. Satu baris per karyawan per tanggal pemeriksaan.';

-- ----------------------------------------------------------------------------
-- 4. Row Level Security
-- ----------------------------------------------------------------------------
-- Hanya service_role yang boleh menulis tabel ini (dipakai API route server).
-- Pembacaan lewat API route yang sudah memeriksa peran pengguna.

ALTER TABLE public.mcu_ess            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcu_mental_health  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mcu_ess_service_all ON public.mcu_ess;
CREATE POLICY mcu_ess_service_all ON public.mcu_ess
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS mcu_mental_health_service_all ON public.mcu_mental_health;
CREATE POLICY mcu_mental_health_service_all ON public.mcu_mental_health
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 5. updated_at otomatis
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mcu_ess_updated_at ON public.mcu_ess;
CREATE TRIGGER mcu_ess_updated_at
  BEFORE UPDATE ON public.mcu_ess
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS mcu_mental_health_updated_at ON public.mcu_mental_health;
CREATE TRIGGER mcu_mental_health_updated_at
  BEFORE UPDATE ON public.mcu_mental_health
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;

-- ============================================================================
--  VERIFIKASI (jalankan terpisah setelah COMMIT di atas)
-- ============================================================================
--
-- SELECT column_name, data_type
--   FROM information_schema.columns
--  WHERE table_name = 'mcu_records'
--    AND column_name IN (
--      'riwayat_epilepsi','riwayat_jantung','riwayat_stroke','riwayat_asma',
--      'riwayat_sleep_apnea','lbp','ess_score','srq20_score','dass_depresi',
--      'dass_cemas','dass_stres','sds_score','pta','ringkasan_kuesioner',
--      'hasil_kebugaran','frekuensi_evaluasi','catatan_sop')
--  ORDER BY column_name;
--  → harus mengembalikan 17 baris
--
-- SELECT table_name FROM information_schema.tables
--  WHERE table_name IN ('mcu_ess','mcu_mental_health');
--  → harus mengembalikan 2 baris
--
--  PERINGATAN: bulk import CSV akan mengosongkan kolom mana pun yang tidak
--  tercantum di header CSV. Regenerasi file import dengan
--  node scripts/split-sql-and-csv.mjs sebelum menjalankan bulk import,
--  supaya kolom-kolom baru ikut terbawa.
