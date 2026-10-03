// ============================================================
// Post-processing: Baca hasil SQL, split ke batch kecil + generate CSV
// untuk bypass "Query is too large" Supabase SQL Editor
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
import { parseExcelDate } from './lib/excel-date.mjs';
import { encrypt, hashField } from './lib/encryption.mjs';
import { calculateRecord } from './lib/mcu-calc-bridge.mjs';
import { kanonik } from './lib/ecg-treadmill-canonical.mjs';

const __f = fileURLToPath(import.meta.url);
const __d = path.dirname(__f);
const ROOT = path.resolve(__d, '..');
dotenv.config({ path: path.join(ROOT, '.env.local'), override: false });

const EXCEL_PATH = 'C:/Users/bagon/Downloads/Record MCU 2026.xlsx';
const OUT_DIR = path.join(ROOT, 'scripts', 'mcu-import-batches');
const OUT_CSV = path.join(ROOT, 'scripts', 'mcu-import-bulk-upload.csv');
const OUT_CSV_MANIFEST = path.join(ROOT, 'scripts', 'mcu-import-instructions.txt');

const BATCH_SIZE = 50;
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Preflight: ENCRYPTION_KEY harus ada sebelum kerja apa pun, karena
// lib/encryption.mjs melempar exception (bukan process.exit) saat dipakai.
const encKey = process.env.ENCRYPTION_KEY || '';
if (encKey.length !== 64) {
  console.error('ENCRYPTION_KEY harus 64 karakter hex (32 byte) di .env.local. Import dibatalkan.');
  process.exit(1);
}

// ============================================================
// Enkripsi & hash: pakai modul yang sama dengan aplikasi
// (scripts/lib/encryption.mjs) agar hash NIK hasil import selalu
// cocok dengan pencarian NIK di aplikasi.
// ============================================================
function encryptMCURecord(r) {
  const o = { ...r };
  // Hash WAJIB dari plaintext (sebelum enkripsi) agar pencarian NIK di app ketemu.
  if (o.national_id) o.national_id_hash = hashField(String(o.national_id));
  if (o.nik_karyawan) o.nik_karyawan_hash = hashField(String(o.nik_karyawan));
  for (const f of ['national_id','nik_karyawan','nama','link_mcu']) if (o[f]) o[f] = encrypt(String(o[f]));
  return o;
}

/** NIK yang dipakai sebagai pengenal dedupe: NIK Karyawan, atau NIK KTP. */
function finalNationalId(dbRow) {
  return dbRow.nik_karyawan || dbRow.national_id || '';
}

// ============================================================
// MAPPING SAMA PERSIS DENGAN SCRIPT IMPORT #1
// ============================================================
const EXCEL_COL_TO_DB_COL = {
  B: 'national_id',
  C: 'nama',
  D: 'usia',
  E: 'jenis_kelamin',
  F: 'jabatan',
  G: 'site',
  H: 'status_mcu',
  I: 'tgl_mcu',
  J: 'tempat_mcu',
  K: 'gol_darah',
  L: 'gigi_mulut',
  M: 'fisik_head_to_toe',
  N: 'hemoroid',
  O: 'visus_jauh',
  P: 'visus_dekat',
  Q: 'def_warna',
  R: 'lapang_pandang',
  S: 'fisik_mata',
  T: 'merokok',
  U: 'td_s',
  V: 'td_d',
  W: 'nadi',
  X: 'bb',
  Y: 'tb',
  Z: 'bmi',
  AA: 'lp',
  AB: 'hb',
  AC: 'leukosit',
  AD: 'eritrosit',
  AE: 'hematokrit',
  AF: 'trombosit',
  AG: 'mcv',
  AH: 'mch',
  AI: 'mchc',
  AJ: 'led',
  AK: 'chol',
  AL: 'tg',
  AM: 'hdl',
  AN: 'ldl',
  AO: 'gdp',
  AP: 'gd2pp',
  AQ: 'hba1c',
  AR: 'diabetes',
  AS: 'au',
  AT: 'ureum',
  AU: 'kreatinin',
  AV: 'egfr',
  AW: 'sgot',
  AX: 'sgpt',
  AY: 'ggt',
  AZ: 'alp',
  BA: 'billirubin',
  BB: 'ul',
  BC: 'hbsag',
  BD: 'anti_hbs',
  BE: 'vdrl',
  BF: 'tpha',
  BG: 'hiv',
  BH: 'drug_amp',
  BI: 'drug_meth',
  BJ: 'drug_morph',
  BK: 'drug_canna',
  BL: 'drug_coc',
  BM: 'drug_benz',
  BN: 'drug_caris',
  BO: 'alkohol',
  BP: 'psa',
  BQ: 'chest_xr',
  BR: 'lumbo_xr',
  BS: 'ecg_hasil',
  BT: 'tm_hasil',
  BU: 'usg',
  BV: 'fvc_pred',
  BW: 'fvc_act',
  BX: 'fvc_pct',
  BY: 'fev1_pred',
  BZ: 'fev1_act',
  CA: 'fev1_pct',
  CB: 'fev1_fvc_pred',
  CC: 'fev1_fvc_act',
  CD: 'fev1_fvc_pct',
  CE: 'spi_interp',
  CF: 'acr_500',
  CG: 'acr_1k',
  CH: 'acr_2k',
  CI: 'acr_3k',
  CJ: 'acr_4k',
  CK: 'acr_6k',
  CL: 'acr_8k',
  CM: 'acl_500',
  CN: 'acl_1k',
  CO: 'acl_2k',
  CP: 'acl_3k',
  CQ: 'acl_4k',
  CR: 'acl_6k',
  CS: 'acl_8k',
  CT: 'aud_interp',
  CU: 'balance',
  CV: 'romberg',
  CW: 'phalen',
  CX: 'thinel',
  CY: 'patrick',
  CZ: 'kontra_patrick',
  DA: 'laseque',
  DB: 'kernig',
  DC: 'tes_kebugaran',
  DD: 'pemeriksaan_lain',
  DE: 'dugaan_pak',
  DF: 'kes_vendor',
  DG: 'rek_qshe',
  DH: 'diagnosa_medis',
  DI: 'perlu_fu',
  DJ: 'rek_fu',
  DK: 'item_fu',
  DL: 'link_mcu',
  DM: 'tgl_expired',
  DN: 'fram_score',
  DO: 'fram_prob',
  DP: 'fram_kat',
  DQ: 'zonasi',
  DR: 'trigger_zona',
  DS: 'pengendalian',
  DT: 'tgl_fu1',
  DU: 'lokasi_fu1',
  DV: 'hasil_fu1',
  DW: 'kesimpulan_fu1',
  DX: 'link_fu1',
  DY: 'rek_fu2',
  DZ: 'tgl_fu2',
  EA: 'lokasi_fu2',
  EB: 'hasil_fu2',
  EC: 'kesimpulan_fu2',
  ED: 'link_fu2',
  EE: 'rek_fu3',
  EF: 'tgl_fu3',
  EG: 'lokasi_fu3',
  EH: 'hasil_fu3',
  EI: 'kesimpulan_fu3',
  EJ: 'link_fu3',
  EK: 'rek_fu4',
  EL: 'catatan',
};

const RELEVANT_COL_COUNT = Object.keys(EXCEL_COL_TO_DB_COL).length;
function colIdx(letter) {
  let r = 0; for (const c of letter.toUpperCase()) r = r*26 + c.charCodeAt(0)-64;
  return r-1;
}

const EMPTY_SET = new Set([null, undefined, '', ' ', '-', '--', '---', '/', 'N/A', 'n/a', 'NA', 'TIDAK ADA', 'Tidak Ada', 'tidak ada']);
function isEmpty(v) {
  if (v == null) return true;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return true; if (EMPTY_SET.has(s)) return true;
    if (/^[.\s/_-]+$/.test(s)) return true;
  }
  if (typeof v === 'number' && isNaN(v)) return true;
  return false;
}
function cleanNum(v) {
  if (v == null) return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  let s = String(v).trim().replace(/,/g,'.').replace(/%/g,'');
  if (!s || EMPTY_SET.has(s)) return null;
  const n = parseFloat(s); return isNaN(n) ? null : n;
}
function cleanDate(v) {
  return parseExcelDate(v);
}
const NUMERIC = new Set([
  'usia','td_s','td_d','nadi','bb','tb','bmi','lp','hb','leukosit','eritrosit',
  'hematokrit','trombosit','mcv','mch','mchc','led','chol','tg','hdl','ldl','gdp','gd2pp','hba1c',
  'au','ureum','kreatinin','egfr','sgot','sgpt','ggt','alp','billirubin','psa',
  'fvc_pred','fvc_act','fvc_pct','fev1_pred','fev1_act','fev1_pct',
  'fev1_fvc_pred','fev1_fvc_act','fev1_fvc_pct',
  'acr_500','acr_1k','acr_2k','acr_3k','acr_4k','acr_6k','acr_8k',
  'acl_500','acl_1k','acl_2k','acl_3k','acl_4k','acl_6k','acl_8k','fram_score',
  // Skor kuesioner dan PTA. Angka ini tidak ada di Excel sumber, jadi nilainya
  // selalu kosong saat import; tetap didaftarkan agar kolomnya dibuat dan
  // tidak tertimpa NULL oleh bulk import.
  'ess_score','srq20_score','dass_depresi','dass_cemas','dass_stres','sds_score','pta',
]);
// kuesioner_tgl ditulis ulang setelah import, bukan diambil dari Excel:
// column ini mencatat tanggal kuesioner yang dipakai sebagai salinan, dan
// nilainya hanya diketahui setelah mcu_ess / mcu_mental_health terisi.
const DATE = new Set(['tgl_mcu','tgl_expired','tgl_fu1','tgl_fu2','tgl_fu3','kuesioner_tgl']);

// ============================================================
// 1. Baca Excel dan bangun data array (1361 qualified) — ulang
//    karena kita butuh RAW values terstruktur per record untuk
//    menghasilkan BATCH SQL KECIL & CSV
// ============================================================
console.log('🔍 Membaca Excel...');
const wb = XLSX.read(fs.readFileSync(EXCEL_PATH), { type: 'buffer', cellDates: true });
const sheet = wb.SheetNames.find(n => /raw/i.test(n) && /data/i.test(n)) || wb.SheetNames[0];
const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: null, raw: false });
let headerIdx = 0;
for (let i = 0; i < Math.min(10, rawRows.length); i++) {
  const b = String(rawRows[i][1] ?? '').trim().toLowerCase();
  const c = String(rawRows[i][2] ?? '').trim().toLowerCase();
  if (b.includes('nik') || c.includes('nama')) { headerIdx = i; break; }
}
const dRows = rawRows.slice(headerIdx + 1);

console.log(`Proses ${dRows.length} baris...`);
const ALL_COLUMNS_ORDERED = [
  'id','created_at','updated_at',
  'national_id','nik_karyawan','nama','usia','jenis_kelamin','jabatan','site','status_mcu','tgl_mcu','tempat_mcu',
  'gol_darah','gigi_mulut','fisik_head_to_toe','hemoroid',
  'visus_jauh','visus_dekat','def_warna','lapang_pandang','fisik_mata',
  'merokok','td_s','td_d','nadi','bb','tb','bmi','lp',
  'hb','leukosit','eritrosit','hematokrit','trombosit','mcv','mch','mchc','led',
  'chol','tg','hdl','ldl','gdp','gd2pp','hba1c','diabetes','au','ureum','kreatinin','egfr','sgot','sgpt','ggt','alp','billirubin','ul',
  'hbsag','anti_hbs','vdrl','tpha','hiv',
  'drug_amp','drug_meth','drug_morph','drug_canna','drug_coc','drug_benz','drug_caris','alkohol','psa',
  'chest_xr','lumbo_xr','ecg_hasil','tm_hasil','usg',
  // Riwayat penyakit, LBP, dan skor kuesioner. Urutannya sama persis dengan
  // src/lib/mcu-fields.ts. Kolom-kolom ini WAJIB ada di daftar: CSV bulk import
  // mengosongkan setiap kolom yang tidak disebut di header, jadi kolom yang
  // hilang dari daftar ini akan ditimpa NULL saat import.
  'riwayat_epilepsi','riwayat_jantung','riwayat_stroke','riwayat_asma','riwayat_sleep_apnea','lbp',
  'ess_score','srq20_score','dass_depresi','dass_cemas','dass_stres','sds_score',
  'fvc_pred','fvc_act','fvc_pct','fev1_pred','fev1_act','fev1_pct','fev1_fvc_pred','fev1_fvc_act','fev1_fvc_pct','spi_interp',
  'acr_500','acr_1k','acr_2k','acr_3k','acr_4k','acr_6k','acr_8k','acl_500','acl_1k','acl_2k','acl_3k','acl_4k','acl_6k','acl_8k',
  'pta',
  'aud_interp',
  'balance','romberg','phalen','thinel','patrick','kontra_patrick','laseque','kernig',
  'tes_kebugaran','hasil_kebugaran','pemeriksaan_lain','dugaan_pak','kes_vendor','rek_qshe','diagnosa_medis','ringkasan_kuesioner','perlu_fu','rek_fu','item_fu','link_mcu',
  'tgl_expired','fram_score','fram_prob','fram_kat','zonasi','trigger_zona','pengendalian',
  'frekuensi_evaluasi','catatan_sop','kuesioner_tgl',
  'tgl_fu1','lokasi_fu1','hasil_fu1','kesimpulan_fu1','link_fu1','rek_fu2',
  'tgl_fu2','lokasi_fu2','hasil_fu2','kesimpulan_fu2','link_fu2','rek_fu3',
  'tgl_fu3','lokasi_fu3','hasil_fu3','kesimpulan_fu3','link_fu3','rek_fu4',
  'catatan','national_id_hash','nik_karyawan_hash',
];
const INSERT_COLS = ALL_COLUMNS_ORDERED.filter(c => !['id','created_at','updated_at'].includes(c));

// Hash insert position → buat mapping column: index
const COL_IDX = Object.fromEntries(INSERT_COLS.map((c,i) => [c, i]));

const records = [];
for (let i = 0; i < dRows.length; i++) {
  const row = dRows[i];
  if (!row || row.every(c => isEmpty(c))) continue;

  let filled = 0;
  for (const letter of Object.keys(EXCEL_COL_TO_DB_COL)) if (!isEmpty(row[colIdx(letter)])) filled++;
  if ((filled / RELEVANT_COL_COUNT) <= 0.5) continue;

  let dbRow = {};
  for (const [letter, dbCol] of Object.entries(EXCEL_COL_TO_DB_COL)) {
    const idx = colIdx(letter);
    const val = row[idx];
    if (NUMERIC.has(dbCol)) { const n = cleanNum(val); if (n !== null) dbRow[dbCol] = n; }
    else if (DATE.has(dbCol)) { const d = cleanDate(val); if (d) dbRow[dbCol] = d; }
    else if (!isEmpty(val)) dbRow[dbCol] = String(val).trim();
  }
  if (!dbRow.nik_karyawan && dbRow.national_id) dbRow.nik_karyawan = dbRow.national_id;

  // Rumus dihitung oleh engine aplikasi (src/lib/mcu-calculations.ts) agar
  // hasil import sama persis dengan yang dipakai aplikasi, bukan rumus lama Excel.
  // Data mentah (belum dihitung) ikut disimpan karena dedupe di bawah perlu
  // menggabungkan kolom sebelum kolom turunan dihitung ulang.
  records.push({ raw: dbRow, excelRow: i + 2, filled, key: `${hashField(String(finalNationalId(dbRow))) || ''}|${dbRow.tgl_mcu || ''}` });
}

console.log(`✅ Total records lolos: ${records.length}`);

// ============================================================
// 1b. DEDUPE: NIK + tgl_mcu yang sama = duplikat input Excel.
//
//     Baris paling lengkap menjadi dasar, tetapi kolom yang masih kosong
//     pada baris itu diisi dari baris yang kalah. "Paling lengkap" hanya
//     menghitung jumlah kolom terisi, sehingga baris yang kalah bisa saja
//     menyimpan satu hasil lab yang tidak tercatat di baris dasar.
//     Membuang seluruh baris tanpa memeriksa isinya berarti kehilangan data
//     klinis tanpa jejak.
//
//     NIK sama tapi tgl_mcu berbeda = 2 record sah, keduanya dipertahankan
//     (view monitor_mcu sudah ambil tgl_mcu terbaru via record_rank=1).
// ============================================================
const byKey = new Map();
const dropped = [];
for (const rec of records) {
  const prev = byKey.get(rec.key);
  if (!prev) { byKey.set(rec.key, rec); continue; }

  const [winner, loser] = rec.filled > prev.filled ? [rec, prev] : [prev, rec];
  const recovered = [];
  for (const [col, val] of Object.entries(loser.raw)) {
    if (isEmpty(winner.raw[col]) && !isEmpty(val)) {
      winner.raw[col] = val;
      recovered.push(col);
    }
  }
  byKey.set(rec.key, winner);
  dropped.push({
    excelRow: loser.excelRow,
    filled: loser.filled,
    winner: `excel#${winner.excelRow}`,
    recovered,
  });
}
if (dropped.length) {
  console.log(`\n♻️  Dedupe: ${dropped.length} baris duplikat (NIK + tgl_mcu sama) digabung ke baris teratas.`);
  for (const d of dropped.slice(0, 10)) {
    console.log(`   excel#${d.excelRow} digabung ke ${d.winner}` +
      (d.recovered.length ? ` — ${d.recovered.length} kolom dipulihkan: ${d.recovered.join(', ')}` : ' — tidak ada kolom yang perlu dipulihkan'));
  }
  if (dropped.length > 10) console.log(`   ... +${dropped.length - 10} baris lain`);
  fs.writeFileSync(
    path.join(ROOT, 'scripts', 'mcu-import-duplicates.txt'),
    [
      'DUPLIKAT DIGABUNG (NIK + Tanggal MCU sama)',
      `Total: ${dropped.length} baris`,
      '',
      'Setiap baris di bawah digabung ke baris yang dipertahankan. Kolom yang',
      'dipulihkan berisi nilai yang HANYA ada di baris yang kalah — nilai',
      'tersebut tidak ikut masuk ke file CSV, jadi tidak bisa dilihat kembali',
      'setelah diimpor. Tinjau daftar ini bila hasil import terasa kurang lengkap.',
      '',
      ...dropped.flatMap((d, i) => [
        `${i + 1}. excel baris #${d.excelRow} (${d.filled} kolom terisi) → dipertahankan ${d.winner}`,
        ...(d.recovered.length ? [`   dipulihkan (${d.recovered.length}): ${d.recovered.join(', ')}`] : ['   tidak ada kolom yang perlu dipulihkan']),
      ]),
    ].join('\n'),
    'utf8',
  );
  console.log(`   → scripts/mcu-import-duplicates.txt`);
}

// Kolom turunan (zonasi, diagnosa_medis, item_fu, fram_*) dihitung SETELAH
// dedupe, karena gabungan kolom di atas bisa mengubah nilai acunya.
//
// EKG dan treadmill diseragamkan lebih dulu. Excel sumber ditulis bebas
// dan penuh salah eja ("Sinus Bradicardia", "Synus Rythm"), yang
// tidak ada di dropdown MCU dan tidak bisa diklasifikasi dengan andal.
// Pemetaan dilakukan sebelum calculateRecord supaya diagnosa_medis di
// CSV memakai nilai yang sama dengan yang dipakai aplikasi.
for (const record of byKey.values()) {
  record.raw.ecg_hasil = kanonik('ecg_hasil', record.raw.ecg_hasil);
  record.raw.tm_hasil = kanonik('tm_hasil', record.raw.tm_hasil);
}

const finalRecords = [...byKey.values()].map((r) => encryptMCURecord(calculateRecord(r.raw)));
console.log(`✅ Total record final: ${finalRecords.length}`);

// NIK yang sama dengan tgl_mcu berbeda sengaja menghasilkan lebih dari satu
// record, jadi count(distinct national_id_hash) bisa lebih kecil dari total.
const expectedUniqueNik = new Set(finalRecords.map((r) => r.national_id_hash).filter(Boolean)).size;
if (expectedUniqueNik !== finalRecords.length) {
  console.log(`   → ${finalRecords.length - expectedUniqueNik} karyawan punya >1 MCU (tgl_mcu berbeda), keduanya dipertahankan`);
}

// ============================================================
// 2. GENERATE: BATCH SQL KECIL (per 50 baris)
// ============================================================
console.log('\n📝 Generate batch SQL (per 50 baris)...');
function sq(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return isNaN(v) ? 'NULL' : String(v);
  return `'${String(v).replace(/'/g, "''").replace(/\0/g, '')}'`;
}

// Hapus batch lama supaya tidak tertinggal file dari generate sebelumnya
for (const f of fs.readdirSync(OUT_DIR)) {
  if (/^batch-.*\.sql$/.test(f)) fs.unlinkSync(path.join(OUT_DIR, f));
}

// Prasyarat idempotensi. Tanpa constraint unik, `ON CONFLICT (a, b)` tidak punya
// indeks yang uniquenya dan PostgreSQL menolaknya. Jalankan sekali sebelum
// batch manapun. Idempoten: kalau constraint sudah ada, tidak terjadi apa-apa.
fs.writeFileSync(
  path.join(OUT_DIR, 'batch-00-prasyarat.sql'),
  `-- Jalankan file ini SATU KALI sebelum batch-01.
--
-- LANGKAH 1 — WAJIB. Terapkan migrasi STD-006 lebih dulu. File ini menambah 17
-- kolom baru ke mcu_records (riwayat penyakit, LBP, skor kuesioner, PTA,
-- ringkasan, catatan SOP). Tanpa itu, seluruh INSERT di bawah gagal dengan
-- pesan "column does not exist".
--
--   Supabase Dashboard → SQL Editor → New Query
--   Buka file: supabase/migrations/2026-10-02_std006_ptm_ess_mental_health.sql
--   Tempel seluruh isinya → RUN
--
-- LANGKAH 2 — file ini. Menambahkan constraint unik agar batch SQL bisa
-- dijalankan ulang tanpa menyalin data (ON CONFLICT butuh target constraint
-- yang ada).
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mcu_records_nik_tgl_uniq'
  ) THEN
    -- Bersihkan duplikat lama lebih dulu: constraint tidak bisa dibuat
    -- selama masih ada pasangan (nik_karyawan_hash, tgl_mcu) yang sama.
    DELETE FROM public.mcu_records a
    USING public.mcu_records b
    WHERE a.nik_karyawan_hash = b.nik_karyawan_hash
      AND a.tgl_mcu IS NOT DISTINCT FROM b.tgl_mcu
      AND a.id > b.id;

    ALTER TABLE public.mcu_records
      ADD CONSTRAINT mcu_records_nik_tgl_uniq UNIQUE (nik_karyawan_hash, tgl_mcu);
    RAISE NOTICE 'Constraint mcu_records_nik_tgl_uniq dibuat.';
  ELSE
    RAISE NOTICE 'Constraint mcu_records_nik_tgl_uniq sudah ada, dilewati.';
  END IF;
END $$;

COMMIT;
`,
  'utf8',
);

const totalBatches = Math.ceil(finalRecords.length / BATCH_SIZE);
for (let b = 0; b < totalBatches; b++) {
  const start = b * BATCH_SIZE;
  const end = Math.min(finalRecords.length, start + BATCH_SIZE);
  const slice = finalRecords.slice(start, end);
  const head = `-- ============================================================
-- Batch ${b+1} / ${totalBatches} — Record MCU ${start+1} s/d ${end} (total ${finalRecords.length})
-- Generated : ${new Date().toISOString()}
-- Paste ke SQL Editor Supabase — klik RUN — lanjut ke batch berikutnya
-- ============================================================

BEGIN;

SET client_min_messages = WARNING;

INSERT INTO public.mcu_records (
  ${INSERT_COLS.join(',\n  ')}
) VALUES
`;
  const rows = slice.map(rec =>
    `  (${INSERT_COLS.map(c => sq(rec[c])).join(', ')})`
  ).join(',\n');
  const tail = `

ON CONFLICT (nik_karyawan_hash, tgl_mcu) DO UPDATE SET
  ${INSERT_COLS
    .filter((c) => c !== 'id' && c !== 'created_at' && c !== 'nik_karyawan_hash' && c !== 'tgl_mcu')
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(',\n  ')};

COMMIT;
`;
  const fname = `batch-${String(b+1).padStart(2, '0')}-of-${totalBatches}.sql`;
  fs.writeFileSync(path.join(OUT_DIR, fname), head + rows + tail, 'utf8');
}
console.log(`   ✔ ${totalBatches} file batch SQL disimpan di folder scripts/mcu-import-batches/`);

// ============================================================
// 3. GENERATE: SATU CSV LENGKAP untuk Import CSV
//
// PENTING: kolom id / created_at / updated_at TIDAK boleh ikut.
// Supabase CSV import mengirim string kosong ke kolom uuid/timestamptz
// → SQLSTATE 22P02 (invalid input syntax). Biarkan DEFAULT yang berlaku.
// ============================================================
console.log('📝 Generate CSV bulk upload (semua 1 record = 1 baris)...');

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
const csvLines = [];
csvLines.push(INSERT_COLS.join(','));
for (const rec of finalRecords) {
  // id / created_at / updated_at tidak disertakan → DEFAULT / gen_random_uuid() berlaku
  csvLines.push(INSERT_COLS.map(col => csvEscape(rec[col])).join(','));
}
fs.writeFileSync(OUT_CSV, csvLines.join('\n'), 'utf8');
console.log(`   ✔ CSV file tersimpan: ${path.basename(OUT_CSV)} (${csvLines.length-1} baris data, ${(fs.statSync(OUT_CSV).size/1024/1024).toFixed(2)} MB)`);

// ============================================================
// 4. INSTRUKSI PENGGUNAAN (TXT)
// ============================================================
console.log('📝 Generate instruksi...');
const instr = `============================================================
   CARA IMPORT RECORD MCU KE SUPABASE (PILIH SALAH SATU OPSI)
   Hasil generate — ${new Date().toISOString().slice(0,10)}
============================================================

📦 File yang dihasilkan:
   • Total data masuk: ${finalRecords.length} baris
   • Duplikat dibuang : ${dropped.length} baris (NIK + Tanggal MCU sama → lihat mcu-import-duplicates.txt)
   • Total batch SQL : ${totalBatches} (folder scripts/mcu-import-batches/)
   • File CSV        : scripts/mcu-import-bulk-upload.csv

═══════════════════════════════════════════════════════════════
 🏆 OPSI A — IMPORT CSV (PALING MUDAH & CEPAT — REKOMENDASI)
    Supabase TIDAK ada batas ukuran untuk import via Table Editor
═══════════════════════════════════════════════════════════════
 1. Buka Supabase Dashboard → Table Editor → cari tabel mcu_records
    (public.mcu_records)
 2. Klik tombol ➕ Insert → lalu pilih menu **"Import data from CSV"**
    (terletak di sebelah kanan panel, kadang ada icon file)
 3. Pilih file → browse ke:
      ${path.relative(ROOT, OUT_CSV)}
    (ukuran file cuma ~${(fs.statSync(OUT_CSV).size/1024/1024).toFixed(2)} MB — sangat cepat)
 4. Klik tombol **"Import"** → tunggu progress bar selesai
 5. Setelah selesai: VERIFIKASI
    SELECT count(*) as total, count(distinct nik_karyawan_hash) as unik
    FROM public.mcu_records;

═══════════════════════════════════════════════════════════════
 ⚙️  OPSI B — JALANKAN BATCH SQL SATU PER SATU
    (Gunakan jika CSV import tidak bekerja, atau ingin
     transactional per 50 baris — rollback friendly)
═══════════════════════════════════════════════════════════════
List file (urut):
    00. scripts/mcu-import-batches/batch-00-prasyarat.sql   ← WAJIB, jalankan pertama
${Array.from({length: totalBatches}, (_, b) => `   ${String(b+1).padStart(2,'0')}. scripts/mcu-import-batches/batch-${String(b+1).padStart(2,'0')}-of-${totalBatches}.sql`).join('\n')}

 Cara:
    1. Jalankan supabase/migrations/2026-10-02_std006_ptm_ess_mental_health.sql
       DULU. Migrasi itu menambah 17 kolom baru ke mcu_records. Tanpa migrasi
       ini semua INSERT akan gagal dengan "column does not exist".
    2. Jalankan batch-00-prasyarat.sql. File ini menambah constraint unik
       (nik_karyawan_hash, tgl_mcu) supaya batch aman dijalankan ulang tanpa
       menyalin data. Tanpa ini, setiap batch yang dijalankan dua kali akan
       memasukkan 50 baris kembar.
    3. Buka SQL Editor → New Query
    4. Buka file → paste content batch-01 → RUN
    5. Tunggu sampai selesai (success)
    6. Lanjut batch-02 → RUN → ulangi sampai selesai semua ${totalBatches} batch

 Setiap batch = 50 records, tidak akan melebihi limit SQL Editor Supabase.

═══════════════════════════════════════════════════════════════
 ⚠️  SETELAH IMPORT SELESAI (A / B)
═══════════════════════════════════════════════════════════════
  Jalankan QUERY INI untuk memverifikasi hasil import.
  Kolom kalkulasi (diagnosa_medis, item_fu, zonasi, fram_*)
  sudah dihitung oleh engine aplikasi yang SAMA dengan
  src/lib/mcu-calculations.ts, jadi tidak perlu re-calculate manual.

  SELECT count(*)                                  AS total,
         count(DISTINCT national_id_hash)          AS unik,
         count(zonasi)                             AS ada_zonasi,
         count(diagnosa_medis)                     AS ada_diagnosa,
         count(*) FILTER (WHERE hasil_fu1 IS NOT NULL) AS ada_fu1
  FROM public.mcu_records;

  Harap: total = ${finalRecords.length}, unik = ${expectedUniqueNik}.
  (unik boleh < total: ${finalRecords.length - expectedUniqueNik} karyawan punya 2 MCU di tanggal berbeda.)

============================================================
 SEMUA HASH MENGGUNAKAN ENCRYPTION_KEY LIVE DARI .env.local
 — IDENTIK dengan aplikasi — PENCARIAN NIK PASTI KETEMU ✅
============================================================
`;
fs.writeFileSync(OUT_CSV_MANIFEST, instr, 'utf8');

console.log(`\n================================================
  📦 OUTPUT READY
================================================

  🏆 OPSI A - CSV Import (REKOMENDASI PALING MUDAH)
     → ${path.relative(ROOT, OUT_CSV)}

  ⚙️  OPSI B - ${totalBatches} SQL Batch (per 50 baris):
     → ${path.relative(ROOT, OUT_DIR)}

  📘 Instruksi detail:
     → ${path.relative(ROOT, OUT_CSV_MANIFEST)}
`);
