// ============================================================
// Verifikasi: kolom hasil kalkulasi pada CSV import harus identik
// dengan hasil rumus aplikasi (src/lib/mcu-calculations.ts),
// bukan sisa rumus spreadsheets lama.
//
// PII: nama/NIK didekripsi hanya seperlunya untukcalculateRecord dan
// tidak pernah dicetak. Record ditampilkan lewat national_id_hash.
// ============================================================

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { readCsvFile } from './lib/csv.mjs';
import { calculateRecord, CALCULATED_COLUMNS } from './lib/mcu-calc-bridge.mjs';
import { decrypt } from './lib/encryption.mjs';

const __d = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__d, '..', '.env.local'), override: false });

const CSV = path.join(__d, 'mcu-import-bulk-upload.csv');
const ENCRYPTED_FIELDS = ['national_id', 'nik_karyawan', 'nama', 'link_mcu'];

const { header, rows } = readCsvFile(CSV);
console.log(`CSV: ${rows.length} baris, ${header.length} kolom`);

const CALC = Object.keys(CALCULATED_COLUMNS);
const problems = [];
const emptyCounts = Object.fromEntries(CALC.map((c) => [c, 0]));
const filledCounts = Object.fromEntries(CALC.map((c) => [c, 0]));

for (const [index, cells] of rows.entries()) {
  const rec = {};
  header.forEach((col, i) => { rec[col] = cells[i] === '' ? null : cells[i]; });
  // Pengenal non-PII untuk pesan selisih.
  const ref = String(rec.national_id_hash ?? `baris#${index + 2}`).slice(0, 12);
  const decrypted = { ...rec };
  for (const f of ENCRYPTED_FIELDS) {
    if (decrypted[f]) decrypted[f] = decrypt(decrypted[f]) ?? decrypted[f];
  }
  const out = calculateRecord({ ...decrypted });
  for (const col of CALC) {
    const norm = (v) => (v == null || v === '' ? null : String(v).replace(/\s+/g, ' ').trim());
    const actual = norm(rec[col]);
    const expected = norm(out[col]);
    if (actual === null) emptyCounts[col] += 1;
    else filledCounts[col] += 1;
    if (actual !== expected) {
      problems.push({ ref, col, csv: actual?.slice(0, 90), app: expected?.slice(0, 90) });
    }
  }
}

console.log('\nIsi kolom kalkulasi (terisi / kosong):');
for (const col of CALC) {
  console.log(`  ${col.padEnd(16)} ${String(filledCounts[col]).padStart(5)} terisi / ${String(emptyCounts[col]).padStart(5)} kosong`);
}

console.log(`\nSelisih terhadap engine aplikasi: ${problems.length}`);
for (const p of problems.slice(0, 15)) {
  console.log(`  [${p.col}] record #${p.ref}`);
  console.log(`     csv: ${p.csv}`);
  console.log(`     app: ${p.app}`);
}
if (problems.length > 15) console.log(`  ... +${problems.length - 15} lainnya`);

// Sisa jejak rumus Excel lama: label yang tidak dikenal engine.
const LEGACY = ['Isolated Systolic Hypertension', 'Isolated Diastolic Hypertension', 'Isolated Systolic', 'Isolated Diastolic'];
const legacyHits = [];
for (const cells of rows) {
  const v = cells[header.indexOf('diagnosa_medis')];
  if (!v) continue;
  for (const l of LEGACY) if (v.includes(l)) legacyHits.push({ l, v: v.slice(0, 100) });
}
console.log(`\nSisa label rumus Excel lama di diagnosa_medis: ${legacyHits.length}`);
for (const h of legacyHits.slice(0, 8)) console.log(`  ${h.l}: ${h.v}`);

const bad = problems.length + legacyHits.length;
console.log(bad ? `\nGAGAL: ${bad} masalah.` : '\nOK: semua kolom kalkulasi identik dengan engine aplikasi.');
process.exit(bad ? 1 : 0);
