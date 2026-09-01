// Debug script: analyze CSV to find rows causing sync errors

import { readFileSync } from 'fs';

const csvText = readFileSync('/home/z/my-project/upload/spreadsheet.csv', 'utf-8');

// Same parser as sync script
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field.trim()); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        row.push(field.trim()); field = '';
        if (row.length > 1 || (row.length === 1 && row[0] !== '')) rows.push(row);
        row = [];
        if (ch === '\r' && text[i + 1] === '\n') i++;
      } else { field += ch; }
    }
  }
  row.push(field.trim());
  if (row.length > 1 || (row.length === 1 && row[0] !== '')) rows.push(row);
  return rows;
}

const rows = parseCSV(csvText);
const header = rows[0];
const dataRows = rows.slice(1);

console.log(`Total rows: ${dataRows.length}`);
console.log(`Header columns: ${header.length}`);
console.log(`Header: ${header.join(' | ')}`);
console.log('');

// Issue 1: Rows with empty/missing NIK
const emptyNik = [];
const duplicateNiks = {};
const nikCount = {};

for (let i = 0; i < dataRows.length; i++) {
  const row = dataRows[i];
  const nik = (row[0] || '').trim();
  
  if (!nik) {
    emptyNik.push({ rowNum: i + 2, row: row.slice(0, 5) });
  }
  
  if (nik) {
    nikCount[nik] = (nikCount[nik] || 0) + 1;
    if (nikCount[nik] > 1) {
      if (!duplicateNiks[nik]) duplicateNiks[nik] = [];
      duplicateNiks[nik].push(i + 2);
    }
  }
}

console.log(`=== EMPTY NIK: ${emptyNik.length} rows ===`);
for (const r of emptyNik.slice(0, 10)) {
  console.log(`  Row ${r.rowNum}: ${JSON.stringify(r.row)}`);
}
if (emptyNik.length > 10) console.log(`  ... and ${emptyNik.length - 10} more`);

console.log(`\n=== DUPLICATE NIK: ${Object.keys(duplicateNiks).length} unique NIKs ===`);
for (const [nik, rowNums] of Object.entries(duplicateNiks).slice(0, 10)) {
  console.log(`  NIK ${nik}: appears at rows ${rowNums.join(', ')}`);
}

// Issue 2: Column count mismatch (should be 29)
const colMismatch = [];
for (let i = 0; i < dataRows.length; i++) {
  if (dataRows[i].length !== 29) {
    colMismatch.push({ rowNum: i + 2, cols: dataRows[i].length, row: dataRows[i].slice(0, 5) });
  }
}
console.log(`\n=== COLUMN COUNT MISMATCH (expected 29): ${colMismatch.length} rows ===`);
for (const r of colMismatch.slice(0, 10)) {
  console.log(`  Row ${r.rowNum}: has ${r.cols} cols - ${JSON.stringify(r.row)}`);
}
if (colMismatch.length > 10) console.log(`  ... and ${colMismatch.length - 10} more`);

// Issue 3: Very long field values (> 255 chars)
const longFields = [];
for (let i = 0; i < dataRows.length; i++) {
  const row = dataRows[i];
  for (let j = 0; j < row.length; j++) {
    if (row[j] && row[j].length > 255) {
      longFields.push({ rowNum: i + 2, colIdx: j, colName: header[j] || `col_${j}`, len: row[j].length });
    }
  }
}
console.log(`\n=== FIELDS > 255 CHARS: ${longFields.length} ===`);
for (const f of longFields.slice(0, 10)) {
  console.log(`  Row ${f.rowNum}, col ${f.colIdx} (${f.colName}): ${f.len} chars`);
}
if (longFields.length > 10) console.log(`  ... and ${longFields.length - 10} more`);

// Issue 4: Date format issues (col 8, 12, 16)
const dateCols = [8, 12, 16];
const dateColNames = ['Tanggal PKWT', 'Tanggal Resign/PHK', 'Birth Date'];
const badDates = [];
for (let i = 0; i < dataRows.length; i++) {
  const row = dataRows[i];
  for (let d = 0; d < dateCols.length; d++) {
    const val = (row[dateCols[d]] || '').trim();
    if (val && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val) && !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      badDates.push({ rowNum: i + 2, col: dateColNames[d], val });
    }
  }
}
console.log(`\n=== BAD DATE FORMAT: ${badDates.length} ===`);
for (const d of badDates.slice(0, 10)) {
  console.log(`  Row ${d.rowNum}, ${d.col}: "${d.val}"`);
}
if (badDates.length > 10) console.log(`  ... and ${badDates.length - 10} more`);

// Issue 5: NIK with non-alphanumeric chars
const badNik = [];
for (let i = 0; i < dataRows.length; i++) {
  const nik = (dataRows[i][0] || '').trim();
  if (nik && !/^[A-Za-z0-9]+$/.test(nik)) {
    badNik.push({ rowNum: i + 2, nik });
  }
}
console.log(`\n=== NIK WITH SPECIAL CHARS: ${badNik.length} ===`);
for (const b of badNik.slice(0, 10)) {
  console.log(`  Row ${b.rowNum}: NIK="${b.nik}"`);
}

// Issue 6: Rows where col count is significantly different (might indicate parsing issues with embedded commas)
const extremeCols = dataRows.filter(r => r.length < 20 || r.length > 35);
console.log(`\n=== EXTREME COLUMN COUNT (<20 or >35): ${extremeCols.length} rows ===`);
for (const r of extremeCols.slice(0, 10)) {
  const idx = dataRows.indexOf(r) + 2;
  console.log(`  Row ${idx}: ${r.length} cols - NIK: ${r[0] || '(empty)'}, Nama: ${r[1] || '(empty)'}`);
}

// Summary
console.log('\n========================================');
console.log('SUMMARY');
console.log('========================================');
console.log(`Empty NIK:              ${emptyNik.length}`);
console.log(`Duplicate NIKs:         ${Object.keys(duplicateNiks).length} NIKs`);
console.log(`Column count mismatch:  ${colMismatch.length}`);
console.log(`Fields > 255 chars:     ${longFields.length}`);
console.log(`Bad date format:        ${badDates.length}`);
console.log(`NIK with special chars: ${badNik.length}`);
console.log(`Extreme col count:      ${extremeCols.length}`);
console.log(`Expected errors total:  ${emptyNik.length + colMismatch.length + badDates.length + badNik.length + extremeCols.length}`);
