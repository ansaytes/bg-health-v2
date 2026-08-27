import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    // Search across NIK, National ID, name, phone, department, site_name
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('nik, nama, gender, department, division, job_position, site_name, national_id, phone_number, level_golongan, age, place_of_birth, birth_date, last_education, place_of_hire, address, religion, masa_kerja, employee_status, employment_status, tanggal_pkwt, tanggal_resign, grading, marital_status, child, specification_job, area, spesification')
      .or(`nik.eq."${safe}",national_id.eq."${safe}",nama.ilike."%${safe}%",phone_number.ilike."%${safe}%",department.ilike."%${safe}%",site_name.ilike."%${safe}%"`)
      .limit(20);

    if (error) {
      console.error('Employee search error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ success: false, error: 'Karyawan tidak ditemukan' });
    }

    // Return raw array — let frontend handle mapping
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mencari data karyawan';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
