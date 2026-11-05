// ============================================================
// MCU Field Definitions
// ============================================================
// Kolom A adalah nomor urut yang dibuat otomatis, jadi field pertama
// (NIK KTP) berada di kolom B. Huruf dan indeks kolom DITURUNKAN dari
// urutan deklarasi di bawah â€” lihat assignColumns().
//
// The order here is the Excel/Supabase contract for Record MCU.
// Menyisipkan field baru cukup menaruhnya pada posisi yang tepat;
// seluruh field setelahnya otomatis bergeser.
// ============================================================

import {
  ECG_OPTIONS as STANDARD_ECG_OPTIONS,
  TMT_OPTIONS as STANDARD_TMT_OPTIONS,
  ARTRITIS_URAT_OPTIONS,
  ASTHMA_OPTIONS,
  CARDIAC_OPTIONS,
  DIAGNOSIS_HATI_OPTIONS,
  DM_KOMPLIKASI_OPTIONS,
  EPILEPSI_KEPATUHAN_OPTIONS,
  EPILEPSY_OPTIONS,
  LBP_OPTIONS,
  MENTAL_KONFIRMASI_OPTIONS,
  OBESITAS_FUNGSIONAL_OPTIONS,
  SLEEP_APNEA_OPTIONS,
  STATUS_TERAPI_ESS_OPTIONS,
  STROKE_OPTIONS,
} from '@/lib/clinical-classification';

export type FieldType = 'number' | 'text' | 'select' | 'date' | 'textarea';

export interface MCUFieldDef {
  id: string;
  col: string;
  colIndex: number;
  label: string;
  section: string;
  sectionOrder: number;
  type: FieldType;
  unit?: string;
  placeholder?: string;
  normalRange?: string;
  min?: number;
  max?: number;
  options?: string[];
  multiple?: boolean;
  /** Select ini menyediakan opsi "Lainnya" dengan input teks bebas. */
  allowCustom?: boolean;
  /**
   * Saran otomatis yang dihitung oleh engine dari temuan klinis.
   * Nilai tetap dapat diubah manual oleh operator â€” saran hanya ditulis
   * saat field kosong atau masih berisi nilai saran sebelumnya.
   */
  autoSuggest?: boolean;
  autoCalc?: boolean;
  autoCalcFrom?: string[];
  normalMale?: string;
  normalFemale?: string;
  lowMale?: number;
  highMale?: number;
  lowFemale?: number;
  highFemale?: number;
  low?: number;
  high?: number;
}


export const MCU_SECTIONS = [
  { id: 'identity', label: 'Identitas', icon: 'User', order: 0 },
  { id: 'physical', label: 'Fisik', icon: 'Activity', order: 1 },
  { id: 'vision', label: 'Mata', icon: 'Eye', order: 2 },
  { id: 'vital', label: 'Tanda Vital', icon: 'HeartPulse', order: 3 },
  { id: 'hematology', label: 'Hematologi', icon: 'Droplets', order: 4 },
  { id: 'chemistry', label: 'Kimia Darah', icon: 'FlaskConical', order: 5 },
  { id: 'serology', label: 'Serologi', icon: 'Shield', order: 6 },
  { id: 'drug', label: 'NAPZA', icon: 'Pill', order: 7 },
  { id: 'imaging', label: 'Radiologi & USG', icon: 'Scan', order: 8 },
  { id: 'anamnesis', label: 'Riwayat Penyakit & Kuesioner', icon: 'ClipboardList', order: 9 },
  { id: 'spirometry', label: 'Spirometri', icon: 'Wind', order: 10 },
  { id: 'audiometry', label: 'Audiometri', icon: 'Ear', order: 11 },
  { id: 'neuro', label: 'Neurologi', icon: 'Brain', order: 12 },
  { id: 'fitness', label: 'Kebugaran', icon: 'Dumbbell', order: 13 },
  { id: 'assessment', label: 'Penilaian', icon: 'ClipboardCheck', order: 14 },
  { id: 'calculated', label: 'Hasil Kalkulasi', icon: 'Calculator', order: 15 },
] as const;

type FieldOptions = Omit<MCUFieldDef, 'id' | 'col' | 'colIndex' | 'label' | 'section' | 'sectionOrder' | 'type'>;

/**
 * Kolom spreadsheet ditetapkan dari URUTAN deklarasi, bukan dari huruf
 * yang ditulis manual. Kolom A dipakai nomor urut otomatis, jadi field
 * pertama (NIK KTP) berada di kolom B.
 *
 * Konsekuensinya: menyisipkan field baru cukup dengan menaruhnya di
 * posisi yang tepat pada array MCU_FIELDS. Semua field setelahnya
 * otomatis bergeser, dan tidak ada lagi huruf kolom yang bisa salah.
 */
const f = (
  id: string,
  label: string,
  section: string,
  type: FieldType = 'text',
  options: FieldOptions = {},
): MCUFieldDef => ({
  id,
  col: '',
  colIndex: 0,
  label,
  section,
  sectionOrder: 0,
  type,
  ...options,
});

function columnLetter(index: number): string {
  let result = '';
  let current = index;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

/** Menempelkan huruf dan indeks kolom ke setiap field menurut urutannya. */
function assignColumns(fields: MCUFieldDef[]): MCUFieldDef[] {
  return fields.map((field, position) => {
    const colIndex = position + 1; // kolom A = nomor urut
    return { ...field, col: columnLetter(colIndex + 1), colIndex };
  });
}

const normal = (normalRange: string, unit?: string): FieldOptions => ({ normalRange, unit });
const select = (options: string[]): FieldOptions => ({ options });
const neurologicalSelect = (options: string[]): FieldOptions => ({ options });
const kesimpulanOptions = ['Fit To Work', 'Fit With Note', 'Fit With Restriction', 'Currently Unfit', 'Unfit', 'Temporary Unfit'];



export const MCU_FIELD_DEFINITION: MCUFieldDef[] = [
  // Bâ€“J Identitas
  f('nationalId', 'NIK KTP', 'identity', 'text'),
  f('nikKaryawan', 'NIK Karyawan', 'identity', 'text'),
  f('nama', 'Nama', 'identity'),
  f('usia', 'Usia', 'identity', 'number', { unit: 'tahun', autoCalc: true }),
  f('jenisKelamin', 'Jenis Kelamin', 'identity', 'select', { options: ['Laki - Laki', 'Perempuan'] }),
  f('jabatan', 'Jabatan', 'identity'),
  f('site', 'Site', 'identity'),
  f('statusMCU', 'Status MCU', 'identity', 'select', {
    options: ['Pre Employee', 'Annual', 'Specific', 'Retirement', 'Follow Up - Pre Employee', 'Follow Up - Annual'],
  }),
  f('tglMCU', 'Tanggal MCU', 'identity', 'date'),
  f('tempatMCU', 'Tempat MCU', 'identity'),

  // Kâ€“N Fisik
  f('golDarah', 'Golongan Darah & Rhesus', 'physical', 'select', select(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])),
  f('gigiMulut', 'Gigi & Mulut', 'physical', 'select', {
    options: ['Normal', 'Karies', 'Ginggivitis', 'Periodontitis', 'Edentul', 'Protodonsia'],
    allowCustom: true,
  }),
  f('fisikHeadToToe', 'Fisik Head To Toe', 'physical', 'select', {
    options: ['Normal', 'Abnormal', 'Tidak Diperiksa'],
    allowCustom: true,
  }),
  f('hemoroid', 'Hemoroid', 'physical', 'select', select(['Negatif', 'Positif', 'Menolak RT'])),

  // Oâ€“S Mata
  f('visusJauh', 'Visus Jauh', 'vision'),
  f('visusDekat', 'Visus Dekat', 'vision'),
  f('defWarna', 'Defisiensi Persepsi Warna', 'vision', 'select', select(['Normal', 'Protan', 'Deutan', 'Tritan', 'Total'])),
  f('lapangPandang', 'Lapang Pandang', 'vision', 'select', {
    options: ['Normal', 'Konstriksi Ringan', 'Konstriksi Sedang', 'Konstriksi Berat', 'Tunnel Vision', 'Abnormal Lainnya'],
    allowCustom: true,
  }),
  f('fisikMata', 'Fisik Mata', 'vision', 'select', {
    options: ['Normal', 'Keratoconjunctivitis', 'Katarak', 'Glaukoma', 'Retinopati', 'Nistagmus', 'Ptosis'],
    allowCustom: true,
  }),

  // Tâ€“AA Tanda vital
  f('merokok', 'Merokok', 'vital', 'select', select(['Ya', 'Tidak', 'Sudah Berhenti'])),
  f('tdS', 'Tekanan Darah Sistolik', 'vital', 'number', normal('90-119', 'mmHg')),
  f('tdD', 'Tekanan Darah Diastolik', 'vital', 'number', normal('60-79', 'mmHg')),
  f('nadi', 'Nadi', 'vital', 'number', { unit: 'bpm', high: 100 }),
  f('bb', 'Berat Badan', 'vital', 'number', { unit: 'kg' }),
  f('tb', 'Tinggi Badan', 'vital', 'number', { unit: 'cm' }),
  f('bmi', 'BMI', 'vital', 'number', { unit: 'kg/mÂ²', high: 30, autoCalc: true, autoCalcFrom: ['bb', 'tb'] }),
  f('lp', 'Lingkar Pinggang', 'vital', 'number', { unit: 'cm', normalMale: '<90', normalFemale: '<80' }),

  // ABâ€“AJ Hematologi
  f('hb', 'Hemoglobin', 'hematology', 'number', { unit: 'g/dL', normalMale: '13-16,5', normalFemale: '12-15', lowMale: 13, highMale: 16.5, lowFemale: 12, highFemale: 15 }),
  f('leukosit', 'Leukosit', 'hematology', 'number', normal('4-11', '10Â³/ÂµL')),
  f('eritrosit', 'Eritrosit', 'hematology', 'number', normal('4,5-6,2', '10â¶/ÂµL')),
  f('hematokrit', 'Hematokrit', 'hematology', 'number', normal('40-54', '%')),
  f('trombosit', 'Trombosit', 'hematology', 'number', normal('150-400', '10Â³/ÂµL')),
  f('mcv', 'MCV', 'hematology', 'number', normal('80-100', 'fL')),
  f('mch', 'MCH', 'hematology', 'number', normal('26-34', 'pg')),
  f('mchc', 'MCHC', 'hematology', 'number', { ...normal('31-37', 'g/dL'), autoCalc: true, autoCalcFrom: ['hb', 'hematokrit'] }),
  f('led', 'LED (Laju Endap Darah)', 'hematology', 'number', { unit: 'mm/j', normalMale: '0-15', normalFemale: '0-20' }),

  // AKâ€“BB Kimia darah
  f('chol', 'Kolesterol Total', 'chemistry', 'number', normal('<200', 'mg/dL')),
  f('tg', 'Trigliserida', 'chemistry', 'number', normal('<150', 'mg/dL')),
  f('hdl', 'HDL', 'chemistry', 'number', normal('â‰¥50', 'mg/dL')),
  f('ldl', 'LDL', 'chemistry', 'number', normal('<100', 'mg/dL')),
  f('gdp', 'Gula Darah Puasa', 'chemistry', 'number', normal('70-100', 'mg/dL')),
  f('gd2pp', 'Gula Darah 2 Jam PP', 'chemistry', 'number', normal('<140', 'mg/dL')),
  f('hba1c', 'Hemoglobin A1c', 'chemistry', 'number', normal('<6,5', '%')),
  f('diabetes', 'Diabetes', 'chemistry', 'select', { options: ['Ya', 'Tidak'], autoCalc: true, autoCalcFrom: ['gdp', 'gd2pp', 'hba1c'] }),
  f('au', 'Asam Urat', 'chemistry', 'number', { unit: 'mg/dL', normalMale: '3,4-7,0', normalFemale: '2,4-6,0' }),
  f('ureum', 'Ureum', 'chemistry', 'number', normal('16,6-48,5', 'mg/dL')),
  f('kreatinin', 'Kreatinin', 'chemistry', 'number', normal('0.6-1.2', 'mg/dL')),
  // eGFR boleh diisi manual dari hasil laboratorium. Bila kosong, engine
  // menghitungnya otomatis dengan CKD-EPI 2021 dari kreatinin + usia + jenis kelamin.
  f('egfr', 'Glomerular Filtration Rate', 'chemistry', 'number', { ...normal('â‰¥90', 'mL/menit/1,73 mÂ²'), autoCalc: true, autoCalcFrom: ['kreatinin', 'usia', 'jenisKelamin'] }),
  f('sgot', 'SGOT', 'chemistry', 'number', normal('<40', 'U/L')),
  f('sgpt', 'SGPT', 'chemistry', 'number', normal('<41', 'U/L')),
  f('ggt', 'GGT', 'chemistry', 'number', normal('8-61', 'U/L')),
  f('alp', 'ALP', 'chemistry', 'number', normal('44-147', 'IU/L')),
  f('billirubin', 'Bilirubin', 'chemistry', 'number', normal('0,2-1,2', 'mg/dL')),

  // Urinalisis â€” 19 parameter disimpan di kolom terpisah (ul_*) agar bisa
  // di-query per parameter. Kolom `ul` lama tetap dipertahankan sebagai
  // ringkasan komposit autoCalc untuk engine zonasi, diagnosis, dan Eksel.
  f('ulWarna', 'Warna Urine', 'chemistry', 'select', {
    options: ['Pale Yellow', 'Dark Yellow', 'Amber', 'Cloudy Reddish', 'Not Examined'],
    allowCustom: true,
    normalRange: 'Pale Yellow',
  }),
  f('ulKejernihan', 'Turbidity Urine', 'chemistry', 'select', {
    options: ['Clear', 'Cloudy Moderate', 'Cloudy', 'Very Cloudy'],
    normalRange: 'Clear',
    allowCustom: true,
  }),
  f('ulBau', 'Odor Urine', 'chemistry', 'select', {
    options: ['Aromatic', 'Sweet', 'Ammoniacal', 'Foul'],
    normalRange: 'Aromatic',
    allowCustom: true,
  }),
  f('ulBeratJenis', 'Specific Gravity (SG)', 'chemistry', 'select', {
    options: ['1.005', '1.010', '1.015', '1.020', '1.025', '1.030', '1.035', '1.040'],
    normalRange: '1.005-1.030',
    allowCustom: true,
  }),
  f('ulPh', 'pH Urine', 'chemistry', 'select', {
    options: ['4.5', '5.0', '5.5', '6.0', '6.5', '7.0', '7.5', '8.0'],
    normalRange: '4.6-8.0',
    allowCustom: true,
  }),
  f('ulProtein', 'Protein / Albumin', 'chemistry', 'select', {
    options: ['Negative', 'Trace', '+1', '+2', '+3', '+4'],
    normalRange: 'Negative',
    allowCustom: true,
  }),
  f('ulGlukosa', 'Glucose / Reduction', 'chemistry', 'select', {
    options: ['Negative', '+1', '+2', '+3', '+4'],
    normalRange: 'Negative',
    allowCustom: true,
  }),
  f('ulKeton', 'Ketone', 'chemistry', 'select', {
    options: ['Negative', '+1', '+2', '+3', '+4'],
    normalRange: 'Negative',
    allowCustom: true,
  }),
  f('ulDarah', 'Blood / Occult Blood', 'chemistry', 'select', {
    options: ['Negative', '+1', '+2', '+3', '+4'],
    normalRange: 'Negative',
    allowCustom: true,
  }),
  f('ulLeukositEsterase', 'Leukocyte Esterase', 'chemistry', 'select', {
    options: ['Negative', '+1', '+2', '+3', '+4'],
    normalRange: 'Negative',
    allowCustom: true,
  }),
  f('ulNitrit', 'Nitrite', 'chemistry', 'select', {
    options: ['Negative', 'Positive'],
    normalRange: 'Negative',
    allowCustom: true,
  }),
  f('ulBilirubin', 'Bilirubin Urine', 'chemistry', 'select', {
    options: ['Negative', '+1', '+2', '+3', '+4'],
    normalRange: 'Negative',
    allowCustom: true,
  }),
  f('ulUrobilinogen', 'Urobilinogen', 'chemistry', 'select', {
    options: ['Normal', '+1', '+2', 'High'],
    normalRange: 'Normal',
    allowCustom: true,
  }),
  f('ulEritrosit', 'RBC Urine', 'chemistry', 'select', {
    options: ['0 /HPF', '1-2 /HPF', '3-5 /HPF', '6-10 /HPF', '>10 /HPF', 'RCBC'],
    normalRange: '0-2 /HPF',
    allowCustom: true,
  }),
  f('ulLeukosit', 'WBC Urine', 'chemistry', 'select', {
    options: ['0 /HPF', '1-2 /HPF', '3-5 /HPF', '6-10 /HPF', '>10 /HPF', 'RCBC'],
    normalRange: '0-5 /HPF',
    allowCustom: true,
  }),
  f('ulSelEpitel', 'Epithelial Cells', 'chemistry', 'select', {
    options: ['Few', 'Moderate', 'Many', 'Not Examined'],
    normalRange: 'Few',
    allowCustom: true,
  }),
  f('ulSilinder', 'Casts', 'chemistry', 'select', {
    options: ['Negative', '+1', '+2', '+3'],
    normalRange: 'Negative',
    allowCustom: true,
  }),
  f('ulKristal', 'Crystals Urine', 'chemistry', 'select', {
    options: ['Negative', '+1', '+2', '+3'],
    normalRange: 'Negative',
    allowCustom: true,
  }),
  f('ulBakteri', 'Bacteria / Microorganisms', 'chemistry', 'select', {
    options: ['Negative', '+1', '+2', '+3'],
    normalRange: 'Negative',
    allowCustom: true,
  }),
  // `ul` = ringkasan komposit dari 19 parameter di atas, dibangun otomatis
  // oleh engine supaya engine zonasi/diagnosis & Eksel lama tetap berfungsi.
  f('ul', 'Urinalisis (Ringkasan)', 'chemistry', 'textarea', { autoCalc: true }),

  // BCâ€“BG Serologi
  ...([
    ['hbsag', 'HbsAg'], ['antiHbs', 'Anti Hbs'], ['vdrl', 'VDRL'],
    ['tpha', 'TPHA'], ['hiv', 'HIV'],
  ] as const).map(([id, label]) => f(id, label, 'serology', 'select', select(['Non - Reaktif', 'Reaktif']))),

  // BHâ€“BP NAPZA
  ...([
    ['drugAmp', 'Drug Test Amphetamine'], ['drugMeth', 'Drug Test Methamphetamine'],
    ['drugMorph', 'Drug Test Morphine'], ['drugCanna', 'Drug Test Cannabinoid'],
    ['drugCoc', 'Drug Test Coccain'], ['drugBenz', 'Drug Test Benzodiazepine'],
    ['drugCaris', 'Drug Test Carisoprodol'], ['alkohol', 'Alkohol Test'],
  ] as const).map(([id, label]) => f(id, label, 'drug', 'select', select(['Negatif', 'Positif']))),
  f('psa', 'PSA', 'drug', 'number', { unit: 'ng/mL', normalRange: '<4' }),

  // BQâ€“BU Imaging
  //
  // EKG dan treadmill memakai dropdown, bukan teks bebas. Tujuannya
  // menyeragamkan penulisan: data lama filled bebas penuh dengan salah eja
  // ("Sinus Bradicardia", "Synus Rythm", "Sinus Takikardi") sehingga
  // pencarian dan laporan tidak bisa diandalkan. Semua opsi ditulis dalam
  // istilah diagnosis bahasa Inggris yang sama dengan output
  // clinical-classification.ts.
  //
  // Daftar ini TIDAK membatasi data lama. Nilai lama yang tidak ada di sini
  // tetap ditampilkan sebagai opsi "(nilai lama)" oleh ReviewMCU, sehingga
  // operator tidak mengira field kosong lalu menimpanya. Lihat
  // opsiDenganNilaiLama di ReviewMCU.tsx.
  f('ecgHasil', 'ECG', 'imaging', 'select', select([...STANDARD_ECG_OPTIONS])),
  f('tmHasil', 'Treadmill', 'imaging', 'select', select([...STANDARD_TMT_OPTIONS])),
  f('chestXR', 'Chest X-Ray', 'imaging', 'select', {
    options: ['Normal', 'ILO 1/0', 'ILO 1/1', 'ILO â‰¥2/1', 'Pulmonary Fibrosis', 'Abnormal Lainnya'],
    allowCustom: true,
  }),
  f('lumboXR', 'Lumbosacral X-Ray', 'imaging', 'select', {
    options: ['Normal', 'Spondilosis', 'Hernia Nukleus Pulposus', 'Fraktur', 'Abnormal Lainnya'],
    allowCustom: true,
  }),
  f('usg', 'USG', 'imaging', 'select', {
    options: ['Normal', 'Hepatomegali', 'Splenomegali', 'Nefrolitiasis', 'Hiperplasia Prostat', 'Kista', 'Ginjal Polikistik', 'Ascites', 'Pleural Effusion', 'Abnormal Lainnya'],
    allowCustom: true,
  }),

  // Riwayat penyakit & skor kuesioner â€” parameter zonasi menurut
  // STD-006 Rev001 Bab 7. Ditaruh tepat setelah imaging karena urutan
  // ini yang dipakai pada formulir MCU fisik.
  //
  // Kolom riwayat dikosongkan berarti "tidak ada riwayat" (normal),
  // sesuai instruksi QSHE. Kolom skor kuesioner adalah SALINAN hasil
  // terakhir dari tabel mcu_ess / mcu_mental_health, dipakai engine
  // zonasi supaya perhitungannya tidak perlu query database.
  f('riwayatEpilepsi', 'Riwayat Epilepsi / Gangguan Kejang', 'anamnesis', 'select', {
    options: [...EPILEPSY_OPTIONS],
    multiple: true,
  }),
  f('riwayatJantung', 'Riwayat Penyakit Jantung', 'anamnesis', 'select', {
    options: [...CARDIAC_OPTIONS],
    multiple: true,
  }),
  f('riwayatStroke', 'Riwayat Stroke', 'anamnesis', 'select', {
    options: [...STROKE_OPTIONS],
    multiple: true,
  }),
  f('riwayatAsma', 'Riwayat Asma / Gangguan Napas', 'anamnesis', 'select', {
    options: [...ASTHMA_OPTIONS],
    multiple: true,
  }),
  f('riwayatSleepApnea', 'Riwayat Sleep Apnea', 'anamnesis', 'select', {
    options: [...SLEEP_APNEA_OPTIONS],
    multiple: true,
  }),
  f('lbp', 'Nyeri Punggung Bawah (Low Back Pain)', 'anamnesis', 'select', {
    options: [...LBP_OPTIONS],
  }),
  f('essScore', 'Skor ESS (Excessive Daytime Sleepiness)', 'anamnesis', 'number', {
    unit: 'skor',
    normalRange: '0-10',
    min: 0,
    max: 32,
  }),
  f('srq20Score', 'Skor SRQ-20 (Gangguan Mental Emosional)', 'anamnesis', 'number', {
    unit: 'skor',
    normalRange: '0-5',
    min: 0,
    max: 20,
  }),
  // Batas maksimum mengikuti jumlah item tiap subskala DASS-21: 9, 7, dan 5
  // butir dengan skala 0-3. Membatasi ketiganya di 27 membuat ansietas dan
  // stres menerima nilai yang tidak mungkin dicapai, dan nilai semacam itu
  // akan terbaca sebagai kategori berat pada zona.
  f('dassDepresi', 'Skor DASS-21 Depresi', 'anamnesis', 'number', {
    unit: 'skor', normalRange: '0-9', min: 0, max: 27,
  }),
  f('dassCemas', 'Skor DASS-21 Ansietas', 'anamnesis', 'number', {
    unit: 'skor', normalRange: '0-7', min: 0, max: 21,
  }),
  f('dassStres', 'Skor DASS-21 Stres', 'anamnesis', 'number', {
    unit: 'skor', normalRange: '0-11', min: 0, max: 15,
  }),
  f('sdsScore', 'Total Skor SDS-30 (Survei Diagnosis Stres)', 'anamnesis', 'number', {
    unit: 'skor', normalRange: '30-210', min: 30, max: 210,
  }),
  // STD/006 Rev.002 poin 6.1.8 â€” Tanda Bahaya Kesehatan Jiwa.
  // "Ya" pada butir 17 SRQ-20 (pikiran untuk mengakhiri hidup) memaksa Zona
  // Merah + status Currently Unfit sampai dinilai dokter, BERAPA PUN skor
  // totalnya. Dibuat field tersendiri agar tidak bergantung pada input skor.
  f('srq17Bahaya', 'Tanda Bahaya Kesehatan Jiwa (SRQ-20 butir 17 = Ya)', 'anamnesis', 'select', {
    options: ['Tidak', 'Ya'],
  }),

  // Kualifikasi Klinis Tambahan â€” STD-006 Rev.002
  f('dmKomplikasi', 'Komplikasi Diabetes Melitus (Neuropati/Retinopati/Nefropati/Ulkus)', 'anamnesis', 'select', {
    options: [...DM_KOMPLIKASI_OPTIONS],
  }),
  f('mentalKonfirmasi', 'Status Konfirmasi Diagnosa Gangguan Jiwa', 'anamnesis', 'select', {
    options: [...MENTAL_KONFIRMASI_OPTIONS],
  }),
  f('artritisUrat', 'Riwayat Artritis Gout / Nyeri Sendi Asam Urat Berulang', 'anamnesis', 'select', {
    options: [...ARTRITIS_URAT_OPTIONS],
  }),
  f('diagnosisHati', 'Diagnosis Klinis Penyakit Hati', 'anamnesis', 'select', {
    options: [...DIAGNOSIS_HATI_OPTIONS],
  }),
  f('obesitasFungsional', 'Keterbatasan Fungsional Obesitas (IMT â‰¥35)', 'anamnesis', 'select', {
    options: [...OBESITAS_FUNGSIONAL_OPTIONS],
  }),
  f('statusTerapiEss', 'Status Terapi Gangguan Tidur / Kantuk Berlebih (ESS >15)', 'anamnesis', 'select', {
    options: [...STATUS_TERAPI_ESS_OPTIONS],
  }),
  f('epilepsiKepatuhan', 'Kepatuhan Terapi Antiepilepsi / Bebas Bangkitan', 'anamnesis', 'select', {
    options: [...EPILEPSI_KEPATUHAN_OPTIONS],
  }),

  // BVâ€“CE Spirometry
  f('fvcPred', 'Spirometry FVC PRED', 'spirometry', 'number', { unit: 'L' }),
  f('fvcAct', 'Spirometry FVC ACT', 'spirometry', 'number', { unit: 'L' }),
  f('fvcPct', 'Spirometry FVC %', 'spirometry', 'number', { unit: '%', autoCalc: true, autoCalcFrom: ['fvcAct', 'fvcPred'] }),
  f('fev1Pred', 'Spirometry FEV1 PRED', 'spirometry', 'number', { unit: 'L' }),
  f('fev1Act', 'Spirometry FEV1 ACT', 'spirometry', 'number', { unit: 'L' }),
  f('fev1Pct', 'Spirometry FEV1 %', 'spirometry', 'number', { unit: '%', autoCalc: true, autoCalcFrom: ['fev1Act', 'fev1Pred'] }),
  f('fev1FvcPred', 'Spirometry FEV1%G PRED', 'spirometry', 'number', { unit: '%' }),
  // fev1FvcAct disimpan sebagai RASIO desimal (0,83), bukan persen, karena
// engine mcu-calculations menghitungnya sebagai FEV1 aktual / FVC aktual.
// Label sengaja tidak memakai satuan '%' supaya tidak dibaca 0,83 persen;
// ambang 70% sudah dinormalisasi di dalam classifyLung.
f('fev1FvcAct', 'Spirometry FEV1%G ACT (rasio)', 'spirometry', 'number', { autoCalc: true, autoCalcFrom: ['fev1Act', 'fvcAct'] }),
  f('fev1FvcPct', 'Spirometry FEV1%G %', 'spirometry', 'number', { unit: '%', autoCalc: true, autoCalcFrom: ['fev1FvcAct', 'fev1FvcPred'] }),
  f('spiInterp', 'Spirometry Interpretasi', 'spirometry'),

  // CFâ€“CT Audiometry (ACR first, as specified)
  ...([
    ['acr_500', 'Audiometry ACR 500'], ['acr_1k', 'Audiometry ACR 1K'],
    ['acr_2k', 'Audiometry ACR 2K'], ['acr_3k', 'Audiometry ACR 3K'],
    ['acr_4k', 'Audiometry ACR 4K'], ['acr_6k', 'Audiometry ACR 6K'],
    ['acr_8k', 'Audiometry ACR 8K'], ['acl_500', 'Audiometry ACL 500'],
    ['acl_1k', 'Audiometry ACL 1K'], ['acl_2k', 'Audiometry ACL 2K'],
    ['acl_3k', 'Audiometry ACL 3K'], ['acl_4k', 'Audiometry ACL 4K'],
    ['acl_6k', 'Audiometry ACL 6K'], ['acl_8k', 'Audiometry ACL 8K'],
  ] as const).map(([id, label]) => f(id, label, 'audiometry', 'number', { unit: 'dB' })),
  // Pure Tone Average = rata-rata ambang dengar pada 500, 1000, 2000, dan
  // 4000 Hz (rumus WHO). Angka inilah yang dipakai klasifikasi NIHL
  // pada STD-006 (Hijau â‰¤25 dB, Kuning 26â€“40, Merah 41â€“90 / >90 dB),
  // sehingga tidak lagi bergantung pada teks interpretasi.
  f('pta', 'Audiometry PTA (Pure Tone Average)', 'audiometry', 'number', {
    unit: 'dB',
    normalRange: 'â‰¤25',
    autoCalc: true,
    autoCalcFrom: ['acr_500', 'acr_1k', 'acr_2k', 'acr_4k'],
  }),
  f('audInterp', 'Audiometry Interpretasi', 'audiometry'),

  // CUâ€“DB Neurologi
  f('balance', 'Balance Test', 'neuro', 'select', neurologicalSelect(['Normal', 'Abnormal'])),
  f('romberg', 'Romberg Test', 'neuro', 'select', neurologicalSelect(['Normal', 'Negatif', 'Positif'])),
  f('phalen', 'Phalen Test', 'neuro', 'select', neurologicalSelect(['Normal', 'Negatif', 'Positif'])),
  f('thinel', 'Thinel Test', 'neuro', 'select', neurologicalSelect(['Normal', 'Negatif', 'Positif'])),
  f('patrick', 'Patrick Test', 'neuro', 'select', neurologicalSelect(['Normal', 'Negatif', 'Positif'])),
  f('kontraPatrick', 'Kontra Patrick Test', 'neuro', 'select', neurologicalSelect(['Normal', 'Negatif', 'Positif'])),
  f('laseque', 'Laseque Test', 'neuro', 'select', neurologicalSelect(['Normal', 'Negatif', 'Positif'])),
  f('kernig', 'Kernig Test', 'neuro', 'select', neurologicalSelect(['Normal', 'Negatif', 'Positif'])),
  f('tesKebugaran', 'Tes Kebugaran (6 Minutes Walk Test, Harvard Step Test)', 'fitness', 'select', {
    options: ['Baik', 'Cukup', 'Kurang', 'Buruk', 'Tidak Dilakukan'],
    allowCustom: true,
  }),
  // Ringkasan otomatis dari tes kebugaran. Tes ini BUKAN parameter zonasi
  // menurut SOP, tetapi hasilnya tetap dicatat sebagai temuan.
  f('hasilKebugaran', 'Hasil Uji Kebugaran (Otomatis)', 'fitness', 'text', { autoCalc: true }),
  f('dugaanPAK', 'Dugaan PAK', 'assessment', 'select', { options: ['Ya', 'Tidak'] }),

  // DFâ€“DS Penilaian dan kalkulasi
  f('kesVendor', 'Kesimpulan Vendor', 'assessment', 'select', { options: kesimpulanOptions }),
  f('rekQSHE', 'Rekomendasi QSHE Medic', 'assessment', 'select', {
    options: kesimpulanOptions,
    autoSuggest: true,
  }),
  f('diagnosaMedis', 'Diagnosa Medis', 'assessment', 'textarea', { autoCalc: true }),
  // Ringkasan skor kuesioner terakhir, ditulis otomatis oleh engine
  // supaya QSHE Medic tidak perlu membuka tabel mcu_ess / mcu_mental_health.
  f('ringkasanKuesioner', 'Ringkasan Skor Kuesioner (Otomatis)', 'assessment', 'textarea', { autoCalc: true }),
  f('perluFU', 'Perlu Follow Up?', 'assessment', 'select', { options: ['Ya', 'Tidak'] }),
  f('rekFU', 'Rekomendasi Follow Up', 'assessment', 'select', {
    multiple: true,
    options: [
      'Dokter Umum',
      'Dokter Sp. PD',
      'Dokter Sp. JP',
      'Dokter Sp. P',
      'Dokter Sp. M',
      'Dokter Sp. GK / Ahli Gizi',
      'Psikiatri / Psikolog',
      'Dokter Gigi',
      'Dokter Sp. THT',
      'Dokter Sp. B',
      'Dokter Sp. U',
      'Dokter Sp. OT',
      'Dokter Sp. KK',
      'Pertahankan Kondisi Tubuh Bugar Dengan Diet Sehat & Rutin Olahraga',
    ],
  }),
  f('itemFU', 'Item Follow Up', 'assessment', 'textarea', { autoCalc: true }),
  f('linkMCU', 'Link File MCU', 'assessment'),
  f('tglExpired', 'Tanggal Expired MCU', 'calculated', 'date', { autoCalc: true, autoCalcFrom: ['tglMCU'] }),
  f('framScore', 'Framingham Score Lipid Based â€“ Score', 'calculated', 'number', { autoCalc: true }),
  f('framProb', 'Framingham Score Lipid Based â€“ Probabilitas', 'calculated', 'text', { autoCalc: true }),
  f('framKat', 'Framingham Score Lipid Based â€“ Kategori', 'calculated', 'text', { autoCalc: true }),
  f('zonasi', 'Zonasi', 'calculated', 'text', { autoCalc: true }),
  f('triggerZona', 'Trigger Zona Resiko Kesehatan', 'calculated', 'textarea', { autoCalc: true }),
  f('pengendalian', 'Pengendalian', 'calculated', 'textarea', { autoCalc: true }),
  // Frekuensi evaluasi ulang mengikuti poin 6.2.2 STD-006 Rev001: Hijau
  // minimal 1x/12 bulan, Kuning 3 bulan (Prediabetes 6 bulan), Merah 1 bulan.
  f('frekuensiEvaluasi', 'Frekuensi Evaluasi Ulang', 'calculated', 'text', { autoCalc: true }),
  // Peringatan hasil yang berada di luar rentang tabel SOP, mis. Hb pria
  // 10,0-10,9 g/dL. Tidak memengaruhi zona, tapi wajib ditinjau QSHE Medic.
  f('catatanSOP', 'Catatan di Luar Rentang Tabel SOP', 'calculated', 'textarea', { autoCalc: true }),

  // Catatan & Rekomendasi MCU
  f('catatan', 'Catatan & Rekomendasi', 'assessment', 'textarea'),
];

/** MCU_FIELDS dengan huruf dan indeks kolom yang sudah ditempel. */
export const MCU_FIELDS: MCUFieldDef[] = assignColumns(MCU_FIELD_DEFINITION);
export const TOTAL_COLS = MCU_FIELDS.length + 1; // + kolom A untuk nomor urut

export function normalizeMCUEcgOption(value: string): string {
  const token = value.toLowerCase().replace(/[^a-z]/g, '');
  const aliases: Record<string, string> = {
    normal: 'Normal Sinus Rhythm',
    normalsinusrythm: 'Normal Sinus Rhythm',
    sinusrythm: 'Normal Sinus Rhythm',
    normalvariantofrestingecg: 'Normal Variations of Resting ECG',
  };
  const candidate = aliases[token] || value.trim();
  const candidateToken = candidate.toLowerCase().replace(/[^a-z0-9]/g, '');
  return MCU_FIELDS.find((field) => field.id === 'ecgHasil')?.options
    ?.find((option) => option.toLowerCase().replace(/[^a-z0-9]/g, '') === candidateToken)
    || candidate;
}

export function getFieldsBySection(sectionId: string): MCUFieldDef[] {
  return MCU_FIELDS.filter(field => field.section === sectionId);
}

export function getFieldById(id: string): MCUFieldDef | undefined {
  return MCU_FIELDS.find(field => field.id === id);
}

// ============================================================
// Urinalisis â€” 19 parameter per kolom (ul_*) + ringkasan komposit `ul`
// ============================================================
// Setiap parameter disimpan di kolom database sendiri (ul_warna, ul_protein,
// dst.) supaya bisa di-query per parameter. Kolom `ul` lama tetap diisi
// otomatis sebagai ringkasan komposit "Label: nilai" untuk engine zonasi,
// diagnosis, dan kompatibilitas Eksel lama.
//
// Map antar field id (di MCU_FIELDS) dengan label teks ringkasan `ul`:
//   ulWarna            â†’ "Warna: Kuning Muda"
//   ulKejernihan       â†’ "Kejernihan: Jernih"
//   ulBau              â†’ "Bau: Aromatik"
//   ulBeratJenis       â†’ "Berat Jenis (SG): 1.015"
//   ulPh               â†’ "pH: 6.0"
//   ulProtein          â†’ "Protein / Albumin: +1"
//   ... dst sesuai URINALYSIS_PARAMS.
//
// Fungsi:
//   buildUlComposite(params)    â†’ "Label: nilai\n..." untuk disimpan di `ul`
//   parseUlToParams(composite)  â†’ { ulWarna: 'Kuning Muda', ... }
//                                   untuk load data lama `ul` â†’ 19 kolom.

export const URINALYSIS_FIELD_LABELS: Record<string, string> = {
  ulWarna: 'Warna',
  ulKejernihan: 'Kejernihan',
  ulBau: 'Bau',
  ulBeratJenis: 'Berat Jenis (SG)',
  ulPh: 'pH',
  ulProtein: 'Protein / Albumin',
  ulGlukosa: 'Glukosa / Reduksi',
  ulKeton: 'Keton',
  ulDarah: 'Darah / Darah Samar',
  ulLeukositEsterase: 'Leukosit Esterase',
  ulNitrit: 'Nitrit',
  ulBilirubin: 'Bilirubin',
  ulUrobilinogen: 'Urobilinogen',
  ulEritrosit: 'Eritrosit / Sel Darah Merah',
  ulLeukosit: 'Leukosit / Sel Darah Putih',
  ulSelEpitel: 'Sel Epitel',
  ulSilinder: 'Silinder (Casts)',
  ulKristal: 'Kristal',
  ulBakteri: 'Bakteri / Mikroorganisme',
};

export const URINALYSIS_FIELD_IDS: string[] = Object.keys(URINALYSIS_FIELD_LABELS);

/** Gabungkan 19 field urinalisis menjadi ringkasan komposit `ul`. */
export function buildUlComposite(values: Record<string, string | undefined | null>): string {
  const lines: string[] = [];
  for (const fieldId of URINALYSIS_FIELD_IDS) {
    const label = URINALYSIS_FIELD_LABELS[fieldId];
    const v = values[fieldId];
    if (v == null || String(v).trim() === '') continue;
    lines.push(`${label}: ${String(v).trim()}`);
  }
  return lines.join('\n');
}

/**
 * Pecah ringkasan komposit `ul` ("Label: nilai\n...") menjadi 19 field.
 * Dipakai untuk load record lama di mana kolom `ul_*` masih kosong.
 * Return map `{ ulWarna: 'Kuning Muda', ... }` â€” hanya field yang terisi.
 */
export function parseUlToParams(raw: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  const labelToField: Record<string, string> = {};
  for (const [fieldId, label] of Object.entries(URINALYSIS_FIELD_LABELS)) {
    labelToField[label] = fieldId;
  }
  const lines = String(raw).split(/[\n;|]+/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^([^:=]+)[:=]\s*(.+)$/);
    if (!m) continue;
    const label = m[1].trim();
    const value = m[2].trim();
    const fieldId = labelToField[label];
    if (fieldId) out[fieldId] = value;
  }
  return out;
}


