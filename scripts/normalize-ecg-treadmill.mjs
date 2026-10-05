// ============================================================
// Seragamkan nilai EKG dan treadmill ke daftar dropdown kanonis.
//
// Field EKG dan treadmill diubah dari tulis bebas menjadi select, tapi
// data lama masih berisi 40 nilai EKG dan 6 nilai treadmill yang
// PENUH salah eja dan tidak konsisten:
//
//   "Normal Resting ECG"      -> "Normal Sinus Rhythm"
//   "Sinus Tachicardi 108 bpm" -> "Sinus Tachycardia"
//   "Sinus Tachycardia (HR 115 bpm)" -> "Sinus Tachycardia"
//   "PVC Occasional LV Apex"  -> "Ventricular Ectopy during Exercise"
//
// Seluruh daftar di bawah diambil dari nilai yang benar-benar ada di
// mcu_records, bukan contoh karangan.
//
// Setelah ditulis, kolom turunan (diagnosa_medis, item_fu, zonasi)
// dihitung ulang oleh script recompute-mcu-derived.mjs — jalankan itu
// setelah script ini.
//
// PII: tidak ada nama atau NIK yang dibaca maupun dicetak.
// Jalankan dengan --apply untuk menulis; tanpa flag hanya laporan.
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readCsvFile } from './lib/csv.mjs';
import { loadMCUFields } from './lib/mcu-calc-bridge.mjs';
import { PETA_ECG, PETA_TMT } from './lib/ecg-treadmill-canonical.mjs';

const { MCU_FIELD_DEFINITION } = loadMCUFields();

const __d = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__d, '..', '.env.local'), override: false });

const APPLY = process.argv.includes('--apply');
// Menyalin EKG dan treadmill dari CSV hasil generate. Dipakai setelah
// pemetaan berubah, karena nilai yang sudah ternormalkan tidak bisa
// dikenali lagi sebagai nilai mentah.
const SYNC_DARI_CSV = process.argv.includes('--sync-dari-csv');
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ────────────────────────────────────────────────────────────
// Pemetaan ke nilai dropdown kanonis.
//
// Nilai bertanda "(normal variant)" dipetakan ke
// "Normal Variant of Resting ECG", bukan ke "Sinus Bradycardia":
//OPERATOR sudah menulis bahwa denyutnya dalam rentang varian
// normal, jadi memetakannya ke bradikardia akan menaikkan temuan
// yang tidak perlu ditindak.
//
// "Sinus Rythm dg Peaked T Waves" SENGAJA TIDAK dipetakan. Puncak T
//onkjol mencurigai hiperkalemia, dan tidak ada opsi dropdown yang
// tepat — memaksa ke opsi lain akan menghasilkan diagnosis yang
// salah. Nilai itu dibiarkan apa adanya dan dilaporkan.
// ────────────────────────────────────────────────────────────

const PETA = { ecg_hasil: PETA_ECG, tm_hasil: PETA_TMT };

const Halaman = 1000;

async function bacaSemua(kolom = '*') {
  const semua = [];
  for (let from = 0; ; from += Halaman) {
    const { data, error } = await db
      .from('mcu_records')
      .select(kolom)
      .range(from, from + Halaman - 1);
    if (error) throw new Error(`Gagal membaca mcu_records: ${error.message}`);
    semua.push(...(data ?? []));
    if (!data || data.length < Halaman) break;
  }
  return semua;
}

console.log(APPLY ? 'MODE: TULIS' : 'MODE: LAPORAN (--apply untuk menulis)');

const temuan = [];
for (const [kolom, peta] of Object.entries(PETA)) {
  const baris = await bacaSemua(`id, ${kolom}`);
  const perubahan = new Map();
  for (const row of baris) {
    const lama = row[kolom] == null ? '' : String(row[kolom]).trim();
    if (!lama) continue;
    const baru = peta.get(lama);
    if (!baru || baru === lama) continue;
    if (!perubahan.has(baru)) perubahan.set(baru, []);
    perubahan.get(baru).push(row.id);
  }
  const total = [...perubahan.values()].reduce((n, a) => n + a.length, 0);
  console.log(`\n=== ${kolom} : ${total} record diubah ===`);
  for (const [baru, ids] of [...perubahan].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(ids.length).padStart(5)}  -> ${baru}`);
  }
  temuan.push({ kolom, perubahan });

  // Nilai yang tidak ada di peta dan bukan pilihan dropdown harus
  // dilaporkan, bukan diabaikan diam-diam. Daftar kanonic diambil dari
  // MCU_FIELDS, bukan dari nilai target pemetaan, supaya nilai dropdown
  // yang memang sudah baku (mis. "Negative Ischemic Response") tidak
  // salah dilaporkan sebagai perlu dimigrasi.
  const opsiField = new Set(
    MCU_FIELD_DEFINITION.find((f) => f.id === (kolom === 'ecg_hasil' ? 'ecgHasil' : 'tmHasil'))?.options ?? [],
  );
  const belum = new Map();
  for (const row of baris) {
    const v = row[kolom] == null ? '' : String(row[kolom]).trim();
    if (v && !peta.has(v) && !opsiField.has(v)) belum.set(v, (belum.get(v) ?? 0) + 1);
  }
  if (belum.size > 0) {
    console.log(`  TIDAK dipetakan:`);
    for (const [v, n] of [...belum].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(n).padStart(4)}  ${v}`);
    }
  }
}

// ────────────────────────────────────────────────────────────
// Sinkronisasi dari CSV hasil generate.
//
// Pemetaan di atas bekerja dari nilai mentah di database. Kalau nilai
// database sudah pernah dinormalkan oleh versi pemetaan yang LAMA, dan
// pemetaan itu ternyata salah derajat, nilai itu tidak bisa dikenali
// lagi sebagai apa pun — aslinanya sudah hilang.
//
// Kasus nyata: "Sinus rhythm, first degree atrioventricular block"
// pernah dipetakan ke "Atrioventricular Block" (merah) sebelum derajat
// pertama dipisahkan. Satu record itu masih menyimpan hasil salah itu.
//
// CSV hasil generate dibangun dari Excel sumber yang sama dan sudah
// benar, jadi dua kolom ini disalin dari sana. Hanya EKG dan treadmill
// yang disentuh; kolom lain tidak ditimpa karena nilainya bisa berasal
// dari input aplikasi, bukan dari Excel.
// ────────────────────────────────────────────────────────────

let rencanaSync = [];
if (SYNC_DARI_CSV) {
  const csvPath = path.join(__d, '..', 'local-only', 'archive', 'mcu-import', 'mcu-import-bulk-upload.csv');
  if (!fs.existsSync(csvPath)) {
    console.log(`\nSync CSV dilewati: ${csvPath} belum ada. Jalankan split-sql-and-csv.mjs dulu.`);
  } else {
    const { header, rows } = readCsvFile(csvPath);
    const iEcg = header.indexOf('ecg_hasil');
    const iTm = header.indexOf('tm_hasil');
    const iHash = header.indexOf('national_id_hash');
    const iTgl = header.indexOf('tgl_mcu');

    const semua = await bacaSemua();
    const byKey = new Map(semua.map((r) => [`${r.national_id_hash}|${r.tgl_mcu ?? ''}`, r]));

    const perPatch = new Map();
    for (const cells of rows) {
      const row = byKey.get(`${(cells[iHash] ?? '').trim()}|${(cells[iTgl] ?? '').trim()}`);
      if (!row) continue;
      const patch = {};
      const ecgCsv = (cells[iEcg] ?? '').trim();
      const tmCsv = (cells[iTm] ?? '').trim();
      if (ecgCsv !== (row.ecg_hasil ?? '').trim()) patch.ecg_hasil = ecgCsv || null;
      if (tmCsv !== (row.tm_hasil ?? '').trim()) patch.tm_hasil = tmCsv || null;
      if (Object.keys(patch).length === 0) continue;
      const tanda = JSON.stringify(patch);
      if (!perPatch.has(tanda)) perPatch.set(tanda, []);
      perPatch.get(tanda).push(row.id);
    }
    rencanaSync = [...perPatch].map(([tanda, ids]) => ({ patch: JSON.parse(tanda), ids }));

    const totalSync = rencanaSync.reduce((n, a) => n + a.ids.length, 0);
    console.log(`\n=== Sync dari CSV : ${totalSync} record ===`);
    for (const { patch, ids } of rencanaSync) {
      console.log(`  ${String(ids.length).padStart(5)}  ${JSON.stringify(patch)}`);
    }
  }
}

if (!APPLY) {
  console.log('\nDry-run selesai. Tidak ada data yang diubah.');
  console.log('Jalankan ulang dengan --apply, lalu scripts/recompute-mcu-derived.mjs --apply');
  process.exit(0);
}

for (const { patch, ids } of rencanaSync) {
  for (let i = 0; i < ids.length; i += 200) {
    const potong = ids.slice(i, i + 200);
    const { error } = await db.from('mcu_records').update(patch).in('id', potong);
    if (error) console.error(`  GAGAL sync: ${error.message.slice(0, 140)}`);
    else console.log(`  tersinkron: ${potong.length} record -> ${JSON.stringify(patch)}`);
  }
}

// Tulis per nilai target sekaligus, bukan satu-satu, supaya tidak
// menerbitkan request per record. ID dipecah per BATCH karena daftar
// 1216 id dalam satu filter .in() melebihi batas panjang request dan
// ditolak sebagai "URI too long" — tidak ada yang tertulis diam-diam.
const BATCH = 200;

let ditulis = 0;
let gagal = 0;
for (const { kolom, perubahan } of temuan) {
  for (const [target, idList] of perubahan) {
    for (let i = 0; i < idList.length; i += BATCH) {
      const potong = idList.slice(i, i + BATCH);
      const { error } = await db
        .from('mcu_records')
        .update({ [kolom]: target })
        .in('id', potong);
      if (error) {
        gagal += potong.length;
        console.error(`  GAGAL ${kolom} -> ${target} (${potong.length} id): ${error.message.slice(0, 160)}`);
      } else {
        ditulis += potong.length;
      }
    }
  }
}

console.log(`\nDitulis: ${ditulis}, gagal: ${gagal}`);
if (gagal > 0) process.exit(1);