/* ═══════════════════════════════════════════════════════════════════
   Perhitungan indikator kesehatan kerja — mengikuti rumus spreadsheet
   "Lagging Indicator.xlsx" (Laporan Bulanan Kesehatan Kerja).

   Leading (input):  man_power, man_hours, kunjungan_klinik, tk_sakit,
                     absensi_sakit, spell, penyakit_akibat_kerja,
                     kejadian_penyakit_tk, layak_bekerja
   Lagging (OTOMATIS):
     RKK   = layak_bekerja / man_power                    (rasio)
     CMR   = tk_sakit / man_power                          (rasio)
     MFR   = tk_sakit / man_hours * 1_000_000
     SSR   = absensi_sakit / spell
     ASR   = absensi_sakit / man_hours * 1_000_000
     FRPAK = penyakit_akibat_kerja / man_power             (rasio)
     KAPTK = kejadian_penyakit_tk / man_hours * 1_000_000
   ═══════════════════════════════════════════════════════════════════ */

export interface LeadingFields {
  man_power?: number | null;
  man_hours?: number | null;
  kunjungan_klinik?: number | null;
  tk_sakit?: number | null;
  absensi_sakit?: number | null;
  spell?: number | null;
  penyakit_akibat_kerja?: number | null;
  kejadian_penyakit_tk?: number | null;
  layak_bekerja?: number | null;
}

export interface LaggingFields {
  rkk: number;
  cmr: number;
  mfr: number;
  ssr: number;
  asr: number;
  fr_pak: number;
  kaptk: number;
}

const div = (a: number, b: number) => (b > 0 ? a / b : 0);

/* Hitung seluruh indikator lagging dari leading (IFERROR → 0, seperti Excel) */
export function computeLagging(l: LeadingFields): LaggingFields {
  const mp = Number(l.man_power) || 0;
  const mh = Number(l.man_hours) || 0;
  const tk = Number(l.tk_sakit) || 0;
  const abs = Number(l.absensi_sakit) || 0;
  const spell = Number(l.spell) || 0;
  const pak = Number(l.penyakit_akibat_kerja) || 0;
  const kaptkRaw = Number(l.kejadian_penyakit_tk) || 0;
  const layak = Number(l.layak_bekerja) || 0;

  return {
    rkk: div(layak, mp),
    cmr: div(tk, mp),
    mfr: div(tk, mh) * 1_000_000,
    ssr: div(abs, spell),
    asr: div(abs, mh) * 1_000_000,
    fr_pak: div(pak, mp),
    kaptk: div(kaptkRaw, mh) * 1_000_000,
  };
}

/* Leading keys sesuai kolom health_indicators */
export const LEADING_KEYS = [
  'man_power', 'man_hours', 'kunjungan_klinik', 'tk_sakit',
  'absensi_sakit', 'spell', 'penyakit_akibat_kerja',
  'kejadian_penyakit_tk', 'layak_bekerja',
] as const;

export const LAGGING_KEYS = ['rkk', 'cmr', 'mfr', 'ssr', 'asr', 'fr_pak', 'kaptk'] as const;

/* Agregasi 12 bulan → YTD, mengikuti kolom P spreadsheet:
   - AVERAGE (sum / 12, termasuk bulan kosong): man_power, tk_sakit, layak_bekerja
   - SUM: man_hours, kunjungan_klinik, absensi_sakit, spell, pak, kaptk      */
const AVG_KEYS = new Set(['man_power', 'tk_sakit', 'layak_bekerja']);

export function computeYtdLeading(rows: LeadingFields[]): LeadingFields {
  const out: Record<string, number> = {};
  for (const key of LEADING_KEYS) {
    const sum = rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
    out[key] = AVG_KEYS.has(key) ? sum / 12 : sum;
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════
   Agregasi data absensi/sakit per jobsite+bulan dari tabel absensi_sakit
   (hasil input form "Data Karyawan Sakit"):
     tk_sakit   = jumlah baris (karyawan sakit)
     absensi    = total hari (a + b + c)
     spell      = total spell
     pak        = jumlah karyawan dengan is_pak = 'Ya'
   ═══════════════════════════════════════════════════════════════════ */
export interface AbsensiRow {
  hari_a?: number | null;
  hari_b?: number | null;
  hari_c?: number | null;
  spell?: number | null;
  is_pak?: string | null;
}

export function aggregateSick(rows: AbsensiRow[]): {
  tk_sakit: number;
  absensi_sakit: number;
  spell: number;
  penyakit_akibat_kerja: number;
} {
  let absensi = 0;
  let spell = 0;
  let pak = 0;
  for (const r of rows) {
    absensi += (Number(r.hari_a) || 0) + (Number(r.hari_b) || 0) + (Number(r.hari_c) || 0);
    spell += Number(r.spell) || 0;
    if (String(r.is_pak || '').toLowerCase() === 'ya') pak++;
  }
  return { tk_sakit: rows.length, absensi_sakit: absensi, spell, penyakit_akibat_kerja: pak };
}
