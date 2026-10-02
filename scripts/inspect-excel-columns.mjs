// Script untuk inspect struktur kolom Excel Record MCU 2026.xlsx
import XLSX from 'xlsx';
import fs from 'fs';

const EXCEL_PATH = 'C:/Users/bagon/Downloads/Record MCU 2026.xlsx';

console.log('🔍 Membaca file Excel:', EXCEL_PATH);
const workbook = XLSX.read(fs.readFileSync(EXCEL_PATH), { type: 'buffer', cellDates: true });
console.log('📋 Sheet names:', workbook.SheetNames);

const sheetName = workbook.SheetNames.find(n => /raw/i.test(n) && /data/i.test(n)) || workbook.SheetNames[0];
console.log('📋 Sheet yang dipakai:', sheetName);

const ws = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });

// Cari header row
let headerIdx = 0;
for (let i = 0; i < Math.min(10, rows.length); i++) {
  const b = String(rows[i][1] ?? '').trim().toLowerCase();
  const c = String(rows[i][2] ?? '').trim().toLowerCase();
  if (b.includes('nik') || c.includes('nama')) { headerIdx = i; break; }
}

console.log('🧾 Header row index:', headerIdx);
console.log('🧾 Total baris data:', rows.length - headerIdx - 1);

// Ambil header row
const headerRow = rows[headerIdx];
console.log('\n' + '='.repeat(100));
console.log('STRUKTUR KOLOM EXCEL (Header Row)');
console.log('='.repeat(100));

// Generate mapping kolom letter ke nama header
const colLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const colMapping = {};

for (let i = 0; i < headerRow.length; i++) {
  let letter = '';
  let temp = i;
  while (temp >= 0) {
    letter = String.fromCharCode(65 + (temp % 26)) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  const headerName = String(headerRow[i] ?? '').trim();
  if (headerName) {
    colMapping[letter] = headerName;
    console.log(`${letter.padEnd(4)} [${String(i).padStart(3)}] : ${headerName}`);
  }
}

console.log('\n' + '='.repeat(100));
console.log('MAPPING KOLOM PENTING (FU1, DIAGNOSA, dll)');
console.log('='.repeat(100));

// Cari kolom yang penting
const keywords = ['diagnosa', 'fu1', 'follow up', 'hasil', 'kesimpulan', 'tgl', 'lokasi'];
for (const [letter, header] of Object.entries(colMapping)) {
  const lowerHeader = header.toLowerCase();
  for (const kw of keywords) {
    if (lowerHeader.includes(kw)) {
      console.log(`${letter.padEnd(4)} : ${header}`);
      break;
    }
  }
}
