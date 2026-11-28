// Helper & tipe data untuk modul Surat Pengantar MCU & Follow Up
// Alur persetujuan berjenjang: PIC -> HC -> QSHE Medic
// Format Nomor Surat: MC0001/QSHE-BDM/<KODE_SITE>/<ROMAWI_BULAN>/<TAHUN>

export type JenisPengantar =
  | 'PRE_EMPLOYMENT'
  | 'ANNUAL'
  | 'SPESIFIK'
  | 'RETIREMENT'
  | 'FOLLOW_UP';

export type StatusSuratPengantar =
  | 'MENUNGGU_HC'
  | 'MENUNGGU_QSHE'
  | 'DISETUJUI'
  | 'DITOLAK';

export interface SuratPengantarItem {
  id: string;
  no_surat: string | null;
  nomor_urut: number | null;
  tahun_surat: number;
  jenis_pengantar: JenisPengantar;
  is_calon_karyawan: boolean;
  nik_karyawan: string;
  nik_ktp: string;
  nama: string;
  jenis_kelamin: string;
  usia: number | null;
  jabatan: string;
  departemen: string;
  site: string;
  mcu_record_id: string | null;
  tgl_mcu: string | null;
  faskes_tujuan: string;
  tanggal_rencana: string;
  paket_pemeriksaan: string[];
  parameter_abnormal: string;
  paragraf_pendukung: string;
  catatan_pic: string;
  status: StatusSuratPengantar;
  created_by: string | null;
  created_by_name: string;
  created_by_role: string;
  hc_status: 'DISETUJUI' | 'DITOLAK' | null;
  hc_by_name: string | null;
  hc_at: string | null;
  hc_catatan: string | null;
  qshe_status: 'DISETUJUI' | 'DITOLAK' | null;
  qshe_by_name: string | null;
  qshe_at: string | null;
  qshe_catatan: string | null;
  verify_sig?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SuratPengantarDraft {
  jenis_pengantar: JenisPengantar;
  is_calon_karyawan: boolean;
  nik_karyawan?: string;
  nik_ktp?: string;
  nama: string;
  jenis_kelamin?: string;
  usia?: string;
  jabatan?: string;
  departemen?: string;
  site: string;
  mcu_record_id?: string | null;
  tgl_mcu?: string | null;
  parameter_abnormal?: string;
  faskes_tujuan?: string;
}

export const JENIS_PENGANTAR_LIST: JenisPengantar[] = [
  'PRE_EMPLOYMENT',
  'ANNUAL',
  'SPESIFIK',
  'RETIREMENT',
  'FOLLOW_UP',
];

export const JENIS_PENGANTAR_META: Record<
  JenisPengantar,
  { label: string; short: string; badgeColor: string; defaultPaket: string[] }
> = {
  PRE_EMPLOYMENT: {
    label: 'MCU Pre-Employment (Calon Karyawan)',
    short: 'Pre-Employment',
    badgeColor: '#0284c7',
    defaultPaket: [
      'Pemeriksaan Fisik Lengkap & Visus',
      'Darah Lengkap & Urine Rutin',
      'Kimia Darah (GDP, Profil Lipid, SGOT/SGPT, Ureum/Kreatinin)',
      'Rontgen Thorax',
      'EKG',
      'Audiometri & Spirometri',
    ],
  },
  ANNUAL: {
    label: 'MCU Annual (Berkala)',
    short: 'Annual',
    badgeColor: '#00B894',
    defaultPaket: [
      'Pemeriksaan Fisik Lengkap & Visus',
      'Darah Lengkap & Urine Rutin',
      'Kimia Darah Lengkap',
      'Rontgen Thorax',
      'EKG',
      'Audiometri & Spirometri',
    ],
  },
  SPESIFIK: {
    label: 'MCU Spesifik / Khusus',
    short: 'Spesifik',
    badgeColor: '#7c3aed',
    defaultPaket: [
      'Pemeriksaan Fisik Terarah',
      'Pemeriksaan Penunjang Sesuai Paparan Hazard / Indikasi Klinis',
    ],
  },
  RETIREMENT: {
    label: 'MCU Retirement (Purnabakti)',
    short: 'Retirement',
    badgeColor: '#64748b',
    defaultPaket: [
      'Pemeriksaan Fisik Lengkap & Visus',
      'Darah Lengkap & Urine Rutin',
      'Kimia Darah Lengkap',
      'Rontgen Thorax',
      'EKG',
      'Audiometri & Spirometri',
    ],
  },
  FOLLOW_UP: {
    label: 'Pengantar Follow Up (Temuan Abnormal MCU)',
    short: 'Follow Up',
    badgeColor: '#FF4D00',
    defaultPaket: [
      'Konsultasi Dokter & Pemeriksaan Lanjutan Parameter Abnormal',
    ],
  },
};

export const STATUS_PENGANTAR_META: Record<
  StatusSuratPengantar,
  { label: string; color: string; bg: string }
> = {
  MENUNGGU_HC: {
    label: 'Menunggu Persetujuan HC',
    color: '#0284c7',
    bg: 'rgba(2, 132, 199, 0.12)',
  },
  MENUNGGU_QSHE: {
    label: 'Menunggu Persetujuan QSHE Medic',
    color: '#d97706',
    bg: 'rgba(217, 119, 6, 0.12)',
  },
  DISETUJUI: {
    label: 'Disetujui & Terbit',
    color: '#00806a',
    bg: 'rgba(0, 184, 148, 0.14)',
  },
  DITOLAK: {
    label: 'Ditolak',
    color: '#FF2D2D',
    bg: 'rgba(255, 45, 45, 0.12)',
  },
};

const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function getSiteCodeForSurat(site: string): string {
  const s = (site || '').trim().toUpperCase();
  if (!s || s === 'HEAD OFFICE' || s.startsWith('BATCH')) return 'HO';
  const compact = s.replace(/[^A-Z0-9]/g, '');
  return compact || 'HO';
}

export function formatNomorSuratPengantar(
  nomorUrut: number,
  site: string,
  date: Date = new Date(),
): string {
  const urut = String(Math.max(1, nomorUrut)).padStart(4, '0');
  const code = getSiteCodeForSurat(site);
  const roman = ROMAN_MONTHS[date.getMonth()] || 'I';
  const year = date.getFullYear();
  return `MC${urut}/QSHE-BDM/${code}/${roman}/${year}`;
}

export const DEFAULT_PARAGRAF_FOLLOW_UP =
  'Sehubungan dengan hasil pemeriksaan Medical Check Up (MCU) yang telah dilakukan sebelumnya dan ditemukannya beberapa nilai parameter di luar batas normal, bersama ini kami mohon kesediaan Dokter / Fasilitas Kesehatan Rekanan untuk melakukan pemeriksaan lanjutan (follow up), evaluasi klinis, serta memberikan rekomendasi kelaikan kerja bagi karyawan/calon karyawan tersebut di atas.';

export const DEFAULT_PARAGRAF_MCU =
  'Bersama ini kami mengajukan permohonan pelaksanaan pemeriksaan Medical Check Up (MCU) sesuai jenis dan paket pemeriksaan terlampir bagi karyawan/calon karyawan tersebut di atas. Mohon hasil pemeriksaan serta kesimpulan kelaikan kerja dapat disampaikan kembali kepada tim HC dan QSHE Medic PT Bagong Dekaka Makmur.';
