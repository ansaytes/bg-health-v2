const XLSX = require('xlsx');
const fs = require('fs');
const wb = XLSX.readFile('D:/SHE/SOP/Draft/HRA_REV01.xlsx');

const depts = ['OPERATION','PLANT','SCM','QSHE','HCGS','FAT','MANAGEMENT','TDC'];
const result = {};

depts.forEach(dept => {
  const ws = wb.Sheets[dept];
  if (!ws) { result[dept] = null; return; }
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Find header row (row with "No" "Jenis Pekerjaan" etc) — typically row 7 (index 6)
  // Data starts at row index 8
  const dataRows = [];
  let currentNo = '';
  let currentJenis = '';

  for (let i = 8; i < rows.length; i++) {
    const r = rows[i];
    // Skip footer rows (keterangan, ttd, etc.)
    if (typeof r[0] === 'string' && (r[0].includes('KETER') || r[0].includes('Nama') || r[0].includes('Posisi') || r[0].includes('Tanda') || r[0].includes('Tabel') || r[0].includes('Catatan') || r[0].includes('Klasifikasi'))) break;
    if (r.every(c => c === '')) continue;

    // Update running no and jenis
    if (r[0] !== '') currentNo = r[0];
    if (r[1] !== '') currentJenis = r[1];

    const jenis_hazard = r[2];
    const sumber = r[3];
    const kelompok = r[4];
    const efek_kes = r[5];
    const p_init = r[6];
    const e_init = r[7];
    const r_init = r[8];
    const tindakan = r[9];
    const p_res = r[10];
    const e_res = r[11];
    const r_res = r[12];
    const peraturan = r[13];

    // Only add if has hazard data
    if (jenis_hazard !== '' || sumber !== '') {
      dataRows.push({
        no: currentNo,
        jenis_pekerjaan: currentJenis,
        jenis_hazard,
        sumber_hazard: sumber,
        kelompok_beresiko: kelompok,
        efek_kesehatan: efek_kes,
        p_init: parseInt(p_init) || 0,
        e_init: parseInt(e_init) || 0,
        r_init: parseInt(r_init) || 0,
        tindakan_pencegahan: tindakan,
        p_res: parseInt(p_res) || 0,
        e_res: parseInt(e_res) || 0,
        r_res: parseInt(r_res) || 0,
        peraturan,
      });
    }
  }

  result[dept] = {
    count: dataRows.length,
    rows: dataRows,
  };
});

// Also read Mapping Resiko sheet
const mapWs = wb.Sheets['Mapping Resiko'];
const mapRows = XLSX.utils.sheet_to_json(mapWs, { header: 1, defval: '' });
const mappings = [];
for (let i = 2; i < mapRows.length; i++) {
  const r = mapRows[i];
  if (r.every(c => c === '')) continue;
  if (typeof r[0] === 'string' && r[0].trim() === '') continue;
  mappings.push({
    no: r[0],
    jabatan: r[1],
    departemen: r[2],
    r_tertinggi: r[3],
    kategori: r[4],
  });
}

result['_mapping'] = { count: mappings.length, rows: mappings };

// Summary
console.log('\n=== SUMMARY ===');
Object.entries(result).forEach(([k, v]) => {
  if (v) console.log(k + ':', v.count, 'rows');
});

// Print all rows per dept
Object.entries(result).forEach(([k, v]) => {
  if (!v || k === '_mapping') return;
  console.log('\n=== ' + k + ' ===');
  v.rows.forEach((r, i) => {
    console.log(`  [${i+1}] ${r.jenis_pekerjaan} | ${r.jenis_hazard} | P=${r.p_init} E=${r.e_init} R=${r.r_init} → P=${r.p_res} E=${r.e_res} R=${r.r_res}`);
    console.log(`       Sumber: ${r.sumber_hazard}`);
    console.log(`       Efek  : ${r.efek_kesehatan}`);
    console.log(`       Kelompok: ${r.kelompok_beresiko}`);
  });
});

// Mapping
console.log('\n=== MAPPING RESIKO ===');
result['_mapping'].rows.forEach(r => {
  console.log(`  ${r.jabatan} | ${r.departemen} | R=${r.r_tertinggi} | ${r.kategori}`);
});

fs.writeFileSync('scripts/hra_full_data.json', JSON.stringify(result, null, 2));
console.log('\n✅ Data saved to scripts/hra_full_data.json');
