import {
  assessZonasi,
  calcBMI,
  calcDiabetes,
  calcFramingham,
  calcMCHC,
  calcPct,
  calcPTA,
  calcEgfrCkdEpi2021,
} from '@/lib/zonasi-engine';
import { buildDiagnosisList, formatDiagnosis } from '@/lib/mcu-diagnosis';
import { summariseQuestionnaires } from '@/lib/questionnaire-scores';
import { classifyFitnessTest } from '@/lib/clinical-classification';

type MCUValues = Record<string, string | number | null | undefined>;

function numberValue(value: MCUValues[string]) {
  if (value === null || value === undefined || value === '' || value === 'N/A') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function addOneYear(value: MCUValues[string]) {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

function text(value: MCUValues[string]) {
  return value == null ? '' : String(value).trim();
}

function abnormal(value: MCUValues[string], excluded = ['N/A', 'DBN', 'Normal']) {
  const current = text(value);
  if (!current || excluded.some((entry) => entry.toLowerCase() === current.toLowerCase())) return false;
  if (/\bDBN\b|\bNEGATIF\b|\bNON\s*-\s*REAKTIF\b|\bNONREAKTIF\b|\bNORMAL\b/i.test(current)) return false;
  return true;
}

function buildFormulaFollowUp(values: MCUValues) {
  if (text(values.rekQSHE) === 'Fit To Work') return '';
  const items: string[] = [];
  const add = (condition: boolean, value: string) => {
    if (condition) items.push(value);
  };
  const systolic = numberValue(values.tdS);
  const diastolic = numberValue(values.tdD);
  const bmi = numberValue(values.bmi);
  const hb = numberValue(values.hb);
  const leukosit = numberValue(values.leukosit);
  const eritrosit = numberValue(values.eritrosit);
  const hematokrit = numberValue(values.hematokrit);
  const trombosit = numberValue(values.trombosit);
  const chol = numberValue(values.chol);
  const tg = numberValue(values.tg);
  const hdl = numberValue(values.hdl);
  const ldl = numberValue(values.ldl);
  const gdp = numberValue(values.gdp);
  const gd2pp = numberValue(values.gd2pp);
  const hba1c = numberValue(values.hba1c);
  const au = numberValue(values.au);
  const ureum = numberValue(values.ureum);
  const kreatinin = numberValue(values.kreatinin);
  const sgot = numberValue(values.sgot);
  const sgpt = numberValue(values.sgpt);
  const gender = text(values.jenisKelamin);
  const visus = text(values.visusJauh);

  add(abnormal(values.gigiMulut), `Orodental : ${text(values.gigiMulut)}`);
  add(abnormal(values.fisikHeadToToe), `Fisik : ${text(values.fisikHeadToToe)}`);
  add(abnormal(values.hemoroid), /Menolak RT|N\/A/.test(text(values.hemoroid))
    ? 'RT : Pemeriksaan Hemoroid Belum Dilakukan' : `RT : ${text(values.hemoroid)}`);
  add(abnormal(values.fisikMata), `Mata : ${text(values.fisikMata)}`);
  add(/\d+\/\d+/.test(visus) && !/6\/6|5\/5|20\/20|Koreksi/i.test(visus), `Visus Jauh : ${visus}`);
  add(abnormal(values.visusDekat, ['N/A']) && !/6\/6|5\/5|20\/20|J1|Koreksi/i.test(text(values.visusDekat)), `Visus Dekat : ${text(values.visusDekat)}`);
  add(Boolean(values.defWarna && !['Normal', 'N/A'].includes(text(values.defWarna))), `Defisiensi Persepsi Warna : ${text(values.defWarna)}`);
  add(abnormal(values.lapangPandang), `Lapang Pandang : ${text(values.lapangPandang)}`);
  add(systolic !== null && diastolic !== null && (systolic > 130 || diastolic > 89), `TD : ${systolic}/${diastolic} mmHg`);
  add(bmi !== null && bmi >= 30, `BMI : ${bmi}`);
  add(hb !== null && ((gender === 'Laki - Laki' && (hb < 13 || hb > 16.5)) || (gender === 'Perempuan' && (hb < 12 || hb > 15))), `Hb : ${text(values.hb)} g/dL`);
  add(leukosit !== null && (leukosit > 11 || leukosit < 4), `Leukosit : ${text(values.leukosit)} 10³/µL`);
  add(eritrosit !== null && (eritrosit > 6.2 || eritrosit < 4.5), `Eritrosit : ${text(values.eritrosit)} 10⁶/µL`);
  add(hematokrit !== null && (hematokrit > 54 || hematokrit < 40), `Hematokrit : ${text(values.hematokrit)} %`);
  add(trombosit !== null && (trombosit > 400 || trombosit < 150), `Trombosit : ${text(values.trombosit)} 10³/µL`);
  add(chol !== null && chol >= 200, `Chol : ${text(values.chol)} mg/dL`);
  add(tg !== null && tg >= 150, `TG : ${text(values.tg)} mg/dL`);
  add(hdl !== null && ((gender === 'Laki - Laki' && hdl < 40) || (gender === 'Perempuan' && hdl < 50)), `HDL : ${text(values.hdl)} mg/dL`);
  add(ldl !== null && ldl >= 100, `LDL : ${text(values.ldl)} mg/dL`);
  add(gdp !== null && gdp >= 100, `GDP : ${text(values.gdp)} mg/dL`);
  add(gd2pp !== null && gd2pp >= 140, `GD2PP : ${text(values.gd2pp)} mg/dL`);
  add(hba1c !== null && hba1c >= 6.5, `HbA1c : ${text(values.hba1c)} %`);
  add(au !== null && ((gender === 'Laki - Laki' && au > 7) || (gender === 'Perempuan' && au > 6)), `AU : ${text(values.au)} mg/dL`);
  add(ureum !== null && ureum > 48.5, `Ureum : ${text(values.ureum)} mg/dL`);
  add(kreatinin !== null && kreatinin >= 1.4, `Kreatinin : ${text(values.kreatinin)} mg/dL`);
  add(sgot !== null && sgot >= 40, `SGOT : ${text(values.sgot)} U/L`);
  add(sgpt !== null && sgpt >= 41, `SGPT : ${text(values.sgpt)} U/L`);
  add(abnormal(values.ul), `UL : ${text(values.ul)}`);
  add(abnormal(values.hbsag, ['N/A', 'Non - Reaktif']), `HbsAg : ${text(values.hbsag)}`);
  add(abnormal(values.vdrl, ['N/A', 'Non - Reaktif']), `VDRL : ${text(values.vdrl)}`);
  add(abnormal(values.tpha, ['N/A', 'Non - Reaktif']), `TPHA : ${text(values.tpha)}`);
  add(abnormal(values.hiv, ['N/A', 'Non - Reaktif']), `HIV : ${text(values.hiv)}`);
  add(abnormal(values.chestXR), `CXR : Kesan ${text(values.chestXR)}`);
  add(abnormal(values.lumboXR), `Lumbosacral XR : ${text(values.lumboXR)}`);
  // EKG dan treadmill memakai dropdown, jadi nilai "normal" di sini
  // mengikuti daftar opsi, bukan tebakan. "Normal ..." sudah otomatis
  // tertangani aturan \bNORMAL\b di abnormal(), tapi "Not Performed" dan
  // "Negative Ischemic Response" tidak mengandung kata itu, sehingga
  // harus dikecualikan secara eksplisit supaya pemeriksaan yang normal
  // atau tidak dilakukan tidak masuk daftar follow-up.
  add(abnormal(values.ecgHasil, ['N/A', 'DBN', 'Not Performed']), `ECG : ${text(values.ecgHasil)}`);
  add(
    abnormal(values.tmHasil, ['N/A', 'DBN', 'Not Performed', 'Negative Ischemic Response']),
    `Treadmill : ${text(values.tmHasil)}`,
  );
  add(abnormal(values.usg), `USG : ${text(values.usg)}`);
  add(abnormal(values.spiInterp, ['N/A', 'Normal']), `Spirometry : ${text(values.spiInterp)}`);
  add(abnormal(values.audInterp, ['N/A', 'Normal', 'Normal Audiometry']), `Audiometry : ${text(values.audInterp)}`);
  add(/Kurang|Buruk/i.test(text(values.tesKebugaran)), `Uji Kebugaran : ${text(values.tesKebugaran)}`);
  return items.join(', ');
}

export function buildAutomaticFollowUpRecommendations(values: MCUValues): string[] {
  const itemFU = text(values.itemFU);
  const recommendations = new Set<string>();
  const addIf = (condition: boolean, recommendation: string) => {
    if (condition) recommendations.add(recommendation);
  };
  const hemoroid = text(values.hemoroid);
  const bmi = numberValue(values.bmi) ?? calcBMI(numberValue(values.bb), numberValue(values.tb));
  const hasOrodental = abnormal(values.gigiMulut);
  const hasEyeFinding = abnormal(values.fisikMata)
    || abnormal(values.visusJauh, ['N/A'])
    || abnormal(values.visusDekat, ['N/A'])
    || (text(values.defWarna) && !['Normal', 'N/A'].includes(text(values.defWarna)))
    || abnormal(values.lapangPandang);
  const hasPositiveOrthoTest = ['patrick', 'kontraPatrick', 'laseque', 'phalen', 'thinel']
    .some((field) => /positif|positive/i.test(text(values[field])));
  const hasMedicalFinding = [
    'tdS', 'tdD', 'hb', 'leukosit', 'eritrosit', 'hematokrit', 'trombosit',
    'chol', 'tg', 'hdl', 'ldl', 'gdp', 'gd2pp', 'hba1c', 'au', 'ureum',
    'kreatinin', 'egfr', 'sgot', 'sgpt', 'ggt', 'alp', 'billirubin',
  ].some((field) => itemFU.toLowerCase().includes(field.toLowerCase()))
    || /TD\s*:|BMI\s*:|HbA1c|HbsAg|VDRL|TPHA|HIV|CXR|Lumbosacral|ECG|Treadmill|Spirometry|Audiometry/i.test(itemFU);

  addIf(hasOrodental || /Orodental/i.test(itemFU), 'Dokter Gigi');
  addIf(/menolak rt|belum dilakukan/i.test(hemoroid) || /Pemeriksaan Hemoroid Belum Dilakukan/i.test(itemFU), 'Dokter Umum');
  addIf(/positif/i.test(hemoroid) || /RT\s*:\s*Positif/i.test(itemFU), 'Dokter Sp. B');
  addIf(hasEyeFinding || /Visus|Defisiensi Persepsi Warna|Mata\s*:/i.test(itemFU), 'Dokter Sp. M');
  addIf(hasPositiveOrthoTest, 'Dokter Sp. OT');
  addIf(hasMedicalFinding, 'Dokter Sp. PD');
  addIf(bmi !== null && bmi >= 25 || /BMI\s*:|Chol\s*:|TG\s*:|LDL\s*:/i.test(itemFU),
    'Pertahankan Kondisi Tubuh Bugar Dengan Diet Sehat & Rutin Olahraga');

  if (itemFU && recommendations.size === 0) recommendations.add('Dokter Umum');
  return [...recommendations];
}

/** Merapikan rekomendasi dokter berulang menjadi satu kalimat yang ringkas. */
function compactFollowUpRecommendation(value: unknown): string {
  const parts = String(value ?? '').split(/[,;\n]+/).map(part => part.trim()).filter(Boolean);
  const specialistPrefix = /^Konsultasi dan terapi ke\s+/i;
  const specialists = parts.filter(part => specialistPrefix.test(part)).map(part => part.replace(specialistPrefix, '').replace(/[.]+$/, ''));
  if (specialists.length < 2) return String(value ?? '').trim();
  const unique = [...new Set(specialists)];
  return `Konsultasi dan terapi ke ${unique.join(', ')}`;
}

/**
 * Applies the calculated columns before persistence. These are the
 * database-side equivalents of the formula columns maintained by the
 * Excel/Google Sheet.
 */
export function applyMCUCalculations(values: MCUValues): MCUValues {
  const result = { ...values };
  const bb = numberValue(result.bb);
  const tb = numberValue(result.tb);
  const hb = numberValue(result.hb);
  const hematokrit = numberValue(result.hematokrit);
  const fvcAct = numberValue(result.fvcAct);
  const fvcPred = numberValue(result.fvcPred);
  const fev1Act = numberValue(result.fev1Act);
  const fev1Pred = numberValue(result.fev1Pred);
  const fev1FvcPred = numberValue(result.fev1FvcPred);

  const bmi = calcBMI(bb, tb);
  if (bmi !== null) result.bmi = bmi;
  const mchc = calcMCHC(hb, hematokrit);
  if (mchc !== null) result.mchc = mchc;
  const fvcPct = calcPct(fvcAct, fvcPred);
  if (fvcPct !== null) result.fvcPct = fvcPct;
  const fev1Pct = calcPct(fev1Act, fev1Pred);
  if (fev1Pct !== null) result.fev1Pct = fev1Pct;

  const fev1FvcAct = fvcAct && fev1Act ? Number((fev1Act / fvcAct).toFixed(2)) : null;
  if (fev1FvcAct !== null) result.fev1FvcAct = fev1FvcAct;
  const fev1FvcPct = calcPct(fev1FvcAct, fev1FvcPred);
  if (fev1FvcPct !== null) result.fev1FvcPct = fev1FvcPct;

  // PTA = rata-rata ambang dengar 500/1000/2000/4000 Hz (rumus WHO).
  // Angka inilah yang dipakai klasifikasi NIHL pada STD-006, sehingga zona
  // tidak lagi bergantung pada teks interpretasi audiometri.
  const pta = calcPTA([
    numberValue(result.acr_500), numberValue(result.acr_1k),
    numberValue(result.acr_2k), numberValue(result.acr_4k),
  ]);
  if (pta !== null) result.pta = pta;

  result.diabetes = calcDiabetes(
    numberValue(result.gdp),
    numberValue(result.gd2pp),
    numberValue(result.hba1c),
  );
  result.tglExpired = addOneYear(result.tglMCU);

  // eGFR: pakai nilai laboratorium bila tersedia, kalau kosong hitung sendiri
  // dengan CKD-EPI 2021 (src/lib/zonasi-engine.ts). Tanpa ini, zonasi akan
  // berbalik ke "Belum Lengkap" padahal kreatinin dan usia sudah tersedia.
  //
  // WAJIB DIHITUNG SEBELUM diagnosa. Dulu baris ini berada di bawah
  // buildDiagnosisList, sehingga record yang eGFR-nya belum ada di Excel
  // tetap membangun diagnosis tanpa temuan ginjal: CKD Stage G3a/G5
  // hilang dari diagnosa_medis CSV import, padahal engine yang dijalankan
  // di atas record yang sama akan menemukannya.
  const egfr = numberValue(result.egfr)
    ?? calcEgfrCkdEpi2021(result.kreatinin ?? undefined, result.usia ?? undefined, String(result.jenisKelamin || ''));
  if (egfr !== null) result.egfr = egfr;

  // Diagnosa medis dihitung otomatis dari seluruh temuan, memakai istilah
  // diagnosis bahasa Inggris hasil klasifikasi SOP (tanpa kode ICD-10).
  // Nilai lama dari Excel sengaja dikosongkan oleh pipeline import agar
  // tidak ikut dipertahankan (lihat scripts/lib/mcu-calc-bridge.mjs).
  const diagnosisEntries = buildDiagnosisList(result);
  if (!text(result.diagnosaMedis)) {
    result.diagnosaMedis = formatDiagnosis(diagnosisEntries);
  }
  const findings = diagnosisEntries.map((entry) => entry.diagnosis);

  // DK is formula-driven in the spreadsheet. It remains empty for Fit To Work.
  result.itemFU = buildFormulaFollowUp(result);
  // DI is a Ya/Tidak dropdown in the workbook, so preserve an extracted/manual value.
  if (!text(result.perluFU)) {
    result.perluFU = text(result.kesVendor) && text(result.kesVendor) !== 'Fit To Work' && findings.length > 0 ? 'Ya' : 'Tidak';
  }
  if (text(result.rekFU)) result.rekFU = compactFollowUpRecommendation(result.rekFU);

  const calculationInput: Record<string, string | number | undefined> = {};
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'string' || typeof value === 'number') {
      calculationInput[key] = value;
    }
  }
  calculationInput.egfr = egfr ?? undefined;
  const framingham = calcFramingham(calculationInput);
  result.framScore = framingham.score;
  result.framProb = String(framingham.prob).replace(/%+/g, '%');
  result.framKat = framingham.kat;

  const zonasi = assessZonasi(calculationInput, String(result.jenisKelamin || ''));
  result.zonasi = zonasi.zona;
  result.triggerZona = zonasi.triggers.join(' | ');
  result.pengendalian = zonasi.pengendalian;
  result.frekuensiEvaluasi = zonasi.frekuensiEvaluasi;
  result.catatanSOP = zonasi.catatanSOP.join(' | ');

  // Ringkasan parameter kuesioner, ditulis ke kolom catatan agar mudah
  // dibaca QSHE Medic tanpa membuka tabel kuesioner.
  const questionnaire = summariseQuestionnaires({
    essScore: numberValue(result.essScore),
    srq20Score: numberValue(result.srq20Score),
    dassDepresi: numberValue(result.dassDepresi),
    dassCemas: numberValue(result.dassCemas),
    dassStres: numberValue(result.dassStres),
    sdsScore: numberValue(result.sdsScore),
  });
  if (questionnaire) result.ringkasanKuesioner = questionnaire;

  // Uji kebugaran fisik (6MWT / Harvard Step Test) BUKAN parameter zonasi
  // menurut SOP, tapi tetap perlu tercatat pada diagnosis.
  const fitness = classifyFitnessTest(text(result.tesKebugaran));
  if (fitness) result.hasilKebugaran = `${fitness.label} (${fitness.detail})`;

  return result;
}
