// ============================================================================
// Cek kecocokan kolom: daftar di split-sql-and-csv.mjs vs skema di Supabase
// ============================================================================
//
// Import CSV akan MENGOSONGKAN setiap kolom yang tidak ada di header CSV, dan
// import SQL akan GAGAL_total bila INSERT menyebut kolom yang belum ada di
// database. Dua-duanya mahal untuk ditemukan setelah impor berjalan.
//
// Skrip ini membandingkan daftar INSERT_COLS pada split-sql-and-csv.mjs dengan
// kolom nyata di information_schema, lalu melaporkan:
//   - kolom yang dipakai import tapi belum ada di database (perlu migrasi),
//   - kolom yang ada di database tapi tidak dipakai import (nilai lama akan
//     tertimpa NULL kalau impor lewat CSV).
//
// Pakai:  node scripts/verify-import-columns.mjs
// ============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(ROOT, '.env.local'), override: false });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi');
}

const script = fs.readFileSync(path.join(__dirname, 'split-sql-and-csv.mjs'), 'utf8');

// Ambil daftar literal di dalam ALL_COLUMNS_ORDERED tanpa menjalankan skripnya.
const block = script.match(/const ALL_COLUMNS_ORDERED = \[([\s\S]*?)\n\];/);
if (!block) throw new Error('ALL_COLUMNS_ORDERED tidak ditemukan di split-sql-and-csv.mjs');
const allColumns = [...block[1].matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
const importColumns = allColumns.filter((c) => !['id', 'created_at', 'updated_at'].includes(c));

// PostgREST tidak mengekspos information_schema sebagai tabel yang bisa
// ditanyakan, jadi keberadaan kolom dideteksi lewat error PostgREST: meminta
// kolom yang tidak ada menghasilkan kode 42703 dengan nama kolomnya. Satu
// permintaan cukup untuk satu probing; kolom yang gagal dikurangi dari daftar
// lalu diulang.
async function probeColumns(client, table, candidates) {
  const missing = [];
  let pending = [...candidates];
  while (pending.length > 0) {
    const { error } = await client.from(table).select(pending.join(',')).limit(1);
    if (!error) break;

    const match = error.message.match(/column (?:[a-z0-9_]+\.)?([a-z0-9_]+) does not exist/);
    if (!match || !pending.includes(match[1])) break;

    missing.push(match[1]);
    pending = pending.filter((c) => c !== match[1]);
  }
  return missing;
}

const supabase = createClient(url, serviceKey);
const missingInDb = await probeColumns(supabase, 'mcu_records', importColumns);

// Kolom database yang tidak dipakai import tidak bisa ditanyakan langsung
// tanpa daftar, jadi sisanya dibaca dari metadata PostgREST yang dikembalikan
// saat semua kolom valid diminta.
const dbColumns = new Set(importColumns.filter((c) => !missingInDb.includes(c)));
const { data: sample, error: sampleError } = await supabase.from('mcu_records').select('*').limit(1);
if (sampleError) throw sampleError;
for (const c of Object.keys(sample?.[0] ?? {})) dbColumns.add(c);

const importSet = new Set(importColumns);
const missingInImport = [...dbColumns].filter(
  (c) => !importSet.has(c) && !['id', 'created_at', 'updated_at'].includes(c),
);

console.log('=== Kecocokan kolom import vs database ===');
console.log(`Kolom di skrip import : ${importColumns.length} (unik ${importSet.size})`);
console.log(`Kolom di database     : ${dbColumns.size}`);
console.log('');

if (missingInDb.length === 0) {
  console.log('OK  Semua kolom yang dipakai import sudah ada di database.');
} else {
  console.log(`MASALAH ${missingInDb.length} kolom dipakai import tapi BELUM ada di database:`);
  for (const c of missingInDb) console.log(`   - ${c}`);
  console.log('   Jalankan migrasi yang menambah kolom-kolom tersebut lebih dulu.');
}
console.log('');

if (missingInImport.length === 0) {
  console.log('OK  Semua kolom database ikut ditulis oleh import.');
} else {
  console.log(`PERHATIAN ${missingInImport.length} kolom ada di database tapi TIDAK ada di import:`);
  for (const c of missingInImport) console.log(`   - ${c}`);
  console.log('   Impor lewat CSV akan mengosongkan kolom-kolom ini.');
}
console.log('');

const needsMigration = missingInDb.length > 0;
process.exit(needsMigration ? 1 : 0);