// ============================================================
// Hitung ulang kolom turunan (diagnosa_medis, zonasi, frame score, ...)
// pada MCU yang SUDAH ada di database.
//
// Dipakai setelah klasifikasi klinis berubah, supaya record lama ikut
// memakai kaidah yang sama dengan record baru. Nilai lama dibaca dari
// database, dihitung ulang oleh engine APLIKASI (bukan rumus script),
// lalu ditulis kembali hanya kalau hasilnya berbeda.
//
// Jalankan dengan --apply untuk menulis. Tanpa flag itu script hanya
// melaporkan, sehingga aman dijalankan tanpa sengaja.
//
// PII: nama dan NIK hanya didekripsi untuk perhitungan dan tidak pernah
// dicetak. Record ditampilkan lewat national_id_hash (12 karakter pertama).
// ============================================================

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { calculateRecord, CALCULATED_COLUMNS } from './lib/mcu-calc-bridge.mjs';
import { decrypt } from './lib/encryption.mjs';

const __d = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__d, '..', '.env.local'), override: false });

const APPLY = process.argv.includes('--apply');

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Kolom yang disimpan terenkripsi di database. Engine menerima bentuk
// plaintext yang sama seperti dari form aplikasi.
const ENCRYPTED_FIELDS = ['national_id', 'nik_karyawan', 'nama', 'link_mcu'];

// Kolom turunan yang akan ditulis ulang.
const CALC = Object.keys(CALCULATED_COLUMNS);

const Halaman = 1000;

async function bacaSemua(select) {
  const semua = [];
  for (let from = 0; ; from += Halaman) {
    const { data, error } = await db
      .from('mcu_records')
      .select(select)
      .range(from, from + Halaman - 1);
    if (error) throw new Error(`Gagal membaca mcu_records: ${error.message}`);
    semua.push(...(data ?? []));
    if (!data || data.length < Halaman) break;
  }
  return semua;
}

const norm = (v) =>
  v == null || v === '' ? null : String(v).replace(/\s+/g, ' ').trim();

console.log(`${APPLY ? 'MODE: TULIS' : 'MODE: LAPORAN (--apply untuk menulis)'}`);

const baris = await bacaSemua('*');
console.log(`Record terbaca: ${baris.length}`);

const berubah = [];
const ringkasanKolom = new Map();

for (const row of baris) {
  const ref = String(row.national_id_hash ?? row.id ?? '?').slice(0, 12);
  const sebelum = Object.fromEntries(CALC.map((c) => [c, norm(row[c])]));

  const decrypted = { ...row };
  for (const f of ENCRYPTED_FIELDS) {
    if (decrypted[f]) decrypted[f] = decrypt(decrypted[f]) ?? decrypted[f];
  }

  const out = calculateRecord(decrypted);
  const sesudah = Object.fromEntries(CALC.map((c) => [c, norm(out[c])]));

  const selisih = {};
  for (const c of CALC) {
    if (sebelum[c] !== sesudah[c]) {
      selisih[c] = sesudah[c];
      ringkasanKolom.set(c, (ringkasanKolom.get(c) ?? 0) + 1);
    }
  }
  if (Object.keys(selisih).length > 0) berubah.push({ ref, id: row.id, selisih, sebelum });
}

console.log(`Record yang berubah: ${berubah.length}`);
if (ringkasanKolom.size === 0) {
  console.log('Semua kolom turunan sudah sama dengan engine. Tidak ada yang perlu ditulis.');
  process.exit(0);
}

console.log('\nKolom yang berubah (jumlah record):');
for (const [col, n] of [...ringkasanKolom].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(5)}  ${col}`);
}

// Contoh perubahan diagnosa_medis, supaya hasil klasifikasi baru bisa
// diperiksa tanpa membuka data pribadi.
const contohDiag = berubah
  .filter((b) => b.selisih.diagnosa_medis !== undefined)
  .slice(0, 15);
if (contohDiag.length > 0) {
  console.log('\nContoh perubahan diagnosa_medis:');
  for (const b of contohDiag) {
    console.log(`  ${b.ref}`);
    console.log(`    lama : ${b.sebelum.diagnosa_medis ?? '(kosong)'}`);
    console.log(`    baru : ${b.selisih.diagnosa_medis ?? '(kosong)'}`);
  }
  if (berubah.filter((b) => b.selisih.diagnosa_medis !== undefined).length > 15) {
    console.log(`    ... dan ${berubah.filter((b) => b.selisih.diagnosa_medis !== undefined).length - 15} lainnya`);
  }
}

if (!APPLY) {
  console.log('\nDry-run selesai. Tidak ada data yang diubah.');
  console.log('Jalankan ulang dengan --apply untuk menulis kolom turunan.');
  process.exit(0);
}

let ditulis = 0;
let gagal = 0;
// Pembaruan paralel terbatas: tetap ramah API, namun tidak membuat migrasi
// 1.299 record berhenti di tengah karena timeout satu-per-satu.
const UKURAN_BATCH = 20;
for (let start = 0; start < berubah.length; start += UKURAN_BATCH) {
  const batch = berubah.slice(start, start + UKURAN_BATCH);
  const hasil = await Promise.all(batch.map(async (b) => ({ b, result: await db.from('mcu_records').update(b.selisih).eq('id', b.id) })));
  for (const { b, result } of hasil) {
    if (result.error) {
      gagal += 1;
      console.error(`  GAGAL ${b.ref}: ${result.error.message.slice(0, 120)}`);
    } else {
      ditulis += 1;
    }
  }
}

console.log(`\nDitulis: ${ditulis}, gagal: ${gagal}`);
if (gagal > 0) process.exit(1);
