const XLSX = require('../node_modules/xlsx');
const fs = require('fs');

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

function escSql(val) {
  if (val === null || val === undefined || val === '') return 'NULL';
  const s = String(val).trim();
  if (!s || s === '-' || s === '0') return 'NULL';
  return "'" + s.replace(/'/g, "''") + "'";
}

function numSql(val) {
  if (val === null || val === undefined || val === '') return 'NULL';
  const n = parseInt(String(val).trim(), 10);
  return isNaN(n) ? 'NULL' : String(n);
}

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

  // Track valid date serial
  const parsedDate = excelDateToISO(tanggalRaw);
  if (parsedDate) {
    lastValidTanggal = parsedDate;
  }

  const isMainRow = (tanggalRaw !== '' && tanggalRaw !== 0) || (nikRaw !== '' && nikRaw !== 0) || nama !== '';

  if (isMainRow && nama) {
    if (current) records.push(current);

    // If tanggal is missing on this patient row, inherit from preceding visit on same session
    const tanggal = parsedDate || lastValidTanggal;
    const nik = (nikRaw && nikRaw !== '-' && nikRaw !== 0 && nikRaw !== '0') ? String(nikRaw).trim() : null;

    const meds = [];
    if (terapi) {
      meds.push({ nama: terapi, aturan: dosis, jumlah: String(jumlahObat || '') });
    }

    current = {
      tanggal,
      nik,
      nama,
      usia: usia ? usia : null,
      jk: jk || null,
      jabatan: jobPosition || null,
      departemen: department || null,
      jobsite: 'Head Office',
      keluhan: keluhan || null,
      diagnosa: diagnosa || null,
      medications: meds,
      rujuk_rs: false,
      nama_rs: null
    };
  } else if (current && terapi) {
    current.medications.push({ nama: terapi, aturan: dosis, jumlah: String(jumlahObat || '') });
  }
}
if (current) records.push(current);

console.log('Total records grouped:', records.length);

let sql = `-- =====================================================
-- SQL Import: Kunjungan Klinik 2026
-- File Sumber: KUNJUNGAN KLINIK 2026.xlsx (Sheet: Kunjungan Klinik)
-- Total Record: ${records.length} kunjungan
-- NIK Karyawan: Opsional / Nullable (mendukung karyawan baru & anak magang)
-- =====================================================

-- 1. Penyesuaian Struktur Tabel kunjungan_berobat (Supabase / PostgreSQL)
CREATE TABLE IF NOT EXISTS public.kunjungan_berobat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nik TEXT, -- NULLABLE: NIK karyawan (opsional jika magang / karyawan baru)
    nama TEXT NOT NULL,
    departemen TEXT,
    jobsite TEXT NOT NULL DEFAULT 'Head Office',
    tanggal DATE NOT NULL,
    usia INTEGER,
    jk TEXT,
    jabatan TEXT,
    keluhan TEXT,
    diagnosa TEXT,          -- JSON array e.g. '["Commond Cold"]'
    jenis_obat TEXT,        -- JSON array e.g. '[{"nama":"Anadex","aturan":"3DD1","jumlah":"10"}]'
    rujuk_rs BOOLEAN DEFAULT FALSE,
    nama_rs TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Jika tabel sudah ada sebelumnya di Supabase, jalankan migrasi berikut agar NIK tidak wajib:
ALTER TABLE public.kunjungan_berobat ALTER COLUMN nik DROP NOT NULL;
ALTER TABLE public.kunjungan_berobat ADD COLUMN IF NOT EXISTS usia INTEGER;
ALTER TABLE public.kunjungan_berobat ADD COLUMN IF NOT EXISTS jk TEXT;
ALTER TABLE public.kunjungan_berobat ADD COLUMN IF NOT EXISTS jabatan TEXT;
ALTER TABLE public.kunjungan_berobat ADD COLUMN IF NOT EXISTS keluhan TEXT;

-- 3. Tabel Master Diagnosa (pengganti sheetbantu untuk diagnosa)
CREATE TABLE IF NOT EXISTS public.diagnosa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabel Master Dosis / Aturan Pakai
CREATE TABLE IF NOT EXISTS public.dosis_obat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode TEXT NOT NULL UNIQUE,
    keterangan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Data Awal Master Diagnosa
INSERT INTO public.diagnosa (nama) VALUES
    ('Commond Cold'), ('Faringitis'), ('Vertigo'), ('Strain'), ('Chepalgia'),
    ('Unspesified Disorder'), ('Gastritis'), ('Unspesified Allergy'), ('Hipertermia'),
    ('Odontalgia'), ('Hipertensi'), ('Myalgia'), ('Diarhea'), ('Gerd'), ('Contusion'),
    ('Hiperuricemia'), ('Disminorhea'), ('Unspesified Infection'), ('Pulpitis'),
    ('Vomiting'), ('Vulnus Laceratum'), ('Hiperlipidemia'), ('Hordeulum'), ('Stomatitis'),
    ('Artritis'), ('Diabetes Mellitus'), ('Dermatitis'), ('Tinea'), ('Konjungtivitis'),
    ('Toothache'), ('Trauma Okuli'), ('Vulnus Contussum'), ('Hipotension'), ('Migrain'),
    ('Hipoxia'), ('Combustio'), ('Keratitis'), ('Gingivitis'), ('Herpes Zoster'),
    ('Leukositosis'), ('Osteoarthitis'), ('Pra-Hipertensi'), ('Tachicardia')
ON CONFLICT (nama) DO NOTHING;

-- 6. Data Awal Master Dosis
INSERT INTO public.dosis_obat (kode, keterangan) VALUES
    ('3DD1', '3 x 1 hari'),
    ('2DD1', '2 x 1 hari'),
    ('1DD1', '1 x 1 hari'),
    ('4DD1', '4 x 1 hari'),
    ('2TAB/BAB', '2 tablet setiap buang air besar'),
    ('K/P', 'Bila perlu'),
    ('Q4H', 'Tiap 4 jam'),
    ('4QH', 'Tiap 4 jam'),
    ('1x1 Sesudah Makan', '1 x sehari sesudah makan'),
    ('2x1 Sesudah Makan', '2 x sehari sesudah makan'),
    ('3x1 Sesudah Makan', '3 x sehari sesudah makan')
ON CONFLICT (kode) DO NOTHING;

-- 7. INSERT DATA KUNJUNGAN (${records.length} baris kunjungan)
`;

for (const r of records) {
  const diagnosaJson = r.diagnosa ? JSON.stringify([r.diagnosa]) : '[]';
  const medsJson = r.medications.length > 0 ? JSON.stringify(r.medications) : '[]';

  sql += `INSERT INTO public.kunjungan_berobat (nik, nama, departemen, jobsite, tanggal, usia, jk, jabatan, keluhan, diagnosa, jenis_obat, rujuk_rs, nama_rs)\nVALUES (${escSql(r.nik)}, ${escSql(r.nama)}, ${escSql(r.departemen)}, ${escSql(r.jobsite)}, ${escSql(r.tanggal)}, ${numSql(r.usia)}, ${escSql(r.jk)}, ${escSql(r.jabatan)}, ${escSql(r.keluhan)}, ${escSql(diagnosaJson)}, ${escSql(medsJson)}, ${r.rujuk_rs}, ${escSql(r.nama_rs)});\n\n`;
}

sql += `-- =====================================================
-- Selesai: ${records.length} baris kunjungan berhasil di-generate.
-- =====================================================\n`;

fs.writeFileSync('kunjungan_klinik_2026.sql', sql, 'utf8');
fs.writeFileSync('C:/Users/bagon/Downloads/kunjungan_klinik_2026.sql', sql, 'utf8');
console.log('Saved to kunjungan_klinik_2026.sql and C:/Users/bagon/Downloads/kunjungan_klinik_2026.sql');
