// Smoke test: pastikan bridge memakai engine aplikasi, bukan salinan rumus.
import { calculateRecord, CALCULATED_COLUMNS } from './lib/mcu-calc-bridge.mjs';

const sample = {
  nama: 'Uji Bridge',
  jenis_kelamin: 'Laki - Laki',
  usia: '45',
  bb: '80',
  tb: '170',
  td_s: '135',
  td_d: '85',
  hb: '17.2',
  leukosit: '12',
  eritrosit: '6.5',
  hematokrit: '56',
  trombosit: '450',
  chol: '220',
  tg: '180',
  hdl: '35',
  ldl: '130',
  gdp: '95',
  gd2pp: '150',
  hba1c: '5.9',
  au: '8.1',
  ureum: '55',
  kreatinin: '1.5',
  sgot: '45',
  sgpt: '50',
  ggt: '70',
  alp: '160',
  bilirubin: '1.5',
  psa: '5.5',
  hbsag: 'Negatif',
  vdrl: 'Non - Reaktif',
  spi_interp: 'Restriktif',
  aud_interp: 'Sensorineural Hearing Loss',
  tgl_mcu: '2026-03-15',
  egfr: '85.4',
  // nilai rumus Excel LAMA yang sengaja dibiarkan, harus ditimpa engine:
  diagnosa_medis: 'Isolated Systolic Hypertension, Polisitemia',
  item_fu: 'Dokter Umum',
  zonasi: 'Hijau',
  trigger_zona: 'Kuranghawk',
  pengendalian: 'Olahraga rutin',
  fram_prob: '5%',
  fram_kat: 'Risiko Rendah',
};

const out = calculateRecord({ ...sample });

console.log('Kolom kalkulasi yang ditulis engine:');
console.log(Object.keys(CALCULATED_COLUMNS).join(', '));
console.log('\nHasil:');
for (const key of Object.keys(CALCULATED_COLUMNS)) {
  const changed = JSON.stringify(sample[key]) !== JSON.stringify(out[key]);
  console.log(`  ${key.padEnd(16)} = ${String(out[key] ?? '(null)').slice(0, 120)}${changed ? '   [ditimpa]' : ''}`);
}

const failed = [];
if (out.bmi !== 27.7) failed.push(`bmi ${out.bmi} (harap 27.7)`);
// Terminologi hipertensi memakai "Grade" sesuai dokumen SOP STD-006 Rev001,
// bukan "Stage". Ambang SOP: Hijau <140/90, jadi 135/85 masih di bawah
// ambang itu dan dinamai Elevated Blood Pressure, bukan Hypertension.
if (!String(out.diagnosa_medis).includes('Elevated Blood Pressure')) {
  failed.push('diagnosa_medis tidak memuat Elevated Blood Pressure');
}
if (String(out.diagnosa_medis).includes('Hypertension Stage')) failed.push('diagnosa_medis masih memakai istilah Stage, harusnya Grade');
if (String(out.diagnosa_medis).includes('Isolated Systolic')) failed.push('diagnosa_medis masih memakai label rumus Excel lama');

// Grade I dimulai pada 140/90 menurut ambang SOP, bukan pada 130/80.
const gradeOne = calculateRecord({ ...sample, td_s: '150', td_d: '95' });
if (!String(gradeOne.diagnosa_medis).includes('Hypertension Grade I')) {
  failed.push(`150/95 harusnya Hypertension Grade I, dapat: ${gradeOne.diagnosa_medis}`);
}
if (!String(out.zonasi).match(/Hijau|Kuning|Merah|Belum Lengkap/)) failed.push(`zonasi tak dikenal: ${out.zonasi}`);
// egfr boleh diisi manual dari lab; engine hanya menghitung bila kosong.
if (Number(out.egfr) !== 85.4) failed.push(`egfr manual tertimpa: ${out.egfr} (harap 85.4)`);
if (out.tgl_expired !== '2027-03-15') failed.push(`tgl_expired ${out.tgl_expired} (harap 2027-03-15)`);

// egfr kosong harus dihitung otomatis dari kreatinin + usia + jenis kelamin.
const auto = calculateRecord({ ...sample, egfr: null });
if (!auto.egfr || Number(auto.egfr) < 40 || Number(auto.egfr) > 130) {
  failed.push(`egfr kosong tidak dihitung otomatis: ${auto.egfr}`);
}

console.log(failed.length ? `\nGAGAL:\n - ${failed.join('\n - ')}` : '\nOK: engine aplikasi aktif, rumus Excel lama tertimpa.');
process.exit(failed.length ? 1 : 0);
