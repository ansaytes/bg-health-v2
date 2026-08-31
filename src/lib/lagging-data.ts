/* ═══════════════════════════════════════════════════════════════
   Static Lagging Indicator Data — Source: Lagging Indicator.xlsx
   Updated: April 2026 (Jan-Apr real data)
   ═══════════════════════════════════════════════════════════════ */

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'] as const;

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
    pak:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
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
