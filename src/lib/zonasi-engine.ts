// ============================================================
// Zonasi Assessment Engine — BG/QSHE/STD/006 Rev001
// ============================================================
//
// Menentukan zona risiko kesehatan kerja: Hijau, Kuning, atau Merah,
// memakai ambang batas pada Standar Parameter PTM Rev001 Bab 8.
//
// Prinsip dokumen:
//   • Jika ada lebih dari satu kondisi, zona mengikuti risiko tertinggi.
//   • Penentuan akhir mempertimbangkan jenis pekerjaan.
//   • Zonasi BUKAN diagnosis medis, melainkan klasifikasi risiko kerja.
//
// Dua perlakuan berbeda atas data kosong, sesuai instruksi QSHE:
//
//   1. Parameteranamnesis dan kuesioner (riwayat epilepsi, jantung,
//      stroke, asma, sleep apnea, LBP, ESS, SRQ-20, DASS-21, SDS)
//      dikosongkan = TIDAK ADA = normal. Data ini tidak boleh
//      menggagalkan penilaian zona.
//
//   2. Parameter objektif (tekanan darah, IMT, gula darah, eGFR, LDL,
//      TG, asam urat, Hb, spirometri, visus, pendengaran, fungsi hati,
//      foto toraks) dikosongkan = zona "Belum Lengkap", karena Hijau
//      tidak bisa dibuktikan tanpa angka tersebut. Daftar parameter yang
//      kurang dikembalikan pada field parameterBelumDinilai supaya bisa
//      dilengkapi lewat form Review MCU.
//
// Semua angka ambang batas dan istilah berasal dari
// clinical-classification.ts. Modul ini tidak mendefinisikan ulang
// angka klinis apa pun.
// ============================================================

import {
  classifyBmi,
  classifyBloodPressure,
  classifyChestXr,
  classifyEgfr,
  classifyGlucose,
  classifyHemoglobin,
  classifyHearing,
  classifyLdl,
  classifyLiver,
  classifyLung,
  classifyTriglyceride,
  classifyUricAcid,
  classifyVision,
  detectGender,
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
import { dassBandLabel, dassCategory, isDassActionable, SRQ20_THRESHOLD, type DassDomain } from '@/lib/questionnaire-scores';

export interface ZonasiResult {
  zona: 'Hijau' | 'Kuning' | 'Merah' | 'Belum Lengkap';
  triggers: string[];
  pengendalian: string;
  /** Parameter objektif zonasi yang belum terisi. */
  parameterBelumDinilai: string[];
  /** Temuan di luar rentang tabel SOP yang perlu ditinjau. */
  catatanSOP: string[];
  /** Frekuensi evaluasi ulang sesuai poin 6.2.2 dokumen. */
  frekuensiEvaluasi: string;
}

export interface MCUDraft {
  [key: string]: string | number | undefined;
}

// ═══════════════════════════════════════════
// PARAMETER WAJIB
// ═══════════════════════════════════════════

/** Definisi parameter objektif yang tidak boleh kosong untuk bisa menilai zona. */
interface RequiredParameter {
  key: string;
  label: string;
  satisfied: (d: MCUDraft) => boolean;
}

function genderKnown(d: MCUDraft): boolean {
  return detectGender(d.jenisKelamin) !== 'unknown';
}

const REQUIRED_PARAMETERS: RequiredParameter[] = [
  { key: 'usia', label: 'Usia', satisfied: (d) => toNumber(d.usia) !== null },
  { key: 'jenisKelamin', label: 'Jenis Kelamin', satisfied: genderKnown },
  { key: 'tdS', label: 'Tekanan Darah Sistole', satisfied: (d) => toNumber(d.tdS) !== null },
  { key: 'tdD', label: 'Tekanan Darah Diastole', satisfied: (d) => toNumber(d.tdD) !== null },
  {
    key: 'bmi',
    label: 'IMT (perlu BB dan TB bila IMT kosong)',
    satisfied: (d) => toNumber(d.bmi) !== null || (toNumber(d.bb) !== null && toNumber(d.tb) !== null),
  },
  {
    key: 'gdp',
    label: 'GDP atau HbA1c',
    satisfied: (d) => toNumber(d.gdp) !== null || toNumber(d.hba1c) !== null,
  },
  {
    key: 'egfr',
    label: 'eGFR (atau kreatinin serum untuk dihitung CKD-EPI 2021)',
    satisfied: (d) => toNumber(d.egfr) !== null || calcEgfrCkdEpi2021(d.kreatinin, d.usia, d.jenisKelamin) !== null,
  },
  { key: 'ldl', label: 'LDL', satisfied: (d) => toNumber(d.ldl) !== null },
  { key: 'tg', label: 'Trigliserida (TG)', satisfied: (d) => toNumber(d.tg) !== null },
  { key: 'au', label: 'Asam Urat (AU)', satisfied: (d) => toNumber(d.au) !== null },
  { key: 'hb', label: 'Hemoglobin (Hb)', satisfied: (d) => toNumber(d.hb) !== null },
  {
    key: 'sp',
    label: 'Spirometri (FEV1 % atau interpretasi)',
    satisfied: (d) => toNumber(d.fev1Pct) !== null || String(d.spiInterp ?? '').trim() !== '',
  },
  { key: 'visus', label: 'Visus Jauh', satisfied: (d) => String(d.visusJauh ?? '').trim() !== '' },
  {
    key: 'pta',
    label: 'Audiometri (PTA atau interpretasi)',
    satisfied: (d) => toNumber(d.pta) !== null || String(d.audInterp ?? '').trim() !== '',
  },
  { key: 'sgot', label: 'SGOT', satisfied: (d) => toNumber(d.sgot) !== null },
  { key: 'sgpt', label: 'SGPT', satisfied: (d) => toNumber(d.sgpt) !== null },
  { key: 'hbsag', label: 'HBsAg', satisfied: (d) => String(d.hbsag ?? '').trim() !== '' },
  { key: 'chestXR', label: 'Chest X-Ray', satisfied: (d) => String(d.chestXR ?? '').trim() !== '' },
];

/**
 * Daftar parameter objektif zonasi yang belum terisi.
 * Item ini muncul di antarmuka form agar bisa dilengkapi tanpa perlu
 * menghitung ulang dari nol.
 */
export function getMissingZonasiInputs(d: MCUDraft): string[] {
  return REQUIRED_PARAMETERS
    .filter((parameter) => !parameter.satisfied(d))
    .map((parameter) => parameter.label);
}

// ═══════════════════════════════════════════
// ZONASI
// ═══════════════════════════════════════════

interface Finding {
  label: string;
  severity: 'merah' | 'kuning';
  detail?: string;
}

export function assessZonasi(d: MCUDraft, gender?: string): ZonasiResult {
  const missing = getMissingZonasiInputs(d);
  if (missing.length > 0) {
    return {
      zona: 'Belum Lengkap',
      triggers: [],
      pengendalian: 'Lengkapi parameter zonasi yang tercantum di bawah ini untuk menjalankan penilaian.',
      parameterBelumDinilai: missing,
      catatanSOP: [],
      frekuensiEvaluasi: '-',
    };
  }

  const genderKey = gender ?? d.jenisKelamin;
  const male = detectGender(genderKey) === 'male';
  const catatanSOP: string[] = [];
  const merah: Finding[] = [];
  const kuning: Finding[] = [];

  /**
   * Menempatkan hasil klasifikasi ke zona sesuai severity-nya.
   * severity 'tidak-dinilai' berarti nilai berada di luar rentang tabel
   * SOP, sehingga dilaporkan sebagai catatan, bukan dipaksa masuk zona.
   */
  const collect = (finding: Classification | null, label?: string) => {
    if (!finding) return;
    const name = label ?? finding.label;
    if (finding.severity === 'tidak-dinilai') {
      catatanSOP.push(`${finding.label}: ${finding.detail ?? ''}`.trim());
      return;
    }
    if (finding.severity === 'merah') {
      merah.push({ label: `${name} (Merah)`, severity: 'merah', detail: finding.detail });
      return;
    }
    if (finding.severity === 'kuning') {
      kuning.push({ label: `${name} (Kuning)`, severity: 'kuning', detail: finding.detail });
    }
  };

  // ── 1. Tekanan darah ──────────────────────────────────────
  // Hijau <140/90 · Kuning Grade I 140–159/90–99 · Merah Grade ≥2
  collect(classifyBloodPressure(toNumber(d.tdS), toNumber(d.tdD)));

  // ── 2. Glukosa darah ───────────────────────────────────────
  // Hijau HbA1c <7% & GDP <100 · Kuning Prediabetes 100–125 ·
  // Merah HbA1c ≥8% atau GDP ≥200
  collect(classifyGlucose(toNumber(d.gdp), toNumber(d.gd2pp), toNumber(d.hba1c)));

  // ── 3. Dislipidemia ────────────────────────────────────────
  // Hijau LDL <100 · Kuning 100–189 · Merah ≥190
  collect(classifyLdl(toNumber(d.ldl)));
  // Hijau TG <150 · Kuning 200–499 · Merah ≥500
  collect(classifyTriglyceride(toNumber(d.tg)));

  // ── 4. Fungsi ginjal ───────────────────────────────────────
  // Hijau ≥60 · Kuning G3a 45–59 · Merah <45
  const egfr = toNumber(d.egfr) ?? calcEgfrCkdEpi2021(d.kreatinin, d.usia, d.jenisKelamin);
  collect(classifyEgfr(egfr));

  // ── 5. Asam urat ───────────────────────────────────────────
  // Hijau <7 · Kuning 7–9 · Merah >9
  collect(classifyUricAcid(toNumber(d.au), detectGender(genderKey)));

  // ── 6. Indeks massa tubuh ──────────────────────────────────
  // Hijau <23 · Kuning 23–24,9 dan ≥25 · Merah ≥30 dengan komorbid,
  // serta ≥35 dengan keterbatasan fungsional
  const bmi = toNumber(d.bmi);
  const weight = classifyBmi(bmi);
  if (weight && weight.severity === 'merah') {
    collect(weight);
  } else if (weight && weight.severity === 'kuning') {
    if (bmi !== null && bmi >= 30) {
      // IMT ≥30: kuning hanya bila TIDAK ada komorbid signifikan.
      const comorbid = hasComorbidity(d, genderKey);
      if (comorbid) {
        merah.push({
          label: 'Obesity with Significant Comorbidity (Merah)',
          severity: 'merah',
          detail: `${weight.detail}, disertai ${comorbid}`,
        });
      } else {
        kuning.push({ label: `${weight.label} tanpa komorbid metabolik (Kuning)`, severity: 'kuning', detail: weight.detail });
      }
    } else {
      collect(weight);
    }
  }

  // ── 7. Hemoglobin ──────────────────────────────────────────
  // Kuning pria 11,0–13,4 / wanita 10,0–11,9 · Merah <10,0
  collect(classifyHemoglobin(toNumber(d.hb), detectGender(genderKey)));

  // ── 8. Fungsi paru ─────────────────────────────────────────
  // Hijau FEV1/FVC ≥70% & FVC ≥80% · Kuning FEV1 50–79% · Merah <50%
  collect(classifyLung(toNumber(d.fev1Pct), toNumber(d.fev1FvcAct), toNumber(d.fvcPct), String(d.spiInterp ?? '')));

  // ── 9. Penglihatan ─────────────────────────────────────────
  // Hijau visus terkoreksi ≥6/9 · Kuning 6/9–6/18 · Merah <6/18
  collect(classifyVision(d.visusJauh));

  // ── 10. Pendengaran ────────────────────────────────────────
  // Hijau ≤25 dB · Kuning 26–40 dB · Merah 41–90 dB atau >90 dB
  collect(classifyHearing(toNumber(d.pta), String(d.audInterp ?? '')));

  // ── 11. Fungsi hati ────────────────────────────────────────
  // Hijau <1,5x batas atas normal & HBsAg negatif ·
  // Kuning 1,5–3x atau HBsAg+ fungsi hati normal · Merah >3x
  collect(classifyLiver(toNumber(d.sgot), toNumber(d.sgpt), isReactive(d.hbsag)));

  // ── 12. Pneumokoniosis ─────────────────────────────────────
  // Hijau foto normal · Kuning ILO 1/0–1/1 · Merah ≥2/1 atau PMF
  collect(classifyChestXr(d.chestXR));

  // ═══════════════════════════════════════════
  // PARAMETER ANAMNESIS — kosong dianggap normal
  // ═══════════════════════════════════════════

  // ── 13. Epilepsi ────────────────────────────────────────────
  // Hijau bebas kejang ≥12 bulan · Kuning terkontrol · Merah tidak terkontrol
  if (hasUncontrolledEpilepsy(d.riwayatEpilepsi)) {
    merah.push({ label: 'Epilepsy, Uncontrolled (Merah)', severity: 'merah', detail: String(d.riwayatEpilepsi) });
  } else if (hasControlledEpilepsy(d.riwayatEpilepsi)) {
    kuning.push({ label: 'Epilepsy, Controlled (Kuning)', severity: 'kuning', detail: String(d.riwayatEpilepsi) });
  }

  // ── 14. Riwayat jantung / stroke ───────────────────────────
  if (hasResidualCardiacSymptom(d.riwayatJantung)) {
    merah.push({ label: 'Cardiovascular Disease with Residual Symptoms (Merah)', severity: 'merah' });
  }
  if (hasResidualStroke(d.riwayatStroke)) {
    merah.push({ label: 'Stroke with Residual Symptoms (Merah)', severity: 'merah' });
  }

  // ── 15. LBP ────────────────────────────────────────────────
  if (hasLbpWithNeurologicalDeficit(d.lbp)) {
    merah.push({ label: 'Chronic Low Back Pain with Neurological Deficit (Merah)', severity: 'merah', detail: String(d.lbp) });
  } else if (hasChronicLbp(d.lbp)) {
    kuning.push({ label: 'Chronic Low Back Pain (Kuning)', severity: 'kuning', detail: String(d.lbp) });
  }

  // ═══════════════════════════════════════════
  // PARAMETER KUISIONER — kosong dianggap normal
  // ═══════════════════════════════════════════

  // ── 16. Kualitas tidur (ESS) ───────────────────────────────
  // Hijau <11 · Kuning 11–15 · Merah >15
  const ess = toNumber(d.essScore);
  if (ess !== null) {
    if (ess > 15) merah.push({ label: `Excessive Daytime Sleepiness (Severe, ESS ${ess}) (Merah)`, severity: 'merah' });
    else if (ess >= 11) kuning.push({ label: `Excessive Daytime Sleepiness (Mild to Moderate, ESS ${ess}) (Kuning)`, severity: 'kuning' });
  }

  // ── 17. Kesehatan mental ───────────────────────────────────
  // SRQ-20 ≥6 atau DASS-21 kategori ringan–sedang → Kuning
  // Psikosis aktif, depresi berat, atau tidak patuh terapi → Merah
  const srq = toNumber(d.srq20Score);
  if (srq !== null && srq >= SRQ20_THRESHOLD) {
    kuning.push({ label: `Possible Mental Disorder (SRQ-20 ${srq}) (Kuning)`, severity: 'kuning' });
  }
  // Ambang "berat" DASS-21 berbeda per subskala (depresi 22, ansietas 20,
  // stres 26), jadi penentuannya memakai kategori, bukan angka tetap.
  const dassDomains: [DassDomain, number | null][] = [
    ['depresi', toNumber(d.dassDepresi)],
    ['ansietas', toNumber(d.dassCemas)],
    ['stres', toNumber(d.dassStres)],
  ];
  const DASS_LABEL: Record<DassDomain, string> = {
    depresi: 'Depresi', ansietas: 'Ansietas', stres: 'Stres',
  };
  for (const [domain, value] of dassDomains) {
    if (value === null || !isDassActionable(domain, value)) continue;
    const verySevere = dassCategory(domain, value) === 'sangat-berat';
    const severity = verySevere ? 'merah' : 'kuning';
    (verySevere ? merah : kuning).push({
      label: `DASS-21 ${DASS_LABEL[domain]} ${value} — ${dassBandLabel(domain, value)} (${verySevere ? 'Merah' : 'Kuning'})`,
      severity,
    });
  }
  const sds = toNumber(d.sdsScore);
  if (sds !== null && sds >= 60) {
    const severe = sds >= 70;
    (severe ? merah : kuning).push({
      label: `Depressive Disorder (SDS ${sds}, ${severe ? 'Severe' : 'Moderate'}) (${severe ? 'Merah' : 'Kuning'})`,
      severity: severe ? 'merah' : 'kuning',
    });
  }

  // ═══════════════════════════════════════════
  // HASIL
  // ═══════════════════════════════════════════

  if (merah.length > 0) {
    return {
      zona: 'Merah',
      triggers: merah.map((f) => (f.detail ? `${f.label} — ${f.detail}` : f.label)),
      pengendalian: [
        '• Wajib kontrol dokter spesialis setiap 1 bulan sampai stabil',
        '• Wajib menyerahkan surat kontrol atau clearance',
        '• Evaluasi ulang status setiap 1 bulan',
        '• Dapat direkomendasikan penempatan sementara (Currently Unfit)',
        '• Tidak diperkenankan bekerja di area risiko tinggi (ketinggian, alat berat, confined space, shift malam intensif) sampai dinyatakan stabil',
      ].join('\n'),
      parameterBelumDinilai: [],
      catatanSOP,
      frekuensiEvaluasi: 'Setiap 1 bulan',
    };
  }

  if (kuning.length > 0) {
    // Poin 6.2.2: bila hanya Prediabetes, kontrol 6 bulan. Parameter lain
    // selalu 3 bulan, dan bila ada lebih dari satu, yang terpendek berlaku.
    const onlyPrediabetes = kuning.every((f) => /Prediabetes/i.test(f.label));
    const interval = onlyPrediabetes ? '6 bulan' : '3 bulan';
    return {
      zona: 'Kuning',
      triggers: kuning.map((f) => (f.detail ? `${f.label} — ${f.detail}` : f.label)),
      pengendalian: [
        `• Wajib kontrol dokter minimal setiap ${interval}`,
        '• Wajib menyerahkan bukti kontrol ke HO',
        '• Tidak direkomendasikan bekerja di area risiko tinggi bila kondisi belum stabil',
        `• Evaluasi ulang status zona setiap ${interval}`,
        '• Program perbaikan gaya hidup (berat badan, diet, olahraga)',
        '• Layak kerja dengan monitoring (Fit With Note)',
      ].join('\n'),
      parameterBelumDinilai: [],
      catatanSOP,
      frekuensiEvaluasi: `Setiap ${interval}`,
    };
  }

  return {
    zona: 'Hijau',
    triggers: [],
    pengendalian: [
      '• MCU rutin sesuai jadwal perusahaan (1 tahun sekali atau sesuai kebijakan)',
      '• Edukasi gaya hidup sehat',
      '• Layak kerja tanpa pembatasan khusus',
    ].join('\n'),
    parameterBelumDinilai: [],
    catatanSOP,
    frekuensiEvaluasi: 'Minimal 1 kali dalam 12 bulan',
  };
}

/** Komorbid signifikan untuk IMT ≥30: hipertensi, DM, atau gangguan napas. */
function hasComorbidity(d: MCUDraft, gender: string | number | undefined): string | null {
  const reasons: string[] = [];
  const tdS = toNumber(d.tdS);
  const tdD = toNumber(d.tdD);
  if ((tdS !== null && tdS >= 140) || (tdD !== null && tdD >= 90)) reasons.push('hipertensi');

  const glucose = classifyGlucose(toNumber(d.gdp), toNumber(d.gd2pp), toNumber(d.hba1c));
  if (glucose && (glucose.severity === 'merah' || glucose.severity === 'kuning')) reasons.push('diabetes');

  if (hasAsthma(d.riwayatAsma)) reasons.push('asma');
  if (hasSleepApnea(d.riwayatSleepApnea)) reasons.push('sleep apnea');

  // Gangguan napas juga bisa terbaca dari interpretasi spirometri.
  const spi = String(d.spiInterp ?? '').toLowerCase();
  if (/\bosa\b|\bohs\b|asma|asthma|dispnea|dispnoea/.test(spi)) reasons.push('gangguan napas');

  void gender;
  return reasons.length > 0 ? reasons.join(', ') : null;
}

// ═══════════════════════════════════════════
// FUNGSI PERHITUNGAN DASAR
// ═══════════════════════════════════════════

/**
 * eGFR dengan CKD-EPI 2021 (Inker et al., 2021), rumus yang dipakai
 * PNPK CKD Kemenkes RI. Hanya berlaku untuk usia 18 tahun ke atas.
 */
export function calcEgfrCkdEpi2021(
  creatinine: string | number | undefined,
  age: string | number | undefined,
  gender: string | number | undefined,
): number | null {
  const scr = toNumber(creatinine);
  const years = toNumber(age);
  if (scr === null || scr <= 0 || years === null || years < 18 || years > 120) return null;

  const detected = detectGender(gender);
  if (detected === 'unknown') return null;

  const isFemale = detected === 'female';
  const kappa = isFemale ? 0.7 : 0.9;
  const alpha = isFemale ? -0.241 : -0.302;
  const ratio = scr / kappa;
  const egfr = 142
    * Math.pow(Math.min(ratio, 1), alpha)
    * Math.pow(Math.max(ratio, 1), -1.2)
    * Math.pow(0.9938, years)
    * (isFemale ? 1.012 : 1);

  return Number.isFinite(egfr) ? Number(egfr.toFixed(1)) : null;
}

export function calcBMI(bb: number | null, tb: number | null): number | null {
  if (!bb || !tb) return null;
  const h = tb / 100;
  if (h <= 0) return null;
  return parseFloat((bb / (h * h)).toFixed(1));
}

export function calcMCHC(hb: number | null, hct: number | null): number | null {
  if (!hb || !hct || hct <= 0) return null;
  return parseFloat(((hb / hct) * 100).toFixed(1));
}

export function calcPct(act: number | null, pred: number | null): number | null {
  if (act === null || !pred || pred <= 0) return null;
  return parseFloat(((act / pred) * 100).toFixed(1));
}

/**
 * Pure Tone Average: rata-rata ambang dengar pada 500, 1000, 2000, dan
 * 4000 Hz. Nilai yang dipakai untuk klasifikasi NIHL pada SOP. Bila
 * hanya satu frekuensi yang terisi, rata-rata dihitung dari frekuensi
 * yang tersedia (minimal satu nilai).
 */
export function calcPTA(frequencies: (number | null)[]): number | null {
  const available = frequencies.filter((value): value is number => value !== null && Number.isFinite(value));
  if (available.length === 0) return null;
  const average = available.reduce((sum, value) => sum + value, 0) / available.length;
  return Number(average.toFixed(1));
}

export function calcDiabetes(gdp: number | null, gdpSeSATA: number | null, hba1c: number | null): string {
  if ((gdp !== null && gdp >= 126) || (gdpSeSATA !== null && gdpSeSATA >= 200) || (hba1c !== null && hba1c >= 6.5)) {
    return 'Ya';
  }
  return 'Tidak';
}

export function calcPerluFU(kesVendor: string | undefined, hasAbnormal: boolean): string {
  if (!kesVendor || kesVendor === 'Fit To Work') return 'Tidak';
  return hasAbnormal ? 'Ya' : 'Tidak';
}

// ═══════════════════════════════════════════
// FRAMINGHAM RISK SCORE
// ═══════════════════════════════════════════

export function calcFramingham(d: MCUDraft): { score: number; prob: string; kat: string } {
  const age = toNumber(d.usia);
  const chol = toNumber(d.chol);
  const hdl = toNumber(d.hdl);
  const sbp = toNumber(d.tdS);
  const smoking = d.merokok === 'Ya';
  const dm = d.diabetes === 'Ya';
  const isMale = detectGender(d.jenisKelamin) === 'male';

  if (!age || !chol || hdl === null || !sbp || !d.jenisKelamin) {
    return { score: 0, prob: 'Cek Parameter', kat: 'Cek Parameter' };
  }

  let score = 0;

  if (isMale) {
    if (age <= 34) score -= 9;
    else if (age <= 39) score -= 4;
    else if (age <= 44) score += 0;
    else if (age <= 49) score += 3;
    else if (age <= 54) score += 6;
    else if (age <= 59) score += 8;
    else if (age <= 64) score += 10;
    else if (age <= 69) score += 11;
    else if (age <= 74) score += 12;
    else score += 13;

    if (age <= 39) {
      if (chol < 160) score += 0; else if (chol < 200) score += 4; else if (chol < 240) score += 7; else if (chol < 280) score += 9; else score += 11;
    } else if (age <= 49) {
      if (chol < 160) score += 0; else if (chol < 200) score += 3; else if (chol < 240) score += 5; else if (chol < 280) score += 6; else score += 8;
    } else if (age <= 59) {
      if (chol < 160) score += 0; else if (chol < 200) score += 2; else if (chol < 240) score += 3; else if (chol < 280) score += 4; else score += 5;
    } else if (age <= 69) {
      if (chol < 160) score += 0; else if (chol < 200) score += 1; else if (chol < 240) score += 1; else if (chol < 280) score += 2; else score += 3;
    } else {
      if (chol < 160) score += 0; else if (chol < 200) score += 0; else if (chol < 240) score += 0; else if (chol < 280) score += 1; else score += 1;
    }
  } else {
    if (age <= 34) score -= 7;
    else if (age <= 39) score -= 3;
    else if (age <= 44) score += 0;
    else if (age <= 49) score += 3;
    else if (age <= 54) score += 6;
    else if (age <= 59) score += 8;
    else if (age <= 64) score += 10;
    else if (age <= 69) score += 12;
    else if (age <= 74) score += 14;
    else score += 16;

    if (age <= 39) {
      if (chol < 160) score += 0; else if (chol < 200) score += 4; else if (chol < 240) score += 8; else if (chol < 280) score += 11; else score += 13;
    } else if (age <= 49) {
      if (chol < 160) score += 0; else if (chol < 200) score += 3; else if (chol < 240) score += 6; else if (chol < 280) score += 8; else score += 10;
    } else if (age <= 59) {
      if (chol < 160) score += 0; else if (chol < 200) score += 2; else if (chol < 240) score += 4; else if (chol < 280) score += 5; else score += 7;
    } else if (age <= 69) {
      if (chol < 160) score += 0; else if (chol < 200) score += 1; else if (chol < 240) score += 2; else if (chol < 280) score += 3; else score += 4;
    } else {
      if (chol < 160) score += 0; else if (chol < 200) score += 1; else if (chol < 240) score += 1; else if (chol < 280) score += 2; else score += 2;
    }
  }

  if (hdl >= 60) score -= 1;
  else if (hdl >= 50) score += 0;
  else if (hdl >= 40) score += 1;
  else score += 2;

  if (isMale) {
    if (sbp < 120) score += 0; else if (sbp < 130) score += 0; else if (sbp < 140) score += 1; else if (sbp < 160) score += 1; else score += 2;
  } else {
    if (sbp < 120) score += 0; else if (sbp < 130) score += 1; else if (sbp < 140) score += 2; else if (sbp < 160) score += 3; else score += 4;
  }

  if (smoking) {
    if (isMale) {
      if (age <= 39) score += 8; else if (age <= 49) score += 5; else if (age <= 59) score += 3; else if (age <= 69) score += 1; else score += 1;
    } else {
      if (age <= 39) score += 9; else if (age <= 49) score += 7; else if (age <= 59) score += 4; else if (age <= 69) score += 2; else score += 1;
    }
  }

  if (dm) score += isMale ? 3 : 5;

  let prob = '';
  let kat = '';

  if (isMale) {
    if (score < 0) prob = '<1%';
    else if (score >= 17) prob = '≥30%';
    else {
      const table: [number, string][] = [[0, '1%'], [5, '2%'], [7, '3%'], [8, '4%'], [9, '5%'], [10, '6%'], [11, '8%'], [12, '10%'], [13, '12%'], [14, '16%'], [15, '20%'], [16, '25%']];
      for (let i = table.length - 1; i >= 0; i--) {
        if (score >= table[i][0]) { prob = table[i][1]; break; }
      }
    }
  } else {
    if (score < 9) prob = '<1%';
    else if (score >= 25) prob = '≥30%';
    else {
      const table: [number, string][] = [[9, '1%'], [13, '2%'], [15, '3%'], [16, '4%'], [17, '5%'], [18, '6%'], [19, '8%'], [20, '11%'], [21, '14%'], [22, '17%'], [23, '22%'], [24, '27%']];
      for (let i = table.length - 1; i >= 0; i--) {
        if (score >= table[i][0]) { prob = table[i][1]; break; }
      }
    }
  }

  const probNum = parseFloat(prob.replace(/[<>≥%]/g, ''));
  if (probNum >= 20 || prob.includes('≥30')) kat = 'High Risk';
  else if (probNum >= 10 || prob.includes('20') || prob.includes('25')) kat = 'Intermediate Risk';
  else kat = 'Low Risk';

  return { score, prob: prob ? prob + '%' : '', kat };
}
