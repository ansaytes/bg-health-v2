// ============================================================
// Audit final: bandingkan EXCEL_COL_TO_DB_COL di script import
// dengan pemetaan kanon yang DITURUNKAN dari src/lib/mcu-fields.ts
// (kode aplikasi = sumber kebenaran).
//
// Aturan kanon (dari mcu-fields.ts):
//   runtime col = declared col + shiftedColumn()   (+1, kecuali B)
//   excel col   = runtime col - 1   (kolom "NIK Karyawan" hanya ada di form app, tidak di Excel)
//   db column   = snake_case(field id)
//
// Special case: nationalId declared 'B' → runtime 'B' → Excel 'B' (bukan A)
// ============================================================

import fs from 'fs';
import XLSX from 'xlsx';

const EXCEL_PATH = 'C:/Users/bagon/Downloads/Record MCU 2026.xlsx';
const wb = XLSX.read(fs.readFileSync(EXCEL_PATH), { type: 'buffer', cellDates: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets['RAW_DATA'], { header: 1, defval: null, raw: false });
const hdr = rows[0];
const data = rows.slice(1);

function colIdx(l) { let r = 0; for (const c of l) r = r * 26 + c.charCodeAt(0) - 64; return r - 1; }
function colLetter(i) {
  let s = '', t = i + 1;
  while (t > 0) { const r = (t - 1) % 26; s = String.fromCharCode(65 + r) + s; t = Math.floor((t - 1) / 26); }
  return s;
}
function shiftCol(col) {
  if (col === 'B') return col;
  let carry = 1; const chars = col.split('');
  for (let i = chars.length - 1; i >= 0 && carry; i -= 1) {
    const next = chars[i].charCodeAt(0) - 64 + carry;
    if (next > 26) { chars[i] = 'A'; carry = 1; } else { chars[i] = String.fromCharCode(64 + next); carry = 0; }
  }
  return carry ? `A${chars.join('')}` : chars.join('');
}
function toSnake(id) { return id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase(); }

// ---- Parse mcu-fields.ts ----
const ts = fs.readFileSync('src/lib/mcu-fields.ts', 'utf8');
const defs = [];
let m;
const re1 = /f\(\s*'([A-Za-z0-9_]+)'\s*,\s*'([A-Z]{1,2})'\s*,\s*'((?:[^'\\]|\\.)*)'\s*,\s*'[a-zA-Z]+'([\s\S]*?)\)/g;
while ((m = re1.exec(ts)) !== null) {
  const args = m[4];
  // preserveColumn = argumen boolean terakhir yang nilainya true
  const preserve = /,\s*true\s*$/.test(args.trim()) || /\btextNA:\s*false\b/.test(args) === false && /,\s*true\s*$/.test(args.trim());
  defs.push({ id: m[1], declared: m[2], label: m[3].replace(/\\'/g, "'"), preserve });
}
const re2 = /\[\s*'([A-Za-z0-9_]+)'\s*,\s*'([A-Z]{1,2})'\s*,\s*'((?:[^'\\]|\\.)*)'\s*\]/g;
while ((m = re2.exec(ts)) !== null) defs.push({ id: m[1], declared: m[2], label: m[3].replace(/\\'/g, "'"), preserve: false });

// ---- Kanon: excel letter → db column ----
const canon = new Map();
for (const d of defs) {
  const runtime = d.preserve ? d.declared : shiftCol(d.declared);
  const excelIdx = d.id === 'nationalId' ? colIdx('B') : colIdx(runtime) - 1;
  canon.set(colLetter(excelIdx), { db: toSnake(d.id), label: d.label, id: d.id });
}

// ---- Parse mapping script ----
function parseScriptMapping(file) {
  const src = fs.readFileSync(file, 'utf8');
  const block = src.match(/EXCEL_COL_TO_DB_COL = \{([\s\S]*?)\n\};/);
  if (!block) return null;
  const out = new Map();
  for (const mm of block[1].matchAll(/([A-Z]{1,2})\s*:\s*'([A-Za-z0-9_]+)'/g)) out.set(mm[1], mm[2]);
  return out;
}

// ---- filled count ----
const filled = {};
for (const r of data) for (let i = 0; i < hdr.length; i++) {
  const v = r[i]; if (v != null && String(v).trim() !== '') filled[i] = (filled[i] || 0) + 1;
}
const hdrAt = i => String(hdr[i] ?? '').replace(/\n/g, ' ').trim();

const SUBGROUP = new Set([
  'acr_500','acr_1k','acr_2k','acr_3k','acr_4k','acr_6k','acr_8k',
  'acl_500','acl_1k','acl_2k','acl_3k','acl_4k','acl_6k','acl_8k',
  'fvc_pred','fvc_act','fvc_pct','fev1_pred','fev1_act','fev1_pct',
  'fev1_fvc_pred','fev1_fvc_act','fev1_fvc_pct',
  'drug_amp','drug_meth','drug_morph','drug_canna','drug_coc','drug_benz','drug_caris',
  'fram_prob','fram_kat',
]);

console.log('KOLOM CANON dari mcu-fields.ts (excel → db):', canon.size, 'field');
console.log('Total kolom Excel:', hdr.length, '\n');

for (const file of ['scripts/import-mcu-excel.mjs', 'scripts/split-sql-and-csv.mjs', 'scripts/verify-mapping.mjs']) {
  const sm = parseScriptMapping(file);
  if (!sm) { console.log(`\n### ${file}: mapping tidak ditemukan`); continue; }
  console.log(`\n${'='.repeat(90)}\n### ${file}  (${sm.size} kolom dipetakan)\n${'='.repeat(90)}`);

  const wrong = [];
  for (const [letter, db] of sm) {
    const c = canon.get(letter);
    if (!c) { wrong.push({ letter, db, reason: 'kolom Excel ini tidak dipetakan di mcu-fields.ts' }); continue; }
    if (c.db !== db) wrong.push({ letter, db, should: c.db, label: c.label });
  }
  // kolom canon yang tak dipetakan script
  const missing = [];
  for (const [letter, c] of canon) {
    if (letter === 'C') continue; // nikKaryawan = fallback dari national_id
    if (!sm.has(letter)) missing.push({ letter, db: c.db, label: c.label, filled: filled[colIdx(letter)] || 0 });
  }

  console.log(`\n-- SALAH (${wrong.length}) --`);
  for (const w of wrong) {
    console.log(`  ${w.letter.padEnd(3)} script="${w.db}"${w.should ? `  Seharusnya="${w.should}" (${w.label})` : `  ${w.reason}`}`);
  }
  console.log(`\n-- HILANG / tidak dipetakan (${missing.length}) --`);
  for (const ms of missing) {
    console.log(`  ${ms.letter.padEnd(3)} db="${ms.db}" filled=${String(ms.filled).padStart(5)} header="${hdrAt(colIdx(ms.letter)).slice(0, 38)}"`);
  }
}