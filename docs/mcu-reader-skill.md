---
name: mcu-reader
description: "Bacakan hasil MCU dari Google Drive atau PDF ketika pengguna mengetik Bacakan Ini"
---

## Instruksi

Baca seluruh dokumen MCU dan petakan hasil ke field form MCU. Keluarkan satu tabel
Markdown dua kolom (`Item` dan `Hasil`) dengan urutan field form. Jangan membuat
diagnosis, rekomendasi, atau nilai yang tidak ada di dokumen.

### Aturan nilai

- `DBN` berarti Dalam Batas Normal; gunakan hanya untuk pemeriksaan yang dilakukan
  dan hasilnya normal.
- `N/A` berarti pemeriksaan tidak dilakukan atau nilainya `NULL`. Untuk ekstraksi,
  kembalikan field kosong (jangan mengisi string N/A). Jangan menyamakan N/A dengan DBN.
- Frekuensi audiometri yang tidak diperiksa dikosongkan, bukan `N/A`.
- Angka laboratorium dan spirometri ditulis tanpa satuan.
- Desimal menggunakan koma; `8.900` menjadi `8,9`, dan `9.030` menjadi `9,03`.
- Jangan menambahkan `L` pada nilai spirometri.
- Field `catatan` selalu dibiarkan kosong karena hanya untuk input manual.
- Dokumen boleh berbentuk pasangan `Item`/`Hasil` dalam tabel atau teks berurutan
  tanpa pemisah baris; cocokkan setiap nilai terhadap label itemnya.
- Identitas dapat berisi NIK KTP, Nama, Usia, Jenis Kelamin, Jabatan, dan Site.
  Jangan mengisi NIK KTP dari NIK Karyawan atau nama.
- Normalisasi `Laki-laki`/`Pria` menjadi `Laki - Laki` dan `Perempuan`/`Wanita`
  menjadi `Perempuan`. Usia dapat diambil dari dokumen; aplikasi juga menghitung
  usia dari tanggal lahir data karyawan.
- Untuk field serologi HBsAg, Anti-HBs, VDRL, TPHA, dan HIV, normalisasi
  `Negatif` menjadi `Non - Reaktif` dan `Positif` menjadi `Reaktif`.
- Untuk Defisiensi Persepsi Warna dan seluruh tes neurologi, normalisasi `DBN`
  menjadi `Normal`. Tes neurologi memakai hasil `Normal`, `Negatif`, atau `Positif`
  sesuai nilai yang tertulis.
- Status MCU hanya boleh salah satu opsi status MCU. Frasa seperti `Fit dengan
  Catatan` adalah kesimpulan vendor, bukan Status MCU; petakan ke `Fit With Note`.
- Bila dokumen memberi rekomendasi naratif, pilih hanya opsi dropdown yang didukung
  oleh teksnya. Contohnya konsultasi dokter spesialis penyakit dalam menjadi
  `Dokter Sp. PD`, dan anjuran diet/olahraga menjadi opsi gaya hidup.
- Jangan membuat diagnosa, item follow up, atau saran baru. Item Follow Up dihitung
  aplikasi dari hasil pemeriksaan dan Kesimpulan Vendor.
- Opsi Rekomendasi Follow Up diisi otomatis berdasarkan Item Follow Up; pengguna
  dapat mengubah pilihan tersebut secara manual.
- Jika eGFR tidak dicantumkan, biarkan field eGFR kosong; aplikasi akan menampilkan
  estimasi CKD-EPI 2021 hanya bila tersedia kreatinin serum, usia dewasa, dan jenis
  kelamin. Ureum saja tidak cukup untuk menghitung eGFR.

### Nilai dropdown spreadsheet

`Status MCU` (kolom H):

- `Pre Employee`
- `Annual`
- `Specific`
- `Retirement`
- `Follow Up - Pre Employee`
- `Follow Up - Annual`

`Kesimpulan Vendor` (kolom DF):

- `Fit To Work`
- `Fit With Note`
- `Fit With Restriction`
- `Currently Unfit`
- `Unfit`
- `Temporary Unfit`

`Rekomendasi QSHE Medic` (kolom DG) juga merupakan dropdown dengan pilihan:

- `Fit To Work`
- `Fit With Note`
- `Fit With Restriction`
- `Currently Unfit`
- `Unfit`
- `Temporary Unfit`

`Rekomendasi follow up` (kolom DJ) adalah dropdown multi-select. Pilih nilai yang
sesuai dari daftar berikut:

- Dokter Umum
- Dokter Sp. PD
- Dokter Sp. JP
- Dokter Sp. P
- Dokter Sp. M
- Dokter Sp. GK / Ahli Gizi
- Psikiatri / Psikolog
- Dokter Gigi
- Dokter Sp. THT
- Dokter Sp. B
- Dokter Sp. U
- Dokter Sp. OT
- Dokter Sp. KK
- Pertahankan Kondisi Tubuh Bugar Dengan Diet Sehat & Rutin Olahraga

`Item Follow Up` (kolom DK) adalah hasil formula spreadsheet dari temuan MCU.
Jangan mengarang atau menggantinya dengan rekomendasi baru. `Perlu Follow Up?`
adalah nilai `Ya` atau `Tidak` dari kolom DI/dokumen.

Kesimpulan Setelah Follow Up I, II, dan III menggunakan pilihan yang sama dengan
`Rekomendasi QSHE Medic`.

Mode ekstraksi OCR yang direkomendasikan adalah Gemini 3.8 Flash untuk PDF MCU
lengkap dan Gemini 3.5 Flash Lite sebagai pilihan lebih ringan/kuota RPM lebih
longgar sesuai tangkapan layar. Angka kuota dapat berubah mengikuti API key.
Model kategori Live tidak dipakai untuk OCR ini karena ekstraksi memerlukan respons
JSON satu kali, bukan sesi real-time.

### Format pemeriksaan khusus

Spirometri:

`FVC (Pred, Act, %), FEV1 (Pred, Act, %), FEV1/FVC (Pred, Act, %) -> interpretasi`

Audiometri:

`ACR: 500:nilai, 1K:nilai, 2K:nilai, 3K:nilai, 4K:nilai, 6K:nilai, 8K:nilai -> interpretasi`

`ACL: 500:nilai, 1K:nilai, 2K:nilai, 3K:nilai, 4K:nilai, 6K:nilai, 8K:nilai -> interpretasi`

ACR adalah telinga kanan dan ACL telinga kiri. Pemeriksaan yang belum memiliki
field khusus baru boleh dimasukkan ke `Pemeriksaan Lain`.

### Output

Setelah tabel, tambahkan `Catatan Tambahan` yang hanya merangkum temuan abnormal
dan saran yang benar-benar tertulis pada dokumen. Jangan mengisi `catatan`.
