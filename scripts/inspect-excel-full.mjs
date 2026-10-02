// Script untuk inspect struktur kolom Excel secara lengkap
import XLSX from 'xlsx';
import fs from 'fs';

const EXCEL_PATH = 'C:/Users/bagon/Downloads/Record MCU 2026.xlsx';

console.log('🔍 Membaca file Excel:', EXCEL_PATH);
const workbook = XLSX.read(fs.readFileSync(EXCEL_PATH), { type: 'buffer', cellDates: true });
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

// Ambil header row
const headerRow = rows[headerIdx];
console.log('\n' + '='.repeat(120));
console.log('STRUKTUR KOLOM EXCEL LENGKAP (Header Row)');
console.log('='.repeat(120));

// Generate mapping kolom letter ke nama header
const colMapping = {};

for (let i = 0; i < headerRow.length; i++) {
  let letter = '';
  let temp = i;
  while (temp >= 0) {
    letter = String.fromCharCode(65 + (temp % 26)) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  const headerName = String(headerRow[i] ?? '').trim();
  colMapping[letter] = headerName;
  console.log(`${letter.padEnd(4)} [${String(i).padStart(3)}] : ${headerName}`);
}

console.log('\n' + '='.repeat(120));
console.log('MAPPING YANG BENAR UNTUK FOLLOW UP');
console.log('='.repeat(120));

const fuMapping = {
  'DH': 'Diagnosa Medis',
  'DI': 'Perlu Follow Up?',
  'DJ': 'Rekomendasi Follow Up',
  'DK': 'Item Follow Up',
  'DL': 'Link File MCU',
  'DM': 'Tanggal Expired MCU',
  'DN': 'Framingham Score',
  'DO': 'Framingham Probability',
  'DP': 'Framingham Category',
  'DQ': 'Zonasi',
  'DR': 'Trigger Zona Resiko Kesehatan',
  'DS': 'Pengendalian',
  'DT': 'Tanggal Follow Up I',
  'DU': 'Lokasi Follow Up I',
  'DV': 'Hasil Follow Up I',
  'DW': 'Kesimpulan Setelah Follow Up I',
  'DX': 'Link File Hasil Follow Up I',
  'DY': 'Rekomendasi FU II',
  'DZ': 'Tanggal Follow Up II',
  'EA': 'Lokasi Follow Up II',
  'EB': 'Hasil Follow Up II',
  'EC': 'Kesimpulan Setelah Follow Up II',
  'ED': 'Link File Hasil Follow Up II',
  'EE': 'Rekomendasi FU III',
  'EF': 'Tanggal Follow Up III',
  'EG': 'Lokasi Follow Up III',
  'EH': 'Hasil Follow Up III',
  'EI': 'Kesimpulan Setelah Follow Up III',
  'EJ': 'Link File Hasil Follow Up III',
  'EK': 'Rekomendasi FU IV',
  'EL': 'Catatan & Rekomendasi',
};

for (const [letter, expected] of Object.entries(fuMapping)) {
  const actual = colMapping[letter] || '(KOSONG)';
  const match = actual === expected ? '✅' : '❌';
  console.log(`${match} ${letter.padEnd(4)} : Expected="${expected}" | Actual="${actual}"`);
}
