// src/lib/hc-ergo.ts
// Perhitungan Program Konservasi Pendengaran (STD/033, INK/015) dan Ergonomi RULA/ROSA/WERA
// (STD/036, INK/013, FORM/116-118). Fungsi murni: dipakai API (server, otoritatif) dan form (preview).
// Tabel skor RULA disalin dari McAtamney & Corlett 1993; ROSA dari Sonne et al. 2012 (worksheet resmi);
// WERA dari Rahman et al. 2011. Diverifikasi ulang 2026-10-10.

/* ════════════════ HEARING CONSERVATION ════════════════ */

export type Zona = 'HIJAU' | 'KUNING' | 'MERAH';

/** STD/033 6.2: Hijau <82 | Kuning 82-85 | Merah >85 dB(A) */
export function zonaFromLeq(leq: number): Zona {
  if (leq < 82) return 'HIJAU';
  if (leq <= 85) return 'KUNING';
  return 'MERAH';
}

/** STD/033 6.5: NRR minimal APT. Hijau: tidak wajib. >100 dB(A): wajib kombinasi plug + muff. */
export function aptRequirement(zona: Zona, leqMax: number): { nrrMin: number | null; kombinasi: boolean } {
  if (zona === 'HIJAU') return { nrrMin: null, kombinasi: false };
  return { nrrMin: zona === 'KUNING' ? 15 : 20, kombinasi: leqMax > 100 };
}

/** STD/033 6.6: ukur ulang tiap 6 bulan (Kuning/Merah) atau 12 bulan (Hijau). Format YYYY-MM-DD. */
export function jatuhTempoUkur(tanggal: string, zona: Zona): string {
  const [y, m, d] = tanggal.split('-').map(Number);
  const add = zona === 'HIJAU' ? 12 : 6;
  const dt = new Date(Date.UTC(y, m - 1 + add, 1));
  const lastDay = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  dt.setUTCDate(Math.min(d, lastDay));
  return dt.toISOString().slice(0, 10);
}

export const FREQS = ['500', '1k', '2k', '3k', '4k', '6k', '8k'] as const;
export type Freq = (typeof FREQS)[number];
export type Ear = Record<Freq, number | null>;
export interface Audiogram { r: Ear; l: Ear; }

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Ambil audiogram dari baris mcu_records (kolom acr_500..acl_8k). Null jika tidak ada data sama sekali. */
export function audiogramFromRecord(rec: Record<string, unknown>): Audiogram | null {
  const r = {} as Ear, l = {} as Ear;
  let any = false;
  for (const f of FREQS) {
    r[f] = num(rec[`acr_${f}`]);
    l[f] = num(rec[`acl_${f}`]);
    if (r[f] !== null || l[f] !== null) any = true;
  }
  return any ? { r, l } : null;
}

/** STD/033 6.4: 3000 Hz yang kosong pada data historis diestimasi (2000+4000)/2 dan ditandai estimasi. */
export function withEstimate3k(ear: Ear): { ear: Ear; estimated: boolean } {
  if (ear['3k'] === null && ear['2k'] !== null && ear['4k'] !== null) {
    return { ear: { ...ear, '3k': (ear['2k'] + ear['4k']) / 2 }, estimated: true };
  }
  return { ear, estimated: false };
}

export type KelasPendengaran = 'NORMAL' | 'RINGAN' | 'SEDANG' | 'BERAT' | 'SANGAT_BERAT';

/**
 * STD/033 6.4: derajat gangguan dari rata-rata 500/1000/2000/3000 Hz.
 * Celah angka pada dokumen (25-26, 40-41, 60-61, 80-81) ditutup: <=25 Normal, <=40 Ringan, <=60 Sedang, <=80 Berat.
 * Dibandingkan memakai JUMLAH 4 frekuensi (<=100/160/240/320) agar bebas error pembulatan.
 */
export function kelasPendengaran(avg4: number): KelasPendengaran {
  const sum = avg4 * 4;
  if (sum <= 100) return 'NORMAL';
  if (sum <= 160) return 'RINGAN';
  if (sum <= 240) return 'SEDANG';
  if (sum <= 320) return 'BERAT';
  return 'SANGAT_BERAT';
}

export const KELAS_LABEL: Record<KelasPendengaran, string> = {
  NORMAL: 'Normal', RINGAN: 'Ringan', SEDANG: 'Sedang', BERAT: 'Berat', SANGAT_BERAT: 'Sangat Berat',
};
const KELAS_ORDER: KelasPendengaran[] = ['NORMAL', 'RINGAN', 'SEDANG', 'BERAT', 'SANGAT_BERAT'];

const sumOf = (ear: Ear, fs: Freq[]): number | null => {
  let s = 0;
  for (const f of fs) { const v = ear[f]; if (v === null) return null; s += v; }
  return s;
};

export interface EarEval { avg4: number | null; avg3: number | null; kelas: KelasPendengaran | null; estimated: boolean; }

export function evaluateEar(ear: Ear): EarEval {
  const { ear: e, estimated } = withEstimate3k(ear);
  const s4 = sumOf(e, ['500', '1k', '2k', '3k']);
  const s3 = sumOf(e, ['2k', '3k', '4k']);
  const avg4 = s4 === null ? null : s4 / 4;
  return { avg4, avg3: s3 === null ? null : s3 / 3, kelas: avg4 === null ? null : kelasPendengaran(avg4), estimated };
}

export interface AudiogramEval {
  kanan: EarEval; kiri: EarEval;
  kelasTerburuk: KelasPendengaran | null;
  baseline: null | {
    geserKanan: number | null; geserKiri: number | null;
    stsKanan: boolean; stsKiri: boolean; sts: boolean; berbasisEstimasi: boolean;
  };
}

/** STS (STD/033 6.4, INK/015 6.4): geser rata-rata 2000/3000/4000 Hz >= 10 dB per telinga vs baseline. */
export function evaluateAudiogram(current: Audiogram, baseline?: Audiogram | null): AudiogramEval {
  const kanan = evaluateEar(current.r), kiri = evaluateEar(current.l);
  const kelas = [kanan.kelas, kiri.kelas].filter(Boolean) as KelasPendengaran[];
  const kelasTerburuk = kelas.length ? kelas.reduce((a, b) => (KELAS_ORDER.indexOf(b) > KELAS_ORDER.indexOf(a) ? b : a)) : null;
  let base: AudiogramEval['baseline'] = null;
  if (baseline) {
    const bR = evaluateEar(baseline.r), bL = evaluateEar(baseline.l);
    // bandingkan dalam bentuk jumlah (x3) supaya ambang 10 dB tepat, tanpa error pembulatan
    const gR = kanan.avg3 !== null && bR.avg3 !== null ? kanan.avg3 - bR.avg3 : null;
    const gL = kiri.avg3 !== null && bL.avg3 !== null ? kiri.avg3 - bL.avg3 : null;
    const stsR = gR !== null && Math.round(gR * 3 * 100) >= 3000;
    const stsL = gL !== null && Math.round(gL * 3 * 100) >= 3000;
    base = {
      geserKanan: gR === null ? null : Math.round(gR * 10) / 10,
      geserKiri: gL === null ? null : Math.round(gL * 10) / 10,
      stsKanan: stsR, stsKiri: stsL, sts: stsR || stsL,
      berbasisEstimasi: kanan.estimated || kiri.estimated || bR.estimated || bL.estimated,
    };
  }
  return { kanan, kiri, kelasTerburuk, baseline: base };
}

/* ════════════════ ERGONOMI ════════════════ */

export type Metode = 'RULA' | 'ROSA' | 'WERA';
export type Klasifikasi = 'RENDAH' | 'SEDANG' | 'TINGGI' | 'SANGAT_TINGGI';

export const FORM_NO: Record<Metode, string> = {
  RULA: 'BG/QSHE/FORM/116', ROSA: 'BG/QSHE/FORM/117', WERA: 'BG/QSHE/FORM/118',
};

type Mx = { rows: string[]; cols: string[]; data: number[][] };

/**
 * Matrix skor resmi.
 * RULA  : McAtamney & Corlett, Applied Ergonomics 1993
 * ROSA  : Sonne, Villalta & Andrews, Applied Ergonomics 2012 (worksheet resmi Cornell)
 * WERA  : Rahman et al., Journal of Human Ergology 2011
 */
const MATRIX: Record<string, Mx> = {
  "RULA_A": {
    "rows": ["1-1","1-2","1-3","2-1","2-2","2-3","3-1","3-2","3-3","4-1","4-2","4-3","5-1","5-2","5-3","6-1","6-2","6-3"],
    "cols": ["W1T1","W1T2","W2T1","W2T2","W3T1","W3T2","W4T1","W4T2"],
    "data": [[1,2,2,2,2,3,3,3],[2,2,2,2,3,3,3,3],[2,3,3,3,3,3,4,4],[2,3,3,3,3,4,4,4],[3,3,3,3,3,4,4,4],[3,4,4,4,4,4,5,5],[3,3,4,4,4,4,5,5],[3,4,4,4,4,4,5,5],[4,4,4,4,4,5,5,5],[4,4,4,4,4,5,5,5],[4,4,4,4,4,5,5,5],[4,4,4,4,5,5,5,6],[5,5,5,5,5,6,6,7],[5,6,6,6,6,7,7,7],[6,6,6,7,7,7,7,8],[7,7,7,7,7,8,8,9],[8,8,8,8,8,9,9,9],[9,9,9,9,9,9,9,9]]
  },
  "RULA_B": {
    "rows": ["1","2","3","4","5","6"],
    "cols": ["K1L1","K1L2","K2L1","K2L2","K3L1","K3L2","K4L1","K4L2","K5L1","K5L2","K6L1","K6L2"],
    "data": [[1,3,2,3,3,4,5,5,6,6,7,7],[2,3,2,3,4,5,5,6,6,7,7,7],[3,3,3,4,4,5,5,6,6,7,7,7],[5,5,5,6,6,7,7,7,7,7,8,8],[7,7,7,7,7,8,8,8,8,8,8,8],[8,8,8,8,8,8,8,9,9,9,9,9]]
  },
  "RULA_C": {
    "rows": ["1","2","3","4","5","6","7","8+"],
    "cols": ["1","2","3","4","5","6","7+"],
    "data": [[1,2,3,3,4,5,5],[2,2,3,4,4,5,5],[3,3,3,4,4,5,6],[3,3,3,4,5,6,6],[4,4,4,5,6,7,7],[4,4,5,6,6,7,7],[5,5,6,6,7,7,7],[5,5,6,7,7,7,7]]
  },
  // ROSA Section A – Chair (Height+Depth vs Armrest+Backrest)
  // Official Sonne et al. 2012 / Cornell worksheet (corrected 2026-10-10)
  // Rows = seat (height+depth) 2..8 ; Cols = arm (armrest+backrest) 2..9
  "ROSA_A": {
    "rows": ["2","3","4","5","6","7","8"],
    "cols": ["2","3","4","5","6","7","8","9"],
    "data": [
      [1,2,3,4,5,6,7,8], // seat 2
      [2,2,3,4,5,6,7,8], // seat 3
      [3,3,3,4,5,6,7,8], // seat 4
      [4,4,4,4,5,6,7,8], // seat 5
      [5,5,5,5,6,7,8,9], // seat 6
      [6,6,6,7,7,8,8,9], // seat 7
      [7,7,7,8,8,9,9,9]  // seat 8
    ]
  },
  // Section B – Monitor (cols) vs Phone (rows) – matches official
  "ROSA_B": {
    "rows": ["0","1","2","3","4","5","6"],
    "cols": ["0","1","2","3","4","5","6","7"],
    "data": [[1,1,1,2,3,4,5,6],[1,1,2,2,3,4,5,6],[1,2,2,3,3,4,6,7],[2,2,3,3,4,5,6,8],[3,3,4,4,5,6,7,8],[4,4,5,5,6,7,8,9],[5,5,6,7,8,8,9,9]]
  },
  // Section C – Mouse (rows) vs Keyboard (cols) – matches official
  "ROSA_C": {
    "rows": ["0","1","2","3","4","5","6","7"],
    "cols": ["0","1","2","3","4","5","6","7"],
    "data": [[1,1,1,2,3,4,5,6],[1,1,2,3,4,5,6,7],[1,2,2,3,4,5,6,7],[2,3,3,3,5,6,7,8],[3,4,4,5,5,6,7,8],[4,5,5,6,6,7,8,9],[5,6,6,7,7,8,8,9],[6,7,7,8,8,9,9,9]]
  },
  // Peripheral chart (Section B vs Section C)
  "ROSA_PERIPH": {
    "rows": ["1","2","3","4","5","6","7","8","9"],
    "cols": ["1","2","3","4","5","6","7","8","9"],
    "data": [[1,2,3,4,5,6,7,8,9],[2,2,3,4,5,6,7,8,9],[3,3,3,4,5,6,7,8,9],[4,4,4,4,5,6,7,8,9],[5,5,5,5,5,6,7,8,9],[6,6,6,6,6,6,7,8,9],[7,7,7,7,7,7,7,8,9],[8,8,8,8,8,8,8,8,9],[9,9,9,9,9,9,9,9,9]]
  },
  // Final ROSA chart (Section A vs Peripheral)
  "ROSA_FINAL": {
    "rows": ["1","2","3","4","5","6","7","8","9"],
    "cols": ["1","2","3","4","5","6","7","8","9","10"],
    "data": [[1,2,3,4,5,6,7,8,9,10],[2,2,3,4,5,6,7,8,9,10],[3,3,3,4,5,6,7,8,9,10],[4,4,4,4,5,6,7,8,9,10],[5,5,5,5,5,6,7,8,9,10],[6,6,6,6,6,6,7,8,9,10],[7,7,7,7,7,7,7,8,9,10],[8,8,8,8,8,8,8,8,9,10],[9,9,9,9,9,9,9,9,9,10]]
  }
};

const WERA_SKOR = [[2, 3, 4], [3, 4, 5], [4, 5, 6]];

const inRange = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
const need = (cond: boolean, msg: string) => { if (!cond) throw new Error(msg); };
const cell = (m: Mx, r: number, c: number, name: string) => {
  const row = m.data[r];
  need(row !== undefined && row[c] !== undefined, `Kombinasi nilai tidak ada pada tabel ${name}`);
  return row[c];
};

export interface RulaInput {
  upper_arm: number; lower_arm: number; wrist: number; wrist_twist: number; muscle_a: number; force_a: number;
  neck: number; trunk: number; legs: number; muscle_b: number; force_b: number;
}
export function scoreRULA(i: RulaInput) {
  need(inRange(i.upper_arm, 1, 6), 'Upper arm harus 1-6');
  need(inRange(i.lower_arm, 1, 3), 'Lower arm harus 1-3');
  need(inRange(i.wrist, 1, 4), 'Wrist harus 1-4');
  need(inRange(i.wrist_twist, 1, 2), 'Wrist twist harus 1 (T1) atau 2 (T2)');
  need(inRange(i.muscle_a, 0, 1) && inRange(i.muscle_b, 0, 1), 'Skor otot harus 0 atau 1');
  need(inRange(i.force_a, 0, 3) && inRange(i.force_b, 0, 3), 'Skor beban/tenaga harus 0-3');
  need(inRange(i.neck, 1, 6), 'Neck harus 1-6');
  need(inRange(i.trunk, 1, 6), 'Trunk harus 1-6');
  need(inRange(i.legs, 1, 2), 'Legs harus 1-2');
  const A = MATRIX.RULA_A;
  const rowA = A.rows.indexOf(`${i.upper_arm}-${i.lower_arm}`);
  const skorA = cell(A, rowA, (i.wrist - 1) * 2 + (i.wrist_twist - 1), 'RULA A');
  const skorB = cell(MATRIX.RULA_B, i.neck - 1, (i.trunk - 1) * 2 + (i.legs - 1), 'RULA B');
  const skorC = skorA + i.muscle_a + i.force_a;
  const skorD = skorB + i.muscle_b + i.force_b;
  const akhir = cell(MATRIX.RULA_C, Math.min(skorC, 8) - 1, Math.min(skorD, 7) - 1, 'RULA C');
  return { skorA, skorB, skorC, skorD, akhir };
}

export interface RosaInput {
  chair_height: number; pan_depth: number; armrest: number; backrest: number;
  monitor: number; phone: number; mouse: number; keyboard: number;
  // Duration scores (official ROSA): -1 / 0 / +1 per section. Optional for backward compatibility.
  duration_chair?: number;   // -1 | 0 | 1
  duration_monitor?: number; // -1 | 0 | 1
  duration_mouse?: number;   // -1 | 0 | 1
}

/**
 * ROSA scoring – Sonne et al. 2012.
 * Duration is optional; if omitted, treated as 0 (no adjustment).
 * When duration is supplied, it is added to the respective section score before chart lookup
 * (clamped to valid chart range).
 */
export function scoreROSA(i: RosaInput) {
  need(inRange(i.chair_height, 1, 5), 'Tinggi kursi harus 1-5');
  need(inRange(i.pan_depth, 1, 3), 'Kedalaman dudukan harus 1-3');
  need(inRange(i.armrest, 1, 5), 'Sandaran tangan harus 1-5');
  need(inRange(i.backrest, 1, 4), 'Sandaran punggung harus 1-4');
  need(inRange(i.monitor, 0, 7), 'Monitor harus 0-7');
  need(inRange(i.phone, 0, 6), 'Telepon harus 0-6');
  need(inRange(i.mouse, 0, 7), 'Mouse harus 0-7');
  need(inRange(i.keyboard, 0, 7), 'Keyboard harus 0-7');

  const durChair = i.duration_chair ?? 0;
  const durMon   = i.duration_monitor ?? 0;
  const durMouse = i.duration_mouse ?? 0;

  // Section A (Chair)
  const seat = i.chair_height + i.pan_depth;
  const arm  = i.armrest + i.backrest;
  let sectionA = cell(MATRIX.ROSA_A, seat - 2, arm - 2, 'ROSA Section A');
  sectionA = Math.max(1, Math.min(9, sectionA + durChair));

  // Section B (Monitor + Phone)
  let sectionB = cell(MATRIX.ROSA_B, i.phone, i.monitor, 'ROSA Section B');
  sectionB = Math.max(1, Math.min(9, sectionB + durMon));

  // Section C (Mouse + Keyboard)
  let sectionC = cell(MATRIX.ROSA_C, i.mouse, i.keyboard, 'ROSA Section C');
  sectionC = Math.max(1, Math.min(9, sectionC + durMouse));

  const periph = cell(MATRIX.ROSA_PERIPH, sectionB - 1, sectionC - 1, 'ROSA Peripherals');
  const akhir  = cell(MATRIX.ROSA_FINAL, sectionA - 1, periph - 1, 'ROSA Final');

  return { sectionA, sectionB, sectionC, periph, akhir };
}

export interface WeraInput {
  bahu_sikap: number; bahu_ulang: number; tangan_sikap: number; tangan_ulang: number;
  punggung_sikap: number; punggung_ulang: number; leher_sikap: number; leher_ulang: number;
  kaki_sikap: number; lvl_kuat: number; lvl_getaran: number; lvl_tekanan: number; lvl_durasi: number;
}
/** Level 1=LOW 2=MED 3=HIGH. Sumbu faktor 6-9 mengikuti label pada FORM/118. */
export function scoreWERA(i: WeraInput) {
  for (const [k, v] of Object.entries(i)) need(inRange(v, 1, 3), `${k} harus 1 (LOW), 2 (MED), atau 3 (HIGH)`);
  const m = (a: number, b: number) => WERA_SKOR[a - 1][b - 1];
  const s = [
    m(i.bahu_sikap, i.bahu_ulang), m(i.tangan_sikap, i.tangan_ulang), m(i.punggung_sikap, i.punggung_ulang),
    m(i.leher_sikap, i.leher_ulang), m(i.kaki_sikap, i.lvl_durasi), m(i.punggung_sikap, i.lvl_kuat),
    m(i.tangan_sikap, i.lvl_getaran), m(i.tangan_sikap, i.lvl_tekanan), m(i.lvl_kuat, i.lvl_durasi),
  ];
  return { faktor: s, akhir: s.reduce((a, b) => a + b, 0) };
}

/** Teks "Interpretasi" pada FORM/116-118; label 4 tingkat adalah penyeragaman. */
export function klasifikasiErgo(metode: Metode, skor: number): Klasifikasi {
  if (metode === 'RULA') return skor <= 2 ? 'RENDAH' : skor <= 4 ? 'SEDANG' : skor <= 6 ? 'TINGGI' : 'SANGAT_TINGGI';
  if (metode === 'ROSA') return skor <= 3 ? 'RENDAH' : skor <= 6 ? 'SEDANG' : skor <= 8 ? 'TINGGI' : 'SANGAT_TINGGI';
  return skor <= 27 ? 'RENDAH' : skor <= 44 ? 'SEDANG' : 'TINGGI';
}
/** INK/013 6.5: PICA untuk klasifikasi sedang ke atas. */
export const perluPica = (k: Klasifikasi) => k !== 'RENDAH';
/** FORM/116: batas tindak lanjut RULA (hari kerja). ROSA/WERA tidak punya batas hari pada dokumen. */
export function batasTindakHariKerja(metode: Metode, skor: number): number | null {
  if (metode !== 'RULA') return null;
  return skor === 7 ? 7 : skor >= 5 ? 14 : skor >= 3 ? 30 : null;
}

export function scoreErgo(metode: Metode, input: Record<string, number>) {
  const hasil = metode === 'RULA' ? scoreRULA(input as unknown as RulaInput)
    : metode === 'ROSA' ? scoreROSA(input as unknown as RosaInput)
    : scoreWERA(input as unknown as WeraInput);
  const klas = klasifikasiErgo(metode, hasil.akhir);
  return { hasil, skorAkhir: hasil.akhir, klasifikasi: klas, perluPica: perluPica(klas), batasHari: batasTindakHariKerja(metode, hasil.akhir) };
}

/** Tambah hari kerja (Senin-Jumat). Hari libur nasional TIDAK dikecualikan. */
export function addWorkdays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d.toISOString().slice(0, 10);
}

export const KLAS_COLOR: Record<Klasifikasi, string> = {
  RENDAH: '#00B894', SEDANG: '#F5A623', TINGGI: '#FF6B35', SANGAT_TINGGI: '#E63946',
};
export const ZONA_COLOR: Record<Zona, string> = { HIJAU: '#00B894', KUNING: '#F5C518', MERAH: '#E63946' };
