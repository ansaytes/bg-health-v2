// ============================================================
// Uji klasifikasi free-text EKG dan TMT.
//
// Nilai uji diambil dari nilai yang BENAR-BENAR ada di mcu_records
// (survei 34 nilai EKG + 5 nilai TMT), bukan contoh karangan. Tujuannya
// memastikan dua aturan yang paling sering salah dijawab:
//
//   1. Bacaan varian normal ("Normal Variations of Resting ECG ...")
//      tidak boleh menjadi diagnosis.
//   2. "Negative Ischemic Response" adalah hasil normal, bukan abnormal.
//
// Choi: null = tidak muncul sebagai diagnosis sama sekali.
// ============================================================

import { loadClinicalClassification, loadMCUFields } from './lib/mcu-calc-bridge.mjs';

const { classifyEcg, classifyTreadmill } = loadClinicalClassification();
const { MCU_FIELD_DEFINITION } = loadMCUFields();

// [nilai di DB, severity yang diharapkan, catatan]
const ECG = [
  // ── Varian normal: HARUS normal, tidak ada diagnosis ──
  ['Normal Resting ECG', null, 'baseline terbesar di DB'],
  ['normal Resting ECG', null, 'kapitalisasi tidak boleh berpengaruh'],
  ['Normal Variations of Resting ECG', null, 'varian normal'],
  ['Normal Variations of Resting ECG (Sinus Bradikardi )', null, 'bradycardia di dalam kurung tetap normal'],
  ['Normal Variations of Resting ECG (Synus Bradichardia)', null, 'varian + salah eja'],
  ['Sinus Bradycardia (Normal Variant)', null, 'bradycardia yang dinyatakan varian normal'],
  ['Sinus Bradicardy (Normal Variant)', null, 'salah eja + varian normal'],
  ['RAD Normal Variant', null, 'axis deviation varian normal'],
  ['IRBBB', null, 'incomplete RBBB sendirian'],
  ['Incomplete RBBB', null, 'incomplete RBBB sendirian'],

  // ── Kuning ──
  ['Sinus Bradicardia', 'kuning', 'salah eja, 21 record'],
  ['Sinus Bradikardia', 'kuning', 'salah eja'],
  ['Sinus Arhytmia', 'kuning', 'salah eja, 7 record'],
  ['Sinus Bradikardia with Arhytmia', 'kuning', 'dua ejaan salah'],
  ['Sinus Arhytmia + LVH', 'kuning', 'gabungan, ambil yang serius'],
  // Regresi: "w/o RVH" berarti RVH TIDAK ada. Label tidak boleh
  // menampilkan "Ventricular Hypertrophy" karena bertentangan
  // dengan bacaan aslinya.
  ['Synus Rythm w/ RBBB w/o RVH', 'kuning', 'RBBB ada, RVH dinyatakan tidak ada'],
  ['Sinus Rhythm without LBBB', null, 'LBBB dinyatakan tidak ada'],
  ['Sinus Rythm tanpa AMI', null, 'AMI dinyatakan tidak ada'],
  ['Sinus Tachicardi 108 bpm', 'kuning', 'salah eja + angka'],
  ['Sinus Tachicardi 107 bpm', 'kuning', 'salah eja + angka'],
  ['Sinus Takikardi (110x/mnt)', 'kuning', 'bahasa Indonesia'],
  ['Sinus Tachycardia (HR 115 bpm)', 'kuning', 'bahasa Inggris'],
  ['Synus Rythm w/ RBBB w/o RVH', 'kuning', 'RBBB lengkap'],
  ['RBBB', 'kuning', 'RBBB lengkap'],
  ['PVC', 'kuning', 'ektopik ventrikel'],
  ['RAD', 'kuning', 'axis deviation'],
  ['LAD', 'kuning', 'axis deviation'],
  ['Susp. LAD', 'kuning', 'curigakan LAD'],
  ['Low Atrial Rythm', 'kuning', 'salah eja + ritme atrium rendah'],
  ['Deviasi Sumbu Kanan', 'kuning', 'bahasa Indonesia'],

  // ── Merah ──
  ['ST Abnormal', 'merah', 'ST abnormal'],
  ['AMI Anteroseptal', 'merah', 'infark miokard akut'],
  ['Sinus dengan OMI Inferior', 'merah', 'oklusi miokard inferior'],
  ['Atrial Fibrillation with moderate and RVH', 'merah', 'AF'],
  ['AV Block', 'merah', 'blok AV'],
  ['Susp. LBBB', 'merah', 'curigakan LBBB'],

  // ── Kosong / tidak dilakukan ──
  ['', null, 'kosong'],
  [null, null, 'null'],
];

const TMT = [
  ['Negative Ischemic Response', null, 'hasil normal, 119 record'],
  ['Positive Ischemic Response', 'merah', '2 record'],
  ['Inconclusive (HR<85% Target)', 'kuning', 'tes tidak selesai, wajib diulang'],
  ['PVC Occasional LV Apex', 'kuning', 'ektopik saat exercise'],
  ['', null, 'kosong'],
  [null, null, 'null'],
];

let gagal = 0;
for (const [uji, fn, label] of [
  [ECG, classifyEcg, 'EKG'],
  [TMT, classifyTreadmill, 'TMT'],
]) {
  console.log(`\n=== ${label} ===`);
  for (const [nilai, harap, catatan] of uji) {
    const out = fn(nilai);
    const dapat = out ? out.severity : null;
    const ok = dapat === harap;
    if (!ok) gagal += 1;
    const labelOut = out ? `${dapat.padEnd(6)} ${out.label}` : 'normal (tanpa diagnosis)';
    console.log(
      `  ${ok ? 'OK  ' : 'GAGAL'} ${JSON.stringify(nilai)} -> ${labelOut}` +
        (ok ? '' : `  <-- harap ${harap ?? 'normal'}`) +
        `   [${catatan}]`,
    );
  }
}

console.log(
  `\n${gagal === 0 ? 'LULUS' : 'GAGAL'}: ${gagal} ketidakcocokan dari ${ECG.length + TMT.length} kasus.`,
);

// ============================================================
// KUNCI: setiap opsi dropdown harus mengklasifikasi seperti maksudnya.
//
// Field EKG dan treadmill memakai select, jadi operator tidak bisa
// memilih nilai yang tidak ada di daftar. Konsekuensinya daftar itu
// menjadi satu-satunya sumber nilai baru — dan kalau satu opsi
// mengklasifikasi salah, diagnosis otomatis ikut salah untuk semua
// record yang memakai opsi itu.
//
// Contoh jebakan yang dicek di sini: "Incomplete Right Bundle Branch
// Block" mengandung frasa "Bundle Branch Block", jadi harus tetap
// normal, bukan naik seperti RBBB lengkap.
// ============================================================

// Opsi yang memang HARUS normal: tidak boleh jadi diagnosis.
const OPSI_NORMAL = new Set([
  'Normal Sinus Rhythm',
  'Normal Variant of Resting ECG',
  // Jebakan yang harus dijaga: opsi ini mengandung frasa
  // "Bundle Branch Block" seperti RBBB lengkap, tapi IRBBB sendirian
  // tetap normal menurut STD-006.
  'Incomplete Right Bundle Branch Block',
  'Negative Ischemic Response',
  'Not Performed',
]);

// Opsi yang harus Merah karena kritis per STD-006.
const OPSI_MERAH = new Set([
  'Atrioventricular Block',
  'Atrial Fibrillation',
  'ST Segment Abnormal',
  'Acute Myocardial Infarction',
  'Left Bundle Branch Block',
  'Positive Ischemic Response',
]);

console.log('\n=== Opsi dropdown -> klasifikasi ===');
const opsiGagal = [];
for (const id of ['ecgHasil', 'tmHasil']) {
  const field = MCU_FIELD_DEFINITION.find((f) => f.id === id);
  if (!field) { opsiGagal.push(`${id}: field tidak ditemukan`); continue; }
  if (field.type !== 'select') { opsiGagal.push(`${id}: masih bertipe ${field.type}, seharusnya select`); continue; }
  const fn = id === 'ecgHasil' ? classifyEcg : classifyTreadmill;
  for (const opt of field.options ?? []) {
    const dapat = fn(opt)?.severity ?? null;
    const harap = OPSI_NORMAL.has(opt) ? null : OPSI_MERAH.has(opt) ? 'merah' : 'kuning';
    const ok = dapat === harap;
    if (!ok) opsiGagal.push(`${id} "${opt}": dapat ${dapat ?? 'normal'}, harap ${harap ?? 'normal'}`);
    console.log(
      `  ${ok ? 'OK  ' : 'GAGAL'} [${id}] ${opt.padEnd(48)} -> ${dapat ?? 'normal (tanpa diagnosis)'}`,
    );
  }
}

// Nilai legacy di luar dropdown harus tetap diklasifikasi PERSIS seperti
// sebelum field diubah jadi select. Kalau ini berubah, 1299 record lama
// ikut salah diagnosis tanpa ada yang menyadarinya.
//
// Diuji lewat expectation yang sama, bukan sekadar "harus ada temuan":
// nilai normal yang memang normal memang tidak menghasilkan diagnosis.
const LEGACY = [
  ['ecg', 'Normal Resting ECG', null],
  ['ecg', 'Normal Variations of Resting ECG (Sinus Bradikardi )', null],
  ['ecg', 'Sinus Bradicardia', 'kuning'],
  ['ecg', 'Sinus Arhytmia + LVH', 'kuning'],
  ['ecg', 'Synus Rythm w/ RBBB w/o RVH', 'kuning'],
  ['ecg', 'ST Abnormal', 'merah'],
  ['ecg', 'Sinus dengan OMI Inferior', 'merah'],
  ['tmt', 'Negative Ischemic Response', null],
  ['tmt', 'Inconclusive (HR<85% Target)', 'kuning'],
];

console.log('\n=== Nilai legacy di luar dropdown ===');
for (const [jenis, nilai, harap] of LEGACY) {
  const out = jenis === 'tmt' ? classifyTreadmill(nilai) : classifyEcg(nilai);
  const dapat = out?.severity ?? null;
  const ok = dapat === harap;
  if (!ok) opsiGagal.push(`legacy "${nilai}": dapat ${dapat ?? 'normal'}, harap ${harap ?? 'normal'}`);
  console.log(
    `  ${ok ? 'OK  ' : 'GAGAL'} ${nilai.padEnd(48)} -> ${dapat ?? 'normal (tanpa diagnosis)'}`,
  );
}

// ============================================================
// KUNCI: opsi normal tidak boleh masuk daftar follow-up.
//
// diagnosa_medis sudah dikunci di atas, tapi kolom item_fu /
// perlu_fu punya jalurnya sendiri (buildFormulaFollowUp di
// mcu-calculations.ts) dengan daftar normalnya sendiri. Kalau opsi
// "Not Performed" atau "Negative Ischemic Response" lolos ke sana, hasil
// MCU yang sebenarnya bersih akan punya daftar tindak lanjut.
// ============================================================

const { calculateRecord } = await import('./lib/mcu-calc-bridge.mjs');

const NORMAL_HARUS_BERSIH = {
  ecg_hasil: ['Normal Sinus Rhythm', 'Normal Variant of Resting ECG', 'Not Performed'],
  tm_hasil: ['Not Performed', 'Negative Ischemic Response'],
};

console.log('\n=== Opsi normal tidak masuk follow-up ===');
const fuGagal = [];
for (const [kolom, nilaiList] of Object.entries(NORMAL_HARUS_BERSIH)) {
  for (const nilai of nilaiList) {
    const out = calculateRecord({ [kolom]: nilai, td_s: '120', td_d: '80' });
    const itemFu = String(out.item_fu ?? '');
    const perluFu = String(out.perlu_fu ?? '');
    const tercemar = new RegExp(kolom === 'ecg_hasil' ? 'ECG\\s*:' : 'Treadmill\\s*:').test(itemFu);
    if (tercemar) fuGagal.push(`${kolom} "${nilai}" masuk follow-up: ${itemFu.slice(0, 60)}`);
    console.log(
      `  ${tercemar ? 'GAGAL' : 'OK  '} ${nilai.padEnd(48)} item_fu${tercemar ? ' TERCEMAR' : ' bersih'}`,
    );
  }
}

// Sebaliknya, opsi abnormal HARUS masuk follow-up.
console.log('\n=== Opsi abnormal masuk follow-up ===');
for (const [kolom, nilai] of [
  ['ecg_hasil', 'ST Segment Abnormal'],
  ['ecg_hasil', 'Atrial Fibrillation'],
  ['tm_hasil', 'Positive Ischemic Response'],
  ['tm_hasil', 'Non-Diagnostic Test (Target Heart Rate Not Achieved)'],
]) {
  const out = calculateRecord({ [kolom]: nilai, td_s: '120', td_d: '80' });
  const itemFu = String(out.item_fu ?? '');
  const ada = new RegExp(kolom === 'ecg_hasil' ? 'ECG\\s*:' : 'Treadmill\\s*:').test(itemFu);
  if (!ada) fuGagal.push(`${kolom} "${nilai}" TIDAK masuk follow-up padahal abnormal`);
  console.log(`  ${ada ? 'OK  ' : 'GAGAL'} ${nilai.padEnd(48)} item_fu ada`);
}

// ============================================================
// KUNCI: daftar migrasi tidak boleh menulis nilai yang tidak ada di
// dropdown.
//
// Script normalize-ecg-treadmill.mjs memetakan nilai lama ke nilai
// kanonis. Kalau target pemetaan tidak ada di daftar opsi, operator
// tidak akan pernah bisa memilih ulang nilai itu di form — recordnya
// jadi memakai nilai yang tidak bisa dipertahankan.
//
// Ini sempat terjadi: "Left Bundle Branch Block" terpetakan tapi tidak
// ada di dropdown, dan tes lama tidak menyadarinya karena hanya
// mengiterasi opsi yang sudah ada di daftar.
// ============================================================

const petaMigrasi = {
  ecgHasil: {
    'Sinus Bradycardia': 'kuning',
    'Sinus Tachycardia': 'kuning',
    'Sinus Arrhythmia': 'kuning',
    'Low Atrial Rhythm': 'kuning',
    'Right Axis Deviation': 'kuning',
    'Left Axis Deviation': 'kuning',
    'Incomplete Right Bundle Branch Block': null,
    'Right Bundle Branch Block': 'kuning',
    'Left Bundle Branch Block': 'merah',
    'Left Ventricular Hypertrophy': 'kuning',
    'Right Ventricular Hypertrophy': 'kuning',
    'Premature Ventricular Contraction': 'kuning',
    'Atrioventricular Block': 'merah',
    'Atrial Fibrillation': 'merah',
    'ST Segment Abnormal': 'merah',
    'Acute Myocardial Infarction': 'merah',
    'Normal Sinus Rhythm': null,
    'Normal Variant of Resting ECG': null,
    'Not Performed': null,
  },
  tmHasil: {
    'Negative Ischemic Response': null,
    'Positive Ischemic Response': 'merah',
    'Non-Diagnostic Test (Target Heart Rate Not Achieved)': 'kuning',
    'Ventricular Ectopy during Exercise': 'kuning',
    'Abnormal Blood Pressure Response': 'kuning',
    'Not Performed': null,
  },
};

console.log('\n=== Nilai migrasi ada di dropdown & klasifikasinya benar ===');
const migrasiGagal = [];
for (const [id, harusnya] of Object.entries(petaMigrasi)) {
  const field = MCU_FIELD_DEFINITION.find((f) => f.id === id);
  const opsi = field?.options ?? [];
  const fn = id === 'ecgHasil' ? classifyEcg : classifyTreadmill;
  for (const [nilai, severity] of Object.entries(harusnya)) {
    const ada = opsi.includes(nilai);
    const dapat = fn(nilai)?.severity ?? null;
    const ok = ada && dapat === severity;
    if (!ok) {
      migrasiGagal.push(
        `${id} "${nilai}": ${ada ? 'ada di dropdown' : 'TIDAK ADA DI DROPDOWN'}, klasifikasi ${dapat ?? 'normal'} (harap ${severity ?? 'normal'})`,
      );
    }
    console.log(
      `  ${ok ? 'OK  ' : 'GAGAL'} [${id}] ${nilai.padEnd(48)} -> ${dapat ?? 'normal'}${ada ? '' : '  TIDAK ADA DI DROPDOWN'}`,
    );
  }
}

if (migrasiGagal.length > 0) {
  console.log(`\nMASIH SALAH (nilai migrasi):`);
  for (const g of migrasiGagal) console.log(`  - ${g}`);
}

if (opsiGagal.length > 0) {
  console.log(`\nMASIH SALAH (klasifikasi):`);
  for (const g of opsiGagal) console.log(`  - ${g}`);
}

if (fuGagal.length > 0) {
  console.log(`\nMASIH SALAH (follow-up):`);
  for (const g of fuGagal) console.log(`  - ${g}`);
}
const totalSemua = gagal + opsiGagal.length + fuGagal.length + migrasiGagal.length;
console.log(
  `\n${totalSemua === 0 ? 'LULUS' : 'GAGAL'}: ${totalSemua} ketidakcocokan total (nilai lama, opsi dropdown, follow-up, nilai migrasi).`,
);
process.exit(totalSemua === 0 ? 0 : 1);