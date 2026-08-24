import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Columns A-W from Google Sheets (23 fields, excluding Grading/Child/Spec/Area/Spesification)
const SELECT_COLUMNS = `
  nik, nama, gender, department, division,
  level_golongan, job_position, tanggal_pkwt, masa_kerja,
  employee_status, employment_status, tanggal_resign,
  national_id, phone_number, place_of_birth,
  birth_date, age, last_education, place_of_hire,
  site_name, address, religion
`;

/* ═══════════════════════════════════
   POST — Search employee by NIK, National ID, or Nama
   Body: { query: "BG0002" | "3507131312860003" | "Budi" }
   ═══════════════════════════════════ */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Query minimal 2 karakter' },
        { status: 400 }
      );
    }

    const q = query.trim();

    // Search by: NIK (exact), National ID (exact), or Nama (ilike)
    let whereClause = '';

    if (/^[A-Za-z0-9]+$/.test(q)) {
      // Could be NIK or National ID — try both exact + nama ilike
      whereClause = `nik.eq.${q},national_id.eq.${q},nama.ilike.%${q}%,phone_number.ilike.%${q}%`;
    } else {
      // Text search by nama
      whereClause = `nama.ilike.%${q}%,department.ilike.%${q}%,site_name.ilike.%${q}%`;
    }

    const { data, error } = await supabase
      .from('employees')
      .select(SELECT_COLUMNS)
      .or(whereClause)
      .limit(20);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: (data || []).length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mencari data karyawan';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
