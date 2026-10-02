// ============================================================
// Verifikasi output: cocokkan nilai CSV terhadap baris Excel asli
// dengan mencocokkan national_id_hash (HMAC ENCRYPTION_KEY yang sama).
// ============================================================

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import crypto from 'crypto';
import XLSX from 'xlsx';
import { parseExcelDate } from './lib/excel-date.mjs';

dotenv.config({ path: '.env.local' });

const EXCEL_PATH = 'C:/Users/bagon/Downloads/Record MCU 2026.xlsx';
const CSV_PATH = 'scripts/mcu-import-bulk-upload.csv';

const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
function hashField(plain) {
  return crypto.createHmac('sha256', key).update(String(plain), 'utf8').digest('hex');
}

// --- Excel ---
const wb = XLSX.read(fs.readFileSync(EXCEL_PATH), { type: 'buffer', cellDates: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets.RAW_DATA, { header: 1, defval: null, raw: false });
const excelRows = rows.slice(1);

// --- CSV ---
function parseCsv(text) {
  const out = []; let f = '', rec = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { rec.push(f); f = ''; }
    else if (c === '\n') { rec.push(f); out.push(rec); rec = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || rec.length) { rec.push(f); out.push(rec); }
  return out;
}
const csv = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
const hdr = csv[0];
const data = csv.slice(1);
const ci = Object.fromEntries(hdr.map((h, i) => [h, i]));

console.log(`CSV: ${data.length} baris, ${hdr.length} kolom`);

// --- index Excel by NIK hash (SEMUA baris, karena NIK bisa duplikat) ---
const byHash = new Map();
for (const r of excelRows) {
  const nik = String(r[1] ?? '').trim();
  if (!nik) continue;
  const k = hashField(nik);
  if (!byHash.has(k)) byHash.set(k, []);
  byHash.get(k).push(r);
}
const dupCount = [...byHash.values()].filter((v) => v.length > 1).length;
console.log(`\nNIK duplikat di Excel: ${dupCount} NIK dengan >1 baris`);

// --- Mapping Excel letter → CSV column, dari generator kanon ---
const gen = fs.readFileSync('scripts/mcu-excel-mapping.generated.js', 'utf8');
const mapBlock = gen.match(/EXCEL_COL_TO_DB_COL = \{([\s\S]*?)\n\};/)[1];
const MAP = {};
for (const m of mapBlock.matchAll(/([A-Z]{1,2}):\s*'([a-z0-9_]+)'/g)) MAP[m[1]] = m[2];

function colIdx(l) { let r = 0; for (const c of l) r = r * 26 + c.charCodeAt(0) - 64; return r - 1; }

// --- Cek semua kolom tekstual, dengan pengecualian transformasi yang diharapkan ---
const NUMERIC_RE = /^(usia|td_s|td_d|nadi|bb|tb|bmi|lp|hb|leukosit|eritrosit|hematokrit|trombosit|mcv|mch|mchc|led|chol|tg|hdl|ldl|gdp|gd2pp|hba1c|au|ureum|kreatinin|egfr|sgot|sgpt|ggt|alp|billirubin|psa|fvc_\w+|fev1_\w+|acr_\w+|acl_\w+|fram_score|fram_prob|fram_kat)$/;
// kolom terenkripsi (nilai di CSV tidak bisa dibandingkan langsung)
const ENCRYPTED = new Set(['national_id', 'nik_karyawan', 'nama', 'link_mcu']);
// kolom yang nilainya di-overwrite oleh autoCalc di server/app
const AUTOCALC = new Set(['bmi','mchc','mcv','mch','fvc_pct','fev1_pct','fev1_fvc_act','fev1_fvc_pct','diabetes','tgl_expired','fram_prob','fram_kat','zonasi','trigger_zona','pengendalian','diagnosa_medis','item_fu']);
const EMPTY_LIKE = new Set(['N/A','n/a','NA','N.a','-','--','---','/','TIDAK ADA','Tidak Ada','tidak ada','.','_']);
// normalisasi yang dilakukan script: nilai kosong → NULL → string kosong di CSV
const isBlankish = (s) => s === '' || EMPTY_LIKE.has(s) || /^[.\s/_-]+$/.test(s);

function numEq(a, b) {
  const s = (x) => String(x).replace(',', '.').replace(/%/g, '').trim();
  const x = parseFloat(s(a)), y = parseFloat(s(b));
  return !isNaN(x) && !isNaN(y) && Math.abs(x - y) < 0.051;
}
function dateEq(a, b) {
  const x = parseExcelDate(a);
  const y = parseExcelDate(b);
  return x !== null && y !== null && x === y;
}

const TEXTUAL = Object.entries(MAP)
  .filter(([l, db]) => !NUMERIC_RE.test(db))
  .filter(([l, db]) => !ENCRYPTED.has(db))
  .filter(([l, db]) => !AUTOCALC.has(db));

let checked = 0, mismatch = 0, matched = 0, ambiguous = 0;
const problems = new Map();

for (let ri = 0; ri < data.length; ri++) {
  const rec = data[ri];
  const hh = rec[ci.national_id_hash];
  if (!hh) continue;
  const cands = byHash.get(hh);
  if (!cands || !cands.length) continue;

  // Kumpulkan semua field dari semua baris Excel dengan NIK sama
  const collect = (letter) => cands.map((xr) => {
    const v = xr[colIdx(letter)];
    if (v == null) return '';
    const s = String(v).trim().replace(/\s+/g, ' ');
    return isBlankish(s) ? '' : s;   // "N/A" dst dianggap kosong (sudah dinormalkan)
  });
  let best = null;
  for (const c of cands) {
    let score = 0;
    for (const [letter, db] of TEXTUAL) {
      if (ci[db] === undefined) continue;
      const xv = c[colIdx(letter)];
      if (xv == null || isBlankish(String(xv).trim())) continue;
      if (String(xv).trim().replace(/\s+/g, ' ') === rec[ci[db]].replace(/\s+/g, ' ')) score++;
    }
    if (!best || score > best.score) best = { c, score };
  }
  const xr = best.c;
  matched++;
  if (cands.length > 1) ambiguous++;

  for (const [letter, db] of TEXTUAL) {
    if (ci[db] === undefined) continue;
    const xs = collect(letter);
    if (!xs.some((s) => s !== '')) continue;      // semua kandidat kosong
    const cv = rec[ci[db]];
    const isDate = db.startsWith('tgl_');
    const same = xs.some((s) => isDate ? dateEq(s, cv) : s === cv.replace(/\s+/g, ' '));
    if (same) { checked++; continue; }
    mismatch++;
    if (!problems.has(db)) problems.set(db, { n: 0, sample: null });
    const p = problems.get(db);
    p.n++;
    if (!p.sample) p.sample = { excel: xs.filter(Boolean).join(' || ').slice(0, 70), csv: cv.slice(0, 70), letter };
  }
}

console.log(`\nBaris CSV: ${data.length} | ter-petakan ke Excel: ${matched} | NIK ambigu: ${ambiguous}`);
console.log(`Cek kolom non-terenkripsi/non-autoCalc: ${checked} nilai | COCOK: ${checked - mismatch} | SALAH: ${mismatch}`);

if (mismatch === 0) {
  console.log('\n✅ SEMUA nilai tekstual CSV identik dengan baris Excel aslinya.');
} else {
  console.log(`\n❌ ${problems.size} kolom bermasalah:\n`);
  for (const [db, p] of [...problems].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`  ${db.padEnd(20)} salah=${String(p.n).padStart(4)}  (excel ${p.sample.letter})`);
    console.log(`      excel: "${p.sample.excel}"`);
    console.log(`      csv  : "${p.sample.csv}"`);
  }
}

// --- Fokus: kolom FU & diagnosa ---
console.log('\n=== SPOT CHECK kolom kunci (FU1) ===');
const FOCUS = ['diagnosa_medis', 'perlu_fu', 'tgl_fu1', 'lokasi_fu1', 'hasil_fu1', 'kesimpulan_fu1'];
let shown = 0;
for (const rec of data) {
  if (shown >= 3) break;
  const xr = byHash.get(rec[ci.national_id_hash]);
  if (!xr) continue;
  const hasFu = String(xr[124] ?? '').trim() !== '' || String(xr[123] ?? '').trim() !== '';
  if (!hasFu) continue;
  shown++;
  console.log(`\nBaris Excel dengan FU1:`);
  for (const db of FOCUS) {
    const letter = Object.keys(MAP).find((l) => MAP[l] === db);
    const xv = xr[colIdx(letter)];
    const cv = rec[ci[db]];
    const same = String(xv ?? '').trim() === String(cv ?? '').trim();
    console.log(`  ${same ? '✅' : '❌'} ${db.padEnd(16)} excel=${JSON.stringify(String(xv ?? '')).slice(0, 55)}`);
    console.log(`     ${''.padEnd(16)} csv  =${JSON.stringify(String(cv ?? '')).slice(0, 55)}`);
  }
}