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
//   • SDS    — Zung Self-Rating Depression Scale, 20 item skala 1–4
//               Indeks ≤49 normal · 50–59 mild · 60–69 moderate · ≥70 severe
//
// Naskah item ada di questionnaire-items.ts. Modul ini hanya menghitung
// skor, jadi mengganti naskah item tidak mengubah hasil perhitungan.
//
// Kolom snapshot di mcu_records mengizinkan modul ini tetap murni
// (tanpa akses database), sehingga pipeline import Excel dan engine
// aplikasi memakai perhitungan yang persis sama.
// ============================================================

import { DASS21_SECTIONS, SDS_REVERSED_ITEMS } from '@/lib/questionnaire-items';

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

export type Srq20Category = 'normal' | 'perlu-tindak-lanjut' | 'tidak-lengkap';

export interface Srq20Result {
  score: number;
  category: Srq20Category;
  label: string;
  answered: number;
  total: number;
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

  if (answered === 0) {
    return { score: 0, category: 'tidak-lengkap', label: 'Belum diisi', answered, total: SRQ20_ITEM_COUNT };
  }
  if (answered < SRQ20_ITEM_COUNT) {
    return {
      score,
      category: 'tidak-lengkap',
      label: `Belum lengkap (${answered}/${SRQ20_ITEM_COUNT} item)`,
      answered,
      total: SRQ20_ITEM_COUNT,
    };
  }
  if (score >= SRQ20_THRESHOLD) {
    return {
      score,
      category: 'perlu-tindak-lanjut',
      label: `Possible Mental Disorder (score ${score} >= ${SRQ20_THRESHOLD}) — rujuk psikolog atau psikiater`,
      answered,
      total: SRQ20_ITEM_COUNT,
    };
  }
  return { score, category: 'normal', label: 'No Significant Psychological Distress', answered, total: SRQ20_ITEM_COUNT };
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
 * Rentang maksimum juga berbeda: depresi 27, ansietas 21, stres 15.
 */
const DASS_BANDS: Record<DassDomain, { max: number; category: DassCategory; label: string }[]> = {
  depresi: [
    { max: 9, category: 'normal', label: 'Normal' },
    { max: 13, category: 'ringan', label: 'Mild Depression' },
    { max: 21, category: 'sedang', label: 'Moderate Depression' },
    { max: 27, category: 'berat', label: 'Severe Depression' },
    { max: Infinity, category: 'sangat-berat', label: 'Extremely Severe Depression' },
  ],
  ansietas: [
    { max: 7, category: 'normal', label: 'Normal' },
    { max: 14, category: 'ringan', label: 'Mild Anxiety' },
    { max: 19, category: 'sedang', label: 'Moderate Anxiety' },
    { max: 27, category: 'berat', label: 'Severe Anxiety' },
    { max: Infinity, category: 'sangat-berat', label: 'Extremely Severe Anxiety' },
  ],
  stres: [
    { max: 11, category: 'normal', label: 'Normal' },
    { max: 19, category: 'ringan', label: 'Mild Stress' },
    { max: 25, category: 'sedang', label: 'Moderate Stress' },
    { max: 31, category: 'berat', label: 'Severe Stress' },
    { max: Infinity, category: 'sangat-berat', label: 'Extremely Severe Stress' },
  ],
};

export function dassBandLabel(domain: DassDomain, score: number): string {
  const bands = DASS_BANDS[domain];
  return bands.find((band) => score <= band.max)?.label ?? 'Normal';
}

export function dassCategory(domain: DassDomain, score: number): DassCategory {
  const bands = DASS_BANDS[domain];
  return bands.find((band) => score <= band.max)?.category ?? 'sangat-berat';
}

/**
 * Skor subskala yang dianggap "berat atau lebih" pada parameter zonasi.
 * Sesuai STD-006, depresi berat dengan risiko diri dan psikosis aktif
 * menurunkan zona, jadi ambangnya mengikuti kategori "berat".
 */
export function isDassActionable(domain: DassDomain, score: number): boolean {
  const category = dassCategory(domain, score);
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
// Zung Self-Rating Depression Scale (SDS)
// ────────────────────────────────────────────────────────────

export const SDS_ITEM_COUNT = 20;

export type SdsCategory = 'normal' | 'mild' | 'moderate' | 'severe' | 'tidak-lengkap';

export interface SdsResult {
  /** Indeks kasar 20–80. */
  rawIndex: number;
  category: SdsCategory;
  label: string;
  answered: number;
  total: number;
}

export function sdsBandLabel(rawIndex: number): string {
  if (rawIndex >= 70) return 'Severe Depression';
  if (rawIndex >= 60) return 'Moderate Depression';
  if (rawIndex >= 50) return 'Mild Depression';
  return 'Normal (No Depression)';
}

export function scoreSds(answers: Record<string, string | number | null | undefined>): SdsResult {
  let total = 0;
  let answered = 0;
  for (let i = 1; i <= SDS_ITEM_COUNT; i += 1) {
    const value = readScale(answers[`sds${i}`], 1, 4);
    if (value === null) continue;
    // Sepuluh item bernada positif dinilai terbalik (5 − jawaban). Tanpa ini
    // indeks salah arah: orang yang paling depresif bisa mendapat skor rendah.
    total += SDS_REVERSED_ITEMS.includes(i) ? 5 - value : value;
    answered += 1;
  }
  if (answered === 0) {
    return { rawIndex: 0, category: 'tidak-lengkap', label: 'Belum diisi', answered, total: SDS_ITEM_COUNT };
  }
  if (answered < SDS_ITEM_COUNT) {
    return {
      rawIndex: total,
      category: 'tidak-lengkap',
      label: `Belum lengkap (${answered}/${SDS_ITEM_COUNT} item)`,
      answered,
      total: SDS_ITEM_COUNT,
    };
  }
  const category: SdsCategory = total >= 70 ? 'severe' : total >= 60 ? 'moderate' : total >= 50 ? 'mild' : 'normal';
  return { rawIndex: total, category, label: sdsBandLabel(total), answered, total: SDS_ITEM_COUNT };
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

  if (input.sdsScore !== null) {
    parts.push(`SDS ${input.sdsScore} (${sdsBandLabel(input.sdsScore)})`);
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
