import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptEmployee, encrypt } from '@/lib/encryption';

// Server-side client with SERVICE ROLE KEY — bypasses RLS so employee lookup works
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/* ═══════════════════════════════════
   POST — Search employee by NIK, National ID, or Nama
   Body: { query: "3505181309900001" | "230802778" | "Budi" }
   Returns array of raw employee records from DB
   ═══════════════════════════════════ */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const searchKey = body.nikKtp || body.query || '';

    if (!searchKey || typeof searchKey !== 'string' || searchKey.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Query minimal 2 karakter' },
        { status: 400 }
      );
    }

    const q = searchKey.trim();

    // Sanitize: remove characters that could break the filter
    const safe = q.replace(/["'%\\]/g, '');

    // NIK & national_id are now encrypted in DB.
    // For exact match (NIK/national_id), encrypt query first, then filter by encrypted value.
    // For text search (name, department, site_name), use ilike as before.
    const encryptedNik = encrypt(safe); // null if ENCRYPTION_KEY not set, so it falls back to plain

    let query = supabaseAdmin
      .from('employees')
      .select('nik, nama, gender, department, division, job_position, site_name, national_id, phone_number, level_golongan, age, place_of_birth, birth_date, last_education, place_of_hire, address, religion, masa_kerja, employee_status, employment_status, tanggal_pkwt, tanggal_resign, grading, marital_status, child, specification_job, area, spesification')
      .limit(20);

    // Build or-filter: encrypted NIK exact match, encrypted national_id exact match,
    // + plain-text ilike search for name/department/site_name
    const filters = [];
    if (encryptedNik) {
      filters.push(`nik.eq.\"${encryptedNik}\"`);
      filters.push(`national_id.eq.\"${encryptedNik}\"`);
    } else {
      // Fallback: plain-text NIK match (when ENCRYPTION_KEY not set, e.g. preview mode)
      filters.push(`nik.eq.\"${safe}\"`);
      filters.push(`national_id.eq.\"${safe}\"`);
    }
    filters.push(`nama.ilike.\"%${safe}%\"`);
    filters.push(`phone_number.ilike.\"%${safe}%\"`);
    filters.push(`department.ilike.\"%${safe}%\"`);
    filters.push(`site_name.ilike.\"%${safe}%\"`);

    const { data, error } = await query.or(filters.join(','));

    if (error) {
      console.error('Employee search error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ success: false, error: 'Karyawan tidak ditemukan' });
    }

    // Decrypt sensitive fields (NIK, national_id, phone, etc.) before returning
    const decryptedData = (data || []).map(decryptEmployee);
    return NextResponse.json({ success: true, data: decryptedData });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mencari data karyawan';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
