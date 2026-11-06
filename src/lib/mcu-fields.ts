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
  // Riwayat Penyakit & Riwayat Kebiasaan sengaja diletakkan tepat di bawah
  // identitas: keduanya dibaca lebih dulu oleh pemeriksa sebelum pemeriksaan
  // fisik, dan keduanya memengaruhi interpretasi hasil laboratorium.
  { id: 'anamnesis', label: 'Riwayat Penyakit', icon: 'ClipboardList', order: 1 },
  { id: 'habits', label: 'Riwayat Kebiasaan', icon: 'Cigarette', order: 2 },
  { id: 'physical', label: 'Fisik', icon: 'Activity', order: 3 },
  { id: 'vision', label: 'Mata', icon: 'Eye', order: 4 },
  { id: 'vital', label: 'Tanda Vital', icon: 'HeartPulse', order: 5 },
  { id: 'hematology', label: 'Hematologi', icon: 'Droplets', order: 6 },
  { id: 'chemistry', label: 'Kimia Darah', icon: 'FlaskConical', order: 7 },
  { id: 'urinalysis', label: 'Urine Lengkap', icon: 'TestTube', order: 8 },
  { id: 'serology', label: 'Serologi / Imunologi', icon: 'Shield', order: 9 },
  { id: 'drug', label: 'Tes NAPZA (Urine)', icon: 'Pill', order: 10 },
  { id: 'toxicology', label: 'Logam Berat / Toksikologi', icon: 'Biohazard', order: 11 },
  { id: 'imaging', label: 'Radiologi & USG', icon: 'Scan', order: 12 },
  { id: 'spirometry', label: 'Spirometri', icon: 'Wind', order: 13 },
  { id: 'audiometry', label: 'Audiometri', icon: 'Ear', order: 14 },
  { id: 'neuro', label: 'Neurologi', icon: 'Brain', order: 15 },
  { id: 'fitness', label: 'Kebugaran', icon: 'Dumbbell', order: 16 },
  { id: 'assessment', label: 'Penilaian', icon: 'ClipboardCheck', order: 17 },
  { id: 'calculated', label: 'Hasil Kalkulasi', icon: 'Calculator', order: 18 },
] as const;

/**
 * Sub-kelompok di dalam satu section, mis. "Darah Lengkap" dan "Hitung Jenis
 * Leukosit" di dalam Hematologi. Dipakai form untuk memberi judul kecil di
 * antara field, supaya parameter yang sejenis tidak tercampur.
 */
export const MCU_GROUPS: Record<string, string> = {
  // Hematologi
  hb: 'Darah Lengkap', leukosit: 'Darah Lengkap', eritrosit: 'Darah Lengkap',
  hematokrit: 'Darah Lengkap', trombosit: 'Darah Lengkap', mcv: 'Darah Lengkap',
  mch: 'Darah Lengkap', mchc: 'Darah Lengkap', led: 'Darah Lengkap',
  rdw: 'Darah Lengkap', mpv: 'Darah Lengkap', retikulosit: 'Darah Lengkap',
  basofil: 'Hitung Jenis Leukosit', eosinofil: 'Hitung Jenis Leukosit',
  neutrofilBatang: 'Hitung Jenis Leukosit', neutrofilSegmen: 'Hitung Jenis Leukosit',
  limfosit: 'Hitung Jenis Leukosit', monosit: 'Hitung Jenis Leukosit',
  golDarah: 'Hemostasis & Golongan Darah', masaPerdarahan: 'Hemostasis & Golongan Darah',
  masaPembekuan: 'Hemostasis & Golongan Darah',

  // Kimia darah
  chol: 'Lemak Darah', hdl: 'Lemak Darah', ldl: 'Lemak Darah', tg: 'Lemak Darah',
  ureum: 'Fungsi Ginjal', kreatinin: 'Fungsi Ginjal', egfr: 'Fungsi Ginjal', au: 'Fungsi Ginjal',
  sgot: 'Fungsi Hati', sgpt: 'Fungsi Hati', billirubin: 'Fungsi Hati',
  billirubinDirect: 'Fungsi Hati', billirubinIndirect: 'Fungsi Hati',
  alp: 'Fungsi Hati', ggt: 'Fungsi Hati', proteinTotal: 'Fungsi Hati',
  albumin: 'Fungsi Hati', globulin: 'Fungsi Hati',
  gdp: 'Glukosa Darah', gd2pp: 'Glukosa Darah', hba1c: 'Glukosa Darah',
  glukosaSewaktu: 'Glukosa Darah', diabetes: 'Glukosa Darah',
  natrium: 'Elektrolit', kalium: 'Elektrolit', klorida: 'Elektrolit', kalsium: 'Elektrolit',
  ckmb: 'Fungsi Jantung', troponin: 'Fungsi Jantung',
  besiFe: 'Status Besi', tibc: 'Status Besi', ferritin: 'Status Besi',

  // Urine lengkap
  ulWarna: 'Makroskopis', ulKejernihan: 'Makroskopis', ulBau: 'Makroskopis',
  ulPh: 'Kimia Urine', ulBeratJenis: 'Kimia Urine', ulProtein: 'Kimia Urine',
  ulGlukosa: 'Kimia Urine', ulBilirubin: 'Kimia Urine', ulUrobilinogen: 'Kimia Urine',
  ulKeton: 'Kimia Urine', ulNitrit: 'Kimia Urine', ulLeukositEsterase: 'Kimia Urine',
  ulDarah: 'Kimia Urine',
  ulLeukosit: 'Mikroskopis (Sedimen)', ulEritrosit: 'Mikroskopis (Sedimen)',
  ulSelEpitel: 'Mikroskopis (Sedimen)', ulSilinder: 'Mikroskopis (Sedimen)',
  ulKristal: 'Mikroskopis (Sedimen)', ulBakteri: 'Mikroskopis (Sedimen)',
  ulJamur: 'Mikroskopis (Sedimen)',

  // Serologi
  hbsag: 'Hepatitis', antiHbs: 'Hepatitis', antiHbc: 'Hepatitis',
  antiHcv: 'Hepatitis', antiHav: 'Hepatitis',
  hiv: 'Infeksi Menular', vdrl: 'Infeksi Menular', tpha: 'Infeksi Menular',
  widal: 'Infeksi Menular', mantoux: 'Infeksi Menular',

  // NAPZA
  drugAmp: 'Tes NAPZA (Urine)', drugMeth: 'Tes NAPZA (Urine)',
  drugMorph: 'Tes NAPZA (Urine)', drugCanna: 'Tes NAPZA (Urine)',
  drugBenz: 'Tes NAPZA (Urine)', drugCoc: 'Tes NAPZA (Urine)',
  drugCaris: 'Tes NAPZA (Urine)', alkohol: 'Tes NAPZA (Urine)',

  // Toksikologi
  pb: 'Logam Berat', hg: 'Logam Berat', as: 'Logam Berat', cd: 'Logam Berat',
  cr: 'Logam Berat', mn: 'Logam Berat', ni: 'Logam Berat', cu: 'Logam Berat',
  zn: 'Logam Berat', co: 'Logam Berat',
  kolinesterase: 'Paparan Pestisida & Gas', karboksihemoglobin: 'Paparan Pestisida & Gas',
};

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

  // Riwayat penyakit & skor kuesioner â€” parameter zonasi menurut
  // STD-006 Rev001 Bab 7. Diletakkan tepat setelah identitas karena
  // pemeriksa membacanya sebelum memeriksa fisik.
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

  // Riwayat Kebiasaan â€” faktor risiko yang dicatat sekali per MCU.
  // Merokok dipindah dari Tanda Vital ke sini karena bukan hasil pengukuran.
  f('merokok', 'Kebiasaan Merokok', 'habits', 'select', {
    options: ['Tidak Merokok', 'Perokok Aktif', 'Mantan Perokok'],
  }),
  f('jumlahRokok', 'Jumlah Rokok per Hari (batang)', 'habits', 'number', { unit: 'batang' }),
  f('lamaMerokok', 'Lama Merokok (tahun)', 'habits', 'number', { unit: 'tahun' }),
  f('olahraga', 'Kebiasaan Olahraga', 'habits', 'select', {
    options: ['Rutin (≥3x/minggu)', 'Kadang-kadang (<3x/minggu)', 'Tidak Berolahraga'],
  }),
  f('jenisOlahraga', 'Jenis Olahraga', 'habits'),
  f('alkohol', 'Kebiasaan Konsumsi Alkohol', 'habits', 'select', {
    options: ['Tidak', 'Ya (Sosial)', 'Ya (Rutin)'],
  }),
  f('kebiasaanLain', 'Kebiasaan Lain (kopi, jam tidur, dll.)', 'habits', 'textarea'),

  // Fisik
  f('golDarah', 'Golongan Darah & Rhesus', 'physical', 'select', select(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])),
  // Gigi & Mulut bisa berisi lebih dari satu temuan (mis. Karies + Ginggivitis),
  // jadi memakai multi-pilih, bukan dropdown tunggal.
  f('gigiMulut', 'Gigi & Mulut', 'physical', 'select', {
    options: ['Normal', 'Karies', 'Ginggivitis', 'Periodontitis', 'Edentul', 'Protodonsia', 'Karang Gigi', 'Gigi Tiruan'],
    multiple: true,
    allowCustom: true,
  }),
  f('fisikHeadToToe', 'Fisik Head To Toe', 'physical', 'select', {
    options: ['Normal', 'Abnormal'],
    allowCustom: true,
  }),
  f('hemoroid', 'Hemoroid', 'physical', 'select', select(['Negatif', 'Positif', 'Menolak RT'])),

  // Mata
  f('visusJauh', 'Visus Jauh', 'vision'),
  f('visusDekat', 'Visus Dekat', 'vision'),
  f('defWarna', 'Defisiensi Persepsi Warna', 'vision', 'select', select(['Normal', 'Protan', 'Deutan', 'Tritan', 'Total'])),
  f('lapangPandang', 'Lapang Pandang', 'vision', 'select', {
    options: ['Normal', 'Konstriksi Ringan', 'Konstriksi Sedang', 'Konstriksi Berat', 'Tunnel Vision', 'Abnormal Lainnya'],
    allowCustom: true,
  }),
  // Pterigium sering ditemukan pada pekerja terpapar debu/UV, jadi wajib ada
  // di daftar. Multi-pilih karena satu mata bisa memiliki lebih dari satu
  // temuan (mis. Pterigium + Katarak).
  f('fisikMata', 'Fisik Mata', 'vision', 'select', {
    options: [
      'Normal', 'Pterigium', 'Pinguekula', 'Keratoconjunctivitis', 'Katarak',
      'Glaukoma', 'Retinopati', 'Nistagmus', 'Ptosis', 'Konjungtivitis',
    ],
    multiple: true,
    allowCustom: true,
  }),

  // Tanda vital
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
  f('rdw', 'RDW', 'hematology', 'number', normal('11,5-14,5', '%')),
  f('mpv', 'MPV', 'hematology', 'number', normal('7,5-11,5', 'fL')),
  f('retikulosit', 'Retikulosit', 'hematology', 'number', normal('0,5-2,5', '%')),

  // Hitung Jenis Leukosit
  f('basofil', 'Basofil', 'hematology', 'number', normal('0-1', '%')),
  f('eosinofil', 'Eosinofil', 'hematology', 'number', normal('1-3', '%')),
  f('neutrofilBatang', 'Neutrofil Batang', 'hematology', 'number', normal('2-6', '%')),
  f('neutrofilSegmen', 'Neutrofil (Segmen)', 'hematology', 'number', normal('50-70', '%')),
  f('limfosit', 'Limfosit', 'hematology', 'number', normal('20-40', '%')),
  f('monosit', 'Monosit', 'hematology', 'number', normal('2-8', '%')),

  // Hemostasis & Golongan Darah
  f('masaPerdarahan', 'Masa Perdarahan (BT)', 'hematology', 'number', normal('1-3', 'menit')),
  f('masaPembekuan', 'Masa Pembekuan (CT)', 'hematology', 'number', normal('4-10', 'menit')),

  // AKâ€“BB Kimia darah
  // Lemak Darah
  f('chol', 'Kolesterol Total', 'chemistry', 'number', normal('<200', 'mg/dL')),
  f('hdl', 'HDL', 'chemistry', 'number', normal('â‰¥50', 'mg/dL')),
  f('ldl', 'LDL', 'chemistry', 'number', normal('<100', 'mg/dL')),
  f('tg', 'Trigliserida', 'chemistry', 'number', normal('<150', 'mg/dL')),

  // Fungsi Ginjal
  f('ureum', 'Ureum', 'chemistry', 'number', normal('16,6-48,5', 'mg/dL')),
  f('kreatinin', 'Kreatinin', 'chemistry', 'number', normal('0.6-1.2', 'mg/dL')),
  // eGFR boleh diisi manual dari hasil laboratorium. Bila kosong, engine
  // menghitungnya otomatis dengan CKD-EPI 2021 dari kreatinin + usia + jenis kelamin.
  f('egfr', 'eGFR (Glomerular Filtration Rate)', 'chemistry', 'number', { ...normal('â‰¥90', 'mL/menit/1,73 mÂ²'), autoCalc: true, autoCalcFrom: ['kreatinin', 'usia', 'jenisKelamin'] }),
  f('au', 'Asam Urat', 'chemistry', 'number', { unit: 'mg/dL', normalMale: '3,4-7,0', normalFemale: '2,4-6,0' }),

  // Fungsi Hati
  f('sgot', 'SGOT', 'chemistry', 'number', normal('<40', 'U/L')),
  f('sgpt', 'SGPT', 'chemistry', 'number', normal('<41', 'U/L')),
  f('billirubin', 'Bilirubin Total', 'chemistry', 'number', normal('0,2-1,2', 'mg/dL')),
  f('billirubinDirect', 'Bilirubin Direct', 'chemistry', 'number', normal('<0,3', 'mg/dL')),
  f('billirubinIndirect', 'Bilirubin Indirect', 'chemistry', 'number', normal('<0,8', 'mg/dL')),
  f('alp', 'Alkali Fosfatase (ALP)', 'chemistry', 'number', normal('44-147', 'IU/L')),
  f('ggt', 'Gamma GT', 'chemistry', 'number', normal('8-61', 'U/L')),
  f('proteinTotal', 'Protein Total', 'chemistry', 'number', normal('6,4-8,3', 'g/dL')),
  f('albumin', 'Albumin', 'chemistry', 'number', normal('3,5-5,2', 'g/dL')),
  f('globulin', 'Globulin', 'chemistry', 'number', normal('2,0-3,5', 'g/dL')),

  // Glukosa Darah
  f('gdp', 'Glukosa Puasa', 'chemistry', 'number', normal('70-100', 'mg/dL')),
  f('gd2pp', 'Glukosa 2 Jam Post Prandial', 'chemistry', 'number', normal('<140', 'mg/dL')),
  f('hba1c', 'HbA1c', 'chemistry', 'number', normal('<6,5', '%')),
  f('glukosaSewaktu', 'Glukosa Sewaktu', 'chemistry', 'number', normal('<200', 'mg/dL')),
  f('diabetes', 'Diabetes', 'chemistry', 'select', { options: ['Ya', 'Tidak'], autoCalc: true, autoCalcFrom: ['gdp', 'gd2pp', 'hba1c'] }),

  // Elektrolit
  f('natrium', 'Natrium (Na)', 'chemistry', 'number', normal('135-145', 'mmol/L')),
  f('kalium', 'Kalium (K)', 'chemistry', 'number', normal('3,5-5,1', 'mmol/L')),
  f('klorida', 'Klorida (Cl)', 'chemistry', 'number', normal('98-107', 'mmol/L')),
  f('kalsium', 'Kalsium (Ca)', 'chemistry', 'number', normal('8,6-10,3', 'mg/dL')),

  // Fungsi Jantung
  f('ckmb', 'CK-MB', 'chemistry', 'number', normal('<25', 'U/L')),
  f('troponin', 'Troponin', 'chemistry', 'number', normal('<0,04', 'ng/mL')),

  // Status Besi
  f('besiFe', 'Besi (Fe)', 'chemistry', 'number', normal('65-175', 'Âµg/dL')),
  f('tibc', 'TIBC', 'chemistry', 'number', normal('250-450', 'Âµg/dL')),
  f('ferritin', 'Ferritin', 'chemistry', 'number', { unit: 'ng/mL', normalMale: '30-400', normalFemale: '13-150' }),

  // ── URINE LENGKAP ─────────────────────────────────────────────
  // 19 parameter disimpan di kolom terpisah (ul_*) agar bisa di-query per
  // parameter. Kolom `ul` lama tetap dipertahankan sebagai ringkasan
  // komposit autoCalc untuk engine zonasi, diagnosis, dan Eksel.
  //
  // Seluruh istilah memakai bahasa Indonesia. HPF (high power field) diganti
  // LPB (lapang pandang besar) sesuai istilah laboratorium Indonesia.
  //
  // Makroskopis
  f('ulWarna', 'Warna', 'urinalysis', 'select', {
    options: ['Kuning Muda', 'Kuning', 'Kuning Gelap', 'Amber', 'Merah', 'Keruh Kemerahan'],
    allowCustom: true,
    normalRange: 'Kuning Muda',
  }),
  f('ulKejernihan', 'Kejernihan', 'urinalysis', 'select', {
    options: ['Jernih', 'Agak Keruh', 'Keruh', 'Sangat Keruh'],
    normalRange: 'Jernih',
    allowCustom: true,
  }),
  f('ulBau', 'Bau', 'urinalysis', 'select', {
    options: ['Aromatik', 'Manis', 'Amoniakal', 'Busuk'],
    normalRange: 'Aromatik',
    allowCustom: true,
  }),

  // Kimia Urine
  // Parameter ber-nilai ANGKA diisi teks bebas (bukan dropdown): pilihan
  // dropdown terbatas tidak mampu menampung hasil di luar rentang alat ukur,
  // dan daftar nilai yang panjang justru menyulitkan operator.
  f('ulPh', 'pH', 'urinalysis', 'text', {
    normalRange: '4,6-8,0',
    placeholder: '6,0',
  }),
  f('ulBeratJenis', 'Berat Jenis', 'urinalysis', 'text', {
    normalRange: '1,005-1,030',
    placeholder: '1,015',
  }),
  f('ulProtein', 'Protein', 'urinalysis', 'select', {
    options: ['Negatif', 'Trace', '+1', '+2', '+3', '+4'],
    normalRange: 'Negatif',
    allowCustom: true,
  }),
  f('ulGlukosa', 'Glukosa', 'urinalysis', 'select', {
    options: ['Negatif', '+1', '+2', '+3', '+4'],
    normalRange: 'Negatif',
    allowCustom: true,
  }),
  f('ulBilirubin', 'Bilirubin', 'urinalysis', 'select', {
    options: ['Negatif', '+1', '+2', '+3', '+4'],
    normalRange: 'Negatif',
    allowCustom: true,
  }),
  f('ulUrobilinogen', 'Urobilinogen', 'urinalysis', 'select', {
    options: ['Normal', '+1', '+2', 'Tinggi'],
    normalRange: 'Normal',
    allowCustom: true,
  }),
  f('ulKeton', 'Keton', 'urinalysis', 'select', {
    options: ['Negatif', '+1', '+2', '+3', '+4'],
    normalRange: 'Negatif',
    allowCustom: true,
  }),
  f('ulNitrit', 'Nitrit', 'urinalysis', 'select', {
    options: ['Negatif', 'Positif'],
    normalRange: 'Negatif',
    allowCustom: true,
  }),
  f('ulLeukositEsterase', 'Leukosit Esterase', 'urinalysis', 'select', {
    options: ['Negatif', '+1', '+2', '+3', '+4'],
    normalRange: 'Negatif',
    allowCustom: true,
  }),
  f('ulDarah', 'Darah', 'urinalysis', 'select', {
    options: ['Negatif', '+1', '+2', '+3', '+4'],
    normalRange: 'Negatif',
    allowCustom: true,
  }),

  // Mikroskopis (Sedimen) — satuan LPB (lapang pandang besar), bukan HPF.
  f('ulLeukosit', 'Leukosit', 'urinalysis', 'text', {
    unit: '/LPB',
    normalRange: '0-5',
    placeholder: '1-2',
  }),
  f('ulEritrosit', 'Eritrosit', 'urinalysis', 'text', {
    unit: '/LPB',
    normalRange: '0-2',
    placeholder: '0-1',
  }),
  f('ulSelEpitel', 'Sel Epitel', 'urinalysis', 'select', {
    options: ['Sedikit', 'Sedang', 'Banyak'],
    normalRange: 'Sedikit',
    allowCustom: true,
  }),
  f('ulSilinder', 'Silinder', 'urinalysis', 'select', {
    options: ['Negatif', '+1', '+2', '+3'],
    normalRange: 'Negatif',
    allowCustom: true,
  }),
  f('ulKristal', 'Kristal', 'urinalysis', 'select', {
    options: ['Negatif', '+1', '+2', '+3'],
    normalRange: 'Negatif',
    allowCustom: true,
  }),
  f('ulBakteri', 'Bakteri', 'urinalysis', 'select', {
    options: ['Negatif', '+1', '+2', '+3'],
    normalRange: 'Negatif',
    allowCustom: true,
  }),
  f('ulJamur', 'Jamur', 'urinalysis', 'select', {
    options: ['Negatif', '+1', '+2', '+3'],
    normalRange: 'Negatif',
    allowCustom: true,
  }),
  // `ul` = KESIMPULAN urinalisis: hanya parameter yang ABNORMAL, dibangun
  // otomatis oleh engine. Bukan salinan seluruh nilai — tujuannya supaya
  // pembaca langsung melihat temuan tanpa membaca 19 baris.
  f('ul', 'Kesimpulan Urinalisis', 'urinalysis', 'textarea', { autoCalc: true }),

  // ── SEROLOGI / IMUNOLOGI ──────────────────────────────────────
  // Hepatitis
  ...([
    ['hbsag', 'HBsAg'], ['antiHbs', 'Anti-HBs'], ['antiHbc', 'Anti-HBc Total'],
    ['antiHcv', 'Anti-HCV'], ['antiHav', 'Anti-HAV'],
  ] as const).map(([id, label]) => f(id, label, 'serology', 'select', select(['Non - Reaktif', 'Reaktif']))),
  // Infeksi Menular
  ...([
    ['hiv', 'Anti-HIV'], ['vdrl', 'VDRL / RPR'], ['tpha', 'TPHA'],
  ] as const).map(([id, label]) => f(id, label, 'serology', 'select', select(['Non - Reaktif', 'Reaktif']))),
  f('widal', 'Widal (Tifoid)', 'serology', 'select', {
    options: ['Negatif', 'O 1/80', 'O 1/160', 'O 1/320', 'H 1/80', 'H 1/160', 'H 1/320', 'Positif'],
    allowCustom: true,
  }),
  f('mantoux', 'Mantoux / IGRA (TB)', 'serology', 'select', {
    options: ['Negatif', 'Positif', 'Indeterminate'],
    allowCustom: true,
  }),

  // ── TES NAPZA (URINE) ─────────────────────────────────────────
  ...([
    ['drugAmp', 'Amfetamin'], ['drugMeth', 'Metamfetamin'],
    ['drugMorph', 'Morfin'], ['drugCanna', 'THC (Marijuana)'],
    ['drugBenz', 'Benzodiazepin'], ['drugCoc', 'Kokain'],
    ['drugCaris', 'Carisoprodol'], ['alkohol', 'Alkohol'],
  ] as const).map(([id, label]) => f(id, label, 'drug', 'select', select(['Negatif', 'Positif']))),
  f('psa', 'PSA', 'drug', 'number', { unit: 'ng/mL', normalRange: '<4' }),

  // ── LOGAM BERAT / TOKSIKOLOGI ─────────────────────────────────
  ...([
    ['pb', 'Timbal (Pb)'], ['hg', 'Merkuri (Hg)'], ['as', 'Arsen (As)'],
    ['cd', 'Kadmium (Cd)'], ['cr', 'Kromium (Cr)'], ['mn', 'Mangan (Mn)'],
    ['ni', 'Nikel (Ni)'], ['cu', 'Tembaga (Cu)'], ['zn', 'Seng (Zn)'],
    ['co', 'Kobalt (Co)'],
  ] as const).map(([id, label]) => f(id, label, 'toxicology', 'number', { unit: 'Âµg/dL' })),
  f('kolinesterase', 'Kolinesterase (paparan pestisida)', 'toxicology', 'number', { unit: 'U/L' }),
  f('karboksihemoglobin', 'Karboksihemoglobin (CO)', 'toxicology', 'number', { unit: '%' }),

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


  // ── SPIROMETRI ────────────────────────────────────────────────
  // Metode penilaian menentukan RUMUS interpretasi yang dipakai engine.
  // Referensi yang beredar berbeda ambangnya (PDPI, GOLD, ATS/ERS, dll.),
  // sehingga hasil bisa berubah hanya karena metode yang dipilih berbeda.
  // Operator memilih metode di sini; engine membaca pilihan ini.
  // "Manual" berarti interpretasi ditulis sendiri oleh pemeriksa.
  f('spiMetode', 'Metode Penilaian Spirometri', 'spirometry', 'select', {
    options: [
      'PDPI 2016 (Indonesia)',
      'GOLD 2024',
      'ATS/ERS 2022 (GLI-2012)',
      'NHANES III',
      'Manual (tulis sendiri)',
    ],
  }),
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
  // ── KEBUGARAN ─────────────────────────────────────────────────
  // Setiap jenis tes punya SATUAN dan cara penilaian sendiri, jadi tidak
  // boleh digabung dalam satu field. Kolom `tesKebugaran` lama tetap ada
  // sebagai ringkasan otomatis agar data & laporan lama tidak hilang.
  //
  // Jenis tes yang lazim pada MCU perusahaan:
  //   • 6 Minutes Walk Test (6MWT) — jarak tempuh (meter)
  //   • Harvard Step Test — indeks kebugaran (skor)
  //   • YMCA Step Test — denyut nadi pemulihan (bpm)
  //   • Queen's College Step Test — VO2max (mL/kg/menit)
  //   • Ergocycle / Astrand-Ryhming — VO2max (mL/kg/menit)
  //   • Sit-Up 30 detik / Push-Up — jumlah repetisi
  //   • Fleksi (Sit and Reach) — kelentukan (cm)
  //
  // Treadmill TIDAK didaftarkan di sini: hasilnya sudah dicatat pada field
  // `tmHasil` di Radiologi & USG, dan engine sudah mengklasifikasikannya
  // (classifyTreadmill). Menambah field kedua untuk pemeriksaan yang sama
  // hanya membuat data terbelah di dua kolom.
  f('tes6mwt', '6 Minutes Walk Test — Jarak Tempuh', 'fitness', 'number', { unit: 'meter' }),
  f('tesHarvard', 'Harvard Step Test — Indeks Kebugaran', 'fitness', 'number', { unit: 'skor' }),
  f('tesYMCAStep', 'YMCA Step Test — Nadi Pemulihan', 'fitness', 'number', { unit: 'bpm' }),
  f('tesQueensCollege', 'Queen\'s College Step Test — VO2max', 'fitness', 'number', { unit: 'mL/kg/menit' }),
  f('tesErgocycle', 'Ergocycle / Astrand-Ryhming — VO2max', 'fitness', 'number', { unit: 'mL/kg/menit' }),
  f('tesSitUp', 'Sit-Up 30 Detik', 'fitness', 'number', { unit: 'kali' }),
  f('tesPushUp', 'Push-Up', 'fitness', 'number', { unit: 'kali' }),
  f('tesSitAndReach', 'Fleksi (Sit and Reach)', 'fitness', 'number', { unit: 'cm' }),
  // Ringkasan otomatis dari seluruh tes di atas. Tes ini BUKAN parameter
  // zonasi menurut SOP, tetapi hasilnya tetap dicatat sebagai temuan.
  f('tesKebugaran', 'Ringkasan Tes Kebugaran (Otomatis)', 'fitness', 'text', { autoCalc: true }),
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
  ulPh: 'pH',
  ulBeratJenis: 'Berat Jenis',
  ulProtein: 'Protein',
  ulGlukosa: 'Glukosa',
  ulBilirubin: 'Bilirubin',
  ulUrobilinogen: 'Urobilinogen',
  ulKeton: 'Keton',
  ulNitrit: 'Nitrit',
  ulLeukositEsterase: 'Leukosit Esterase',
  ulDarah: 'Darah',
  ulLeukosit: 'Leukosit',
  ulEritrosit: 'Eritrosit',
  ulSelEpitel: 'Sel Epitel',
  ulSilinder: 'Silinder',
  ulKristal: 'Kristal',
  ulBakteri: 'Bakteri',
  ulJamur: 'Jamur',
};

export const URINALYSIS_FIELD_IDS: string[] = Object.keys(URINALYSIS_FIELD_LABELS);

/**
 * Nilai urinalisis yang dianggap NORMAL. Dipakai untuk menyusun kesimpulan:
 * hanya parameter di luar daftar ini yang ditulis ke kolom `ul`.
 */
const UL_NORMAL_VALUES = new Set([
  'negatif', 'negative', 'normal', 'jernih', 'aromatik', 'sedikit',
  'kuning muda', 'kuning',
]);

/** Rentang normal parameter urinalisis yang berisi angka. */
const UL_NUMERIC_RANGE: Record<string, [number, number]> = {
  ulPh: [4.6, 8.0],
  ulBeratJenis: [1.005, 1.03],
  ulLeukosit: [0, 5],
  ulEritrosit: [0, 2],
};

/** true bila satu nilai urinalisis berada di luar batas normal. */
export function isUlValueAbnormal(fieldId: string, raw: string | null | undefined): boolean {
  const value = String(raw ?? '').trim();
  if (!value) return false;
  if (UL_NORMAL_VALUES.has(value.toLowerCase())) return false;

  const range = UL_NUMERIC_RANGE[fieldId];
  if (range) {
    // Sedimen ditulis sebagai rentang ("0-2", "3-5 /LPB"); pakai angka
    // TERBESAR sebagai batas atas, karena itulah yang menentukan abnormal.
    const numbers = value.match(/\d+(?:[.,]\d+)?/g);
    if (numbers && numbers.length > 0) {
      const highest = Math.max(...numbers.map((n) => Number(n.replace(',', '.'))));
      return highest > range[1] || highest < range[0];
    }
  }
  return true;
}

/**
 * KESIMPULAN urinalisis: hanya parameter yang ABNORMAL, satu per baris.
 *
 * Dulu fungsi ini menyalin SELURUH 19 nilai ke kolom `ul`, sehingga kolom
 * kesimpulan berisi hal yang sama dengan tabel parameter dan temuan penting
 * tenggelam di antara nilai normal. Sekarang hanya temuan yang ditulis.
 *
 * Bila semua parameter normal tetapi ada yang diperiksa, hasilnya
 * "Dalam batas normal" supaya jelas bahwa pemeriksaan memang dilakukan.
 */
export function buildUlComposite(values: Record<string, string | undefined | null>): string {
  const abnormal: string[] = [];
  let adaNilai = false;
  for (const fieldId of URINALYSIS_FIELD_IDS) {
    const v = values[fieldId];
    if (v == null || String(v).trim() === '') continue;
    adaNilai = true;
    if (!isUlValueAbnormal(fieldId, v)) continue;
    abnormal.push(`${URINALYSIS_FIELD_LABELS[fieldId]}: ${String(v).trim()}`);
  }
  if (abnormal.length > 0) return abnormal.join('\n');
  return adaNilai ? 'Dalam batas normal' : '';
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
  // Label lama (sebelum istilah diindonesiakan) tetap dikenali supaya record
  // yang tersimpan dengan istilah Inggris masih bisa dipulihkan ke kolomnya.
  const LEGACY_LABELS: Record<string, string> = {
    'Berat Jenis (SG)': 'ulBeratJenis',
    'Protein / Albumin': 'ulProtein',
    'Glukosa / Reduksi': 'ulGlukosa',
    'Darah / Darah Samar': 'ulDarah',
    'Eritrosit / Sel Darah Merah': 'ulEritrosit',
    'Leukosit / Sel Darah Putih': 'ulLeukosit',
    'Silinder (Casts)': 'ulSilinder',
    'Bakteri / Mikroorganisme': 'ulBakteri',
  };
  Object.assign(labelToField, LEGACY_LABELS);
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


