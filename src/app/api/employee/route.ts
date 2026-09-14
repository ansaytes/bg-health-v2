import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptEmployee, hashField } from '@/lib/encryption';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey || 'placeholder-anon-key');
const supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : supabase;

type SearchBy = 'nik' | 'national_id' | 'nama';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const searchKey = body.nikKtp || body.query || '';
    const searchBy: SearchBy = (body.searchBy as SearchBy) || 'nik';

    if (!searchKey || typeof searchKey !== 'string' || searchKey.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Query minimal 2 karakter' },
        { status: 400 }
      );
    }

    const q = searchKey.trim();
    const safe = q.replace(/["'%\\]/g, '');

    const filters: string[] = [];

    if (searchBy === 'nik') {
      // Search by NIK Karyawan → use nik_hash column
      const queryHash = hashField(safe);
      if (queryHash) {
        filters.push(`nik_hash.eq."${queryHash}"`);
      } else {
        filters.push(`nik.eq."${safe}"`);
      }
    } else if (searchBy === 'national_id') {
      // Search by NIK KTP / National ID → use national_id_hash column
      const queryHash = hashField(safe);
      if (queryHash) {
        filters.push(`national_id_hash.eq."${queryHash}"`);
      } else {
        filters.push(`national_id.eq."${safe}"`);
      }
    } else if (searchBy === 'nama') {
      // Name search: plain-text ilike (nama column is NOT encrypted)
      filters.push(`nama.ilike."%${safe}%"`);
      filters.push(`department.ilike."%${safe}%"`);
      filters.push(`site_name.ilike."%${safe}%"`);
    } else {
      // Default: try both hashes + name ilike
      const queryHash = hashField(safe);
      if (queryHash) {
        filters.push(`nik_hash.eq."${queryHash}"`);
        filters.push(`national_id_hash.eq."${queryHash}"`);
      }
      filters.push(`nama.ilike."%${safe}%"`);
    }

    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('nik, nama, gender, department, division, job_position, site_name, national_id, phone_number, level_golongan, age, place_of_birth, birth_date, last_education, place_of_hire, address, religion, masa_kerja, employee_status, employment_status, tanggal_pkwt, tanggal_resign, grading, marital_status, child, specification_job, area, spesification')
      .or(filters.join(','))
      .limit(20);

    if (error) {
      console.error('Employee search error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ success: false, error: 'Karyawan tidak ditemukan' });
    }

    const decryptedData = (data || []).map(decryptEmployee);
    return NextResponse.json({ success: true, data: decryptedData });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mencari data karyawan';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
