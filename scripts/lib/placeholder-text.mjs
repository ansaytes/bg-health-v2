// ============================================================
// Nilai placeholder yang bukan data.
//
// Utamakan berasal dari Excel: saat lookup tidak menemukan kecocokan,
// spreadsheet menulis "#N/A". Nilai itu bukan hasil pemeriksaan, tapi
// karena tetap berupa teks, ia ikut terbaca sebagai data — termasuk
// saat menghitung diagnosis, zonasi, dan Framingham.
//
// Contoh nyata yang sudah ditemukan: satu record punya
// jenis_kelamin = "#N/A", sehingga Framingham tidak bisa dihitung dan
// kolomnya diisi "Cek Parameter". Setelah placeholder dibuang, record
// itu tetap belum punya jenis kelamin — tapi setidaknya tidak
// menyamar sebagai nilai yang sah, dan akan terlihat di daftar
// MCU yang belum lengkap.
//
// Daftar ini dipakai dua tempat supaya tidak melenceng:
//   - split-sql-and-csv.mjs        (sumber CSV import)
//   - clean-placeholder-text.mjs   (database yang sudah terlanjur terisi)
// ============================================================

/**
 * Perbandingan dilakukan pada bentuk lowercase dan sudah dipangkas.
 * Sengaja TIDAK memuat "tidak ada" atau "kosong" sebagai nilai
 * tersendiri: di sumber CSV, teks itu bisa jadi keterangan yang benar
 * (mis. hasil pemeriksaan yang memang tidak ada), sehingga tidak boleh
 * dibuang diam-diam. Pembersih database boleh lebih longgar karena di
 * sana semua nilai berasal dari Excel.
 */
export const PLACEHOLDER_SPREADSHEET = new Set([
  '#n/a',
  '#n/a n/a',
  '#ref!',
  '#value!',
  '#div/0!',
  '#name?',
  '#num!',
  '#null!',
  '#na',
  '#value',
  'null',
  'undefined',
  'nan',
]);

/** True bila nilai sel dipastikan bukan data hasil pemeriksaan. */
export function adalahPlaceholder(nilai) {
  if (nilai == null) return false;
  const t = String(nilai).trim().toLowerCase();
  return t !== '' && PLACEHOLDER_SPREADSHEET.has(t);
}

/**
 * Mengembalikan null untuk placeholder, atau nilai aslinya.
 *
 * Dipakai saat membangun baris sebelum calculateRecord, supaya engine
 * memperlakukan sel kosong — bukan sel berisi "#N/A" — saat menghitung
 * diagnosis, zonasi, dan Framingham.
 */
export function bersihkanPlaceholder(nilai) {
  return adalahPlaceholder(nilai) ? null : nilai;
}