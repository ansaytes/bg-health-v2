// ============================================================
// Klasifikasi Klinis — BG/QSHE/STD/006 Rev001 (Penyakit Tidak Menular)
// ============================================================
//
// SATU-SATUNYA sumber angka ambang batas untuk:
//   • diagnosa_medis   (istilah diagnosis bahasa Inggris)
//   • zonasi           (Hijau / Kuning / Merah)
//
// Semua ambang batas diambil LITERAL dari tabel Bab 8 dokumen
// STD-006 Rev001. Angka dari standar nasional Indonesia (Permenkes,
// Pedoman Kemenkes RI, PERKENI, PAPDI, PDPI) dipakai untuk KETERANGAN
// di dalam teks diagnosis, bukan untuk mengubah batas zona.
//
// CATATAN PENTING — Celah pada tabel SOP (dilaporkan, tidak diubah):
//   1. Anemia pria Hb 10,0–10,9 g/dL tidak tercakup tabel mana pun
//      (Kuning mulai 11,0; Merah mulai <10,0). Dilaporkan sebagai
//      peringatan, tidak dipaksa masuk zona.
//   2. Trigliserida 150–199 mg/dL: Hijau <150, Kuning 200–499.
//      Rentang 150–199 tidak tercakup.
//   3. Visus terkoreksi tepat 6/9 tercakup Hijau ("≥6/9") sekaligus
//      Kuning ("6/9–6/18"). Diambil: 6/9 → Hijau.
//   4. IMT <18,5 (underweight) tidak ada di tabel SOP.
//
// Ambang batas di bawah TIDAK diubah oleh kode. Perbaikan harus lewat
// revisi dokumen SOP, bukan lewat perubahan program.
// ============================================================

export type Gender = 'male' | 'female' | 'unknown';

export type Severity = 'hijau' | 'kuning' | 'merah' | 'normal' | 'tidak-dinilai';

export interface Classification {
  /** Tingkat menurut tabel SOP, untuk menentukan zona. */
  severity: Severity;
  /** Istilah diagnosis dalam bahasa Inggris, siap tampil. */
  label: string;
  /** Detail pendukung, mis. "Hb 11,2 g/dL". */
  detail?: string;
}

// ────────────────────────────────────────────────────────────
// Helper
// ────────────────────────────────────────────────────────────

export function detectGender(value: string | number | null | undefined): Gender {
  const v = String(value ?? '').toLowerCase();
  if (v.includes('laki') || v.includes('male') || v === 'l' || v === 'p1') return 'male';
  if (v.includes('perem') || v.includes('female') || v === 'p') return 'female';
  return 'unknown';
}

export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).trim();
  if (!s || /^(n\/a|na|null|-|--|tidak ada)$/i.test(s)) return null;
  // "1,5" (Indonesia) dan "1.5" (ekspor) harus sama-sama diterima.
  const parsed = Number(s.replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function isBlank(value: string | number | null | undefined): boolean {
  return toNumber(value) === null && String(value ?? '').trim() === '';
}

/** Format angka gaya Indonesia: 1 decimal, koma sebagai pemisah desimal. */
export function fmt(value: number, decimals = 1): string {
  return value.toFixed(decimals).replace('.', ',');
}

// ────────────────────────────────────────────────────────────
// 1. Tekanan Darah
//    SOP Hijau <140/90 · Kuning 140–159/90–99 · Merah ≥160/≥100
//    Penamaan memakai "Grade" sesuai dokumen SOP (bukan "Stage").
// ────────────────────────────────────────────────────────────

export const BP_RULES = {
  normalMax: { systolic: 140, diastolic: 90 },
  grade1: { systolic: [140, 159], diastolic: [90, 99] },
  grade2: { systolic: [160, 179], diastolic: [100, 109] },
  grade3: { systolic: 180, diastolic: 110 },
} as const;

export function classifyBloodPressure(
  systolic: number | null,
  diastolic: number | null,
): Classification | null {
  if (systolic === null || diastolic === null) return null;
  const value = `${systolic}/${diastolic} mmHg`;

  if (systolic >= 180 || diastolic >= 110) {
    return { severity: 'merah', label: 'Hypertension Grade III', detail: value };
  }
  if (systolic >= 160 || diastolic >= 100) {
    return { severity: 'merah', label: 'Hypertension Grade II', detail: value };
  }
  if (systolic >= 140 || diastolic >= 90) {
    return { severity: 'kuning', label: 'Hypertension Grade I', detail: value };
  }
  if (systolic >= 130 || diastolic >= 80) {
    // Di bawah ambang SOP Hijau, jadi tidak memicu zona. Tetap didiagnosis.
    return { severity: 'normal', label: 'Elevated Blood Pressure', detail: value };
  }
  return { severity: 'normal', label: 'Blood Pressure Within Normal Limit', detail: value };
}

// ────────────────────────────────────────────────────────────
// 2. Indeks Massa Tubuh
//    SOP Hijau <23 · Kuning 23–24,9 · Kuning ≥25 · Merah ≥30 + komorbid
// ────────────────────────────────────────────────────────────

export function classifyBmi(bmi: number | null): Classification | null {
  if (bmi === null) return null;
  if (bmi >= 35) return { severity: 'merah', label: 'Morbid Obesity (Class III)', detail: `BMI ${fmt(bmi)} kg/m²` };
  if (bmi >= 30) return { severity: 'kuning', label: 'Obesity (Class II)', detail: `BMI ${fmt(bmi)} kg/m²` };
  if (bmi >= 25) return { severity: 'kuning', label: 'Obesity (Class I)', detail: `BMI ${fmt(bmi)} kg/m²` };
  if (bmi >= 23) return { severity: 'kuning', label: 'Overweight', detail: `BMI ${fmt(bmi)} kg/m²` };
  if (bmi >= 18.5) return { severity: 'hijau', label: 'Normal Weight', detail: `BMI ${fmt(bmi)} kg/m²` };
  return { severity: 'normal', label: 'Underweight', detail: `BMI ${fmt(bmi)} kg/m²` };
}

// ────────────────────────────────────────────────────────────
// 3. Hemoglobin — sesuai SOP Rev001 (Bab 7)
//    Kuning: pria 11,0–13,4 · wanita 10,0–11,9
//    Merah  : Hb <10,0
// =============================================================
// Celah SOP: pria 10,0–10,9 tidak masuk Hijau/Kuning/Merah.
// Dikembalikan severity 'tidak-dinilai' agar caller bisa memberi
// peringatan tanpa memaksa zona.
export function classifyHemoglobin(hb: number | null, gender: Gender): Classification | null {
  if (hb === null) return null;
  const value = `Hb ${fmt(hb)} g/dL`;

  if (hb < 10) {
    return { severity: 'merah', label: 'Severe Anemia', detail: value };
  }
  if (gender === 'male') {
    if (hb >= 11 && hb < 13.5) return { severity: 'kuning', label: 'Mild Anemia', detail: value };
    if (hb >= 13.5) return { severity: 'hijau', label: 'Hemoglobin Within Normal Limit', detail: value };
    return { severity: 'tidak-dinilai', label: 'Anemia Moderate', detail: `${value} — di luar rentang tabel SOP` };
  }
  if (gender === 'female') {
    if (hb >= 10 && hb < 12) return { severity: 'kuning', label: 'Mild Anemia', detail: value };
    if (hb >= 12) return { severity: 'hijau', label: 'Hemoglobin Within Normal Limit', detail: value };
    return { severity: 'hijau', label: 'Hemoglobin Within Normal Limit', detail: value };
  }
  // Jenis kelamin tidak diketahui → pakai batas paling longgar (wanita).
  if (hb >= 10 && hb < 12) return { severity: 'kuning', label: 'Mild Anemia', detail: `${value} (jenis kelamin tidak diketahui)` };
  return { severity: 'hijau', label: 'Hemoglobin Within Normal Limit', detail: value };
}

// ────────────────────────────────────────────────────────────
// 4. Gula Darah — PERKENI / Permenkes
//    SOP Hijau HbA1c <7% & GDP <100 · Kuning GDP 100–125 · Merah ≥8% / ≥200
// ============================================================

export function classifyGlucose(
  gdp: number | null,
  gdpSeSATA: number | null,
  hba1c: number | null,
): Classification | null {
  if (gdp === null && gdpSeSATA === null && hba1c === null) return null;
  const parts: string[] = [];

  if (hba1c !== null) {
    if (hba1c >= 8) return { severity: 'merah', label: 'Uncontrolled Diabetes Mellitus', detail: `HbA1c ${fmt(hba1c)}%` };
    if (hba1c >= 7.5) return { severity: 'merah', label: 'Uncontrolled Diabetes Mellitus', detail: `HbA1c ${fmt(hba1c)}%` };
    if (hba1c >= 7) return { severity: 'kuning', label: 'Controlled Diabetes Mellitus', detail: `HbA1c ${fmt(hba1c)}%` };
    if (hba1c >= 6.5) {
      return { severity: 'merah', label: 'Diabetes Mellitus', detail: `HbA1c ${fmt(hba1c)}%` };
    }
    if (hba1c >= 5.7) {
      return { severity: 'kuning', label: 'Prediabetes', detail: `HbA1c ${fmt(hba1c)}%` };
    }
    parts.push(`HbA1c ${fmt(hba1c)}%`);
  }

  const gdpValue = gdp ?? gdpSeSATA;
  if (gdp !== null && gdp >= 200) {
    return { severity: 'merah', label: 'Uncontrolled Diabetes Mellitus', detail: `GDP ${fmt(gdp)} mg/dL` };
  }
  if (gdpSeSATA !== null && gdpSeSATA >= 200) {
    return { severity: 'merah', label: 'Uncontrolled Diabetes Mellitus', detail: `Gula Darah Sewaktu ${fmt(gdpSeSATA)} mg/dL` };
  }
  if (gdp !== null && gdp >= 126) {
    return { severity: 'merah', label: 'Diabetes Mellitus', detail: `GDP ${fmt(gdp)} mg/dL` };
  }
  if (gdp !== null && gdp >= 100 && gdp <= 125) {
    return { severity: 'kuning', label: 'Prediabetes', detail: `GDP ${fmt(gdp)} mg/dL` };
  }
  if (gdp !== null) parts.push(`GDP ${fmt(gdp)} mg/dL`);

  if (parts.length === 0) return { severity: 'normal', label: 'Blood Glucose Within Normal Limit' };
  return { severity: 'normal', label: 'Blood Glucose Within Normal Limit', detail: parts.join(', ') };
}

// ────────────────────────────────────────────────────────────
// 5. Profil Lipid — PAPDI
//    SOP Hijau LDL <100 · Kuning 100–189 · Merah ≥190
//    SOP Hijau TG <150 · Kuning 200–499 · Merah ≥500 (celah 150–199)
// ============================================================
export function classifyLdl(ldl: number | null): Classification | null {
  if (ldl === null) return null;
  if (ldl >= 190) return { severity: 'merah', label: 'Very High LDL Cholesterol', detail: `LDL ${fmt(ldl, 0)} mg/dL` };
  if (ldl >= 100) return { severity: 'kuning', label: 'Moderate Dyslipidemia', detail: `LDL ${fmt(ldl, 0)} mg/dL` };
  return { severity: 'hijau', label: 'LDL Cholesterol Optimal', detail: `LDL ${fmt(ldl, 0)} mg/dL` };
}

export function classifyTriglyceride(tg: number | null): Classification | null {
  if (tg === null) return null;
  if (tg >= 500) return { severity: 'merah', label: 'Severe Hypertriglyceridemia', detail: `Triglyceride ${fmt(tg, 0)} mg/dL` };
  if (tg >= 200) return { severity: 'kuning', label: 'Hypertriglyceridemia', detail: `Triglyceride ${fmt(tg, 0)} mg/dL` };
  if (tg >= 150) {
    // Di bawah ambang Kuning (200) dan tidak di bawah Hijau (<150) menurut
    // tabel SOP → dicatat sebagai Borderline High tanpa memicu zona.
    return { severity: 'normal', label: 'Borderline High Triglyceride', detail: `Triglyceride ${fmt(tg, 0)} mg/dL` };
  }
  return { severity: 'hijau', label: 'Triglyceride Normal', detail: `Triglyceride ${fmt(tg, 0)} mg/dL` };
}

export function classifyTotalCholesterol(chol: number | null): Classification | null {
  if (chol === null) return null;
  if (chol >= 240) return { severity: 'kuning', label: 'High Total Cholesterol', detail: `Total Cholesterol ${fmt(chol, 0)} mg/dL` };
  if (chol >= 200) return { severity: 'normal', label: 'Borderline High Total Cholesterol', detail: `Total Cholesterol ${fmt(chol, 0)} mg/dL` };
  return { severity: 'hijau', label: 'Total Cholesterol Desirable', detail: `Total Cholesterol ${fmt(chol, 0)} mg/dL` };
}

export function classifyHdl(hdl: number | null, gender: Gender): Classification | null {
  if (hdl === null) return null;
  const low = gender === 'female' ? 50 : 40;
  if (hdl < low) return { severity: 'kuning', label: 'Low HDL Cholesterol', detail: `HDL ${fmt(hdl, 0)} mg/dL` };
  return { severity: 'hijau', label: 'HDL Cholesterol Normal', detail: `HDL ${fmt(hdl, 0)} mg/dL` };
}

// ────────────────────────────────────────────────────────────
// 6. Asam Urat
//    SOP Kuning 7–9 mg/dL · Merah >9 mg/dL
// ============================================================

export function classifyUricAcid(au: number | null, gender: Gender): Classification | null {
  if (au === null) return null;
  if (au > 9) return { severity: 'merah', label: 'Uncontrolled Hyperuricemia', detail: `Uric Acid ${fmt(au)} mg/dL` };
  if (au >= 7) return { severity: 'kuning', label: 'Mild Hyperuricemia', detail: `Uric Acid ${fmt(au)} mg/dL` };
  return { severity: 'hijau', label: 'Uric Acid Normal', detail: `Uric Acid ${fmt(au)} mg/dL` };
}

// ────────────────────────────────────────────────────────────
// 7. Fungsi Ginjal — PNPK CKD / KDIGO
//    SOP Hijau ≥60 · Kuning 45–59 (G2–G3a) · Merah <45 (≥G3b)
// ============================================================

export function classifyEgfr(egfr: number | null): Classification | null {
  if (egfr === null) return null;
  const value = `eGFR ${fmt(egfr, 0)} mL/min/1,73m²`;
  if (egfr < 15) return { severity: 'merah', label: 'Reduced Kidney Function (CKD Stage G5)', detail: value };
  if (egfr < 30) return { severity: 'merah', label: 'Reduced Kidney Function (CKD Stage G4)', detail: value };
  if (egfr < 45) return { severity: 'merah', label: 'Reduced Kidney Function (CKD Stage G3b)', detail: value };
  if (egfr < 60) return { severity: 'kuning', label: 'Reduced Kidney Function (CKD Stage G3a)', detail: value };
  if (egfr < 90) return { severity: 'hijau', label: 'Reduced Kidney Function (CKD Stage G2)', detail: value };
  return { severity: 'hijau', label: 'Normal Kidney Function (eGFR G1)', detail: value };
}

// ────────────────────────────────────────────────────────────
// 8. Fungsi Hati — Kemenkes RI
//    SOP Hijau <1,5x batas atas normal & HBsAg negatif
//    Kuning 1,5–3x batas atas normal atau HBsAg+ fungsi hati normal
//    Merah >3x batas atas normal atau hepatitis aktif
// ============================================================

export const LIVER_ULN = { sgot: 40, sgpt: 41 } as const;

export function classifyLiver(
  sgot: number | null,
  sgpt: number | null,
  hbsagReaktif: boolean,
): Classification | null {
  if (sgot === null && sgpt === null && hbsagReaktif === undefined) return null;
  const parts: string[] = [];

  for (const [key, value] of [['SGOT', sgot], ['SGPT', sgpt]] as const) {
    if (value === null) continue;
    const ratio = value / LIVER_ULN[key.toLowerCase() as keyof typeof LIVER_ULN];
    const text = `${key} ${fmt(value, 0)} U/L (${fmt(ratio, 1)}x Batas Atas Normal)`;
    if (ratio > 3) return { severity: 'merah', label: 'Severe Liver Dysfunction', detail: text };
    if (ratio >= 1.5) return { severity: 'kuning', label: 'Mild Liver Dysfunction', detail: text };
    parts.push(`${key} ${fmt(value, 0)} U/L`);
  }

  if (hbsagReaktif) {
    return { severity: 'kuning', label: 'Hepatitis B Carrier (HBsAg Positive, Normal Liver Function)', detail: parts.join(', ') };
  }
  if (parts.length === 0) return null;
  return { severity: 'hijau', label: 'Normal Liver Function', detail: parts.join(', ') };
}

// ────────────────────────────────────────────────────────────
// 9. Fungsi Paru — PDPI 2016
//    SOP Hijau FEV1/FVC ≥70% & FVC ≥80% prediksi
//    Kuning FEV1/FVC <70% dengan FEV1 50–79% prediksi
//    Merah FEV1 <50% prediksi
// ============================================================

export function classifyLung(
  fev1Pct: number | null,
  fev1Fvc: number | null,
  fvcPct: number | null,
  spiInterpretasi: string | number | null | undefined,
): Classification | null {
  const interp = String(spiInterpretasi ?? '').toLowerCase();
  if (fev1Pct === null && fev1Fvc === null && fvcPct === null && !interp) return null;

  // FEV1/FVC tersimpan sebagai DESIMAL (hasil bagi FEV1 aktual / FVC aktual,
  // lihat mcu-calculations.ts), tetapi ambang PDPI ditulis dalam PERSEN.
  // Tanpa normalisasi ini, 0,83 dianggap lebih kecil dari 70 dan SETIAP
  // record terbaca sebagai obstruktif — termasuk yang rasionya normal.
  //
  // Nilai 1,5 dipakai sebagai batas: rasio paru tidak pernah melebihi 1,0
  // dalam desimal, sedangkan persentase selalu di atas 1,5. Jadi tidak ada
  // angka yang bisa salah ditafsirkan.
  const rasio = fev1Fvc === null ? null : fev1Fvc <= 1.5 ? fev1Fvc * 100 : fev1Fvc;

  if (fev1Pct !== null) {
    if (fev1Pct < 50) {
      return { severity: 'merah', label: 'Severe Obstructive Lung Disease', detail: `FEV1 ${fmt(fev1Pct)}% of predicted` };
    }
// FEV1/FVC di bawah ambang PDPI menunjukkan obstruction, dan itu
  // menurunkan ke kuning walaupun FEV1 % prediksi masih di atas 80.
    if (fev1Pct < 80 || (rasio !== null && rasio < 70)) {
      return {
        severity: 'kuning',
        label: 'Mild to Moderate Obstructive Lung Disease',
        detail: `FEV1 ${fmt(fev1Pct)}% of predicted, FEV1/FVC ${fmt(rasio ?? 0)}%`,
      };
    }
    if (fvcPct !== null && fvcPct < 80) {
      return { severity: 'kuning', label: 'Restrictive Lung Disease', detail: `FVC ${fmt(fvcPct)}% of predicted` };
    }
    return { severity: 'hijau', label: 'Normal Lung Function', detail: `FEV1 ${fmt(fev1Pct)}% of predicted` };
  }

  // Fallback ke interpretasi tertulis bila angka spirometri tidak ada.
  if (/berat|severe|obstruksi\s*berat/.test(interp)) {
    return { severity: 'merah', label: 'Severe Obstructive Lung Disease', detail: interp || undefined };
  }
  if (/ringan|sedang|moderate|mild|obstruksi/.test(interp)) {
    return { severity: 'kuning', label: 'Mild to Moderate Obstructive Lung Disease', detail: interp || undefined };
  }
  return { severity: 'hijau', label: 'Normal Lung Function', detail: interp || undefined };
}

// ────────────────────────────────────────────────────────────
// 10. Pendengaran / NIHL — FKUI & Kemenkes RI 2011
//     SOP Hijau ≤25 dB · Kuning 26–40 · Merah 41–90 atau >90
// =============================================================
export function classifyHearing(pta: number | null, interpretasi: string | number | null | undefined): Classification | null {
  const interp = String(interpretasi ?? '').toLowerCase();
  if (pta === null && !interp) return null;

  if (pta !== null) {
    const value = `PTA ${fmt(pta, 0)} dB`;
    if (pta > 90) return { severity: 'merah', label: 'Severe Noise-Induced Hearing Loss', detail: value };
    if (pta > 60) return { severity: 'merah', label: 'Severe Noise-Induced Hearing Loss', detail: value };
    if (pta > 40) return { severity: 'merah', label: 'Moderate Noise-Induced Hearing Loss', detail: value };
    if (pta > 25) return { severity: 'kuning', label: 'Mild Noise-Induced Hearing Loss', detail: value };
    return { severity: 'hijau', label: 'Normal Hearing', detail: value };
  }

  if (/sangat berat|very severe/.test(interp)) return { severity: 'merah', label: 'Very Severe Noise-Induced Hearing Loss', detail: interp || undefined };
  if (/berat|severe/.test(interp)) return { severity: 'merah', label: 'Severe Noise-Induced Hearing Loss', detail: interp || undefined };
  if (/sedang|moderate/.test(interp)) return { severity: 'merah', label: 'Moderate Noise-Induced Hearing Loss', detail: interp || undefined };
  if (/ringan|mild/.test(interp)) return { severity: 'kuning', label: 'Mild Noise-Induced Hearing Loss', detail: interp || undefined };
  return { severity: 'hijau', label: 'Normal Hearing', detail: interp || undefined };
}

// ────────────────────────────────────────────────────────────
// 11. Penglihatan
//     SOP Hijau visus terkoreksi ≥6/9 · Kuning 6/9–6/18 · Merah <6/18
//     Data MCU bisa tertulis 6/6, 6/9, 20/20, 20/30, atau 1,0 →
//     diseragamkan lebih dulu ke desimal (1,0 = 20/20 = 6/6).
// =============================================================

export interface VisionResult {
  /** Ketajaman dalam skala desimal (1,0 = normal). */
  decimal: number | null;
  /** Skala Snellen 6/x, mis. "6/24". */
  snellen: string | null;
  /** true bila angka tersebut sudah termasuk koreksi. */
  corrected: boolean;
  /** Golongan: 'normal' | 'ringan' | 'berat' | 'tidak-diuji' | 'tidak-dinilai' */
  category: 'normal' | 'ringan' | 'berat' | 'tidak-diuji' | 'tidak-dinilai';
  raw: string;
}

/**
 * Menormalkan hasil visus dari berbagai format lab/Optik.
 * Snellen "6/9" dan "20/30" menghasilkan desimal yang sama (0,67).
 */
export function parseVisualAcuity(raw: string | number | null | undefined): VisionResult {
  const text = String(raw ?? '').trim();
  if (!text || /^(n\/a|tidak diuji)$/i.test(text)) {
    return { decimal: null, snellen: null, corrected: false, category: 'tidak-diuji', raw: text };
  }

  const corrected = /terkoreksi|koreksi|s\.?\s*c\.?\s*glasses|with\s*correction/i.test(text);
  // 1,0 / 1.0 → desimal langsung
  const decimalMatch = text.match(/(\d+[.,]\d+)/);
  const ratioMatch = text.match(/(\d+)\s*\/\s*(\d+)/);

  let decimal: number | null = null;
  if (ratioMatch) {
    const numerator = Number(ratioMatch[1]);
    const denominator = Number(ratioMatch[2]);
    if (denominator > 0) {
      // 6/x → desimal; 20/y → desimal
      decimal = numerator === 20 ? denominator / 20 : numerator / 6;
    }
  } else if (decimalMatch) {
    const value = Number(decimalMatch[1].replace(',', '.'));
    decimal = value > 0 && value <= 2 ? value : null;
  }

  if (decimal === null) {
    return { decimal: null, snellen: null, corrected, category: 'tidak-dinilai', raw: text };
  }

  const snellen = decimal > 0
    ? (decimal >= 1 ? '6/6' : `6/${Math.round(6 / decimal)}`)
    : null;

  let category: VisionResult['category'];
  if (decimal >= 0.67) category = 'normal';      // ≥ 6/9
  else if (decimal >= 0.33) category = 'ringan'; // 6/18 – 6/9
  else category = 'berat';                        // < 6/18

  return { decimal: Number(decimal.toFixed(2)), snellen, corrected, category, raw: text };
}

export function classifyVision(visusJauh: string | number | null | undefined): Classification | null {
  const parsed = parseVisualAcuity(visusJauh);
  if (parsed.category === 'tidak-diuji') return null;
  if (parsed.category === 'tidak-dinilai') {
    return { severity: 'normal', label: 'Visual Acuity Not Interpretable', detail: parsed.raw };
  }
  const detail = `Visual Acuity ${parsed.snellen}${parsed.corrected ? ' (corrected)' : ''}`;
  if (parsed.category === 'berat') {
    return { severity: 'merah', label: 'Severe Visual Impairment', detail };
  }
  if (parsed.category === 'ringan') {
    return { severity: 'kuning', label: 'Mild Visual Impairment', detail };
  }
  return { severity: 'hijau', label: 'Normal Visual Acuity', detail };
}

// ────────────────────────────────────────────────────────────
// 12. Pneumokoniosis — Klasifikasi ILO pada foto toraks
//     SOP Hijau foto normal · Kuning ILO 1/0–1/1 · Merah ≥2/1 atau PMF
// =============================================================
export function classifyChestXr(chestXr: string | number | null | undefined): Classification | null {
  const raw = String(chestXr ?? '').trim();
  if (!raw || /^(n\/a|normal|dbn)$/i.test(raw)) return null;
  const text = raw.toLowerCase();

  const ilo = text.match(/ilo\s*(\d)\s*[/:]?\s*(\d)?/);
  if (ilo) {
    const major = Number(ilo[1]);
    if (major >= 2) {
      return { severity: 'merah', label: 'Advanced Pneumoconiosis', detail: `Chest X-Ray ILO ${major}/${ilo[2] ?? '0'}` };
    }
    if (major === 1) {
      return { severity: 'kuning', label: 'Early Pneumoconiosis', detail: `Chest X-Ray ILO 1/${ilo[2] ?? '0'}` };
    }
  }
  if (/pmf|progressive massive fibrosis|masa fibrosa/.test(text)) {
    return { severity: 'merah', label: 'Progressive Massive Fibrosis (PMF)', detail: raw };
  }
  if (/pneumokonio|silikosis|antrakosis|asbestosis/.test(text)) {
    return { severity: 'kuning', label: 'Pneumoconiosis', detail: raw };
  }
  return { severity: 'normal', label: 'Chest X-Ray Abnormal (Non-Specific Finding)', detail: raw };
}

// =============================================================
// 13. Electrocardiogram (ECG) dan Exercise Treadmill Test
//     SOP STD-006 Rev001 tidak memuat parameter ini. Klasifikasi
//     di bawah mengikuti istilah bacaan yang lazim dipakai pada
//     laporan EKG 12-lead dan Treadmill Bruce.
// =============================================================
//
//  MENAPA KLASIFIKASI INI ADA, BUKAN CUMA "NORMAL / ABNORMAL"
//
//  Dua kelemahan fungsi isAbnormalFreeText() lama:
//
//  1. "Normal Resting ECG" dianggap abnormal, karena pencocokan dijepit
//     dengan ^normal$ sehingga frasa yang diawali "Normal" tidak cocok.
//     Akibatnya 928 record normal menghasilkan diagnosis "Electrocardiogram
//     Abnormal". Itu membingungkan pembaca laporan.
//
//  2. Semua temuan diperlakukan sama. "RBBB Incomplate + Right Axis
//     Deviation" dan "PVC Occasional LV Apex" sama-sama dianggap sekadar
//     "abnormal", padahal keduanya berbeda tingkat.
//
//  DAN MENGAPA VARIAN NORMAL DIANGGAP NORMAL
//
//  "Normal Variations of Resting ECG", "Sinus Bradycardia (Normal Variant)",
//  dan "IRBBB" adalah bacaan NORMAL. Sinus bradikardia pada orang yang terlatih
//  adalah adaptasi fisiologis, bukan penyakit. Menandainya abnormal akan
//  menimbulkan alarm palsu.
//
//  IRBBB (incomplete RBBB) sendiri juga varian normal yang sangat umum,
//  terutama pada orang muda. Tapi IRBBB yang BERKOMBINASI dengan
//  Right Axis Deviation baru bermakna, karena pola itu mencurigai
//  hipertrofi ventrikel kanan atau hipertensi paru - relevan pada pekerja
//  pertambangan yang PAPARAN DEBUNYA tinggi. Karena itu incomplete RBBB
//  bernilai 'normal' saat sendirian, dan otomatis naik ke 'kuning' bila
//  digabung temuan lain.
//
//  CATATAN KLINIS: ini SKRINING, bukan diagnosis. Dipakai untuk
//  menentukan zona MCU; keputusan klinis tetap milik dokter.
export const ECG_OPTIONS = [
  'Normal Sinus Rhythm',
  'Normal Variations of Resting ECG',
  'Sinus Bradycardia (Normal Variant)',
  'Incomplete Right Bundle Branch Block',
  'Sinus Bradycardia',
  'Sinus Tachycardia',
  'Sinus Arrhythmia',
  'Left Axis Deviation',
  'Right Axis Deviation',
  'Left Ventricular Hypertrophy',
  'Right Ventricular Hypertrophy',
  'Premature Ventricular Contraction',
  'Low Atrial Rhythm',
  'Incomplete Right Bundle Branch Block with Right Axis Deviation',
  'Right Bundle Branch Block',
  'Left Bundle Branch Block',
  'Atrioventricular Block',
  'Atrial Fibrillation',
  'ST Segment Abnormal',
  'Acute Myocardial Infarction',
  'Other Finding (Requires Review)',
  'Not Performed',
] as const;

export const TMT_OPTIONS = [
  'Negative Ischemic Response',
  'Negative Ischemic Response with Normal Blood Pressure Response',
  'Positive Ischemic Response',
  'Positive Ischemic Response with Hypotensive Blood Pressure Response',
  'Exercise-Induced ST Depression',
  'Abnormal Blood Pressure Response',
  'Ventricular Ectopy during Exercise',
  'Non-Diagnostic Test (Target Heart Rate Not Achieved)',
  'Not Performed',
] as const;

interface Temuan {
  severity: Severity;
  label: string;
}

const TIDAK_DILAKUKAN = /^(n\/a|na|-|dbn|tidak dilakukan|tidak dilakukan|belum|tidak ada hasil|not performed|nil)$/i;

/** Urutannya: makin ke kanan, makin serius. */
const TINGKAT: Record<Severity, number> = {
  'hijau': 0,
  'normal': 1,
  'tidak-dinilai': 2,
  'kuning': 3,
  'merah': 4,
};

/**
 * Mengubah satu frasa hasil bacaan EKG menjadi temuan.
 *
 *_input_ sudah lowercase. Mengembalikan null berarti frasa itu tidak
 * memuat temuan yang dikenali.
 *
 * Ejaan dari data lama sengaja ditoleransi: "Sinus Bradicardia",
 * "Synus Rythm", "Sinus Takikardi", dan "Sinus Arhytmia" semuanya salah
* eja tapi sudah tersimpan di database, dan classifier tidak boleh
* berubah karena ejaan.
*/
function classifyTemuanEcg(frasa: string): Temuan | null {
  if (!frasa) return null;

  // ── Merah ──
  if (/\bami\b|acute myocardial|myocardial infarct|\bomi\b|infark miokard/.test(frasa)) {
    return { severity: 'merah', label: 'Acute Myocardial Infarction' };
  }
  if (/\bst\b[^,]{0,24}(abnormal|elevat|depress|changes|t\s*abnormal)|segment abnormal|\bst abnormal\b/.test(frasa)) {
    return { severity: 'merah', label: 'ST Segment Abnormal' };
  }
  if (/atrial fibrillation|\bfib\b|\baf\b(?!ter)/.test(frasa)) {
    return { severity: 'merah', label: 'Atrial Fibrillation' };
  }
  // AV block derajat SATU (first degree) diperiksa lebih dulu, karena
  // kondisi ini hanya perpanjangan PR > 200 ms dan biasanya tidak
  // gawat. Derajat dua dan tiga tetap merah. Kalau tidak dipisah, satu
  // bacaan "first degree AV block" akan memicu zona merah padahal tidak
  // gawat.
  if (/\b(?:first|1st|1)\s*-?\s*degree\b[^,]{0,24}block|block[^,]{0,24}\b(?:first|1st|1)\s*-?\s*degree\b|derajat\s*(?:satu|1)\b[^,]{0,16}blok/.test(frasa)) {
    return { severity: 'kuning', label: 'First-Degree Atrioventricular Block' };
  }
  // AV block LENGKAP / derajat tiga lebih dulu, karena ini yang paling
  // gawat: jantung tidak bisa conducts dari atrium ke ventrikel.
  if (/complete\s*(heart|av|atrioventricular)\s*block|third\s*degree|degree\s*(iii|3)\b|block\s*(iii|3)\b|blok\s*(jantung|av|atrioventricular)\s*(lengkap|total)|\b2\s*:\s*1\s*(block|blok)/.test(frasa)) {
    return { severity: 'merah', label: 'Complete Atrioventricular Block' };
  }
  if (/(av|atrioventricular)\s*block|blok (av|atrioventricular)/.test(frasa)) {
    return { severity: 'merah', label: 'Atrioventricular Block' };
  }
  if (/lbbb|left bundle/.test(frasa)) {
    return { severity: 'merah', label: 'Left Bundle Branch Block' };
  }

  // ── Kuning ──
  if (/brady|bradik|bradicar|bradich|bradic|bradikard/.test(frasa)) {
    return { severity: 'kuning', label: 'Sinus Bradycardia' };
  }
  if (/tach|tachik|takik/.test(frasa)) {
    return { severity: 'kuning', label: 'Sinus Tachycardia' };
  }
  if (/arrh|arhyt|arhythm|\baritmia\b/.test(frasa)) {
    return { severity: 'kuning', label: 'Sinus Arrhythmia' };
  }
  if (/\bpvc\b|premature ventricular|ectopic|ektopik/.test(frasa)) {
    return { severity: 'kuning', label: 'Premature Ventricular Contraction' };
  }
  if (/\blvh\b|\brvh\b|ventricular hypertrophy|hipertrofi ventrikel|hipertrofi ventrikula/.test(frasa)) {
    return { severity: 'kuning', label: 'Ventricular Hypertrophy' };
  }
  if (/low atrial|atrial rhythm|ritme atrial/.test(frasa)) {
    return { severity: 'kuning', label: 'Low Atrial Rhythm' };
  }

  // Puncak T menjunjai (hiperkalemia). Tidak ada kategori khusus untuk ini
  // pada STD-006 Rev001, jadi hanya "kuning" — perlu konfirmasi, bukan
  // langsung zona merah.
  if (/peaked\s*t|t\s*wave|gelombang t tinggi|t\. wave/.test(frasa)) {
    return { severity: 'kuning', label: 'Peaked T Waves (Suspect Hyperkalemia)' };
  }

  // Incomplete RBBB dicek SEBELUM RBBB lengkap, karena "Incomplete RBBB"
  // juga mengandung frasa "rbbb".
  const incomplete = /incomplete|incomplate|incomplet|\birbbb\b/.test(frasa);
  if (/rbbb|right bundle/.test(frasa)) {
    return incomplete
      ? { severity: 'normal', label: 'Incomplete Right Bundle Branch Block' }
      : { severity: 'kuning', label: 'Right Bundle Branch Block' };
  }
  if (incomplete) {
    return { severity: 'normal', label: 'Incomplete Right Bundle Branch Block' };
  }

  if (/axis deviation|deviasi sumbu|sumbu (kanan|kiri)|\blad\b|left axis|\brad\b|right axis/.test(frasa)) {
    const kiri = /\blad\b|left axis|sumbu kiri/.test(frasa);
    const kanan = /\brad\b|right axis|deviasi sumbu|sumbu kanan/.test(frasa);
    if (kiri && !kanan) return { severity: 'kuning', label: 'Left Axis Deviation' };
    if (kanan && !kiri) return { severity: 'kuning', label: 'Right Axis Deviation' };
    return { severity: 'kuning', label: 'Axis Deviation' };
  }

  return null;
}

/**
 * Mengklasifikasikan hasil bacaan EKG.
 *
 * Mengembalikan null bila hasilnya NORMAL, supaya tidak muncul di daftar
 * diagnosis. Daftar diagnosis hanya untuk hal yang perlu ditindak.
 *
 * Bacaan gabungan ("Sinus Arhytmia + LVH") dipecah menjadi beberapa temuan,
 * lalu diambil yang paling serius. Hasilnya bukan sekadar "abnormal", tetapi
 * nama temuan yang bisa ditindaklanjuti.
 */
export function classifyEcg(ecg: string | number | null | undefined): Classification | null {
  const raw = String(ecg ?? '').trim();
  if (!raw || TIDAK_DILAKUKAN.test(raw)) return null;

  const lower = raw.toLowerCase();

  // Bacaan varian normal. whole reading ini normal meskipun berisi
  // kata "bradycardia" di dalam kurung, misalnya:
  //   "Normal Variations of Resting ECG (Sinus Bradikardi)"
  // Meyakinkan agar frasa di dalamnya ikut dianggap normal.
  if (/normal\s*variation|normal\s*variant|variant\s*normal/.test(lower)) return null;

  // Pembaca sesekali menyebut komponen yang justru TIDAK ditemukan,
  // misalnya "RBBB w/o RVH" atau "Sinus Rhythm without LBBB".
  // Frasa setelah kata negasi dibuang, kalau tidak "w/o RVH" akan
  // dilaporkan sebagai "Ventricular Hypertrophy" dan bertentangan
  // dengan bacaan aslinya.
  const tanpaNegasi = lower.replace(
    /\b(?:w\/?o(?:ut)?|withou?ut|tanpa|tak ada|tidak ada|nihil)\s+[a-z]+/g,
    ' ',
  );

  const frasa = tanpaNegasi
    .split(/[+,;]|\bdengan\b|\bw\//)
    .map((part) => part.replace(/[()]/g, ' ').trim())
    .filter(Boolean);

  const temuan: Temuan[] = [];
  for (const bagian of frasa) {
    const ketemu = classifyTemuanEcg(bagian);
    if (ketemu) temuan.push(ketemu);
  }

  // Semua temuan bernilai 'normal' (mis. hanya IRBBB), atau tidak ada
  // temuan sama sekali dan teksnya mengandung "normal".
  const serius = temuan.filter((t) => TINGKAT[t.severity] > TINGKAT.normal);
  if (serius.length === 0) {
    if (temuan.length === 0 && /\bnormal\b|sinus|nsr/.test(lower)) return null;
    if (temuan.length === 0) {
      return { severity: 'normal', label: 'Electrocardiogram Other Finding (Non-Specific)', detail: raw };
    }
    return null;
  }

  const terbaik = serius.reduce((a, b) => (TINGKAT[b.severity] > TINGKAT[a.severity] ? b : a));
  const label = [...new Set(temuan.map((t) => t.label))].join(' + ');
  return { severity: terbaik.severity, label, detail: raw };
}

/**
 * Mengklasifikasikan hasil Exercise Treadmill Test (protokol Bruce).
 *
 * "Negative Ischemic Response" adalah hasil NORMAL dan tidak boleh muncul
 * di daftar diagnosis. "Inconclusive" atau "Non-Diagnostic" berarti tes
 * tidak selesai, jadi bukan temuan abnormal — tapi juga tidak boleh
 * dianggap normal, sebab pemeriksaan wajib diulang.
 */
export function classifyTreadmill(tm: string | number | null | undefined): Classification | null {
  const raw = String(tm ?? '').trim();
  if (!raw || TIDAK_DILAKUKAN.test(raw)) return null;

  const lower = raw.toLowerCase();

  if (/negative|inconclusive|non\s*-?\s*diagnostic/.test(lower)) {
    if (/inconclusive|non\s*-?\s*diagnostic|target (heart ?rate|hr)|hr\s*<|tidak tercapai/.test(lower)) {
      return {
        severity: 'kuning',
        label: 'Non-Diagnostic Treadmill Test (Target Heart Rate Not Achieved)',
        detail: raw,
      };
    }
    return null;
  }

  if (/positive|st depression|exercise\s*-?\s*induced ischemia|ischemi|ischaemi/.test(lower)) {
    return { severity: 'merah', label: 'Positive Ischemic Response', detail: raw };
  }

  if (/blood pressure response|hypotensive|hypertensive response|\bbp response\b|tekanan darah/.test(lower)) {
    return { severity: 'kuning', label: 'Abnormal Blood Pressure Response', detail: raw };
  }

  if (/\bpvc\b|premature ventricular|ectop|ventricular ectopy|ektopik/.test(lower)) {
    return { severity: 'kuning', label: 'Ventricular Ectopy during Exercise', detail: raw };
  }

  return { severity: 'normal', label: 'Exercise Treadmill Test Other Finding (Non-Specific)', detail: raw };
}

// ────────────────────────────────────────────────────────────
// 13. Riwayat penyakit (dropdown multi-pilih di mcu_records)
//     Nilai kosong = tidak ada (= normal), sesuai instruksi QSHE.
// =============================================================

export const EPILEPSY_OPTIONS = [
  'Tidak ada riwayat epilepsi',
  'Epilepsi terkontrol (bebas kejang ≥12 bulan dengan terapi)',
  'Epilepsi tidak terkontrol (kejang ≤12 bulan terakhir atau tidak patuh terapi)',
] as const;

export const CARDIAC_OPTIONS = [
  'Tidak ada riwayat penyakit jantung',
  'Penyakit jantung koroner / angina',
  'Infark miokard',
  'Gagal jantung',
  'Kelainan katup jantung',
  'Riwayat jantung dengan gejala residual',
] as const;

export const STROKE_OPTIONS = [
  'Tidak ada riwayat stroke',
  'Stroke iskemik',
  'Stroke hemoragik',
  'Stroke dengan gejala residual',
] as const;

export const ASTHMA_OPTIONS = [
  'Tidak ada riwayat asma',
  'Asma ringan (terkontrol penuh)',
  'Asma sedang',
  'Asma berat',
] as const;

export const SLEEP_APNEA_OPTIONS = [
  'Tidak ada riwayat sleep apnea',
  'Obstructive Sleep Apnea (OSA)',
  'Central Sleep Apnea',
  'Obesity Hypoventilation Syndrome (OHS)',
] as const;

export const LBP_OPTIONS = [
  'Tidak ada nyeri punggung bawah kronis',
  'Nyeri punggung bawah kronik (< 3 bulan)',
  'Nyeri punggung bawah kronik (≥ 3 bulan) tanpa defisit neurologis',
  'Nyeri punggung bawah kronik (≥ 3 bulan) dengan defisit neurologis',
] as const;

/** Pecah nilai multi-select yang disimpan sebagai "A | B" atau "A, B". */
export function splitMulti(value: string | number | null | undefined): string[] {
  return String(value ?? '')
    .split(/\s*[|,;]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

type MultiValue = string | number | null | undefined;

function matchesAny(value: MultiValue, patterns: RegExp): boolean {
  return splitMulti(value).some((item) => patterns.test(item));
}

export function hasControlledEpilepsy(value: MultiValue): boolean {
  return matchesAny(value, /terkontrol/i) && !matchesAny(value, /tidak terkontrol/i);
}

export function hasUncontrolledEpilepsy(value: MultiValue): boolean {
  return matchesAny(value, /tidak terkontrol/i);
}

export function hasResidualCardiacSymptom(value: MultiValue): boolean {
  return matchesAny(value, /gejala residual/i);
}

export function hasAnyCardiacHistory(value: MultiValue): boolean {
  return matchesAny(value, /koroner|angina|infark|gagal jantung|katup|residual/i);
}

export function hasResidualStroke(value: MultiValue): boolean {
  return matchesAny(value, /gejala residual/i);
}

export function hasAnyStroke(value: MultiValue): boolean {
  return splitMulti(value).some((item) => /iskemik|hemoragik|residual/i.test(item));
}

export function hasSleepApnea(value: MultiValue): boolean {
  return matchesAny(value, /sleep apnea|\bOSA\b|central sleep apnea|\bOHS\b|hipoventilasi/i);
}

export function hasAsthma(value: MultiValue): boolean {
  return matchesAny(value, /asma/i) && !matchesAny(value, /tidak ada riwayat asma/i);
}

export function hasLbpWithNeurologicalDeficit(value: MultiValue): boolean {
  return matchesAny(value, /defisit neurologis/i);
}

export function hasChronicLbp(value: MultiValue): boolean {
  return matchesAny(value, /nyeri punggung bawah/i) || matchesAny(value, /\bLBP\b/i);
}

// ────────────────────────────────────────────────────────────
// 14. Laboratorium lain (di luar parameter zonasi, tetap didiagnosis)
// =============================================================

export const LEUKOSIT_RANGE = { min: 4, max: 11 } as const;

export function classifyLeukosit(value: number | null): Classification | null {
  if (value === null) return null;
  const text = `Leukocyte ${fmt(value)} 10³/µL`;
  if (value > 11) return { severity: 'normal', label: 'Leukocytosis', detail: text };
  if (value < 4) return { severity: 'normal', label: 'Leukopenia', detail: text };
  return { severity: 'hijau', label: 'Leukocyte Count Normal', detail: text };
}

export function classifyEritrosit(value: number | null, gender: Gender): Classification | null {
  if (value === null) return null;
  const text = `Erythrocyte ${fmt(value)} 10⁶/µL`;
  const [min, max] = gender === 'female' ? [4.2, 5.4] : [4.5, 6.2];
  if (value > max) return { severity: 'normal', label: 'Erythrocytosis', detail: text };
  if (value < min) return { severity: 'normal', label: 'Erythrocytopenia', detail: text };
  return { severity: 'hijau', label: 'Erythrocyte Count Normal', detail: text };
}

export function classifyTrombosit(value: number | null): Classification | null {
  if (value === null) return null;
  const text = `Platelet ${fmt(value)} 10³/µL`;
  if (value > 400) return { severity: 'normal', label: 'Thrombocytosis', detail: text };
  if (value < 150) return { severity: 'normal', label: 'Thrombocytopenia', detail: text };
  return { severity: 'hijau', label: 'Platelet Count Normal', detail: text };
}

export function classifyHematokrit(value: number | null, gender: Gender): Classification | null {
  if (value === null) return null;
  const text = `Hematocrit ${fmt(value, 0)}%`;
  const [min, max] = gender === 'female' ? [36, 46] : [40, 54];
  if (value > max) return { severity: 'normal', label: 'Elevated Hematocrit', detail: text };
  if (value < min) return { severity: 'normal', label: 'Low Hematocrit', detail: text };
  return { severity: 'hijau', label: 'Hematocrit Normal', detail: text };
}

export function classifyUreum(value: number | null): Classification | null {
  if (value === null) return null;
  if (value > 48.5) {
    return { severity: 'normal', label: 'Elevated Blood Urea', detail: `Urea ${fmt(value)} mg/dL` };
  }
  return { severity: 'hijau', label: 'Blood Urea Normal', detail: `Urea ${fmt(value)} mg/dL` };
}

export function classifyBilirubin(value: number | null): Classification | null {
  if (value === null) return null;
  if (value > 1.2) {
    return { severity: 'normal', label: 'Hyperbilirubinemia', detail: `Total Bilirubin ${fmt(value)} mg/dL` };
  }
  return { severity: 'hijau', label: 'Total Bilirubin Normal', detail: `Total Bilirubin ${fmt(value)} mg/dL` };
}

export function classifyPsa(value: number | null): Classification | null {
  if (value === null) return null;
  if (value >= 10) {
    return { severity: 'normal', label: 'Markedly Elevated PSA', detail: `PSA ${fmt(value)} ng/mL — rujuk urologi` };
  }
  if (value >= 4) {
    return { severity: 'normal', label: 'Elevated PSA', detail: `PSA ${fmt(value)} ng/mL` };
  }
  return { severity: 'hijau', label: 'PSA Normal', detail: `PSA ${fmt(value)} ng/mL` };
}

export function classifyGgt(value: number | null): Classification | null {
  if (value === null) return null;
  if (value > 61) {
    return { severity: 'normal', label: 'Elevated Gamma-GT', detail: `GGT ${fmt(value, 0)} U/L` };
  }
  return { severity: 'hijau', label: 'Gamma-GT Normal', detail: `GGT ${fmt(value, 0)} U/L` };
}

export function classifyAlp(value: number | null): Classification | null {
  if (value === null) return null;
  if (value > 147) {
    return { severity: 'normal', label: 'Elevated Alkaline Phosphatase', detail: `ALP ${fmt(value, 0)} IU/L` };
  }
  return { severity: 'hijau', label: 'Alkaline Phosphatase Normal', detail: `ALP ${fmt(value, 0)} IU/L` };
}

/** Nilai serologi yang dianggap "reaktif/positif". */
export function isReactive(value: string | number | null | undefined): boolean {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return false;
  return /reaktif|positif|\+\s*\(|positive/.test(text) && !/non\s*-?\s*reaktif|negatif/.test(text);
}

export const REACTIVE_DIAGNOSIS: Record<string, string> = {
  hbsag: 'Hepatitis B Infection',
  vdrl: 'Syphilis Screening Positive',
  tpha: 'Syphilis Confirmatory Test Positive',
  hiv: 'HIV Infection',
};

export const DRUG_TEST_DIAGNOSIS: Record<string, string> = {
  drugAmp: 'Amphetamine Use Detected',
  drugMeth: 'Methamphetamine Use Detected',
  drugMorph: 'Opioid Use Detected',
  drugCanna: 'Cannabinoid Use Detected',
  drugCoc: 'Cocaine Use Detected',
  drugBenz: 'Benzodiazepine Use Detected',
  drugCaris: 'Carisoprodol Use Detected',
  alkohol: 'Alcohol Use Detected',
};

/** Label tampilan untuk tiap tes NAPZA. */
export const DRUG_TEST_LABEL: Record<string, string> = {
  drugAmp: 'Amphetamine',
  drugMeth: 'Methamphetamine',
  drugMorph: 'Morphine',
  drugCanna: 'Cannabinoid',
  drugCoc: 'Cocaine',
  drugBenz: 'Benzodiazepine',
  drugCaris: 'Carisoprodol',
  alkohol: 'Alcohol',
};

/**
 * Tes kebugaran (6-Minute Walk Test dan Harvard Step Test).
 * Tidak sama dengan ESS, dan bukan parameter zonasi menurut SOP.
 */
export function classifyFitnessTest(value: string | null | undefined): Classification | null {
  const raw = String(value ?? '').trim();
  if (!raw || /^(n\/a|tidak dilakukan)$/i.test(raw)) return null;
  if (!/kurang|buruk|poor|abnormal/i.test(raw)) return null;
  return { severity: 'kuning', label: 'Impaired Physical Fitness', detail: raw };
}
