// ============================================================================
// Inventaris hasil kuesioner yang tertanam di kolom pemeriksaan_lain
// ============================================================================
//
// Dari data CHD, hasil DASS-21 dan SRQ-20 ditulis sebagai teks di kolom
// Pemeriksaan Lain, bukan sebagai angka terpisah. Skrip ini mencari pola teks
// itu di SELURUH baris Excel dan memusatkan hasilnya, supaya:text yang punya
// angka bisa diurai jadi skor, sementara teks yang hanya "Normal" cukup
// dicatat sebagai pemeriksaan yang sudah dilakukan tapi tidak diskor.
//
// Isi kolom pemeriksaan_lain dapat berisi data kesehatan, jadi skrip ini
// tidak mencetak kolom itu apa adanya. Yang dicetak: jumlah kemunculan pola,
// baris yang cocok, dan teks yang sudah disamarkan. Teks asli tersedia di
// file Excel yang sudah dimiliki tim, jadi tidak perlu dit risked di log.
//
// Pakai:  node scripts/audit-legacy-mental-health.mjs
// ============================================================================

import fs from 'fs';
import XLSX from 'xlsx';
import { parseExcelDate } from './lib/excel-date.mjs';

const EXCEL_PATH = 'C:/Users/bagon/Downloads/Record MCU 2026.xlsx';

/** Menyamarkan teks: panjang, huruf pertama tiap kata, dan angka yang dipertahankan. */
function mask(text) {
  return String(text)
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => (word.length <= 3 ? word : `${word[0]}${'x'.repeat(Math.min(word.length - 1, 6))}`))
    .join(' ')
    .slice(0, 160);
}

const wb = XLSX.read(fs.readFileSync(EXCEL_PATH), { type: 'buffer', cellDates: true });
const sheet = wb.SheetNames.find((n) => /raw/i.test(n) && /data/i.test(n)) || wb.SheetNames[0];
const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: null, raw: false });

// Baris judul bisa tidak di baris pertama, cari seperti di split-sql-and-csv.mjs.
let headerIdx = 0;
for (let i = 0; i < Math.min(10, rows.length); i++) {
  const b = String(rows[i][1] ?? '').trim().toLowerCase();
  const c = String(rows[i][2] ?? '').trim().toLowerCase();
  if (b.includes('nik') || c.includes('nama')) { headerIdx = i; break; }
}
const data = rows.slice(headerIdx + 1);

const colIdx = (letter) => {
  let n = 0;
  for (const ch of letter) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
};

// Kolom dicari lewat NAMA header, bukan lewat huruf kolom. Huruf kolom berubah
// setiap kali seseorang menyisipkan kolom di Excel, sedangkan namanya stabil.
const header = rows[headerIdx].map((v) => String(v ?? '').split('(')[0].trim().toLowerCase());
const findCol = (label) => {
  const i = header.findIndex((h) => h === label.toLowerCase());
  if (i < 0) throw new Error(`Kolom "${label}" tidak ditemukan di header Excel`);
  return i;
};

const pemIdx = findCol('Pemeriksaan Lain');
const nikIdx = findCol('NIK KTP');
const tglIdx = findCol('Tanggal MCU');

console.log(`Kolom Pemeriksaan Lain  : indeks ${pemIdx} (huruf ${String.fromCharCode(65 + Math.floor(pemIdx / 26)) + String.fromCharCode(65 + pemIdx % 26)})`);
console.log('');

// Pola yang Searching: nama instrumen, dan keterangan yang sering menyertai.
const SIGNALS = [
  { key: 'srq20', pattern: /srq[\s-]?20/i },
  { key: 'dass21', pattern: /dass[\s-]?21/i },
  { key: 'sds', pattern: /\bsds\b|zung/i },
  { key: 'ess', pattern: /\bess\b|epworth/i },
];

const hits = [];
let nonEmpty = 0;

data.forEach((row, i) => {
  const text = String(row[pemIdx] ?? '').trim();
  if (!text) return;
  nonEmpty += 1;
  const keys = SIGNALS.filter((s) => s.pattern.test(text)).map((s) => s.key);
  if (keys.length === 0) return;
  hits.push({
    excelRow: i + headerIdx + 2,
    nikRef: String(row[nikIdx] ?? '').replace(/\D/g, '').slice(-4).padStart(4, '*'),
    tgl: row[tglIdx] ? parseExcelDate(row[tglIdx]) : null,
    keys,
    text,
  });
});

console.log('=== Teks kuesioner di kolom Pemeriksaan Lain (Excel sumber) ===');
console.log(`Baris data              : ${data.length}`);
console.log(`Pemeriksaan Lain terisi : ${nonEmpty}`);
console.log(`Baris dengan kuesioner  : ${hits.length}`);
console.log('');

const byKey = {};
for (const h of hits) {
  for (const k of h.keys) (byKey[k] ??= []).push(h);
}
for (const { key } of SIGNALS) {
  const list = byKey[key] ?? [];
  console.log(`${key.toUpperCase().padEnd(6)}: ${list.length} baris`);
  for (const h of list.slice(0, 12)) {
    console.log(`   baris ${h.excelRow}  tgl=${h.tgl ?? '—'}  nik=****${h.nikRef}  ${mask(h.text)}`);
  }
  if (list.length > 12) console.log(`   ... +${list.length - 12} baris lain`);
  console.log('');
}

// Ringkasan nilai yang muncul, supaya kelihatan apakah bisa diurai jadi skor.
const VALUES = {};
for (const h of hits) {
  for (const token of h.text.split(/[\n;,]/)) {
    const t = token.trim();
    if (!t) continue;
    const m = t.match(/^(dass[\s-]?21|srq[\s-]?20|sds|ess)\s*[:\-]?\s*(.+)$/i);
    const key = (m ? `${m[1].toUpperCase().replace(/\s/g, '')} → ${m[2].trim()}` : mask(t)).toLowerCase();
    VALUES[key] = (VALUES[key] ?? 0) + 1;
  }
}
console.log('=== Nilai yang muncul (disamarkan, angka dipertahankan) ===');
for (const [value, count] of Object.entries(VALUES).sort((a, b) => b[1] - a[1])) {
  console.log(`${String(count).padStart(4)} ×  ${value}`);
}