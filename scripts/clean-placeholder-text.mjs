// ============================================================
// Bersihkan nilai placeholder yang tertinggal dari Excel.
//
// Beberapa sel di file Excel sumber berisi "#N/A", yaitu nilai error
// bawaan spreadsheet ketika lookup tidak menemukan kecocokan. Nilai itu
// bukan data, tapi karena tetap terbaca sebagai teks, ikut tersimpan di
// database dan muncul di laporan.
//
// Contoh nyata: 7 record punya site = "#N/A", sehingga site tidak bisa
// dipakai untuk mengelompokkan hasil MCU.
//
// Yang dibersihkan di sini HANYA nilai placeholder persis. Teks berisi
// kata "null" atau "tidak ada" di dalam kalimat lain tidak disentuh,
// karena itu mungkin keterangan yang benar.
//
// Kolom terenkripsi dilewati: isinya ciphertext, bukan placeholder.
//
// Jalankan dengan --apply untuk menulis; tanpa flag hanya laporan.
// PII: nama dan NIK tidak pernah dibaca maupun dicetak.
// ============================================================

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __d = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__d, '..', '.env.local'), override: false });

const APPLY = process.argv.includes('--apply');
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Placeholder yang pernah dihasilkan Excel atau oleh adminsitrator.
// Perbandingan dilakukan pada bentuk lowercase dan sudah dipangkas.
const PLACEHOLDER = new Set([
  '#n/a', '#n/a n/a', '#ref!', '#value!', '#div/0!', '#name?', '#num!', '#null!',
  'null', 'undefined', 'nan', 'nil', '-', '--', 'n/a', 'na',
  'tidak ada', 'kosong', 'blank',
]);

// Kolom ini terenkripsi di database; isinya bukan placeholder.
const TERENKRIPSI = new Set(['national_id', 'nik_karyawan', 'nama', 'link_mcu']);

// Kolom yang nilainya boleh dibiarkan kosong karena memang opsional.
const BolehKosong = new Set(['id', 'created_at', 'updated_at']);

const Halaman = 1000;

async function bacaSemua() {
  const semua = [];
  for (let from = 0; ; from += Halaman) {
    const { data, error } = await db.from('mcu_records').select('*').range(from, from + Halaman - 1);
    if (error) throw new Error(`Gagal membaca mcu_records: ${error.message}`);
    semua.push(...(data ?? []));
    if (!data || data.length < Halaman) break;
  }
  return semua;
}

console.log(APPLY ? 'MODE: TULIS' : 'MODE: LAPORAN (--apply untuk menulis)');

const baris = await bacaSemua();
console.log(`Record terbaca: ${baris.length}`);

const perubahan = [];
const ringkasan = new Map();

for (const row of baris) {
  const patch = {};
  for (const [kolom, nilai] of Object.entries(row)) {
    if (typeof nilai !== 'string') continue;
    if (TERENKRIPSI.has(kolom) || BolehKosong.has(kolom)) continue;
    const potong = nilai.trim();
    if (!potong) continue;
    if (!PLACEHOLDER.has(potong.toLowerCase())) continue;
    patch[kolom] = null;
    ringkasan.set(kolom, (ringkasan.get(kolom) ?? 0) + 1);
  }
  if (Object.keys(patch).length > 0) perubahan.push({ id: row.id, patch, ref: String(row.national_id_hash ?? '').slice(0, 12) });
}

const totalSel = [...ringkasan.values()].reduce((n, a) => n + a, 0);
console.log(`Record yang perlu dibersihkan: ${perubahan.length} (${totalSel} sel)`);

if (ringkasan.size === 0) {
  console.log('Tidak ada nilai placeholder. Semua data bersih.');
  process.exit(0);
}

console.log('\nKolom yang ditemukan masih berisi placeholder:');
for (const [kolom, n] of [...ringkasan].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${kolom}`);
}

if (!APPLY) {
  console.log('\nDry-run selesai. Tidak ada data yang diubah.');
  console.log('Jalankan ulang dengan --apply untuk mengosongkan sel-sel tersebut.');
  process.exit(0);
}

let ditulis = 0;
let gagal = 0;
for (const { id, patch, ref } of perubahan) {
  const { error } = await db.from('mcu_records').update(patch).eq('id', id);
  if (error) {
    gagal += 1;
    console.error(`  GAGAL ${ref}: ${error.message.slice(0, 120)}`);
  } else {
    ditulis += 1;
  }
}

console.log(`\nRecord diperbarui: ${ditulis}, gagal: ${gagal}`);
if (gagal > 0) process.exit(1);