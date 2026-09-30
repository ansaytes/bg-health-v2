const { createClient } = require('@supabase/supabase-js');
const XLSX = require('../node_modules/xlsx');
require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

const excelPath = 'C:/Users/bagon/Downloads/KUNJUNGAN KLINIK 2026.xlsx';
const wb = XLSX.readFile(excelPath);
const ws = wb.Sheets['Kunjungan Klinik'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const utcDays = Math.floor(serial) - 25569;
  const utcValue = utcDays * 86400 * 1000;
  const d = new Date(utcValue);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function main() {
  console.log('Starting migration to Supabase...');

  // 1. Diagnosa master
  const diagnosaList = [
    'Commond Cold', 'Faringitis', 'Vertigo', 'Strain', 'Chepalgia',
    'Unspesified Disorder', 'Gastritis', 'Unspesified Allergy', 'Hipertermia',
    'Odontalgia', 'Hipertensi', 'Myalgia', 'Diarhea', 'Gerd', 'Contusion',
    'Hiperuricemia', 'Disminorhea', 'Unspesified Infection', 'Pulpitis',
    'Vomiting', 'Vulnus Laceratum', 'Hiperlipidemia', 'Hordeulum', 'Stomatitis',
    'Artritis', 'Diabetes Mellitus', 'Dermatitis', 'Tinea', 'Konjungtivitis',
    'Toothache', 'Trauma Okuli', 'Vulnus Contussum', 'Hipotension', 'Migrain',
    'Hipoxia', 'Combustio', 'Keratitis', 'Gingivitis', 'Herpes Zoster',
    'Leukositosis', 'Osteoarthitis', 'Pra-Hipertensi', 'Tachicardia'
  ];
  for (const d of diagnosaList) {
    await supabase.from('diagnosa').upsert({ nama: d }, { onConflict: 'nama' });
  }
  console.log('Master diagnosa updated.');

  // 2. Dosis master
  const dosisList = [
    { kode: '3DD1', keterangan: '3 x 1 hari' },
    { kode: '2DD1', keterangan: '2 x 1 hari' },
    { kode: '1DD1', keterangan: '1 x 1 hari' },
    { kode: '4DD1', keterangan: '4 x 1 hari' },
    { kode: '2TAB/BAB', keterangan: '2 tablet setiap buang air besar' },
    { kode: 'K/P', keterangan: 'Bila perlu' },
    { kode: 'Q4H', keterangan: 'Tiap 4 jam' },
    { kode: '4QH', keterangan: 'Tiap 4 jam' },
    { kode: '1x1 Sesudah Makan', keterangan: '1 x sehari sesudah makan' },
    { kode: '2x1 Sesudah Makan', keterangan: '2 x sehari sesudah makan' },
    { kode: '3x1 Sesudah Makan', keterangan: '3 x sehari sesudah makan' }
  ];
  for (const ds of dosisList) {
    await supabase.from('dosis_obat').upsert(ds, { onConflict: 'kode' });
  }
  console.log('Master dosis updated.');

  // 3. Parse records
  const records = [];
  let current = null;
  let lastValidTanggal = null;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const tanggalRaw = row[0];
    const nikRaw = row[3];
    const nama = String(row[4] || '').trim();
    const usia = row[5];
    const jk = String(row[6] || '').trim();
    const jobPosition = String(row[7] || '').trim();
    const department = String(row[8] || '').trim();
    const keluhan = String(row[10] || '').trim();
    const diagnosa = String(row[22] || '').trim();
    const terapi = String(row[23] || '').trim();
    const dosis = String(row[24] || '').trim();
    const jumlahObat = row[25];

    const parsedDate = excelDateToISO(tanggalRaw);
    if (parsedDate) lastValidTanggal = parsedDate;

    const isMainRow = (tanggalRaw !== '' && tanggalRaw !== 0) || (nikRaw !== '' && nikRaw !== 0) || nama !== '';

    if (isMainRow && nama) {
      if (current) records.push(current);

      const tanggal = parsedDate || lastValidTanggal;
      const nik = (nikRaw && nikRaw !== '-' && nikRaw !== 0 && nikRaw !== '0') ? String(nikRaw).trim() : null;

      const meds = [];
      if (terapi) {
        meds.push({ nama: terapi, aturan: dosis, jumlah: String(jumlahObat || '') });
      }

      current = {
        tanggal: tanggal || '2026-01-01',
        nik,
        nama,
        usia: usia ? parseInt(String(usia), 10) || null : null,
        jk: jk || null,
        jabatan: jobPosition || null,
        departemen: department || null,
        jobsite: 'Head Office',
        keluhan: keluhan || null,
        diagnosa: diagnosa ? JSON.stringify([diagnosa]) : '[]',
        jenis_obat: meds.length > 0 ? JSON.stringify(meds) : '[]',
        rujuk_rs: false,
        nama_rs: null
      };
    } else if (current && terapi) {
      const existingMeds = JSON.parse(current.jenis_obat || '[]');
      existingMeds.push({ nama: terapi, aturan: dosis, jumlah: String(jumlahObat || '') });
      current.jenis_obat = JSON.stringify(existingMeds);
    }
  }
  if (current) records.push(current);

  console.log(`Parsed ${records.length} records. Inserting to Supabase...`);

  // Batch insert
  const batchSize = 50;
  for (let b = 0; b < records.length; b += batchSize) {
    const slice = records.slice(b, b + batchSize);
    const { error } = await supabase.from('kunjungan_berobat').insert(slice);
    if (error) {
      console.error(`Error inserting batch ${b}:`, error);
    } else {
      console.log(`Inserted batch ${b} to ${b + slice.length}`);
    }
  }

  // Count verify
  const { count } = await supabase.from('kunjungan_berobat').select('*', { count: 'exact', head: true });
  console.log(`Verification: Total rows in kunjungan_berobat = ${count}`);
}

main().catch(console.error);
