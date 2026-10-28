// ============================================================
// Kebutuhan Kalori & Gizi Kerja — AKG 2019
// ============================================================
//
// DASAR
//  • BG/QSHE/SOP/028 poin 5.7 menyebut "Gizi Kerja" sebagai bagian pengelolaan
//    kesehatan kerja, merujuk BG/QSHE/STD/031 (Pengelolaan Makanan, Minuman,
//    Gizi Karyawan) — dokumen itu belum tersedia.
//  • Karena STD/031 belum ada, perhitungan memakai AKG Kemenkes RI 2019
//    (Peraturan Menteri Kesehatan No. 28 Tahun 2019) sebagai acuan resmi
//    nasional. Ini SAMA dengan yang Anda setujui.
//
// DEFINISI GIZI KERJA (SOP/028 poin 4.8)
// "pemenuhan nutrisi dan zat makanan yang disesuaikan dengan KEBUTUHAN KALORI,
//  JENIS PEKERJAAN, dan BEBAN KERJA tenaga kerja" — jadi perhitungan harus
// memperhitungkan aktivitas kerja, bukan hanya AKG dasar.
//
// METODE
//  1. BMR (Mifflin–St Jeor) — rumus yang dipakai Widya Pangan dan Gizi (WNPG)
//     dan lazim pada praktik gizi kerja Indonesia (lebih akurat daripada
//     Harris-Benedict pada populasi modern).
//  2. Faktor aktivitas berdasarkan beban kerja; nilai ringan/sedang/berat
//     mengikuti klasifikasi beban kerja fisik pada Permenaker 5/2018.
//  3. KEKURANGAN/KELEBIHAN energi dibanding AKG kelompok usia & gender yang
//     sama, agar terlihat apakah asupan pekerjaan sudah sesuai.
//
// BATASAN YANG DISENGAJA
// Ini ALAT PERKIRAAN untuk perencanaan menu kantin & program gizi kerja — bukan
// preskripsi diet. Kebutuhan individu dengan kondisi medis (CKD, diabetes,
// kehamilan, dll.) ditetapkan oleh dokter/ahli gizi, bukan oleh aplikasi.
// ============================================================

export type BebanKerja = 'ringan' | 'sedang' | 'berat' | 'sangat-berat';

/**
 * Faktor aktivitas fisik (PAL) menurut beban kerja.
 *
 * Rujukan: Kemenkes RI Pedoman Gizi Seimbang & klasifikasi beban kerja fisik
 * Permenaker No. 5/2018 (Lampiran, pengukuran denyut nadi kerja):
 *   ringan        < 100 denyut/menit
 *   sedang        100–125
 *   berat         125–150
 *   sangat berat  > 150
 */
export const FAKTOR_AKTIVITAS: Record<BebanKerja, { faktor: number; label: string; denyut: string }> = {
  ringan: { faktor: 1.55, label: 'Ringan', denyut: '< 100 denyut/menit (kerja kantor)' },
  sedang: { faktor: 1.70, label: 'Sedang', denyut: '100–125 denyut/menit (kerja lapangan)' },
  berat: { faktor: 2.00, label: 'Berat', denyut: '125–150 denyut/menit (angkat/angkut)' },
  'sangat-berat': { faktor: 2.20, label: 'Sangat Berat', denyut: '> 150 denyut/menit (kerja fisik terus-menerus)' },
};

export interface ProfilKalori {
  /** 'male' | 'female' */
  jenisKelamin: string;
  usia: number;
  beratKg: number;
  tinggiCm: number;
  bebanKerja: BebanKerja;
}

export interface HasilKalori {
  bmr: number;
  /** Kebutuhan energi total per hari, dibulatkan ke 50 kkal terdekat. */
  kebutuhanKkal: number;
  faktorAktivitas: number;
  imt: number;
  statusGizi: string;
  /** AKG acuan untuk kelompok usia & gender yang sama. */
  akgAcuan: number | null;
  /** Selisih kebutuhan kerja vs AKG (positif = butuh lebih banyak). */
  selisihAkg: number | null;
  /** Catatan yang wajib dibaca agar angka tidak disalahartikan. */
  catatan: string[];
  /** Rincian makro perkiraan untuk perencanaan menu. */
  makro: {
    proteinG: number;
    lemakG: number;
    karbohidratG: number;
  };
}

/**
 * AKG 2019 — Angka Kecukupan Energi (kkal/hari) menurut kelompok umur & gender.
 * Nilai untuk aktivitas SEDANG sesuai tabel AKG.
 *
 * Tabel lengkap AKG memuat 4 tingkat aktivitas; yang dipakai di sini adalah
 * tingkat sedang karena menjadi acuan umum. Perbedaan beban kerja tetap
 * dihitung lewat faktor aktivitas pada BMR.
 */
const AKG_ENERGI: { maxUsia: number; male: number; female: number }[] = [
  { maxUsia: 18, male: 2650, female: 2100 },
  { maxUsia: 29, male: 2650, female: 2250 },
  { maxUsia: 49, male: 2550, female: 2150 },
  { maxUsia: 64, male: 2400, female: 2000 },
  { maxUsia: 80, male: 2100, female: 1750 },
  { maxUsia: 200, male: 1900, female: 1600 },
];

export function akgEnergi(usia: number, jenisKelamin: string): number | null {
  if (!Number.isFinite(usia) || usia <= 0) return null;
  const baris = AKG_ENERGI.find((r) => usia <= r.maxUsia);
  if (!baris) return null;
  const female = /perem|female|^p$/i.test(String(jenisKelamin));
  return female ? baris.female : baris.male;
}

/**
 * BMR — Mifflin–St Jeor (1990).
 *
 *   Pria   : 10×BB + 6,25×TB − 5×usia + 5
 *   Wanita : 10×BB + 6,25×TB − 5×usia − 161
 */
export function hitungBMR(beratKg: number, tinggiCm: number, usia: number, jenisKelamin: string): number | null {
  if (!beratKg || !tinggiCm || !usia) return null;
  const female = /perem|female|^p$/i.test(String(jenisKelamin));
  const base = 10 * beratKg + 6.25 * tinggiCm - 5 * usia;
  return Math.round(female ? base - 161 : base + 5);
}

/** IMT dan status gizi menurut ambang Asia-Pasifik (Kemenkes, dipakai STD/006). */
export function hitungIMT(beratKg: number, tinggiCm: number): { imt: number; status: string } | null {
  if (!beratKg || !tinggiCm) return null;
  const h = tinggiCm / 100;
  const imt = Number((beratKg / (h * h)).toFixed(1));
  const status = imt < 18.5 ? 'Kurus' : imt < 23 ? 'Normal' : imt < 25 ? 'Overweight' : imt < 30 ? 'Obesitas I' : 'Obesitas II';
  return { imt, status };
}

/**
 * Menghitung kebutuhan kalori kerja.
 *
 * Pembulatan 50 kkal karena angka ini dipakai untuk PERENCANAAN MENU, bukan
 * peresepan — presisi 1 kkal tidak bermakna dan memberi kesan lebih akurat
 * daripada kenyataannya.
 */
export function hitungKebutuhanKalori(p: ProfilKalori): HasilKalori | null {
  const bmr = hitungBMR(p.beratKg, p.tinggiCm, p.usia, p.jenisKelamin);
  const imtHasil = hitungIMT(p.beratKg, p.tinggiCm);
  if (bmr === null || imtHasil === null) return null;

  const faktor = FAKTOR_AKTIVITAS[p.bebanKerja]?.faktor ?? 1.55;
  const total = Math.round((bmr * faktor) / 50) * 50;
  const akg = akgEnergi(p.usia, p.jenisKelamin);

  const catatan: string[] = [
    'Perkiraan untuk perencanaan menu & program gizi kerja — bukan preskripsi diet.',
    `Faktor aktivitas ${faktor} untuk beban kerja ${FAKTOR_AKTIVITAS[p.bebanKerja].label} (${FAKTOR_AKTIVITAS[p.bebanKerja].denyut}).`,
  ];
  if (imtHasil.imt >= 25) {
    catatan.push(`IMT ${imtHasil.imt} (${imtHasil.status}) — pertimbangkan konseling gizi individual, tidak cukup hanya penyesuaian menu.`);
  }
  if (akg !== null) {
    catatan.push(`AKG 2019 kelompok usia ${p.usia} th (aktivitas sedang) = ${akg} kkal/hari.`);
  }

  // Distribusi makro acuan gizi seimbang: protein 15%, lemak 25%, karbo 60%.
  // Rentang ini mengikuti Pedoman Gizi Seimbang Kemenkes (PGS 2014), yang
  // pembagiannya juga dipakai AKG.
  return {
    bmr,
    kebutuhanKkal: total,
    faktorAktivitas: faktor,
    imt: imtHasil.imt,
    statusGizi: imtHasil.status,
    akgAcuan: akg,
    selisihAkg: akg === null ? null : total - akg,
    catatan,
    makro: {
      // 4 kkal/g protein & karbo, 9 kkal/g lemak.
      proteinG: Math.round((total * 0.15) / 4),
      lemakG: Math.round((total * 0.25) / 9),
      karbohidratG: Math.round((total * 0.60) / 4),
    },
  };
}

/** Menebak beban kerja dari jabatan — hanya saran awal, QSHE Medic memutuskan. */
export function sarankanBebanKerja(jabatan: string | null | undefined): BebanKerja {
  const j = String(jabatan ?? '').toLowerCase();
  if (/operator|drill|haul|excavat|dumptruck|driver|pengemudi|loader/.test(j)) return 'sedang';
  if (/helper|angkat|manual|gudang|logistik|buruh|cleaning|cs\b/.test(j)) return 'berat';
  if (/manager|supervisor|admin|analis|staf|staff|engineer|draf/.test(j)) return 'ringan';
  return 'sedang';
}
