// Standalone employee sync script — runs in GitHub Actions (no Vercel timeout limit)
// Usage: GOOGLE_SHEETS_CSV_URL=... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node sync-employees.mjs

const CSV_URL = process.env.GOOGLE_SHEETS_CSV_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!CSV_URL || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars: GOOGLE_SHEETS_CSV_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// CSV column mapping (29 columns, index 5 = USER skipped)
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

function parseDate(val) {
  if (!val || !val.trim()) return null;
  const s = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    return `${m[3]}-${mo}-${d}`;
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

function mapRow(row) {
  const emp = {};
  for (const [colIdx, dbCol] of Object.entries(COLUMN_MAP)) {
    const val = row[Number(colIdx)] || '';
    if (DATE_COLUMNS.has(dbCol)) {
      emp[dbCol] = parseDate(val);
    } else if (dbCol === 'age') {
      const n = parseInt(val, 10);
      emp[dbCol] = isNaN(n) ? null : n;
    } else {
      emp[dbCol] = val || null;
    }
  }
  return emp;
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

async function main() {
  const start = Date.now();
  console.log('Fetching CSV from Google Sheets...');

  const csvRes = await fetch(CSV_URL, { cache: 'no-store' });
  if (!csvRes.ok) throw new Error(`CSV fetch failed: ${csvRes.status}`);
  const csvText = await csvRes.text();
  const rows = parseCSV(csvText);
  console.log(`Parsed ${rows.length - 1} data rows`);

  const employees = rows.slice(1).map(mapRow).filter(e => e.nik);
  console.log(`Mapped ${employees.length} valid employees`);

  let upserted = 0;
  let errors = 0;
  const BATCH = 1000;

  for (let i = 0; i < employees.length; i += BATCH) {
    const batch = employees.slice(i, i + BATCH);
    try {
      const count = await upsertBatch(batch);
      upserted += count;
      console.log(`  Batch ${Math.floor(i / BATCH) + 1}: +${count} rows`);
    } catch (err) {
      // Fallback: smaller batches of 100
      console.log(`  Batch ${Math.floor(i / BATCH) + 1} failed, retrying in sub-batches...`);
      let recovered = false;
      for (let j = 0; j < batch.length; j += 100) {
        const sub = batch.slice(j, j + 100);
        try {
          const count = await upsertBatch(sub);
          upserted += count;
          recovered = true;
        } catch (subErr) {
          errors += sub.length;
          console.error(`    Sub-batch failed: ${subErr.message}`);
        }
      }
    }
  }

  const duration = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nDone: ${upserted} upserted, ${errors} errors, ${duration}s`);
}

main().catch(err => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
