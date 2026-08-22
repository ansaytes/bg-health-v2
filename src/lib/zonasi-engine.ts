// ============================================================
// Zonasi Assessment Engine — BG-QSHE-STD-006_PTM Rev001
// Implements zone assessment per revised criteria document
// All fields are checked; highest risk wins.
// ============================================================

export interface ZonasiResult {
  zona: 'Hijau' | 'Kuning' | 'Merah' | 'Belum Lengkap';
  triggers: string[];
  pengendalian: string;
}

interface MCUDraft {
  [key: string]: string | number | undefined;
}

// Helper: safe number parse
function n(val: string | number | undefined): number | null {
  if (val === undefined || val === null || val === '' || val === 'N/A') return null;
  const parsed = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  return isNaN(parsed) ? null : parsed;
}

// Helper: check if value is N/A or empty
function isNA(val: string | number | undefined): boolean {
  return val === undefined || val === null || val === '' || val === 'N/A';
}

// Helper: search text (case-insensitive)
function hasText(val: string | undefined, search: string): boolean {
  if (!val || val === 'N/A') return false;
  return val.toLowerCase().includes(search.toLowerCase());
}

export function assessZonasi(d: MCUDraft, gender?: string): ZonasiResult {
  const triggers: string[] = [];
  const isMale = gender?.toLowerCase().includes('laki');
  const isFemale = gender?.toLowerCase().includes('perem');

  // ═══════════════════════════════════════════
  // ZONA MERAH CHECKS (highest priority)
  // ═══════════════════════════════════════════

  // 1. Hipertensi Grade ≥2: SBP ≥160 OR DBP ≥100
  const tdS = n(d.tdS), tdD = n(d.tdD);
  if (tdS !== null && tdD !== null) {
    if (tdS >= 160 || tdD >= 100) {
      triggers.push('Hipertensi Grade ≥2 (Merah)');
    }
  }

  // 2. DM tidak terkontrol: HbA1c ≥8 OR GDP ≥200
  const hba1c = n(d.hba1c), gdp = n(d.gdp);
  if (hba1c !== null && hba1c >= 8) {
    triggers.push('HbA1c Sangat Tinggi ≥8% (Merah)');
  }
  if (gdp !== null && gdp >= 200) {
    triggers.push('GDP Sangat Tinggi ≥200 mg/dL (Merah)');
  }

  // 3. DM dengan komplikasi (check in diagnosaMedis or catatan)
  const dmText = String(d.diagnosaMedis || '') + ' ' + String(d.catatan || '');
  if (hasText(dmText, 'neuropati') || hasText(dmText, 'retinopati') || hasText(dmText, 'nefropati')) {
    triggers.push('Komplikasi DM (Merah)');
  }

  // 4. CKD ≥G3b: eGFR <45
  const egfr = n(d.egfr);
  if (egfr !== null && egfr < 45) {
    triggers.push('eGFR Sangat Rendah <45 (Merah)');
  }

  // 5. LDL ≥190
  const ldl = n(d.ldl);
  if (ldl !== null && ldl >= 190) {
    triggers.push('LDL Sangat Tinggi ≥190 (Merah)');
  }

  // 6. TG ≥500
  const tg = n(d.tg);
  if (tg !== null && tg >= 500) {
    triggers.push('TG Sangat Tinggi ≥500 (Merah)');
  }

  // 7. IMT ≥30 dengan komorbid signifikan (HT, DM, gangguan napas)
  const bmi = n(d.bmi);
  if (bmi !== null && bmi >= 30) {
    const hasHT = (tdS !== null && tdS >= 140) || (tdD !== null && tdD >= 90);
    const hasDM = (hba1c !== null && hba1c >= 7) || (gdp !== null && gdp >= 100) || (d.diabetes === 'Ya');
    const hasSleepApnea = hasText(d.spiInterp, 'OSA') || hasText(d.spiInterp, 'OHS') ||
      hasText(dmText, 'OSA') || hasText(dmText, 'OHS') ||
      hasText(d.spiInterp, 'asma') || hasText(d.spiInterp, 'dispnea');
    if (hasHT || hasDM || hasSleepApnea) {
      triggers.push('Obesitas dengan Komorbid Signifikan (Merah)');
    }
  }

  // 8. IMT ≥35 dengan keterbatasan fungsional
  if (bmi !== null && bmi >= 35) {
    triggers.push('Obesitas Morbid BMI≥35 (Merah)');
  }

  // 9. Riwayat jantung/stroke dengan gejala residual
  if (hasText(dmText, 'riwayat jantung') || hasText(dmText, 'riwayat stroke')) {
    triggers.push('Riwayat Jantung/Stroke (Merah)');
  }

  // 10. Asam urat >9 dengan artritis berulang
  const au = n(d.au);
  if (au !== null && au > 9) {
    triggers.push('Asam Urat Sangat Tinggi >9 mg/dL (Merah)');
  }

  // 11. Gangguan paru berat: FEV1 <50% pred
  const fev1Pct = n(d.fev1Pct);
  if (fev1Pct !== null && fev1Pct < 50) {
    triggers.push('Gangguan Paru Berat FEV1<50% (Merah)');
  }
  const spiText = String(d.spiInterp || '');
  if (hasText(spiText, 'berat') || hasText(spiText, 'severe')) {
    if (!hasText(spiText, 'ringan') && !hasText(spiText, 'mild') && !hasText(spiText, 'sedang') && !hasText(spiText, 'moderate')) {
      triggers.push('Gangguan Spirometri Berat (Merah)');
    }
  }

  // 12. Anemia sedang-berat: Hb <10
  const hb = n(d.hb);
  if (hb !== null && hb < 10) {
    triggers.push('Anemia Berat Hb<10 g/dL (Merah)');
  }

  // 13. Epilepsi tidak terkontrol
  if (hasText(dmText, 'epilepsi tidak terkontrol')) {
    triggers.push('Epilepsi Tidak Terkontrol (Merah)');
  }

  // 14. Gangguan visus berat
  const visusText = String(d.visusJauh || '');
  if (!isNA(d.visusJauh) && !hasText(visusText, 'terkoreksi')) {
    const severeVisions = ['1/60', '2/60', '3/60', '1/300', '20/200', '20/400', 'LP', 'NLP'];
    if (severeVisions.some(v => hasText(visusText, v))) {
      triggers.push('Gangguan Visus Berat (Merah)');
    }
  }

  // 15. Gangguan pendengaran sedang-berat (>40 dB)
  const audText = String(d.audInterp || '');
  if (!isNA(d.audInterp) && d.audInterp !== 'Normal' && d.audInterp !== 'Normal Audiometry') {
    if (hasText(audText, 'moderate') || hasText(audText, 'severe') || hasText(audText, 'bilateral') ||
        hasText(audText, 'sedang') || hasText(audText, 'berat')) {
      triggers.push('Gangguan Pendengaran Sedang-Berat (Merah)');
    }
  }

  // 16. SGPT/SGOT >3x batas atas normal atau hepatitis aktif
  const sgot = n(d.sgot), sgpt = n(d.sgpt);
  if (sgot !== null && sgot > 120) { // >3x 40
    triggers.push('SGOT Sangat Tinggi >3x Normal (Merah)');
  }
  if (sgpt !== null && sgpt > 123) { // >3x 41
    triggers.push('SGPT Sangat Tinggi >3x Normal (Merah)');
  }
  if (hasText(dmText, 'hepatitis aktif') || hasText(dmText, 'sirosis')) {
    triggers.push('Hepatitis Aktif/Sirosis (Merah)');
  }

  // 17. Pneumokoniosis ILO ≥2/1 atau PMF
  const cxrText = String(d.chestXR || '');
  if (hasText(cxrText, 'ILO 2') || hasText(cxrText, 'ILO 3') || hasText(cxrText, 'PMF')) {
    triggers.push('Pneumokoniosis Lanjut (Merah)');
  }

  // 18. ESS >15
  const fitnessText = String(d.tesKebugaran || '');
  const essMatch = fitnessText.match(/ESS[:\s]*([\d.]+)/i);
  if (essMatch) {
    const ess = parseFloat(essMatch[1]);
    if (ess > 15) {
      triggers.push('ESS Sangat Tinggi >15 (Merah)');
    }
  }

  // 19. Gangguan mental berat
  const otherText = String(d.pemeriksaanLain || '') + ' ' + String(d.dugaanPAK || '');
  if (hasText(otherText, 'psikosis') || hasText(otherText, 'berat dengan risiko') || hasText(otherText, 'tidak patuh terapi')) {
    triggers.push('Gangguan Mental Berat (Merah)');
  }

  // 20. LBP dengan defisit neurologis
  if (hasText(dmText, 'LBP defisit') || hasText(dmText, 'LBP dengan defisit')) {
    triggers.push('LBP dengan Defisit Neurologis (Merah)');
  }

  // ═══════════════════════════════════════════
  // ZONA KUNING CHECKS (only if not Merah)
  // ═══════════════════════════════════════════
  let kuningTriggers: string[] = [];

  if (triggers.length === 0) {
    // 1. Hipertensi Grade 1: 140-159/90-99
    if (tdS !== null && tdD !== null && tdS >= 140 && tdS <= 159 && tdD >= 90 && tdD <= 99) {
      kuningTriggers.push('Hipertensi Grade 1 (Kuning)');
    }

    // 2. Prediabetes: GDP 100-125
    if (gdp !== null && gdp >= 100 && gdp <= 125) {
      kuningTriggers.push('Prediabetes GDP 100-125 (Kuning)');
    }

    // 3. DM terkontrol: HbA1c <7.5% tanpa komplikasi
    if (hba1c !== null && hba1c >= 7 && hba1c < 7.5) {
      kuningTriggers.push('DM Terkontrol HbA1c 7-7.5% (Kuning)');
    }

    // 4. LDL 100-189 (REVISI: mulai dari 100, bukan 130)
    if (ldl !== null && ldl >= 100 && ldl <= 189) {
      kuningTriggers.push('LDL 100-189 mg/dL (Kuning)');
    }

    // 5. TG 200-499
    if (tg !== null && tg >= 200 && tg <= 499) {
      kuningTriggers.push('TG 200-499 mg/dL (Kuning)');
    }

    // 6. CKD G2-G3a: eGFR 45-59
    if (egfr !== null && egfr >= 45 && egfr <= 59) {
      kuningTriggers.push('eGFR 45-59 CKD G2-G3a (Kuning)');
    }

    // 7. Overweight BMI 23-24.9
    if (bmi !== null && bmi >= 23 && bmi <= 24.9) {
      kuningTriggers.push('Overweight BMI 23-24.9 (Kuning)');
    }

    // 8. Obesitas I BMI 25-29.9
    if (bmi !== null && bmi >= 25 && bmi < 30) {
      kuningTriggers.push('Obesitas I BMI 25-29.9 (Kuning)');
    }

    // 9. Obesitas II BMI 30-34.9 tanpa komorbid
    if (bmi !== null && bmi >= 30 && bmi < 35) {
      const hasComorbid = (tdS !== null && tdS >= 140) || (tdD !== null && tdD >= 90) ||
        (hba1c !== null && hba1c >= 7) || (gdp !== null && gdp >= 100) ||
        hasText(spiText, 'OSA') || hasText(spiText, 'OHS') || hasText(spiText, 'asma');
      if (!hasComorbid) {
        kuningTriggers.push('Obesitas II tanpa Komorbid BMI 30-34.9 (Kuning)');
      }
    }

    // 10. Asam urat 7-9
    if (au !== null && au >= 7 && au <= 9) {
      kuningTriggers.push('Asam Urat 7-9 mg/dL (Kuning)');
    }

    // 11. Gangguan paru ringan-sedang
    if (fev1Pct !== null && fev1Pct >= 50 && fev1Pct < 80) {
      kuningTriggers.push('Gangguan Paru Ringan-Sedang (Kuning)');
    }
    if (hasText(spiText, 'ringan') || hasText(spiText, 'mild') || hasText(spiText, 'sedang') || hasText(spiText, 'moderate')) {
      if (!kuningTriggers.some(t => t.includes('Gangguan Paru'))) {
        kuningTriggers.push('Gangguan Spirometri Ringan-Sedang (Kuning)');
      }
    }

    // 12. Anemia ringan
    if (hb !== null) {
      if (isMale && hb >= 11 && hb < 13.5) {
        kuningTriggers.push('Anemia Ringan (Kuning)');
      }
      if (isFemale && hb >= 10 && hb < 12) {
        kuningTriggers.push('Anemia Ringan (Kuning)');
      }
    }

    // 13. Epilepsi terkontrol (6-12 bulan bebas kejang)
    if (hasText(dmText, 'epilepsi terkontrol') && !hasText(dmText, 'epilepsi tidak terkontrol')) {
      kuningTriggers.push('Epilepsi Terkontrol (Kuning)');
    }

    // 14. Gangguan visus ringan-sedang (6/9 - 6/18, not corrected)
    if (!isNA(d.visusJauh) && !hasText(visusText, 'terkoreksi')) {
      const mildVisions = ['6/9', '6/12', '6/18', '20/30', '20/60', '20/100'];
      if (mildVisions.some(v => hasText(visusText, v))) {
        kuningTriggers.push('Gangguan Visus Ringan-Sedang (Kuning)');
      }
    }

    // 15. Gangguan pendengaran ringan (26-40 dB)
    if (!isNA(d.audInterp) && d.audInterp !== 'Normal' && d.audInterp !== 'Normal Audiometry') {
      if (hasText(audText, 'mild') || hasText(audText, 'ringan') || hasText(audText, 'threshold shift')) {
        kuningTriggers.push('Gangguan Pendengaran Ringan (Kuning)');
      }
    }

    // 16. Fungsi hati meningkat: SGOT/SGPT 1.5-3x normal
    if (sgot !== null && sgot >= 40 && sgot <= 120) {
      kuningTriggers.push('SGOT Meningkat (Kuning)');
    }
    if (sgpt !== null && sgpt >= 41 && sgpt <= 123) {
      kuningTriggers.push('SGPT Meningkat (Kuning)');
    }

    // 17. HBsAg Reaktif
    if (d.hbsag === 'Reaktif') {
      kuningTriggers.push('HBsAg Reaktif (Kuning)');
    }

    // 18. Pneumokoniosis ILO 1/0 - 1/1
    if (hasText(cxrText, 'ILO 1/0') || hasText(cxrText, 'ILO 1/1')) {
      kuningTriggers.push('Pneumokoniosis Ringan (Kuning)');
    }

    // 19. ESS 11-15
    if (essMatch) {
      const ess = parseFloat(essMatch[1]);
      if (ess >= 11 && ess <= 15) {
        kuningTriggers.push('ESS 11-15 (Kuning)');
      }
    }

    // 20. Gangguan mental ringan-sedang
    if (hasText(otherText, 'DASS') || hasText(otherText, 'SRQ')) {
      kuningTriggers.push('Gangguan Mental Terkontrol (Kuning)');
    }

    // 21. LBP kronik tanpa defisit neurologis
    if (hasText(dmText, 'LBP kronik') && !hasText(dmText, 'LBP defisit')) {
      kuningTriggers.push('LBP Kronik (Kuning)');
    }
  }

  // ═══════════════════════════════════════════
  // DETERMINE FINAL ZONA
  // ═══════════════════════════════════════════
  if (triggers.length > 0) {
    return {
      zona: 'Merah',
      triggers,
      pengendalian: '• Wajib kontrol dokter spesialis setiap 1 bulan sampai stabil\n• Wajib menyerahkan surat kontrol/clearance\n• Evaluasi ulang status setiap 1 bulan\n• Dapat direkomendasikan penempatan sementara (Currently Unfit)\n• Tidak diperkenankan bekerja di area risiko tinggi (ketinggian, alat berat, confined space, shift malam intensif) sampai dinyatakan stabil',
    };
  }

  if (kuningTriggers.length > 0) {
    return {
      zona: 'Kuning',
      triggers: kuningTriggers,
      pengendalian: '• Wajib kontrol dokter minimal setiap 3 bulan\n• Wajib menyerahkan bukti kontrol ke HO\n• Tidak direkomendasikan bekerja di area risiko tinggi bila kondisi belum stabil\n• Evaluasi ulang status zona setiap 3 bulan\n• Program perbaikan gaya hidup (berat badan, diet, olahraga)\n• Layak kerja dengan monitoring (Fit With Note)',
    };
  }

  return {
    zona: 'Hijau',
    triggers: [],
    pengendalian: '• MCU rutin sesuai jadwal perusahaan (1 tahun sekali atau sesuai kebijakan)\n• Edukasi gaya hidup sehat\n• Layak kerja tanpa pembatasan khusus',
  };
}

// ============================================================
// AUTO-CALCULATION FUNCTIONS
// ============================================================

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

export function calcDiabetes(gdp: number | null, gd2pp: number | null, hba1c: number | null): string {
  if ((gdp !== null && gdp >= 126) || (gd2pp !== null && gd2pp >= 200) || (hba1c !== null && hba1c >= 6.5)) {
    return 'Ya';
  }
  return 'Tidak';
}

export function calcPerluFU(kesVendor: string | undefined, hasAbnormal: boolean): string {
  if (!kesVendor || kesVendor === 'Fit To Work') return 'Tidak';
  return hasAbnormal ? 'Ya' : 'Tidak';
}

// ============================================================
// FRAMINGHAM RISK SCORE
// ============================================================

export function calcFramingham(d: MCUDraft): { score: number; prob: string; kat: string } {
  const age = n(d.usia);
  const chol = n(d.chol);
  const hdl = n(d.hdl);
  const sbp = n(d.tdS);
  const smoking = d.merokok === 'Ya';
  const dm = d.diabetes === 'Ya';
  const isMale = d.jenisKelamin?.toLowerCase().includes('laki');

  if (!age || !chol || hdl === null || !sbp || !d.jenisKelamin) {
    return { score: 0, prob: 'Cek Parameter', kat: 'Cek Parameter' };
  }

  let score = 0;

  if (isMale) {
    // Age points
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

    // Cholesterol points (age-adjusted)
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
    // Female age points
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

    // Female cholesterol points
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

  // HDL points (same for both)
  if (hdl >= 60) score -= 1;
  else if (hdl >= 50) score += 0;
  else if (hdl >= 40) score += 1;
  else score += 2;

  // SBP points
  if (isMale) {
    if (sbp < 120) score += 0; else if (sbp < 130) score += 0; else if (sbp < 140) score += 1; else if (sbp < 160) score += 1; else score += 2;
  } else {
    if (sbp < 120) score += 0; else if (sbp < 130) score += 1; else if (sbp < 140) score += 2; else if (sbp < 160) score += 3; else score += 4;
  }

  // Smoking points
  if (smoking) {
    if (isMale) {
      if (age <= 39) score += 8; else if (age <= 49) score += 5; else if (age <= 59) score += 3; else if (age <= 69) score += 1; else score += 1;
    } else {
      if (age <= 39) score += 9; else if (age <= 49) score += 7; else if (age <= 59) score += 4; else if (age <= 69) score += 2; else score += 1;
    }
  }

  // DM points
  if (dm) score += isMale ? 3 : 5;

  // Convert score to probability
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

  // Parse probability for category
  const probNum = parseFloat(prob.replace(/[<>≥%]/g, ''));
  if (probNum >= 20 || prob.includes('≥30')) kat = 'High Risk';
  else if (probNum >= 10 || prob.includes('20') || prob.includes('25')) kat = 'Intermediate Risk';
  else kat = 'Low Risk';

  return { score, prob: prob ? prob + '%' : '', kat };
}
