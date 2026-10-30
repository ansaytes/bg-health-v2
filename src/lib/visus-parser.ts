// ============================================================
// Parser visus OD / OS — data nyata lapangan
// ============================================================
//
// MASALAH
// ----------------------------------------------------------------
// `parseVisualAcuity()` lama hanya mengambil SATU rasio dari string, lalu
// mengabaikan sisanya. Padahal data MCU di lapangan menulis kedua mata dalam
// satu sel, dengan variasi penulisan yang sangat banyak:
//
//   "VOD 6/6 VOS 6/6"
//   "VOD 20/20 VOS 20/20"
//   "VOD 20/20 VOS 20/15"          ← OS lebih baik dari OD
//   "VOD 20/40 VOS 20/50 VODS 20/50"   ← ada VODS (dengan koreksi)
//
// Akibatnya untuk "VOD 20/40 VOS 20/50", fungsi lama memakai 20/40 dan
// membuang 20/50. STD/006 menilai MATA TERBAIK, jadi pilihan yang benar
// bergantung mana yang lebih baik — bukan mana yang ditulis lebih dulu.
//
// DAMPAK PADA ZONA (nyata, bukan teoretis)
//   "VOD 6/24 VOS 6/12" → ambil pertama (6/24 = 0,25) = MERAH
//                       → mata terbaik (6/12 = 0,50) = KUNING
//
// MODUL INI
//   1. Memisahkan nilai OD (kanan) dan OS (kiri).
//   2. Menormalkan notasi 6/x dan 20/y ke desimal yang sama.
//   3. Memilih MATA TERBAIK untuk klasifikasi zona (STD/006 Bab 7).
//   4. Menyimpan keduanya agar bisa dicetak: "OD : 6/20 OS : 6/15".
// ============================================================

import { parseVisualAcuity, type VisionResult } from '@/lib/clinical-classification';

export interface VisusMata {
  /** Nilai mentah yang tertangkap, mis. "6/20". */
  mentah: string | null;
  /** Desimal (1,0 = normal). */
  desimal: number | null;
  /** Notasi Snellen seragam, mis. "6/20". */
  snellen: string | null;
  /** true bila tertulis dengan koreksi (VODS / S.C. / with correction). */
  terkoreksi: boolean;
}

export interface VisusPerMata {
  od: VisusMata;
  os: VisusMata;
  /** Mata terbaik (desimal tertinggi) — dasar klasifikasi STD/006. */
  terbaik: VisusMata;
  /** true bila string memuat dua mata terpisah. */
  duaMata: boolean;
  /** Teks siap cetak: "OD : 6/20 OS : 6/15". */
  label: string;
}

const KOSONG: VisusMata = { mentah: null, desimal: null, snellen: null, terkoreksi: false };

/**
 * Mengubah satu potongan nilai rasio/desimal menjadi VisusMata.
 * Memakai `parseVisualAcuity()` yang sudah ada agar konsisten dengan engine.
 */
function keMata(potongan: string | null): VisusMata {
  if (!potongan) return KOSONG;
  const bersih = potongan.trim();
  if (!bersih) return KOSONG;
  const parsed: VisionResult = parseVisualAcuity(bersih);
  if (parsed.decimal === null) return { ...KOSONG, mentah: bersih };
  return {
    mentah: bersih,
    desimal: parsed.decimal,
    snellen: parsed.snellen,
    terkoreksi: parsed.corrected,
  };
}

/**
 * Memisahkan visus OD dan OS dari teks bebas.
 *
 * Strategi:
 *  1. Cari penanda mata: VOD/OD (kanan) dan VOS/OS (kiri), termasuk VODS.
 *  2. Bila tidak ada penanda, ambil dua rasio pertama sebagai OD & OS
 *     (urutan lazim penulisan: kanan lalu kiri).
 *  3. Bila hanya ada satu nilai, anggap berlaku untuk kedua mata.
 */
export function parseVisusPerMata(raw: string | number | null | undefined): VisusPerMata {
  const teks = String(raw ?? '').trim();
  if (!teks) {
    return { od: KOSONG, os: KOSONG, terbaik: KOSONG, duaMata: false, label: '—' };
  }

  // VODS/VOSS = dengan koreksi; VOD/VOS tanpa koreksi.
  // Urutan regex penting: VODS harus dicoba sebelum VOD agar tidak terpotong.
  const polaOD = /(?:VODS?|ODS?)\s*[:.]?\s*((?:\d+\s*\/\s*\d+)|(?:\d+[.,]\d+))/i;
  const polaOS = /(?:VOSS?|OS)\s*[:.]?\s*((?:\d+\s*\/\s*\d+)|(?:\d+[.,]\d+))/i;

  const odMatch = teks.match(polaOD);
  const osMatch = teks.match(polaOS);

  let od = keMata(odMatch?.[1] ?? null);
  let os = keMata(osMatch?.[1] ?? null);
  const duaMata = Boolean(odMatch && osMatch);

  // Fallback: tidak ada penanda mata → ambil rasio berurutan.
  if (!duaMata) {
    const semuaRasio = [...teks.matchAll(/(\d+)\s*\/\s*(\d+)/g)].map((m) => m[0]);
    if (semuaRasio.length >= 2) {
      od = keMata(semuaRasio[0]);
      os = keMata(semuaRasio[1]);
    } else if (semuaRasio.length === 1) {
      // Satu nilai → berlaku kedua mata.
      od = keMata(semuaRasio[0]);
      os = od;
    } else {
      // Mungkin desimal tunggal (1,0).
      const desimal = teks.match(/\d+[.,]\d+/)?.[0] ?? null;
      od = keMata(desimal);
      os = od;
    }
  }

  // Mata terbaik: desimal tertinggi. Bila sama-sama kosong → kosong.
  let terbaik = KOSONG;
  if (od.desimal !== null && os.desimal !== null) {
    terbaik = od.desimal >= os.desimal ? od : os;
  } else {
    terbaik = od.desimal !== null ? od : os.desimal !== null ? os : KOSONG;
  }

  // Label siap cetak. Hanya tulis mata yang punya nilai.
  const bagian: string[] = [];
  if (od.mentah) bagian.push(`OD : ${od.mentah}`);
  if (os.mentah) bagian.push(`OS : ${os.mentah}`);
  const label = bagian.length ? bagian.join(' ') : teks;

  return { od, os, terbaik, duaMata, label };
}

/**
 * Nilai yang dipakai ENGINE untuk klasifikasi visus jauh.
 *
 * STD/006 menilai "visus terkoreksi pada mata terbaik", jadi yang dikembalikan
 * adalah notasi Snellen mata terbaik — bukan rasio pertama yang ditemukan.
 */
export function visusUntukEngine(raw: string | number | null | undefined): string {
  const hasil = parseVisusPerMata(raw);
  if (hasil.terbaik.desimal === null) return String(raw ?? '');
  return hasil.terbaik.snellen ?? String(raw ?? '');
}

/** Kategori STD/006 dari visus per mata. */
export function kategoriVisus(raw: string | number | null | undefined): {
  kategori: 'normal' | 'ringan' | 'berat' | 'tidak-diuji' | 'tidak-dinilai';
  terbaik: VisusMata;
  label: string;
} {
  const hasil = parseVisusPerMata(raw);
  const d = hasil.terbaik.desimal;
  if (d === null) {
    return { kategori: 'tidak-dinilai', terbaik: hasil.terbaik, label: hasil.label };
  }
  // ── Ambang memakai perbandingan SILANG, bukan selisih float ──────────
  //
  // Masalah yang diselesaikan: "6/18" menghasilkan desimal 0,3333… dan
  // `6/18` di JS juga 0,3333…, tetapi lewat dua pembulatan berbeda (parse →
  // toFixed(2) → dibandingkan lagi) selisihnya bisa ~1e-16. Toleransi 1e-9
  // ternyata tidak cukup untuk sebagian jalur, sehingga 6/18 — yang menurut
  // STD/006 masih Zona Kuning (rentang 6/12–6/18) — bisa jatuh ke Merah.
  //
  // Perbandingan silang (pembilang × penyebut) bebas galat sepenuhnya:
  //   desimal ≥ 6/9   ⇔   desimal × 9 ≥ 6
  //   desimal ≥ 6/18  ⇔   desimal × 18 ≥ 6
  // Toleransi 5e-4 menyerap pembulatan 4 desimal (6 × 1e-4) tanpa membuat
  // 6/24 (0,25) terbaca sebagai 6/18.
  const EPS = 2e-3;
  const kategori = (d * 9 >= 6 - EPS)
    ? 'normal'
    : (d * 18 >= 6 - EPS)
      ? 'ringan'
      : 'berat';
  return { kategori, terbaik: hasil.terbaik, label: hasil.label };
}
