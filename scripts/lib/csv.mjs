// Parser CSV tunggal untuk seluruh pipeline import MCU.
//
// Sebelumnya setiap script punya salinan parseCsv sendiri, dan salinan di
// verify-calculated-columns.mjs punya filter baris berbeda sehingga menghitung
// jumlah baris berbeda dari script import. Satu implementasi ini dipakai semua.

import { readFileSync } from 'fs';

/**
 * Parser CSV RFC 4180: kutip ganda, escape `""`, dan baris baru di dalam sel.
 * Baris yang benar-benar kosong dilewati.
 *
 * @param {string} text isi file CSV
 * @returns {string[][]} baris berisi selsel yang sudah di-unescape
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }

  return rows.filter((r) => r.length > 1 || r[0] !== '');
}

/**
 * Membaca file CSV dan mengembalikan header serta baris data.
 *
 * @param {string} filePath path file CSV
 * @returns {{ header: string[], rows: string[][] }}
 */
export function readCsvFile(filePath) {
  const all = parseCsv(readFileSync(filePath, 'utf8'));
  return { header: all[0] ?? [], rows: all.slice(1) };
}
