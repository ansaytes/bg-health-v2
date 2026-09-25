import {
  assessZonasi,
  calcBMI,
  calcDiabetes,
  calcFramingham,
  calcMCHC,
  calcPct,
} from '@/lib/zonasi-engine';

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
  return current !== '' && !excluded.includes(current);
}

function buildClinicalSummary(values: MCUValues) {
  const findings: string[] = [];
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
  const ldl = numberValue(values.ldl);
  const hdl = numberValue(values.hdl);
  const gdp = numberValue(values.gdp);
  const au = numberValue(values.au);
  const ureum = numberValue(values.ureum);
  const kreatinin = numberValue(values.kreatinin);
  const ggt = numberValue(values.ggt);
  const alp = numberValue(values.alp);
  const billirubin = numberValue(values.billirubin);
  const psa = numberValue(values.psa);
  const gd2pp = numberValue(values.gd2pp);
  const hba1c = numberValue(values.hba1c);
  const gender = text(values.jenisKelamin);

  if (abnormal(values.gigiMulut)) findings.push(text(values.gigiMulut));
  if (abnormal(values.fisikHeadToToe)) findings.push(text(values.fisikHeadToToe));
  if (abnormal(values.hemoroid)) findings.push(text(values.hemoroid).match(/Menolak RT|N\/A/) ? 'Pemeriksaan Hemoroid Belum Dilakukan' : text(values.hemoroid));
  if (abnormal(values.fisikMata)) findings.push(text(values.fisikMata));
  if (abnormal(values.visusJauh, ['N/A']) && !/6\/6|5\/5|20\/20|Koreksi/i.test(text(values.visusJauh))) findings.push('Visual Impairment');
  if (abnormal(values.visusDekat, ['N/A']) && !/6\/6|5\/5|20\/20|J1|Koreksi/i.test(text(values.visusDekat))) findings.push('Visual Impairment (Near)');
  if (text(values.defWarna) && !['Normal', 'N/A'].includes(text(values.defWarna))) findings.push('Color Vision Deficiency');
  if (abnormal(values.lapangPandang)) findings.push('Visual Field Defect');
  if (systolic !== null && diastolic !== null) {
    if (systolic >= 180 || diastolic >= 120) findings.push('Hypertensive Crisis');
    else if (systolic >= 160 || diastolic >= 100) findings.push('Uncontrolled Hypertension');
    else if (systolic >= 140 || diastolic >= 90) findings.push('Hypertension Stage 2');
    else if (systolic >= 130 || diastolic >= 80) findings.push('Hypertension Stage 1');
    else if (systolic >= 120 && systolic <= 129 && diastolic < 80) findings.push('Elevated Blood Pressure');
  }
  if (bmi !== null && bmi >= 25) findings.push(bmi >= 35 ? 'Obesitas II' : bmi >= 30 ? 'Obesitas I' : 'Overweight');
  if (hb !== null && (hb > 16.5 || hb < 12)) findings.push(hb > 16.5 ? 'Polisitemia (Hb High)' : 'Anemia');
  if (leukosit !== null && (leukosit > 11 || leukosit < 4)) findings.push(leukosit > 11 ? 'Leukositosis' : 'Leukopenia');
  if (eritrosit !== null && hematokrit !== null && (eritrosit > 6.2 || hematokrit > 54)) findings.push('Polisitemia');
  if (trombosit !== null && (trombosit > 400 || trombosit < 150)) findings.push(trombosit > 400 ? 'Trombositosis' : 'Trombositopenia');
  if (chol !== null && chol >= 200) findings.push('Hypercholesterolemia');
  if (tg !== null && tg >= 150) findings.push('Hypertriglyceridemia');
  if (ldl !== null && ldl >= 100) findings.push('Elevated LDL');
  if (hdl !== null && ((gender.includes('Laki') && hdl < 40) || (gender.includes('Perempuan') && hdl < 50))) findings.push('Low HDL');
  if ((gdp !== null && gdp >= 126) || (gd2pp !== null && gd2pp >= 200) || (hba1c !== null && hba1c >= 6.5)) findings.push('Diabetes Mellitus');
  if (gdp !== null && gdp >= 100 && gdp <= 125) findings.push('Prediabetes');
  if (au !== null && ((gender.includes('Laki') && au > 7) || (gender.includes('Perempuan') && au > 6))) findings.push('Hyperuricemia');
  if (ureum !== null && ureum > 48.5) findings.push('Azotemia');
  if (kreatinin !== null && kreatinin >= 40) findings.push('Renal Impairment');
  if (ggt !== null && ggt >= 61) findings.push('Cholestasis (GGT High)');
  if (alp !== null && alp >= 147) findings.push('Cholestasis (ALP High)');
  if (billirubin !== null && billirubin > 1.2) findings.push('Hyperbilirubinemia');
  if (psa !== null && psa >= 4) findings.push(psa >= 10 ? 'High PSA' : 'Elevated PSA');
  if (abnormal(values.hbsag, ['N/A', 'Non - Reaktif'])) findings.push('Hepatitis B');
  if (abnormal(values.vdrl, ['N/A', 'Non - Reaktif'])) findings.push('Syphilis');
  if (abnormal(values.tpha, ['N/A', 'Non - Reaktif'])) findings.push('Syphilis (TPHA+)');
  if (abnormal(values.hiv, ['N/A', 'Non - Reaktif'])) findings.push('HIV Infection');
  if (abnormal(values.chestXR)) findings.push(`CXR : Kesan ${text(values.chestXR)}`);
  if (abnormal(values.lumboXR)) findings.push(`Lumbosacral XR : ${text(values.lumboXR)}`);
  if (abnormal(values.ecgHasil)) findings.push(`ECG : ${text(values.ecgHasil)}`);
  if (abnormal(values.tmHasil)) findings.push(`Treadmill test : ${text(values.tmHasil)}`);
  if (abnormal(values.usg)) findings.push(`USG (${text(values.usg)})`);
  return findings.filter(Boolean);
}

/**
 * Applies the calculated columns before persistence. These are the database-side
 * equivalents of the formula columns maintained by the Excel/Google Sheet.
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

  result.diabetes = calcDiabetes(
    numberValue(result.gdp),
    numberValue(result.gd2pp),
    numberValue(result.hba1c),
  );
  result.tglExpired = addOneYear(result.tglMCU);
  const findings = buildClinicalSummary(result);
  result.diagnosaMedis = findings.join(', ');
  result.itemFU = findings.map(finding => `• ${finding}`).join('\n');
  result.perluFU = text(result.kesVendor) && text(result.kesVendor) !== 'Fit To Work' && findings.length > 0 ? 'Ya' : 'Tidak';

  const calculationInput: Record<string, string | number | undefined> = Object.fromEntries(
    Object.entries(result).map(([key, value]) => [key, value === null ? undefined : value]),
  );
  const framingham = calcFramingham(calculationInput);
  result.framScore = framingham.score;
  result.framProb = String(framingham.prob).replace(/%+/g, '%');
  result.framKat = framingham.kat;

  const zonasi = assessZonasi(calculationInput, String(result.jenisKelamin || ''));
  result.zonasi = zonasi.zona;
  result.triggerZona = zonasi.triggers.join(' | ');
  result.pengendalian = zonasi.pengendalian;

  return result;
}
