# Panduan STD-006 Rev001 — Gangguan Tidur, Kesehatan Mental, dan Klasifikasi Otomatis

Dokumen ini adalah panduan penggunaan aplikasi BG-Health setelah perubahan
klasifikasi penyakit tidak menular berbasis **Standar Indonesia** dan
**SOP STD-006 Rev001**. Ditujukan untuk Operator MCU, QSHE Medic, dan
Administrator.

---

## 1. Dua kuesioner berdiri sendiri

Gangguan Tidur (ESS) dan Kesehatan Mental (SRQ-20, DASS-21, Zung SDS) **tidak
terikat pada pemeriksaan MCU**. Keduanya bisa diisi kapan saja, tanpa harus ada
MCU, dan dijadwalkan jauh lebih sering — misalnya setiap 3 atau 6 bulan.

### 1.0 Diisi tanpa login

Kedua kuesioner dibuka sebagai halaman mandiri, **tanpa perlu masuk** ke
aplikasi:

| Halaman | Alamat |
|---|---|
| Pilihan kuesioner | `/kuesioner` |
| Gangguan Tidur | `/kuesioner/gangguan-tidur` |
| Kesehatan Mental | `/kuesioner/kesehatan-mental` |

Satu-satunya syarat untuk mengisi adalah identitasnya ditemukan di data
karyawan. Cari dengan **NIK KTP**, NIK Karyawan, atau sebagian nama. Setelah
ketemu, nama, jabatan, dan unit kerja terisi otomatis dan **tidak bisa
diketik ulang**, sehingga hasil tidak mungkin tersimpan ke karyawan lain.

Setelah tersimpan, sebuah popup menampilkan skor, kesimpulan, zona MCU
terbaru, dan berapa record MCU yang ikut diperbarui.

> **Peringatan keamanan yang perlu dipahami.** Membuka penulisan data
> kesehatan mental tanpa login berarti siapa pun yang mengetahui NIK KTP
> seorang karyawan dapat menulis hasil kuesioner atas namanya. Batas laju
> 30 permintaan per menit per alamat IP menahan penyalahgunaan dalam volume
> besar, **bukan** penyalahgunaan yang terarah. Batas ini ditinjau di
> `denyUnlessSelfService()` pada `src/lib/questionnaire-store.ts`. Bila
> kuesioner ini nanti dipakai sebagai pemicu tindakan kerja, gerbang harus
> dikembalikan ke wajib login.

Akibatnya, keduanya tidak disimpan di `mcu_records`. Sumber kebenaran ada di
dua tabel tersendiri:

| Tabel | Isi | Satu baris per |
|---|---|---|
| `mcu_ess` | Skor ESS beserta jawaban 8 butir | karyawan per tanggal |
| `mcu_mental_health` | SRQ-20, DASS-21, Zung SDS | karyawan per tanggal |

Artinya **riwayat tidak pernah hilang**. Hasil bulan Januari dan bulan Juli
berdua tersimpan, dapat dibandingkan, dan tidak saling menimpa.

### 1.1 Lalu bagaimana zona MCU mengetahuinya?

Di `mcu_records` ada kolom salinan: `ess_score`, `srq20_score`,
`dass_depresi`, `dass_cemas`, `dass_stres`, `sds_score`, dan `kuesioner_tgl`.

Salinan ini **bukan data terbaru**, melainkan hasil kuesioner terakhir yang
sudah ada **pada saat MCU itu dilakukan**. Setiap MCU mengunci pada kondisi
kuesioner saat pemeriksaannya, persis seperti mengunci hasil lab yang dicetak
hari itu.

Contoh nyata:

```
Kuesioner 15 Mar  ·  MCU 20 Jun  →  MCU Jun memakai skor Mar
Lalu kuesioner 20 Nov diisi        →  MCU Jun tetap memakai skor Mar
MCU baru 05 Des                    →  MCU Des memakai skor Nov
```

Jadi mengisi kuesioner hari ini **tidak akan** mengubah zona MCU tahun lalu.
Kolom `kuesioner_tgl` mencatat tanggal kuesioner yang dipakai, sehingga
assessor bisa melihat seberapa tua salinan tersebut.

Salinan tetap perlu ada karena engine zonasi menghitung zona dari satu baris
saja, dan laporan harus bisa menjumlahkan per zona tanpa join ke tabel lain.

### 1.2 Pencarian karyawan

Kedua halaman mencari karyawan dari tabel **`employees`**, bukan dari
`mcu_records`. Ini penting: karyawan baru belum tentu punya record MCU, dan
justru mereka yang paling perlu pemeriksaan rutin. Tabel `employees` memuat
3159 karyawan, lebih banyak dari 1299 record MCU.

---

## 2. Halaman Gangguan Tidur

Menu: **Data Entry → Gangguan Tidur**.

Sesuai STD-006, parameter ini bernama **Gangguan Tidur / Excessive Daytime
Sleepiness** dengan label zona **Kualitas Tidur**. ESS menilai *kantuk
berlebihan di siang hari*, bukan keseluruhan kualitas tidur.

> **Penting untuk keselamatan:** ESS di atas 15 berarti **tidak layak operasi
> alat berat / shift malam** menurut STD-006. Jadwalkan pemeriksaan ini secara
> berkala, tidak hanya saat MCU.

### 2.1 Alur pengisian

1. **Cari karyawan** — NIK Karyawan, NIK KTP, atau sebagian nama. Identitas
   terisi otomatis dan tidak bisa diedit.
2. **Isi tanggal, lokasi, dan petugas.**
3. **Jawab delapan pertanyaan** (situasi dalam dua minggu terakhir):

   | Nilai | Arti |
   |---|---|
   | 0 | Tidak pernah |
   | 1 | Jarang |
   | 2 | Kadang-kadang |
   | 3 | Sering |
   | 4 | Hampir setiap hari |

   Situasinya: duduk dan membaca · menonton televisi atau film · duduk diam di
   tempat umum · di dalam mobil saat berhenti dalam kemacetan · duduk diam
   setelah makan siang · berbaring istirahat sore hari · duduk dan berbicara
   dengan orang · mengendarai kendaraan.

4. **Klik Simpan.**

### 2.2 Arti skor

| Skor | Kategori | Zona |
|---|---|---|
| < 11 | Normal | Hijau |
| 11–15 | Kantuk berlebihan ringan–sedang | Kuning |
| > 15 | Kantuk berlebihan berat | Merah |

### 2.3 Riwayat

Panel **Riwayat Gangguan Tidur** menampilkan semua hasil, satu baris per
tanggal, terbaru di atas. Baris bertanda **dipakai MCU** adalah skor yang
mengunci zona pada record MCU tertentu. Ini adalah jawabannya untuk
"bagaimana kita melihat riwayatnya?".

ESS untuk tanggal yang sama menimpa hasil sebelumnya; tanggal berbeda menjadi
riwayat baru.

---

## 3. Halaman Kesehatan Mental

Menu: **Data Entry → Kesehatan Mental**.

Satu halaman, tiga instrumen, karena ketiganya menilai kondisi mental yang sama
dan sering diisi dalam satu sesi. Assessor boleh mengisi sebagian saja.

### 3.1 SRQ-20

Instrumen resmi **Kemenkes RI** yang dipakai Riskesdas sejak 1995. Menjawab
gejala dalam **30 hari terakhir**, jawaban Ya/Tidak.

| Skor | Arti |
|---|---|
| < 6 | Tidak ada gangguan mental emosional |
| ≥ 6 | Perlu tindak lanjut |

### 3.2 DASS-21

21 pernyataan, jawaban 0–3, tentang kondisi **mingguan terakhir**. Tiga
subskala diukur terpisah, dan **ambangnya berbeda-beda** — inilah yang sering
terlewat:

| Subskala | Normal | Ringan | Sedang | Berat | Sangat berat |
|---|---|---|---|---|---|
| Depresi (maks 27) | 0–9 | 10–13 | 14–21 | 22–27 | 28+ |
| Ansietas (maks 21) | 0–7 | 8–14 | 15–19 | 20–27 | 28+ |
| Stres (maks 15) | 0–11 | 12–19 | 20–25 | 26–31 | 32+ |

Zona kuning mulai pada kategori **berat**: depresi 22, ansietas 20, stres 26.

### 3.3 Zung SDS

20 pernyataan tentang kondisi mingguan terakhir, jawaban 1–4. **Sepuluh item
bernada positif dinilai terbalik** (`5 − jawaban`): item 2, 4, 6, 11, 12, 14,
16, 17, 18, dan 20.

| Indeks | Kategori |
|---|---|
| ≤ 49 | Normal |
| 50–59 | Mild depression |
| 60–69 | Moderate depression |
| ≥ 70 | Severe depression |

### 3.4 Aturan pengisian

- Tab di atas menunjukkan jumlah jawaban terisi per instrumen.
- Pemeriksaan pada **tanggal yang sama** menimpa baris lama; tanggal berbeda
  menjadi riwayat baru.
- Panel **Riwayat Kesehatan Mental** menampilkan seluruh hasil per tanggal.
- Kolom `Catatan` dipakai mencatat tindak lanjut, misalnya "rujuk psikolog
  klinis 12 Mei 2026". Tidak memengaruhi zona.

> Keempat instrumen adalah **instrumen skrining, bukan alat diagnosis**.
> Sesuai STD-006, konfirmasi diagnosis dan keputusan klinis ditetapkan oleh
> dokter atau psikiater.

---

## 4. Klasifikasi otomatis

Perubahan ini mengganti rumus Excel lama dengan satu mesin klasifikasi tunggal
(`src/lib/clinical-classification.ts`) yang dipakai aplikasi, Review MCU, dan
skrip import sekaligus.

1. **Diagnosis memakai istilah resmi bahasa Inggris**, bukan kode ICD-10.
   Contoh: `Hypertension Grade I (140/90 mmHg)`, bukan `I10`.
2. **Angka ambang mengikuti SOP**. Tekanan darah `140/90` masih batas Hijau,
   jadi `135/85` ditulis `Elevated Blood Pressure`, bukan hipertensi.
3. **Zona dan Trigger Zona dihitung dari parameter yang sama**, sehingga
   keduanya tidak mungkin berbeda isi.

Istilah hipertensi memakai **Grade** (I, II, III) mengikuti dokumen SOP.
Istilah *stage* hanya muncul pada `CKD Stage G2`–`G5`, yang memang memakai
klasifikasi tahap gagal ginjal resmi.

### 4.0 Kuesioner menggeser zona

Skor SRQ-20 dan DASS-21 ikut menentukan zona MCU, persis seperti
parameter fisik lain. Aturannya mengikuti parameter KESEHATAN MENTAL
di STD-006 Rev001:

| Skor | Zona |
|---|---|
| SRQ-20 6 atau lebih | Kuning |
| DASS-21 kategori "berat" (depresi 22+, ansietas 20+, stres 26+) | Kuning |
| DASS-21 kategori "sangat berat" | Merah |
| SDS 60–69 | Kuning |
| SDS 70 atau lebih | Merah |

Ambang DASS-21 ditentukan dari **kategori**, bukan angka tetap, karena
batas "berat" tiap subskala berbeda. Satu tabel ambang untuk ketiga
subskala akan salah menandai stres ringan sebagai depresi ringan.

Perlu dicatat: tabel Lovibond asli menulis "extremely severe" mulai
28, tetapi angka itu berasal dari versi 42 butir. Pada DASS-21 jumlah
butir tiap subskala hanya 9, 7, dan 5, sehingga skor maksimum yang
mungkin dicapai hanyalah 27, 21, dan 15. Karena itu kategori tertinggi
hanya muncul bila **setiap butir dijawab maksimum**.

Konsekuensi yang perlu diketahui: skor DASS-21 pada batas maksimum
kini membaca sebagai kategori tertinggi, sehingga record yang bersangkutan
bergeser dari zona Kuning menjadi Merah.

### 4.1 Kolom riwayat

Kolom berikut adalah input manual: riwayat epilepsi, jantung, stroke, asma,
sleep apnea, dan Nyeri Punggung Bawah (LBP).

Kolom riwayat boleh diisi lebih dari satu pilihan, dipisahkan tanda `|`.
**Kolom yang kosong berarti tidak ada riwayat**, bukan "belum diisi" — ini
sengaja berbeda dari parameter objektif.

> Jangan mengetik "Tidak" pada kolom riwayat. Biarkan kosong. Kolom kosong
> sudah dibaca sebagai normal oleh mesin zonasi.

Parameter objektif yang kosong **tidak** dianggap normal: record tersebut
mendapat zona `Belum Lengkap` beserta daftar parameter yang perlu diisi. Ini
membedakan "sudah dinilai dan normal" dari "belum dinilai".

### 4.2 Kasus batas yang dilaporkan, bukan dipaksa

Kolom `Catatan di Luar Rentang Tabel SOP` **tidak memengaruhi zona**. Kolom ini
muncul ketika ada hasil yang jatuh di sela rentang tabel SOP:

| Kasus | Rentang | Mengapa ambigu |
|---|---|---|
| Anemia pada pria | Hb 10,0–10,9 g/dL | Tabel tidak menyebut batas bawah pria |
| Trigliserida | 150–199 mg/dL | Batas `normal` dan `tinggi` tidak jelas |
| Visus | 6/9 | Terdaftar Hijau, sekaligus masuk mild impairment |
| IMT | < 18,5 kg/m² | Tabel hanya menyebut `≥ 18,5` sebagai batas bawah |

Empat kasus ini sengaja tidak dipaksa masuk kategori mana pun. Pilihannya
adalah dilaporkan untuk requesting revisi SOP, bukan ditutup dengan angka
tebakan.

---

## 5. Review MCU

- Kolom riwayat, LBP, dan skor kuesioner bisa diperbaiki di sini.
- **Recall melakukan overwrite, bukan insert.** Menyimpan ulang record yang
  sudah ada memperbarui baris itu berdasarkan kombinasi
  `NIK Karyawan + Tanggal MCU`.
- Setiap kali MCU disimpan, salinan kuesioner **disegarkan berdasarkan tanggal
  MCU itu sendiri**, bukan berdasarkan hari ini. MCU Desember otomatis memakai
  hasil kuesioner November.

---

## 6. Cara menjalankan migrasi dan import

> Database saat dokumen ini ditulis masih **kosong** (0 record), jadi import
> belum pernah dijalankan.
>
> **Untuk panduan langkah demi langkah beserta hasil verifikasi yang harus
> muncul di setiap langkah, lihat
> [`TUTORIAL-IMPORT-MCU.md`](./TUTORIAL-IMPORT-MCU.md).** Bagian di bawah
> hanya rujukan ringkas.

### Langkah 1 — Terapkan migrasi

Supabase → SQL Editor → New Query → buka
`supabase/migrations/2026-10-02_std006_ptm_ess_mental_health.sql` → RUN.

Migrasi menambah 18 kolom baru ke `mcu_records`, membuat tabel `mcu_ess` dan
`mcu_mental_health`, serta menyiapkan RLS. **Wajib lebih dulu**, karena tanpa
tabel tersebut penyimpanan kuesioner gagal dengan pesan
`Penyimpanan hasil ESS gagal karena tabel public.mcu_ess belum ada di database`.

Tidak ada CLI maupun psql di lingkungan ini, dan Supabase JS tidak menyediakan
cara menjalankan DDL. Maka migrasi **hanya dapat diterapkan lewat SQL Editor**.

Verifikasi — harus mengembalikan **18 baris**:

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

Dan **2 baris**:

```sql
SELECT table_name FROM information_schema.tables
 WHERE table_name IN ('mcu_ess','mcu_mental_health');
```

### Langkah 2 — Pindahkan hasil kuesioner lama

Di Excel sumber, hasil kuesioner ditulis sebagai teks di kolom *Pemeriksaan
Lain*, misalnya `DASS-21 : Normal`, `SRQ-20 : Normal`, `ESS : 4`. Skrip ini
menguraikannya ke tabel terpisah:

```bash
node scripts/migrate-legacy-questionnaires.mjs            # dry-run
node scripts/migrate-legacy-questionnaires.mjs --apply    # tulis
```

Hasil yang sudah tercatat di dry-run:

- **10 baris ESS**, 9 di antaranya punya angka (0, 0, 0, 0, 4, 4, 6, 9, 9).
- **71 baris kesehatan mental** (SRQ-20 dan/atau DASS-21).

Teks yang hanya menyebut kategori tanpa angka (`DASS-21 : Normal`) tetap
disimpan dengan skor null dan interpretasinya apa adanya — membuangnya
menghapus bukti bahwa karyawan sudah pernah diperiksa. Kolom
`pemeriksaan_lain` sendiri **tidak dikosongkan**, karena masih memuat catatan
lain yang tidak terkait kuesioner.

### Langkah 3 — Regenerasi file import

```bash
node scripts/split-sql-and-csv.mjs
node scripts/verify-import-columns.mjs
```

Jalankan setiap kali `src/lib/mcu-fields.ts` berubah. Bulk import CSV
**mengosongkan setiap kolom yang tidak ada di header CSV**, jadi spreadsheet
lama bisa menghapus kolom baru. Exit code 0 pada skrip verifikasi berarti
semua kolom siap.

### Langkah 4 — Import

- **Opsi A (disarankan):** Supabase → Table Editor → `mcu_records` → Insert →
  **Import data from CSV** → `scripts/mcu-import-bulk-upload.csv` (162 kolom).
- **Opsi B:** `batch-00-prasyarat.sql` lebih dulu (file ini sudah memuat
  langkah migrasi di bagian atas), lalu `batch-01` sampai `batch-26`.

### Langkah 5 — Segarkan salinan kuesioner

```bash
node scripts/refresh-questionnaire-snapshots.mjs
```

Script ini mengisi kolom salinan pada setiap MCU berdasarkan hasil kuesioner
yang berlaku pada tanggal MCU tersebut. Idempoten, aman dijalankan berulang
kali.

### Langkah 6 — Verifikasi

```sql
SELECT count(*)                                  AS total,
       count(DISTINCT national_id_hash)          AS unik,
       count(*) FILTER (WHERE hasil_fu1 IS NOT NULL) AS ada_fu1
  FROM public.mcu_records;
```

Harapan: `total = 1299`, `unik = 1287`, `ada_fu1 = 32`.

`unik` lebih kecil dari `total` **bukan kegagalan**: ada 12 karyawan dengan dua
MCU pada tanggal berbeda, dan keduanya memang harus disimpan.

Periksa juga sebaran kuesioner:

```sql
SELECT count(*) FILTER (WHERE kuesioner_tgl IS NOT NULL) AS mcu_dengan_kuesioner,
       count(*)                                          AS total
  FROM public.mcu_records;
```

---

## 7. Duplikat saat import

Duplikat pada `mcu-import-duplicates.txt` kini **digabung**, bukan dibuang.
Baris paling lengkap menjadi dasar, lalu kolom yang masih kosong diisi dari
baris yang kalah — karena "paling lengkap" hanya menghitung jumlah kolom
terisi, baris yang kalah bisa saja menyimpan satu hasil lab yang tidak tercatat
di baris dasar.

Daftar kolom yang dipulihkan ikut ditulis di file tersebut, karena nilai itu
**tidak ada di CSV** dan tidak bisa dilihat lagi setelah import.

---

## 8. Daftar file

| File | Isi |
|---|---|
| `supabase/migrations/2026-10-02_std006_ptm_ess_mental_health.sql` | 18 kolom baru + `mcu_ess` + `mcu_mental_health` + RLS |
| `src/lib/clinical-classification.ts` | Seluruh ambang dan label diagnosis |
| `src/lib/zonasi-engine.ts` | Perhitungan zona, `Belum Lengkap`, eGFR CKD-EPI 2021, PTA |
| `src/lib/mcu-diagnosis.ts` | Penyusun daftar diagnosis bahasa Inggris |
| `src/lib/questionnaire-items.ts` | Naskah ESS/SRQ-20/DASS-21/Zung SDS |
| `src/lib/questionnaire-scores.ts` | Perhitungan skor, ambang per subskala, reverse scoring SDS |
| `src/lib/questionnaire-store.ts` | Lookup `employees`, upsert per tanggal, salinan tanpa menimpa riwayat |
| `src/lib/mcu-fields.ts` | Metadata field MCU |
| `src/components/administrator/GangguanTidurPage.tsx` | Halaman Gangguan Tidur |
| `src/components/administrator/InputMentalHealthPage.tsx` | Halaman Kesehatan Mental |
| `src/components/questionnaire/QuestionnaireUI.tsx` | Komponen bersama kedua halaman |
| `src/app/api/ess/route.ts` | Endpoint ESS |
| `src/app/api/mental-health/route.ts` | Endpoint kesehatan mental |
| `scripts/migrate-legacy-questionnaires.mjs` | Memindahkan teks kuesioner dari `pemeriksaan_lain` |
| `scripts/refresh-questionnaire-snapshots.mjs` | Mengisi salinan kuesioner pada seluruh MCU |
| `scripts/verify-import-columns.mjs` | Pemeriksaan kolom import vs database |
| `scripts/audit-legacy-mental-health.mjs` | Inventaris teks kuesioner di Excel sumber |