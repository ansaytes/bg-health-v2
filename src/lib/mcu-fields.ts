// ============================================================
// MCU Field Definitions — B–EM (142 data columns)
// Column A is the generated row number and is not form data.
// The order here is the Excel/Supabase contract for Record MCU.
// ============================================================

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

function shiftedColumn(col: string): string {
  if (col === 'B') return col;
  let carry = 1;
  const chars = col.split('');
  for (let i = chars.length - 1; i >= 0 && carry; i -= 1) {
    const next = chars[i].charCodeAt(0) - 64 + carry;
    if (next > 26) {
      chars[i] = 'A';
      carry = 1;
    } else {
      chars[i] = String.fromCharCode(64 + next);
      carry = 0;
    }
  }
  return carry ? `A${chars.join('')}` : chars.join('');
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
  { id: 'spirometry', label: 'Spirometri', icon: 'Wind', order: 9 },
  { id: 'audiometry', label: 'Audiometri', icon: 'Ear', order: 10 },
  { id: 'neuro', label: 'Neurologi', icon: 'Brain', order: 11 },
  { id: 'fitness', label: 'Kebugaran', icon: 'Dumbbell', order: 12 },
  { id: 'assessment', label: 'Penilaian', icon: 'ClipboardCheck', order: 13 },
  { id: 'calculated', label: 'Hasil Kalkulasi', icon: 'Calculator', order: 14 },
] as const;

type FieldOptions = Omit<MCUFieldDef, 'id' | 'col' | 'colIndex' | 'label' | 'section' | 'sectionOrder'>;
const f = (
  id: string,
  col: string,
  label: string,
  section: string,
  type: FieldType = 'text',
  options: FieldOptions = {},
  preserveColumn = false,
): MCUFieldDef => ({
  id,
  col: preserveColumn ? col : shiftedColumn(col),
  colIndex: columnIndex(preserveColumn ? col : shiftedColumn(col)),
  label,
  section,
  sectionOrder: 0,
  type,
  ...(type === 'text' || type === 'textarea' ? { textNA: true } : {}),
  ...options,
});

function columnIndex(col: string): number {
  let result = 0;
  for (const char of col) result = result * 26 + char.charCodeAt(0) - 64;
  return result - 1;
}

const normal = (normalRange: string, unit?: string): FieldOptions => ({ normalRange, unit });
const select = (options: string[]): FieldOptions => ({ options, textNA: true });

export const MCU_FIELDS: MCUFieldDef[] = [
  // B–J Identitas
  f('nationalId', 'B', 'NIK KTP', 'identity', 'text', { textNA: false }),
  f('nikKaryawan', 'C', 'NIK Karyawan', 'identity', 'text', { textNA: false }, true),
  f('nama', 'C', 'Nama', 'identity'),
  f('usia', 'D', 'Usia', 'identity', 'number', { unit: 'tahun', autoCalc: true }),
  f('jenisKelamin', 'E', 'Jenis Kelamin', 'identity', 'select', { options: ['Laki - Laki', 'Perempuan'] }),
  f('jabatan', 'F', 'Jabatan', 'identity'),
  f('site', 'G', 'Site', 'identity'),
  f('statusMCU', 'H', 'Status MCU', 'identity', 'select', {
    options: ['Pre Employee', 'Annual', 'Specific', 'Retirement', 'Follow Up - Pre Employee', 'Follow Up - Annual'],
  }),
  f('tglMCU', 'I', 'Tanggal MCU', 'identity', 'date', { textNA: false }),
  f('tempatMCU', 'J', 'Tempat MCU', 'identity'),

  // K–N Fisik
  f('golDarah', 'K', 'Golongan Darah & Rhesus', 'physical', 'select', select(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'N/A'])),
  f('gigiMulut', 'L', 'Gigi & Mulut', 'physical', 'textarea'),
  f('fisikHeadToToe', 'M', 'Fisik Head To Toe', 'physical', 'textarea'),
  f('hemoroid', 'N', 'Hemoroid', 'physical', 'select', select(['Negatif', 'Positif', 'Menolak RT', 'N/A'])),

  // O–S Mata
  f('visusJauh', 'O', 'Visus Jauh', 'vision'),
  f('visusDekat', 'P', 'Visus Dekat', 'vision'),
  f('defWarna', 'Q', 'Defisiensi Persepsi Warna', 'vision', 'select', select(['Normal', 'Protan', 'Deutan', 'Tritan', 'Total', 'N/A'])),
  f('lapangPandang', 'R', 'Lapang Pandang', 'vision'),
  f('fisikMata', 'S', 'Fisik Mata', 'vision', 'textarea'),

  // T–AA Tanda vital
  f('merokok', 'T', 'Merokok', 'vital', 'select', select(['Ya', 'Tidak', 'Sudah Berhenti', 'N/A'])),
  f('tdS', 'U', 'Tekanan Darah Sistole (90-119)', 'vital', 'number', normal('90-119', 'mmHg')),
  f('tdD', 'V', 'Tekanan Darah Diastole (60-79)', 'vital', 'number', normal('60-79', 'mmHg')),
  f('nadi', 'W', 'Nadi < 100 bpm', 'vital', 'number', { unit: 'bpm', high: 100 }),
  f('bb', 'X', 'BB (kg)', 'vital', 'number', { unit: 'kg' }),
  f('tb', 'Y', 'TB (cm)', 'vital', 'number', { unit: 'cm' }),
  f('bmi', 'Z', 'BMI < 30', 'vital', 'number', { unit: 'kg/m²', high: 30, autoCalc: true, autoCalcFrom: ['bb', 'tb'] }),
  f('lp', 'AA', 'LP (L < 90, P < 80)', 'vital', 'number', { unit: 'cm', normalMale: '<90', normalFemale: '<80' }),

  // AB–AJ Hematologi
  f('hb', 'AB', 'Hb (L 13-16,5 g/dL, P 12-15 g/dL)', 'hematology', 'number', { unit: 'g/dL', normalMale: '13-16,5', normalFemale: '12-15', lowMale: 13, highMale: 16.5, lowFemale: 12, highFemale: 15 }),
  f('leukosit', 'AC', 'Leukosit 4-11 10³/µL', 'hematology', 'number', normal('4-11', '10³/µL')),
  f('eritrosit', 'AD', 'Eritrosit 4,5-6,2 10⁶/µL', 'hematology', 'number', normal('4,5-6,2', '10⁶/µL')),
  f('hematokrit', 'AE', 'Hematokrit 40-54%', 'hematology', 'number', normal('40-54', '%')),
  f('trombosit', 'AF', 'Trombosit 150-400 10³/µL', 'hematology', 'number', normal('150-400', '10³/µL')),
  f('mcv', 'AG', 'MCV 80-100 fL', 'hematology', 'number', normal('80-100', 'fL')),
  f('mch', 'AH', 'MCH 26-34 pg', 'hematology', 'number', normal('26-34', 'pg')),
  f('mchc', 'AI', 'MCHC 31-37 g/dL', 'hematology', 'number', { ...normal('31-37', 'g/dL'), autoCalc: true, autoCalcFrom: ['hb', 'hematokrit'] }),
  f('led', 'AJ', 'LED (L 0-15 mm/j, P 0-20 mm/j)', 'hematology', 'number', { unit: 'mm/j', normalMale: '0-15', normalFemale: '0-20' }),

  // AK–BB Kimia darah
  f('chol', 'AK', 'Chol <200 mg/dL', 'chemistry', 'number', normal('<200', 'mg/dL')),
  f('tg', 'AL', 'TG <150 mg/dL', 'chemistry', 'number', normal('<150', 'mg/dL')),
  f('hdl', 'AM', 'HDL ≥50 mg/dL', 'chemistry', 'number', normal('≥50', 'mg/dL')),
  f('ldl', 'AN', 'LDL <100 mg/dL', 'chemistry', 'number', normal('<100', 'mg/dL')),
  f('gdp', 'AO', 'GDP 70-100 mg/dL', 'chemistry', 'number', normal('70-100', 'mg/dL')),
  f('gd2pp', 'AP', 'GD2PP <140 mg/dL', 'chemistry', 'number', normal('<140', 'mg/dL')),
  f('hba1c', 'AQ', 'HbA1c <6,5%', 'chemistry', 'number', normal('<6,5', '%')),
  f('diabetes', 'AR', 'Diabetes', 'chemistry', 'select', { options: ['Ya', 'Tidak'], autoCalc: true, autoCalcFrom: ['gdp', 'gd2pp', 'hba1c'] }),
  f('au', 'AS', 'AU (L 3,4-7,0 mg/dL, P 2,4-6,0 mg/dL)', 'chemistry', 'number', { unit: 'mg/dL', normalMale: '3,4-7,0', normalFemale: '2,4-6,0' }),
  f('ureum', 'AT', 'Ureum 16,6-48,5 mg/dL', 'chemistry', 'number', normal('16,6-48,5', 'mg/dL')),
  f('kreatinin', 'AU', 'Kreatinin 0.6-1.2 mg/dL', 'chemistry', 'number', normal('0.6-1.2', 'mg/dL')),
  f('egfr', 'AV', 'eGFR ≥90 mL/menit/1,73 m²', 'chemistry', 'number', normal('≥90', 'mL/menit/1,73 m²')),
  f('sgot', 'AW', 'SGOT <40 U/L', 'chemistry', 'number', normal('<40', 'U/L')),
  f('sgpt', 'AX', 'SGPT <41 U/L', 'chemistry', 'number', normal('<41', 'U/L')),
  f('ggt', 'AY', 'GGT 8-61 U/L', 'chemistry', 'number', normal('8-61', 'U/L')),
  f('alp', 'AZ', 'ALP 44-147 IU/L', 'chemistry', 'number', normal('44-147', 'IU/L')),
  f('billirubin', 'BA', 'Bilirubin 0,2-1,2 mg/dL', 'chemistry', 'number', normal('0,2-1,2', 'mg/dL')),
  f('ul', 'BB', 'UL', 'chemistry', 'textarea'),

  // BC–BG Serologi
  ...([
    ['hbsag', 'BC', 'HbsAg'], ['antiHbs', 'BD', 'Anti Hbs'], ['vdrl', 'BE', 'VDRL'],
    ['tpha', 'BF', 'TPHA'], ['hiv', 'BG', 'HIV'],
  ] as const).map(([id, col, label]) => f(id, col, label, 'serology', 'select', select(['Non - Reaktif', 'Reaktif', 'N/A']))),

  // BH–BP NAPZA
  ...([
    ['drugAmp', 'BH', 'Drug Test Amphetamine'], ['drugMeth', 'BI', 'Drug Test Methamphetamine'],
    ['drugMorph', 'BJ', 'Drug Test Morphine'], ['drugCanna', 'BK', 'Drug Test Cannabinoid'],
    ['drugCoc', 'BL', 'Drug Test Coccain'], ['drugBenz', 'BM', 'Drug Test Benzodiazepine'],
    ['drugCaris', 'BN', 'Drug Test Carisoprodol'], ['alkohol', 'BO', 'Alkohol Test'],
  ] as const).map(([id, col, label]) => f(id, col, label, 'drug', 'select', select(['Negatif', 'Positif', 'N/A']))),
  f('psa', 'BP', 'PSA', 'drug', 'number', { unit: 'ng/mL', normalRange: '<4' }),

  // BQ–BU Imaging
  f('chestXR', 'BQ', 'Chest X-Ray', 'imaging', 'textarea'),
  f('lumboXR', 'BR', 'Lumbosacral X-Ray', 'imaging', 'textarea'),
  f('ecgHasil', 'BS', 'ECG', 'imaging', 'textarea'),
  f('tmHasil', 'BT', 'Treadmill', 'imaging', 'textarea'),
  f('usg', 'BU', 'USG', 'imaging', 'textarea'),

  // BV–CE Spirometry
  f('fvcPred', 'BV', 'Spirometry FVC PRED', 'spirometry', 'number', { unit: 'L' }),
  f('fvcAct', 'BW', 'Spirometry FVC ACT', 'spirometry', 'number', { unit: 'L' }),
  f('fvcPct', 'BX', 'Spirometry FVC %', 'spirometry', 'number', { unit: '%', autoCalc: true, autoCalcFrom: ['fvcAct', 'fvcPred'] }),
  f('fev1Pred', 'BY', 'Spirometry FEV1 PRED', 'spirometry', 'number', { unit: 'L' }),
  f('fev1Act', 'BZ', 'Spirometry FEV1 ACT', 'spirometry', 'number', { unit: 'L' }),
  f('fev1Pct', 'CA', 'Spirometry FEV1 %', 'spirometry', 'number', { unit: '%', autoCalc: true, autoCalcFrom: ['fev1Act', 'fev1Pred'] }),
  f('fev1FvcPred', 'CB', 'Spirometry FEV1%G PRED', 'spirometry', 'number', { unit: '%' }),
  f('fev1FvcAct', 'CC', 'Spirometry FEV1%G ACT', 'spirometry', 'number', { unit: '%', autoCalc: true, autoCalcFrom: ['fev1Act', 'fvcAct'] }),
  f('fev1FvcPct', 'CD', 'Spirometry FEV1%G %', 'spirometry', 'number', { unit: '%', autoCalc: true, autoCalcFrom: ['fev1FvcAct', 'fev1FvcPred'] }),
  f('spiInterp', 'CE', 'Spirometry Interpretasi', 'spirometry'),

  // CF–CT Audiometry (ACR first, as specified)
  ...([
    ['acr_500', 'CF', 'Audiometry ACR 500'], ['acr_1k', 'CG', 'Audiometry ACR 1K'],
    ['acr_2k', 'CH', 'Audiometry ACR 2K'], ['acr_3k', 'CI', 'Audiometry ACR 3K'],
    ['acr_4k', 'CJ', 'Audiometry ACR 4K'], ['acr_6k', 'CK', 'Audiometry ACR 6K'],
    ['acr_8k', 'CL', 'Audiometry ACR 8K'], ['acl_500', 'CM', 'Audiometry ACL 500'],
    ['acl_1k', 'CN', 'Audiometry ACL 1K'], ['acl_2k', 'CO', 'Audiometry ACL 2K'],
    ['acl_3k', 'CP', 'Audiometry ACL 3K'], ['acl_4k', 'CQ', 'Audiometry ACL 4K'],
    ['acl_6k', 'CR', 'Audiometry ACL 6K'], ['acl_8k', 'CS', 'Audiometry ACL 8K'],
  ] as const).map(([id, col, label]) => f(id, col, label, 'audiometry', 'number', { unit: 'dB' })),
  f('audInterp', 'CT', 'Audiometry Interpretasi', 'audiometry'),

  // CU–DB Neurologi
  ...([
    ['balance', 'CU', 'Balance Test'], ['romberg', 'CV', 'Romberg Test'], ['phalen', 'CW', 'Phalen Test'],
    ['thinel', 'CX', 'Thinel Test'], ['patrick', 'CY', 'Patrick Test'], ['kontraPatrick', 'CZ', 'Kontra Patrick Test'],
    ['laseque', 'DA', 'Laseque Test'], ['kernig', 'DB', 'Kernig Test'],
  ] as const).map(([id, col, label]) => f(id, col, label, 'neuro')),
  f('tesKebugaran', 'DC', 'Tes Kebugaran (6 Minutes Walk Test, Harvard Step Test)', 'fitness', 'textarea'),
  f('pemeriksaanLain', 'DD', 'Pemeriksaan Lain', 'assessment', 'textarea'),
  f('dugaanPAK', 'DE', 'Dugaan PAK', 'assessment', 'textarea'),

  // DF–DS Penilaian dan kalkulasi
  f('kesVendor', 'DF', 'Kesimpulan Vendor', 'assessment', 'select', { options: ['Fit To Work', 'Fit With Note', 'Fit With Restriction', 'Currently Unfit', 'Temporary Unfit', 'Unfit'] }),
  f('rekQSHE', 'DG', 'Rekomendasi QSHE Medic', 'assessment', 'select', {
    options: ['Fit To Work', 'Fit With Note', 'Fit With Restriction', 'Currently Unfit', 'Unfit', 'Temporary Unfit'],
  }),
  f('diagnosaMedis', 'DH', 'Diagnosa Medis', 'assessment', 'textarea', { autoCalc: true }),
  f('perluFU', 'DI', 'Perlu Follow Up?', 'assessment', 'select', { options: ['Ya', 'Tidak'] }),
  f('rekFU', 'DJ', 'Rekomendasi Follow Up', 'assessment', 'select', {
    multiple: true,
    options: [
      'Konsultasi dan terapi ke Dokter Umum',
      'Konsultasi dan terapi ke Dokter Sp. PD',
      'Konsultasi dan terapi ke Dokter Sp. JP',
      'Konsultasi dan terapi ke Dokter Sp. P',
      'Konsultasi dan terapi ke Dokter Sp. M',
      'Konsultasi dan terapi ke Dokter Sp. GK / Ahli Gizi',
      'Konsultasi dan terapi ke Psikiatri / Psikolog',
      'Konsultasi dan terapi ke Dokter Gigi',
      'Konsultasi dan terapi ke Dokter Sp. THT',
      'Konsultasi dan terapi ke Dokter Sp. B',
      'Konsultasi dan terapi ke Dokter Sp. U',
      'Konsultasi dan terapi ke Dokter Sp. OT',
      'Konsultasi dan terapi ke Dokter Sp. KK',
      'Pertahankan Kondisi Tubuh Bugar Dengan Diet Sehat & Rutin Olahraga',
    ],
  }),
  f('itemFU', 'DK', 'Item Follow Up', 'assessment', 'textarea', { autoCalc: true }),
  f('linkMCU', 'DL', 'Link File MCU', 'assessment'),
  f('tglExpired', 'DM', 'Tanggal Expired MCU', 'calculated', 'date', { autoCalc: true, autoCalcFrom: ['tglMCU'], textNA: false }),
  f('framScore', 'DN', 'Framingham Score Lipid Based – Score', 'calculated', 'number', { autoCalc: true }),
  f('framProb', 'DO', 'Framingham Score Lipid Based – Probabilitas', 'calculated', 'text', { autoCalc: true }),
  f('framKat', 'DP', 'Framingham Score Lipid Based – Kategori', 'calculated', 'text', { autoCalc: true }),
  f('zonasi', 'DQ', 'Zonasi', 'calculated', 'text', { autoCalc: true }),
  f('triggerZona', 'DR', 'Trigger Zona Resiko Kesehatan', 'calculated', 'textarea', { autoCalc: true }),
  f('pengendalian', 'DS', 'Pengendalian', 'calculated', 'textarea', { autoCalc: true }),

  // DT–EL Follow-up
  f('tglFU1', 'DT', 'Tanggal Follow Up I', 'assessment', 'date', { textNA: false }),
  f('lokasiFU1', 'DU', 'Lokasi Follow Up I', 'assessment'),
  f('hasilFU1', 'DV', 'Hasil Follow Up I', 'assessment', 'textarea'),
  f('kesimpulanFU1', 'DW', 'Kesimpulan Setelah Follow Up I', 'assessment', 'textarea'),
  f('linkFU1', 'DX', 'Link File Hasil Follow Up I', 'assessment'),
  f('rekFU2', 'DY', 'Rekomendasi FU II', 'assessment', 'textarea'),
  f('tglFU2', 'DZ', 'Tanggal Follow Up II', 'assessment', 'date', { textNA: false }),
  f('lokasiFU2', 'EA', 'Lokasi Follow Up II', 'assessment'),
  f('hasilFU2', 'EB', 'Hasil Follow Up II', 'assessment', 'textarea'),
  f('kesimpulanFU2', 'EC', 'Kesimpulan Setelah Follow Up II', 'assessment', 'textarea'),
  f('linkFU2', 'ED', 'Link File Hasil Follow Up II', 'assessment'),
  f('rekFU3', 'EE', 'Rekomendasi FU III', 'assessment', 'textarea'),
  f('tglFU3', 'EF', 'Tanggal Follow Up III', 'assessment', 'date', { textNA: false }),
  f('lokasiFU3', 'EG', 'Lokasi Follow Up III', 'assessment'),
  f('hasilFU3', 'EH', 'Hasil Follow Up III', 'assessment', 'textarea'),
  f('kesimpulanFU3', 'EI', 'Kesimpulan Setelah Follow Up III', 'assessment', 'textarea'),
  f('linkFU3', 'EJ', 'Link File Hasil Follow Up III', 'assessment'),
  f('rekFU4', 'EK', 'Rekomendasi FU IV', 'assessment', 'textarea'),
  f('catatan', 'EL', 'Catatan & Rekomendasi', 'assessment', 'textarea', { textNA: false }),
];

export const TEXT_NA_INDICES = MCU_FIELDS.filter(field => field.textNA).map(field => field.colIndex);
export const TOTAL_COLS = 143; // A–EM, including generated No. in A

export function getFieldsBySection(sectionId: string): MCUFieldDef[] {
  return MCU_FIELDS.filter(field => field.section === sectionId);
}

export function getFieldById(id: string): MCUFieldDef | undefined {
  return MCU_FIELDS.find(field => field.id === id);
}
