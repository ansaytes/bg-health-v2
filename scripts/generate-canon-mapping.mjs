// ============================================================
// Generator:EXCEL_COL_TO_DB_COL kanon, diturunkan dari src/lib/mcu-fields.ts
//
// Aturan (dari mcu-fields.ts):
//   runtime col = shiftedColumn(declared)  →  +1 untuk semua kolom kecuali B
//   excel col   = runtime col - 1           →  kolom "NIK Karyawan" hanya ada di form app
//   db column= snake_case(field id)
//   nationalId declared 'B' → excel 'B' (bukan 'A')
//
// Jalankan: node scripts/generate-canon-mapping.mjs
// Output : mapping kanon + laporan verifikasi vs header Excel
// ============================================================

import fs from 'fs';
import XLSX from 'xlsx';

const EXCEL_PATH = 'C:/Users/bagon/Downloads/Record MCU 2026.xlsx';

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

const ts = fs.readFileSync('src/lib/mcu-fields.ts', 'utf8');
const defs = [];
let m;
const re1 = /f\(\s*'([A-Za-z0-9_]+)'\s*,\s*'([A-Z]{1,2})'\s*,\s*'((?:[^'\\]|\\.)*)'\s*,\s*'[a-zA-Z]+'([\s\S]*?)\)/g;
while ((m = re1.exec(ts)) !== null) {
  const args = m[4].trim();
  const preserve = /,\s*true\s*$/.test(args);
  defs.push({ id: m[1], declared: m[2], label: m[3].replace(/\\'/g, "'"), preserve });
}
const re2 = /\[\s*'([A-Za-z0-9_]+)'\s*,\s*'([A-Z]{1,2})'\s*,\s*'((?:[^'\\]|\\.)*)'\s*\]/g;
while ((m = re2.exec(ts)) !== null) defs.push({ id: m[1], declared: m[2], label: m[3].replace(/\\'/g, "'"), preserve: false });

// ---- Kanon ----
const canon = new Map(); // excelLetter → { db, label }
for (const d of defs) {
  if (d.id === 'nikKaryawan') continue; // tidak ada di Excel; fallback dari national_id
  const runtime = d.preserve ? d.declared : shiftCol(d.declared);
  const excelIdx = d.id === 'nationalId' ? colIdx('B') : colIdx(runtime) - 1;
  canon.set(colLetter(excelIdx), { db: toSnake(d.id), label: d.label, id: d.id });
}

// ---- Verifikasi vs header Excel ----
const wb = XLSX.read(fs.readFileSync(EXCEL_PATH), { type: 'buffer', cellDates: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets.RAW_DATA, { header: 1, defval: null, raw: false });
const hdr = rows[0];
const data = rows.slice(1);
const filled = {};
for (const r of data) for (let i = 0; i < hdr.length; i++) {
  const v = r[i]; if (v != null && String(v).trim() !== '') filled[i] = (filled[i] || 0) + 1;
}

const SUBGROUP = new Set([
  'acr_500','acr_1k','acr_2k','acr_3k','acr_4k','acr_6k','acr_8k',
  'acl_500','acl_1k','acl_2k','acl_3k','acl_4k','acl_6k','acl_8k',
  'fvc_pred','fvc_act','fvc_pct','fev1_pred','fev1_act','fev1_pct',
  'fev1_fvc_pred','fev1_fvc_act','fev1_fvc_pct',
  'drug_amp','drug_meth','drug_morph','drug_canna','drug_coc','drug_benz','drug_caris',
  'fram_prob','fram_kat',
]);

console.log('='.repeat(96));
console.log('VERIFIKASI KOLOM CANON vs HEADER EXCEL');
console.log('='.repeat(96));

let mismatch = 0;
for (const [letter, c] of [...canon].sort((a, b) => colIdx(a[0]) - colIdx(b[0]))) {
  const idx = colIdx(letter);
  const h = String(hdr[idx] ?? '').replace(/\n/g, ' ').trim();
  const n = filled[idx] || 0;
  let ok = true;
  if (!SUBGROUP.has(c.id)) {
    const key = c.label.split(/[(<]/)[0].trim().toLowerCase().slice(0, 9);
    ok = h.toLowerCase().includes(key) || (c.id === 'nationalId' && h.toLowerCase().includes('nik'));
  }
  if (!ok) { mismatch++; console.log(`❌ ${letter.padEnd(3)} ${c.db.padEnd(18)} header="${h.slice(0, 40)}" filled=${n}`); }
}
console.log(mismatch === 0
  ? `✅ Semua ${canon.size} kolom canon cocok dengan header Excel`
  : `\n${mismatch} kolom tidak cocok`);

const appCols = new Set(canon.keys());
const unmapped = [];
for (let i = 1; i < hdr.length; i++) {
  if (!appCols.has(colLetter(i)) && (filled[i] || 0) > 0) {
    unmapped.push(`${colLetter(i)} filled=${filled[i]} "${String(hdr[i] ?? '').replace(/\n/g, ' ').trim().slice(0, 40)}"`);
  }
}
console.log(unmapped.length ? `\nKolom Excel terisi tapi TIDAK dipetakan:\n  ${unmapped.join('\n  ')}` : '\n✅ Semua kolom Excel terisi sudah terpetakan');

// ---- Emit mapping JS ----
const lines = [...canon].sort((a, b) => colIdx(a[0]) - colIdx(b[0]))
  .map(([letter, c]) => `  ${letter}: '${c.db}',`);
const out = `// ============================================================
// EXCEL_COL_TO_DB_COL — DITURUNKAN OTOMATIS dari src/lib/mcu-fields.ts
// Sumber kebenaran: kode aplikasi (bukan ketik manual).
// Jalankan ulang: node scripts/generate-canon-mapping.mjs
//
// verify: ${new Date().toISOString().slice(0, 10)} — ${canon.size} kolom, ${mismatch} mismatch
// ============================================================
const EXCEL_COL_TO_DB_COL = {
${lines.join('\n')}
};
`;

fs.writeFileSync('scripts/mcu-excel-mapping.generated.js', out, 'utf8');
console.log(`\n✔ scripts/mcu-excel-mapping.generated.js (${canon.size} kolom)`);