---
name: mcu-reader
description: "Bacakan hasil MCU dari Google Drive atau PDF ketika pengguna mengetik Bacakan Ini"
---

## Instruksi

Baca seluruh dokumen MCU dan petakan hasil ke field form MCU. Keluarkan satu tabel
Markdown dua kolom (`Item` dan `Hasil`) dengan urutan field form. Jangan membuat
diagnosis, rekomendasi, atau nilai yang tidak ada di dokumen.

### Aturan nilai

- `DBN` hanya untuk pemeriksaan yang dilakukan dan hasilnya normal.
- `N/A` hanya untuk pemeriksaan yang memang tidak dilakukan.
- Frekuensi audiometri yang tidak diperiksa dikosongkan, bukan `N/A`.
- Angka laboratorium dan spirometri ditulis tanpa satuan.
- Desimal menggunakan koma; `8.900` menjadi `8,9`, dan `9.030` menjadi `9,03`.
- Jangan menambahkan `L` pada nilai spirometri.
- Field `catatan` selalu dibiarkan kosong karena hanya untuk input manual.

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

`Rekomendasi Follow Up` (kolom DJ) harus diambil persis dari nilai dropdown:

- Konsultasi dan terapi ke Dokter Umum
- Konsultasi dan terapi ke Dokter Sp. PD
- Konsultasi dan terapi ke Dokter Sp. JP
- Konsultasi dan terapi ke Dokter Sp. P
- Konsultasi dan terapi ke Dokter Sp. M
- Konsultasi dan terapi ke Dokter Sp. GK / Ahli Gizi
- Konsultasi dan terapi ke Psikiatri / Psikolog
- Konsultasi dan terapi ke Dokter Gigi
- Konsultasi dan terapi ke Dokter Sp. THT
- Konsultasi dan terapi ke Dokter Sp. B
- Konsultasi dan terapi ke Dokter Sp. U
- Konsultasi dan terapi ke Dokter Sp. OT
- Konsultasi dan terapi ke Dokter Sp. KK
- Pertahankan Kondisi Tubuh Bugar Dengan Diet Sehat & Rutin Olahraga

`Item Follow Up` (kolom DK) adalah hasil formula spreadsheet dari temuan MCU.
Jangan mengarang atau menggantinya dengan rekomendasi baru. `Perlu Follow Up?`
adalah nilai `Ya` atau `Tidak` dari kolom DI/dokumen.

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
