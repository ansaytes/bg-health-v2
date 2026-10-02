// Script untuk verifikasi output SQL
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SQL_FILE = path.join(__dirname, 'mcu-import-generated.sql');

const sqlContent = fs.readFileSync(SQL_FILE, 'utf8');

// Extract first VALUES row
const valuesMatch = sqlContent.match(/VALUES\s*\n\s*\(([^)]+)\)/s);
if (!valuesMatch) {
  console.log('Tidak bisa menemukan VALUES');
  process.exit(1);
}

const firstRow = valuesMatch[1];
const columns = [
  'national_id', 'nik_karyawan', 'nama', 'usia', 'jenis_kelamin', 'jabatan', 'site', 'status_mcu', 'tgl_mcu', 'tempat_mcu',
  'gol_darah', 'gigi_mulut', 'fisik_head_to_toe', 'hemoroid', 'visus_jauh', 'visus_dekat', 'def_warna', 'lapang_pandang', 'fisik_mata',
  'merokok', 'td_s', 'td_d', 'nadi', 'bb', 'tb', 'bmi', 'lp', 'hb', 'leukosit', 'eritrosit', 'hematokrit', 'trombosit', 'mcv', 'mch', 'mchc', 'led',
  'chol', 'tg', 'hdl', 'ldl', 'gdp', 'gd2pp', 'hba1c', 'diabetes', 'au', 'ureum', 'kreatinin', 'egfr', 'sgot', 'sgpt', 'ggt', 'alp', 'billirubin', 'ul',
  'hbsag', 'anti_hbs', 'vdrl', 'tpha', 'hiv',
  'drug_amp', 'drug_meth', 'drug_morph', 'drug_canna', 'drug_coc', 'drug_benz', 'drug_caris', 'alkohol', 'psa',
  'chest_xr', 'lumbo_xr', 'ecg_hasil', 'tm_hasil', 'usg',
  'fvc_pred', 'fvc_act', 'fvc_pct', 'fev1_pred', 'fev1_act', 'fev1_pct', 'fev1_fvc_pred', 'fev1_fvc_act', 'fev1_fvc_pct', 'spi_interp',
  'acr_500', 'acr_1k', 'acr_2k', 'acr_3k', 'acr_4k', 'acr_6k', 'acr_8k', 'acl_500', 'acl_1k', 'acl_2k', 'acl_3k', 'acl_4k', 'acl_6k', 'acl_8k', 'aud_interp',
  'balance', 'romberg', 'phalen', 'thinel', 'patrick', 'kontra_patrick', 'laseque', 'kernig', 'tes_kebugaran', 'pemeriksaan_lain', 'dugaan_pak',
  'kes_vendor', 'rek_qshe', 'diagnosa_medis', 'perlu_fu', 'rek_fu', 'item_fu', 'link_mcu', 'tgl_expired', 'fram_score', 'zonasi', 'trigger_zona', 'pengendalian', 'catatan',
  'tgl_fu1', 'lokasi_fu1', 'hasil_fu1', 'kesimpulan_fu1', 'link_fu1', 'rek_fu2', 'tgl_fu2', 'lokasi_fu2', 'hasil_fu2', 'kesimpulan_fu2', 'link_fu2',
  'rek_fu3', 'tgl_fu3', 'lokasi_fu3', 'hasil_fu3', 'kesimpulan_fu3', 'link_fu3', 'rek_fu4', 'national_id_hash', 'nik_karyawan_hash'
];

// Parse the first row values
const values = firstRow.split(',').map(v => v.trim().replace(/^'(.*)'$/, '$1'));

console.log('📋 Verifikasi kolom kunci:');
console.log('='.repeat(80));

const keyColumns = ['diagnosa_medis', 'tgl_fu1', 'lokasi_fu1', 'hasil_fu1', 'kesimpulan_fu1', 'link_fu1'];

for (const col of keyColumns) {
  const idx = columns.indexOf(col);
  if (idx >= 0 && idx < values.length) {
    const val = values[idx];
    const displayVal = val.length > 50 ? val.substring(0, 50) + '...' : val;
    console.log(`${col.padEnd(20)}: ${displayVal}`);
  } else {
    console.log(`${col.padEnd(20)}: NOT FOUND`);
  }
}

console.log('\n📊 Sample data lengkap dari kolom FU section:');
console.log('='.repeat(80));
const fuSectionStart = columns.indexOf('diagnosa_medis');
const fuSectionEnd = columns.indexOf('link_fu1') + 1;

for (let i = fuSectionStart; i < fuSectionEnd; i++) {
  const col = columns[i];
  const val = values[i];
  const displayVal = val.length > 40 ? val.substring(0, 40) + '...' : val;
  console.log(`${col.padEnd(20)}: ${displayVal}`);
}
