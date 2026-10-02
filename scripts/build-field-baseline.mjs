// Membangun baseline urutan field mcu-fields dari versi sebelum kolom
// baru disisipkan. Jalankan sekali dengan:
//   node scripts/build-field-baseline.mjs <ref-git>
// Default memakai HEAD.
import fs from 'fs';
import { execFileSync } from 'child_process';

const ref = process.argv[2] || 'HEAD';
const source = execFileSync('git', ['show', `${ref}:src/lib/mcu-fields.ts`], {
  encoding: 'utf8',
  maxBuffer: 1e8,
});

// Satu lintasan pemindaian supaya urutan field mengikuti urutan di file.
// Dua pola:
//   f('id', 'COL', ...)                      → field sebaris
//   ['id', 'COL', 'Label']                  → field dari array
const pattern = /f\(\s*'([A-Za-z0-9_]+)',\s*'([A-Z]{1,2})',|\['([A-Za-z0-9_]+)',\s*'([A-Z]{1,2})',\s*'([^']+)'\]/g;

const ids = [];
let match;
while ((match = pattern.exec(source)) !== null) {
  const id = match[1] ?? match[3];
  if (id && !ids.includes(id)) ids.push(id);
}

if (ids.length === 0) throw new Error('Tidak ada field yang terbaca dari ' + ref);

const target = new URL('./.mcu-field-baseline.json', import.meta.url);
fs.writeFileSync(target, `${JSON.stringify(ids, null, 0)}\n`);

console.log(`baseline ditulis dari ${ref}: ${ids.length} field`);
console.log(`pertama: ${ids.slice(0, 3).join(', ')}`);
console.log(`terakhir: ${ids.slice(-3).join(', ')}`);

// Sanasi: jumlah id harus sama dengan yang tercatat di git.
const count = /f\(\s*'[A-Za-z0-9_]+',\s*'[A-Z]{1,2}',/g;
let inline = 0;
while (count.exec(source) !== null) inline += 1;
const arr = /\['([A-Za-z0-9_]+)',\s*'([A-Z]{1,2})',\s*'([^']+)'\]/g;
let fromArray = 0;
while (arr.exec(source) !== null) fromArray += 1;
console.log(`hitung kasar: ${inline} sebaris + ${fromArray} dari array = ${inline + fromArray}`);
if (ids.length !== inline + fromArray) {
  console.error('Peringatan: jumlah tidak cocok, periksa regex.');
  process.exit(1);
}
