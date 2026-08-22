import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const csvUrl = process.env.GOOGLE_SHEETS_CSV_URL || '';

// CSV column mapping (29 columns)
const COLUMN_MAP: Record<number, string> = {
  0: 'nik', 1: 'nama', 2: 'gender', 3: 'department', 4: 'division',
  5: 'job_position', 6: 'level_golongan', 7: 'tanggal_pkwt', 8: 'masa_kerja',
  9: 'employee_status', 10: 'employment_status', 11: 'tanggal_resign',
  12: 'national_id', 13: 'phone_number', 14: 'place_of_birth',
  15: 'birth_date', 16: 'age', 17: 'last_education', 18: 'place_of_hire',
  19: 'site_name', 20: 'address', 21: 'religion', 22: 'grading',
  23: 'marital_status', 24: 'child', 25: 'specification_job',
  26: 'area', 27: 'spesification',
};

// Parse DD/M/YYYY to YYYY-MM-DD
function parseDate(val: string): string | null {
  if (!val || val.trim() === '') return null;
  const s = val.trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/M/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    return `${m[3]}-${mo}-${d}`;
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
        if (ch === '\r' && text[i + 1] === '\n') i++; // skip \r\n
      } else { field += ch; }
    }
  }
  // Last field/row
  row.push(field.trim());
  if (row.length > 1 || (row.length === 1 && row[0] !== '')) rows.push(row);

  return rows;
}

function mapRowToEmployee(row: string[]) {
  const emp: Record<string, unknown> = {};
  for (const [colIdx, dbCol] of Object.entries(COLUMN_MAP)) {
    const val = row[Number(colIdx)] || '';
    if (['tanggal_pkwt', 'tanggal_resign', 'birth_date'].includes(dbCol)) {
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

    // 2. Map rows to employee objects (skip header)
    const employees = rows.slice(1).map(mapRowToEmployee).filter(e => e.nik);

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
        // Fallback: try one by one
        for (const emp of batch) {
          const { error: singleError } = await supabase
            .from('employees')
            .upsert(emp, { onConflict: 'nik' });
          if (singleError) {
            batchErrors++;
            console.error(`Failed to upsert NIK ${emp.nik}:`, singleError.message);
          } else {
            totalUpserted++;
          }
        }
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
      errors: batchErrors,
      duration_seconds: duration,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
