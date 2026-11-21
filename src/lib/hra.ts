// ============================================================
// HRA (Health Hazard Risk Assessment) - Types & Utilities
// Dokumen Acuan: BG/QSHE/FORM/069 Rev.001
// Formula: P × E = R
// P = Tingkat Paparan (Akumulasi jam paparan per minggu sesuai NAB Permenaker 5/2018)
// E = Efek Kesehatan / Severity (Tingkat keparahan dampak kesehatan)
// R = Skor Risiko (Klasifikasi: Low 1-4, Medium 5-12, High 15-25)
// ============================================================

export type DepartemenHra =
  | 'OPERATION'
  | 'PLANT'
  | 'SCM'
  | 'QSHE'
  | 'HCGS'
  | 'FAT'
  | 'MANAGEMENT'
  | 'TDC';

export interface DepartemenItem {
  key: string;
  label: string;
  desc?: string;
}

export const DEPARTEMEN_LIST: DepartemenItem[] = [
  { key: 'OPERATION', label: 'Operation', desc: 'Departemen Operasional Transportasi' },
  { key: 'PLANT', label: 'Plant', desc: 'Departemen Plant & Workshop' },
  { key: 'SCM', label: 'SCM', desc: 'Supply Chain Management' },
  { key: 'QSHE', label: 'QSHE', desc: 'Quality, Safety, Health & Environment' },
  { key: 'HCGS', label: 'HCGS', desc: 'Human Capital & General Services' },
  { key: 'FAT', label: 'FAT', desc: 'Finance, Account, & Tax' },
  { key: 'MANAGEMENT', label: 'Management', desc: 'Direksi & Manajemen Puncak' },
  { key: 'TDC', label: 'TDC', desc: 'Training & Development Center' },
];

/** Normalisasi departemen dari tabel employees */
export function normalizeDepartment(deptRaw?: string | null): string {
  if (!deptRaw) return '';
  const d = deptRaw.trim().toUpperCase();

  if (d.includes('OPERAT')) return 'OPERATION';
  if (d.includes('PLANT') || d.includes('WORKSHOP')) return 'PLANT';
  if (d.includes('SCM') || d.includes('SUPPLY') || d.includes('LOGIST')) return 'SCM';
  if (d.includes('QSHE') || d.includes('SHE') || d.includes('SAFETY') || d.includes('HSE')) return 'QSHE';
  if (d.includes('HCGS') || d.includes('HR') || d.includes('HUMAN') || d.includes('GENERAL')) return 'HCGS';
  if (d.includes('FAT') || d.includes('FINAN') || d.includes('TAX') || d.includes('ACCOUNT')) return 'FAT';
  if (d.includes('MANAG') || d.includes('DIREK') || d.includes('DIR')) return 'MANAGEMENT';
  if (d.includes('TDC') || d.includes('TRAIN') || d.includes('DEVELOP')) return 'TDC';

  return d;
}

export type JenisHazard =
  | 'Ergonomi'
  | 'Fisika'
  | 'Kimia'
  | 'Psikososial'
  | 'Psikososial / Kimia'
  | 'Biologi';

export const HAZARD_TYPE_LIST: JenisHazard[] = [
  'Ergonomi',
  'Fisika',
  'Kimia',
  'Psikososial',
  'Psikososial / Kimia',
  'Biologi',
];

/**
 * Tabel Peluang (P) – Berdasarkan Tingkat Paparan
 * Sesuai Dokumen BG/QSHE/FORM/069 Rev.001 Catatan (1):
 * P ditentukan berdasarkan akumulasi jam paparan per minggu (acuan NAB Permenaker 5/2018: 8 jam/hari, 40 jam/minggu).
 */
export const PAPARAN_LABELS: Record<number, { title: string; desc: string; durasi: string }> = {
  1: {
    title: 'Sangat Jarang',
    durasi: '< 2 jam/minggu',
    desc: 'Akumulasi paparan < 2 jam per minggu, atau tugas insidental/non-rutin (≤ 1 kali per bulan)',
  },
  2: {
    title: 'Jarang',
    durasi: '2 s/d < 8 jam/minggu',
    desc: 'Akumulasi paparan ≥ 2 jam s/d < 8 jam per minggu',
  },
  3: {
    title: 'Kadang-kadang',
    durasi: '8 s/d < 20 jam/minggu',
    desc: 'Akumulasi paparan ≥ 8 jam s/d < 20 jam per minggu',
  },
  4: {
    title: 'Sering',
    durasi: '20 s/d < 32 jam/minggu',
    desc: 'Akumulasi paparan ≥ 20 jam s/d < 32 jam per minggu (atau hasil ukur melebihi NAB)',
  },
  5: {
    title: 'Terus-menerus',
    durasi: '≥ 32 jam/minggu',
    desc: 'Akumulasi paparan ≥ 32 jam per minggu (hampir sepanjang waktu kerja)',
  },
};

/**
 * Tabel Efek (E) / Severity
 * Sesuai Dokumen BG/QSHE/FORM/069 Rev.001
 */
export const EFEK_LABELS: Record<number, { title: string; desc: string; contoh: string }> = {
  1: {
    title: 'Negligible (Sangat Ringan)',
    desc: 'Ketidaknyamanan sementara yang hilang begitu paparan berhenti, tanpa penanganan medis',
    contoh: 'Bau menyengat non-toksik',
  },
  2: {
    title: 'Minor (Ringan)',
    desc: 'Efek ringan yang reversible (pulih penuh), P3K / istirahat, tanpa kehilangan hari kerja',
    contoh: 'Iritasi mata sementara, pusing ringan, kelelahan otot ringan',
  },
  3: {
    title: 'Moderate (Sedang)',
    desc: 'Membutuhkan perawatan medis spesifik, terapi, atau Lost Time Illness (reversibel)',
    contoh: 'Dermatitis kontak, Low Back Pain (LBP), HNP tanpa defisit permanen',
  },
  4: {
    title: 'Major (Berat)',
    desc: 'Penyakit kronis serius irreversible (cacat sebagian permanen), membatasi fungsi kerja',
    contoh: 'NIHL permanen, Silikosis, Pneumokoniosis, Kanker kulit non-melanoma',
  },
  5: {
    title: 'Fatal',
    desc: 'Efek akut mengancam nyawa, cacat total permanen, atau kanker mortalitas tinggi',
    contoh: 'Keracunan akut fatal, Kanker paru, Mesothelioma, Leukemia',
  },
};

// Aliases
export const PROBABILITY_LABELS = PAPARAN_LABELS;
export const EFFECT_LABELS = EFEK_LABELS;
export const PELUANG_LABELS = PAPARAN_LABELS;

/**
 * 6 Aturan Catatan Penilaian HRA (FORM/069 Rev.001)
 */
export const HRA_RULES = [
  {
    no: 1,
    title: 'Tingkat Paparan (Jam/Minggu)',
    rule: 'P ditentukan berdasarkan tingkat paparan, yaitu akumulasi jam paparan per minggu (acuan NAB Permenaker 5/2018: 8 jam/hari, 40 jam/minggu). Untuk roster, gunakan rata-rata jam per minggu selama kerja aktif.',
  },
  {
    no: 2,
    title: 'Hasil Ukur Melebihi NAB',
    rule: 'Bila tersedia hasil pengukuran lingkungan kerja yang melebihi NAB (Nilai Ambang Batas), nilai P minimal 4.',
  },
  {
    no: 3,
    title: 'Karsinogen IARC Grup 1',
    rule: 'Untuk karsinogen IARC Grup 1 (asbes, silika kristalin, asap las, emisi diesel, benzena, asap rokok), nilai P minimal 2 selama paparan masih ada, termasuk pada residual risk.',
  },
  {
    no: 4,
    title: 'Faktor Merokok Aktif',
    rule: 'Untuk merokok aktif, P ditentukan dari prevalensi perokok pada jabatan berdasarkan MCU: <10%=1; 10–<25%=2; 25–<40%=3; 40–<60%=4; ≥60%=5.',
  },
  {
    no: 5,
    title: 'Penentuan Efek (E)',
    rule: 'E ditentukan dari efek kesehatan yang paling mungkin terjadi (most credible). Kanker mortalitas tinggi = E5, lainnya = E4. E residual = E initial.',
  },
  {
    no: 6,
    title: 'Penurunan P oleh Pengendalian',
    rule: 'Pengendalian menurunkan P: APD / administratif menurunkan 1 tingkat; engineering / substitusi menurunkan 2 tingkat (wajib dibuktikan). Nilai P minimal 1. Pengukuran lingkungan kerja bukan pengendalian.',
  },
];

export type LevelRisiko = 'Low Risk' | 'Medium Risk' | 'High Risk';

export interface HraHazardEntry {
  id: string;
  departemen: DepartemenHra | string;
  nomor_urut?: number | null;
  jenis_pekerjaan: string;
  jenis_hazard: JenisHazard | string;
  sumber_hazard: string;
  kelompok_beresiko: string;
  efek_kesehatan: string;
  // P (Tingkat Paparan) & E (Efek) -> R (Tingkat Risiko: P x E)
  init_p: number; // Tingkat Paparan Awal (1 - 5)
  init_e: number; // Efek Kesehatan (1 - 5)
  init_r: number; // Nilai R (P × E)
  tindakan_pencegahan: string;
  kontrol_tingkat?: 'APD' | 'ADMINISTRATIF' | 'ENGINEERING' | 'SUBSTITUSI' | 'ELIMINASI' | 'TIDAK_ADA' | string;
  res_p: number; // Tingkat Paparan Sisa (1 - 5)
  res_e: number; // Efek Kesehatan Sisa (1 - 5)
  res_r: number; // Nilai R Sisa (P × E)
  regulasi?: string;
  created_at?: string;
  updated_at?: string;
}

export interface HraMappingJabatan {
  nomor?: number | null;
  jabatan: string;
  lokasi_kerja: string;
  departemen: string;
  kelompok_pekerja: string;
  nilai_r_tertinggi: number;
  kategori_risiko: string;
  dasar_pertimbangan: string;
}

/** Hitung Skor Risiko: R = P × E */
export function hitungSkorRisiko(p: number, e: number): number {
  const pSafe = Math.min(5, Math.max(1, Math.round(p || 1)));
  const eSafe = Math.min(5, Math.max(1, Math.round(e || 1)));
  return pSafe * eSafe;
}

export function getKategoriRisiko(r: number): LevelRisiko {
  if (r >= 15) return 'High Risk';
  if (r >= 5) return 'Medium Risk';
  return 'Low Risk';
}

export function getRiskColor(r: number): string {
  if (r >= 15) return '#FF2D2D'; // High Risk (15-25)
  if (r >= 5) return '#F5A623';  // Medium Risk (5-12)
  return '#00B894';              // Low Risk (1-4)
}

export function getRiskBg(r: number): string {
  if (r >= 15) return 'rgba(255, 45, 45, 0.12)';
  if (r >= 5) return 'rgba(245, 166, 35, 0.12)';
  return 'rgba(0, 184, 148, 0.12)';
}

export function getRiskBorder(r: number): string {
  if (r >= 15) return 'rgba(255, 45, 45, 0.35)';
  if (r >= 5) return 'rgba(245, 166, 35, 0.35)';
  return 'rgba(0, 184, 148, 0.35)';
}

export function getHazardIconName(jenis: string): string {
  const j = (jenis || '').toLowerCase();
  if (j.includes('fisika')) return 'Volume2';
  if (j.includes('kimia')) return 'FlaskConical';
  if (j.includes('ergo')) return 'Activity';
  if (j.includes('psiko')) return 'Brain';
  if (j.includes('biologi')) return 'Biohazard';
  return 'ShieldAlert';
}
