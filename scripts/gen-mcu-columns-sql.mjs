// Menghasilkan SQL "ADD COLUMN IF NOT EXISTS" untuk SEMUA kolom mcu_records
// yang dipakai aplikasi (MCU_FIELDS di src/lib/mcu-fields.ts).
//
// Nama kolom dihitung dengan aturan yang sama persis seperti /api/mcu/save:
//   camelCase -> snake_case
// sehingga daftar ini dijamin memuat setiap kolom yang bisa ditulis API —
// termasuk `anti_hav` yang sebelumnya belum ada di database.
//
// Jalankan:  node scripts/gen-mcu-columns-sql.mjs > database/mcu_columns.sql

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'src', 'lib', 'mcu-fields.ts'), 'utf8');

const toSnake = (id) => id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase();

/** Tipe field yang dikenal MCU_FIELDS (FieldType). */
const TIPE_VALID = new Set(['text', 'textarea', 'select', 'date', 'number']);

// Hanya bagian definisi yang dibaca — blok komentar dibuang lebih dulu supaya
// contoh di dokumentasi (mis. "['label', 'teks']") tidak terbaca sebagai field.
const definisi = source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((baris) => !baris.trim().startsWith('//'))
  .join('\n');

// Peta id -> tipe field, dibaca dari definisinya supaya tipe kolom SQL
// mengikuti tipe input di form (jangan menebak dari nama: "anti_hav" berisi
// "Non - Reaktif", bukan angka).
const idType = new Map();

// f('id', 'Label', 'section', 'type', {...})
// HANYA argumen pertama (id) dan argumen tipe yang diambil — daftar opsi
// seperti ['Normal', 'Abnormal'] tidak boleh ikut terbaca sebagai field.
for (const m of definisi.matchAll(/\bf\(\s*'([A-Za-z0-9_]+)'\s*,\s*'(?:[^'\\]|\\.)*'\s*,\s*'[^']*'(?:\s*,\s*'([a-z]+)')?/g)) {
  if (TIPE_VALID.has(m[2] ?? 'text')) idType.set(m[1], m[2] || 'text');
}

// Field yang didaftarkan lewat map() sebagai pasangan [id, label], mis.
//
//   ...([
//     ['hbsag', 'HBsAg'], ['antiHbs', 'Anti-HBs'],
//   ] as const).map(([id, label]) => f(id, label, 'serology', 'select', ...)),
//
// HANYA pasangan di dalam rentang blok seperti itu yang diambil. Rentangnya
// dicari dengan indexOf (bukan satu regex besar), lalu isinya dipindai per
// pasangan. Dengan begitu daftar `options` dan UL_NORMAL_VALUES — yang juga
// berbentuk ['kata', 'kata'] — tidak ikut terbaca sebagai nama kolom.
const ANGKA_DI_MAP = /^(acr_|acl_)/;
const PEMBUKA = '...([';
const PENUTUP = '] as const).map(';
const PASANGAN = /\[\s*'([A-Za-z][A-Za-z0-9_]*)'\s*,\s*'/g;

for (let pos = definisi.indexOf(PEMBUKA); pos !== -1; pos = definisi.indexOf(PEMBUKA, pos + 1)) {
  const akhir = definisi.indexOf(PENUTUP, pos);
  if (akhir === -1) continue;
  const isi = definisi.slice(pos + PEMBUKA.length, akhir);
  for (const m of isi.matchAll(PASANGAN)) {
    const id = m[1];
    if (!idType.has(id)) idType.set(id, ANGKA_DI_MAP.test(id) ? 'number' : 'text');
  }
}

const ids = new Set(idType.keys());

// Kolom yang sudah pasti ada (kunci, audit, hash pencarian) — tidak ditambahkan.
const SELALU_ADA = new Set([
  'id', 'created_at', 'updated_at',
  'nik_karyawan_hash', 'national_id_hash', 'kuesioner_tgl',
]);

// Kata kunci SQL yang tidak boleh menjadi nama kolom tanpa tanda kutip.
// `as` adalah reserved word di PostgreSQL (sumber error 42601).
const KATA_KUNCI_SQL = new Set([
  'all', 'and', 'any', 'as', 'asc', 'between', 'by', 'case', 'cast', 'check',
  'column', 'constraint', 'create', 'current', 'default', 'desc', 'distinct',
  'do', 'else', 'end', 'false', 'for', 'foreign', 'from', 'grant', 'group',
  'having', 'in', 'into', 'is', 'join', 'limit', 'not', 'null', 'offset',
  'on', 'or', 'order', 'primary', 'references', 'select', 'table', 'then',
  'to', 'true', 'union', 'unique', 'update', 'user', 'using', 'values',
  'when', 'where', 'with',
]);

/** Kutip nama kolom hanya bila perlu (kata kunci SQL / karakter khusus). */
const namaKolom = (c) =>
  KATA_KUNCI_SQL.has(c) || !/^[a-z_][a-z0-9_]*$/.test(c) ? `"${c}"` : c;

const columns = [...ids]
  .map(toSnake)
  .filter((c) => !SELALU_ADA.has(c))
  // Hanya nama kolom yang valid: huruf kecil, angka, garis bawah.
  .filter((c) => /^[a-z_][a-z0-9_]*$/.test(c))
  .sort();

// Parameter yang di aplikasi diketik sebagai teks bebas (bukan angka), sehingga
// kolomnya dibuat `text` walau namanya mirip angka (pH, berat jenis, sedimen).
const TEKS = new Set([
  'ul_ph', 'ul_berat_jenis', 'ul_leukosit', 'ul_eritrosit',
  'fram_prob', 'fram_kat', 'tes_kebugaran', 'hasil_kebugaran',
]);

// Field angka yang panjang desimalnya penting (Hb, kolesterol, kreatinin).
// `numeric` tanpa presisi sudah menanganinya, jadi tidak perlu tipe khusus.

const FIELD_TIPE_KE_SQL = {
  text: 'text',
  textarea: 'text',
  select: 'text',
  date: 'date',
  number: 'numeric',
};

const tipeDariId = new Map([...idType.entries()].map(([id, t]) => [toSnake(id), t]));

const tipe = (c) => {
  if (c === 'tgl_mcu' || c === 'tgl_expired') return 'date';
  if (TEKS.has(c)) return 'text';
  // Tipe mengikuti definisi field di mcu-fields.ts.
  return FIELD_TIPE_KE_SQL[tipeDariId.get(c)] || 'text';
};

const lines = [
  '-- ============================================================',
  '-- Kolom mcu_records yang dipakai aplikasi',
  '-- ============================================================',
  '-- Dihasilkan oleh: node scripts/gen-mcu-columns-sql.mjs',
  '-- Semua perintah memakai IF NOT EXISTS, sehingga aman dijalankan pada',
  '-- database yang sebagian kolomnya sudah ada. Kolom yang sudah ada tidak',
  '-- diubah tipenya dan datanya tidak tersentuh.',
  '--',
  '-- Tempel seluruh isi file ini ke SQL Editor Supabase, lalu jalankan.',
  '-- Setelah itu di Supabase: Database > API > "Reload schema cache"',
  '-- (atau tunggu ±1 menit) agar PostgREST mengenali kolom baru.',
  '',
  'alter table public.mcu_records',
  columns.map((c) => `  add column if not exists ${namaKolom(c)} ${tipe(c)}`).join(',\n') + ';',
  '',
  '-- Muat ulang cache skema PostgREST supaya kolom baru langsung dikenal API.',
  'notify pgrst, \'reload schema\';',
  '',
];

process.stdout.write(lines.join('\n'));
