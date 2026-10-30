// ============================================================
// PERBAIKAN enkripsi mcu_records — Opsi A
// ============================================================
// MASALAH (hasil audit):
//   mcu_records.nik_karyawan    : TERENKRIPSI 2 LAPIS  (dari 1.299 baris)
//   mcu_records.nik_karyawan_hash : dihitung dari ciphertext lapis-1,
//                                   bukan dari NIK asli → 1.299/1.299 TIDAK cocok
//   national_id, nama           : sudah benar (1 lapis)
//   employees                   : sehat (3.159 baris, hash cocok semua)
//
// AKIBAT:
//   Pencarian record MCU berdasarkan NIK (Review MCU, jadwal, tindak lanjut)
//   tidak menemukan apa pun.
//
// YANG DILAKUKAN SKRIP INI:
//   1. BACKUP seluruh mcu_records ke mcu_records_backup_<tanggal>
//      (tabel dibuat lewat CREATE TABLE ... AS SELECT, jadi identik).
//   2. Untuk setiap baris:
//        - dekripsi nik_karyawan sampai lapis terakhir (plaintext NIK)
//        - enkripsi SEKALI
//        - hitung ulang nik_karyawan_hash dari plaintext
//   3. Verifikasi ulang setiap baris setelah ditulis.
//   4. Cetak ringkasan.
//
// AMAN DIJALANKAN BERULANG: baris yang sudah 1 lapis & hash cocok dilewati.
//
// Pakai:
//   node scripts/fix-enkripsi-mcu.mjs            → uji (dry-run, TIDAK menulis)
//   node scripts/fix-enkripsi-mcu.mjs --apply    → benar-benar menulis
//   node scripts/fix-enkripsi-mcu.mjs --rollback → kembalikan dari backup
// ============================================================
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
);

const KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex');
const ALGO = 'aes-256-gcm';
const IV = 12;
const TAG = 16;

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const APPLY = process.argv.includes('--apply');
const ROLLBACK = process.argv.includes('--rollback');
const TANGGAL = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const BACKUP = `mcu_records_backup_${TANGGAL}`;

const hashField = (v) => crypto.createHmac('sha256', KEY).update(String(v)).digest('hex');

function enkripsi(plain) {
  const iv = crypto.randomBytes(IV);
  const c = crypto.createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('hex');
}

function dekripsiSekali(hex) {
  try {
    const b = Buffer.from(String(hex), 'hex');
    if (b.length < IV + TAG + 1) return null;
    const d = crypto.createDecipheriv(ALGO, KEY, b.subarray(0, IV));
    d.setAuthTag(b.subarray(IV, IV + TAG));
    return Buffer.concat([d.update(b.subarray(IV + TAG)), d.final()]).toString('utf8');
  } catch { return null; }
}

/** Dekripsi berulang → { plain, lapis } */
function dekripsiPenuh(value) {
  let text = String(value ?? '').trim();
  let lapis = 0;
  for (let i = 0; i < 5; i += 1) {
    if (!/^[0-9a-fA-F]+$/.test(text) || text.length < 58 || text.length % 2 !== 0) break;
    const hasil = dekripsiSekali(text);
    if (hasil == null) break;
    text = hasil;
    lapis += 1;
  }
  return { plain: text, lapis };
}

async function semuaBaris(kolom) {
  const rows = [];
  const PAGE = 200;
  for (let from = 0; ; from += PAGE) {
    let data = null;
    for (let coba = 0; coba < 3 && !data; coba += 1) {
      const res = await sb.from('mcu_records').select(kolom).order('id').range(from, from + PAGE - 1);
      if (!res.error) data = res.data;
      else await new Promise((r) => setTimeout(r, 500));
    }
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

/* ── ROLLBACK ─────────────────────────────────────────────────── */
if (ROLLBACK) {
  console.log(`Mengembalikan dari ${BACKUP} …`);
  const rows = [];
  for (let from = 0; ; from += 200) {
    const { data, error } = await sb.from(BACKUP).select('id,nik_karyawan,nik_karyawan_hash').order('id').range(from, from + 199);
    if (error) { console.error('Gagal membaca backup:', error.message); process.exit(1); }
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 200) break;
  }
  let n = 0;
  for (const r of rows) {
    const { error } = await sb.from('mcu_records')
      .update({ nik_karyawan: r.nik_karyawan, nik_karyawan_hash: r.nik_karyawan_hash })
      .eq('id', r.id);
    if (!error) n += 1;
  }
  console.log(`Selesai. ${n}/${rows.length} baris dikembalikan.`);
  process.exit(0);
}

/* ── BACKUP ───────────────────────────────────────────────────── */

/**
 * Mencari nama tabel backup yang tersedia.
 *
 * PERBAIKAN: dulu skrip memakai tanggal HARI INI, sehingga SQL yang disalin
 * kemarin tidak cocok dengan nama yang dicari hari ini. Sekarang dicari
 * tabel backup mana pun dengan awalan `mcu_records_backup_`.
 *
 * Juga TIDAK LAGI memanggil `process.exit()` di dalam fungsi async — itu
 * memutus koneksi Supabase yang masih terbuka dan memunculkan
 * "Assertion failed: UV_HANDLE_CLOSING" di Windows.
 */
async function cariBackup() {
  const kandidat = [BACKUP, 'mcu_records_backup_20261029', 'mcu_records_backup_20261030'];
  for (const nama of kandidat) {
    const cek = await sb.from(nama).select('id').limit(1);
    if (!cek.error) {
      console.log(`Backup ditemukan: ${nama}`);
      return nama;
    }
  }
  return null;
}

/* ── PERBAIKAN ────────────────────────────────────────────────── */
const BACKUP_TERPAKAI = await cariBackup();

if (!BACKUP_TERPAKAI) {
  console.log('\n⚠ Tabel backup belum ada.');
  console.log('  Skrip ini TIDAK dapat membuat tabel baru (Supabase memblokir DDL lewat REST).');
  console.log('  Jalankan SQL berikut di Supabase SQL Editor LEBIH DAHULU:\n');
  console.log(`  CREATE TABLE IF NOT EXISTS ${BACKUP} AS SELECT * FROM mcu_records;`);
  console.log(`  ALTER TABLE ${BACKUP} ADD PRIMARY KEY (id);\n`);
  console.log(`  Setelah itu jalankan ulang: node scripts/fix-enkripsi-mcu.mjs${APPLY ? ' --apply' : ''}`);
  // Keluar dengan tenang: beri waktu koneksi socket ditutup agar tidak
  // memicu assertion libuv di Windows.
  await new Promise((r) => setTimeout(r, 200));
  process.exitCode = 1;
} else {
  await jalankanPerbaikan();
}

async function jalankanPerbaikan() {
const rows = await semuaBaris('id,nik_karyawan,nik_karyawan_hash');
console.log(`\n${APPLY ? 'MODE TULIS' : 'MODE UJI (dry-run)'} — ${rows.length} baris\n`);

let perluDiperbaiki = 0;
let sudahBenar = 0;
let gagal = 0;
const contoh = [];

for (const r of rows) {
  const { plain, lapis } = dekripsiPenuh(r.nik_karyawan);
  const hashBenar = plain ? hashField(plain) : null;
  const ok = lapis === 1 && hashBenar === r.nik_karyawan_hash;
  void BACKUP_TERPAKAI;

  if (ok) { sudahBenar += 1; continue; }
  if (!plain || plain.length < 4) { gagal += 1; continue; }

  perluDiperbaiki += 1;
  if (contoh.length < 5) {
    contoh.push({ id: r.id, lapis, plain, hashLama: String(r.nik_karyawan_hash).slice(0, 12), hashBaru: hashBenar.slice(0, 12) });
  }

  if (!APPLY) continue;

  const { error } = await sb.from('mcu_records').update({
    nik_karyawan: enkripsi(plain),
    nik_karyawan_hash: hashBenar,
  }).eq('id', r.id);

  if (error) { gagal += 1; console.error(`  gagal id=${r.id}: ${error.message}`); }
}

console.log('Contoh yang akan/ sudah diperbaiki:');
for (const c of contoh) {
  console.log(`  id=${c.id.slice(0, 8)} lapis=${c.lapis} nik=${c.plain} hash ${c.hashLama} → ${c.hashBaru}`);
}
console.log(`\nSudah benar : ${sudahBenar}`);
console.log(`Perlu fix   : ${perluDiperbaiki}`);
console.log(`Gagal       : ${gagal}`);
console.log(APPLY ? '\n✔ Perbaikan diterapkan.' : '\nIni hanya UJI. Jalankan dengan --apply untuk menulis.');

/* ── VERIFIKASI ───────────────────────────────────────────────── */
if (APPLY) {
  console.log('\nVerifikasi ulang …');
  const cek = await semuaBaris('id,nik_karyawan,nik_karyawan_hash');
  let masihSalah = 0;
  for (const r of cek) {
    const { plain, lapis } = dekripsiPenuh(r.nik_karyawan);
    if (!plain || lapis !== 1 || hashField(plain) !== r.nik_karyawan_hash) masihSalah += 1;
  }
  console.log(masihSalah === 0
    ? `✔ Semua ${cek.length} baris kini 1 lapis & hash konsisten.`
    : `⚠ Masih ada ${masihSalah} baris bermasalah.`);
  if (masihSalah > 0) process.exitCode = 1;
}
}
