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

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { loadMCUFields } from './lib/mcu-calc-bridge.mjs';
import { PETA_ECG, PETA_TMT } from './lib/ecg-treadmill-canonical.mjs';

const { MCU_FIELD_DEFINITION } = loadMCUFields();

const __d = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__d, '..', '.env.local'), override: false });

const APPLY = process.argv.includes('--apply');
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

async function bacaKolom(kolom) {
  const semua = [];
  for (let from = 0; ; from += Halaman) {
    const { data, error } = await db
      .from('mcu_records')
      .select(`id, ${kolom}`)
      .range(from, from + Halaman - 1);
    if (error) throw new Error(`Gagal membaca ${kolom}: ${error.message}`);
    semua.push(...(data ?? []));
    if (!data || data.length < Halaman) break;
  }
  return semua;
}

console.log(APPLY ? 'MODE: TULIS' : 'MODE: LAPORAN (--apply untuk menulis)');

const temuan = [];
for (const [kolom, peta] of Object.entries(PETA)) {
  const baris = await bacaKolom(kolom);
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

if (!APPLY) {
  console.log('\nDry-run selesai. Tidak ada data yang diubah.');
  console.log('Jalankan ulang dengan --apply, lalu scripts/recompute-mcu-derived.mjs --apply');
  process.exit(0);
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