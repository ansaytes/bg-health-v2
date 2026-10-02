// Memeriksa apakah file import memuat kolom yang baru ditambahkan migrasi.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const KOLOM_BARU = [
  'riwayat_epilepsi', 'riwayat_jantung', 'riwayat_stroke', 'riwayat_asma',
  'riwayat_sleep_apnea', 'lbp', 'ess_score', 'srq20_score', 'dass_depresi',
  'dass_cemas', 'dass_stres', 'sds_score', 'kuesioner_tgl', 'pta',
  'ringkasan_kuesioner', 'hasil_kebugaran', 'frekuensi_evaluasi', 'catatan_sop',
];

// Ambil nama kolom pertama pada file batch SQL.
const batch = path.join(ROOT, 'scripts', 'mcu-import-batches', 'batch-01-of-26.sql');
const batchSql = fs.readFileSync(batch, 'utf8');
const m = batchSql.match(/INSERT INTO\s+public\.mcu_records\s*\(([\s\S]*?)\)\s*VALUES/i);
const kolomBatch = m
  ? m[1].split(',').map((x) => x.trim().replace(/^"|"$/g, ''))
  : [];

const csv = path.join(ROOT, 'scripts', 'mcu-import-bulk-upload.csv');
const headerCsv = fs.readFileSync(csv, 'utf8').split(/\r?\n/)[0]
  .split(',').map((x) => x.trim().replace(/^"|"$/g, ''));

console.log(`kolom di batch SQL : ${kolomBatch.length}`);
console.log(`kolom di CSV      : ${headerCsv.length}`);
console.log(`kolom baru dibutuhkan: ${KOLOM_BARU.length}`);
console.log('');

for (const [label, daftar] of [['batch SQL', kolomBatch], ['CSV', headerCsv]]) {
  const kurang = KOLOM_BARU.filter((k) => !daftar.includes(k));
  console.log(`${label}: ${kurang.length === 0 ? 'LENGKAP' : `kurang ${kurang.length} -> ${kurang.join(', ')}`}`);
}

console.log('');
console.log('Kalau "kurang", import akan mengisi kolom kosong di kolom-kolom itu.');
console.log('Perbaiki dengan: node scripts/split-sql-and-csv.mjs');