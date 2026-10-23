// ============================================================
// Engine Skor Kuesioner Kesehatan Karyawan — STD-006 Rev001
// ============================================================
//
// Empat instrumen yang disebut STD-006 Rev001 Bab 7 sebagai parameter
// zonasi, ditambah satu instrumen pelengkap:
//
//   • ESS    — Epworth Sleepiness Scale, 8 item, skala 0–4
//               Normal <11 · Ringan–Sedang 11–15 · Berat >15
//   • SRQ-20 — Self-Reporting Questionnaire-20 (WHO), 20 item Ya/Tidak
//               Skor ≥6 → kemungkinan gangguan mental emosional
//   • DASS-21— Depression Anxiety Stress Scales-21, 21 item skala 0–3
//               Depresi, ansietas, dan stres dinilai terpisah
//   • SDS-30 — Survei Diagnosis Stres (Permenaker 5/2018), 30 item skala 1–7
//               6 indikator × 5 item; skor indikator ≤9 ringan · 10–24 sedang · >24 berat
//
// Naskah item ada di questionnaire-items.ts. Modul ini hanya menghitung
// skor, jadi mengganti naskah item tidak mengubah hasil perhitungan.
//
// Kolom snapshot di mcu_records mengizinkan modul ini tetap murni
// (tanpa akses database), sehingga pipeline import Excel dan engine
// aplikasi memakai perhitungan yang persis sama.
// ============================================================

import { DASS21_SECTIONS, SDS_SECTIONS } from '@/lib/questionnaire-items';

// ────────────────────────────────────────────────────────────
// Epworth Sleepiness Scale (ESS)
// ────────────────────────────────────────────────────────────

export const ESS_ITEM_COUNT = 8;
export const ESS_MAX_SCORE = 32;

export type EssCategory = 'normal' | 'ringan-sedang' | 'berat' | 'tidak-lengkap';

export interface EssResult {
  /** Skor pada rentang 0–32, sudah dinormalkan bila ada item kosong. */
  score: number;
  category: EssCategory;
  label: string;
  answered: number;
  total: number;
}

/**
 * Menghitung skor ESS. Bila ada item yang belum diisi, skor dinormalkan
 * ke rentang 0–32 dengan membagi total jawaban, dan hasilnya ditandai
 * 'tidak-lengkap' supaya tidak dipakai sebagai keputusan klinis final.
 */
export function scoreEss(answers: Record<string, string | number | null | undefined>): EssResult {
  let total = 0;
  let answered = 0;
  for (let i = 1; i <= ESS_ITEM_COUNT; i += 1) {
    const value = readScale(answers[`ess${i}`], 0, 4);
    if (value === null) continue;
    total += value;
    answered += 1;
  }

  if (answered === 0) {
    return { score: 0, category: 'tidak-lengkap', label: 'Belum diisi', answered, total: ESS_ITEM_COUNT };
  }

  const score = Math.round((total / answered) * ESS_ITEM_COUNT);
  if (answered < ESS_ITEM_COUNT) {
    return {
      score,
      category: 'tidak-lengkap',
      label: `Belum lengkap (${answered}/${ESS_ITEM_COUNT} item) — skor preliminer ${score}`,
      answered,
      total: ESS_ITEM_COUNT,
    };
  }
  if (score > 15) {
    return { score, category: 'berat', label: 'Excessive Daytime Sleepiness (Severe)', answered, total: ESS_ITEM_COUNT };
  }
  if (score >= 11) {
    return { score, category: 'ringan-sedang', label: 'Excessive Daytime Sleepiness (Mild to Moderate)', answered, total: ESS_ITEM_COUNT };
  }
  return { score, category: 'normal', label: 'No Sleep Disorder Symptom', answered, total: ESS_ITEM_COUNT };
}

// ────────────────────────────────────────────────────────────
// SRQ-20 (Self-Reporting Questionnaire, WHO)
// ────────────────────────────────────────────────────────────

export const SRQ20_ITEM_COUNT = 20;
export const SRQ20_THRESHOLD = 6;
/**
 * STD/006 Rev.002 poin 6.1.8 & Lampiran 2: jawaban "Ya" pada butir 17
 * (pikiran untuk mengakhiri hidup) adalah TANDA BAHAYA KESEHATAN JIWA yang
 * wajib ditindaklanjuti dokter pada HARI YANG SAMA, berapa pun skor totalnya.
 * Sampai dinilai dokter, karyawan tidak ditugaskan pada pekerjaan berisiko
 * tinggi (termasuk mengemudi).
 */
export const SRQ20_DANGER_ITEM = 'srq17';

export type Srq20Category = 'normal' | 'perlu-tindak-lanjut' | 'tidak-lengkap';

export interface Srq20Result {
  score: number;
  category: Srq20Category;
  label: string;
  answered: number;
  total: number;
  /**
   * true bila butir 17 dijawab "Ya" — memicu jalur Tanda Bahaya Kesehatan Jiwa
   * yang tidak bergantung pada skor total (bisa tetap Zona Merah walau skor <6).
   */
  danger: boolean;
}

export function scoreSrq20(answers: Record<string, string | number | null | undefined>): Srq20Result {
  let score = 0;
  let answered = 0;
  for (let i = 1; i <= SRQ20_ITEM_COUNT; i += 1) {
    const raw = answers[`srq${i}`];
    if (raw === null || raw === undefined || raw === '') continue;
    const value = readYesNo(raw);
    if (value === null) continue;
    score += value;
    answered += 1;
  }
  const danger = readYesNo(answers[SRQ20_DANGER_ITEM]) === 1;

  if (answered === 0) {
    return { score: 0, category: 'tidak-lengkap', label: 'Belum diisi', answered, total: SRQ20_ITEM_COUNT, danger: false };
  }
  if (answered < SRQ20_ITEM_COUNT) {
    return {
      score,
      category: 'tidak-lengkap',
      label: `Belum lengkap (${answered}/${SRQ20_ITEM_COUNT} item)`,
      answered,
      total: SRQ20_ITEM_COUNT,
      danger,
    };
  }
  if (danger) {
    // Tanda bahaya mengalahkan ambang skor: label harus memerintahkan tindakan
    // hari yang sama, bukan sekadar "rujukan".
    return {
      score,
      category: 'perlu-tindak-lanjut',
      label: `TANDA BAHAYA KESEHATAN JIWA (butir 17 = Ya) — dokter menilai HARI INI; skor ${score}`,
      answered,
      total: SRQ20_ITEM_COUNT,
      danger,
    };
  }
  if (score >= SRQ20_THRESHOLD) {
    return {
      score,
      category: 'perlu-tindak-lanjut',
      label: `Possible Mental Disorder (score ${score} >= ${SRQ20_THRESHOLD}) — rujuk psikolog atau psikiater`,
      answered,
      total: SRQ20_ITEM_COUNT,
      danger,
    };
  }
  return { score, category: 'normal', label: 'No Significant Psychological Distress', answered, total: SRQ20_ITEM_COUNT, danger };
}

// ────────────────────────────────────────────────────────────
// DASS-21
// ────────────────────────────────────────────────────────────

export const DASS21_ITEM_COUNT = 21;

export type DassDomain = 'depresi' | 'ansietas' | 'stres';
export type DassCategory = 'normal' | 'ringan' | 'sedang' | 'berat' | 'sangat-berat' | 'tidak-lengkap';

export interface DassScore {
  score: number;
  category: DassCategory;
  label: string;
  answered: number;
  total: number;
}

export interface Dass21Result {
  depresi: DassScore;
  ansietas: DassScore;
  stres: DassScore;
  /** Subskala dengan skor tertinggi — dipakai parameter zonasi. */
  highest: { domain: DassDomain; score: number; label: string };
  answered: number;
  total: number;
}

/**
 * Ambang kategorisasi DASS-21 (Lovibond & Lovibond, 1995).
 *
 * PENTING: ambangnya BERBEDA untuk tiap subskala, jadi tidak boleh memakai
 * satu tabel untuk ketiganya. Depresi mulai dianggap tidak normal pada skor
 * 10, ansietas sudah pada 8, sedangkan stres masih normal sampai 11. Satu
 * tabel bersama akan salah menandai stres ringan sebagai depresi ringan.
 *
 * CATATAN TENTANG BANDA TERATAS
 *
 * Tabel asli Lovibond menulis "extremely severe" mulai 28 untuk depresi dan
 * ansietas. Angka itu berasal dari versi 42 butir. Pada DASS-21, jumlah item
 * tiap subskala hanya 9, 7, dan 5, sehingga skor maksimum yang mungkin
 * hanyalah 27, 21, dan 15. Dengan tabel apa adanya, banda "sangat berat"
 * tidak akan pernah muncul sama sekali — skor tertinggi yang mungkin dicapai
 * akan terbaca sebagai "berat".
 *
 * Tabel di bawah adalah tabel RESMI DASS-21 (Lovibond & Lovibond 1995) yang
 * berlaku untuk skor subskala yang SUDAH DIKALI 2 (rentang 0–42).
 *
 * AUDIT (STD/006 Rev.002 Lampiran 2):
 *  - Depresi   : Normal 0–9, Ringan 10–13, Sedang 14–20, Berat 21–27, Sangat berat ≥28
 *  - Ansietas  : Normal 0–7, Ringan 8–9, Sedang 10–14, Berat 15–19, Sangat berat ≥20
 *  - Stres     : Normal 0–14, Ringan 15–18, Sedang 19–25, Berat 26–33, Sangat berat ≥34
 *
 * SEBELUMNYA ada dua kesalahan:
 *  1. Fungsi pemanggil mengirim skor MENTAH (0–21) tanpa dikali 2, sehingga
 *     hasil selalu terbaca terlalu ringan (mis. depresi skor mentah 10 = 20 →
 *     harusnya "Sedang", tetapi dinilai dengan 10 → "Ringan").
 *  2. Batas atas rentang tertinggi dipangkas ke 27/21/15 karena "tidak pernah
 *     tercapai", padahal skor ×2 memang bisa mencapai 42.
 * Keduanya dihapus: nilai di bawah ini harus sama persis dengan dokumen.
 */
const DASS_BANDS: Record<DassDomain, { max: number; category: DassCategory; label: string }[]> = {
  depresi: [
    { max: 9, category: 'normal', label: 'Normal' },
    { max: 13, category: 'ringan', label: 'Ringan' },
    { max: 20, category: 'sedang', label: 'Sedang' },
    { max: 27, category: 'berat', label: 'Berat' },
    { max: Number.POSITIVE_INFINITY, category: 'sangat-berat', label: 'Sangat Berat' },
  ],
  ansietas: [
    { max: 7, category: 'normal', label: 'Normal' },
    { max: 9, category: 'ringan', label: 'Ringan' },
    { max: 14, category: 'sedang', label: 'Sedang' },
    { max: 19, category: 'berat', label: 'Berat' },
    { max: Number.POSITIVE_INFINITY, category: 'sangat-berat', label: 'Sangat Berat' },
  ],
  stres: [
    { max: 14, category: 'normal', label: 'Normal' },
    { max: 18, category: 'ringan', label: 'Ringan' },
    { max: 25, category: 'sedang', label: 'Sedang' },
    { max: 33, category: 'berat', label: 'Berat' },
    { max: Number.POSITIVE_INFINITY, category: 'sangat-berat', label: 'Sangat Berat' },
  ],
};

/**
 * Kategori DASS-21.
 *
 * `rawScore` adalah skor MENTAH satu subskala (0–21, hasil penjumlahan 7 item
 * skala 0–3). Sesuai STD/006 Lampiran 2 dan manual Lovibond, skor mentah
 * DIKALI 2 lebih dulu baru dibaca pada tabel kategori. Pengalian dilakukan di
 * dalam fungsi ini supaya tidak ada pemanggil yang lupa mengalikannya — itulah
 * sumber kesalahan penilaian sebelum perbaikan ini.
 */
export function dassBandLabel(domain: DassDomain, rawScore: number): string {
  const bands = DASS_BANDS[domain];
  const score = rawScore * 2;
  return bands.find((band) => score <= band.max)?.label ?? 'Normal';
}

export function dassCategory(domain: DassDomain, rawScore: number): DassCategory {
  const bands = DASS_BANDS[domain];
  const score = rawScore * 2;
  return bands.find((band) => score <= band.max)?.category ?? 'sangat-berat';
}

/**
 * Skor subskala yang dianggap "berat atau lebih" pada parameter zonasi.
 * Sesuai STD-006, depresi berat dengan risiko diri dan psikosis aktif
 * menurunkan zona, jadi ambangnya mengikuti kategori "berat".
 */
export function isDassActionable(domain: DassDomain, rawScore: number): boolean {
  const category = dassCategory(domain, rawScore);
  return category === 'berat' || category === 'sangat-berat';
}

function buildDassScore(domain: DassDomain, items: number[], answers: Record<string, string | number | null | undefined>): DassScore {
  let score = 0;
  let answered = 0;
  for (const index of items) {
    const value = readScale(answers[`dass${index}`], 0, 3);
    if (value === null) continue;
    score += value;
    answered += 1;
  }
  if (answered === 0) {
    return { score: 0, category: 'tidak-lengkap', label: 'Belum diisi', answered, total: items.length };
  }
  if (answered < items.length) {
    return {
      score,
      category: 'tidak-lengkap',
      label: `Belum lengkap (${answered}/${items.length} item)`,
      answered,
      total: items.length,
    };
  }
  const category = dassCategory(domain, score);
  // `score` yang dikembalikan tetap nilai mentah (0–21) agar dapat
  // dibandingkan dengan kolom dass* pada MCU; fungsi kategori mengalikannya
  // sendiri dengan 2 sesuai STD/006 Lampiran 2.
  return { score, category, label: dassBandLabel(domain, score), answered, total: items.length };
}

export function scoreDass21(answers: Record<string, string | number | null | undefined>): Dass21Result {
  const sectionItems = (id: DassDomain): number[] =>
    DASS21_SECTIONS.find((section) => section.id === id)?.items ?? [];

  const depresi = buildDassScore('depresi', sectionItems('depresi'), answers);
  const ansietas = buildDassScore('ansietas', sectionItems('ansietas'), answers);
  const stres = buildDassScore('stres', sectionItems('stres'), answers);

  const all: [DassDomain, DassScore][] = [
    ['depresi', depresi],
    ['ansietas', ansietas],
    ['stres', stres],
  ];
  const ranked = all
    .filter(([, value]) => value.category !== 'tidak-lengkap')
    .sort((a, b) => b[1].score - a[1].score);

  const top = ranked[0];

  return {
    depresi,
    ansietas,
    stres,
    highest: top
      ? { domain: top[0], score: top[1].score, label: top[1].label }
      : { domain: 'depresi', score: 0, label: 'Belum diisi' },
    answered: depresi.answered + ansietas.answered + stres.answered,
    total: DASS21_ITEM_COUNT,
  };
}

// ────────────────────────────────────────────────────────────
// SDS-30 — Survei Diagnosis Stres (Lampiran Permenaker 5/2018)
// 30 item, skala 1–7, 6 indikator × 5 item, skor indikator 5–35
// ────────────────────────────────────────────────────────────

export const SDS_ITEM_COUNT = 30;
export const SDS_SCALE_MIN = 1;
export const SDS_SCALE_MAX = 7;
/** Skor per indikator: 5 item × rentang 1–7. */
export const SDS_INDICATOR_MIN = 5;
export const SDS_INDICATOR_MAX = 35;

export type SdsCategory = 'ringan' | 'sedang' | 'berat' | 'tidak-lengkap';

export interface SdsIndicatorResult {
  id: string;
  title: string;
  /** Jumlah 5 item indikator, 5–35. */
  score: number;
  category: SdsCategory;
  label: string;
  answered: number;
}

export interface SdsResult {
  /** Total 30 item (30–210). Bukan dasar kategori; hanya ringkasan. */
  rawIndex: number;
  /** Kategori keseluruhan = tingkat terburuk antarindikator. */
  category: SdsCategory;
  label: string;
  answered: number;
  total: number;
  /** Hasil per indikator, untuk tabel dan dashboard. */
  indicators: SdsIndicatorResult[];
}

/**
 * Kategori derajat stres per indikator — disalin apa adanya dari bagian
 * "Kesimpulan" pada Lampiran Permenaker 5/2018 (halaman 207):
 *   skor ≤ 9    : derajat stres RINGAN
 *   skor 10–24  : derajat stres SEDANG
 *   skor > 24   : derajat stres BERAT
 * Catatan: dokumen memakai kata RINGAN/SEDANG/BERAT (bukan rendah/tinggi)
 * dan ambang atasnya "> 24", yaitu sama dengan ≥ 25 pada skor bilangan bulat.
 * Jangan diubah tanpa merujuk ulang dokumennya.
 */
export function sdsBandLabel(score: number): string {
  if (score > 24) return 'Stres Berat';
  if (score >= 10) return 'Stres Sedang';
  return 'Stres Ringan';
}

function sdsBandCategory(score: number): SdsCategory {
  if (score > 24) return 'berat';
  if (score >= 10) return 'sedang';
  return 'ringan';
}

export function scoreSds(answers: Record<string, string | number | null | undefined>): SdsResult {
  let total = 0;
  let answered = 0;
  for (let i = 1; i <= SDS_ITEM_COUNT; i += 1) {
    const value = readScale(answers[`sds${i}`], SDS_SCALE_MIN, SDS_SCALE_MAX);
    if (value === null) continue;
    // Tidak ada item terbalik pada SDS-30: semua pertanyaan bernada negatif.
    total += value;
    answered += 1;
  }

  const indicators: SdsIndicatorResult[] = SDS_SECTIONS.map((section) => {
    let score = 0;
    let filled = 0;
    for (const no of section.items) {
      const value = readScale(answers[`sds${no}`], SDS_SCALE_MIN, SDS_SCALE_MAX);
      if (value === null) continue;
      score += value;
      filled += 1;
    }
    const complete = filled === section.items.length;
    return {
      id: section.id,
      title: section.title,
      score,
      category: complete ? sdsBandCategory(score) : 'tidak-lengkap',
      label: complete ? sdsBandLabel(score) : `Belum lengkap (${filled}/${section.items.length})`,
      answered: filled,
    };
  });

  if (answered === 0) {
    return { rawIndex: 0, category: 'tidak-lengkap', label: 'Belum diisi', answered, total: SDS_ITEM_COUNT, indicators };
  }
  if (answered < SDS_ITEM_COUNT) {
    return {
      rawIndex: total,
      category: 'tidak-lengkap',
      label: `Belum lengkap (${answered}/${SDS_ITEM_COUNT} item)`,
      answered,
      total: SDS_ITEM_COUNT,
      indicators,
    };
  }

  // Kategori keseluruhan ditentukan indikator terburuk — sesuai praktik
  // pengendalian risiko K3: satu indikator berat sudah butuh intervensi.
  const rank: Record<SdsCategory, number> = { ringan: 0, sedang: 1, berat: 2, 'tidak-lengkap': -1 };
  const worst = indicators.reduce<SdsCategory>((acc, ind) =>
    rank[ind.category] > rank[acc] ? ind.category : acc, 'ringan');

  return { rawIndex: total, category: worst, label: sdsBandLabel(worst === 'berat' ? 25 : worst === 'sedang' ? 10 : 5), answered, total: SDS_ITEM_COUNT, indicators };
}

// ────────────────────────────────────────────────────────────
// Ringkasan untuk kolom snapshot di mcu_records
// ────────────────────────────────────────────────────────────

export interface QuestionnaireSnapshot {
  essScore: number | null;
  srq20Score: number | null;
  dassDepresi: number | null;
  dassCemas: number | null;
  dassStres: number | null;
  sdsScore: number | null;
}

export function essBandLabel(score: number): string {
  if (score > 15) return 'Berat';
  if (score >= 11) return 'Ringan-Sedang';
  return 'Normal';
}

/**
 * Satu baris ringkasan untuk disimpan di mcu_records. Dipakai engine
 * zonasi agar klasifikasi tetap dapat dibaca tanpa query database.
 * Kolom yang kosong sengaja TIDAK ditulis — kolom kosong diartikan
 * normal sesuai instruksi QSHE.
 */
export function summariseQuestionnaires(input: QuestionnaireSnapshot): string {
  const parts: string[] = [];

  if (input.essScore !== null) {
    parts.push(`ESS ${input.essScore} (${essBandLabel(input.essScore)})`);
  }
  if (input.srq20Score !== null) {
    parts.push(`SRQ-20 ${input.srq20Score} (${input.srq20Score >= SRQ20_THRESHOLD ? 'perlu tindak lanjut' : 'normal'})`);
  }

  // Bandingkan ketiganya pada kategori yang sama, bukan pada angka mentah:
  // stres maksimum 15 sedangkan depresi maksimum 27, jadi skor stres 15
  // (moderate) tidak boleh disamakan dengan depresi 15 (mild).
  const domain = ([
    ['depresi', 'Depresi', input.dassDepresi],
    ['ansietas', 'Ansietas', input.dassCemas],
    ['stres', 'Stres', input.dassStres],
  ] as [DassDomain, string, number | null][]).filter(([, , value]) => value !== null) as [DassDomain, string, number][];

  if (domain.length > 0) {
    const RANK: Record<DassCategory, number> = {
      'tidak-lengkap': -1, normal: 0, ringan: 1, sedang: 2, berat: 3, 'sangat-berat': 4,
    };
    const worst = domain.reduce((a, b) => (RANK[dassCategory(b[0], b[2])] > RANK[dassCategory(a[0], a[2])] ? b : a));
    parts.push(`DASS-21 ${worst[1]} ${worst[2]} (${dassBandLabel(worst[0], worst[2])})`);
  }

  // sdsScore di mcu_records adalah TOTAL 30 item (30–210), bukan skor indikator.
  // Kategori resmi SDS-30 hanya berlaku per indikator, jadi di sini total dicatat
  // apa adanya tanpa diberi label derajat stres yang menyesatkan.
  if (input.sdsScore !== null) {
    parts.push(`SDS-30 total ${input.sdsScore}/210 (pemetaan risiko psikologis kerja)`);
  }

  return parts.join(', ');
}

// ────────────────────────────────────────────────────────────
// Helper pembacaan jawaban
// ────────────────────────────────────────────────────────────

/**
 * Membaca nilai skala dari berbagai bentuk input: angka langsung,
 * string angka, atau string berlabel seperti "Sering (3)".
 */
function readScale(
  raw: string | number | null | undefined,
  min: number,
  max: number,
): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= min && raw <= max ? raw : null;
  const text = String(raw).trim();
  if (!text) return null;
  const match = text.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
}

function readYesNo(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') return raw === 1 ? 1 : raw === 0 ? 0 : null;
  const text = String(raw).trim().toLowerCase();
  if (!text) return null;
  if (text.startsWith('y') || text === '1' || text === 'true') return 1;
  if (text.startsWith('t') || text === '0' || text === 'false') return 0;
  return null;
}
