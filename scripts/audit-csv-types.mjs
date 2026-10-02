// Cari nilai CSV yang tidak bisa di-cast ke tipe kolom DB (SQLSTATE 22P02)
import fs from 'fs';
import dotenv from 'dotenv';
import { readCsvFile } from './lib/csv.mjs';
dotenv.config({ path: '.env.local' });

// Tipe kolom DB yang dipakai untuk validasi
const NUMERIC = /^(usia|td_s|td_d|nadi|bb|tb|bmi|lp|hb|leukosit|eritrosit|hematokrit|trombosit|mcv|mch|mchc|led|chol|tg|hdl|ldl|gdp|gd2pp|hba1c|au|ureum|kreatinin|egfr|sgot|sgpt|ggt|alp|billirubin|psa|fvc_\w+|fev1_\w+|acr_\w+|acl_\w+|fram_score)$/;
const DATE = /^tgl_(mcu|expired|fu1|fu2|fu3)$/;

// Kolom yang benar-benar dikirim ke Supabase. Generator memakai INSERT_COLS,
// yaitu ALL_COLUMNS_ORDERED tanpa id/created_at/updated_at. Membandingkan dengan
// ALL_COLUMNS_ORDERED akan melaporkan tiga kolom sistem sebagai "tidak ada di CSV"
// padahal memang sengaja dikecualikan.
const SYSTEM_COLS = ['id', 'created_at', 'updated_at'];
const splitSrc = fs.readFileSync('scripts/split-sql-and-csv.mjs', 'utf8');
const colBlock = splitSrc.match(/const ALL_COLUMNS_ORDERED = \[([\s\S]*?)\n\];/)[1];
const allDbCols = colBlock.match(/'([a-z0-9_]+)'/g).map((x) => x.replace(/'/g, ''));
const dbCols = allDbCols.filter((c) => !SYSTEM_COLS.includes(c));

const { header: hdr, rows: data } = readCsvFile('scripts/mcu-import-bulk-upload.csv');
const ci = Object.fromEntries(hdr.map((h, i) => [h, i]));

const isNumeric = (v) => v !== '' && !isNaN(Number(v.replace(',', '.').replace(/%/g, '')));
const isDateLike = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);

console.log('Kolom di CSV tapi tidak ada di DB:', hdr.filter((c) => !dbCols.includes(c)));
console.log('Kolom di DB tapi tidak ada di CSV:', dbCols.filter((c) => !hdr.includes(c)));

const problems = new Map();
for (let ri = 0; ri < data.length; ri++) {
  const rec = data[ri];
  for (const col of hdr) {
    const v = rec[ci[col]];
    if (v === undefined || v === '') continue;
    if (NUMERIC.test(col) && !isNumeric(v)) {
      if (!problems.has(col)) problems.set(col, []);
      problems.get(col).push({ row: ri + 2, v });
    } else if (DATE.test(col) && !isDateLike(v)) {
      if (!problems.has(col)) problems.set(col, []);
      problems.get(col).push({ row: ri + 2, v });
    }
  }
}

console.log(`\n${'='.repeat(80)}`);

// Kolom sistem harus TIDAK ada di CSV. Kalau muncul, nilainya yang terkirim
// akan dianggap nilai eksplisit untuk kolom uuid/timestamptz dan memicu 22P02.
console.log('=== Kolom sistem (id / created_at / updated_at) ===');
let sysIssue = 0;
for (const c of SYSTEM_COLS) {
  if (hdr.includes(c)) {
    console.log(`  ❌ ${c}: ADA di CSV — harus dihapus agar DEFAULT yang berlaku`);
    sysIssue++;
  } else {
    console.log(`  ✅ ${c}: tidak ada di CSV (DEFAULT / gen_random_uuid() berlaku)`);
  }
}

console.log(`\n${'='.repeat(80)}`);
if (sysIssue) console.log(`❌ ${sysIssue} kolom sistem masih ada di CSV`);
else console.log('✅ Tidak ada kolom sistem di CSV');
if (!problems.size) console.log('✅ Semua nilai cocok dengan tipe kolomnya');
else {
  console.log(`❌ ${problems.size} kolom punya nilai yang TIDAK bisa di-cast:`);
  for (const [col, list] of [...problems].sort((a, b) => b[1].length - a[1].length)) {
    const uniq = [...new Set(list.map((x) => x.v))].slice(0, 8);
    console.log(`\n  ${col}  (${list.length} nilai, tipe: ${NUMERIC.test(col) ? 'numeric' : 'date'})`);
    console.log(`     nilai Unique: ${JSON.stringify(uniq).slice(0, 160)}`);
    console.log(`     baris CSV  : ${list.slice(0, 8).map((x) => x.row).join(', ')}${list.length > 8 ? ' ...' : ''}`);
  }
}
process.exit(problems.size || sysIssue ? 1 : 0);