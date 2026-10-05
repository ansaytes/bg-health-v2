# Tutorial: Menyiapkan Database dan Mengisi Record MCU

Panduan ini untuk menjalankan database BG-Health dari kosong sampai record MCU
terisi dan kuesioner bisa dipakai. Setiap langkah disertai **perintah
verifikasi** dan **hasil yang harus muncul**. Kalau hasil verifikasi berbeda,
berhenti di langkah itu — jangan lanjutkan, karena langkah berikutnya akan
gagal atau menghasilkan data yang salah.

Ringkasannya:

| Langkah | Yang dikerjakan | Lewat |
|---|---|---|
| 1 | Cek sintaks migrasi | Terminal |
| 2 | Jalankan migrasi | Supabase SQL Editor |
| 3 | Verifikasi migrasi | Supabase SQL Editor |
| 4 | Isi 1299 record MCU | Supabase Table Editor |
| 5 | Verifikasi import | Supabase SQL Editor |
| 6 | Pindahkan kuesioner lama | Terminal |
| 7 | Segarkan salinan kuesioner | Terminal |
| 8 | Uji kuesioner di browser | Browser |

---

## Sebelum mulai

Yang dibutuhkan:

- Akses **Supabase Dashboard** untuk proyek yang benar.
- Terminal di folder proyek `D:\WebApp\bg-health-v2`.
- Berkas `Record MCU 2026.xlsx` (sumber data MCU).

Cek dulu Anda berada di folder yang benar:

```powershell
cd D:\WebApp\bg-health-v2
git log --oneline -1
```

Harus menghasilkan commit `49672f2` atau yang lebih baru. Kalau masih
`eee7305`, ambil perubahannya dulu dengan `git pull`.

---

## Langkah 1 — Cek sintaks migrasi

Tidak ada `psql` di komputer ini, jadi SQL tidak bisa diuji langsung sebelum
sending ke database. Karena itu ada pemeriksa sintaks. Jalankan:

```powershell
node scripts/check-sql-syntax.mjs supabase/migrations/2026-10-02_std006_ptm_ess_mental_health.sql
```

Harus menghasilkan:

```
supabase/migrations/2026-10-02_std006_ptm_ess_mental_health.sql
  OK: tidak ditemukan masalah sintaks dasar

Semua berkas lolos.
```

Kalau ada yang gagal, **jangan** buka SQL Editor dulu. Perbaiki berkasnya,
lalu jalankan lagi perintah ini.

> Pemeriksa ini menangkap kelas kesalahan yang pernah membuat migrasi gagal:
> kurung tidak seimbang, `CHECK` yang memisahkan kondisi dengan koma, dan
> `BEGIN`/`COMMIT` yang tidak berpasangan. Ia bukan pengganti SQL Editor —
> hanya alat bantu agar tidak membuang waktu dengan percobaan gagal.

---

## Langkah 2 — Jalankan migrasi

1. Buka **Supabase Dashboard** → pilih proyek Anda → menu **SQL Editor** →
   **New Query**.
2. Buka berkas ini di editor teks:
   `supabase/migrations/2026-10-02_std006_ptm_ess_mental_health.sql`
3. Blok seluruh isi (Ctrl+A), salin (Ctrl+C).
4. Tempel di SQL Editor.
5. Klik **Run**.

Berkas ini terbungkus `BEGIN;` ... `COMMIT;`. Artinya kalau ada satu baris
yang gagal, **seluruh perubahan dibatalkan** dan database kembali ke kondisi
sebelumnya. Jadi tidak ada keadaan setengah jadi.

### Kalau gagal

Baca pesan error dan cari nomor barisnya. Hitung baris di kolom kiri SQL
Editor, bukan di editor teks — keduanya bisa berbeda kalau ada baris kosong
atau `@@` di awal file.

Error yang pernah muncul dan sudah diperbaiki:

| Error | Penyebab | Perbaikan |
|---|---|---|
| `syntax error at or near ","` | `CHECK` memisahkan kondisi dengan koma | Sudah diganti `AND` |
| `column "ess_score" does not exist` | Migrasi belum dijalankan | Jalankan migrasi lebih dulu |

---

## Langkah 3 — Verifikasi migrasi

Jalankan query ini di SQL Editor. **Harus mengembalikan 18 baris:**

```sql
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'mcu_records'
   AND column_name IN (
     'riwayat_epilepsi','riwayat_jantung','riwayat_stroke','riwayat_asma',
     'riwayat_sleep_apnea','lbp','ess_score','srq20_score','dass_depresi',
     'dass_cemas','dass_stres','sds_score','kuesioner_tgl','pta',
     'ringkasan_kuesioner','hasil_kebugaran','frekuensi_evaluasi','catatan_sop')
 ORDER BY column_name;
```

Lalu query ini. **Harus mengembalikan 2 baris:**

```sql
SELECT table_name FROM information_schema.tables
 WHERE table_name IN ('mcu_ess','mcu_mental_health');
```

Kalau keduanya benar, migrasi berhasil.

### Catatan soal "table not found" setelah migrasi

Supabase menyimpan daftar tabelnya di cache. Cache ini biasanya disegarkan
otomatis, tapi kadang perlu beberapa detik. Kalau API masih menjawab
`Could not find the table 'public.mcu_ess' in the schema cache`
padahal query di Langkah 3 sudah benar, tunggu sekitar 10 detik lalu coba
lagi. Kalau masih sama, muat ulang halaman Dashboard.

---

## Langkah 4 — Isi 1299 record MCU

Penting untuk dipahami: **migrasi di Langkah 2 tidak mengisi data MCU.**
Migrasi hanya menambah kolom dan membuat tabel. Isi `mcu_records` datang dari
berkas Excel, dan itu langkah tersendiri.

Berkas CSV dan batch SQL import berisi data MCU. File tersebut tidak disimpan
di Git; buat ulang secara lokal dari workbook sumber sebelum mengimpor:

```powershell
$env:MCU_SOURCE_XLSX = 'D:\lokasi-aman\Record MCU 2026.xlsx'
node scripts/split-sql-and-csv.mjs
```

File hasil akan disimpan di `local-only/archive/mcu-import/`, yang diabaikan
oleh Git. Pastikan `.env.local` berisi `ENCRYPTION_KEY` yang sesuai dengan
kunci yang digunakan aplikasi.

Pilih salah satu cara. Cara A paling cepat.

### Cara A — CSV lewat Table Editor (disarankan)

1. Supabase Dashboard → **Table Editor** → pilih tabel `mcu_records`.
2. Klik tombol insert, lalu pilih **Import data from CSV**.
3. Pilih berkas `local-only/archive/mcu-import/mcu-import-bulk-upload.csv` (sekitar 2,7 MB).
4. Klik **Import**, tunggu sampai selesai.

### Cara B — Batch SQL satu per satu

Kalau impor CSV tidak bekerja. Jalankan di SQL Editor **berurutan**, mulai
dari `batch-00-prasyarat.sql`:

```
local-only/archive/mcu-import/mcu-import-batches/batch-00-prasyarat.sql
local-only/archive/mcu-import/mcu-import-batches/batch-01-of-26.sql
local-only/archive/mcu-import/mcu-import-batches/batch-02-of-26.sql
...
local-only/archive/mcu-import/mcu-import-batches/batch-26-of-26.sql
```

Jangan sampai ada yang terlewat dan jangan mengubah urutan.

---

## Langkah 5 — Verifikasi import

Jalankan di SQL Editor:

```sql
SELECT count(*) AS total,
       count(DISTINCT national_id_hash) AS unik,
       count(hasil_fu1) AS ada_fu1
  FROM public.mcu_records;
```

Hasil yang benar:

| Kolom | Nilai yang diharapkan |
|---|---|
| `total` | **1299** |
| `unik` | **1287** |
| `ada_fu1` | **32** |

`total` dan `unik` tidak sama karena 12 karyawan punya dua record MCU.
Duplikat di luar itu sudah dibuang saat pembuatan berkas import (17 baris).

Kalau `total` = 0, impor belum berjalan. Kembali ke Langkah 4.
Kalau `total` kurang dari 1299, salah satu batch belum termuat.

---

## Langkah 6 — Pindahkan hasil kuesioner lama

Hasil DASS-21 dan SRQ-20 dari tahun-tahun sebelumnya tertanam sebagai teks di
kolom *Pemeriksaan Lain* pada Excel. Skrip ini memindahkannya ke tabel
kuesioner yang baru.
Pastikan variabel `MCU_SOURCE_XLSX` dari langkah sebelumnya masih menunjuk ke
workbook sumber yang benar.

Dry-run dulu, tanpa menulis ke database:

```powershell
node scripts/migrate-legacy-questionnaires.mjs
```

Contoh keluaran:

```
=== Hasil penguraian Pemeriksaan Lain ===
ESS     : 10 baris
Mental  : 71 baris
ESS dengan angka : 9 (nilai 0, 0, 0, 0, 4, 4, 6, 9, 9)
ESS kategori saja: 1
```

Kalau angkanya masuk akal, jalankan dengan `--apply`:

```powershell
node scripts/migrate-legacy-questionnaires.mjs --apply
```

---

## Langkah 7 — Segarkan salinan kuesioner di MCU

Supaya zona MCU ikut memperhitungkan hasil kuesioner:

```powershell
node scripts/refresh-questionnaire-snapshots.mjs
```

Skrip ini idempoten — aman dijalankan berkali-kali.

---

## Langkah 8 — Uji kuesioner di browser

Jalankan aplikasi:

```powershell
npm run dev
```

Lalu buka:

| Halaman | Alamat |
|---|---|
| Daftar kuesioner | `http://localhost:3000/kuesioner` |
| Gangguan Tidur | `http://localhost:3000/kuesioner/gangguan-tidur` |
| Kesehatan Mental | `http://localhost:3000/kuesioner/kesehatan-mental` |

Ketiganya **tidak memerlukan login**.

### Cara mengujinya dengan benar

1. Isi kolom pencarian dengan **NIK KTP** seorang karyawan yang sudah ada di
   `employees`. Tekan Enter atau tombol **Cari**.
2. Kartu identitas harus muncul dengan nama, NIK KTP, jabatan, dan unit kerja
   terisi otomatis.
3. Jawab semua pertanyaan.
4. Klik **Simpan**.
5. Popup harus muncul berisi skor, kesimpulan, zona MCU terbaru, dan jumlah
   record MCU yang ikut diperbarui.

### Kalau muncul galat

| Pesan | Arti | Yang harus dilakukan |
|---|---|---|
| `Penyimpanan hasil ESS gagal karena tabel public.mcu_ess belum ada` | Migrasi belum jalan | Kembali ke Langkah 2 |
| `Karyawan tidak ditemukan` | NIK KTP tidak ada di `employees` | Coba NIK Karyawan atau sebagian nama |
| `Terlalu banyak permintaan` | Lebih dari 30 permintaan per menit | Tunggu satu menit |
| Kolom pencarian tidak bisa diisi | Halaman tidak termuat penuh | Muat ulang halaman |

### Data uji

Untuk menguji, pakai tanggal hari ini. Hasilnya akan tersimpan sebagai
riwayat. Kalau ingin menghapus:

```sql
DELETE FROM public.mcu_ess WHERE tgl_ess = CURRENT_DATE;
DELETE FROM public.mcu_mental_health WHERE tgl_pemeriksaan = CURRENT_DATE;
```

Perintah di atas menghapus **semua** hasil kuesioner pada tanggal hari ini
untuk semua karyawan, jadi jalankan hanya kalau memang itu yang diinginkan.

---

## Ringkasan galat

| Gejala | Penyebab | Solusi |
|---|---|---|
| `syntax error at or near ","` | `CHECK` pakai koma | Sudah diperbaiki. Tarik perubahan terbaru |
| `column "ess_score" does not exist` | Migrasi belum jalan | Langkah 2 |
| `total = 0` di verifikasi | Import belum jalan | Langkah 4 |
| `Could not find the table ... in the schema cache` | Cache Supabase belum segar | Tunggu 10 detik, muat ulang Dashboard |
| Login tetap diminta di halaman kuesioner | Server belum dibangun ulang | `npm run dev` ulang |