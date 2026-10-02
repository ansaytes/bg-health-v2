// Script untuk verifikasi mapping kolom setelah perbaikan
import XLSX from 'xlsx';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

const __d = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(__d, '..');
dotenv.config({ path: path.join(ROOT, '.env.local'), override: false });

const EXCEL_PATH = 'C:/Users/bagon/Downloads/Record MCU 2026.xlsx';

// Mapping yang sudah diperbaiki
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

function colIdx(letter) {
  let r = 0; for (const c of letter.toUpperCase()) r = r*26 + c.charCodeAt(0)-64;
  return r-1;
}

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

const headerRow = rawRows[headerIdx];
console.log('\n📋 Kunci Kolom yang diperiksa:');
console.log('DH (col 111):', headerRow[111]);
console.log('DT (col 123):', headerRow[123]);
console.log('DU (col 124):', headerRow[124]);
console.log('DV (col 125):', headerRow[125]);
console.log('DW (col 126):', headerRow[126]);

// Cek 5 baris data pertama yang memiliki data di kolom FU1
console.log('\n📊 Sample data (5 baris pertama dengan data FU1):');
let count = 0;
for (let i = headerIdx + 1; i < rawRows.length && count < 5; i++) {
  const row = rawRows[i];
  const tglFu1 = row[colIdx('DT')] || '';
  const lokasiFu1 = row[colIdx('DU')] || '';
  const hasilFu1 = row[colIdx('DV')] || '';
  const kesimpulanFu1 = row[colIdx('DW')] || '';
  const diagnosaMedis = row[colIdx('DH')] || '';

  if (tglFu1 || lokasiFu1 || hasilFu1 || kesimpulanFu1) {
    count++;
    console.log(`\nBaris ${i + 1}:`);
    console.log(`  NIK: ${row[colIdx('B')]}`);
    console.log(`  Nama: ${row[colIdx('C')]}`);
    console.log(`  Diagnosa Medis (DH): ${diagnosaMedis}`);
    console.log(`  Tgl FU1 (DT): ${tglFu1}`);
    console.log(`  Lokasi FU1 (DU): ${lokasiFu1}`);
    console.log(`  Hasil FU1 (DV): ${hasilFu1}`);
    console.log(`  Kesimpulan FU1 (DW): ${kesimpulanFu1}`);
  }
}
