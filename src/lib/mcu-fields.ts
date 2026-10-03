// ============================================================
// MCU Field Definitions
// ============================================================
// Kolom A adalah nomor urut yang dibuat otomatis, jadi field pertama
// (NIK KTP) berada di kolom B. Huruf dan indeks kolom DITURUNKAN dari
// urutan deklarasi di bawah — lihat assignColumns().
//
// The order here is the Excel/Supabase contract for Record MCU.
// Menyisipkan field baru cukup menaruhnya pada posisi yang tepat;
// seluruh field setelahnya otomatis bergeser.
// ============================================================

import {
  ASTHMA_OPTIONS,
  CARDIAC_OPTIONS,
  EPILEPSY_OPTIONS,
  LBP_OPTIONS,
  SLEEP_APNEA_OPTIONS,
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
  autoCalc?: boolean;
  autoCalcFrom?: string[];
  textNA?: boolean;
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
  ...(type === 'text' || type === 'textarea' ? { textNA: true } : {}),
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
const select = (options: string[]): FieldOptions => ({ options, textNA: true });
const neurologicalSelect = (options: string[]): FieldOptions => ({ options, textNA: false });
const kesimpulanOptions = ['Fit To Work', 'Fit With Note', 'Fit With Restriction', 'Currently Unfit', 'Unfit', 'Temporary Unfit'];

/**
 * Opsi hasil bacaan EKG.
 *
 * Urutan mengikuti tingkat keparahan: normal dulu, lalu kuning, lalu
 * merah, supaya operator yang memilih dari atas melihat temuan ringan
 * lebih dulu dan tidak salah pilih.
 *
 * Istilah diagnosis memakai bahasa Inggris dan penulisan yang sama
 * dengan label di clinical-classification.ts, supaya diagnosis otomatis
 * dan pilihan operator tidak berbeda.
 */
const ECG_OPTIONS = [
  // Normal
  'Normal Sinus Rhythm',
  'Normal Variant of Resting ECG',
  // Kuning
  'Sinus Bradycardia',
  'Sinus Tachycardia',
  'Sinus Arrhythmia',
  'Low Atrial Rhythm',
  'Right Axis Deviation',
  'Left Axis Deviation',
  'Incomplete Right Bundle Branch Block',
  'Right Bundle Branch Block',
  'Left Bundle Branch Block',
  'Left Ventricular Hypertrophy',
  'Right Ventricular Hypertrophy',
  'Premature Ventricular Contraction',
  // Puncak T menjunjai hiperkalemia. Tidak ada kategori khusus untuk ini
// pada STD-006 Rev001, jadi hanya ditandai "kuning" (perlu konfirmasi),
// bukan "merah". Sumber data memuat satu bacaan seperti ini dan tidak
// ada opsi lain yang tepat untuk memetanya.
  'Peaked T Waves',
  // Merah
  'Atrioventricular Block',
  'Atrial Fibrillation',
  'ST Segment Abnormal',
  'Acute Myocardial Infarction',
  'Not Performed',
];

/**
 * Opsi hasil Exercise Treadmill Test.
 *
 * "Non-Diagnostic Test" sengaja berdiri sendiri dan bukan dianggap
 * normal: tesnya tidak selesai sehingga wajib diulang.
 */
const TREADMILL_OPTIONS = [
  'Negative Ischemic Response',
  'Positive Ischemic Response',
  'Non-Diagnostic Test (Target Heart Rate Not Achieved)',
  'Ventricular Ectopy during Exercise',
  'Abnormal Blood Pressure Response',
  'Not Performed',
];

export const MCU_FIELD_DEFINITION: MCUFieldDef[] = [
  // B–J Identitas
  f('nationalId', 'NIK KTP', 'identity', 'text', { textNA: false }),
  f('nikKaryawan', 'NIK Karyawan', 'identity', 'text', { textNA: false }),
  f('nama', 'Nama', 'identity'),
  f('usia', 'Usia', 'identity', 'number', { unit: 'tahun', autoCalc: true }),
  f('jenisKelamin', 'Jenis Kelamin', 'identity', 'select', { options: ['Laki - Laki', 'Perempuan'] }),
  f('jabatan', 'Jabatan', 'identity'),
  f('site', 'Site', 'identity'),
  f('statusMCU', 'Status MCU', 'identity', 'select', {
    options: ['Pre Employee', 'Annual', 'Specific', 'Retirement', 'Follow Up - Pre Employee', 'Follow Up - Annual'],
  }),
  f('tglMCU', 'Tanggal MCU', 'identity', 'date', { textNA: false }),
  f('tempatMCU', 'Tempat MCU', 'identity'),

  // K–N Fisik
  f('golDarah', 'Golongan Darah & Rhesus', 'physical', 'select', select(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'N/A'])),
  f('gigiMulut', 'Gigi & Mulut', 'physical', 'textarea'),
  f('fisikHeadToToe', 'Fisik Head To Toe', 'physical', 'textarea'),
  f('hemoroid', 'Hemoroid', 'physical', 'select', select(['Negatif', 'Positif', 'Menolak RT', 'N/A'])),

  // O–S Mata
  f('visusJauh', 'Visus Jauh', 'vision'),
  f('visusDekat', 'Visus Dekat', 'vision'),
  f('defWarna', 'Defisiensi Persepsi Warna', 'vision', 'select', select(['Normal', 'Protan', 'Deutan', 'Tritan', 'Total', 'N/A'])),
  f('lapangPandang', 'Lapang Pandang', 'vision'),
  f('fisikMata', 'Fisik Mata', 'vision', 'textarea'),

  // T–AA Tanda vital
  f('merokok', 'Merokok', 'vital', 'select', select(['Ya', 'Tidak', 'Sudah Berhenti', 'N/A'])),
  f('tdS', 'Tekanan Darah Sistole (90-119)', 'vital', 'number', normal('90-119', 'mmHg')),
  f('tdD', 'Tekanan Darah Diastole (60-79)', 'vital', 'number', normal('60-79', 'mmHg')),
  f('nadi', 'Nadi < 100 bpm', 'vital', 'number', { unit: 'bpm', high: 100 }),
  f('bb', 'BB (kg)', 'vital', 'number', { unit: 'kg' }),
  f('tb', 'TB (cm)', 'vital', 'number', { unit: 'cm' }),
  f('bmi', 'BMI < 30', 'vital', 'number', { unit: 'kg/m²', high: 30, autoCalc: true, autoCalcFrom: ['bb', 'tb'] }),
  f('lp', 'LP (L < 90, P < 80)', 'vital', 'number', { unit: 'cm', normalMale: '<90', normalFemale: '<80' }),

  // AB–AJ Hematologi
  f('hb', 'Hb (L 13-16,5 g/dL, P 12-15 g/dL)', 'hematology', 'number', { unit: 'g/dL', normalMale: '13-16,5', normalFemale: '12-15', lowMale: 13, highMale: 16.5, lowFemale: 12, highFemale: 15 }),
  f('leukosit', 'Leukosit 4-11 10³/µL', 'hematology', 'number', normal('4-11', '10³/µL')),
  f('eritrosit', 'Eritrosit 4,5-6,2 10⁶/µL', 'hematology', 'number', normal('4,5-6,2', '10⁶/µL')),
  f('hematokrit', 'Hematokrit 40-54%', 'hematology', 'number', normal('40-54', '%')),
  f('trombosit', 'Trombosit 150-400 10³/µL', 'hematology', 'number', normal('150-400', '10³/µL')),
  f('mcv', 'MCV 80-100 fL', 'hematology', 'number', normal('80-100', 'fL')),
  f('mch', 'MCH 26-34 pg', 'hematology', 'number', normal('26-34', 'pg')),
  f('mchc', 'MCHC 31-37 g/dL', 'hematology', 'number', { ...normal('31-37', 'g/dL'), autoCalc: true, autoCalcFrom: ['hb', 'hematokrit'] }),
  f('led', 'LED (L 0-15 mm/j, P 0-20 mm/j)', 'hematology', 'number', { unit: 'mm/j', normalMale: '0-15', normalFemale: '0-20' }),

  // AK–BB Kimia darah
  f('chol', 'Chol <200 mg/dL', 'chemistry', 'number', normal('<200', 'mg/dL')),
  f('tg', 'TG <150 mg/dL', 'chemistry', 'number', normal('<150', 'mg/dL')),
  f('hdl', 'HDL ≥50 mg/dL', 'chemistry', 'number', normal('≥50', 'mg/dL')),
  f('ldl', 'LDL <100 mg/dL', 'chemistry', 'number', normal('<100', 'mg/dL')),
  f('gdp', 'GDP 70-100 mg/dL', 'chemistry', 'number', normal('70-100', 'mg/dL')),
  f('gd2pp', 'GD2PP <140 mg/dL', 'chemistry', 'number', normal('<140', 'mg/dL')),
  f('hba1c', 'HbA1c <6,5%', 'chemistry', 'number', normal('<6,5', '%')),
  f('diabetes', 'Diabetes', 'chemistry', 'select', { options: ['Ya', 'Tidak'], autoCalc: true, autoCalcFrom: ['gdp', 'gd2pp', 'hba1c'] }),
  f('au', 'AU (L 3,4-7,0 mg/dL, P 2,4-6,0 mg/dL)', 'chemistry', 'number', { unit: 'mg/dL', normalMale: '3,4-7,0', normalFemale: '2,4-6,0' }),
  f('ureum', 'Ureum 16,6-48,5 mg/dL', 'chemistry', 'number', normal('16,6-48,5', 'mg/dL')),
  f('kreatinin', 'Kreatinin 0.6-1.2 mg/dL', 'chemistry', 'number', normal('0.6-1.2', 'mg/dL')),
  // eGFR boleh diisi manual dari hasil laboratorium. Bila kosong, engine
  // menghitungnya otomatis dengan CKD-EPI 2021 dari kreatinin + usia + jenis kelamin.
  f('egfr', 'eGFR ≥90 mL/menit/1,73 m²', 'chemistry', 'number', { ...normal('≥90', 'mL/menit/1,73 m²'), autoCalc: true, autoCalcFrom: ['kreatinin', 'usia', 'jenisKelamin'] }),
  f('sgot', 'SGOT <40 U/L', 'chemistry', 'number', normal('<40', 'U/L')),
  f('sgpt', 'SGPT <41 U/L', 'chemistry', 'number', normal('<41', 'U/L')),
  f('ggt', 'GGT 8-61 U/L', 'chemistry', 'number', normal('8-61', 'U/L')),
  f('alp', 'ALP 44-147 IU/L', 'chemistry', 'number', normal('44-147', 'IU/L')),
  f('billirubin', 'Bilirubin 0,2-1,2 mg/dL', 'chemistry', 'number', normal('0,2-1,2', 'mg/dL')),
  f('ul', 'UL', 'chemistry', 'textarea'),

  // BC–BG Serologi
  ...([
    ['hbsag', 'HbsAg'], ['antiHbs', 'Anti Hbs'], ['vdrl', 'VDRL'],
    ['tpha', 'TPHA'], ['hiv', 'HIV'],
  ] as const).map(([id, label]) => f(id, label, 'serology', 'select', select(['Non - Reaktif', 'Reaktif', 'N/A']))),

  // BH–BP NAPZA
  ...([
    ['drugAmp', 'Drug Test Amphetamine'], ['drugMeth', 'Drug Test Methamphetamine'],
    ['drugMorph', 'Drug Test Morphine'], ['drugCanna', 'Drug Test Cannabinoid'],
    ['drugCoc', 'Drug Test Coccain'], ['drugBenz', 'Drug Test Benzodiazepine'],
    ['drugCaris', 'Drug Test Carisoprodol'], ['alkohol', 'Alkohol Test'],
  ] as const).map(([id, label]) => f(id, label, 'drug', 'select', select(['Negatif', 'Positif', 'N/A']))),
  f('psa', 'PSA', 'drug', 'number', { unit: 'ng/mL', normalRange: '<4' }),

  // BQ–BU Imaging
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
  f('ecgHasil', 'ECG', 'imaging', 'select', { ...select(ECG_OPTIONS), allowCustom: true }),
  f('tmHasil', 'Treadmill', 'imaging', 'select', { ...select(TREADMILL_OPTIONS), allowCustom: true }),
  f('chestXR', 'Chest X-Ray', 'imaging', 'textarea'),
  f('lumboXR', 'Lumbosacral X-Ray', 'imaging', 'textarea'),
  f('usg', 'USG', 'imaging', 'textarea'),

  // Riwayat penyakit & skor kuesioner — parameter zonasi menurut
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
    textNA: false,
  }),
  f('riwayatJantung', 'Riwayat Penyakit Jantung', 'anamnesis', 'select', {
    options: [...CARDIAC_OPTIONS],
    multiple: true,
    textNA: false,
  }),
  f('riwayatStroke', 'Riwayat Stroke', 'anamnesis', 'select', {
    options: [...STROKE_OPTIONS],
    multiple: true,
    textNA: false,
  }),
  f('riwayatAsma', 'Riwayat Asma / Gangguan Napas', 'anamnesis', 'select', {
    options: [...ASTHMA_OPTIONS],
    multiple: true,
    textNA: false,
  }),
  f('riwayatSleepApnea', 'Riwayat Sleep Apnea', 'anamnesis', 'select', {
    options: [...SLEEP_APNEA_OPTIONS],
    multiple: true,
    textNA: false,
  }),
  f('lbp', 'Nyeri Punggung Bawah (Low Back Pain)', 'anamnesis', 'select', {
    options: [...LBP_OPTIONS],
    textNA: false,
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
  f('sdsScore', 'Indeks SDS (Zung Depression Scale)', 'anamnesis', 'number', {
    unit: 'indeks', normalRange: '20-49', min: 20, max: 80,
  }),

  // BV–CE Spirometry
  f('fvcPred', 'Spirometry FVC PRED', 'spirometry', 'number', { unit: 'L' }),
  f('fvcAct', 'Spirometry FVC ACT', 'spirometry', 'number', { unit: 'L' }),
  f('fvcPct', 'Spirometry FVC %', 'spirometry', 'number', { unit: '%', autoCalc: true, autoCalcFrom: ['fvcAct', 'fvcPred'] }),
  f('fev1Pred', 'Spirometry FEV1 PRED', 'spirometry', 'number', { unit: 'L' }),
  f('fev1Act', 'Spirometry FEV1 ACT', 'spirometry', 'number', { unit: 'L' }),
  f('fev1Pct', 'Spirometry FEV1 %', 'spirometry', 'number', { unit: '%', autoCalc: true, autoCalcFrom: ['fev1Act', 'fev1Pred'] }),
  f('fev1FvcPred', 'Spirometry FEV1%G PRED', 'spirometry', 'number', { unit: '%' }),
  f('fev1FvcAct', 'Spirometry FEV1%G ACT', 'spirometry', 'number', { unit: '%', autoCalc: true, autoCalcFrom: ['fev1Act', 'fvcAct'] }),
  f('fev1FvcPct', 'Spirometry FEV1%G %', 'spirometry', 'number', { unit: '%', autoCalc: true, autoCalcFrom: ['fev1FvcAct', 'fev1FvcPred'] }),
  f('spiInterp', 'Spirometry Interpretasi', 'spirometry'),

  // CF–CT Audiometry (ACR first, as specified)
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
  // pada STD-006 (Hijau ≤25 dB, Kuning 26–40, Merah 41–90 / >90 dB),
  // sehingga tidak lagi bergantung pada teks interpretasi.
  f('pta', 'Audiometry PTA (Pure Tone Average)', 'audiometry', 'number', {
    unit: 'dB',
    normalRange: '≤25',
    autoCalc: true,
    autoCalcFrom: ['acr_500', 'acr_1k', 'acr_2k', 'acr_4k'],
  }),
  f('audInterp', 'Audiometry Interpretasi', 'audiometry'),

  // CU–DB Neurologi
  f('balance', 'Balance Test', 'neuro', 'select', neurologicalSelect(['Normal', 'Abnormal'])),
  f('romberg', 'Romberg Test', 'neuro', 'select', neurologicalSelect(['Normal', 'Negatif', 'Positif'])),
  f('phalen', 'Phalen Test', 'neuro', 'select', neurologicalSelect(['Normal', 'Negatif', 'Positif'])),
  f('thinel', 'Thinel Test', 'neuro', 'select', neurologicalSelect(['Normal', 'Negatif', 'Positif'])),
  f('patrick', 'Patrick Test', 'neuro', 'select', neurologicalSelect(['Normal', 'Negatif', 'Positif'])),
  f('kontraPatrick', 'Kontra Patrick Test', 'neuro', 'select', neurologicalSelect(['Normal', 'Negatif', 'Positif'])),
  f('laseque', 'Laseque Test', 'neuro', 'select', neurologicalSelect(['Normal', 'Negatif', 'Positif'])),
  f('kernig', 'Kernig Test', 'neuro', 'select', neurologicalSelect(['Normal', 'Negatif', 'Positif'])),
  f('tesKebugaran', 'Tes Kebugaran (6 Minutes Walk Test, Harvard Step Test)', 'fitness', 'textarea'),
  // Ringkasan otomatis dari tes kebugaran. Tes ini BUKAN parameter zonasi
  // menurut SOP, tetapi hasilnya tetap dicatat sebagai temuan.
  f('hasilKebugaran', 'Hasil Uji Kebugaran (Otomatis)', 'fitness', 'text', { autoCalc: true }),
  f('pemeriksaanLain', 'Pemeriksaan Lain', 'assessment', 'textarea'),
  f('dugaanPAK', 'Dugaan PAK', 'assessment', 'select', { options: ['Ya', 'Tidak'] }),

  // DF–DS Penilaian dan kalkulasi
  f('kesVendor', 'Kesimpulan Vendor', 'assessment', 'select', { options: kesimpulanOptions }),
  f('rekQSHE', 'Rekomendasi QSHE Medic', 'assessment', 'select', {
    options: kesimpulanOptions,
  }),
  f('diagnosaMedis', 'Diagnosa Medis', 'assessment', 'textarea', { autoCalc: true }),
  // Ringkasan skor kuesioner terakhir, ditulis otomatis oleh engine
  // supaya QSHE Medic tidak perlu membuka tabel mcu_ess / mcu_mental_health.
  f('ringkasanKuesioner', 'Ringkasan Skor Kuesioner (Otomatis)', 'assessment', 'textarea', { autoCalc: true }),
  f('perluFU', 'Perlu Follow Up?', 'assessment', 'select', { options: ['Ya', 'Tidak'] }),
  f('rekFU', 'Rekomendasi follow up', 'assessment', 'select', {
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
  f('tglExpired', 'Tanggal Expired MCU', 'calculated', 'date', { autoCalc: true, autoCalcFrom: ['tglMCU'], textNA: false }),
  f('framScore', 'Framingham Score Lipid Based – Score', 'calculated', 'number', { autoCalc: true }),
  f('framProb', 'Framingham Score Lipid Based – Probabilitas', 'calculated', 'text', { autoCalc: true }),
  f('framKat', 'Framingham Score Lipid Based – Kategori', 'calculated', 'text', { autoCalc: true }),
  f('zonasi', 'Zonasi', 'calculated', 'text', { autoCalc: true }),
  f('triggerZona', 'Trigger Zona Resiko Kesehatan', 'calculated', 'textarea', { autoCalc: true }),
  f('pengendalian', 'Pengendalian', 'calculated', 'textarea', { autoCalc: true }),
  // Frekuensi evaluasi ulang mengikuti poin 6.2.2 STD-006 Rev001: Hijau
  // minimal 1x/12 bulan, Kuning 3 bulan (Prediabetes 6 bulan), Merah 1 bulan.
  f('frekuensiEvaluasi', 'Frekuensi Evaluasi Ulang', 'calculated', 'text', { autoCalc: true }),
  // Peringatan hasil yang berada di luar rentang tabel SOP, mis. Hb pria
  // 10,0-10,9 g/dL. Tidak memengaruhi zona, tapi wajib ditinjau QSHE Medic.
  f('catatanSOP', 'Catatan di Luar Rentang Tabel SOP', 'calculated', 'textarea', { autoCalc: true }),

  // DT–EL Follow-up
  f('tglFU1', 'Tanggal Follow Up I', 'assessment', 'date', { textNA: false }),
  f('lokasiFU1', 'Lokasi Follow Up I', 'assessment'),
  f('hasilFU1', 'Hasil Follow Up I', 'assessment', 'textarea'),
  f('kesimpulanFU1', 'Kesimpulan Setelah Follow Up I', 'assessment', 'select', { options: kesimpulanOptions }),
  f('linkFU1', 'Link File Hasil Follow Up I', 'assessment'),
  f('rekFU2', 'Rekomendasi FU II', 'assessment', 'textarea'),
  f('tglFU2', 'Tanggal Follow Up II', 'assessment', 'date', { textNA: false }),
  f('lokasiFU2', 'Lokasi Follow Up II', 'assessment'),
  f('hasilFU2', 'Hasil Follow Up II', 'assessment', 'textarea'),
  f('kesimpulanFU2', 'Kesimpulan Setelah Follow Up II', 'assessment', 'select', { options: kesimpulanOptions }),
  f('linkFU2', 'Link File Hasil Follow Up II', 'assessment'),
  f('rekFU3', 'Rekomendasi FU III', 'assessment', 'textarea'),
  f('tglFU3', 'Tanggal Follow Up III', 'assessment', 'date', { textNA: false }),
  f('lokasiFU3', 'Lokasi Follow Up III', 'assessment'),
  f('hasilFU3', 'Hasil Follow Up III', 'assessment', 'textarea'),
  f('kesimpulanFU3', 'Kesimpulan Setelah Follow Up III', 'assessment', 'select', { options: kesimpulanOptions }),
  f('linkFU3', 'Link File Hasil Follow Up III', 'assessment'),
  f('rekFU4', 'Rekomendasi FU IV', 'assessment', 'textarea'),
  f('catatan', 'Catatan & Rekomendasi', 'assessment', 'textarea', { textNA: false }),
];

/** MCU_FIELDS dengan huruf dan indeks kolom yang sudah ditempel. */
export const MCU_FIELDS: MCUFieldDef[] = assignColumns(MCU_FIELD_DEFINITION);

export const TEXT_NA_INDICES = MCU_FIELDS.filter(field => field.textNA).map(field => field.colIndex);
export const TOTAL_COLS = MCU_FIELDS.length + 1; // + kolom A untuk nomor urut

export function getFieldsBySection(sectionId: string): MCUFieldDef[] {
  return MCU_FIELDS.filter(field => field.section === sectionId);
}

export function getFieldById(id: string): MCUFieldDef | undefined {
  return MCU_FIELDS.find(field => field.id === id);
}
