import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// NOTE: Scheduled sync moved to GitHub Actions (no Vercel Hobby timeout limit)
// This endpoint is for manual trigger only.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const csvUrl = process.env.GOOGLE_SHEETS_CSV_URL || '';

// CSV column mapping (29 columns from Google Sheets)
// Index 5 = "USER" column, not stored in DB (skipped)
const COLUMN_MAP: Record<number, string> = {
  0: 'nik', 1: 'nama', 2: 'gender', 3: 'department', 4: 'division',
  // 5: USER (skipped - not in DB)
  6: 'level_golongan', 7: 'job_position', 8: 'tanggal_pkwt', 9: 'masa_kerja',
  10: 'employee_status', 11: 'employment_status', 12: 'tanggal_resign',
  13: 'national_id', 14: 'phone_number', 15: 'place_of_birth',
  16: 'birth_date', 17: 'age', 18: 'last_education', 19: 'place_of_hire',
  20: 'site_name', 21: 'address', 22: 'religion', 23: 'grading',
  24: 'marital_status', 25: 'child', 26: 'specification_job',
  27: 'area', 28: 'spesification',
};

const DATE_COLUMNS = new Set(['tanggal_pkwt', 'tanggal_resign', 'birth_date']);

// Values that should be treated as null in date fields
const GARBAGE_VALUES = new Set([
  '-', 'xxxx', 'xxxxx', '#n/a', '#value!', '0',
  'double data', 'double nik', 'nik double',
  'tgl blm tentu', 'pengajuan di email',
  'tidak perlu dinonaktifkan bpjsnya (rehire)',
  'rehire',
]);

// Parse DD/M/YYYY or DD/MM/YY to YYYY-MM-DD
function parseDate(val: string): string | null {
  if (!val || val.trim() === '') return null;
  const s = val.trim().toLowerCase();

  // Garbage values → null
  if (GARBAGE_VALUES.has(s)) return null;

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/M/YYYY
  const m4 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m4) {
    const d = m4[1].padStart(2, '0');
    const mo = m4[2].padStart(2, '0');
    return `${m4[3]}-${mo}-${d}`;
  }

  // DD/M/YY (2-digit year) → assume 20YY
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

// Custom CSV parser — handles quoted fields with embedded commas
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
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

function sanitizeValue(val: string): string | null {
  if (!val || val.trim() === '') return null;
  const s = val.trim();
  // Skip garbage spreadsheet artifacts
  if (['-', '#n/a', '#value!', '#ref!', '0'].includes(s.toLowerCase())) return null;
  return s || null;
}

function mapRowToEmployee(row: string[]): Record<string, unknown> | null {
  const emp: Record<string, unknown> = {};
  for (const [colIdx, dbCol] of Object.entries(COLUMN_MAP)) {
    const val = row[Number(colIdx)] || '';
    if (DATE_COLUMNS.has(dbCol)) {
      emp[dbCol] = parseDate(val);
    } else if (dbCol === 'age') {
      const n = parseInt(val, 10);
      emp[dbCol] = isNaN(n) || n < 0 || n > 150 ? null : n;
    } else if (dbCol === 'nik') {
      const s = val.trim();
      // Skip invalid NIKs: empty, "xxx", negative, non-alphanumeric
      if (!s || s === 'xxx' || s.startsWith('-') || !/^[A-Za-z0-9]+$/.test(s)) {
        return null;
      }
      emp[dbCol] = s;
    } else {
      emp[dbCol] = sanitizeValue(val);
    }
  }
  return emp;
}

export async function GET() {
  if (!csvUrl) {
    return NextResponse.json({ error: 'GOOGLE_SHEETS_CSV_URL not configured' }, { status: 500 });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { count, error } = await supabase
    .from('employees')
    .select('*', { count: 'exact', head: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    status: 'ok',
    message: 'Sync endpoint ready',
    employee_count: count || 0,
    last_sync: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  if (!csvUrl) {
    return NextResponse.json({ error: 'GOOGLE_SHEETS_CSV_URL not configured' }, { status: 500 });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 });
  }

  try {
    // 1. Fetch CSV from Google Sheets
    const csvRes = await fetch(csvUrl, { cache: 'no-store' });
    if (!csvRes.ok) {
      return NextResponse.json({
        error: `Failed to fetch CSV: ${csvRes.status} ${csvRes.statusText}`,
      }, { status: 502 });
    }
    const csvText = await csvRes.text();
    const rows = parseCSV(csvText);

    if (rows.length < 2) {
      return NextResponse.json({ error: 'CSV is empty or has no data rows' }, { status: 400 });
    }

    // 2. Map rows to employee objects (skip header + invalid rows)
    const allEmployees = rows.slice(1).map(mapRowToEmployee);
    const employees = allEmployees.filter((e): e is Record<string, unknown> => e !== null);
    const skipped = allEmployees.length - employees.length;

    // 3. Upsert to Supabase in batches of 500
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    let totalUpserted = 0;
    let batchErrors = 0;

    for (let i = 0; i < employees.length; i += 500) {
      const batch = employees.slice(i, i + 500);
      const { error, count } = await supabase
        .from('employees')
        .upsert(batch, { onConflict: 'nik', count: 'exact' });

      if (error) {
        batchErrors += batch.length;
      } else {
        totalUpserted += count || batch.length;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    return NextResponse.json({
      status: 'ok',
      message: `Synced ${totalUpserted} employees from Google Sheets`,
      total_rows: rows.length - 1,
      upserted: totalUpserted,
      skipped: skipped,
      errors: batchErrors,
      duration_seconds: duration,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
