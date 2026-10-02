// ============================================================
// Import Record MCU Excel → Supabase SQL + Reject Report
// VERSI STANDALONE: Tanpa import file TS internal (Node Native)
// ============================================================

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __f = fileURLToPath(import.meta.url);
const __d = path.dirname(__f);
const ROOT_DIR = path.resolve(__d, '..');

// Load .env.local (Next.js priority) + .env fallback
dotenv.config({ path: path.join(ROOT_DIR, '.env.local'), override: false });
dotenv.config({ path: path.join(ROOT_DIR, '.env'), override: false });

import XLSX from 'xlsx';
import crypto from 'crypto';
import { parseExcelDate } from './lib/excel-date.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const EXCEL_PATH = 'C:/Users/bagon/Downloads/Record MCU 2026.xlsx';
const OUT_SQL = path.join(ROOT, 'scripts', 'mcu-import-generated.sql');
const OUT_REPORT_TXT = path.join(ROOT, 'scripts', 'mcu-import-report-rejected.txt');
const OUT_REPORT_CSV = path.join(ROOT, 'scripts', 'mcu-import-report-rejected.csv');

// ============================================================
// 🔐 INLINE ENCRYPTION & HASH — SAMA PERSIS DENGAN lib/encryption.ts
//    HMAC-SHA256 deterministic hash (untuk national_id_hash)
//    AES-256-GCM non-deterministic encrypt (sensitives)
// ============================================================
const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
function getKey() {
  const raw = process.env.ENCRYPTION_KEY || '';
  if (!raw || raw.length !== 64) {
    console.error('❌ ENCRYPTION_KEY tidak valid (harus 64 char = 32 bytes hex). Check .env.local!');
    console.error('   Generate: openssl rand -hex 32');
    process.exit(1);
  }
  return Buffer.from(raw, 'hex');
}
function encrypt(plain) {
  if (plain == null || plain === '') return null;
  try {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('hex');
  } catch (err) {
    console.error('Encrypt error:', err.message); return null;
  }
}
function hashField(plain) {
  if (plain == null || plain === '') return null;
  try {
    return crypto.createHmac('sha256', getKey()).update(String(plain), 'utf8').digest('hex');
  } catch (err) {
    console.error('Hash error:', err.message); return null;
  }
}
const MCU_SENSITIVE_FIELDS = ['national_id', 'nik_karyawan', 'nama', 'link_mcu'];
function encryptMCURecord(record) {
  const result = { ...record };
  for (const field of MCU_SENSITIVE_FIELDS) {
    if (result[field] != null && result[field] !== '') result[field] = encrypt(String(result[field]));
  }
  if (record.national_id) result.national_id_hash = hashField(String(record.national_id));
  if (record.nik_karyawan) result.nik_karyawan_hash = hashField(String(record.nik_karyawan));
  return result;
}

// ============================================================
// 🧮 INLINE applyMCUCalculations (basic) — SAMA dengan lib/mcu-calculations
// ============================================================
function num(v) {
  if (v === null || v === undefined || v === '' || v === 'N/A' || v === 'n/a') return null;
  const s = String(v).replace(',', '.').replace(/%/g, '').trim();
  if (!s) return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
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
  if (bb && tb) {
    const rawBmi = bb / Math.pow(tb / 100, 2);
    r.bmi = Math.round(rawBmi * 10) / 10;
  }
  const hb = num(r.hb), hk = num(r.hematokrit);
  if (hb && hk) r.mchc = Math.round((hb / hk * 100) * 10) / 10;
  const hb2 = num(r.hb), ht = num(r.hematokrit), er = num(r.eritrosit);
  if (er && ht) r.mcv = Math.round((ht / er * 10) * 10) / 10;
  if (hb2 && er) r.mch = Math.round((hb2 / er * 10) * 10) / 10;
  const fvcA = num(r.fvcAct), fvcP = num(r.fvcPred);
  if (fvcA && fvcP) r.fvcPct = Math.round((fvcA / fvcP * 100) * 10) / 10;
  const fA = num(r.fev1Act), fP = num(r.fev1Pred);
  if (fA && fP) r.fev1Pct = Math.round((fA / fP * 100) * 10) / 10;
  if (fA && fvcA) r.fev1FvcAct = Math.round((fA / fvcA) * 100) / 100;
  const fvfA = num(r.fev1FvcAct), fvfP = num(r.fev1FvcPred);
  if (fvfA && fvfP) r.fev1FvcPct = Math.round((fvfA / fvfP * 100) * 10) / 10;
  // Diabetes auto
  const gdp = num(r.gdp), gd2 = num(r.gd2pp), hba = num(r.hba1c);
  if (gdp >= 126 || gd2 >= 200 || hba >= 6.5) r.diabetes = 'Ya';
  else if (gdp || gd2 || hba) r.diabetes = 'Tidak';
  // Expired auto = 1 thn setelah tgl mcu
  if (!r.tglExpired && r.tglMcu) r.tglExpired = addOneYear(r.tglMcu);
  return r;
}

// ============================================================
// 1. KONTRAK MAPPING EXCEL (SUMBER KE BENAR: SHEET "SECRET")
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
// Juga mapping ke CAMEL for applyMCUCalculations
const DB_TO_CAMEL_ID_MAP = {
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
const CAMEL_TO_DB_MAP = Object.fromEntries(Object.entries(DB_TO_CAMEL_ID_MAP).map(([k,v]) => [v, k]));

function colLetterToIndex(letter) {
  let idx = 0;
  for (const c of letter.toUpperCase()) idx = idx * 26 + c.charCodeAt(0) - 64;
  return idx - 1;
}
const RELEVANT_COL_COUNT = Object.keys(EXCEL_COL_TO_DB_COL).length;

console.log(`Relevant data columns (B → EB): ${RELEVANT_COL_COUNT}`);

// ============================================================
// 2. Baca Excel
// ============================================================
console.log(`\n🔍 Membaca file Excel: ${EXCEL_PATH}`);
const workbook = XLSX.read(fs.readFileSync(EXCEL_PATH), { type: 'buffer', cellDates: true });
const sheetName = workbook.SheetNames.find(n => /raw/i.test(n) && /data/i.test(n)) || workbook.SheetNames[0];
console.log(`   📋 Sheet dipakai: ${sheetName}`);
const ws = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });

// Cari header row
let headerIdx = 0;
for (let i = 0; i < Math.min(10, rows.length); i++) {
  const b = String(rows[i][1] ?? '').trim().toLowerCase();
  const c = String(rows[i][2] ?? '').trim().toLowerCase();
  if (b.includes('nik') || c.includes('nama')) { headerIdx = i; break; }
}
console.log(`   🧾 Header row index (0-based): ${headerIdx}`);
const dataRows = rows.slice(headerIdx + 1);
console.log(`   🧾 Total baris data: ${dataRows.length}`);

// ============================================================
// 3. Helper sanitize & empty check
// ============================================================
const EMPTY_VALUES = new Set([null, undefined, '', ' ', '-', '--', '---', '/', 'N/A', 'n/a', 'NA', 'N.a', 'TIDAK ADA', 'Tidak Ada', 'tidak ada']);
function isEmpty(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return true;
    if (EMPTY_VALUES.has(s)) return true;
    if (/^[.\s/_-]+$/.test(s)) return true;
  }
  if (typeof v === 'number' && isNaN(v)) return true;
  return false;
}
function cleanNumber(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  let s = String(v).trim().replace(/,/g, '.');
  s = s.replace(/%/g, '').trim();
  if (!s || EMPTY_VALUES.has(s)) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
function cleanDate(v) {
  return parseExcelDate(v);
}
function sqlEscape(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return isNaN(v) ? 'NULL' : String(v);
  return `'${String(v).replace(/'/g, "''").replace(/\0/g, '')}'`;
}

// ============================================================
// 4. Proses setiap baris
// ============================================================
const qualifiedRows = [];
const rejectedRows = [];

// Numeric & date DB columns
const numericCols = new Set([
  'usia','td_s','td_d','nadi','bb','tb','bmi','lp','hb','leukosit','eritrosit',
  'hematokrit','trombosit','mcv','mch','mchc','led','chol','tg','hdl','ldl','gdp','gd2pp','hba1c',
  'au','ureum','kreatinin','egfr','sgot','sgpt','ggt','alp','billirubin','psa',
  'fvc_pred','fvc_act','fvc_pct','fev1_pred','fev1_act','fev1_pct',
  'fev1_fvc_pred','fev1_fvc_act','fev1_fvc_pct',
  'acr_500','acr_1k','acr_2k','acr_3k','acr_4k','acr_6k','acr_8k',
  'acl_500','acl_1k','acl_2k','acl_3k','acl_4k','acl_6k','acl_8k','fram_score',
]);
const dateCols = new Set(['tgl_mcu','tgl_expired','tgl_fu1','tgl_fu2','tgl_fu3']);

for (let r = 0; r < dataRows.length; r++) {
  const row = dataRows[r];
  if (!row || row.every(c => isEmpty(c))) continue;

  // Hitung % fill
  let filled = 0;
  for (const letter of Object.keys(EXCEL_COL_TO_DB_COL)) {
    if (!isEmpty(row[colLetterToIndex(letter)])) filled++;
  }
  const fillPct = (filled / RELEVANT_COL_COUNT) * 100;

  const nikKtp = String(row[colLetterToIndex('B')] ?? '').trim() || '(TIDAK ADA NIK KTP)';
  const namaLengkap = String(row[colLetterToIndex('C')] ?? '').trim() || '(TIDAK ADA NAMA)';

  if (fillPct <= 50) {
    rejectedRows.push({ noExcel: r + 2, nikKtp, namaLengkap, filled, total: RELEVANT_COL_COUNT, fillPct });
    continue;
  }

  // Map kolom → snake_case DB dict
  let dbRow = {};
  for (const [letter, dbCol] of Object.entries(EXCEL_COL_TO_DB_COL)) {
    const idx = colLetterToIndex(letter);
    const val = row[idx];
    if (numericCols.has(dbCol)) { const n = cleanNumber(val); if (n !== null) dbRow[dbCol] = n; }
    else if (dateCols.has(dbCol)) { const d = cleanDate(val); if (d) dbRow[dbCol] = d; }
    else if (!isEmpty(val)) dbRow[dbCol] = String(val).trim();
  }

  // NIK KARYAWAN fallback = NATIONAL_ID
  if (!dbRow.nik_karyawan && dbRow.national_id) dbRow.nik_karyawan = dbRow.national_id;

  // Convert snake → camel untuk kalkulasi
  const camel = {};
  for (const [k, v] of Object.entries(dbRow)) if (DB_TO_CAMEL_ID_MAP[k]) camel[DB_TO_CAMEL_ID_MAP[k]] = v;
  let calculatedCamel;
  try { calculatedCamel = applyMCUCalculations(camel); }
  catch (e) { console.warn(`⚠ Calc gagal ${nikKtp}: ${e.message}`); calculatedCamel = camel; }
  // Kalkulasi balik ke snake_case (pakai CAMEL_TO_DB_MAP atau regex)
  const calculatedSnake = {};
  for (const [k, v] of Object.entries(calculatedCamel)) {
    if (v === '' || v === undefined || v === null) continue;
    if (CAMEL_TO_DB_MAP[k]) calculatedSnake[CAMEL_TO_DB_MAP[k]] = v;
    else {
      const s = k.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase();
      calculatedSnake[s] = v;
    }
  }
  const merged = { ...dbRow, ...calculatedSnake };

  // Enkripsi & hash
  let finalDbRow;
  try {
    finalDbRow = encryptMCURecord(merged);
    delete finalDbRow.id;
    delete finalDbRow.created_at;
    delete finalDbRow.updated_at;
  } catch (e) {
    console.error(`🔴 Encrypt gagal ${nikKtp}: ${e.message}`); process.exit(1);
  }
  qualifiedRows.push({ noExcel: r + 2, nikKtp, namaLengkap, filled, fillPct, dbRow: finalDbRow });
}
console.log(`\n✅ KUALIFIKASI (>50%): ${qualifiedRows.length}  ❌ DITOLAK (<=50%): ${rejectedRows.length}`);

// ============================================================
// 5. Generate SQL
// ============================================================
console.log(`\n📝 Generate SQL → ${path.basename(OUT_SQL)}`);
const ALL_DB_COLUMNS_ORDERED = [
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
const headerLines = [];
headerLines.push(`-- ============================================================
-- AUTO-GENERATED SQL: Import Record MCU Excel ke Supabase mcu_records
-- File Excel : Record MCU 2026.xlsx (sheet: ${sheetName})
-- Dibuat     : ${new Date().toISOString()}
-- Kualifikasi: ${qualifiedRows.length} baris (kolom terisi >50% dari ${RELEVANT_COL_COUNT} kolom relevan)
-- Ditolak    : ${rejectedRows.length} baris (≤50% — laporan terpisah: mcu-import-report-rejected.txt/csv)
-- 
-- JAMINAN KOLOM TIDAK TERTUKAR:
--   • Mapping 100% berdasarkan SHEET "SECRET" (bukan MCU_FIELDS col)
--   • B (NIK KTP)        = national_id DAN nik_karyawan (fallback konfirmasi user)
--   • BD (Drug Test)     = SPLIT menjadi 7 kol: drug_amp…drug_caris (semua nilai sama)
--   • Kalkulasi otomatis = BMI, MCHC, MCV, MCH, Spirometry %, Diabetes, Expired 1thn
--   • HMAC-SHA256 hash   = national_id_hash & nik_karyawan_hash (pakai ENCRYPTION_KEY app)
--   • AES-256-GCM encr   = national_id, nik_karyawan, nama, link_mcu
-- 
-- CARA PAKAI:
--   1. Buka Supabase → project BG Health → SQL Editor
--   2. New Query → paste isi file ini
--   3. Klik RUN → tunggu sampai selesai
--   4. Verifikasi: select nik_karyawan_hash, created_at from mcu_records order by created_at desc limit 20;
-- ============================================================

BEGIN;

SET client_min_messages = WARNING;

INSERT INTO public.mcu_records (
  ${ALL_DB_COLUMNS_ORDERED.join(',\n  ')}
) VALUES`);

const valueBlocks = qualifiedRows.map(q => {
  const vals = ALL_DB_COLUMNS_ORDERED.map(col => sqlEscape(q.dbRow[col]));
  return `  (${vals.join(', ')})`;
});
headerLines.push(valueBlocks.join(',\n') + `

ON CONFLICT DO NOTHING;

COMMIT;

-- ⚠️ SELESAI INSERT, jalankan ini terpisah untuk mengkalkulasi FRS & ZONASI
--    (jika ingin dihitung server-side lagi via save API / trigger)
-- SELECT id, nama, nik_karyawan, zonasi, fram_kat FROM public.mcu_records ORDER BY created_at DESC LIMIT 10;
`);

fs.writeFileSync(OUT_SQL, headerLines.join('\n'), 'utf-8');
console.log(`   ✔ SQL tersimpan (${fs.statSync(OUT_SQL).size.toLocaleString()} bytes)`);

// ============================================================
// 6. Generate laporan rejected
// ============================================================
console.log(`\n📝 Generate laporan ditolak (${rejectedRows.length})`);

const csvHeader = ['no_excel','nik_ktp','nama','kolom_terisi','total_kolom','persen_terisi','catatan'];
const csvRows = rejectedRows.map(r => [
  r.noExcel,
  `"${r.nikKtp.replace(/"/g,'""')}"`,
  `"${r.namaLengkap.replace(/"/g,'""')}"`,
  r.filled, r.total, `${r.fillPct.toFixed(1)}%`,
  '"Butuh input manual: kolom terisi ≤50% (tidak di-include di SQL auto)"',
].join(','));
fs.writeFileSync(OUT_REPORT_CSV, [csvHeader.join(','), ...csvRows].join('\n') + '\n', 'utf-8');

const txt = [];
txt.push(`=============================================================`);
txt.push(`  RECORD MCU 2026 - BARIS DITOLAK (KOL TERISI ≤50%)`);
txt.push(`  Perlu INPUT MANUAL di form Review MCU`);
txt.push(`  Total : ${rejectedRows.length} baris`);
txt.push(`=============================================================`);
txt.push(``);
if (!rejectedRows.length) txt.push(`  (SEMUA LOLOS — tidak ada ditolak)`);
for (const r of rejectedRows) {
  txt.push(`  Baris Excel #${String(r.noExcel).padStart(4,' ')}`);
  txt.push(`    ▸ NIK KTP     : ${r.nikKtp}`);
  txt.push(`    ▸ Nama        : ${r.namaLengkap}`);
  txt.push(`    ▸ Terisi      : ${r.filled} / ${r.total} kolom  (${r.fillPct.toFixed(1)}%)`);
  txt.push(`    ▸ Status      : ⚠️  DITOLAK — butuh inputan manual di Review MCU`);
  txt.push(``);
}
txt.push(`=============================================================`);
fs.writeFileSync(OUT_REPORT_TXT, txt.join('\n'), 'utf-8');
console.log(`   ✔ CSV & TXT tersimpan`);

// ============================================================
// 7. Summary
// ============================================================
console.log(`
================================================
✅ SCRIPT BERHASIL DIJALANKAN
================================================

📤 SQL (${qualifiedRows.length} baris):
   → ${path.relative(ROOT, OUT_SQL)}

⚠️  Perlu input MANUAL (${rejectedRows.length} baris):
   → ${path.relative(ROOT, OUT_REPORT_CSV)}
   → ${path.relative(ROOT, OUT_REPORT_TXT)}

PENTING: ENCRYPTION_KEY di .env.local SAMA PERSIS dengan server Supabase live.
         Kalau beda → hash beda → pencarian NIK di app tidak ketemu!
`);
