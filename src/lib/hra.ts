// ============================================================
// HRA (Health Hazard Risk Assessment) - Types & Utilities
// Dokumen Acuan: BG/QSHE/FORM/069 Rev.001
// Standard Formula: P × E = R (Probability × Effect = Risk)
// Terhubung dengan kolom `department` dan `job_position` pada tabel `employees`
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

/**
 * Normalisasi nama departemen dari tabel `employees` ke kode standar HRA.
 * Contoh: "Operasional Transportasi" -> "OPERATION", "Finance & Accounting" -> "FAT".
 */
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

/** P (Probability / Peluang) Scale 1 - 5 */
export const PROBABILITY_LABELS: Record<number, { title: string; desc: string }> = {
  1: { title: 'Sangat Jarang', desc: 'Hampir tidak pernah terjadi (< 1x setahun)' },
  2: { title: 'Jarang', desc: 'Jarang terjadi (1-2x setahun)' },
  3: { title: 'Kadang-kadang', desc: 'Dapat terjadi sewaktu-waktu (bulanan)' },
  4: { title: 'Sering', desc: 'Terjadi berulang kali (mingguan)' },
  5: { title: 'Sangat Sering', desc: 'Terpapar terus menerus / harian' },
};

/** E (Effect / Efek Keparahan) Scale 1 - 5 */
export const EFFECT_LABELS: Record<number, { title: string; desc: string }> = {
  1: { title: 'Sangat Ringan', desc: 'Keluhan sesaat, tanpa perlu istirahat kerja' },
  2: { title: 'Ringan', desc: 'Membutuhkan P3K / rawat jalan ringan' },
  3: { title: 'Sedang', desc: 'Lost time illness / reversibel' },
  4: { title: 'Berat', desc: 'Cacat fungsi organ permanen / penyakit kronis' },
  5: { title: 'Fatal', desc: 'Kematian / penyakit akibat kerja fatal' },
};

// Aliases
export const PELUANG_LABELS = PROBABILITY_LABELS;
export const EFEK_LABELS = EFFECT_LABELS;
export const LIKELIHOOD_LABELS = PROBABILITY_LABELS;
export const SEVERITY_LABELS = EFFECT_LABELS;

export type LevelRisiko = 'Rendah' | 'Sedang' | 'Tinggi';

export interface HraHazardEntry {
  id: string;
  departemen: DepartemenHra | string;
  nomor_urut?: number | null;
  jenis_pekerjaan: string;
  jenis_hazard: JenisHazard | string;
  sumber_hazard: string;
  kelompok_beresiko: string;
  efek_kesehatan: string;
  // P (Probability) & E (Effect) -> R (Risk)
  init_p: number; // Probability (P)
  init_e: number; // Effect (E)
  init_r: number; // Risk (R = P × E)
  tindakan_pencegahan: string;
  kontrol_tingkat?: 'APD' | 'ADMINISTRATIF' | 'ENGINEERING' | 'SUBSTITUSI' | 'ELIMINASI' | 'TIDAK_ADA' | string;
  res_p: number; // Residual Probability (P)
  res_e: number; // Residual Effect (E)
  res_r: number; // Residual Risk (R = P × E)
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
  kategori_risiko: LevelRisiko | string;
  dasar_pertimbangan: string;
}

/** Hitung Skor Risiko: R = P × E */
export function hitungSkorRisiko(p: number, e: number): number {
  const pSafe = Math.min(5, Math.max(1, Math.round(p || 1)));
  const eSafe = Math.min(5, Math.max(1, Math.round(e || 1)));
  return pSafe * eSafe;
}

export function getKategoriRisiko(r: number): LevelRisiko {
  if (r >= 15) return 'Tinggi';
  if (r >= 5) return 'Sedang';
  return 'Rendah';
}

export function getRiskColor(r: number): string {
  if (r >= 15) return '#FF2D2D'; // High / Tinggi
  if (r >= 5) return '#F5A623';  // Medium / Sedang
  return '#00B894';              // Low / Rendah
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
