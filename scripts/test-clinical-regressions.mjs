// ============================================================
// Pengaman untuk empat koreksi yang pernah menyesatkan.
//
//   1. Satuan FEV1/FVC: rasio tersimpan sebagai DESIMAL (0,83) tetapi
//      ambang PDPI ditulis PERSEN (70). Tanpa normalisasi, SETIAP record
//      terbaca obstruktif — 1234 dari 1299 record.
//   2. eGFR harus dihitung SEBELUM diagnosa. Dulu urutannya terbalik,
//      sehingga CKD Stage G3a/G5 hilang dari diagnosa_medis CSV import.
//   3. First-degree AV block tidak boleh sama dengan blok AV lengkap:
//      yang pertama kuning, yang kedua merah.
//   4. Nilai placeholder Excel ("#N/A") tidak boleh ikut jadi data.
//
// Semua diuji lewat engine APLIKASI, bukan salinan rumus.
// ============================================================

import { calculateRecord, loadClinicalClassification } from './lib/mcu-calc-bridge.mjs';

const gagal = [];
const cek = (label, dapat, harap) => {
  const ok = dapat === harap;
  if (!ok) gagal.push(`${label}: dapat "${dapat}", harap "${harap}"`);
  console.log(`  ${ok ? 'OK  ' : 'GAGAL'} ${label.padEnd(58)} -> ${dapat}`);
};

const diagnosa = (nilai) => calculateRecord(nilai).diagnosa_medis ?? '';

const labelDi = (teks, patterns) => {
  for (const p of patterns) {
    const m = String(teks).match(p);
    if (m) return m[0];
  }
  return '(tidak ada)';
};

// mcu-diagnosis tidak pernah menulis entry ber-severity 'hijau', jadi
// paru yang normal memang tidak muncul di diagnosa. '(tidak ada)' adalah
// hasil yang benar untuk kasus normal.
const POLA_PARU = [
  /Severe Obstructive Lung Disease/,
  /Mild to Moderate Obstructive Lung Disease/,
  /Restrictive Lung Disease/,
];

// ── 1. Satuan FEV1/FVC ─────────────────────────────────────
// fev1FvcAct = FEV1 aktual / FVC aktual, jadi DESIMAL. Semua rasio di
// bawah 1 dan TIDAK boleh dihitung lebih kecil dari 70.
console.log('=== 1. Satuan rasio FEV1/FVC ===');
const KASUS_PARU = [
  // [fev1Pct, fev1Fvc, label yang diharapkan; '(tidak ada)' = paru normal]
  [101.6, 1.09, '(tidak ada)'],
  [92.1, 0.83, '(tidak ada)'],
  [86.3, 0.78, '(tidak ada)'],
  [100, 0.69, 'Mild to Moderate Obstructive Lung Disease'],
  [75, 0.9, 'Mild to Moderate Obstructive Lung Disease'],
  [45, 0.6, 'Severe Obstructive Lung Disease'],
  // Kalau sumber sudah menyimpan persen, hasilnya harus sama saja.
  [92.1, 83, '(tidak ada)'],
  [100, 69, 'Mild to Moderate Obstructive Lung Disease'],
];
for (const [fev1, rasio, harap] of KASUS_PARU) {
  const d = diagnosa({ fev1_pct: fev1, fev1_fvc_act: rasio, fvc_pct: 100, td_s: '120', td_d: '80' });
  cek(`fev1=${fev1} rasio=${rasio}`, labelDi(d, POLA_PARU), harap);
}

// Regresi nyata: FEV1 di atas 100% prediksi tapi rasio decimal 1,09.
// Inilah yang membuat 1014 record salah flag sebelum diperbaiki.
const reale = diagnosa({ fev1_pct: 114.4, fev1_fvc_act: 1.0, fvc_pct: 100, td_s: '120', td_d: '80' });
cek('regresi: FEV1 114% prediksi, rasio 1,00', labelDi(reale, POLA_PARU), '(tidak ada)');

// ── 2. Urutan eGFR ──────────────────────────────────────────
// CKD harus muncul baik saat eGFR diisi manual maupun saat engine
// menghitungnya sendiri dari kreatinin + usia + jenis kelamin.
console.log('\n=== 2. eGFR dihitung sebelum diagnosa ===');
const DASAR = { kreatinin: '1.6', usia: '43', jenis_kelamin: 'Laki - Laki', td_s: '130', td_d: '90' };
const hitungSendiri = calculateRecord({ ...DASAR });
cek('eGFR kosong -> CKD Stage G3a terdeteksi', /CKD Stage G3a/.test(hitungSendiri.diagnosa_medis) ? 'ada' : 'tidak', 'ada');
const manual = calculateRecord({ ...DASAR, egfr: '54.5' });
cek('eGFR diisi manual -> CKD Stage G3a terdeteksi', /CKD Stage G3a/.test(manual.diagnosa_medis) ? 'ada' : 'tidak', 'ada');
cek('hasil diagnosa sama walau egfr auto atau manual', String(hitungSendiri.diagnosa_medis), String(manual.diagnosa_medis));

// eGFR yang benar-benar rendah harus jadi merah.
const gagalGinjal = calculateRecord({ ...DASAR, kreatinin: '24', egfr: '2.3' });
cek('eGFR 2,3 -> CKD Stage G5 (merah)', /CKD Stage G5/.test(gagalGinjal.diagnosa_medis) ? 'ada' : 'tidak', 'ada');

// ── 3. Derajat AV block ─────────────────────────────────────
console.log('\n=== 3. Derajat AV block ===');
const POLA_AV = [/First-Degree Atrioventricular Block/, /Complete Atrioventricular Block/, /Atrioventricular Block/];
const KASUS_AV = [
  ['First-Degree Atrioventricular Block', 'First-Degree Atrioventricular Block'],
  ['Sinus rhythm, first degree atrioventricular block', 'First-Degree Atrioventricular Block'],
  ['AV Block', 'Atrioventricular Block'],
  ['AV Block III', 'Complete Atrioventricular Block'],
  ['Complete Heart Block', 'Complete Atrioventricular Block'],
];
for (const [ecg, harap] of KASUS_AV) {
  const d = diagnosa({ ecg_hasil: ecg, td_s: '120', td_d: '80' });
  cek(`EKG "${ecg}"`, labelDi(d, POLA_AV), harap);
}

// Severity diuji lewat classifier langsung, bukan lewat zonasi. Zonasi
// butuh sekumpulan parameter lain yang tidak relevan di sini, sehingga
// "Belum Lengkap" bisa muncul dan menutupi severity sebenarnya.
const { classifyEcg } = loadClinicalClassification();
console.log('\n=== 3b. Severity AV block ===');
const KASUS_SEVERITAS = [
  ['First-Degree Atrioventricular Block', 'kuning'],
  ['Sinus rhythm, first degree atrioventricular block', 'kuning'],
  ['AV Block', 'merah'],
  ['AV Block III', 'merah'],
  ['Complete Heart Block', 'merah'],
  ['2:1 AV Block', 'merah'],
];
for (const [ecg, harap] of KASUS_SEVERITAS) {
  cek(`severity EKG "${ecg}"`, String(classifyEcg(ecg)?.severity ?? null), harap);
}

// ── 4. Placeholder ──────────────────────────────────────────
// Sel Excel berisi "#N/A" harus diperlakukan kosong, bukan abnormal.
// Script clean-placeholder-text.mjs yang mengosongkan selnya di database;
// di sini yang diuji adalah_engine_ tidak salah membaca bila nilai
// placeholder lolos sampai ke sana.
console.log('\n=== 4. Placeholder tidak jadi temuan ===');
for (const [kolom, nilai] of [['site', '#N/A'], ['jabatan', '#N/A'], ['site', 'null']]) {
  const d = diagnosa({ [kolom]: nilai, td_s: '120', td_d: '80' });
  const bocor = /#N\/A|\bnull\b/.test(String(d));
  cek(`${kolom}="${nilai}" tidak muncul di diagnosa`, bocor ? 'muncul' : 'bersih', 'bersih');
}

if (gagal.length > 0) {
  console.log(`\nMASIH SALAH:`);
  for (const g of gagal) console.log(`  - ${g}`);
}
console.log(`\n${gagal.length === 0 ? 'LULUS' : 'GAGAL'}: ${gagal.length} ketidakcocokan.`);
process.exit(gagal.length === 0 ? 0 : 1);