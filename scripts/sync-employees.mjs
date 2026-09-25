// Standalone employee sync script — runs in GitHub Actions (no Vercel timeout limit)
// Usage: GOOGLE_SHEETS_CSV_URL=... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... ENCRYPTION_KEY=... node sync-employees.mjs

import { encryptEmployee } from './lib/encryption.mjs';

const CSV_URL = process.env.GOOGLE_SHEETS_CSV_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!CSV_URL || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars: GOOGLE_SHEETS_CSV_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  console.error('Missing or invalid ENCRYPTION_KEY (must be 32-byte hex = 64 chars). Generate with: openssl rand -hex 32');
  process.exit(1);
}

// FORCE_FRESH=1 akan truncate tabel employees sebelum insert
// Berguna kalau ada data duplicate / plain-text yang perlu dihapus total
const FORCE_FRESH = process.env.FORCE_FRESH === '1' || process.env.FORCE_FRESH === 'true';
if (FORCE_FRESH) {
  console.log('⚠️  FORCE_FRESH mode: akan TRUNCATE tabel employees sebelum insert!');
}

const COLUMN_MAP = {
  0: 'nik', 1: 'nama', 2: 'gender', 3: 'department', 4: 'division',
  // 5: USER (skipped)
  6: 'level_golongan', 7: 'job_position', 8: 'tanggal_pkwt', 9: 'masa_kerja',
  10: 'employee_status', 11: 'employment_status', 12: 'tanggal_resign',
  13: 'national_id', 14: 'phone_number', 15: 'place_of_birth',
  16: 'birth_date', 17: 'age', 18: 'last_education', 19: 'place_of_hire',
  20: 'site_name', 21: 'address', 22: 'religion', 23: 'grading',
  24: 'marital_status', 25: 'child', 26: 'specification_job',
  27: 'area', 28: 'spesification',
};

const DATE_COLUMNS = new Set(['tanggal_pkwt', 'tanggal_resign', 'birth_date']);

const GARBAGE_VALUES = new Set([
  '-', 'xxxx', 'xxxxx', '#n/a', '#value!', '0',
  'double data', 'double nik', 'nik double',
  'tgl blm tentu', 'pengajuan di email',
  'tidak perlu dinonaktifkan bpjsnya (rehire)',
  'rehire',
]);

function parseDate(val) {
  if (!val || !val.trim()) return null;
  const s = val.trim().toLowerCase();
  if (GARBAGE_VALUES.has(s)) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m4 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m4) {
    const d = m4[1].padStart(2, '0');
    const mo = m4[2].padStart(2, '0');
    return `${m4[3]}-${mo}-${d}`;
  }
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m2) {
    const d = m2[1].padStart(2, '0');
    const mo = m2[2].padStart(2, '0');
    const y = parseInt(m2[3], 10);
    const fullYear = y >= 0 && y <= 30 ? `20${m2[3]}` : `19${m2[3]}`;
    return `${fullYear}-${mo}-${d}`;
  }
  return null;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field.trim()); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        row.push(field.trim()); field = '';
        if (row.length > 1 || (row.length === 1 && row[0] !== '')) rows.push(row);
        row = [];
        if (ch === '\r' && text[i + 1] === '\n') i++;
      } else { field += ch; }
    }
  }
  row.push(field.trim());
  if (row.length > 1 || (row.length === 1 && row[0] !== '')) rows.push(row);
  return rows;
}

function sanitizeValue(val) {
  if (!val || !val.trim()) return null;
  const s = val.trim();
  if (['-', '#n/a', '#value!', '#ref!', '0'].includes(s.toLowerCase())) return null;
  return s || null;
}

function mapRow(row) {
  const emp = {};
  for (const [colIdx, dbCol] of Object.entries(COLUMN_MAP)) {
    const val = row[Number(colIdx)] || '';
    if (DATE_COLUMNS.has(dbCol)) {
      emp[dbCol] = parseDate(val);
    } else if (dbCol === 'age') {
      const n = parseInt(val, 10);
      emp[dbCol] = isNaN(n) || n < 0 || n > 150 ? null : n;
    } else if (dbCol === 'nik') {
      const s = val.trim();
      if (!s || s === 'xxx' || s.startsWith('-') || !/^[A-Za-z0-9]+$/.test(s)) {
        return null;
      }
      emp[dbCol] = s;
    } else {
      emp[dbCol] = sanitizeValue(val);
    }
  }
  // Encrypt sensitive fields (NIK, national_id, phone, etc.) before insert
  return encryptEmployee(emp);
}

function isEligibleEmployee(employee) {
  return String(employee.division || '').trim().toLowerCase() === 'mining'
    && String(employee.employment_status || '').trim().toLowerCase() === 'aktif';
}

async function upsertBatch(batch) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/employees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(batch),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${res.status}: ${err}`);
  }
  return batch.length;
}

async function upsertSingle(emp) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/employees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(emp),
  });
  if (!res.ok) {
    const err = await res.text();
    // Include NIK in error message so we know which row failed
    throw new Error(`NIK ${emp.nik}: ${res.status}: ${err}`);
  }
  return 1;
}

async function main() {
  const start = Date.now();
  let upserted = 0;
  let errors = 0;
  console.log('Fetching CSV from Google Sheets...');

  const csvRes = await fetch(CSV_URL, { cache: 'no-store' });
  if (!csvRes.ok) throw new Error(`CSV fetch failed: ${csvRes.status}`);
  const csvText = await csvRes.text();
  const rows = parseCSV(csvText);
  console.log(`Parsed ${rows.length - 1} data rows`);

  const allEmployees = rows.slice(1).map(mapRow);
  const validEmployees = allEmployees.filter(e => e !== null);
  const employees = validEmployees.filter(isEligibleEmployee);
  const skipped = allEmployees.length - validEmployees.length;
  const filteredByCriteria = validEmployees.length - employees.length;
  console.log(`Eligible employees: ${employees.length} (skipped ${skipped} invalid rows, filtered ${filteredByCriteria} non-Mining/non-Aktif rows)`);

  const BATCH = 500;
  const failedNiks = [];

  // Kalau FORCE_FRESH, hapus semua data dulu
  if (FORCE_FRESH) {
    console.log('Truncating employees table...');
    const delRes = await fetch(`${SUPABASE_URL}/rest/v1/employees?id=neq.00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal',
      },
    });
    if (!delRes.ok) {
      const err = await delRes.text();
      console.error(`Truncate failed: ${delRes.status} ${err}`);
      // Continue anyway, mungkin tabel sudah kosong
    } else {
      console.log('Truncate OK, tabel kosong. Siap insert data fresh.');
    }
  }

  for (let i = 0; i < employees.length; i += BATCH) {
    const batch = employees.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    try {
      const count = await upsertBatch(batch);
      upserted += count;
      console.log(`  Batch ${batchNum}: +${count} rows`);
    } catch (err) {
      console.error(`  Batch ${batchNum} (500) failed: ${err.message}`);
      // Fallback: sub-batches of 50
      for (let j = 0; j < batch.length; j += 50) {
        const sub = batch.slice(j, j + 50);
        try {
          const count = await upsertBatch(sub);
          upserted += count;
        } catch (subErr) {
          console.error(`    Sub@${i+j} (50) failed: ${subErr.message}`);
          // Last resort: one-by-one
          for (const emp of sub) {
            try {
              await upsertSingle(emp);
              upserted++;
            } catch (singleErr) {
              errors++;
              failedNiks.push(emp.nik);
              console.error(`      NIK ${emp.nik}: ${singleErr.message}`);
            }
          }
        }
      }
    }
  }

  const duration = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nDone: ${upserted} upserted, ${skipped} skipped, ${errors} errors, ${duration}s`);
  if (failedNiks.length > 0) {
    console.log(`Failed NIKs: ${failedNiks.join(', ')}`);
  }
}

main().catch(err => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
