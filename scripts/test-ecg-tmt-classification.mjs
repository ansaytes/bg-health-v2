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

import { loadClinicalClassification } from './lib/mcu-calc-bridge.mjs';

const { classifyEcg, classifyTreadmill } = loadClinicalClassification();

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
process.exit(gagal === 0 ? 0 : 1);