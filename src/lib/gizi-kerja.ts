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

// ============================================================
// Master Data Komposisi Bahan Makanan (DKBM) Kemenkes RI
// ============================================================
// Dasar: Tabel Komposisi Pangan Indonesia (TKPI) / DKBM Kemenkes RI
// Nilai gizi dihitung per 100 gram bahan matang / porsi katering siap saji.

export interface ItemDKBM {
  id: string;
  nama: string;
  kategori: 'Karbohidrat' | 'Lauk Hewani' | 'Lauk Nabati' | 'Sayuran' | 'Buah' | 'Ekstra / Pelengkap';
  kaloriPer100g: number;
  proteinPer100g: number;
  lemakPer100g: number;
  karbohidratPer100g: number;
  porsiUmum: string;
}

export const DEFAULT_DKBM_SEED: ItemDKBM[] = [
  // ── Makanan Pokok / Karbohidrat ──
  { id: 'nasi-putih', nama: 'Nasi Putih Pulen', kategori: 'Karbohidrat', kaloriPer100g: 130, proteinPer100g: 2.7, lemakPer100g: 0.3, karbohidratPer100g: 28.2, porsiUmum: '1 centong = 100g' },
  { id: 'nasi-merah', nama: 'Nasi Merah', kategori: 'Karbohidrat', kaloriPer100g: 111, proteinPer100g: 2.6, lemakPer100g: 0.9, karbohidratPer100g: 23.5, porsiUmum: '1 centong = 100g' },
  { id: 'nasi-goreng', nama: 'Nasi Goreng Telur/Ayam', kategori: 'Karbohidrat', kaloriPer100g: 168, proteinPer100g: 4.5, lemakPer100g: 6.2, karbohidratPer100g: 23.8, porsiUmum: '1 piring = 200g' },
  { id: 'kentang-rebus', nama: 'Kentang Kukus / Rebus', kategori: 'Karbohidrat', kaloriPer100g: 87, proteinPer100g: 1.9, lemakPer100g: 0.1, karbohidratPer100g: 20.1, porsiUmum: '1 buah sedang = 100g' },
  { id: 'mie-goreng', nama: 'Mie Goreng Telur', kategori: 'Karbohidrat', kaloriPer100g: 175, proteinPer100g: 4.8, lemakPer100g: 6.8, karbohidratPer100g: 24.0, porsiUmum: '1 porsi = 150g' },
  { id: 'bihun-goreng', nama: 'Bihun Goreng Sayur', kategori: 'Karbohidrat', kaloriPer100g: 160, proteinPer100g: 3.2, lemakPer100g: 5.5, karbohidratPer100g: 25.0, porsiUmum: '1 porsi = 120g' },
  { id: 'roti-gandum', nama: 'Roti Tawar Gandum', kategori: 'Karbohidrat', kaloriPer100g: 247, proteinPer100g: 13.0, lemakPer100g: 3.4, karbohidratPer100g: 41.3, porsiUmum: '2 lembar = 70g' },

  // ── Lauk Hewani ──
  { id: 'ayam-goreng', nama: 'Ayam Goreng Lengkuas', kategori: 'Lauk Hewani', kaloriPer100g: 260, proteinPer100g: 24.6, lemakPer100g: 17.5, karbohidratPer100g: 0.8, porsiUmum: '1 potong paha/dada = 90g' },
  { id: 'ayam-bakar', nama: 'Ayam Panggang / Bakar Kecap', kategori: 'Lauk Hewani', kaloriPer100g: 215, proteinPer100g: 26.0, lemakPer100g: 11.2, karbohidratPer100g: 3.5, porsiUmum: '1 potong = 90g' },
  { id: 'ayam-rica', nama: 'Ayam Bumbu Rica / Balado', kategori: 'Lauk Hewani', kaloriPer100g: 228, proteinPer100g: 23.5, lemakPer100g: 13.8, karbohidratPer100g: 2.5, porsiUmum: '1 potong = 90g' },
  { id: 'daging-rendang', nama: 'Daging Sapi Rendang', kategori: 'Lauk Hewani', kaloriPer100g: 280, proteinPer100g: 22.0, lemakPer100g: 20.0, karbohidratPer100g: 4.0, porsiUmum: '1 potong = 60g' },
  { id: 'empal-daging', nama: 'Empal Daging Sapi Goreng', kategori: 'Lauk Hewani', kaloriPer100g: 295, proteinPer100g: 26.5, lemakPer100g: 19.5, karbohidratPer100g: 3.0, porsiUmum: '1 potong = 50g' },
  { id: 'ikan-kembung', nama: 'Ikan Kembung Goreng', kategori: 'Lauk Hewani', kaloriPer100g: 190, proteinPer100g: 21.3, lemakPer100g: 10.8, karbohidratPer100g: 0.5, porsiUmum: '1 ekor sedang = 80g' },
  { id: 'ikan-nila', nama: 'Ikan Nila Bakar / Goreng', kategori: 'Lauk Hewani', kaloriPer100g: 172, proteinPer100g: 20.5, lemakPer100g: 9.5, karbohidratPer100g: 0.8, porsiUmum: '1 ekor = 100g' },
  { id: 'ikan-tongkol', nama: 'Ikan Tongkol Balado', kategori: 'Lauk Hewani', kaloriPer100g: 185, proteinPer100g: 24.0, lemakPer100g: 8.5, karbohidratPer100g: 2.2, porsiUmum: '1 potong = 75g' },
  { id: 'telur-rebus', nama: 'Telur Ayam Rebus Matang', kategori: 'Lauk Hewani', kaloriPer100g: 155, proteinPer100g: 13.0, lemakPer100g: 10.6, karbohidratPer100g: 1.1, porsiUmum: '1 butir = 55g' },
  { id: 'telur-dadar', nama: 'Telur Dadar Daun Bawang', kategori: 'Lauk Hewani', kaloriPer100g: 193, proteinPer100g: 12.5, lemakPer100g: 15.0, karbohidratPer100g: 1.8, porsiUmum: '1 butir = 60g' },
  { id: 'telur-ceplok', nama: 'Telur Mata Sapi (Ceplok)', kategori: 'Lauk Hewani', kaloriPer100g: 188, proteinPer100g: 12.8, lemakPer100g: 14.5, karbohidratPer100g: 1.0, porsiUmum: '1 butir = 55g' },

  // ── Lauk Nabati ──
  { id: 'tempe-goreng', nama: 'Tempe Goreng / Mendoan', kategori: 'Lauk Nabati', kaloriPer100g: 220, proteinPer100g: 17.5, lemakPer100g: 14.0, karbohidratPer100g: 10.5, porsiUmum: '2 potong = 50g' },
  { id: 'tempe-bacem', nama: 'Tempe Bacem Manis', kategori: 'Lauk Nabati', kaloriPer100g: 170, proteinPer100g: 15.0, lemakPer100g: 5.5, karbohidratPer100g: 16.0, porsiUmum: '2 potong = 60g' },
  { id: 'tahu-goreng', nama: 'Tahu Goreng Gurih', kategori: 'Lauk Nabati', kaloriPer100g: 115, proteinPer100g: 10.0, lemakPer100g: 7.2, karbohidratPer100g: 3.5, porsiUmum: '2 potong = 80g' },
  { id: 'tahu-bacem', nama: 'Tahu Bacem', kategori: 'Lauk Nabati', kaloriPer100g: 102, proteinPer100g: 9.2, lemakPer100g: 3.8, karbohidratPer100g: 8.5, porsiUmum: '2 potong = 80g' },
  { id: 'perkedel-kentang', nama: 'Perkedel Kentang Telur', kategori: 'Lauk Nabati', kaloriPer100g: 185, proteinPer100g: 4.5, lemakPer100g: 8.5, karbohidratPer100g: 23.0, porsiUmum: '1 butir = 45g' },

  // ── Sayuran ──
  { id: 'sayur-sop', nama: 'Sayur Sop Wortel Kol Buncis', kategori: 'Sayuran', kaloriPer100g: 38, proteinPer100g: 1.5, lemakPer100g: 0.8, karbohidratPer100g: 6.8, porsiUmum: '1 mangkok = 120g' },
  { id: 'sayur-asem', nama: 'Sayur Asem Segar', kategori: 'Sayuran', kaloriPer100g: 35, proteinPer100g: 1.2, lemakPer100g: 0.6, karbohidratPer100g: 6.5, porsiUmum: '1 mangkok = 120g' },
  { id: 'sayur-lodeh', nama: 'Sayur Lodeh Santan Sedang', kategori: 'Sayuran', kaloriPer100g: 68, proteinPer100g: 2.1, lemakPer100g: 4.5, karbohidratPer100g: 5.8, porsiUmum: '1 mangkok = 120g' },
  { id: 'tumis-kangkung', nama: 'Tumis Kangkung Tauco/Bawang', kategori: 'Sayuran', kaloriPer100g: 65, proteinPer100g: 2.8, lemakPer100g: 4.2, karbohidratPer100g: 4.5, porsiUmum: '1 porsi = 100g' },
  { id: 'tumis-buncis', nama: 'Oseng Buncis Wortel Tempe', kategori: 'Sayuran', kaloriPer100g: 72, proteinPer100g: 3.2, lemakPer100g: 3.8, karbohidratPer100g: 7.0, porsiUmum: '1 porsi = 100g' },
  { id: 'capcay', nama: 'Capcay Goreng Bakso/Ayam', kategori: 'Sayuran', kaloriPer100g: 85, proteinPer100g: 4.0, lemakPer100g: 4.5, karbohidratPer100g: 7.5, porsiUmum: '1 porsi = 120g' },

  // ── Buah-buahan ──
  { id: 'pisang-ambon', nama: 'Pisang Ambon Matang', kategori: 'Buah', kaloriPer100g: 97, proteinPer100g: 1.2, lemakPer100g: 0.2, karbohidratPer100g: 25.8, porsiUmum: '1 buah = 100g' },
  { id: 'semangka', nama: 'Semangka Potong Dingin', kategori: 'Buah', kaloriPer100g: 30, proteinPer100g: 0.6, lemakPer100g: 0.2, karbohidratPer100g: 7.5, porsiUmum: '1 potong = 150g' },
  { id: 'melon', nama: 'Melon Potong', kategori: 'Buah', kaloriPer100g: 34, proteinPer100g: 0.8, lemakPer100g: 0.2, karbohidratPer100g: 8.2, porsiUmum: '1 potong = 120g' },
  { id: 'pepaya', nama: 'Pepaya Potong Matang', kategori: 'Buah', kaloriPer100g: 39, proteinPer100g: 0.5, lemakPer100g: 0.1, karbohidratPer100g: 9.8, porsiUmum: '1 potong = 130g' },
  { id: 'jeruk-manis', nama: 'Jeruk Manis', kategori: 'Buah', kaloriPer100g: 45, proteinPer100g: 0.9, lemakPer100g: 0.1, karbohidratPer100g: 11.2, porsiUmum: '1 buah = 110g' },

  // ── Ekstra / Pelengkap ──
  { id: 'susu-uht', nama: 'Susu UHT Segar Full Cream', kategori: 'Ekstra / Pelengkap', kaloriPer100g: 65, proteinPer100g: 3.2, lemakPer100g: 3.6, karbohidratPer100g: 4.8, porsiUmum: '1 kotak kecil = 200ml (130 kkal)' },
  { id: 'kerupuk-putih', nama: 'Kerupuk Putih / Kaleng', kategori: 'Ekstra / Pelengkap', kaloriPer100g: 476, proteinPer100g: 7.0, lemakPer100g: 21.0, karbohidratPer100g: 65.0, porsiUmum: '1 keping = 15g (71 kkal)' },
  { id: 'sambal-terasi', nama: 'Sambal Terasi Goreng', kategori: 'Ekstra / Pelengkap', kaloriPer100g: 120, proteinPer100g: 2.5, lemakPer100g: 8.0, karbohidratPer100g: 9.5, porsiUmum: '1 sdm = 15g' },
];

export const MASTER_DKBM = DEFAULT_DKBM_SEED;

export interface RincianSajianDKBM {
  bahanId: string;
  nama: string;
  kategori: string;
  gram: number;
  kalori: number;
  protein: number;
  lemak: number;
  karbohidrat: number;
}

export function hitungGiziSajian(
  items: { bahanId: string; gram: number }[],
  masterList: ItemDKBM[] = DEFAULT_DKBM_SEED,
): {
  totalKalori: number;
  totalProtein: number;
  totalLemak: number;
  totalKarbohidrat: number;
  rincian: RincianSajianDKBM[];
} {
  const mapBahan = new Map(masterList.map((b) => [b.id, b]));
  let totalKalori = 0;
  let totalProtein = 0;
  let totalLemak = 0;
  let totalKarbohidrat = 0;
  const rincian: RincianSajianDKBM[] = [];

  for (const it of items) {
    const bahan = mapBahan.get(it.bahanId);
    if (!bahan || it.gram <= 0) continue;
    const factor = it.gram / 100;
    const kalori = Math.round(bahan.kaloriPer100g * factor);
    const protein = Number((bahan.proteinPer100g * factor).toFixed(1));
    const lemak = Number((bahan.lemakPer100g * factor).toFixed(1));
    const karbohidrat = Number((bahan.karbohidratPer100g * factor).toFixed(1));

    totalKalori += kalori;
    totalProtein += protein;
    totalLemak += lemak;
    totalKarbohidrat += karbohidrat;

    rincian.push({
      bahanId: bahan.id,
      nama: bahan.nama,
      kategori: bahan.kategori,
      gram: it.gram,
      kalori,
      protein,
      lemak,
      karbohidrat,
    });
  }

  return {
    totalKalori,
    totalProtein: Number(totalProtein.toFixed(1)),
    totalLemak: Number(totalLemak.toFixed(1)),
    totalKarbohidrat: Number(totalKarbohidrat.toFixed(1)),
    rincian,
  };
}
