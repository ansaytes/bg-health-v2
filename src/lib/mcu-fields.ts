// ============================================================
// MCU Field Definitions — 142 Columns (A–EL) Record MCU 2026
// Based on: Record MCU 2026 (4).xlsx, RAW_DATA sheet
// 3 header rows, data starts row 4
// ============================================================

export type FieldType = 'number' | 'text' | 'select' | 'date' | 'textarea';

export interface MCUFieldDef {
  id: string;           // camelCase field ID
  col: string;          // Column letter (A-EL)
  colIndex: number;     // 0-based column index
  label: string;        // Display label
  section: string;      // Section name
  sectionOrder: number; // Section display order
  type: FieldType;
  unit?: string;        // Unit display
  placeholder?: string;
  normalRange?: string; // Normal range text
  // For number fields: validation
  min?: number;
  max?: number;
  // For select fields
  options?: string[];
  // Auto-calculation
  autoCalc?: boolean;   // If true, auto-calculated (but still editable)
  autoCalcFrom?: string[]; // Source field IDs for auto-calc
  // N/A handling
  textNA?: boolean;     // If empty, should default to "N/A"
  // Gender-specific normal ranges
  normalMale?: string;
  normalFemale?: string;
  lowMale?: number; highMale?: number;
  lowFemale?: number; highFemale?: number;
  low?: number; high?: number;
}

export const MCU_SECTIONS = [
  { id: 'identity',   label: 'Identitas',      icon: 'User',           order: 0 },
  { id: 'physical',   label: 'Fisik',          icon: 'Activity',        order: 1 },
  { id: 'vision',     label: 'Mata',           icon: 'Eye',             order: 2 },
  { id: 'vital',      label: 'Tanda Vital',    icon: 'HeartPulse',      order: 3 },
  { id: 'hematology', label: 'Hematologi',     icon: 'Droplets',        order: 4 },
  { id: 'chemistry',  label: 'Kimia Darah',    icon: 'FlaskConical',    order: 5 },
  { id: 'serology',   label: 'Serologi',       icon: 'Shield',          order: 6 },
  { id: 'drug',       label: 'NAPZA',          icon: 'Pill',            order: 7 },
  { id: 'imaging',    label: 'Radiologi & USG',icon: 'Scan',            order: 8 },
  { id: 'spirometry', label: 'Spirometri',     icon: 'Wind',            order: 9 },
  { id: 'audiometry', label: 'Audiometri',     icon: 'Ear',             order: 10 },
  { id: 'neuro',      label: 'Neurologi',      icon: 'Brain',           order: 11 },
  { id: 'fitness',    label: 'Kebugaran',      icon: 'Dumbbell',        order: 12 },
  { id: 'assessment', label: 'Penilaian',      icon: 'ClipboardCheck',  order: 13 },
  { id: 'calculated', label: 'Hasil Kalkulasi', icon: 'Calculator',      order: 14 },
] as const;

export const MCU_FIELDS: MCUFieldDef[] = [
  // ════════ IDENTITAS (A-J) ════════
  { id: 'no',             col: 'A',  colIndex: 0,  label: 'No',               section: 'identity', sectionOrder: 0, type: 'number', autoCalc: true },
  { id: 'nikKaryawan',    col: 'B',  colIndex: 1,  label: 'NIK Karyawan',     section: 'identity', sectionOrder: 1, type: 'text', placeholder: 'NIK Karyawan' },
  { id: 'nama',           col: 'C',  colIndex: 2,  label: 'Nama',             section: 'identity', sectionOrder: 2, type: 'text', placeholder: 'Auto dari NIK KTP' },
  { id: 'usia',           col: 'D',  colIndex: 3,  label: 'Usia',             section: 'identity', sectionOrder: 3, type: 'number', unit: 'th', placeholder: 'Auto', autoCalc: true },
  { id: 'jenisKelamin',   col: 'E',  colIndex: 4,  label: 'Jenis Kelamin',    section: 'identity', sectionOrder: 4, type: 'select', options: ['Laki - Laki', 'Perempuan'], placeholder: 'Auto dari NIK KTP' },
  { id: 'jabatan',        col: 'F',  colIndex: 5,  label: 'Jabatan',          section: 'identity', sectionOrder: 5, type: 'text', placeholder: 'Auto dari NIK KTP' },
  { id: 'site',           col: 'G',  colIndex: 6,  label: 'Site',             section: 'identity', sectionOrder: 6, type: 'text', placeholder: 'Auto dari NIK KTP' },
  { id: 'statusMCU',      col: 'H',  colIndex: 7,  label: 'Status MCU',       section: 'identity', sectionOrder: 7, type: 'select', options: ['Rutin', 'Resmi', 'Khusus', 'Lainnya'] },
  { id: 'tglMCU',         col: 'I',  colIndex: 8,  label: 'Tanggal MCU',      section: 'identity', sectionOrder: 8, type: 'date' },
  { id: 'tempatMCU',      col: 'J',  colIndex: 9,  label: 'Tempat MCU',       section: 'identity', sectionOrder: 9, type: 'text', textNA: true, placeholder: 'Nama klinik/rumah sakit' },

  // ════════ FISIK (K-N) ════════
  { id: 'golDarah',       col: 'K',  colIndex: 10, label: 'Golongan Darah',   section: 'physical', sectionOrder: 0, type: 'select', options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'N/A'], textNA: true },
  { id: 'gigiMulut',      col: 'L',  colIndex: 11, label: 'Gigi & Mulut',     section: 'physical', sectionOrder: 1, type: 'textarea', textNA: true, placeholder: 'DBN jika normal' },
  { id: 'fisikHeadToToe',col: 'M',  colIndex: 12, label: 'Fisik Head to Toe', section: 'physical', sectionOrder: 2, type: 'textarea', textNA: true, placeholder: 'DBN jika normal' },
  { id: 'hemoroid',       col: 'N',  colIndex: 13, label: 'Hemoroid',         section: 'physical', sectionOrder: 3, type: 'select', options: ['Negatif', 'Positif', 'Menolak RT', 'N/A'], textNA: true },

  // ════════ MATA (O-S) ════════
  { id: 'visusJauh',      col: 'O',  colIndex: 14, label: 'Visus Jauh',       section: 'vision', sectionOrder: 0, type: 'text', textNA: true, placeholder: 'VOD 6/6 VOS 6/6' },
  { id: 'visusDekat',     col: 'P',  colIndex: 15, label: 'Visus Dekat',      section: 'vision', sectionOrder: 1, type: 'text', textNA: true, placeholder: 'J1 / DBN' },
  { id: 'defWarna',       col: 'Q',  colIndex: 16, label: 'Defisiensi Warna', section: 'vision', sectionOrder: 2, type: 'select', options: ['Normal', 'Protan', 'Deutan', 'Tritan', 'Total', 'N/A'], textNA: true },
  { id: 'lapangPandang',  col: 'R',  colIndex: 17, label: 'Lapang Pandang',   section: 'vision', sectionOrder: 3, type: 'text', textNA: true, placeholder: 'DBN jika normal' },
  { id: 'fisikMata',      col: 'S',  colIndex: 18, label: 'Fisik Mata',       section: 'vision', sectionOrder: 4, type: 'textarea', textNA: true, placeholder: 'DBN jika normal' },

  // ════════ TANDA VITAL (T-Z) ════════
  { id: 'merokok',        col: 'T',  colIndex: 19, label: 'Merokok',          section: 'vital', sectionOrder: 0, type: 'select', options: ['Ya', 'Tidak', 'Sudah Berhenti', 'N/A'], textNA: true },
  { id: 'tdS',            col: 'U',  colIndex: 20, label: 'TD Sistolik',      section: 'vital', sectionOrder: 1, type: 'number', unit: 'mmHg', normalRange: '<120', placeholder: 'mmHg' },
  { id: 'tdD',            col: 'V',  colIndex: 21, label: 'TD Diastolik',     section: 'vital', sectionOrder: 2, type: 'number', unit: 'mmHg', normalRange: '<80', placeholder: 'mmHg' },
  { id: 'nadi',           col: 'W',  colIndex: 22, label: 'Nadi',             section: 'vital', sectionOrder: 3, type: 'number', unit: '/mnt', normalRange: '60-100', low: 60, high: 100 },
  { id: 'bb',             col: 'X',  colIndex: 23, label: 'Berat Badan',      section: 'vital', sectionOrder: 4, type: 'number', unit: 'kg', placeholder: 'kg' },
  { id: 'tb',             col: 'Y',  colIndex: 24, label: 'Tinggi Badan',     section: 'vital', sectionOrder: 5, type: 'number', unit: 'cm', placeholder: 'cm' },
  { id: 'bmi',            col: 'Z',  colIndex: 25, label: 'BMI',              section: 'vital', sectionOrder: 6, type: 'number', unit: 'kg/m²', normalRange: '<23', autoCalc: true, autoCalcFrom: ['bb', 'tb'] },
  { id: 'lp',             col: 'AA', colIndex: 26, label: 'Lingkar Pinggang',  section: 'vital', sectionOrder: 7, type: 'number', unit: 'cm', normalMale: '<90', normalFemale: '<80' },

  // ════════ HEMATOLOGI (AB-AJ) ════════
  { id: 'hb',             col: 'AB', colIndex: 27, label: 'Hemoglobin',       section: 'hematology', sectionOrder: 0, type: 'number', unit: 'g/dL', normalMale: '13-16.5', normalFemale: '12-15', lowMale: 13, highMale: 16.5, lowFemale: 12, highFemale: 15 },
  { id: 'leukosit',       col: 'AC', colIndex: 28, label: 'Leukosit',         section: 'hematology', sectionOrder: 1, type: 'number', unit: '10³/µL', normalRange: '4-11', low: 4, high: 11 },
  { id: 'eritrosit',      col: 'AD', colIndex: 29, label: 'Eritrosit',        section: 'hematology', sectionOrder: 2, type: 'number', unit: '10⁶/µL', normalRange: '4.5-6.2', low: 4.5, high: 6.2 },
  { id: 'hematokrit',     col: 'AE', colIndex: 30, label: 'Hematokrit',       section: 'hematology', sectionOrder: 3, type: 'number', unit: '%', normalRange: '40-54%', low: 40, high: 54 },
  { id: 'trombosit',      col: 'AF', colIndex: 31, label: 'Trombosit',        section: 'hematology', sectionOrder: 4, type: 'number', unit: '10³/µL', normalRange: '150-400', low: 150, high: 400 },
  { id: 'mcv',            col: 'AG', colIndex: 32, label: 'MCV',              section: 'hematology', sectionOrder: 5, type: 'number', unit: 'fL', normalRange: '80-100', low: 80, high: 100 },
  { id: 'mch',            col: 'AH', colIndex: 33, label: 'MCH',              section: 'hematology', sectionOrder: 6, type: 'number', unit: 'pg', normalRange: '27-33', low: 27, high: 33 },
  { id: 'mchc',           col: 'AI', colIndex: 34, label: 'MCHC',             section: 'hematology', sectionOrder: 7, type: 'number', unit: 'g/dL', normalRange: '31-37', autoCalc: true, autoCalcFrom: ['hb', 'hematokrit'], low: 31, high: 37 },
  { id: 'led',            col: 'AJ', colIndex: 35, label: 'LED',              section: 'hematology', sectionOrder: 8, type: 'number', unit: 'mm/jam', normalMale: '0-15', normalFemale: '0-20', lowMale: 0, highMale: 15, lowFemale: 0, highFemale: 20 },

  // ════════ KIMIA DARAH (AK-AZ) ════════
  { id: 'chol',           col: 'AK', colIndex: 36, label: 'Cholesterol Total',section: 'chemistry', sectionOrder: 0, type: 'number', unit: 'mg/dL', normalRange: '<200', high: 200 },
  { id: 'tg',             col: 'AL', colIndex: 37, label: 'Trigliserida',     section: 'chemistry', sectionOrder: 1, type: 'number', unit: 'mg/dL', normalRange: '<150', high: 150 },
  { id: 'hdl',            col: 'AM', colIndex: 38, label: 'HDL',              section: 'chemistry', sectionOrder: 2, type: 'number', unit: 'mg/dL', normalMale: '≥40', normalFemale: '≥50', lowMale: 40, lowFemale: 50 },
  { id: 'ldl',            col: 'AN', colIndex: 39, label: 'LDL',              section: 'chemistry', sectionOrder: 3, type: 'number', unit: 'mg/dL', normalRange: '<100', high: 100 },
  { id: 'gdp',            col: 'AO', colIndex: 40, label: 'GDP',              section: 'chemistry', sectionOrder: 4, type: 'number', unit: 'mg/dL', normalRange: '70-100', low: 70, high: 100 },
  { id: 'gd2pp',          col: 'AP', colIndex: 41, label: 'GD2PP',            section: 'chemistry', sectionOrder: 5, type: 'number', unit: 'mg/dL', normalRange: '<140', high: 140 },
  { id: 'hba1c',          col: 'AQ', colIndex: 42, label: 'HbA1c',            section: 'chemistry', sectionOrder: 6, type: 'number', unit: '%', normalRange: '<6.5%', high: 6.5 },
  { id: 'diabetes',       col: 'AR', colIndex: 43, label: 'Diabetes',         section: 'chemistry', sectionOrder: 7, type: 'select', options: ['Ya', 'Tidak'], autoCalc: true, autoCalcFrom: ['gdp', 'gd2pp', 'hba1c'] },
  { id: 'au',             col: 'AS', colIndex: 44, label: 'Asam Urat',        section: 'chemistry', sectionOrder: 8, type: 'number', unit: 'mg/dL', normalMale: '3.4-7', normalFemale: '2.4-6', lowMale: 3.4, highMale: 7, lowFemale: 2.4, highFemale: 6 },
  { id: 'ureum',          col: 'AT', colIndex: 45, label: 'Ureum',            section: 'chemistry', sectionOrder: 9, type: 'number', unit: 'mg/dL', normalRange: '16.6-48.5', low: 16.6, high: 48.5 },
  { id: 'kreatinin',      col: 'AU_col', colIndex: 46, label: 'Kreatinin',        section: 'chemistry', sectionOrder: 10, type: 'number', unit: 'mg/dL', normalRange: '0.6-1.2', low: 0.6, high: 1.2 },
  { id: 'egfr',           col: 'AV', colIndex: 47, label: 'eGFR',             section: 'chemistry', sectionOrder: 11, type: 'number', unit: 'mL/min/1.73m²', normalRange: '≥60', low: 60 },
  { id: 'sgot',           col: 'AW', colIndex: 48, label: 'SGOT (AST)',       section: 'chemistry', sectionOrder: 12, type: 'number', unit: 'U/L', normalRange: '<40', high: 40 },
  { id: 'sgpt',           col: 'AX', colIndex: 49, label: 'SGPT (ALT)',       section: 'chemistry', sectionOrder: 13, type: 'number', unit: 'U/L', normalRange: '<41', high: 41 },
  { id: 'ggt',            col: 'AY', colIndex: 50, label: 'GGT',              section: 'chemistry', sectionOrder: 14, type: 'number', unit: 'U/L', normalRange: '8-61', low: 8, high: 61 },
  { id: 'alp',            col: 'AZ', colIndex: 51, label: 'ALP',              section: 'chemistry', sectionOrder: 15, type: 'number', unit: 'IU/L', normalRange: '44-147', low: 44, high: 147 },
  { id: 'billirubin',     col: 'BA', colIndex: 52, label: 'Bilirubin Total', section: 'chemistry', sectionOrder: 16, type: 'number', unit: 'mg/dL', normalRange: '0.2-1.2', low: 0.2, high: 1.2 },
  { id: 'ul',             col: 'BB', colIndex: 53, label: 'Urinalisis',       section: 'chemistry', sectionOrder: 17, type: 'textarea', textNA: true, placeholder: 'DBN jika normal' },

  // ════════ SEROLOGI (BC-BG) ════════
  { id: 'hbsag',          col: 'BC', colIndex: 54, label: 'HBsAg',            section: 'serology', sectionOrder: 0, type: 'select', options: ['Non - Reaktif', 'Reaktif', 'N/A'], textNA: true },
  { id: 'antiHbs',        col: 'BD', colIndex: 55, label: 'Anti-HBs',         section: 'serology', sectionOrder: 1, type: 'select', options: ['Non - Reaktif', 'Reaktif', 'N/A'], textNA: true },
  { id: 'vdrl',           col: 'BE', colIndex: 56, label: 'VDRL',             section: 'serology', sectionOrder: 2, type: 'select', options: ['Non - Reaktif', 'Reaktif', 'N/A'], textNA: true },
  { id: 'tpha',           col: 'BF', colIndex: 57, label: 'TPHA',             section: 'serology', sectionOrder: 3, type: 'select', options: ['Non - Reaktif', 'Reaktif', 'N/A'], textNA: true },
  { id: 'hiv',            col: 'BG', colIndex: 58, label: 'HIV',              section: 'serology', sectionOrder: 4, type: 'select', options: ['Non - Reaktif', 'Reaktif', 'N/A'], textNA: true },

  // ════════ NAPZA (BH-BL) ════════
  { id: 'drugAmp',        col: 'BH', colIndex: 59, label: 'Amphetamine',      section: 'drug', sectionOrder: 0, type: 'select', options: ['Negatif', 'Positif', 'N/A'], textNA: true },
  { id: 'drugMeth',       col: 'BI', colIndex: 60, label: 'Methamphetamine',   section: 'drug', sectionOrder: 1, type: 'select', options: ['Negatif', 'Positif', 'N/A'], textNA: true },
  { id: 'drugMorph',      col: 'BJ', colIndex: 61, label: 'Morphine',         section: 'drug', sectionOrder: 2, type: 'select', options: ['Negatif', 'Positif', 'N/A'], textNA: true },
  { id: 'drugCanna',      col: 'BK', colIndex: 62, label: 'Cannabinoid',      section: 'drug', sectionOrder: 3, type: 'select', options: ['Negatif', 'Positif', 'N/A'], textNA: true },
  { id: 'drugCoc',        col: 'BL', colIndex: 63, label: 'Cocaine',          section: 'drug', sectionOrder: 4, type: 'select', options: ['Negatif', 'Positif', 'N/A'], textNA: true },
  { id: 'drugBenz',       col: 'BM', colIndex: 64, label: 'Benzodiazepine',   section: 'drug', sectionOrder: 5, type: 'select', options: ['Negatif', 'Positif', 'N/A'], textNA: true },
  { id: 'drugCaris',      col: 'BN', colIndex: 65, label: 'Carisoprodol',    section: 'drug', sectionOrder: 6, type: 'select', options: ['Negatif', 'Positif', 'N/A'], textNA: true },
  { id: 'alkohol',        col: 'BO', colIndex: 66, label: 'Alkohol',          section: 'drug', sectionOrder: 7, type: 'select', options: ['Negatif', 'Positif', 'N/A'], textNA: true },
  { id: 'psa',            col: 'BP', colIndex: 67, label: 'PSA',              section: 'drug', sectionOrder: 8, type: 'number', unit: 'ng/mL', normalRange: '<4', high: 4, textNA: true },

  // ════════ RADIOLOGI & USG (BQ-BU) ════════
  { id: 'chestXR',        col: 'BQ', colIndex: 68, label: 'Foto Thorax',      section: 'imaging', sectionOrder: 0, type: 'textarea', textNA: true, placeholder: 'Cor dan Pulmo DBN' },
  { id: 'lumboXR',        col: 'BR', colIndex: 69, label: 'Foto Lumbosacral',section: 'imaging', sectionOrder: 1, type: 'textarea', textNA: true, placeholder: 'Lumbosacral DBN' },
  { id: 'ecgHasil',       col: 'BS', colIndex: 70, label: 'ECG',              section: 'imaging', sectionOrder: 2, type: 'textarea', textNA: true, placeholder: 'Normal Resting ECG' },
  { id: 'tmHasil',        col: 'BT', colIndex: 71, label: 'Treadmill',        section: 'imaging', sectionOrder: 3, type: 'textarea', textNA: true, placeholder: 'Negative Ischemic Response' },
  { id: 'usg',            col: 'BU', colIndex: 72, label: 'USG',              section: 'imaging', sectionOrder: 4, type: 'textarea', textNA: true, placeholder: 'DBN' },

  // ════════ SPIROMETRI (BV-CF) ════════
  { id: 'fvcPred',        col: 'BV', colIndex: 73, label: 'FVC Pred',         section: 'spirometry', sectionOrder: 0, type: 'number', unit: 'L' },
  { id: 'fvcAct',         col: 'BW', colIndex: 74, label: 'FVC Act',          section: 'spirometry', sectionOrder: 1, type: 'number', unit: 'L' },
  { id: 'fvcPct',         col: 'BX', colIndex: 75, label: 'FVC %',            section: 'spirometry', sectionOrder: 2, type: 'number', unit: '%', autoCalc: true, autoCalcFrom: ['fvcAct', 'fvcPred'] },
  { id: 'fev1Pred',       col: 'BY', colIndex: 76, label: 'FEV1 Pred',        section: 'spirometry', sectionOrder: 3, type: 'number', unit: 'L' },
  { id: 'fev1Act',        col: 'BZ', colIndex: 77, label: 'FEV1 Act',         section: 'spirometry', sectionOrder: 4, type: 'number', unit: 'L' },
  { id: 'fev1Pct',        col: 'CA', colIndex: 78, label: 'FEV1 %',           section: 'spirometry', sectionOrder: 5, type: 'number', unit: '%', autoCalc: true, autoCalcFrom: ['fev1Act', 'fev1Pred'] },
  { id: 'fev1FvcPred',    col: 'CB', colIndex: 79, label: 'FEV1/FVC Pred',    section: 'spirometry', sectionOrder: 6, type: 'number', unit: '%' },
  { id: 'fev1FvcAct',     col: 'CC', colIndex: 80, label: 'FEV1/FVC Act',     section: 'spirometry', sectionOrder: 7, type: 'number', unit: '%', autoCalc: true, autoCalcFrom: ['fev1Act', 'fvcAct'] },
  { id: 'fev1FvcPct',     col: 'CD', colIndex: 81, label: 'FEV1/FVC %',      section: 'spirometry', sectionOrder: 8, type: 'number', unit: '%', autoCalc: true, autoCalcFrom: ['fev1FvcAct', 'fev1FvcPred'] },
  { id: 'spiInterp',      col: 'CE', colIndex: 82, label: 'Interpretasi',      section: 'spirometry', sectionOrder: 9, type: 'text', textNA: true, placeholder: 'Normal Spirometry' },

  // ════════ AUDIOMETRI (CG-CQ) ════════
  { id: 'acl_500',        col: 'CG', colIndex: 83, label: 'ACL 500 Hz',       section: 'audiometry', sectionOrder: 0, type: 'number', unit: 'dB' },
  { id: 'acl_1k',         col: 'CH', colIndex: 84, label: 'ACL 1k Hz',        section: 'audiometry', sectionOrder: 1, type: 'number', unit: 'dB' },
  { id: 'acl_2k',         col: 'CI', colIndex: 85, label: 'ACL 2k Hz',        section: 'audiometry', sectionOrder: 2, type: 'number', unit: 'dB' },
  { id: 'acl_3k',         col: 'CJ', colIndex: 86, label: 'ACL 3k Hz',        section: 'audiometry', sectionOrder: 3, type: 'number', unit: 'dB' },
  { id: 'acl_4k',         col: 'CK', colIndex: 87, label: 'ACL 4k Hz',        section: 'audiometry', sectionOrder: 4, type: 'number', unit: 'dB' },
  { id: 'acl_6k',         col: 'CL', colIndex: 88, label: 'ACL 6k Hz',        section: 'audiometry', sectionOrder: 5, type: 'number', unit: 'dB' },
  { id: 'acl_8k',         col: 'CM', colIndex: 89, label: 'ACL 8k Hz',        section: 'audiometry', sectionOrder: 6, type: 'number', unit: 'dB' },
  { id: 'acr_500',        col: 'CN', colIndex: 90, label: 'ACR 500 Hz',       section: 'audiometry', sectionOrder: 7, type: 'number', unit: 'dB' },
  { id: 'acr_1k',         col: 'CO', colIndex: 91, label: 'ACR 1k Hz',        section: 'audiometry', sectionOrder: 8, type: 'number', unit: 'dB' },
  { id: 'acr_2k',         col: 'CP', colIndex: 92, label: 'ACR 2k Hz',        section: 'audiometry', sectionOrder: 9, type: 'number', unit: 'dB' },
  { id: 'acr_3k',         col: 'CQ', colIndex: 93, label: 'ACR 3k Hz',        section: 'audiometry', sectionOrder: 10, type: 'number', unit: 'dB' },
  { id: 'acr_4k',         col: 'CR', colIndex: 94, label: 'ACR 4k Hz',        section: 'audiometry', sectionOrder: 11, type: 'number', unit: 'dB' },
  { id: 'acr_6k',         col: 'CS', colIndex: 95, label: 'ACR 6k Hz',        section: 'audiometry', sectionOrder: 12, type: 'number', unit: 'dB' },
  { id: 'acr_8k',         col: 'CT', colIndex: 96, label: 'ACR 8k Hz',        section: 'audiometry', sectionOrder: 13, type: 'number', unit: 'dB' },
  { id: 'audInterp',      col: 'CU', colIndex: 97, label: 'Interpretasi',      section: 'audiometry', sectionOrder: 14, type: 'text', textNA: true, placeholder: 'Normal Audiometry' },

  // ════════ NEUROLOGI (CV-DA) ════════
  { id: 'balance',        col: 'CV', colIndex: 98, label: 'Balance',          section: 'neuro', sectionOrder: 0, type: 'text', textNA: true },
  { id: 'romberg',        col: 'CW', colIndex: 99, label: 'Romberg',          section: 'neuro', sectionOrder: 1, type: 'text', textNA: true },
  { id: 'phalen',         col: 'CX', colIndex: 100,label: 'Phalen',           section: 'neuro', sectionOrder: 2, type: 'text', textNA: true },
  { id: 'thinel',         col: 'CY', colIndex: 101,label: 'Tinel',            section: 'neuro', sectionOrder: 3, type: 'text', textNA: true },
  { id: 'patrick',        col: 'CZ', colIndex: 102,label: 'Patrick',          section: 'neuro', sectionOrder: 4, type: 'text', textNA: true },
  { id: 'kontraPatrick',  col: 'DA', colIndex: 103,label: 'Kontra Patrick',   section: 'neuro', sectionOrder: 5, type: 'text', textNA: true },
  { id: 'laseque',        col: 'DB', colIndex: 104,label: 'Lasègue',          section: 'neuro', sectionOrder: 6, type: 'text', textNA: true },
  { id: 'kernig',         col: 'DC', colIndex: 105,label: 'Kernig',           section: 'neuro', sectionOrder: 7, type: 'text', textNA: true },

  // ════════ KEBUGARAN (DD-DF) ════════
  { id: 'tesKebugaran',   col: 'DD', colIndex: 106,label: 'Tes Kebugaran',    section: 'fitness', sectionOrder: 0, type: 'text', textNA: true },
  { id: 'pemeriksaanLain',col: 'DE', colIndex: 107,label: 'Pemeriksaan Lain', section: 'fitness', sectionOrder: 1, type: 'textarea', textNA: true },
  { id: 'dugaanPAK',      col: 'DF', colIndex: 108,label: 'Dugaan PAK',       section: 'fitness', sectionOrder: 2, type: 'textarea', textNA: true },

  // ════════ PENILAIAN (DG-DI) ════════
  { id: 'kesVendor',      col: 'DG', colIndex: 109,label: 'Kes. Vendor',      section: 'assessment', sectionOrder: 0, type: 'select', options: ['Fit To Work', 'Fit With Note', 'Fit With Restriction', 'Currently Unfit', 'Temporary Unfit', 'Unfit'] },
  { id: 'rekQSHE',        col: 'DH', colIndex: 110,label: 'Rekomendasi QSHE', section: 'assessment', sectionOrder: 1, type: 'textarea', placeholder: 'Auto: Diagnosa Medis' },
  { id: 'perluFU',        col: 'DI', colIndex: 111,label: 'Perlu Follow Up?', section: 'assessment', sectionOrder: 2, type: 'select', options: ['Ya', 'Tidak'], autoCalc: true },
  { id: 'rekFU',          col: 'DJ', colIndex: 112,label: 'Rekomendasi FU',   section: 'assessment', sectionOrder: 3, type: 'textarea', placeholder: 'Auto: Item Follow Up' },
  { id: 'itemFU',         col: 'DK', colIndex: 113,label: 'Item Follow Up',   section: 'assessment', sectionOrder: 4, type: 'textarea', placeholder: 'Auto-generated' },
  { id: 'linkMCU',        col: 'DL', colIndex: 114,label: 'Link MCU (GDrive)',section: 'assessment', sectionOrder: 5, type: 'text', placeholder: 'https://drive.google.com/...' },

  // ════════ HASIL KALKULASI (DM-EL) ════════
  { id: 'tglExpired',     col: 'DM', colIndex: 115,label: 'Tgl Expired MCU',  section: 'calculated', sectionOrder: 0, type: 'date', autoCalc: true, autoCalcFrom: ['tglMCU'] },
  { id: 'diagnosaMedis',  col: 'DN', colIndex: 116,label: 'Diagnosa Medis',   section: 'calculated', sectionOrder: 1, type: 'textarea', autoCalc: true, placeholder: 'Auto-generated' },
  { id: 'framScore',      col: 'DO', colIndex: 117,label: 'Framingham Score',  section: 'calculated', sectionOrder: 2, type: 'number', autoCalc: true },
  { id: 'framProb',       col: 'DP', colIndex: 118,label: 'Probabilitas CVD',  section: 'calculated', sectionOrder: 3, type: 'text', autoCalc: true },
  { id: 'framKat',        col: 'DQ', colIndex: 119,label: 'Kategori CVD Risk', section: 'calculated', sectionOrder: 4, type: 'text', autoCalc: true },
  { id: 'zonasi',         col: 'DR', colIndex: 120,label: 'Zonasi',           section: 'calculated', sectionOrder: 5, type: 'text', autoCalc: true },
  { id: 'triggerZona',    col: 'DS', colIndex: 121,label: 'Trigger Zona',      section: 'calculated', sectionOrder: 6, type: 'textarea', autoCalc: true },
  { id: 'pengendalian',   col: 'DT', colIndex: 122,label: 'Pengendalian',     section: 'calculated', sectionOrder: 7, type: 'textarea', autoCalc: true },
  { id: 'catatan',        col: 'DU', colIndex: 123,label: 'Catatan',          section: 'calculated', sectionOrder: 8, type: 'textarea' },
  { id: 'fu3',            col: 'DV', colIndex: 124,label: 'FU III',           section: 'calculated', sectionOrder: 9, type: 'textarea' },
  { id: 'fu4',            col: 'DW', colIndex: 125,label: 'FU IV',            section: 'calculated', sectionOrder: 10, type: 'textarea' },
  { id: 'catatanFU',      col: 'DX', colIndex: 126,label: 'Catatan FU',       section: 'calculated', sectionOrder: 11, type: 'textarea' },
  { id: 'nikKtp',         col: 'DY', colIndex: 127,label: 'NIK KTP',          section: 'identity', sectionOrder: 10, type: 'text', placeholder: 'NIK KTP (16 digit)' },
];

// Helper: get fields by section
export function getFieldsBySection(sectionId: string): MCUFieldDef[] {
  return MCU_FIELDS.filter(f => f.section === sectionId).sort((a, b) => a.sectionOrder - b.sectionOrder);
}

// Helper: get field by ID
export function getFieldById(id: string): MCUFieldDef | undefined {
  return MCU_FIELDS.find(f => f.id === id);
}

// Text-NA columns: indices where empty should become "N/A"
export const TEXT_NA_INDICES = MCU_FIELDS
  .filter(f => f.textNA)
  .map(f => f.colIndex);

// Total columns in RAW_DATA sheet
export const TOTAL_COLS = 142; // A through EL (columns 0-141)
