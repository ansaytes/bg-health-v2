import { readFileSync } from 'fs';

const csvText = readFileSync('/home/z/my-project/upload/spreadsheet.csv', 'utf-8');

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

// 1. Show all "DOUBLE DATA" rows - full content
console.log('=== ROWS WITH "DOUBLE DATA" ===');
let doubleDataCount = 0;
for (let i = 0; i < dataRows.length; i++) {
  const row = dataRows[i];
  if (row.some(c => c === 'DOUBLE DATA')) {
    doubleDataCount++;
    if (doubleDataCount <= 3) {
      console.log(`\nRow ${i + 2} (NIK: ${row[0]}):`);
      for (let j = 0; j < header.length; j++) {
        if (row[j]) console.log(`  [${j}] ${header[j]}: ${row[j]}`);
      }
    }
  }
}
console.log(`\nTotal DOUBLE DATA rows: ${doubleDataCount}`);

// 2. Show negative NIK rows
console.log('\n=== NEGATIVE NIK ROWS ===');
for (let i = 0; i < dataRows.length; i++) {
  const nik = (dataRows[i][0] || '').trim();
  if (nik.startsWith('-')) {
    console.log(`\nRow ${i + 2}:`);
    for (let j = 0; j < header.length; j++) {
      if (dataRows[i][j]) console.log(`  [${j}] ${header[j]}: ${dataRows[i][j]}`);
    }
  }
}

// 3. Show all bad date values
console.log('\n=== ALL BAD DATE VALUES ===');
const dateCols = [8, 12, 16];
const dateColNames = ['Tanggal PKWT', 'Tanggal Resign/PHK', 'Birth Date'];
const badDatesByCol = { 8: new Set(), 12: new Set(), 16: new Set() };
for (let i = 0; i < dataRows.length; i++) {
  for (let d = 0; d < dateCols.length; d++) {
    const val = (dataRows[i][dateCols[d]] || '').trim();
    if (val && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val) && !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      badDatesByCol[dateCols[d]].add(val);
    }
  }
}
for (let d = 0; d < dateCols.length; d++) {
  console.log(`\n${dateColNames[d]} (col ${dateCols[d]}):`);
  for (const v of badDatesByCol[dateCols[d]]) {
    console.log(`  "${v}"`);
  }
}

// 4. Show the duplicate "xxx" NIK rows
console.log('\n=== NIK="xxx" ROWS ===');
for (let i = 0; i < dataRows.length; i++) {
  if ((dataRows[i][0] || '').trim() === 'xxx') {
    console.log(`\nRow ${i + 2}:`);
    for (let j = 0; j < header.length; j++) {
      if (dataRows[i][j]) console.log(`  [${j}] ${header[j]}: ${dataRows[i][j]}`);
    }
  }
}

// 5. Simulate batch allocation to find which batch contains bad rows
console.log('\n=== BATCH SIMULATION (batch size 1000, sub-batch 100) ===');
let batchIdx = 0;
let subBatchErrors = 0;
let rowsInFailedSubBatches = 0;

for (let i = 0; i < dataRows.length; i += 1000) {
  batchIdx++;
  const batch = dataRows.slice(i, i + 1000);
  const startRow = i + 2;
  const endRow = i + batch.length + 1;
  
  // Check if batch has any problematic rows
  let hasDoubleData = false;
  let hasBadDate = false;
  let hasNegNik = false;
  let hasXxxNik = false;
  let badRows = [];
  
  for (let j = 0; j < batch.length; j++) {
    const row = batch[j];
    const nik = (row[0] || '').trim();
    if (row.some(c => c === 'DOUBLE DATA')) { hasDoubleData = true; badRows.push({ rowInBatch: j, globalRow: i + j + 2, reason: 'DOUBLE_DATA' }); }
    if (nik.startsWith('-')) { hasNegNik = true; badRows.push({ rowInBatch: j, globalRow: i + j + 2, reason: 'NEGATIVE_NIK' }); }
    if (nik === 'xxx') { hasXxxNik = true; badRows.push({ rowInBatch: j, globalRow: i + j + 2, reason: 'NIK_XXX' }); }
    for (const dc of dateCols) {
      const val = (row[dc] || '').trim();
      if (val && val !== '-' && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val) && !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        hasBadDate = true;
        badRows.push({ rowInBatch: j, globalRow: i + j + 2, reason: `BAD_DATE_${header[dc]}`, val });
      }
    }
  }
  
  if (badRows.length > 0) {
    console.log(`\nBatch ${batchIdx} (rows ${startRow}-${endRow}): ${badRows.length} problematic rows`);
    
    // Simulate sub-batch division
    let failedSubBatches = 0;
    const subBatchesWithBadRows = new Set();
    for (const br of badRows) {
      const subBatchIdx = Math.floor(br.rowInBatch / 100);
      subBatchesWithBadRows.add(subBatchIdx);
    }
    
    console.log(`  Sub-batches with bad rows: ${[...subBatchesWithBadRows].map(s => `#${s}`).join(', ')} (${subBatchesWithBadRows.size} sub-batches)`);
    console.log(`  If each bad sub-batch fails entirely: ~${subBatchesWithBadRows.size * 100} rows counted as errors`);
    
    for (const br of badRows.slice(0, 5)) {
      console.log(`  - Row ${br.globalRow}: ${br.reason}${br.val ? ` ("${br.val}")` : ''}`);
    }
    if (badRows.length > 5) console.log(`  - ... and ${badRows.length - 5} more`);
    
    subBatchErrors += subBatchesWithBadRows.size;
    rowsInFailedSubBatches += subBatchesWithBadRows.size * 100;
  }
}

console.log(`\n=== ESTIMATED IMPACT ===`);
console.log(`Failed sub-batches: ${subBatchErrors}`);
console.log(`Rows counted as errors (sub-batch × 100): ${rowsInFailedSubBatches}`);
console.log(`Actual reported errors: 500`);
