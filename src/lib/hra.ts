// ============================================================
// HRA — Health Hazard Risk Assessment (FORM/069 Rev.001)
// ============================================================
//
// Matriks Rev.01: P (Peluang) = AKUMULASI JAM PAPARAN per minggu — objektif,
// bukan persepsi. E (Efek) = tingkat keparahan kesehatan. R = P × E.
//
// Aturan penilaian (catatan 1–6 Rev.01) dihitung di sini, BUKAN diketik:
//  (1) P dari jam paparan mingguan.
//  (2) Hasil pengukuran lingkungan > NAB → P minimal 4.
//  (3) Karsinogen IARC Grup 1 (silika, asap las, emisi diesel, benzena,
//      asap rokok, asbes) → P minimal 2, termasuk pada residual.
//  (4) Merok aktif → P dari prevalensi perok jabatan (data MCU).
//  (5) E dari efek paling kredibel; E residual = E initial.
//  (6) Kontrol menurunkan P: APD/administratif −1, engineering/substitusi
//      −2 (wajib bukti); pengukuran lingkungan bukan pengendalian.

export type JenisHazard = 'Fisika' | 'Kimia' | 'Biologi' | 'Ergonomi' | 'Psikososial';
export type KontrolTingkat = 'APD' | 'ADMINISTRATIF' | 'ENGINEERING' | 'SUBSTITUSI' | 'ELIMINASI' | 'TIDAK_ADA';

/** Rentang P dan E (1–5), klasifikasi R Rev.01: 1-4 Low, 5-12 Medium, 15-25 High. */
export const HRA_P_LEVELS: { skor: number; label: string; definisi: string }[] = [
  { skor: 1, label: 'Sangat Jarang', definisi: 'Akumulasi paparan < 2 jam per minggu, atau tugas insidental (≤1 kali per bulan).' },
  { skor: 2, label: 'Jarang', definisi: 'Akumulasi paparan ≥ 2 s/d < 8 jam per minggu.' },
  { skor: 3, label: 'Kadang-kadang', definisi: 'Akumulasi paparan ≥ 8 s/d < 20 jam per minggu.' },
  { skor: 4, label: 'Sering', definisi: 'Akumulasi paparan ≥ 20 s/d < 32 jam per minggu.' },
  { skor: 5, label: 'Terus-menerus', definisi: 'Akumulasi paparan ≥ 32 jam per minggu.' },
];

export const HRA_E_LEVELS: { skor: number; label: string; definisi: string; contoh: string }[] = [
  { skor: 1, label: 'Negligible', definisi: 'Ketidaknyamanan sementara yang hilang begitu paparan berhenti; tanpa penanganan medis.', contoh: 'Bau mengganggu tanpa toksisitas.' },
  { skor: 2, label: 'Minor', definisi: 'Efek ringan reversible; pertolongan pertama/istirahat, tanpa hilangnya hari kerja.', contoh: 'Iritasi mata debu, pusing ringan, lelah otot ringan.' },
  { skor: 3, label: 'Moderate', definisi: 'Perlu perawatan/terapi atau LTI (hilang hari kerja); masih bisa disembuhkan.', contoh: 'Dermatitis, LBP, HNP tanpa defisit permanen, sesak akut.' },
  { skor: 4, label: 'Major', definisi: 'Kronis irreversible (cacat sebagian permanen); membatasi kapasitas kerja.', contoh: 'NIHL permanen, Silikosis, Pneumokoniosis, kanker kulit non-melanoma.' },
  { skor: 5, label: 'Fatal', definisi: 'Mengancam nyawa, cacat total, atau kanker mortalitas tinggi (HLE 5 th < 50%).', contoh: 'Keracunan akut mematikan, kanker paru, mesothelioma, leukemia.' },
];

export function klasifikasiR(r: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (r <= 4) return 'LOW';
  if (r <= 12) return 'MEDIUM';
  return 'HIGH';
}

/** P dasar dari jam paparan mingguan (Rev.01 catatan 1). */
export function pDariJamPaparan(jamPerMinggu: number): number {
  if (jamPerMinggu < 2) return 1;
  if (jamPerMinggu < 8) return 2;
  if (jamPerMinggu < 20) return 3;
  if (jamPerMinggu < 32) return 4;
  return 5;
}

/** P dari prevalensi perok jabatan (catatan 4). */
export function pDariPrevalensiMerok(persen: number): number {
  if (persen < 10) return 1;
  if (persen < 25) return 2;
  if (persen < 40) return 3;
  if (persen < 60) return 4;
  return 5;
}

/** Daftar karsinogen IARC Grup 1 (catatan 3). */
const KARSINOGEN_IARC1 = [
  'asbes', 'silika', 'asap las', 'emisi diesel', 'benzena', 'asap rokok',
  'nikel', 'kadmium', 'krom heksavalen', 'formaldehyde',
];
export function isKarsinogenIarc1(sumberHazard: string): boolean {
  const s = sumberHazard.toLowerCase();
  return KARSINOGEN_IARC1.some((k) => s.includes(k));
}

export interface HazardInput {
  /** Jam paparan per minggu (rata-rata minggu kerja aktif untuk roster). */
  jamPaparanMingguan: number;
  e: number;
  /** Ada hasil pengukuran lingkungan yang melebihi NAB? */
  lewatNab: boolean;
  /** Sumber hazard — dipakai mendeteksi karsinogen IARC 1. */
  sumberHazard: string;
  /** Prevalensi perok jabatan (%) — hanya untuk hazard merok. */
  prevalensiMerok?: number | null;
  /** Hazard merok aktif (dihitung dari prevalensi, bukan jam paparan). */
  isHazardMerok?: boolean;
  /** Tingkat kontrol yang aktif — menentukan penurunan P (catatan 6). */
  kontrolTingkat: KontrolTingkat;
}

export interface RiskResult {
  p: number;
  e: number;
  r: number;
  kelas: 'LOW' | 'MEDIUM' | 'HIGH';
  /** Catatan penerapan aturan Rev.01 pada baris ini. */
  catatan: string[];
}

/**
 * Hitung risiko satu baris hazard. Initial = tanpa kontrol; Residual =
 * dengan kontrol (E residual = E initial — catatan 5).
 */
export function hitungRisikoHra(input: HazardInput): { initial: RiskResult; residual: RiskResult } {
  const catatan: string[] = [];

  // P dasar
  let p = input.isHazardMerok && input.prevalensiMerok != null
    ? pDariPrevalensiMerok(input.prevalensiMerok)
    : pDariJamPaparan(input.jamPaparanMingguan);
  if (input.isHazardMerok && input.prevalensiMerok != null) catatan.push('Catatan (4): P dari prevalensi perok jabatan (data MCU).');

  // Catatan 2: lewat NAB → P minimal 4
  if (input.lewatNab) {
    if (p < 4) { p = 4; catatan.push('Catatan (2): hasil pengukuran > NAB — P dinaikkan ke 4.'); }
  }

  // Catatan 3: karsinogen IARC 1 → P minimal 2 (berlaku juga pada residual)
  const karsinogen = isKarsinogenIarc1(input.sumberHazard);
  if (karsinogen) catatan.push('Catatan (3): karsinogen IARC Grup 1 — P minimal 2 termasuk pada residual risk.');

  // Catatan 6: kontrol menurunkan P
  const delta = (() => {
    switch (input.kontrolTingkat) {
      case 'APD': case 'ADMINISTRATIF': return 1;
      case 'ENGINEERING': case 'SUBSTITUSI': return 2;
      case 'ELIMINASI': return 5;
      default: return 0;
    }
  })();
  if (delta === 5) catatan.push('Catatan (6): eliminasi menghilangkan pajanan (P = 1).');
  else if (delta === 2) catatan.push('Catatan (6): engineering/substitusi menurunkan P 2 tingkat (wajib bukti).');
  else if (delta === 1) catatan.push('Catatan (6): APD/administratif menurunkan P 1 tingkat.');
  else if (input.kontrolTingkat === 'TIDAK_ADA') catatan.push('Tidak ada pengendalian aktif.');

  const e = Math.min(Math.max(input.e, 1), 5);

  const initial: RiskResult = { p, e, r: p * e, kelas: klasifikasiR(p * e), catatan: [...catatan] };
  const pRes = Math.max(1, p - delta);
  const residual: RiskResult = { p: pRes, e, r: pRes * e, kelas: klasifikasiR(pRes * e), catatan: [...catatan] };

  return { initial, residual };
}

/** Kelompok berisiko dari HRA yang cocok dengan jabatan karyawan. */
export function cocokKelompok(kelompokBerisiko: string, jabatan: string, department: string): boolean {
  const k = kelompokBerisiko.toLowerCase();
  const j = jabatan.toLowerCase();
  const d = department.toLowerCase();
  // Cocok bila jabatan/departemen karyawan disebut (substring), atau kelompok "seluruh".
  if (/seluruh|semua|all/i.test(k)) return true;
  if (j && k.includes(j.split(' - ')[0])) return true;
  if (d && k.includes(d.split(' - ')[0])) return true;
  return false;
}
