// ============================================================
// Diagnosa Medis Otomatis — BG/QSHE/STD/006 Rev001
// ============================================================
//
// Mengubah hasil pemeriksaan MCU menjadi daftar diagnosis RESMI dalam
// bahasa Inggris, diklasifikasi otomatis mengikuti ambang batas pada
// Standar Parameter PTM Rev001.
//
// Tidak ada kode ICD-10. Kolom diagnosa_medis hanya berisi istilah
// diagnosis, agar bisa langsung dipakai pada laporan dan form
// rekomendasi tanpa perlu kamus kode terpisah.
//
// Semua angka ambang batas dan istilah berasal dari
// clinical-classification.ts. Modul ini hanya menyusun urutannya.
// ============================================================

import {
  DRUG_TEST_DIAGNOSIS,
  REACTIVE_DIAGNOSIS,
  classifyAlp,
  classifyBmi,
  classifyBloodPressure,
  classifyChestXr,
  classifyEgfr,
  classifyEritrosit,
  classifyGgt,
  classifyGlucose,
  classifyHematokrit,
  classifyHemoglobin,
  classifyHdl,
  classifyHearing,
  classifyLdl,
  classifyLeukosit,
  classifyLiver,
  classifyLung,
  classifyPsa,
  classifyTrombosit,
  classifyTriglyceride,
  classifyTotalCholesterol,
  classifyUreum,
  classifyUricAcid,
  classifyVision,
  detectGender,
  fmt,
  hasAnyCardiacHistory,
  hasAnyStroke,
  hasAsthma,
  hasChronicLbp,
  hasControlledEpilepsy,
  hasLbpWithNeurologicalDeficit,
  hasResidualCardiacSymptom,
  hasResidualStroke,
  hasSleepApnea,
  hasUncontrolledEpilepsy,
  isReactive,
  parseVisualAcuity,
  toNumber,
  type Classification,
} from '@/lib/clinical-classification';
import { classifyEcg, classifyTreadmill, DRUG_TEST_LABEL } from '@/lib/clinical-classification';
import { dassBandLabel, dassCategory, essBandLabel, sdsBandLabel, type DassDomain } from '@/lib/questionnaire-scores';

export type MCURaw = Record<string, string | number | null | undefined>;

export interface DiagnosisEntry {
  /** Istilah diagnosis bahasa Inggris, mis. "Hypertension Grade I". */
  diagnosis: string;
  /** Nilai yang mendasari, mis. "150/95 mmHg". */
  evidence?: string;
  /** Tingkat menurut tabel SOP. */
  severity: Classification['severity'] | 'normal';
  /** SistemFAR / kelompok alat yang menghasilkan temuan. */
  system: string;
}

function txt(value: string | number | null | undefined): string {
  return value == null ? '' : String(value).trim();
}

/** Nilai yang dianggap "dalam batas normal" pada hasil tertulis. */
function isNormalText(value: string | number | null | undefined): boolean {
  const current = txt(value);
  if (!current) return true;
  if (/normal\s*variation|normal\s*variant|variant\s*normal/.test(current)) return true;
  return /^(n\/a|-|tidak ada|tidak dilakukan|dbn|normal|negatif|non\s*-?\s*reaktif|within normal limit)$/i.test(current);
}

/** Pemeriksaan fisik bertulis bebas yang tidak boleh dipaksa jadi diagnosis. */
function isAbnormalFreeText(value: string | number | null | undefined): boolean {
  return !isNormalText(value);
}

// ────────────────────────────────────────────────────────────
// Bagian-bagian diagnosis
// ────────────────────────────────────────────────────────────

function buildAnamneseEntries(values: MCURaw): DiagnosisEntry[] {
  const entries: DiagnosisEntry[] = [];

  if (hasUncontrolledEpilepsy(values.riwayatEpilepsi)) {
    entries.push({ diagnosis: 'Epilepsy, Uncontrolled', severity: 'merah', system: 'Neurologi' });
  } else if (hasControlledEpilepsy(values.riwayatEpilepsi)) {
    entries.push({ diagnosis: 'Epilepsy, Controlled', severity: 'kuning', system: 'Neurologi' });
  }

  if (hasResidualCardiacSymptom(values.riwayatJantung)) {
    entries.push({ diagnosis: 'Cardiovascular Disease with Residual Symptoms', severity: 'merah', system: 'Kardiovaskular' });
  } else if (hasAnyCardiacHistory(values.riwayatJantung)) {
    entries.push({ diagnosis: 'Cardiovascular Disease History', evidence: txt(values.riwayatJantung), severity: 'kuning', system: 'Kardiovaskular' });
  }

  if (hasResidualStroke(values.riwayatStroke)) {
    entries.push({ diagnosis: 'Stroke with Residual Symptoms', severity: 'merah', system: 'Neurologi' });
  } else if (hasAnyStroke(values.riwayatStroke)) {
    entries.push({ diagnosis: 'Stroke History', evidence: txt(values.riwayatStroke), severity: 'kuning', system: 'Neurologi' });
  }

  if (hasAsthma(values.riwayatAsma)) {
    entries.push({ diagnosis: 'Asthma', evidence: txt(values.riwayatAsma), severity: 'kuning', system: 'Pernapasan' });
  }
  if (hasSleepApnea(values.riwayatSleepApnea)) {
    entries.push({ diagnosis: 'Obstructive Sleep Apnea', evidence: txt(values.riwayatSleepApnea), severity: 'kuning', system: 'Pernapasan' });
  }

  if (hasLbpWithNeurologicalDeficit(values.lbp)) {
    entries.push({ diagnosis: 'Chronic Low Back Pain with Neurological Deficit', severity: 'merah', system: 'Muskuloskeletal' });
  } else if (hasChronicLbp(values.lbp)) {
    entries.push({ diagnosis: 'Chronic Low Back Pain', evidence: txt(values.lbp), severity: 'kuning', system: 'Muskuloskeletal' });
  }

  return entries;
}

function buildPhysicalEntries(values: MCURaw): DiagnosisEntry[] {
  const entries: DiagnosisEntry[] = [];
  const add = (classification: Classification | null, system: string) => {
    if (!classification || classification.severity === 'hijau') return;
    entries.push({
      diagnosis: classification.label,
      evidence: classification.detail,
      severity: classification.severity === 'tidak-dinilai' ? 'normal' : classification.severity,
      system,
    });
  };

  add(classifyBloodPressure(toNumber(values.tdS), toNumber(values.tdD)), 'Kardiovaskular');
  add(classifyBmi(toNumber(values.bmi)), 'Gizi');

  const hb = classifyHemoglobin(toNumber(values.hb), detectGender(values.jenisKelamin));
  if (hb && hb.severity === 'tidak-dinilai') {
    entries.push({ diagnosis: hb.label, evidence: hb.detail, severity: 'normal', system: 'Hematologi' });
  } else {
    add(hb, 'Hematologi');
  }

  add(classifyLeukosit(toNumber(values.leukosit)), 'Hematologi');
  add(classifyEritrosit(toNumber(values.eritrosit), detectGender(values.jenisKelamin)), 'Hematologi');
  add(classifyHematokrit(toNumber(values.hematokrit), detectGender(values.jenisKelamin)), 'Hematologi');
  add(classifyTrombosit(toNumber(values.trombosit)), 'Hematologi');

  if (isAbnormalFreeText(values.gigiMulut)) {
    entries.push({ diagnosis: 'Orodental Finding', evidence: txt(values.gigiMulut), severity: 'normal', system: 'Gigi & Mulut' });
  }
  if (isAbnormalFreeText(values.fisikHeadToToe)) {
    entries.push({ diagnosis: 'Physical Examination Finding', evidence: txt(values.fisikHeadToToe), severity: 'normal', system: 'Fisik' });
  }
  if (isAbnormalFreeText(values.fisikMata)) {
    entries.push({ diagnosis: 'Ophthalmic Examination Finding', evidence: txt(values.fisikMata), severity: 'normal', system: 'Mata' });
  }
  if (txt(values.defWarna) && !/^(normal|n\/a)$/i.test(txt(values.defWarna))) {
    entries.push({ diagnosis: 'Colour Vision Deficiency', evidence: txt(values.defWarna), severity: 'normal', system: 'Mata' });
  }
  if (isAbnormalFreeText(values.lapangPandang)) {
    entries.push({ diagnosis: 'Visual Field Defect', evidence: txt(values.lapangPandang), severity: 'normal', system: 'Mata' });
  }

  const near = parseVisualAcuity(values.visusDekat);
  if (near.category === 'berat') {
    entries.push({ diagnosis: 'Near Visual Impairment', evidence: near.raw, severity: 'kuning', system: 'Mata' });
  } else if (near.category === 'ringan') {
    entries.push({ diagnosis: 'Near Visual Impairment', evidence: near.raw, severity: 'normal', system: 'Mata' });
  }

  return entries;
}

function buildLaboratoryEntries(values: MCURaw): DiagnosisEntry[] {
  const entries: DiagnosisEntry[] = [];
  const gender = detectGender(values.jenisKelamin);
  const add = (classification: Classification | null, system: string) => {
    if (!classification || classification.severity === 'hijau') return;
    entries.push({
      diagnosis: classification.label,
      evidence: classification.detail,
      severity: classification.severity === 'tidak-dinilai' ? 'normal' : classification.severity,
      system,
    });
  };

  add(classifyGlucose(toNumber(values.gdp), toNumber(values.gd2pp), toNumber(values.hba1c)), 'Metabolik');
  add(classifyTotalCholesterol(toNumber(values.chol)), 'Metabolik');
  add(classifyLdl(toNumber(values.ldl)), 'Metabolik');
  add(classifyTriglyceride(toNumber(values.tg)), 'Metabolik');
  add(classifyHdl(toNumber(values.hdl), gender), 'Metabolik');
  add(classifyUricAcid(toNumber(values.au), gender), 'Metabolik');
  add(classifyUreum(toNumber(values.ureum)), 'Ginjal');
  add(classifyEgfr(toNumber(values.egfr)), 'Ginjal');
  add(classifyLiver(toNumber(values.sgot), toNumber(values.sgpt), isReactive(values.hbsag)), 'Hati');
  add(classifyGgt(toNumber(values.ggt)), 'Hati');
  add(classifyAlp(toNumber(values.alp)), 'Hati');
  add(classifyPsa(toNumber(values.psa)), 'Urologi');

  for (const [field, label] of Object.entries(REACTIVE_DIAGNOSIS)) {
    if (isReactive(values[field])) {
      entries.push({ diagnosis: label, evidence: `${label.split(' ')[0]}: ${txt(values[field])}`, severity: 'normal', system: 'Serologi' });
    }
  }

  if (isAbnormalFreeText(values.ul)) {
    entries.push({ diagnosis: 'Urine Routine (Urinalysis) Abnormal', evidence: txt(values.ul), severity: 'normal', system: 'Urine Routine' });
  }

  for (const [field, label] of Object.entries(DRUG_TEST_DIAGNOSIS)) {
    if (isReactive(values[field]) || /positif/i.test(txt(values[field]))) {
      entries.push({ diagnosis: label, evidence: `${DRUG_TEST_LABEL[field] ?? field}: ${txt(values[field])}`, severity: 'merah', system: 'NAPZA' });
    }
  }

  return entries;
}

function buildImagingEntries(values: MCURaw): DiagnosisEntry[] {
  const entries: DiagnosisEntry[] = [];

  const chest = classifyChestXr(values.chestXR);
  if (chest && chest.severity !== 'hijau') {
    entries.push({ diagnosis: chest.label, evidence: chest.detail, severity: chest.severity, system: 'Radiologi' });
  } else if (chest && isAbnormalFreeText(values.chestXR)) {
    entries.push({ diagnosis: 'Chest X-Ray Abnormal (Non-Specific Finding)', evidence: txt(values.chestXR), severity: 'normal', system: 'Radiologi' });
  }

  if (isAbnormalFreeText(values.lumboXR)) {
    entries.push({ diagnosis: 'Lumbosacral X-Ray Abnormal', evidence: txt(values.lumboXR), severity: 'normal', system: 'Radiologi' });
  }
  // EKG dan TMT bertulis bebas. Klasifikasi pakai kamus temuan, bukan
  // sekadar "teksnya tidak kosong", supaya varian normal dan
  // "Negative Ischemic Response" tidak muncul sebagai diagnosis.
  const ekg = classifyEcg(values.ecgHasil);
  if (ekg) {
    entries.push({
      diagnosis: ekg.label,
      evidence: txt(values.ecgHasil),
      severity: ekg.severity,
      system: 'Kardiovaskular',
    });
  }
  const treadmill = classifyTreadmill(values.tmHasil);
  if (treadmill) {
    entries.push({
      diagnosis: treadmill.label,
      evidence: txt(values.tmHasil),
      severity: treadmill.severity,
      system: 'Kardiovaskular',
    });
  }
  if (isAbnormalFreeText(values.usg)) {
    entries.push({ diagnosis: 'Ultrasonography Abnormal', evidence: txt(values.usg), severity: 'normal', system: 'Radiologi' });
  }

  const lung = classifyLung(toNumber(values.fev1Pct), toNumber(values.fev1FvcAct), toNumber(values.fvcPct), txt(values.spiInterp));
  if (lung && lung.severity !== 'hijau') {
    entries.push({ diagnosis: lung.label, evidence: lung.detail, severity: lung.severity, system: 'Pernapasan' });
  }

  const hearing = classifyHearing(toNumber(values.pta), txt(values.audInterp));
  if (hearing && hearing.severity !== 'hijau') {
    entries.push({ diagnosis: hearing.label, evidence: hearing.detail, severity: hearing.severity, system: 'Pendengaran' });
  }

  const vision = classifyVision(values.visusJauh);
  if (vision && vision.severity !== 'hijau' && vision.label !== 'Visual Acuity Not Interpretable') {
    entries.push({ diagnosis: vision.label, evidence: vision.detail, severity: vision.severity, system: 'Mata' });
  }

  return entries;
}

function buildQuestionnaireEntries(values: MCURaw): DiagnosisEntry[] {
  const entries: DiagnosisEntry[] = [];

  const ess = toNumber(values.essScore);
  if (ess !== null) {
    if (ess > 15) {
      entries.push({ diagnosis: 'Excessive Daytime Sleepiness (Severe)', evidence: `ESS ${ess}`, severity: 'merah', system: 'Kualitas Tidur' });
    } else if (ess >= 11) {
      entries.push({ diagnosis: 'Excessive Daytime Sleepiness (Mild to Moderate)', evidence: `ESS ${ess}`, severity: 'kuning', system: 'Kualitas Tidur' });
    }
  }

  const srq = toNumber(values.srq20Score);
  if (srq !== null && srq >= 6) {
    entries.push({ diagnosis: 'Possible Mental Disorder', evidence: `SRQ-20 ${srq} (>= 6)`, severity: 'kuning', system: 'Kesehatan Mental' });
  }

  // Ambang DASS-21 mengikuti kategori "berat" tiap subskala, bukan angka
  // yang sama untuk ketiganya. Depresi berat mulai 22, ansietas 20, stres 26.
  const dassPairs: [DassDomain, number | null][] = [
    ['depresi', toNumber(values.dassDepresi)],
    ['ansietas', toNumber(values.dassCemas)],
    ['stres', toNumber(values.dassStres)],
  ];
  const DASS_DIAGNOSIS: Record<DassDomain, string> = {
    depresi: 'Depressive Disorder (DASS-21)',
    ansietas: 'Anxiety Disorder (DASS-21)',
    stres: 'Stress Disorder (DASS-21)',
  };
  const DASS_DOMAIN_LABEL: Record<DassDomain, string> = {
    depresi: 'Depression', ansietas: 'Anxiety', stres: 'Stress',
  };
  for (const [domain, value] of dassPairs) {
    if (value === null) continue;
    const category = dassCategory(domain, value);
    if (category !== 'berat' && category !== 'sangat-berat') continue;
    entries.push({
      diagnosis: DASS_DIAGNOSIS[domain],
      evidence: `DASS-21 ${DASS_DOMAIN_LABEL[domain]} ${value} (${dassBandLabel(domain, value)})`,
      severity: category === 'sangat-berat' ? 'merah' : 'kuning',
      system: 'Kesehatan Mental',
    });
  }

  const sds = toNumber(values.sdsScore);
  if (sds !== null && sds >= 50) {
    entries.push({
      diagnosis: 'Depressive Disorder (Zung SDS)',
      evidence: `SDS ${sds} (${sdsBandLabel(sds)})`,
      severity: sds >= 70 ? 'merah' : 'kuning',
      system: 'Kesehatan Mental',
    });
  }

  return entries;
}

// ────────────────────────────────────────────────────────────
// Penyusun utama
// ────────────────────────────────────────────────────────────

/** Urutan penyusunan diagnosis agar hasil stabil dan mudah dibandingkan. */
const SYSTEM_ORDER = [
  'Kardiovaskular',
  'Metabolik',
  'Gizi',
  'Hematologi',
  'Ginjal',
  'Hati',
  'Pernapasan',
  'Pendengaran',
  'Mata',
  'Neurologi',
  'Muskuloskeletal',
  'Kualitas Tidur',
  'Kesehatan Mental',
  'Serologi',
  'NAPZA',
  'Urologi',
  'Urine Routine',
  'Radiologi',
  'Fisik',
  'Gigi & Mulut',
];

const SEVERITY_RANK: Record<string, number> = { merah: 0, kuning: 1, normal: 2, hijau: 3, 'tidak-dinilai': 4 };

/**
 * Menghasilkan daftar diagnosis terurut. Diagnosis yang sama digabung,
 * dengan evidence digabung juga supaya tidak ada teks berulang.
 */
export function buildDiagnosisList(values: MCURaw): DiagnosisEntry[] {
  const raw: DiagnosisEntry[] = [
    ...buildAnamneseEntries(values),
    ...buildPhysicalEntries(values),
    ...buildLaboratoryEntries(values),
    ...buildImagingEntries(values),
    ...buildQuestionnaireEntries(values),
  ];

  const merged = new Map<string, DiagnosisEntry>();
  for (const entry of raw) {
    if (!entry.diagnosis) continue;
    const existing = merged.get(entry.diagnosis);
    if (!existing) {
      merged.set(entry.diagnosis, { ...entry });
      continue;
    }
    if (entry.evidence && !existing.evidence?.includes(entry.evidence)) {
      existing.evidence = existing.evidence ? `${existing.evidence}; ${entry.evidence}` : entry.evidence;
    }
    if (SEVERITY_RANK[entry.severity] < SEVERITY_RANK[existing.severity]) {
      existing.severity = entry.severity;
    }
  }

  const systemRank = new Map(SYSTEM_ORDER.map((name, index) => [name, index]));

  return [...merged.values()].sort((a, b) => {
    const bySystem = (systemRank.get(a.system) ?? 99) - (systemRank.get(b.system) ?? 99);
    if (bySystem !== 0) return bySystem;
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return a.diagnosis.localeCompare(b.diagnosis);
  });
}

/**
 * Teks siap simpan untuk kolom diagnosa_medis.
 * Contoh: "Hypertension Grade I (150/95 mmHg), Mild Anemia (Hb 11,2 g/dL)".
 */
export function formatDiagnosis(entries: DiagnosisEntry[]): string {
  return entries
    .map((entry) => (entry.evidence ? `${entry.diagnosis} (${entry.evidence})` : entry.diagnosis))
    .join(', ');
}

/** Ringkasan singkat untuk kolom ringkasan. */
export function diagnosisSummary(entries: DiagnosisEntry[]): string {
  if (entries.length === 0) return 'No Abnormal Finding';
  const counts = { merah: 0, kuning: 0, normal: 0 };
  for (const entry of entries) counts[entry.severity] = (counts[entry.severity] ?? 0) + 1;
  const parts: string[] = [];
  if (counts.merah) parts.push(`${counts.merah} merah`);
  if (counts.kuning) parts.push(`${counts.kuning} kuning`);
  if (counts.normal) parts.push(`${counts.normal} lain-lain`);
  return parts.join(', ');
}

export { essBandLabel, fmt };
