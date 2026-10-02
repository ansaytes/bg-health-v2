// Verifikasi penyisipan kolom baru pada mcu-fields.ts.
//
// Invarian yang dijaga:
//   1. URUTAN seluruh field lama tidak berubah sama sekali.
//   2. Huruf dan indeks kolom dihitung dari urutan, tanpa huruf manual.
//   3. Setiap field lama bergeser hanya sebesar jumlah field baru yang
//      disisipkan sebelum posisinya — tidak ada kolom yang saling tumpang tindih.
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { MCU_FIELDS, TOTAL_COLS } = require('../scripts/.build/mcu-calc/mcu-fields.js');

const baseline = JSON.parse(fs.readFileSync(new URL('./.mcu-field-baseline.json', import.meta.url), 'utf8'));

function columnLetter(index) {
  let result = '';
  let current = index;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

const problems = [];
const current = MCU_FIELDS.map((f) => f.id);
const known = current.filter((id) => baseline.includes(id));
const added = current.filter((id) => !baseline.includes(id));

// 1. Urutan relatif field lama harus sama persis dengan baseline.
const baselineOrder = baseline.filter((id) => known.includes(id));
if (baselineOrder.join('>') !== known.join('>')) {
  problems.push('Urutan field lama berubah');
}

// 2. Kolom harus berurutan tanpa celah dan tanpa duplikat.
MCU_FIELDS.forEach((field, position) => {
  const expectedIndex = position + 1;
  if (field.colIndex !== expectedIndex) {
    problems.push(`${field.id}: colIndex ${field.colIndex}, seharusnya ${expectedIndex}`);
  }
  if (field.col !== columnLetter(expectedIndex + 1)) {
    problems.push(`${field.id}: kolom ${field.col}, seharusnya ${columnLetter(expectedIndex + 1)}`);
  }
});

// 3. Field lama harus bergeser tepat sebesar jumlah field baru yang ada di depannya.
const positionOf = new Map(current.map((id, i) => [id, i]));
for (const id of known) {
  const insertedBefore = current.slice(0, positionOf.get(id)).filter((x) => !baseline.includes(x)).length;
  const expectedIndex = baseline.indexOf(id) + 1 + insertedBefore;
  if (positionOf.get(id) + 1 !== expectedIndex) {
    problems.push(`${id}: posisi ${positionOf.get(id) + 1}, diharapkan ${expectedIndex}`);
  }
}

// 4. Id harus unik.
const duplicates = MCU_FIELDS.map((f) => f.id).filter((id, i, all) => all.indexOf(id) !== i);
if (duplicates.length) problems.push(`id duplikat: ${[...new Set(duplicates)].join(', ')}`);

console.log(`field lama      : ${known.length}`);
console.log(`field baru      : ${added.length} (${added.join(', ')})`);
console.log(`urutan lama     : ${baselineOrder.length === known.length ? 'UTUH' : 'BERUBAH'}`);
console.log(`total kolom     : ${TOTAL_COLS} (A untuk nomor urut, ${MCU_FIELDS.length} field data)`);
console.log(`kolom terakhir  : ${MCU_FIELDS.at(-1).col}`);

console.log('\nposisi penting:');
for (const id of ['usg', 'riwayatEpilepsi', 'sdsScore', 'fvcPred', 'acr_500', 'pta', 'audInterp', 'balance', 'catatan']) {
  const f = MCU_FIELDS.find((x) => x.id === id);
  console.log(`  ${String(f?.col).padEnd(4)} ${id}${baseline.includes(id) ? '' : '   (baru)'}`);
}

if (problems.length) {
  console.error(`\n${problems.length} MASALAH:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('\nOK: urutan lama utuh, kolom berurutan, tidak ada tumpang tindih.');
