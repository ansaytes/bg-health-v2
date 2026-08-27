import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

    // Search across NIK, National ID, name, phone, department, site_name
    const { data, error } = await supabase
      .from('employees')
      .select('nik, nama, gender, department, division, job_position, site_name, national_id, phone_number, level_golongan, age, place_of_birth, birth_date, last_education, place_of_hire, address, religion, masa_kerja, employee_status, employment_status, tanggal_pkwt, tanggal_resign, grading, marital_status, child, specification_job, area, spesification')
      .or(`nik.eq."${q}",national_id.eq."${q}",nama.ilike."%${q}%",phone_number.ilike."%${q}%",department.ilike."%${q}%",site_name.ilike."%${q}%"`)
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
