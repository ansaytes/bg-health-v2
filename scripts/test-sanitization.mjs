// Test sanitization with local CSV
import { readFileSync } from 'fs';

const GARBAGE_VALUES = new Set([
  '-', 'xxxx', 'xxxxx', '#n/a', '#value!', '0',
  'double data', 'double nik', 'nik double',
  'tgl blm tentu', 'pengajuan di email',
  'tidak perlu dinonaktifkan bpjsnya (rehire)',
  'rehire',
]);

function parseDate(val) {
  if (!val || !val.trim()) return null;
  const s = val.trim().toLowerCase();
  if (GARBAGE_VALUES.has(s)) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m4 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m4) return `${m4[3]}-${m4[2].padStart(2,'0')}-${m4[1].padStart(2,'0')}`;
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m2) {
    const y = parseInt(m2[3], 10);
    const fullYear = y >= 0 && y <= 30 ? `20${m2[3]}` : `19${m2[3]}`;
    return `${fullYear}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}`;
  }
  return null;
}

function parseCSV(text) {
  const rows = []; let row = []; let field = ''; let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') { if (text[i+1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(field.trim()); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        row.push(field.trim()); field = '';
        if (row.length > 1 || (row.length === 1 && row[0] !== '')) rows.push(row);
        row = [];
        if (ch === '\r' && text[i+1] === '\n') i++;
      } else field += ch;
    }
  }
  row.push(field.trim());
  if (row.length > 1 || (row.length === 1 && row[0] !== '')) rows.push(row);
  return rows;
}

const COLUMN_MAP = {
  0:'nik', 1:'nama', 2:'gender', 3:'department', 4:'division',
  6:'level_golongan', 7:'job_position', 8:'tanggal_pkwt', 9:'masa_kerja',
  10:'employee_status', 11:'employment_status', 12:'tanggal_resign',
  13:'national_id', 14:'phone_number', 15:'place_of_birth',
  16:'birth_date', 17:'age', 18:'last_education', 19:'place_of_hire',
  20:'site_name', 21:'address', 22:'religion', 23:'grading',
  24:'marital_status', 25:'child', 26:'specification_job',
  27:'area', 28:'spesification',
};
const DATE_COLS = new Set(['tanggal_pkwt','tanggal_resign','birth_date']);

function mapRow(row) {
  const emp = {};
  for (const [ci, dbCol] of Object.entries(COLUMN_MAP)) {
    const val = row[Number(ci)] || '';
    if (DATE_COLS.has(dbCol)) { emp[dbCol] = parseDate(val); }
    else if (dbCol === 'age') {
      const n = parseInt(val, 10);
      emp[dbCol] = isNaN(n) || n < 0 || n > 150 ? null : n;
    }
    else if (dbCol === 'nik') {
      const s = val.trim();
      if (!s || s === 'xxx' || s.startsWith('-') || !/^[A-Za-z0-9]+$/.test(s)) return null;
      emp[dbCol] = s;
    }
    else { emp[dbCol] = val || null; }
  }
  return emp;
}

const csvText = readFileSync('/home/z/my-project/upload/spreadsheet.csv', 'utf-8');
const rows = parseCSV(csvText);
const allEmp = rows.slice(1).map(mapRow);
const valid = allEmp.filter(e => e !== null);
const skipped = allEmp.length - valid.length;

console.log(`Total rows: ${rows.length - 1}`);
console.log(`Valid employees: ${valid.length}`);
console.log(`Skipped (invalid NIK/garbage): ${skipped}`);

// Check if any bad date values remain
let badDates = 0;
for (const emp of valid) {
  for (const col of DATE_COLS) {
    if (emp[col] !== null && typeof emp[col] === 'string') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(emp[col])) {
        badDates++;
        console.log(`  Bad date in ${col}: "${emp[col]}" (NIK: ${emp.nik})`);
      }
    }
  }
}
console.log(`Bad dates remaining: ${badDates}`);

// Show skipped rows
const header = rows[0];
let skipCount = 0;
for (let i = 0; i < rows.length - 1; i++) {
  if (allEmp[i] === null) {
    skipCount++;
    if (skipCount <= 10) {
      console.log(`\nSkipped row ${i+2} (NIK: "${rows[i+1][0]}"): ${rows[i+1][1] || '(no name)'}`);
    }
  }
}
if (skipCount > 10) console.log(`... and ${skipCount - 10} more skipped rows`);

console.log(`\nExpected result: upserted ~${valid.length}, skipped ~${skipped}, errors 0`);
