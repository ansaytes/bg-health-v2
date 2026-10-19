import { describe, it, expect } from 'vitest';
import {
  applyMCUCalculations,
  buildAutomaticFollowUpRecommendations,
} from '@/lib/mcu-calculations';

const maleBase = {
  jenisKelamin: 'Laki - Laki',
  usia: 40,
};

describe('buildFormulaFollowUp (via applyMCUCalculations.itemFU)', () => {
  it('returns empty itemFU for a fully normal Fit To Work record', () => {
    const result = applyMCUCalculations({
      ...maleBase,
      rekQSHE: 'Fit To Work',
      tdS: 120, tdD: 80, bb: 70, tb: 175, hb: 14.5, hematokrit: 45,
      leukosit: 7, eritrosit: 5, trombosit: 250,
      chol: 150, tg: 100, hdl: 50, ldl: 90,
      gdp: 90, gd2pp: 100, hba1c: 5.4,
      au: 5, ureum: 30, kreatinin: 1.0, sgot: 25, sgpt: 25,
      visusJauh: '6/6', gigiMulut: 'Normal', fisikHeadToToe: 'Normal',
      fisikMata: 'Normal', hemoroid: 'Tidak Ada', defWarna: 'Normal',
      lapangPandang: 'Normal', hbsag: 'Non - Reaktif', vdrl: 'Non - Reaktif',
      tpha: 'Non - Reaktif', hiv: 'Non - Reaktif', chestXR: 'Normal',
      ecgHasil: 'Normal', tmHasil: 'Negative Ischemic Response',
      usg: 'Normal', spiInterp: 'Normal', audInterp: 'Normal',
      tesKebugaran: 'Baik', ul: 'Normal',
    });
    expect(result.itemFU).toBe('');
  });

  it('flags blood pressure above threshold', () => {
    const result = applyMCUCalculations({
      ...maleBase, tdS: 140, tdD: 90,
    });
    expect(result.itemFU).toContain('TD : 140/90 mmHg');
  });

  it('does not flag BP at exactly 130/89 (boundary)', () => {
    const result = applyMCUCalculations({ ...maleBase, tdS: 130, tdD: 89 });
    expect(result.itemFU).not.toContain('TD :');
  });

  it('applies male Hb thresholds (13–16.5)', () => {
    const lowMale = applyMCUCalculations({ ...maleBase, hb: 12.9 });
    expect(lowMale.itemFU).toContain('Hb : 12.9 g/dL');
    const okMale = applyMCUCalculations({ ...maleBase, hb: 13 });
    expect(okMale.itemFU).not.toContain('Hb :');
  });

  it('applies female Hb thresholds (12–15)', () => {
    const femaleBase = { jenisKelamin: 'Perempuan', usia: 40 };
    const lowFemale = applyMCUCalculations({ ...femaleBase, hb: 11.9 });
    expect(lowFemale.itemFU).toContain('Hb : 11.9 g/dL');
    // A value valid for males (13–16.5) is abnormal for females above 15
    const highFemale = applyMCUCalculations({ ...femaleBase, hb: 15.5 });
    expect(highFemale.itemFU).toContain('Hb : 15.5 g/dL');
    const okFemale = applyMCUCalculations({ ...femaleBase, hb: 14.5 });
    expect(okFemale.itemFU).not.toContain('Hb :');
  });

  it('applies gender-specific HDL thresholds (M <40, F <50)', () => {
    const male = applyMCUCalculations({ ...maleBase, hdl: 45, hdl2: undefined });
    expect(male.itemFU).not.toContain('HDL :');
    const maleLow = applyMCUCalculations({ ...maleBase, hdl: 39 });
    expect(maleLow.itemFU).toContain('HDL : 39 mg/dL');
    const femaleLow = applyMCUCalculations({ jenisKelamin: 'Perempuan', usia: 40, hdl: 45 });
    expect(femaleLow.itemFU).toContain('HDL : 45 mg/dL');
  });

  it('applies gender-specific uric acid thresholds (M >7, F >6)', () => {
    const male = applyMCUCalculations({ ...maleBase, au: 7 });
    expect(male.itemFU).not.toContain('AU :');
    const female = applyMCUCalculations({ jenisKelamin: 'Perempuan', usia: 40, au: 6.5 });
    expect(female.itemFU).toContain('AU : 6.5 mg/dL');
  });

  it('flags BMI >= 30 but not below', () => {
    const obese = applyMCUCalculations({ ...maleBase, bmi: 30 });
    expect(obese.itemFU).toContain('BMI : 30');
    const overweight = applyMCUCalculations({ ...maleBase, bmi: 29.9 });
    expect(overweight.itemFU).not.toContain('BMI :');
  });

  it('excludes N/A and DBN values from follow-up', () => {
    const result = applyMCUCalculations({
      ...maleBase,
      gigiMulut: 'N/A', fisikMata: 'DBN', hemoroid: 'Menolak RT',
      ecgHasil: 'Not Performed', chestXR: 'N/A',
    });
    expect(result.itemFU).not.toContain('Orodental');
    expect(result.itemFU).not.toContain('Mata :');
    expect(result.itemFU).toContain('RT : Pemeriksaan Hemoroid Belum Dilakukan');
    expect(result.itemFU).not.toContain('ECG :');
    expect(result.itemFU).not.toContain('CXR :');
  });

  it('excludes treadmill Negative Ischemic Response', () => {
    const result = applyMCUCalculations({ ...maleBase, tmHasil: 'Negative Ischemic Response' });
    expect(result.itemFU).not.toContain('Treadmill :');
  });

  it('flags lipids, glucose and liver enzymes at thresholds', () => {
    const result = applyMCUCalculations({
      ...maleBase,
      chol: 200, tg: 150, ldl: 100, gdp: 100, gd2pp: 140, hba1c: 6.5,
      sgot: 40, sgpt: 41, kreatinin: 1.4, ureum: 48.6,
    });
    for (const marker of ['Chol :', 'TG :', 'LDL :', 'GDP :', 'GD2PP :', 'HbA1c :', 'SGOT :', 'SGPT :', 'Kreatinin :', 'Ureum :']) {
      expect(result.itemFU).toContain(marker);
    }
  });

  it('ignores non-numeric strings gracefully', () => {
    const result = applyMCUCalculations({ ...maleBase, tdS: 'invalid', tdD: '', hb: null });
    expect(result.itemFU).not.toContain('TD :');
    expect(result.itemFU).not.toContain('Hb :');
  });
});

describe('applyMCUCalculations derived fields', () => {
  it('computes BMI, MCHC and spirometry percentages', () => {
    const result = applyMCUCalculations({
      ...maleBase, bb: 70, tb: 175, hb: 15, hematokrit: 45,
      fvcAct: 3, fvcPred: 4, fev1Act: 2.8, fev1Pred: 3.5, fev1FvcPred: 80,
    });
    expect(result.bmi).toBe(22.9);
    expect(result.mchc).toBe(33.3);
    expect(result.fvcPct).toBe(75);
    expect(result.fev1Pct).toBe(80);
    expect(result.fev1FvcAct).toBe(0.93);
    expect(result.fev1FvcPct).toBe(1.2);
  });

  it('sets tglExpired to one year after tglMCU', () => {
    const result = applyMCUCalculations({ ...maleBase, tglMCU: '2026-02-15' });
    expect(result.tglExpired).toBe('2027-02-15');
    const missing = applyMCUCalculations({ ...maleBase, tglMCU: 'not-a-date' });
    expect(missing.tglExpired).toBe('');
  });

  it('classifies diabetes from GDP / GD2PP / HbA1c thresholds', () => {
    expect(applyMCUCalculations({ ...maleBase, gdp: 126 }).diabetes).toBe('Ya');
    expect(applyMCUCalculations({ ...maleBase, gd2pp: 200 }).diabetes).toBe('Ya');
    expect(applyMCUCalculations({ ...maleBase, hba1c: 6.5 }).diabetes).toBe('Ya');
    expect(applyMCUCalculations({ ...maleBase, gdp: 100 }).diabetes).toBe('Tidak');
    expect(applyMCUCalculations({ ...maleBase }).diabetes).toBe('Tidak');
  });

  it('computes PTA from available audiometry frequencies only', () => {
    const all = applyMCUCalculations({ ...maleBase, acr_500: 20, acr_1k: 30, acr_2k: 40, acr_4k: 50 });
    expect(all.pta).toBe(35);
    const partial = applyMCUCalculations({ ...maleBase, acr_500: 10 });
    expect(partial.pta).toBe(10);
    const none = applyMCUCalculations({ ...maleBase });
    expect(none.pta).toBeUndefined();
  });

  it('fills perluFU as Ya only for non-Fit-To-Work with findings', () => {
    const fit = applyMCUCalculations({ ...maleBase, rekQSHE: 'Fit To Work' });
    expect(fit.perluFU).toBe('Tidak');
    const unwell = applyMCUCalculations({ ...maleBase, kesVendor: 'Unfit', tdS: 160, tdD: 100 });
    expect(unwell.perluFU).toBe('Ya');
  });

  it('computes zonasi result with triggers and pengendalian', () => {
    const result = applyMCUCalculations({
      ...maleBase, tdS: 150, tdD: 95, bb: 70, tb: 175,
      gdp: 90, ldl: 90, tg: 100, au: 5, hb: 14,
      fvcPct: 85, fev1FvcAct: 0.8,
      visusJauh: '6/6', pta: 20, sgot: 20, sgpt: 20,
      hbsag: 'Non - Reaktif', chestXR: 'Normal',
      spiInterp: 'Normal', audInterp: 'Normal',
      kreatinin: 1.0, egfr: 95,
    });
    expect(result.zonasi).toBe('Kuning');
    expect(result.triggerZona).toContain('Kuning');
    expect(result.pengendalian).toContain('dokter');
    expect(result.frekuensiEvaluasi).toBe('Setiap 3 bulan');
  });

  it('returns zonasi Belum Lengkap with missing parameter list when inputs are absent', () => {
    const result = applyMCUCalculations({ jenisKelamin: 'Laki - Laki' });
    expect(result.zonasi).toBe('Belum Lengkap');
    expect(result.triggerZona).toBe('');
    expect(String(result.pengendalian)).toContain('Lengkapi parameter zonasi');
  });
});

describe('buildAutomaticFollowUpRecommendations', () => {
  it('recommends Dokter Gigi for orodental findings', () => {
    const recs = buildAutomaticFollowUpRecommendations({ gigiMulut: 'Karies' });
    expect(recs).toContain('Dokter Gigi');
  });

  it('recommends specialists for eye findings', () => {
    const recs = buildAutomaticFollowUpRecommendations({ fisikMata: 'Katarak' });
    expect(recs).toContain('Dokter Sp. M');
  });

  it('recommends Dokter Sp. OT for positive orthopedic tests', () => {
    const recs = buildAutomaticFollowUpRecommendations({ laseque: 'Positif' });
    expect(recs).toContain('Dokter Sp. OT');
  });

  it('recommends Dokter Sp. PD for medical findings in itemFU', () => {
    const recs = buildAutomaticFollowUpRecommendations({ itemFU: 'TD : 150/95 mmHg' });
    expect(recs).toContain('Dokter Sp. PD');
  });

  it('recommends lifestyle advice for BMI >= 25 or lipid findings', () => {
    const recs = buildAutomaticFollowUpRecommendations({ bmi: 27 });
    expect(recs).toContain('Pertahankan Kondisi Tubuh Bugar Dengan Diet Sehat & Rutin Olahraga');
  });

  it('falls back to Dokter Umum when itemFU has unrecognised content', () => {
    const recs = buildAutomaticFollowUpRecommendations({ itemFU: 'Some Other Finding : X' });
    expect(recs).toContain('Dokter Umum');
  });

  it('returns empty for clean record without itemFU', () => {
    const recs = buildAutomaticFollowUpRecommendations({ bmi: 22 });
    expect(recs).toHaveLength(0);
  });
});
