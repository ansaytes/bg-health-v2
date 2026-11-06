-- ============================================================
-- Tambah kolom mcu_records untuk parameter MCU yang belum ada
-- ============================================================
-- Menyimpan MCU gagal (PGRST204) bila ada field di MCU_FIELDS yang
-- kolomnya tidak ada di tabel. Skrip ini menambahkan seluruh kolom
-- yang hilang. Semua kolom NULLABLE: parameter yang tidak ditemukan
-- pada berkas MCU dibiarkan NULL, bukan diisi nilai default.
--
-- Jalankan di Supabase SQL Editor.
-- ============================================================

ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS srq17_bahaya text;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS jumlah_rokok numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS lama_merokok numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS olahraga text;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS jenis_olahraga text;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS kebiasaan_lain text;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS rdw numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS mpv numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS retikulosit numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS basofil numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS eosinofil numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS neutrofil_batang numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS neutrofil_segmen numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS limfosit numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS monosit numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS masa_perdarahan numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS masa_pembekuan numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS billirubin_direct numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS billirubin_indirect numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS protein_total numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS albumin numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS globulin numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS glukosa_sewaktu numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS natrium numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS kalium numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS klorida numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS kalsium numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS ckmb numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS troponin numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS besi_fe numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS tibc numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS ferritin numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS ul_jamur text;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS widal text;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS mantoux text;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS kolinesterase numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS karboksihemoglobin numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS spi_metode text;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS tes6mwt numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS tes_harvard numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS tes_ymcastep numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS tes_queens_college numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS tes_ergocycle numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS tes_sit_up numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS tes_push_up numeric;
ALTER TABLE public.mcu_records ADD COLUMN IF NOT EXISTS tes_sit_and_reach numeric;

-- Muat ulang cache skema PostgREST agar kolom baru langsung dikenali.
NOTIFY pgrst, 'reload schema';
