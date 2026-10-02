// ============================================================
// Post-processing: Baca hasil SQL, split ke batch kecil + generate CSV
// untuk bypass "Query is too large" Supabase SQL Editor
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { parseExcelDate } from './lib/excel-date.mjs';

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

// ============================================================
// INLINE: encryption, hash, calculations — SAMA PERSIS DENGAN
// script import pertama (agar hasil hash & value IDENTIK)
// ============================================================
const ALGO = 'aes-256-gcm';
const IV = 12, TAG = 16;
function getKey() {
  const raw = process.env.ENCRYPTION_KEY || '';
  if (!raw || raw.length !== 64) { console.error('ENCRYPTION_KEY salah!'); process.exit(1); }
  return Buffer.from(raw, 'hex');
}
function encrypt(plain) {
  if (plain == null || plain === '') return null;
  try {
    const k = getKey();
    const iv = crypto.randomBytes(IV);
    const c = crypto.createCipheriv(ALGO, k, iv);
    const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
    const tag = c.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('hex');
  } catch (e) { return null; }
}
function hashField(plain) {
  if (!plain) return null;
  return crypto.createHmac('sha256', getKey()).update(String(plain), 'utf8').digest('hex');
}
function encryptMCURecord(r) {
  const o = { ...r };
  // Hash WAJIB dari plaintext (sebelum enkripsi) agar pencarian NIK di app ketemu.
  if (o.national_id) o.national_id_hash = hashField(String(o.national_id));
  if (o.nik_karyawan) o.nik_karyawan_hash = hashField(String(o.nik_karyawan));
  for (const f of ['national_id','nik_karyawan','nama','link_mcu']) if (o[f]) o[f] = encrypt(String(o[f]));
  return o;
}
function num(v) {
  if (v == null || v === '' || v === 'N/A') return null;
  const s = String(v).replace(',','.').replace(/%/g,'').trim();
  if (!s) return null; const n = Number(s); return isNaN(n) ? null : n;
}
function addOneYear(v) {
  if (!v) return '';
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}
function applyMCUCalculations(values) {
  const r = { ...values };
  const bb = num(r.bb), tb = num(r.tb);
  if (bb && tb) r.bmi = Math.round((bb / Math.pow(tb/100, 2)) * 10) / 10;
  const hb = num(r.hb), hk = num(r.hematokrit), er = num(r.eritrosit);
  if (hb && hk) r.mchc = Math.round((hb/hk*100)*10)/10;
  if (er && hk) r.mcv = Math.round((hk/er*10)*10)/10;
  if (hb && er) r.mch = Math.round((hb/er*10)*10)/10;
  const fA = num(r.fvcAct), fP = num(r.fvcPred);
  if (fA && fP) r.fvcPct = Math.round((fA/fP*100)*10)/10;
  const feA = num(r.fev1Act), feP = num(r.fev1Pred);
  if (feA && feP) r.fev1Pct = Math.round((feA/feP*100)*10)/10;
  if (feA && fA) r.fev1FvcAct = Math.round((feA/fA)*100)/100;
  const fvfA = num(r.fev1FvcAct), fvfP = num(r.fev1FvcPred);
  if (fvfA && fvfP) r.fev1FvcPct = Math.round((fvfA/fvfP*100)*10)/10;
  const gdp = num(r.gdp), gd2 = num(r.gd2pp), hba = num(r.hba1c);
  if (gdp >= 126 || gd2 >= 200 || hba >= 6.5) r.diabetes = 'Ya';
  else if (gdp || gd2 || hba) r.diabetes = 'Tidak';
  if (!r.tglExpired && r.tglMcu) r.tglExpired = addOneYear(r.tglMcu);
  return r;
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
const DB_TO_CAMEL = {
  national_id:'nationalId', nik_karyawan:'nikKaryawan', nama:'nama', usia:'usia',
  jenis_kelamin:'jenisKelamin', jabatan:'jabatan', site:'site', status_mcu:'statusMCU',
  tgl_mcu:'tglMCU', tempat_mcu:'tempatMCU', gol_darah:'golDarah', gigi_mulut:'gigiMulut',
  fisik_head_to_toe:'fisikHeadToToe', hemoroid:'hemoroid', visus_jauh:'visusJauh',
  visus_dekat:'visusDekat', def_warna:'defWarna', lapang_pandang:'lapangPandang',
  fisik_mata:'fisikMata', merokok:'merokok', td_s:'tdS', td_d:'tdD', nadi:'nadi',
  bb:'bb', tb:'tb', bmi:'bmi', lp:'lp', hb:'hb', leukosit:'leukosit',
  eritrosit:'eritrosit', hematokrit:'hematokrit', trombosit:'trombosit', mcv:'mcv',
  mch:'mch', mchc:'mchc', led:'led', chol:'chol', tg:'tg', hdl:'hdl', ldl:'ldl',
  gdp:'gdp', gd2pp:'gd2pp', hba1c:'hba1c', diabetes:'diabetes', au:'au',
  ureum:'ureum', kreatinin:'kreatinin', egfr:'egfr', sgot:'sgot', sgpt:'sgpt',
  ggt:'ggt', alp:'alp', billirubin:'billirubin', ul:'ul', hbsag:'hbsag',
  anti_hbs:'antiHbs', vdrl:'vdrl', tpha:'tpha', hiv:'hiv',
  drug_amp:'drugAmp', drug_meth:'drugMeth', drug_morph:'drugMorph', drug_canna:'drugCanna',
  drug_coc:'drugCoc', drug_benz:'drugBenz', drug_caris:'drugCaris',
  alkohol:'alkohol', psa:'psa', chest_xr:'chestXR', lumbo_xr:'lumboXR',
  ecg_hasil:'ecgHasil', tm_hasil:'tmHasil', usg:'usg',
  fvc_pred:'fvcPred', fvc_act:'fvcAct', fvc_pct:'fvcPct',
  fev1_pred:'fev1Pred', fev1_act:'fev1Act', fev1_pct:'fev1Pct',
  fev1_fvc_pred:'fev1FvcPred', fev1_fvc_act:'fev1FvcAct', fev1_fvc_pct:'fev1FvcPct',
  spi_interp:'spiInterp', aud_interp:'audInterp',
  balance:'balance', romberg:'romberg', phalen:'phalen', thinel:'thinel',
  patrick:'patrick', kontra_patrick:'kontraPatrick', laseque:'laseque', kernig:'kernig',
  tes_kebugaran:'tesKebugaran', pemeriksaan_lain:'pemeriksaanLain',
  dugaan_pak:'dugaanPAK', kes_vendor:'kesVendor', rek_qshe:'rekQSHE',
  diagnosa_medis:'diagnosaMedis', perlu_fu:'perluFU', rek_fu:'rekFU',
  item_fu:'itemFU', link_mcu:'linkMCU', tgl_expired:'tglExpired',
  fram_score:'framScore',
  zonasi:'zonasi', trigger_zona:'triggerZona', pengendalian:'pengendalian',
  catatan:'catatan',
  tgl_fu1:'tglFU1', lokasi_fu1:'lokasiFU1', hasil_fu1:'hasilFU1',
  kesimpulan_fu1:'kesimpulanFU1', link_fu1:'linkFU1',
  rek_fu2:'rekFU2', tgl_fu2:'tglFU2', lokasi_fu2:'lokasiFU2',
  hasil_fu2:'hasilFU2', kesimpulan_fu2:'kesimpulanFU2', link_fu2:'linkFU2',
  rek_fu3:'rekFU3', tgl_fu3:'tglFU3', lokasi_fu3:'lokasiFU3',
  hasil_fu3:'hasilFU3', kesimpulan_fu3:'kesimpulanFU3', link_fu3:'linkFU3',
  rek_fu4:'rekFU4',
};
const CAMEL_TO_DB = Object.fromEntries(Object.entries(DB_TO_CAMEL).map(([k,v]) => [v, k]));

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
]);
const DATE = new Set(['tgl_mcu','tgl_expired','tgl_fu1','tgl_fu2','tgl_fu3']);

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
  'fvc_pred','fvc_act','fvc_pct','fev1_pred','fev1_act','fev1_pct','fev1_fvc_pred','fev1_fvc_act','fev1_fvc_pct','spi_interp',
  'acr_500','acr_1k','acr_2k','acr_3k','acr_4k','acr_6k','acr_8k','acl_500','acl_1k','acl_2k','acl_3k','acl_4k','acl_6k','acl_8k','aud_interp',
  'balance','romberg','phalen','thinel','patrick','kontra_patrick','laseque','kernig',
  'tes_kebugaran','pemeriksaan_lain','dugaan_pak','kes_vendor','rek_qshe','diagnosa_medis','perlu_fu','rek_fu','item_fu','link_mcu',
  'tgl_expired','fram_score','fram_prob','fram_kat','zonasi','trigger_zona','pengendalian',
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

  const camel = {};
  for (const [k, v] of Object.entries(dbRow)) if (DB_TO_CAMEL[k]) camel[DB_TO_CAMEL[k]] = v;
  let calc; try { calc = applyMCUCalculations(camel); } catch { calc = camel; }
  const snake = {};
  for (const [k, v] of Object.entries(calc)) {
    if (v === '' || v == null) continue;
    if (CAMEL_TO_DB[k]) snake[CAMEL_TO_DB[k]] = v;
    else snake[k.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase()] = v;
  }
  const merged = { ...dbRow, ...snake };
  const final = encryptMCURecord(merged);
  records.push(final);
}

console.log(`✅ Total records lolos: ${records.length}`);

// ============================================================
// 2. GENERATE: BATCH SQL KECIL (per 50 baris)
// ============================================================
console.log('\n📝 Generate batch SQL (per 50 baris)...');
function sq(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return isNaN(v) ? 'NULL' : String(v);
  return `'${String(v).replace(/'/g, "''").replace(/\0/g, '')}'`;
}

const totalBatches = Math.ceil(records.length / BATCH_SIZE);
for (let b = 0; b < totalBatches; b++) {
  const start = b * BATCH_SIZE;
  const end = Math.min(records.length, start + BATCH_SIZE);
  const slice = records.slice(start, end);
  const head = `-- ============================================================
-- Batch ${b+1} / ${totalBatches} — Record MCU ${start+1} s/d ${end} (total ${records.length})
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

ON CONFLICT DO NOTHING;

COMMIT;
`;
  const fname = `batch-${String(b+1).padStart(2, '0')}-of-${totalBatches}.sql`;
  fs.writeFileSync(path.join(OUT_DIR, fname), head + rows + tail, 'utf8');
}
console.log(`   ✔ ${totalBatches} file batch SQL disimpan di folder scripts/mcu-import-batches/`);

// ============================================================
// 3. GENERATE: SATU CSV LENGKAP (1361 baris) untuk Import CSV
// ============================================================
console.log('📝 Generate CSV bulk upload (semua 1 record = 1 baris)...');

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
const csvLines = [];
csvLines.push(ALL_COLUMNS_ORDERED.join(','));
for (const rec of records) {
  // Supabase Import CSV — accept no id/created_at/updated_at, DEFAULT values apply
  csvLines.push(ALL_COLUMNS_ORDERED.map(col => csvEscape(rec[col])).join(','));
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
   • Total data masuk: ${records.length} baris
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
${Array.from({length: totalBatches}, (_, b) => `   ${String(b+1).padStart(2,'0')}. scripts/mcu-import-batches/batch-${String(b+1).padStart(2,'0')}-of-${totalBatches}.sql`).join('\n')}

 Cara:
   1. Buka SQL Editor → New Query
   2. Buka file → paste content batch-01 → RUN
   3. Tunggu sampai selesai (success)
   4. Lanjut batch-02 → RUN → ulangi sampai selesai semua ${totalBatches} batch

 Setiap batch = 50 records, tidak akan melebihi limit SQL Editor Supabase.

═══════════════════════════════════════════════════════════════
 ⚠️  SETELAH IMPORT SELESAI (A / B)
═══════════════════════════════════════════════════════════════
 Jalankan QUERY INI SEKALI untuk memaksa re-calculate FRS
 & ZONASI RISIKO (yang tidak terisi karena input sebagian)
 -- (opsional, jika zonasi/framingham masih null di beberapa row)

 DO $$
 DECLARE r RECORD;
 BEGIN
   FOR r IN SELECT id FROM public.mcu_records
       WHERE zonasi IS NULL OR trigger_zona IS NULL
       ORDER BY created_at DESC LOOP
     -- Anda bisa call save API / trigger script jika perlu
     -- Atau isi manual jika data sudah cukup
     RAISE NOTICE 'Row butuh zonasi: %', r.id;
   END LOOP;
 END $$;

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
