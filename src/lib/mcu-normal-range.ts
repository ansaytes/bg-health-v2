// ============================================================
// Parser rentang nilai normal — Jalur 1 (standar Indonesia)
// ============================================================
//
// MENGAPA MODUL INI ADA
// ----------------------------------------------------------------
// `MCU_FIELDS` menyimpan nilai normal sebagai TEKS: '90-119', '<200', '≥50',
// '4,5-6,2'. Fungsi lama `isAbnormalRecord()` hanya membaca `field.low` /
// `field.high` — dan ternyata hanya 2 dari 65 field numerik yang punya keduanya
// (`nadi`, `bmi`). Artinya 32 field (TD, GDP, LDL, SGOT, HbA1c, …) TIDAK PERNAH
// terdeteksi abnormal.
//
// Modul ini mengubah teks rentang menjadi ambang numerik, sehingga Jalur 1
// (standar rujukan Indonesia) benar-benar bekerja.
//
// FORMAT YANG DIDUKUNG
//   '90-119'      → inklusif 90..119
//   '4,5-6,2'     → koma desimal Indonesia
//   '<200'        → di bawah 200 (200 masih normal)
//   '≤200'        → sampai dengan 200
//   '≥50'         → 50 ke atas
//   '>50'         → di atas 50
//   '<6,5'        → desimal
//   '70-100'
//
// PENTING — BEDA '<' DAN '≤'
//   '<200'  → 200 masih NORMAL, 201 abnormal
//   '≤200'  → 200 masih normal, 201 abnormal (sama, karena ≤ inklusif)
// Perbedaan sebenarnya hanya pada notasi batas eksklusif vs inklusif. Parser
// memakai perbandingan `<` untuk format '<' dan `<=` untuk format '≤'.
//
// GENDER
//   Banyak field punya rentang berbeda per jenis kelamin (hb, au, lp).
//   Urutan prioritas: normalMale/normalFemale → normalRange.
//   Bila gender tidak diketahui, dipakai rentang TERLONGGAR (gabungan), agar
//   tidak menandai abnormal secara palsu hanya karena jenis kelamin kosong.

import { detectGender, type Gender } from '@/lib/clinical-classification';

export interface AmbangNormal {
  /** Batas bawah; null = tidak dibatasi. */
  low: number | null;
  /** Batas atas; null = tidak dibatasi. */
  high: number | null;
  /** true bila batas bawah inklusif (default true). */
  lowInclusive: boolean;
  /** true bila batas atas inklusif (default true). */
  highInclusive: boolean;
  /** Teks yang diparse, untuk ditampilkan di form. */
  sumber: string;
}

/** Mengubah '4,5' / '4.5' / ' 90 ' menjadi angka, atau null. */
export function angkaDari(teks: string): number | null {
  const bersih = String(teks ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!bersih) return null;
  const n = Number(bersih);
  return Number.isFinite(n) ? n : null;
}

/**
 * Memparse satu teks rentang. Mengembalikan null bila format tidak dikenali,
 * sehingga pemanggil bisa memutuskan untuk tidak menandai apa pun (lebih baik
 * diam daripada salah menandai abnormal).
 */
export function parseRentang(teks: string | null | undefined): AmbangNormal | null {
  const raw = String(teks ?? '').trim();
  if (!raw) return null;

  // Buang satuan/embel-embel setelah spasi: '90-119 mmHg' → '90-119'
  const bersih = raw.split(/\s+/)[0];

  // ── Rentang 'a-b' ────────────────────────────────────────────
  // Pola harus menyertakan tanda minus DI ANTARA dua angka, bukan minus
  // sebagai tanda negatif.
  const rentang = bersih.match(/^(-?\d+(?:[.,]\d+)?)\s*[-–—]\s*(-?\d+(?:[.,]\d+)?)$/);
  if (rentang) {
    const low = angkaDari(rentang[1]);
    const high = angkaDari(rentang[2]);
    if (low === null || high === null) return null;
    return { low, high, lowInclusive: true, highInclusive: true, sumber: raw };
  }

  // ── Batas atas: '<200', '≤200', '<=200' ──────────────────────
  const kurang = bersih.match(/^(<|≤|<=)\s*(-?\d+(?:[.,]\d+)?)$/);
  if (kurang) {
    const high = angkaDari(kurang[2]);
    if (high === null) return null;
    const inklusif = kurang[1] === '≤' || kurang[1] === '<=';
    return {
      low: null,
      high,
      lowInclusive: true,
      // '<' berarti batas TIDAK inklusif: nilai tepat 200 masih normal.
      highInclusive: inklusif,
      sumber: raw,
    };
  }

  // ── Batas bawah: '≥50', '>50', '>=50' ────────────────────────
  const lebih = bersih.match(/^(≥|>|>=)\s*(-?\d+(?:[.,]\d+)?)$/);
  if (lebih) {
    const low = angkaDari(lebih[2]);
    if (low === null) return null;
    const inklusif = lebih[1] === '≥' || lebih[1] === '>=';
    return { low, high: null, lowInclusive: inklusif, highInclusive: true, sumber: raw };
  }

  return null;
}

/** true bila `nilai` berada di dalam ambang. */
export function dalamRentang(nilai: number, ambang: AmbangNormal): boolean {
  if (ambang.low !== null) {
    if (ambang.lowInclusive ? nilai < ambang.low : nilai <= ambang.low) return false;
  }
  if (ambang.high !== null) {
    if (ambang.highInclusive ? nilai > ambang.high : nilai >= ambang.high) return false;
  }
  return true;
}

export interface FieldRentang {
  normalRange?: string;
  normalMale?: string;
  normalFemale?: string;
  low?: number;
  high?: number;
  lowMale?: number;
  highMale?: number;
  lowFemale?: number;
  highFemale?: number;
}

/**
 * Menentukan ambang normal satu field untuk jenis kelamin tertentu.
 *
 * Urutan prioritas:
 *  1. low/high numerik per gender (bila sudah diisi eksplisit)
 *  2. normalMale / normalFemale (teks)
 *  3. normalRange (teks, berlaku umum)
 *
 * Bila gender 'unknown' dan hanya ada rentang per-gender, dipakai GABUNGAN
 * keduanya (batas paling longgar) — lihat komentar di bawah.
 */
export function ambangField(field: FieldRentang, gender?: string | number | null): AmbangNormal | null {
  const g: Gender = detectGender(gender ?? '');

  if (g === 'male') {
    if (field.lowMale !== undefined || field.highMale !== undefined) {
      return {
        low: field.lowMale ?? null,
        high: field.highMale ?? null,
        lowInclusive: true, highInclusive: true,
        sumber: `pria ${field.lowMale ?? '−'}–${field.highMale ?? '−'}`,
      };
    }
    if (field.normalMale) {
      const a = parseRentang(field.normalMale);
      if (a) return a;
    }
  }

  if (g === 'female') {
    if (field.lowFemale !== undefined || field.highFemale !== undefined) {
      return {
        low: field.lowFemale ?? null,
        high: field.highFemale ?? null,
        lowInclusive: true, highInclusive: true,
        sumber: `wanita ${field.lowFemale ?? '−'}–${field.highFemale ?? '−'}`,
      };
    }
    if (field.normalFemale) {
      const a = parseRentang(field.normalFemale);
      if (a) return a;
    }
  }

  // Ambang numerik umum.
  if (field.low !== undefined || field.high !== undefined) {
    return {
      low: field.low ?? null,
      high: field.high ?? null,
      lowInclusive: true, highInclusive: true,
      sumber: `${field.low ?? '−'}–${field.high ?? '−'}`,
    };
  }

  // Gender tidak diketahui & hanya tersedia rentang per-gender:
  // pakai gabungan TERLONGGAR agar tidak menandai abnormal palsu.
  if (g === 'unknown' && (field.normalMale || field.normalFemale)) {
    const pria = parseRentang(field.normalMale);
    const wanita = parseRentang(field.normalFemale);
    if (pria && wanita) {
      return {
        low: pilihMin(pria.low, wanita.low),
        high: pilihMax(pria.high, wanita.high),
        lowInclusive: true, highInclusive: true,
        sumber: `gabungan pria/wanita ${field.normalMale} / ${field.normalFemale}`,
      };
    }
    return pria ?? wanita ?? parseRentang(field.normalRange);
  }

  return parseRentang(field.normalRange);
}

function pilihMin(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

function pilihMax(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}

/**
 * Apakah nilai numerik ini DI LUAR rentang normal (Jalur 1)?
 * Mengembalikan null bila rentang tidak dapat diurai — lebih baik tidak
 * menandai apa pun daripada salah menandai.
 */
export function diLuarRentang(
  nilai: number | null,
  field: FieldRentang,
  gender?: string | number | null,
): { abnormal: boolean; ambang: AmbangNormal } | null {
  if (nilai === null) return null;
  const ambang = ambangField(field, gender);
  if (!ambang || (ambang.low === null && ambang.high === null)) return null;
  return { abnormal: !dalamRentang(nilai, ambang), ambang };
}

/** Teks rentang yang siap tampil di form, mis. "90–119 mmHg". */
export function labelRentang(field: FieldRentang, gender?: string | number | null): string {
  const ambang = ambangField(field, gender);
  if (!ambang) return '';
  const { low, high } = ambang;
  if (low !== null && high !== null) return `${fmtAngka(low)}–${fmtAngka(high)}`;
  if (high !== null) return `${ambang.highInclusive ? '≤' : '<'} ${fmtAngka(high)}`;
  if (low !== null) return `${ambang.lowInclusive ? '≥' : '>'} ${fmtAngka(low)}`;
  return '';
}

/** Angka gaya Indonesia: 4.5 → "4,5", 90 → "90". */
export function fmtAngka(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
}
