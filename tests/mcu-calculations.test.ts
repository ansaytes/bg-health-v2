import { describe, it, expect } from 'vitest';
import {
  applyMCUCalculations,
  buildAutomaticFollowUpRecommendations,
} from '@/lib/mcu-calculations';
import { MCU_FIELDS, buildUlComposite, parseUlToParams } from '@/lib/mcu-fields';
import { interpretAudiometry, interpretSpirometry } from '@/lib/clinical-classification';

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
    expect(result.ecgHasil).toBe('Normal Sinus Rhythm');
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

  it('flags overweight and obesity separately', () => {
    const obese = applyMCUCalculations({ ...maleBase, bmi: 30 });
    expect(obese.itemFU).toContain('BMI : 30');
    const overweight = applyMCUCalculations({ ...maleBase, bmi: 29.9 });
    expect(overweight.itemFU).toContain('BMI : 29.9 (Overweight)');
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

  it('keeps right and left eye vision distinct when calculating follow-up', () => {
    const result = applyMCUCalculations({
      ...maleBase,
      visusJauh: 'VOD: 20/20 | VOS: 20/400',
    });
    expect(result.itemFU).toContain('Visus Jauh');
  });

  it('flags explicit abnormal urinalysis parameters without treating normal lines as abnormal', () => {
    const normal = applyMCUCalculations({
      ...maleBase,
      ul: 'Warna: Kuning\nKejernihan: Jernih\nProtein: Negatif\nDarah: Negatif',
    });
    expect(normal.itemFU).not.toContain('UL :');

    const abnormal = applyMCUCalculations({
      ...maleBase,
      ul: 'Warna: Kuning\nProtein: Negatif\nDarah: 1+',
    });
    expect(abnormal.itemFU).toContain('UL :');
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
    expect(applyMCUCalculations({ ...maleBase }).diabetes).toBeNull();
  });

  it('PTA = rata-rata 4 frekuensi telinga yang lebih baik (STD/033 6.4)', () => {
    const both = applyMCUCalculations({
      ...maleBase,
      acr_500: 20, acr_1k: 30, acr_2k: 40, acr_4k: 50, // kanan 35
      acl_500: 10, acl_1k: 10, acl_2k: 20, acl_4k: 30, // kiri 17,5 → dibulatkan 18
    });
    expect(both.pta).toBe(18);
    const rightOnly = applyMCUCalculations({ ...maleBase, acr_500: 20, acr_1k: 30, acr_2k: 40, acr_4k: 50 });
    expect(rightOnly.pta).toBe(35);
    // Telinga yang frekuensinya belum lengkap tidak dihitung.
    const incomplete = applyMCUCalculations({ ...maleBase, acr_500: 10 });
    expect(incomplete.pta).toBeUndefined();
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

  it('does not recommend the healthy lifestyle option for abnormal results', () => {
    const recs = buildAutomaticFollowUpRecommendations({ bmi: 27 });
    expect(recs).not.toContain('Pertahankan Kondisi Tubuh Bugar Dengan Diet Sehat & Rutin Olahraga');
  });

  it('falls back to Dokter Umum when itemFU has unrecognised content', () => {
    const recs = buildAutomaticFollowUpRecommendations({ itemFU: 'Some Other Finding : X' });
    expect(recs).toContain('Dokter Umum');
  });

  it('recommends healthy lifestyle for a normal assessed result, not for an empty form', () => {
    const recs = buildAutomaticFollowUpRecommendations({ bmi: 22 });
    expect(recs).toContain('Pertahankan Kondisi Tubuh Bugar Dengan Diet Sehat & Rutin Olahraga');
    expect(buildAutomaticFollowUpRecommendations({})).toHaveLength(0);
  });

  it('uses the canonical ECG normal value and omits N/A dropdown values', () => {
    const ecg = MCU_FIELDS.find((field) => field.id === 'ecgHasil');
    expect(ecg?.options).toContain('Normal Sinus Rhythm');
    expect(ecg?.options).not.toContain('Normal');
    expect(MCU_FIELDS.filter((field) => field.type === 'select')
      .some((field) => field.options?.includes('N/A'))).toBe(false);
  });
});

describe('urinalisis per parameter', () => {
  // 15 parameter kualitatif memakai dropdown; 4 parameter ber-nilai ANGKA
  // memakai teks bebas supaya hasil di luar rentang alat ukur tetap tercatat.
  const SELECT_IDS = [
    'ulWarna', 'ulKejernihan', 'ulBau', 'ulProtein', 'ulGlukosa', 'ulKeton',
    'ulDarah', 'ulLeukositEsterase', 'ulNitrit', 'ulBilirubin',
    'ulUrobilinogen', 'ulSelEpitel', 'ulSilinder', 'ulKristal', 'ulBakteri',
    'ulJamur',
  ];
  const TEXT_IDS = ['ulBeratJenis', 'ulPh', 'ulEritrosit', 'ulLeukosit'];

  it('exposes 20 individual urinalysis fields', () => {
    expect(SELECT_IDS).toHaveLength(16);
    expect(TEXT_IDS).toHaveLength(4);
    expect([...SELECT_IDS, ...TEXT_IDS]).toHaveLength(20);
    for (const id of SELECT_IDS) {
      const field = MCU_FIELDS.find((entry) => entry.id === id);
      expect(field, `field ${id} harus ada`).toBeDefined();
      expect(field!.type).toBe('select');
      expect(field!.options?.length).toBeGreaterThan(0);
    }
    for (const id of TEXT_IDS) {
      const field = MCU_FIELDS.find((entry) => entry.id === id);
      expect(field, `field ${id} harus ada`).toBeDefined();
      expect(field!.type).toBe('text');
      expect(field!.normalRange).toBeTruthy();
    }
  });

  it('builds the ul conclusion from ABNORMAL parameters only', () => {
    // Warna normal tidak ikut ditulis; hanya temuan yang masuk kesimpulan.
    expect(buildUlComposite({ ulWarna: 'Kuning Muda', ulProtein: '+1' }))
      .toBe('Protein: +1');
    // Semua normal tetapi diperiksa -> dinyatakan dalam batas normal.
    expect(buildUlComposite({ ulWarna: 'Kuning Muda', ulProtein: 'Negatif' }))
      .toBe('Dalam batas normal');
    // Tidak ada yang diperiksa -> kosong (NULL).
    expect(buildUlComposite({})).toBe('');
  });

  it('parses a legacy composite ul value into per-parameter fields', () => {
    const parsed = parseUlToParams('Warna: Kuning Muda\nProtein / Albumin: +2\nNitrit: Positif');
    expect(parsed.ulWarna).toBe('Kuning Muda');
    expect(parsed.ulProtein).toBe('+2');
    expect(parsed.ulNitrit).toBe('Positif');
  });

  it('detects abnormal per-parameter urinalysis and stays quiet for normal values', () => {
    const normal = applyMCUCalculations({
      ...maleBase,
      ulWarna: 'Kuning Muda', ulKejernihan: 'Jernih', ulBau: 'Aromatik',
      ulBeratJenis: '1.015', ulPh: '6.0', ulProtein: 'Negatif',
      ulGlukosa: 'Negatif', ulKeton: 'Negatif', ulDarah: 'Negatif',
      ulLeukositEsterase: 'Negatif', ulNitrit: 'Negatif',
      ulBilirubin: 'Negatif', ulUrobilinogen: 'Normal',
      ulEritrosit: '0-1', ulLeukosit: '1-2', ulSelEpitel: 'Sedikit',
      ulSilinder: 'Negatif', ulKristal: 'Negatif', ulBakteri: 'Negatif',
    });
    expect(normal.itemFU).not.toContain('UL :');

    const abnormal = applyMCUCalculations({ ...maleBase, ulProtein: '+2' });
    expect(abnormal.itemFU).toContain('UL :');
    expect(abnormal.ul).toContain('Protein: +2');
  });

  it('accepts sediment values with or without unit, using the highest number in a range', () => {
    // Tanpa satuan, dalam batas normal.
    expect(applyMCUCalculations({ ...maleBase, ulEritrosit: '0-2' }).itemFU).not.toContain('UL :');
    // Dengan satuan, dalam batas normal.
    expect(applyMCUCalculations({ ...maleBase, ulEritrosit: '0-2 /HPF' }).itemFU).not.toContain('UL :');
    // Angka tunggal.
    expect(applyMCUCalculations({ ...maleBase, ulEritrosit: '1' }).itemFU).not.toContain('UL :');
    // Rentang melebihi normal (batas atas 2) -> abnormal.
    expect(applyMCUCalculations({ ...maleBase, ulEritrosit: '3-5' }).itemFU).toContain('UL :');
    expect(applyMCUCalculations({ ...maleBase, ulEritrosit: '0-5 /HPF' }).itemFU).toContain('UL :');
    // WBC batas atas 5.
    expect(applyMCUCalculations({ ...maleBase, ulLeukosit: '0-5' }).itemFU).not.toContain('UL :');
    expect(applyMCUCalculations({ ...maleBase, ulLeukosit: '6-10' }).itemFU).toContain('UL :');
  });

  it('keeps a manual composite ul when no per-parameter value is present', () => {
    const legacy = applyMCUCalculations({ ...maleBase, ul: 'Warna: Kuning\nDarah: 1+' });
    expect(legacy.ul).toBe('Warna: Kuning\nDarah: 1+');
    expect(legacy.itemFU).toContain('UL :');
  });
});


describe('interpretSpirometry', () => {
  it('normal bila FVC & FEV1 ≥80% dan rasio ≥70%', () => {
    const text = interpretSpirometry({ fvcPct: '95', fev1Pct: '92', fev1FvcAct: '0,85' });
    expect(text).toMatch(/^Normal/);
  });

  it('obstruksi bila rasio <70%, dengan derajat dari FEV1', () => {
    const text = interpretSpirometry({ fvcPct: '85', fev1Pct: '60', fev1FvcAct: '0.62' });
    expect(text).toMatch(/^Obstruksi sedang/);
    expect(text).not.toMatch(/normal/i); // kata "normal" akan membuat abnormal() menganggapnya normal
  });

  it('suspek restriksi bila FVC rendah dengan rasio baik', () => {
    const text = interpretSpirometry({ fvcPct: '65', fev1Pct: '70', fev1FvcAct: '0,84' });
    expect(text).toMatch(/restriksi/i);
    expect(text).not.toMatch(/normal/i);
  });

  it('campuran bila rasio rendah dan FVC rendah', () => {
    const text = interpretSpirometry({ fvcPct: '60', fev1Pct: '45', fev1FvcAct: '0,60' });
    expect(text).toMatch(/obstruksi/i);
    expect(text).toMatch(/restriksi/i);
  });

  it('kosong bila belum ada data, atau metode Manual', () => {
    expect(interpretSpirometry({})).toBe('');
    expect(interpretSpirometry({ spiMetode: 'Manual (tulis sendiri)', fvcPct: '60', fev1Pct: '50', fev1FvcAct: '0,6' })).toBe('');
  });
});

describe('interpretAudiometry', () => {
  const normalEar = (side: 'acr' | 'acl') => ({
    [`${side}_500`]: '10', [`${side}_1k`]: '10', [`${side}_2k`]: '15', [`${side}_3k`]: '15',
    [`${side}_4k`]: '15', [`${side}_6k`]: '10', [`${side}_8k`]: '10',
  });

  it('normal bila PTA ≤25 dB di kedua telinga', () => {
    expect(interpretAudiometry({ ...normalEar('acr'), ...normalEar('acl') })).toMatch(/^Normal/);
  });

  it('mendeteksi gangguan dengar dan takik 4 kHz', () => {
    const text = interpretAudiometry({
      ...normalEar('acr'),
      acl_500: '15', acl_1k: '15', acl_2k: '20', acl_3k: '40', acl_4k: '60', acl_6k: '45', acl_8k: '20',
    });
    expect(text).toMatch(/takik/i);
    expect(text).toMatch(/kiri/i);
    expect(text).not.toMatch(/normal/i);
  });

  it('kosong bila keempat frekuensi PTA belum lengkap', () => {
    expect(interpretAudiometry({ acr_500: '10', acr_1k: '10', acr_2k: '10' })).toBe('');
  });
});

describe('interpretasi terhubung ke engine kalkulasi', () => {
  it('abnormal spirometri masuk diagnosis/follow up', () => {
    const result = applyMCUCalculations({
      jenisKelamin: 'Laki - Laki', usia: 45,
      fvcAct: '3.0', fvcPred: '4.0', fev1Act: '1.5', fev1Pred: '3.2',
    }) as Record<string, unknown>;
    expect(String(result.spiInterp ?? '')).toMatch(/obstruksi/i);
  });
});

describe('diagnosisHati (saran otomatis dari SGOT/SGPT/HBsAg)', () => {
  const base = { jenisKelamin: 'Laki - Laki', usia: 40 };

  it('fungsi hati normal → "Normal / Tidak Ada"', () => {
    const r = applyMCUCalculations({ ...base, sgot: 25, sgpt: 30, hbsag: 'Non - Reaktif' }) as Record<string, unknown>;
    expect(r.diagnosisHati).toBe('Normal / Tidak Ada');
  });

  it('enzim >3× ULN (SGOT 121 > 120) → gangguan kronis/aktif', () => {
    const r = applyMCUCalculations({ ...base, sgot: 121, sgpt: 30, hbsag: 'Non - Reaktif' }) as Record<string, unknown>;
    expect(r.diagnosisHati).toBe('Hepatitis Aktif / Sirosis / Gangguan Fungsi Hati Kronis');
  });

  it('HBsAg reaktif + enzim normal → carrier sehat', () => {
    const r = applyMCUCalculations({ ...base, sgot: 30, sgpt: 35, hbsag: 'Reaktif' }) as Record<string, unknown>;
    expect(r.diagnosisHati).toBe('Inaktif / Carrier Sehat (Fungsi Hati Normal)');
  });

  it('HBsAg reaktif + SGPT >3× ULN (125 > 123) → prioritas gangguan kronis', () => {
    const r = applyMCUCalculations({ ...base, sgot: 30, sgpt: 125, hbsag: 'Reaktif' }) as Record<string, unknown>;
    expect(r.diagnosisHati).toBe('Hepatitis Aktif / Sirosis / Gangguan Fungsi Hati Kronis');
  });

  it('isi manual operator tidak ditimpa', () => {
    const r = applyMCUCalculations({ ...base, sgot: 25, sgpt: 30, hbsag: 'Non - Reaktif', diagnosisHati: 'Hepatitis Aktif / Sirosis / Gangguan Fungsi Hati Kronis' }) as Record<string, unknown>;
    expect(r.diagnosisHati).toBe('Hepatitis Aktif / Sirosis / Gangguan Fungsi Hati Kronis');
  });

  it('tanpa input lab → field tetap kosong (pengisian manual)', () => {
    const r = applyMCUCalculations(base) as Record<string, unknown>;
    expect(r.diagnosisHati ?? '').toBe('');
  });
});
