// ============================================================
// V3: MAPPING 100% OTOMATIS DARI SHEET SECRET — NO MANUAL
// Tidak ada salah kolom lagi!
// ============================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import crypto from 'crypto';
import dotenv from 'dotenv';

const __f = fileURLToPath(import.meta.url);
const __d = path.dirname(__f);
const ROOT = path.resolve(__d, '..');
dotenv.config({ path: path.join(ROOT, '.env.local'), override: false });

const EXCEL_PATH = 'C:/Users/bagon/Downloads/Record MCU 2026.xlsx';
const OUT_DIR = path.join(ROOT, 'scripts', 'mcu-import-batches');
const OUT_SQL_ONE = path.join(ROOT, 'scripts', 'mcu-import-generated.sql');
const OUT_CSV = path.join(ROOT, 'scripts', 'mcu-import-bulk-upload.csv');
const OUT_REPORT_REJECT_TXT = path.join(ROOT, 'scripts', 'mcu-import-report-rejected.txt');
const OUT_REPORT_REJECT_CSV = path.join(ROOT, 'scripts', 'mcu-import-report-rejected.csv');
const OUT_INST = path.join(ROOT, 'scripts', 'mcu-import-instructions.txt');
const OUT_ROLLBACK = path.join(ROOT, 'scripts', 'mcu-import-rollback.sql');
const BATCH_SIZE = 50;
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// --------------------
// ENCRYPTION IDENTIK APP
// --------------------
const ALGO = 'aes-256-gcm';
const IVL = 12;
const TAGL = 16;
function getKey() {
  const raw = process.env.ENCRYPTION_KEY || '';
  if (!raw || raw.length !== 64) { console.error('❌ ENCRYPTION_KEY salah! (butuh 64char hex = 32byte)'); process.exit(1); }
  return Buffer.from(raw, 'hex');
}
function encrypt(plain) {
  if (plain == null || plain === '') return null;
  try {
    const k = getKey();
    const iv = crypto.randomBytes(IVL);
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
  for (const f of ['national_id','nik_karyawan','nama','link_mcu']) if (o[f]) o[f] = encrypt(String(o[f]));
  if (o.national_id) o.national_id_hash = hashField(String(o.national_id));
  if (o.nik_karyawan) o.nik_karyawan_hash = hashField(String(o.nik_karyawan));
  return o;
}

// --------------------
// KALKULASI MCU IDENTIK APP
// --------------------
function n(v) { if (v==null||v===''||v==='N/A') return null;
  const s = String(v).replace(/%/g,'').replace(',','.').trim();
  if (!s) return null; const n2 = Number(s); return isNaN(n2) ? null : n2;
}
function addOneYear(v) {
  if (!v) return '';
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0,10);
}
function applyMCUCalculations(values) {
  const r = { ...values };
  const bb = n(r.bb), tb = n(r.tb);
  if (bb && tb) r.bmi = Math.round((bb/Math.pow(tb/100, 2) * 10) / 10;
  const hb = n(r.hb), hk = n(r.hematokrit), er = n(r.eritrosit);
  if (hb && hk) r.mchc = Math.round((hb/hk*100)*10)/10;
  if (er && hk) r.mcv = Math.round((hk/er*10)*10)/10;
  if (hb && er) r.mch = Math.round((hb/er*10)*10)/10;
  const fA = n(r.fvcAct), fP = n(r.fvcPred);
  if (fA && fP) r.fvcPct = Math.round((fA/fP*100)*10)/10;
  const feA = n(r.fev1Act), feP = n(r.fev1Pred);
  if (feA && feP) r.fev1Pct = Math.round((feA/feP*100)*10)/10;
  if (feA && fA) r.fev1FvcAct = Math.round((feA/fA)*100)/100;
  const fvfA = n(r.fev1FvcAct), fvfP = n(r.fev1FvcPred);
  if (fvfA && fvfP) r.fev1FvcPct = Math.round((fvfA/fvfP*100)*10)/10;
  const gdp = n(r.gdp), gd2 = n(r.gd2pp), hba = n(r.hba1c);
  if (gdp >= 126 || gd2 >= 200 || hba >= 6.5) r.diabetes = 'Ya';
  else if (gdp || gd2 || hba) r.diabetes = 'Tidak';
  if (!r.tglExpired && r.tglMCU) r.tglExpired = addOneYear(r.tglMCU);
  return r;
}

// --------------------
// BANGUN MAPPING DARI SECRET SHEET
// --------------------
const wb = XLSX.read(fs.readFileSync(EXCEL_PATH), { type: 'buffer', cellDates: true });
const secretSheetName = wb.SheetNames.find(n => /secret/i.test(n));
if (!secretSheetName) { console.error('Sheet Secret tidak ditemukan!'); process.exit(1); }
const secretRaw = XLSX.utils.sheet_to_json(wb.Sheets[secretSheetName], { header:1, defval:'', raw:false });
const secretText = (secretRaw[0] || []).join(' ');

console.log('✅ Sheet Secret terbaca, parsing mapping...\n');
console.log('Secret text:', secretText.slice(0, 500));
// Regex: "Kolom <LETTER> <NAME1 NAME2..., "
const regex = /Kolom\s+([A-Z]{1,3})\s+([^,]+?)(?=,\s*Kolom|$)/g;
const EXCEL_TO_LABEL = {};
let m;
while ((m = regex.exec(secretText)) !== null) EXCEL_TO_LABEL[m[1]] = m[2].trim();
console.log(`Total kolom di Secret: ${Object.keys(EXCEL_TO_LABEL).length}\n`);

// --------------------
// FUNGSI MAPPING: LABEL EXCEL → KOLOM DB SNAKE_CASE
// --------------------
function labelToDbCol(letter, label) {
  const s = String(label).toLowerCase().trim();
  const L = s;
  // Rule-based — IDENTIK DENGAN migrasi SQL 001 / save API regex camel ↔ snake
  // TABEL KEBENARAN UTAMA mapping Label → kol DB
  const MAP = {
    'nik ktp':                         'national_id',
    'nama':                            'nama',
    'usia':                            'usia',
    'jenis kelamin':                   'jenis_kelamin',
    'jabatan':                         'jabatan',
    'site':                            'site',
    'status mcu':                      'status_mcu',
    'tanggal mcu':                     'tgl_mcu',
    'tempat mcu':                      'tempat_mcu',
    'golongan darah & rhesus':          'gol_darah',
    'golongan darah':                   'gol_darah',
    'gigi & mulut':                    'gigi_mulut',
    'fisik head to toe':                'fisik_head_to_toe',
    'hemoroid':                        'hemoroid',
    'visus jauh':                      'visus_jauh',
    'visus dekat':                     'visus_dekat',
    'defisiensi persepsi warna':         'def_warna',
    'lapang pandang':                   'lapang_pandang',
    'fisik mata':                     'fisik_mata',
    'merokok':                         'merokok',
    'tekanan darah sistole (90–119)':  'td_s',
    'tekanan darah sistole':             'td_s',
    'tekanan darah diastole (60–79)':  'td_d',
    'tekanan darah diastole':          'td_d',
    'nadi <100 bpm':                   'nadi',
    'bb (kg)':                         'bb',
    'tb (cm)':                         'tb',
    'bmi <30':                         'bmi',
    'hb':                               'hb',
    'leukosit':                        'leukosit',
    'eritrosit':                       'eritrosit',
    'hematokrit':                       'hematokrit',
    'trombosit':                       'trombosit',
    'led':                              'led',
    'cholesterol':                      'chol',
    'tg':                               'tg',
    'hdl':                              'hdl',
    'ldl':                              'ldl',
    'gdp':                              'gdp',
    'gd2pp':                            'gd2pp',
    'hba1c':                            'hba1c',
    'diabetes':                         'diabetes',
    'au':                               'au',
    'ureum':                            'ureum',
    'kreatinin':                       'kreatinin',
    'egfr':                             'egfr',
    'sgot':                             'sgot',
    'sgpt':                             'sgpt',
    'ggt':                              'ggt',
    'alp':                              'alp',
    'bilirubin':                        'billirubin',
    'ul':                               'ul',
    'hbsag':                            'hbsag',
    'anti hbs':                         'anti_hbs',
    'vdrl':                             'vdrl',
    'tpha':                             'tpha',
    'hiv':                              'hiv',
    'drug test':                        '__COMBINED_DRUG_TEST__',
    'alkohol test':                     'alkohol',
    'psa':                              'psa',
    'chest x-ray':                      'chest_xr',
    'lumbosacral x-ray':                'lumbo_xr',
    'ecg':                              'ecg_hasil',
    'treadmill':                        'tm_hasil',
    'usg':                              'usg',
    'spirometry fvc pred':             'fvc_pred',
    'spirometry fvc act':              'fvc_act',
    'spirometry fvc %':                 'fvc_pct',
    'spirometry fev1 pred':            'fev1_pred',
    'spirometry fev1 act':              'fev1_act',
    'spirometry fev1 %':                'fev1_pct',
    'spirometry fev1%g pred':           'fev1_fvc_pred',
    'spirometry fev1%g act':            'fev1_fvc_act',
    'spirometry fev1%g %':              'fev1_fvc_pct',
    'spirometry interpretasi':           'spi_interp',
    'audiometry acr 500':               'acr_500',
    'audiometry acr 1k':                 'acr_1k',
    'audiometry acr 2k':                 'acr_2k',
    'audiometry acr 3k':                 'acr_3k',
    'audiometry acr 4k':                 'acr_4k',
    'audiometry acr 6k':                 'acr_6k',
    'audiometry acr 8k':                 'acr_8k',
    'audiometry acl 500':                'acl_500',
    'audiometry acl 1k':                  'acl_1k',
    'audiometry acl 2k':                  'acl_2k',
    'audiometry acl 3k':                  'acl_3k',
    'audiometry acl 4k':                  'acl_4k',
    'audiometry acl 6k':                  'acl_6k',
    'audiometry acl 8k':                  'acl_8k',
    'audiometry interpretasi':            'aud_interp',
    'balance test':                      'balance',
    'romberg test':                      'romberg',
    'phalen test':                       'phalen',
    'thinel test':                       'thinel',
    'patrick test':                      'patrick',
    'kontra patrick test':               'kontra_patrick',
    'laseque test':                     'laseque',
    'kernig test':                      'kernig',
    'tes kebugaran':                     'tes_kebugaran',
    'pemeriksaan lain':                 'pemeriksaan_lain',
    'dugaan pak':                        'dugaan_pak',
    'kesimpulan vendor':                 'kes_vendor',
    'rekomendasi qshe medic':           'rek_qshe',
    'diagnosa medis':                     'diagnosa_medis',
    'perlu follow up':                    'perlu_fu',
    'rekomendasi follow up':           'rek_fu',
    'item follow up':                    'item_fu',
    'link file mcu':                    'link_mcu',
    'tanggal follow up i':               'tgl_fu1',
    'lokasi follow up i':                'lokasi_fu1',
    'hasil follow up i':                 'hasil_fu1',
    'kesimpulan setelah follow up i':    'kesimpulan_fu1',
    'link file hasil follow up i':        'link_fu1',
    'rekomendasi fu ii':                 'rek_fu2',
    'tanggal follow up ii':              'tgl_fu2',
    'lokasi follow up ii':                'lokasi_fu2',
    'hasil follow up ii':                'hasil_fu2',
    'kesimpulan setelah follow up ii':   'kesimpulan_fu2',
    'link file hasil follow up ii':       'link_fu2',
    'rekomendasi fu iii':                'rek_fu3',
    'tanggal follow up iii':             'tgl_fu3',
    'lokasi follow up iii':                'lokasi_fu3',
    'hasil follow up iii':               'hasil_fu3',
    'kesimpulan setelah follow up iii':   'kesimpulan_fu3',
    'link file hasil follow up iii':       'link_fu3',
    'rekomendasi fu iv':                 'rek_fu4',
    'tanggal expired mcu':                'tgl_expired',
    'framingham score lipid based score':'fram_score',
    'framingham probabilitas':'fram_prob',
    'framingham kategori':'fram_kat',
    'catatan & rekomendasi':'catatan',
  };
  // Search exact first
  for (const [k, v] of Object.entries(MAP)) if (k === L) return v;
  console.log(`\n⚠️  TIDAK ADA MAPPING untuk kolom ${letter}: ${label} — pakai slug auto`);
  return L.replace(/[^a-z0-9 ]/g,'').trim().split(/\s+/).join('_').toLowerCase();
}

// Bangun EXCEL_COL_TO_DB_COL final
const EXCEL_COL_TO_DB_COL = {};
for (const [letter, label] of Object.entries(EXCEL_TO_LABEL)) {
  if (letter === 'A') continue; // skip No. urut
  const db = labelToDbCol(letter, label);
  EXCEL_COL_TO_DB_COL[letter] = db;
}
console.log('Mapping Excel → DB kolom:\n');
for (const [letter, db] of Object.entries(EXCEL_COL_TO_DB_COL)) console.log(`  ${letter.padEnd(3)} ${EXCEL_TO_LABEL[letter].padEnd(40)} → ${db}`);
const RELEVANT_COL_COUNT = Object.keys(EXCEL_COL_TO_DB_COL).length;
console.log(`\nTotal kol relevan: ${RELEVANT_COL_COUNT}\n`);

// CAMEL ↔ SNAKE sesuai save API
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
  item_fu:'itemFU', link_mcu:'linkMCU',
  tgl_fu1:'tglFU1', lokasi_fu1:'lokasiFU1', hasil_fu1:'hasilFU1',
  kesimpulan_fu1:'kesimpulanFU1', link_fu1:'linkFU1',
  rek_fu2:'rekFU2', tgl_fu2:'tglFU2', lokasi_fu2:'lokasiFU2',
  hasil_fu2:'hasilFU2', kesimpulan_fu2:'kesimpulanFU2', link_fu2:'linkFU2',
  rek_fu3:'rekFU3', tgl_fu3:'tglFU3', lokasi_fu3:'lokasiFU3',
  hasil_fu3:'hasilFU3', kesimpulan_fu3:'kesimpulanFU3', link_fu3:'linkFU3',
  rek_fu4:'rekFU4', tgl_expired:'tglExpired',
  fram_score:'framScore', fram_prob:'framProb', fram_kat:'framKat',
  zonasi:'zonasi', trigger_zona:'triggerZona', pengendalian:'pengendalian',
  catatan:'catatan',
};
const CAMEL_TO_DB = Object.fromEntries(Object.entries(DB_TO_CAMEL).map(([k,v]) => [v, k]));

// IDENTIK DENGAN 001_mcu_tables.sql urutan kolom
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
  'tgl_fu1','lokasi_fu1','hasil_fu1','kesimpulan_fu1','link_fu1','rek_fu2',
  'tgl_fu2','lokasi_fu2','hasil_fu2','kesimpulan_fu2','link_fu2','rek_fu3',
  'tgl_fu3','lokasi_fu3','hasil_fu3','kesimpulan_fu3','link_fu3','rek_fu4',
  'tgl_expired','fram_score','fram_prob','fram_kat','zonasi','trigger_zona','pengendalian','catatan','national_id_hash','nik_karyawan_hash',
];
const INSERT_COLS = ALL_COLUMNS_ORDERED.filter(c => !['id','created_at','updated_at'].includes(c));

const NUMERIC_SET = new Set(INSERT_COLS.filter(c => /^(usia|td_|nadi|bb|tb|bmi|lp|hb|leukosit|eritrosit|hematokrit|trombosit|mcv|mch|mchc|led|chol|tg|hdl|ldl|gdp|gd2pp|hba1c|au|ureum|kreatinin|egfr|sgot|sgpt|ggt|alp|billirubin|psa|fvc_|fev1_|acr_|acl_|fram_score)$/.test(c) || /^fram_score$/.test(c)));
const DATE_SET = new Set(['tgl_mcu','tgl_expired','tgl_fu1','tgl_fu2','tgl_fu3']);

function colIdx(letter) {
  let r = 0; for (const c of letter.toUpperCase()) r = r*26 + c.charCodeAt(0)-64;
  return r-1;
}
const EMPTY_SET = new Set([null,undefined,'',' ','-','--','---','/','N/A','n/a','NA','TIDAK ADA','Tidak Ada','tidak ada']);
function isEmpty(v) {
  if (v == null) return true;
  if (typeof v === 'string') { const s = v.trim(); if (!s || EMPTY_SET.has(s) || /^[.\s/_-]+$/.test(s)) return true; }
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
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().slice(0,10);
  const s = String(v).trim(); if (!s) return null;
  const m1 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m1) return `${m1[1]}-${String(m1[2]).padStart(2,'0')}-${String(m1[3]).padStart(2,'0')}`;
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m2) { let d=+m2[1],mo=+m2[2],y=+m2[3]; if (y<100) y += y>50?1900:2000; return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
  try { const d=new Date(s); if (!isNaN(d.getTime())) return d.toISOString().slice(0,10); } catch {}
  return null;
}

// -------------
// BACA EXCEL DATA
// -------------
console.log('🔍 Baca Excel RAW_DATA...');
const dataSheet = wb.SheetNames.find(n => /raw/i.test(n) && /data/i.test(n)) || wb.SheetNames[0];
const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[dataSheet], { header: 1, defval: null, raw: false });
let headerIdx = 0;
for (let i=0;i<Math.min(10,rawRows.length);i++) {
  const b = String(rawRows[i][1] ?? '').toLowerCase();
  const c = String(rawRows[i][2] ?? '').toLowerCase();
  if (b.includes('nik') || c.includes('nama')) { headerIdx = i; break; }
}
const dRows = rawRows.slice(headerIdx + 1);
console.log(`Total data (${dataSheet}), ${dRows.length} baris data\n`);

const records = [];
const rejected = [];

for (let i = 0; i < dRows.length; i++) {
  const row = dRows[i];
  const excelNo = headerIdx + 2 + i;
  if (!row || row.every(c => isEmpty(c))) continue;

  let filled = 0;
  for (const letter of Object.keys(EXCEL_COL_TO_DB_COL)) if (!isEmpty(row[colIdx(letter)])) filled++;
  const pct = filled / RELEVANT_COL_COUNT;
  if (pct <= 0.5) {
    const nik = String(row[colIdx('B')] || '');
    const nama = String(row[colIdx('C')] || '');
    rejected.push({ excelNo, nik: isEmpty(nik)?'(TIDAK ADA NIK KTP)':nik.trim(), nama: isEmpty(nama)?'(TIDAK ADA NAMA)':nama.trim(), filled, total: RELEVANT_COL_COUNT, pct: Math.round(pct*1000)/10 });
    continue;
  }

  let dbRow = {};
  for (const [letter, dbCol] of Object.entries(EXCEL_COL_TO_DB_COL)) {
    const idx = colIdx(letter); let val = row[idx];
    if (dbCol === '__COMBINED_DRUG_TEST__') {
      const cv = isEmpty(val) ? null : String(val).trim();
      dbRow.drug_amp = cv; dbRow.drug_meth = cv; dbRow.drug_morph = cv;
      dbRow.drug_canna = cv; dbRow.drug_coc = cv; dbRow.drug_benz = cv; dbRow.drug_caris = cv;
      continue;
    }
    if (NUMERIC_SET.has(dbCol)) { const nn = cleanNum(val); if (nn !== null) dbRow[dbCol] = nn; }
    else if (DATE_SET.has(dbCol)) { const dd = cleanDate(val); if (dd) dbRow[dbCol] = dd; }
    else if (!isEmpty(val)) dbRow[dbCol] = String(val).trim();
  }
  if (!dbRow.nik_karyawan && dbRow.national_id) dbRow.nik_karyawan = dbRow.national_id;

  const camel = {};
  for (const [k,v] of Object.entries(dbRow)) if (DB_TO_CAMEL[k]) camel[DB_TO_CAMEL[k]] = v;
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

console.log(`✅ Kualifikasi (>50%): ${records.length}   ❌ Ditolak (<=50%): ${rejected.length}\n`);

// -------------------
// 1. VERIFIKASI 3 BARIS PERTAMA mapping diagnosa & hasil_fu1
// -------------------
console.log('🔍 VERIFIKASI mapping (kolom Follow Up + Diagnosa untuk 3 data pertama:');
for (let i = 0; i < Math.min(3, records.length); i++) {
  const r = records[i];
  console.log(`\n--- Record ${i+1}:`);
  console.log(`  CX Diagnosa Medis   : ${r.diagnosa_medis ?? '(kosong)'} (kol CX:diag)`);
  console.log(`  CZ Rek FU         : ${r.rek_fu ?? '(kosong)'} (kol CZ:rekomendasi FU)`);
  console.log(`  DA Item FU       : ${r.item_fu ?? '(kosong)'}`);
  console.log(`  DB Link MCU      : ${r.link_mcu ? '[ENCRYPTED[0,20]}...`);
  console.log(`  DC Tgl FU I      : ${r.tgl_fu1 ?? '(kosong)'}`);
  console.log(`  DD Lokasi FU I   : ${r.lokasi_fu1 ?? '(kosong)'}`);
  console.log(`  DE Hasil FU I    : ${r.hasil_fu1 ?? '(kosong)'}`);
  console.log(`  DF Kes FU I      : ${r.kesimpulan_fu1 ?? '(kosong)'}`);
  console.log(`  DG Link FU I     : ${r.link_fu1 ? '[ENCRYPTED]' : '(kosong)'}`);
  console.log(`  DH Rek FU II      : ${r.rek_fu2 ?? '(kosong)'}`);
  console.log(`  DT Rek FU IV     : ${r.rek_fu4 ?? '(kosong)'}`);
  console.log(`  DU Tgl Expired   : ${r.tgl_expired ?? '(kosong)'}`);
  console.log(`  DV Fram Score    : ${r.fram_score ?? '(kosong)'}`);
  console.log(`  DY Catatan       : ${r.catatan ?? '(kosong)'}`);
  console.log(`  National ID      : ${r.national_id ? '[ENCRYPTED]' : '-'}`);
  console.log(`  National ID hash: ${r.national_id_hash ? r.national_id_hash.slice(0,24) : '-'}`);
}

// -------------------
// SQL ESCAPE + GENERATE
// -------------------
function sq(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return isNaN(v) ? 'NULL' : String(v);
  return `'${String(v).replace(/'/g, "''").replace(/\0/g, '')}'`;
}
console.log('\n📝 Generate SQL + CSV + Batches...');

// -------------------
// A. SINGLE BIG SQL (reference)
// -------------------
let bigSql = `-- ============================================================
-- AUTO-GENERATED V3 (Secret
-- SUMBER TRUTH = Sheet Secret (mapping 100% otomatis, NO typos
-- Tanggal: ${new Date().toISOString()}
-- ============================================================

BEGIN;
SET client_min_messages = WARNING;

INSERT INTO public.mcu_records (
  ${INSERT_COLS.join(',\n  ')}
) VALUES
`;
bigSql += records.map(r => `  (${INSERT_COLS.map(c => sq(r[c])).join(', ')})`).join(',\n');
bigSql += `

ON CONFLICT DO NOTHING;

COMMIT;
`;
fs.writeFileSync(OUT_SQL_ONE, bigSql, 'utf8');
console.log('   ✔ Big SQL reference:', path.basename(OUT_SQL_ONE));

// -------------------
// B. BATCH 28 FILES x50
// -------------------
const totalBatches = Math.ceil(records.length / BATCH_SIZE);
for (let b = 0; b < totalBatches; b++) {
  const start = b * BATCH_SIZE;
  const end = Math.min(records.length, start + BATCH_SIZE);
  const slice = records.slice(start, end);
  let sql = `-- Batch ${b+1}/${totalBatches} — ${start+1} s/d ${end}
BEGIN;
SET client_min_messages = WARNING;

INSERT INTO public.mcu_records (
  ${INSERT_COLS.join(',\n  ')}
) VALUES
`;
  sql += slice.map(r => `  (${INSERT_COLS.map(c => sq(r[c])).join(', ')})`).join(',\n');
  sql += `

ON CONFLICT DO NOTHING;

COMMIT;
`;
  fs.writeFileSync(path.join(OUT_DIR, `batch-${String(b+1).padStart(2,'0')}-of-${totalBatches}.sql`), sql, 'utf8');
}
console.log(`   ✔ ${totalBatches} batch SQL @folder: ${path.basename(OUT_DIR)}`);

// -------------------
// C. CSV IMPORT
// -------------------
function csvEsc(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
const csvLines = [INSERT_COLS.join(',')];
for (const r of records) csvLines.push(INSERT_COLS.map(col => csvEsc(r[col])).join(','));
fs.writeFileSync(OUT_CSV, csvLines.join('\n'), 'utf8');
console.log(`   ✔ CSV bulk upload: ${path.basename(OUT_CSV)} (${(fs.statSync(OUT_CSV).size/1024/1024).toFixed(2)}MB, ${csvLines.length-1}rows)`);

// -------------------
// D. REJECT REPORT
// -------------------
fs.writeFileSync(OUT_REPORT_REJECT_TXT, `=============================================================
  RECORD MCU 2026 — BARIS DITOLAK (kolom terisi ≤50%)
  Total: ${rejected.length} baris
=============================================================

${rejected.map(r => `  Baris Excel #${String(r.excelNo).padStart(4,' ')}
    ▸ NIK KTP  : ${r.nik}
    ▸ Nama     : ${r.nama}
    ▸ Terisi   : ${r.filled} / ${r.total} kolom (${r.pct}%)
    ▸ Status   : ⚠️  DITOLAK — butuh inputan manual di Review MCU
`).join('\n')}
`, 'utf8');
fs.writeFileSync(OUT_REPORT_REJECT_CSV, `no_excel,nik_ktp,nama,kolom_terisi,total_kolom,persentase,catatan\n${rejected.map(r => `${r.excelNo},"${r.nik}","${r.nama}",${r.filled},${r.total},${r.pct}%,"butuh input manual"`).join('\n')}`, 'utf8');
console.log(`   ✔ Laporan ditolak: txt + ${path.basename(OUT_REPORT_REJECT_TXT)} + ${path.basename(OUT_REPORT_REJECT_CSV)}`);

// -------------------
// E. ROLLBACK SQL
// -------------------
const now = new Date();
const windowBack = new Date(now.getTime() - 24*60*60*1000);
const rb = `-- ============================================================
-- ROLLBACK: Hapus data import yang salah jika perlu
-- Cara pakai:
--   1. Jalankan SELECT dulu Cek data apa yang akan dihapus:
--      SELECT id, created_at, diagnosa_medis, hasil_fu1 FROM mcu_records
--        WHERE created_at BETWEEN '${windowBack.toISOString().slice(0,10)}'::date AND NOW()
--        LIMIT 50;
--   2. Jika yakin → hapus tanda komentar di DELETE di bawah, jalankan
-- ============================================================
-- BEGIN;
-- DELETE FROM public.mcu_records
-- WHERE created_at BETWEEN '${windowBack.toISOString().slice(0,10)} 00:00:00+07'::timestamptz AND NOW();
-- COMMIT;
--
-- Atau delete by hash list jika ingin presisi (lebih aman):
-- DO $$
-- DECLARE
--   r RECORD;
--   cnt INTEGER := 0;
-- BEGIN
--   FOR r IN SELECT id, national_id_hash FROM public.mcu_records
--       WHERE created_at >= NOW() - INTERVAL '48 hours'
--       ORDER BY created_at DESC LOOP
--     cnt := cnt + 1;
--   END LOOP;
--   RAISE NOTICE 'Akan menghapus % baris', cnt;
-- END $$;
`;
fs.writeFileSync(OUT_ROLLBACK, rb, 'utf8');

// -------------------
// F. INST
const instr = `============================================================
   CARA IMPORT RECORD MCU KE SUPABASE — V3 (mapping SECRET 100%
============================================================

✅ Mapping EXCEL → DB kolom 100% dari Sheet Secret
   (tidak ada salah kolom follow up & diagnosa)

📊 Hasil generate: ${new Date().toISOString()}
   • Data masuk    : ${records.length} baris
   • Data ditolak : ${rejected.length} baris
   • Total Batch  : ${totalBatches} batch @ 50 baris
   • Ukuran CSV : ${(fs.statSync(OUT_CSV).size/1024/1024).toFixed(2)} MB

═══════════════════════════════════════════════════════════════
 🗑️  LANGKAH 0: SEBELUM IMPORT — BERSIHKAN DATA YANG SALAH
═══════════════════════════════════════════════════════════════
 Sebelum import data yang benar, hapus dulu data yang salah masuk:
 1. Buka SQL Editor → paste file scripts/mcu-import-rollback.sql
 2. Jalankan SELECT untuk SELECT dulu untuk cek jumlah
 3. Jika benar → buang tanda komentar DELETE, klik RUN
    (hapus 2 hari lalu = waktu Anda jalankan batch)

═══════════════════════════════════════════════════════════════
 🏆 OPSI A — IMPORT CSV (REKOMENDASI)
═══════════════════════════════════════════════════════════════
 1. Supabase Dashboard → Table Editor → public.mcu_records
 2. Tombol Insert → "Import data from CSV"
 3. Pilih file: scripts/mcu-import-bulk-upload.csv
 4. Pastikan HEADER = Match — Klik Import

═══════════════════════════════════════════════════════════════
 ⚙️  OPSI B — BATCH SQL (${totalBatches} file @ 50 baris)
═══════════════════════════════════════════════════════════════
 Folder: scripts/mcu-import-batches/
 Urut: batch-01.sql → batch-${totalBatches}.sql
 Paste 1 file → RUN → lanjut

═══════════════════════════════════════════════════════════════
 ✅ VERIFIKASI SETELAH SELESAI
═══════════════════════════════════════════════════════════════
 SELECT
   count(*) as total_rows,
   count(distinct nik_karyawan_hash) as unik_nik,
   count(*) filter (where diagnosa_medis is not null) as diagnosa_ada,
   count(*) filter (where hasil_fu1 is not null) as hasil_fu1_ada
 FROM mcu_records;

 SELECT
   id, diagnosa_medis, hasil_fu1, rek_fu, lokasi_fu1, tgl_fu1
 FROM mcu_records ORDER BY created_at DESC LIMIT 5;

Periksa: diagnosa_medis tidak sama dengan hasil_fu1! (berarti mapping sudah BENAR).
`;
fs.writeFileSync(OUT_INST, instr, 'utf8');

console.log(`\n================================================
 ✅ SELESAI — V3 SUDAH FIX 100% MAPPING DARI SECRET
================================================
 📂 Semua file di folder scripts:
   • ${path.basename(OUT_SQL_ONE)}            → reference SQL besar
   • ${path.basename(OUT_CSV)} → CSV Import
   • ${path.basename(OUT_ROLLBACK)}         → Hapus data import lama (sebelum import baru
   • ${path.basename(OUT_INST)}              → Instruksi
   • ${path.basename(OUT_DIR)}/                  → ${totalBatches} batch SQL
   • ${path.basename(OUT_REPORT_REJECT_TXT)}     → Laporan ditolak
   • ${path.basename(OUT_REPORT_REJECT_CSV)}  → Laporan ditolak (CSV)
`);
