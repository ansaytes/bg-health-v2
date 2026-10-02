// ============================================================
// Kesimpulan hasil kuesioner dalam bahasa sehari-hari
// ============================================================
//
// Modul ini mengubah angka hasil kuesioner menjadi kalimat yang bisa dibaca
// karyawan yang mengisinya sendiri. Dipisah dari route API supaya aturannya
// bisa diuji tanpa database, dan supaya hanya ada satu salinan.
//
// KENAPA HARUS ADA LAPISAN INI
//
// Skor DASS-21 dan SRQ-20 tidak bisa ditampilkan mentah. Angka 18 tidak
// berarti apa pun bagi karyawan: tidak jelas apakah itu normal, dan tidak
// jelas apakah perlu ditindaklanjuti. Yang ditampilkan di popup adalah
// kesimpulan beserta efeknya terhadap zona MCU.
//
// HUBUNGAN KE STD-006 Rev001
//
// Ambang di sini WAJIB sama dengan yang dipakai zonasi-engine.ts, karena
// kesimpulan yang ditampilkan harus cocok dengan zona yang akhirnya tersimpan
// di mcu_records. Kalau keduanya berbeda, karyawan melihat "Perlu dipantau"
// padahal zonanya Merah. Parameter yang terpengaruh:
//
//   Parameter GANGUAN TIDUR (ESS)
//     Hijau  < 11
//     Kuning 11 sampai 15
//     Merah  > 15
//
//   Parameter KESEHATAN MENTAL (SRQ-20 / DASS-21 / SDS)
//     SRQ-20 6 atau lebih   -> Possible Mental Disorder -> Kuning
//     DASS-21 "berat"        -> Yellow Flag             -> Kuning
//     DASS-21 "sangat berat" -> Red Flag                -> Merah
//     SDS 60 sampai 69       -> Depressive Disorder     -> Kuning
//     SDS 70 atau lebih      -> Depressive Disorder     -> Merah
//
// Ambang DASS-21 ditentukan dari KATEGORI, bukan angka tetap, karena batas
// "berat" tiap subskala berbeda: depresi mulai 22, ansietas 20, stres 26.
// ============================================================

import { dassCategory, type DassCategory } from '@/lib/questionnaire-scores';

export interface KesimpulanEss {
  score: number;
  category: string;
  answered: number;
  total: number;
}

export interface SkorSrq20 {
  score: number;
  category: string;
  answered: number;
}

export interface SkorDass21 {
  depresi: { score: number; category: DassCategory };
  ansietas: { score: number; category: DassCategory };
  stres: { score: number; category: DassCategory };
  answered: number;
}

export interface SkorSds {
  rawIndex: number;
  category: string;
  answered: number;
}

/**
 * Kesimpulan untuk Epworth Sleepiness Scale.
 *
 * Batas 15 punya makna keselamatan, jadi disebut eksplisit: di atasnya
 * karyawan dinyatakan tidak layak mengoperasikan alat berat atau bekerja pada
 * shift malam. Menyembunyikan angka itu di balik kalimat "perlu dipantau"
 * akan berisiko keselamatan, jadi kalimatnya langsung menyebutkannya.
 */
export function kesimpulanEss(result: KesimpulanEss): string {
  if (result.answered < result.total) {
    return `Skor sementara ${result.score} dari ${result.answered} item yang terisi. `
      + 'Jawaban belum lengkap, jadi hasil ini belum dapat dipakai sebagai dasar penilaian. '
      + 'Lengkapi kedelapan item lalu simpan kembali.';
  }
  if (result.category === 'berat') {
    return `Kantuk berlebihan di siang hari dalam tingkatan berat (ESS ${result.score}). `
      + 'Sesuai STD-006 Rev001, hasil ini berarti tidak layak mengoperasikan alat berat '
      + 'atau bekerja pada shift malam. Segera laporkan ke petugas QSHE untuk tindak lanjut.';
  }
  if (result.category === 'ringan-sedang') {
    return `Kantuk berlebihan di siang hari dalam tingkatan ringan sampai sedang (ESS ${result.score}). `
      + 'Gejala ini dapat mengganggu konsentrasi dan kewaspadaan. Evaluasi kualitas tidur dan '
      + 'kurangi jam kerja malam; bila berlanjut, jadwalkan pemeriksaan.';
  }
  return `Tidak ditemukan kantuk berlebihan di siang hari (ESS ${result.score}). `
    + 'Jaga aturan tidur dan waktu istirahat agar hasil ini tetap baik.';
}

/**
 * Kesimpulan gabungan untuk SRQ-20, DASS-21, dan Zung SDS.
 *
 * Hanya instrumen yang benar-benar diisi yang ikut dihitung dalam kesimpulan.
 * Skor 0 pada DASS-21 berarti "tidak ada gejala", bukan "tidak menjawab".
 * Mencantumkan 0 untuk instrumen yang tidak diisi akan menyesatkan pembaca.
 */
export function kesimpulanSrqDass(
  srq: SkorSrq20,
  dass: SkorDass21,
  sds: SkorSds,
  perluRujukan: boolean,
): string {
  const merah: string[] = [];
  const kuning: string[] = [];

  if (srq.answered > 0 && srq.category === 'perlu-tindak-lanjut') {
    kuning.push(`SRQ-20 ${srq.score} - ada kemungkinan gangguan mental emosional`);
  }

  const domains: [string, { score: number; category: DassCategory }][] = [
    ['depresi', dass.depresi],
    ['ansietas', dass.ansietas],
    ['stres', dass.stres],
  ];
  for (const [nama, hasil] of domains) {
    if (hasil.category === 'sangat-berat') merah.push(`DASS-21 ${nama} sangat berat (${hasil.score})`);
    else if (hasil.category === 'berat') kuning.push(`DASS-21 ${nama} berat (${hasil.score})`);
  }

  if (sds.answered > 0 && sds.rawIndex >= 70) merah.push(`SDS ${sds.rawIndex} - gejala depresi berat`);
  else if (sds.answered > 0 && sds.rawIndex >= 60) kuning.push(`SDS ${sds.rawIndex} - gejala depresi sedang`);

  if (merah.length > 0) {
    return `Perlu tindakan segera. ${merah.join('; ')}. `
      + 'Hasil ini wajib dikonfirmasi tenaga kesehatan dan tidak boleh dipakai sebagai dasar '
      + 'keputusan tanpa pemeriksaan klinis.';
  }
  if (kuning.length > 0) {
    return `Perlu pemantauan dan tindak lanjut. ${kuning.join('; ')}. `
      + 'Gejala ini hasil skrining, bukan diagnosis - mohon konfirmasi kepada tenaga kesehatan.';
  }
  return perluRujukan
    ? 'Tidak ada skor yang masuk kategori berat, tapi tetap ada anjuran untuk diperiksa.'
    : 'Tidak ditemukan gejala yang perlu tindak lanjut dari instrumen yang diisi. '
      + 'Tetap jaga tidur, kelola stres, dan cari bantuan lebih awal bila keluhan berlanjut.';
}

/**
 * Mengembalikan 'Merah' atau 'Kuning' bila hasil kuesioner semestinya menggeser
 * zona MCU, atau null bila tidak.
 *
 * Dipakai oleh skrip verifikasi untuk memastikan angka kesimpulan, ambang
 * kategori, dan hasil zonasi engine benar-benar sepakat satu sama lain. Kalau
 * ketiganya menyimpang, yang salah biasanya angka di modul ini.
 */
export function zonaDariKuesioner(
  dass: SkorDass21,
  sds: SkorSds,
  srq: SkorSrq20,
): 'Merah' | 'Kuning' | null {
  if (dass.depresi.category === 'sangat-berat'
    || dass.ansietas.category === 'sangat-berat'
    || dass.stres.category === 'sangat-berat') {
    return 'Merah';
  }
  if (sds.answered > 0 && sds.rawIndex >= 70) return 'Merah';
  if (srq.answered > 0 && srq.category === 'perlu-tindak-lanjut') return 'Kuning';
  if (dassCategory('depresi', dass.depresi.score) === 'berat'
    || dassCategory('ansietas', dass.ansietas.score) === 'berat'
    || dassCategory('stres', dass.stres.score) === 'berat') {
    return 'Kuning';
  }
  if (sds.answered > 0 && sds.rawIndex >= 60) return 'Kuning';
  return null;
}