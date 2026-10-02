// ============================================================================
// Migrasi hasil kuesioner lama dari kolom pemeriksaan_lain ke tabel terpisah
// ============================================================================
//
// Di Excel sumber, hasil kuesioner ditulis sebagai TEKS di kolom Pemeriksaan
// Lain, misalnya:
//
//     DASS-21 : Normal
//     SRQ-20 : Normal
//     DASS-21 : Normal   ESS : 4
//     CVD Risk : Moderate Risk   SRQ-20 : Normal
//
// Semua itu adalah hasil yang sah, tapi menyimpannya sebagai teks membuat
// angka tidak bisa dijumlahkan dan tidak bisa dibandingkan antar waktu. Skrip
// ini mengurai pola yang dikenal dan memindahkannya ke mcu_ess /
// mcu_mental_health, satu baris per karyawan per tanggal.
//
// ATURAN PENTING
//   • Teks yang tidak bisa diurai angka (mis. hanya "Normal") tetap dicatat
//     sebagai hasil BERJALAN dengan skor null dan interpretasinya apa adanya.
//     Membuangnya akan menghilangkan bukti bahwa karyawan sudah pernah diperiksa.
//   • Kolom pemeriksaan_lain TIDAK dikosongkan. Di dalamnya masih ada catatan
//     lain yang tidak terkait kuesioner (CVD Risk, PAP, dan sebagainya), jadi
//     teks kuesioner hanya ditandai, bukan dihapus.
//   • Skrip aman dijalankan berulang kali: baris yang sudah ada untuk karyawan
//     dan tanggal yang sama akan diperbarui, bukan diduplikasi.
//
// Nilainya berasal dari Excel lokal yang sudah dimiliki tim; skrip tidak
// mencetak isi kolom pemeriksaan_lain ke log.
//
// Pakai:  node scripts/migrate-legacy-questionnaires.mjs          (ringkasan)
//         node scripts/migrate-legacy-questionnaires.mjs --apply  (tulis ke DB)
// ============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

import { parseExcelDate } from './lib/excel-date.mjs';
import { encrypt, hashField } from './lib/encryption.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(ROOT, '.env.local'), override: false });

const EXCEL_PATH = 'C:/Users/bagon/Downloads/Record MCU 2026.xlsx';
const apply = process.argv.includes('--apply');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi');
}
const supabase = createClient(url, serviceKey);

// ────────────────────────────────────────────────────────────
// Baca Excel
// ────────────────────────────────────────────────────────────

const wb = XLSX.read(fs.readFileSync(EXCEL_PATH), { type: 'buffer', cellDates: true });
const sheet = wb.SheetNames.find((n) => /raw/i.test(n) && /data/i.test(n)) || wb.SheetNames[0];
const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: null, raw: false });

const header = rows[0].map((v) => String(v ?? '').split('(')[0].trim().toLowerCase());
const findCol = (label) => {
  const i = header.findIndex((h) => h === label.toLowerCase());
  if (i < 0) throw new Error(`Kolom "${label}" tidak ditemukan`);
  return i;
};

const COL = {
  nik: findCol('NIK KTP'),
  nama: findCol('Nama'),
  jabatan: findCol('Jabatan'),
  site: findCol('Site'),
  jenisKelamin: findCol('Jenis Kelamin'),
  usia: findCol('Usia'),
  tglMcu: findCol('Tanggal MCU'),
  pemeriksaanLain: findCol('Pemeriksaan Lain'),
};

// ────────────────────────────────────────────────────────────
// Penguraian teks
// ────────────────────────────────────────────────────────────

/**
 * Mengambil nilai satu instrumen dari teks pemeriksaan_lain.
 *
 * Mengembalikan null bila instrumen tidak disebut, dan objek dengan skor
 * null bila disebut tanpa angka (mis. "DASS-21 : Normal").
 */
function extract(text, instrument) {
  const re = new RegExp(`${instrument}\\s*[:\\-]?\\s*([^|\\n;]*)`, 'i');
  const match = String(text).match(re);
  if (!match) return null;

  const rawValue = match[1].trim().replace(/\(\s*(.*?)\s*\)/g, '').trim();
  const numeric = rawValue.match(/-?\d+(?:[.,]\d+)?/);

  return {
    raw: match[1].trim(),
    score: numeric ? Number(numeric[0].replace(',', '.')) : null,
  };
}

/** ESS 11-15 ringan–sedang, >15 berat, selain itu normal. */
function essCategory(score) {
  if (score === null) return 'normal';
  if (score > 15) return 'berat';
  if (score >= 11) return 'ringan-sedang';
  return 'normal';
}

function essLabel(score) {
  if (score === null) return 'Normal (tanpa angka)';
  if (score > 15) return 'Kantuk berlebihan berat';
  if (score >= 11) return 'Kantuk berlebihan ringan-sedang';
  return 'Normal';
}

// ────────────────────────────────────────────────────────────
// Kumpulkan
// ────────────────────────────────────────────────────────────

const essRows = new Map();
const mhRows = new Map();

for (const row of rows.slice(1)) {
  const text = String(row[COL.pemeriksaanLain] ?? '').trim();
  if (!text) continue;

  const tgl = parseExcelDate(row[COL.tglMcu]);
  const nik = String(row[COL.nik] ?? '').trim();
  if (!nik || !tgl) continue;

  const nikHash = hashField(nik);
  const nama = String(row[COL.nama] ?? '').trim();
  const jabatan = String(row[COL.jabatan] ?? '').trim();
  const site = String(row[COL.site] ?? '').trim();

  const base = {
    nik_karyawan_hash: nikHash,
    national_id_hash: hashField(nik),
    nama: nama ? encrypt(nama) : null,
    nama_terenkripsi: Boolean(nama),
    jabatan: jabatan || null,
    site: site || null,
  };

  const ess = extract(text, 'ESS');
  if (ess) {
    const key = `${nikHash}|${tgl}`;
    essRows.set(key, {
      ...base,
      tgl_ess: tgl,
      skor_ess: ess.score,
      jumlah_terisi: ess.score === null ? null : 8,
      kategori: essCategory(ess.score),
      interpretasi: essLabel(ess.score),
      catatan: `Migrasi dari Pemeriksaan Lain: ESS ${ess.raw}`,
    });
  }

  const srq = extract(text, 'SRQ[\\s-]?20');
  const dass = extract(text, 'DASS[\\s-]?21');
  if (srq || dass) {
    const key = `${nikHash}|${tgl}`;
    const parts = [];
    if (srq) parts.push(`SRQ-20 ${srq.score ?? srq.raw}`);
    if (dass) parts.push(`DASS-21 ${dass.score ?? dass.raw}`);

    mhRows.set(key, {
      ...base,
      tgl_pemeriksaan: tgl,
      psy_srq20: Boolean(srq),
      psy_dass21: Boolean(dass),
      skor_srq20: srq?.score ?? null,
      dass_tertinggi: dass?.raw ?? null,
      ringkasan_hasil: parts.join('; '),
      perlu_rujukan: (srq?.score ?? 0) >= 6,
      catatan: 'Migrasi dari Pemeriksaan Lain. Teks sumber hanya menyebut kategori, tidak-butir jawaban.',
    });
  }
}

console.log('=== Hasil penguraian Pemeriksaan Lain ===');
console.log(`ESS     : ${essRows.size} baris`);
console.log(`Mental  : ${mhRows.size} baris`);

const scores = [...essRows.values()].filter((r) => r.skor_ess !== null).map((r) => r.skor_ess);
console.log(`ESS dengan angka : ${scores.length} (nilai ${scores.sort((a, b) => a - b).join(', ')})`);
console.log(`ESS kategori saja: ${essRows.size - scores.length}`);

// ────────────────────────────────────────────────────────────
// Tulis ke database
// ────────────────────────────────────────────────────────────

if (!apply) {
  console.log('\nMode dry-run. Jalankan ulang dengan --apply untuk menulis ke database.');
  process.exit(0);
}

async function upsert(table, dateColumn, rowsList) {
  let written = 0;
  for (const row of rowsList) {
    const { data: existing } = await supabase
      .from(table)
      .select('id')
      .eq('nik_karyawan_hash', row.nik_karyawan_hash)
      .eq(dateColumn, row[dateColumn])
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase.from(table).update(row).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from(table).insert(row);
      if (error) throw error;
    }
    written += 1;
  }
  return written;
}

const essWritten = await upsert('mcu_ess', 'tgl_ess', [...essRows.values()]);
const mhWritten = await upsert('mcu_mental_health', 'tgl_pemeriksaan', [...mhRows.values()]);

console.log(`\nDitulis: ${essWritten} baris mcu_ess, ${mhWritten} baris mcu_mental_health.`);
console.log('Langkah berikutnya: jalankan ulang skrip penyegaran salinan agar zonasi MCU ikut terhitung.');