import {
  assessZonasi,
  calcBMI,
  calcDiabetes,
  calcFramingham,
  calcMCHC,
  calcPct,
  calcEgfrCkdEpi2021,
} from '@/lib/zonasi-engine';
import { buildDiagnosisList, formatDiagnosis } from '@/lib/mcu-diagnosis';
import { summariseQuestionnaires } from '@/lib/questionnaire-scores';
import { AUTO_INTERPRETATION_FIELDS, classifyFitnessTest, suggestDiagnosisHati } from '@/lib/clinical-classification';
import { audiogramFromRecord, evaluateAudiogram } from '@/lib/hc-ergo';
import { parseVisusPerMata } from '@/lib/visus-parser';
import { hitungTemuanAbnormal } from '@/lib/followup-fields';
import { normalizeMCUEcgOption, buildUlComposite, URINALYSIS_FIELD_IDS } from '@/lib/mcu-fields';

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

/**
 * Sama seperti abnormal(), tetapi untuk field MULTI-PILIH yang nilainya
 * dipisah " | ". Field dianggap abnormal bila ADA satu pilihan yang bukan
 * kata normal — "Normal | Karies" tetap temuan, bukan dianggap normal hanya
 * karena kata "Normal" muncul di dalamnya.
 */
function abnormalMulti(value: MCUValues[string], excluded = ['N/A', 'DBN', 'Normal']) {
  const current = text(value);
  if (!current) return false;
  const parts = current.split('|').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return false;
  return parts.some((part) => abnormal(part, excluded));
}

/**
 * Deteksi abnormalitas urinalisis.
 *
 * Sejak kolom dipecah per parameter, fungsi ini memeriksa 19 field `ul*`
 * secara langsung. Bila field per-parameter kosong semua (record lama yang
 * baru punya kolom komposit `ul`), fungsi jatuh ke parsing teks komposit
 * supaya hasil pembacaan lama tetap terdeteksi.
 */
function abnormalUrinalysis(values: MCUValues): boolean {
  const isAbnormalValue = (raw: string): boolean =>
    /(?:^|[\s:])(?:\+{1,3}|\d+\s*\+)(?:$|\s)|(?:^|\s)(?:H|L|HIGH|LOW)(?:$|\s)|positif|positive|reaktif|reactive|trace|abnormal|tinggi|rendah|meningkat|menurun|keruh|hematuria|proteinuria|glukosuria|bakteri|kristal|silinder/i.test(raw);

  const normalUrinalysisValues = new Set([
    'negatif', 'normal', 'jernih', 'aromatik', 'sedikit', 'tidak diperiksa',
    'kuning muda', 'kuning gelap', 'amber', 'keruh kemerahan',
  ]);

  // Jalur 1: per-parameter (data baru).
  let adaNilaiPerParam = false;
  for (const fieldId of URINALYSIS_FIELD_IDS) {
    const v = text(values[fieldId]);
    if (!v) continue;
    adaNilaiPerParam = true;
    if (normalUrinalysisValues.has(v.toLowerCase())) continue;
    if (fieldId === 'ulBeratJenis' || fieldId === 'ulPh') {
      const n = Number(v.replace(',', '.'));
      if (Number.isFinite(n)) {
        if (fieldId === 'ulBeratJenis' && n >= 1.005 && n <= 1.03) continue;
        if (fieldId === 'ulPh' && n >= 4.6 && n <= 8) continue;
      }
    }
    if (fieldId === 'ulEritrosit' || fieldId === 'ulLeukosit') {
      // Nilai sedimen boleh ditulis dengan atau tanpa satuan:
      //   "0-2", "0-2 /HPF", "2", "2 /HPF", "<1", ">10", "RCBC"
      // Ambil SEMUA angka, lalu pakai yang TERBESAR (batas atas rentang).
      // Contoh: "0-5" -> 5 (melebihi normal RBC 2) => abnormal.
      const batas = fieldId === 'ulEritrosit' ? 2 : 5;
      const semuaAngka = v.match(/\d+/g);
      if (semuaAngka && semuaAngka.length > 0) {
        const tertinggi = Math.max(...semuaAngka.map(Number));
        if (tertinggi <= batas) continue;
      }
    }
    if (isAbnormalValue(v)) return true;
    // Nilai kualitatif lain yang tidak normal pun dianggap temuan.
    return true;
  }
  if (adaNilaiPerParam) return false;

  // Jalur 2: fallback komposit `ul` (data lama sebelum pemecahan kolom).
  const raw = text(values.ul);
  if (!raw) return false;
  const segments = raw.split(/[\n;|]+/).map((part) => part.trim()).filter(Boolean);
  const structuredValues = segments.flatMap((segment) => {
    const match = segment.match(/^[^:=]+[:=]\s*(.+)$/);
    return match ? [match[1].trim()] : [];
  });
  if (!structuredValues.length) return abnormal(raw);
  return structuredValues.some((result) => isAbnormalValue(result));
}

/**
 * Ringkasan tes kebugaran dari field per-jenis-tes.
 *
 * Setiap tes punya satuan berbeda, jadi digabung sebagai "Nama: nilai satuan".
 * Hanya tes yang terisi yang ikut — parameter yang tidak diperiksa tetap
 * kosong (NULL), bukan ditulis "Tidak Dilakukan".
 */
const FITNESS_FIELDS: Array<[string, string, string]> = [
  ['tes6mwt', '6MWT', 'meter'],
  ['tesHarvard', 'Harvard Step Test', 'skor'],
  ['tesYMCAStep', 'YMCA Step Test', 'bpm'],
  ['tesQueensCollege', "Queen's College Step Test", 'mL/kg/menit'],
  ['tesErgocycle', 'Ergocycle', 'mL/kg/menit'],
  ['tesSitUp', 'Sit-Up 30 detik', 'kali'],
  ['tesPushUp', 'Push-Up', 'kali'],
  ['tesSitAndReach', 'Sit and Reach', 'cm'],
];

function buildFitnessSummary(values: MCUValues): string {
  const parts: string[] = [];
  for (const [fieldId, label, unit] of FITNESS_FIELDS) {
    const value = text(values[fieldId]);
    if (!value) continue;
    parts.push(`${label}: ${value} ${unit}`.trim());
  }
  return parts.join(' | ');
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
  const visus = parseVisusPerMata(text(values.visusJauh));

  // Gigi & Mulut dan Fisik Mata kini multi-pilih ("Karies | Ginggivitis").
  // Nilai dianggap normal hanya bila seluruh pilihannya normal.
  add(abnormalMulti(values.gigiMulut), `Orodental : ${text(values.gigiMulut)}`);
  add(abnormal(values.fisikHeadToToe), `Fisik : ${text(values.fisikHeadToToe)}`);
  add(abnormal(values.hemoroid), /Menolak RT|N\/A/.test(text(values.hemoroid))
    ? 'RT : Pemeriksaan Hemoroid Belum Dilakukan' : `RT : ${text(values.hemoroid)}`);
  add(abnormalMulti(values.fisikMata), `Mata : ${text(values.fisikMata)}`);
  const visusJauhAbnormal = [visus.od, visus.os].some((eye) => eye.desimal !== null && eye.desimal < 1);
  add(visusJauhAbnormal, `Visus Jauh : ${visus.label}`);
  add(abnormal(values.visusDekat, ['N/A']) && !/6\/6|5\/5|20\/20|J1|Koreksi/i.test(text(values.visusDekat)), `Visus Dekat : ${text(values.visusDekat)}`);
  add(Boolean(values.defWarna && !['Normal', 'N/A'].includes(text(values.defWarna))), `Defisiensi Persepsi Warna : ${text(values.defWarna)}`);
  add(abnormal(values.lapangPandang), `Lapang Pandang : ${text(values.lapangPandang)}`);
  add(systolic !== null && diastolic !== null && (systolic > 130 || diastolic > 89), `TD : ${systolic}/${diastolic} mmHg`);
  add(bmi !== null && bmi >= 25 && bmi < 30, `BMI : ${bmi} (Overweight)`);
  add(bmi !== null && bmi >= 30, `BMI : ${bmi} (Obesitas)`);
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
  add(abnormalUrinalysis(values), `UL : ${text(values.ul)}`);
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
    || /TD\s*:|BMI\s*:|HbA1c|HbsAg|VDRL|TPHA|HIV|UL\s*:|CXR|Lumbosacral|ECG|Treadmill|Spirometry|Audiometry/i.test(itemFU);

  addIf(hasOrodental || /Orodental/i.test(itemFU), 'Dokter Gigi');
  addIf(/menolak rt|belum dilakukan/i.test(hemoroid) || /Pemeriksaan Hemoroid Belum Dilakukan/i.test(itemFU), 'Dokter Umum');
  addIf(/positif/i.test(hemoroid) || /RT\s*:\s*Positif/i.test(itemFU), 'Dokter Sp. B');
  addIf(hasEyeFinding || /Visus|Defisiensi Persepsi Warna|Mata\s*:/i.test(itemFU), 'Dokter Sp. M');
  addIf(hasPositiveOrthoTest, 'Dokter Sp. OT');
  addIf(hasMedicalFinding, 'Dokter Sp. PD');
  const nonResultFields = new Set([
    'nationalId', 'nikKaryawan', 'nama', 'usia', 'jenisKelamin', 'jabatan', 'site',
    'statusMCU', 'tglMCU', 'tempatMCU', 'kesVendor', 'rekQSHE', 'diagnosaMedis', 'catatan',
    'ringkasanKuesioner', 'perluFU', 'rekFU', 'itemFU', 'linkMCU', 'tglExpired',
    'mchc', 'fvcPct', 'fev1Pct', 'fev1FvcAct', 'fev1FvcPct', 'pta', 'diabetes',
    'egfr', 'hasilKebugaran', 'framScore', 'framProb', 'framKat', 'zonasi', 'triggerZona', 'pengendalian',
    'frekuensiEvaluasi', 'catatanSOP', 'ul',
  ]);
  const hasExamResult = Object.entries(values).some(([key, value]) =>
    !nonResultFields.has(key) && value !== null && value !== undefined
      && String(value).trim() !== '' && !/^n\/a$/i.test(String(value).trim()),
  );
  const hasAbnormalFinding = Boolean(itemFU)
    || buildDiagnosisList(values).length > 0
    || hasOrodental
    || hasEyeFinding
    || hasPositiveOrthoTest
    || hasMedicalFinding
    || abnormalUrinalysis(values)
    || (bmi !== null && bmi >= 25);
  addIf(hasExamResult && !hasAbnormalFinding,
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
 * Rekomendasi QSHE Medic otomatis berdasarkan zonasi dan temuan.
 * Nilai masih bisa ditimpa manual oleh operator — saran hanya ditulis
 * saat rekQSHE kosong atau masih berisi nilai saran sebelumnya.
 */
export function suggestRekQSHE(values: MCUValues): string {
  const zonasi = text(values.zonasi);
  const itemFU = text(values.itemFU);
  const hasFindings = itemFU.length > 0 || buildDiagnosisList(values).length > 0;
  if (hasFindings) {
    if (zonasi === 'Merah') return 'Currently Unfit';
    if (zonasi === 'Kuning') return 'Fit With Note';
  }
  if (zonasi === 'Belum Lengkap') return 'Temporary Unfit';
  return 'Fit To Work';
}

/**
 * Applies the calculated columns before persistence. These are the
 * database-side equivalents of the formula columns maintained by the
 * Excel/Google Sheet.
 */
export function applyMCUCalculations(values: MCUValues): MCUValues {
  const result = { ...values };
  if (text(result.ecgHasil)) result.ecgHasil = normalizeMCUEcgOption(text(result.ecgHasil));
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

  // PTA = rata-rata ambang dengar 500/1000/2000/4000 Hz per telinga, dibulatkan,
  // dan yang dipakai adalah telinga yang LEBIH BAIK (derajat WHO, STD/033 6.4 Rev.001;
  // logikanya sama dengan modul Konservasi Pendengaran di hc-ergo.ts). Kedua
  // telinga memerlukan keempat frekuensi agar rata-ratanya bermakna.
  const audiogram = audiogramFromRecord(result);
  if (audiogram) {
    const evaluation = evaluateAudiogram(audiogram);
    const averages = [evaluation.kanan.avg4, evaluation.kiri.avg4].filter((value): value is number => value !== null);
    if (averages.length > 0) result.pta = Math.round(Math.min(...averages));
  }

  // Interpretasi spirometri & audiometri dibangun dari angka di atas. Hanya
  // diisi bila kosong, sehingga tulisan manual pemeriksa tidak ditimpa. (Form
  // memakai pelacak sendiri di store.ts agar teks otomatis ikut berubah saat
  // angka diedit.) Harus sebelum diagnosis karena keduanya membaca teks ini.
  for (const [key, build] of Object.entries(AUTO_INTERPRETATION_FIELDS)) {
    if (!text(result[key]) || /^n\/a$/i.test(text(result[key]))) {
      const generated = build(result);
      if (generated) result[key] = generated;
    }
  }

  result.diabetes = calcDiabetes(
    numberValue(result.gdp),
    numberValue(result.gd2pp),
    numberValue(result.hba1c),
  );

  // Diagnosis Klinis Penyakit Hati (STD/006 Rev.002 Bab 7): diturunkan dari
  // SGOT/SGPT/HBsAg yang sudah ada di form — operator tidak perlu mengisi
  // manual bila nilai lab tersedia. HANYA diisi bila field masih kosong;
  // tulisan manual selalu dipertahankan. Harus DIHITUNG SEBELUM
  // buildDiagnosisList & assessZonasi karena keduanya membaca
  // `diagnosisHati` (trigger zona merah/kuning untuk penyakit hati).
  const saranHati = suggestDiagnosisHati(
    numberValue(result.sgot),
    numberValue(result.sgpt),
    result.hbsag,
  );
  if (saranHati && !text(result.diagnosisHati)) {
    result.diagnosisHati = saranHati;
  }
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

  // Ringkasan komposit `ul` dari 19 parameter — WAJIB dibangun sebelum
  // buildDiagnosisList & zonasi karena keduanya membaca `ul`.
  // Selalu dibangun ulang bila ada parameter per-param yang terisi, supaya
  // suntingan operator langsung tercermin (bukan memakai `ul` lama).
  const ulComposite = buildUlComposite(result as Record<string, string>);
  if (ulComposite) result.ul = ulComposite;

  // Diagnosa medis dihitung otomatis dari seluruh temuan, memakai istilah
  // diagnosis bahasa Inggris hasil klasifikasi SOP (tanpa kode ICD-10).
  // Nilai lama dari Excel sengaja dikosongkan oleh pipeline import agar
  // tidak ikut dipertahankan.
  const diagnosisEntries = buildDiagnosisList(result);
  if (!text(result.diagnosaMedis)) {
    result.diagnosaMedis = formatDiagnosis(diagnosisEntries);
  }

  // DK is formula-driven in the spreadsheet. It remains empty for Fit To Work.
  result.itemFU = buildFormulaFollowUp(result);
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

  // Perlu Follow Up: otomatis. Ya bila ada peserta ProKawan (zona Kuning/Merah)
  // atau ada parameter abnormal menurut trigger STD/006 maupun rujukan nasional.
  const zonaButuhFu = zonasi.zona === 'Kuning' || zonasi.zona === 'Merah';
  result.perluFU = zonaButuhFu || hitungTemuanAbnormal(result, result.triggerZona) > 0 ? 'Ya' : 'Tidak';

  // RekQSHE: auto-suggest from zonasi/findings when empty; preserve manual.
  if (!text(result.rekQSHE)) {
    result.rekQSHE = suggestRekQSHE(result);
  }

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

  // Uji kebugaran fisik BUKAN parameter zonasi menurut SOP, tapi tetap perlu
  // tercatat pada diagnosis.
  //
  // Sejak tiap jenis tes punya field sendiri, ringkasan dibangun dari nilai
  // yang benar-benar terisi. Kolom `tesKebugaran` lama tetap diisi sebagai
  // ringkasan teks supaya laporan & data lama tidak berubah bentuk.
  const fitnessSummary = buildFitnessSummary(result);
  if (fitnessSummary) {
    result.tesKebugaran = fitnessSummary;
    const fitness = classifyFitnessTest(fitnessSummary);
    if (fitness) result.hasilKebugaran = `${fitness.label} (${fitness.detail})`;
  }

  return result;
}
