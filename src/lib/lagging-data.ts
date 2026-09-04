/* ═══════════════════════════════════════════════════════════════
   Static Lagging Indicator Data — Source: Lagging Indicator.xlsx
   Updated: April 2026 (Jan-Apr real data)
   ═══════════════════════════════════════════════════════════════ */

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'] as const;

/**
 * All 53 jobsite names (52 sites + "All Site"). Mirrors Excel sheet order.
 * Used as fallback when Supabase is not configured.
 */
export const JOBSITES: string[] = [
  'All Site',
  'Aceh', 'Angsana', 'Tanjung Tabalong', 'Tuhup', 'Batu Kajang',
  'Bengalon', 'Tanjung Redeb', 'Binuang', 'Bontang', 'Kapuas Tengah',
  'Bunyu', 'Balikpapan', 'Banjarmasin', 'Banyuwangi', 'Binungan',
  'Bukit Pinang', 'Gunung Sari', 'Gunung Bintang Awai', 'Gorontalo',
  'Halmahera Timur', 'Ketapang', 'Kaliorang', 'Kaubun', 'Gunung Mas',
  'Kayong Utara', 'Kelubir', 'Konawe', 'Kota Baru', 'Labanan',
  'Lahat', 'Luwu', 'Malinau', 'Kotamobagu', 'Melak',
  'Morowali', 'Muara Bungo', 'Muara Enim', 'Muara Teweh', 'Murung Raya',
  'Palu', 'Rantau', 'Samarinda', 'Sangatta', 'Satui',
  'Sebakis', 'Senakin', 'Soroako', 'Tabang', 'Tenggarong',
  'Tri Yoga Morowali', 'Wetar', 'Head Office',
];

export const ALL_SITE = {
  leading: {
    man_power:     [3173, 1369, 1095, 1358, 0, 0, 0, 0, 0, 0, 0, 0],
    man_hours:     [625560, 296776, 267608, 312404, 0, 0, 0, 0, 0, 0, 0, 0],
    kunjungan:     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    tk_sakit:      [174, 128, 34, 123, 0, 0, 0, 0, 0, 0, 0, 0],
    absensi_sakit: [535, 426, 136, 307, 0, 0, 0, 0, 0, 0, 0, 0],
    spell:         [174, 128, 34, 121, 0, 0, 0, 0, 0, 0, 0, 0],
    pak:           [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    kaptk:         [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    layak_kerja:   [3160, 1360, 1093, 1356, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  lagging: {
    rkk:  [0.9959, 0.9934, 0.9982, 0.9985, 0, 0, 0, 0, 0, 0, 0, 0],
    cmr:  [0.0548, 0.0935, 0.0311, 0.0906, 0, 0, 0, 0, 0, 0, 0, 0],
    mfr:  [278.15, 431.30, 127.05, 393.72, 0, 0, 0, 0, 0, 0, 0, 0],
    ssr:  [3.075, 3.328, 4.0, 2.537, 0, 0, 0, 0, 0, 0, 0, 0],
    asr:  [855.23, 1435.43, 508.21, 982.70, 0, 0, 0, 0, 0, 0, 0, 0],
    fr_pak:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    kaptk:[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
};

export interface SiteASR {
  site: string;
  asr: number[];
  man_power: number[];
}

export const SITE_ASR_DATA: SiteASR[] = [
  { site: 'Banyuwangi',      asr: [407.6, 3928.2, 3877.2, 32485.9, 0,0,0,0,0,0,0,0], man_power: [37, 37, 37, 37, 0,0,0,0,0,0,0,0] },
  { site: 'Balikpapan',      asr: [10165.7, 13503.1, 11363.6, 10693.2, 0,0,0,0,0,0,0,0], man_power: [16, 16, 16, 16, 0,0,0,0,0,0,0,0] },
  { site: 'Banjarmasin',     asr: [0, 0, 0, 6578.9, 0,0,0,0,0,0,0,0], man_power: [4, 4, 4, 4, 0,0,0,0,0,0,0,0] },
  { site: 'Head Office',     asr: [4133.5, 4639.3, 0, 4568.3, 0,0,0,0,0,0,0,0], man_power: [264, 270, 0, 269, 0,0,0,0,0,0,0,0] },
  { site: 'Bengalon',        asr: [1462.0, 2624.0, 0, 686.2, 0,0,0,0,0,0,0,0], man_power: [51, 51, 0, 51, 0,0,0,0,0,0,0,0] },
  { site: 'Tanjung Redeb',   asr: [729.3, 1183.1, 274.2, 680.2, 0,0,0,0,0,0,0,0], man_power: [173, 173, 173, 173, 0,0,0,0,0,0,0,0] },
  { site: 'Aceh',           asr: [3698.7, 907.5, 621.1, 459.8, 0,0,0,0,0,0,0,0], man_power: [70, 70, 68, 71, 0,0,0,0,0,0,0,0] },
  { site: 'Bontang',         asr: [1552.8, 1295.3, 877.8, 168.2, 0,0,0,0,0,0,0,0], man_power: [33, 33, 33, 33, 0,0,0,0,0,0,0,0] },
  { site: 'Tanjung Tabalong', asr: [87.7, 216.7, 0, 130.1, 0,0,0,0,0,0,0,0], man_power: [102, 103, 104, 105, 0,0,0,0,0,0,0,0] },
  { site: 'Binuang',         asr: [2177.1, 1846.1, 1100.7, 0, 0,0,0,0,0,0,0,0], man_power: [74, 74, 74, 74, 0,0,0,0,0,0,0,0] },
  { site: 'Kaliorang',       asr: [1088.2, 0, 0, 0, 0,0,0,0,0,0,0,0], man_power: [0, 0, 0, 0, 0,0,0,0,0,0,0,0] },
  { site: 'Kotamobagu',      asr: [7084.1, 0, 0, 0, 0,0,0,0,0,0,0,0], man_power: [0, 0, 0, 0, 0,0,0,0,0,0,0,0] },
  { site: 'Morowali',        asr: [6465.5, 0, 0, 0, 0,0,0,0,0,0,0,0], man_power: [0, 0, 0, 0, 0,0,0,0,0,0,0,0] },
  { site: 'Batu Kajang',     asr: [0, 315.3, 0, 0, 0,0,0,0,0,0,0,0], man_power: [60, 60, 60, 60, 0,0,0,0,0,0,0,0] },
  { site: 'Angsana',         asr: [173.1, 92.1, 148.6, 0, 0,0,0,0,0,0,0,0], man_power: [288, 294, 300, 311, 0,0,0,0,0,0,0,0] },
  { site: 'Tuhup',           asr: [326.3, 0, 0, 0, 0,0,0,0,0,0,0,0], man_power: [120, 0, 0, 0, 0,0,0,0,0,0,0,0] },
  { site: 'Sangatta',        asr: [0, 0, 0, 0, 0,0,0,0,0,0,0,0], man_power: [0, 0, 0, 0, 0,0,0,0,0,0,0,0] },
  { site: 'Samarinda',       asr: [0, 0, 0, 0, 0,0,0,0,0,0,0,0], man_power: [0, 0, 0, 0, 0,0,0,0,0,0,0,0] },
];

/**
 * Static sick-employees sample (mirrors Excel "Data Karyawan Sakit" Jan 2026 entries).
 * Used as fallback when Supabase is not configured.
 */
export interface SickEmployeeStatic {
  nik: string;
  nama: string;
  jobsite: string;
  jabatan: string;
  tgl_mulai_a: string | null;
  tgl_selesai_a: string | null;
  hari_a: number;
  tgl_mulai_b: string | null;
  tgl_selesai_b: string | null;
  hari_b: number;
  tgl_mulai_c: string | null;
  tgl_selesai_c: string | null;
  hari_c: number;
  jumlah_spell: number;
  bulan: number;
  tahun: number;
}

export const SICK_EMPLOYEES_STATIC: SickEmployeeStatic[] = [
  { nik: '230802778', nama: 'Putra Gunawan',    jobsite: 'Aceh',     jabatan: 'Driver - Operation', tgl_mulai_a: '2025-12-21', tgl_selesai_a: '2025-12-25', hari_a: 5,  tgl_mulai_b: null, tgl_selesai_b: null, hari_b: 0, tgl_mulai_c: null, tgl_selesai_c: null, hari_c: 0, jumlah_spell: 1, bulan: 1, tahun: 2026 },
  { nik: '240704222', nama: 'Deki Maulana',     jobsite: 'Aceh',     jabatan: 'Driver - Operation', tgl_mulai_a: '2025-12-21', tgl_selesai_a: '2026-01-20', hari_a: 31, tgl_mulai_b: null, tgl_selesai_b: null, hari_b: 0, tgl_mulai_c: null, tgl_selesai_c: null, hari_c: 0, jumlah_spell: 1, bulan: 1, tahun: 2026 },
  { nik: '250905424', nama: 'Haidi Ansyari',     jobsite: 'Angsana',  jabatan: 'Driver - Operation', tgl_mulai_a: '2025-12-31', tgl_selesai_a: '2025-12-31', hari_a: 1,  tgl_mulai_b: '2026-01-02', tgl_selesai_b: '2026-01-02', hari_b: 1, tgl_mulai_c: null, tgl_selesai_c: null, hari_c: 0, jumlah_spell: 1, bulan: 1, tahun: 2026 },
  { nik: '241105309', nama: 'Rizky Pratama',     jobsite: 'Head Office', jabatan: 'Staff - HR',     tgl_mulai_a: '2026-01-05', tgl_selesai_a: '2026-01-08', hari_a: 4,  tgl_mulai_b: null, tgl_selesai_b: null, hari_b: 0, tgl_mulai_c: null, tgl_selesai_c: null, hari_c: 0, jumlah_spell: 1, bulan: 1, tahun: 2026 },
  { nik: '230401198', nama: 'Bayu Saputra',      jobsite: 'Balikpapan', jabatan: 'Operator',       tgl_mulai_a: '2025-12-22', tgl_selesai_a: '2025-12-28', hari_a: 7,  tgl_mulai_b: null, tgl_selesai_b: null, hari_b: 0, tgl_mulai_c: null, tgl_selesai_c: null, hari_c: 0, jumlah_spell: 1, bulan: 1, tahun: 2026 },
  { nik: '210602855', nama: 'Andi Wijaya',        jobsite: 'Sangatta',  jabatan: 'Driver - Operation', tgl_mulai_a: '2025-12-25', tgl_selesai_a: '2026-01-15', hari_a: 22, tgl_mulai_b: null, tgl_selesai_b: null, hari_b: 0, tgl_mulai_c: null, tgl_selesai_c: null, hari_c: 0, jumlah_spell: 1, bulan: 1, tahun: 2026 },
  { nik: '220708934', nama: 'Eko Prasetyo',       jobsite: 'Bontang',   jabatan: 'Mechanic',       tgl_mulai_a: '2025-12-29', tgl_selesai_a: '2026-01-03', hari_a: 6,  tgl_mulai_b: '2026-01-10', tgl_selesai_b: '2026-01-12', hari_b: 3, tgl_mulai_c: null, tgl_selesai_c: null, hari_c: 0, jumlah_spell: 1, bulan: 1, tahun: 2026 },
  { nik: '240902761', nama: 'Fajar Nugroho',      jobsite: 'Banyuwangi', jabatan: 'Operator',      tgl_mulai_a: '2026-01-08', tgl_selesai_a: '2026-01-12', hari_a: 5,  tgl_mulai_b: null, tgl_selesai_b: null, hari_b: 0, tgl_mulai_c: null, tgl_selesai_c: null, hari_c: 0, jumlah_spell: 1, bulan: 1, tahun: 2026 },
];

export function getLatestMonthIndex(): number {
  for (let i = 11; i >= 0; i--) {
    if (ALL_SITE.leading.man_power[i] > 0) return i;
  }
  return 0;
}

export function getASRRanking(monthIdx: number): { site: string; asr: number; mp: number }[] {
  return SITE_ASR_DATA
    .map(s => ({
      site: s.site,
      asr: s.asr[monthIdx] || 0,
      mp: s.man_power[monthIdx] || 0,
    }))
    .filter(s => s.asr > 0)
    .sort((a, b) => b.asr - a.asr)
    .slice(0, 10);
}
