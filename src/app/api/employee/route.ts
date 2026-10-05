import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptEmployee, hashField } from '@/lib/encryption';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;
const previewRole = process.env.NEXT_PUBLIC_PREVIEW_ROLE;

type SearchBy = 'nik' | 'national_id' | 'nama';
type EmployeeLookupRow = {
  nik: string | null;
  nama: string | null;
  gender: string | null;
  department: string | null;
  division: string | null;
  job_position: string | null;
  site_name: string | null;
  national_id: string | null;
  age: number | null;
  birth_date: string | null;
};

async function getCaller(request: NextRequest): Promise<{ role: string; site: string | null } | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    || request.cookies.get('sb-access-token')?.value;
  if (!token) return null;
  if (token === 'preview-access-token' && previewRole) {
    return { role: previewRole, site: process.env.NEXT_PUBLIC_PREVIEW_SITE || 'Head Office' };
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await authClient.auth.getUser(token);
  if (error || !user) return null;

  const profileClient = supabaseAdmin || createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: profile, error: profileError } = await profileClient
    .from('user_profiles')
    .select('role,site,username,national_id,employee_nik_hash')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError || !profile) return null;

  let site = profile.site || null;
  if (profile.role === 'pic' && !site && supabaseAdmin) {
    const employeeHash = profile.employee_nik_hash || hashField(profile.username);
    const nationalIdHash = profile.national_id ? hashField(profile.national_id) : null;
    const employeeQuery = employeeHash
      ? supabaseAdmin.from('employees').select('site_name').eq('nik_hash', employeeHash).maybeSingle()
      : nationalIdHash
        ? supabaseAdmin.from('employees').select('site_name').eq('national_id_hash', nationalIdHash).maybeSingle()
        : null;
    if (employeeQuery) {
      const { data: employee } = await employeeQuery;
      site = employee?.site_name || null;
    }
  }

  return { role: profile.role, site };
}

export async function POST(request: NextRequest) {
  const caller = await getCaller(request);
  if (!caller) {
    return NextResponse.json({ success: false, error: 'Silakan masuk untuk mencari data karyawan.' }, { status: 401 });
  }
  if (!['pic', 'administrator', 'superuser'].includes(caller.role)) {
    return NextResponse.json({ success: false, error: 'Akses lookup karyawan ditolak.' }, { status: 403 });
  }
  if (caller.role === 'pic' && !caller.site) {
    return NextResponse.json({ success: false, error: 'Jobsite akun PIC belum dikonfigurasi.' }, { status: 403 });
  }
  if (!supabaseAdmin && !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: 'Layanan lookup karyawan belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ success: false, error: 'Permintaan lookup tidak valid.' }, { status: 400 });
    }
    const payload = body as Record<string, unknown>;
    const searchKey = payload.nikKtp ?? payload.query;
    if (typeof searchKey !== 'string' || searchKey.trim().length < 2) {
      return NextResponse.json({ success: false, error: 'Query minimal 2 karakter.' }, { status: 400 });
    }

    const rawSearchBy = payload.searchBy ?? 'nik';
    if (rawSearchBy !== 'nik' && rawSearchBy !== 'national_id' && rawSearchBy !== 'nama') {
      return NextResponse.json({ success: false, error: 'Jenis pencarian tidak valid.' }, { status: 400 });
    }

    const query = searchKey.trim();
    const filters: string[] = [];
    if (rawSearchBy === 'nik') {
      const queryHash = hashField(query);
      if (!queryHash) throw new Error('Employee lookup hash could not be generated.');
      filters.push(`nik_hash.eq."${queryHash}"`);
    } else if (rawSearchBy === 'national_id') {
      const queryHash = hashField(query);
      if (!queryHash) throw new Error('Employee lookup hash could not be generated.');
      filters.push(`national_id_hash.eq."${queryHash}"`);
    } else {
      const nameQuery = query.replace(/[^\p{L}\p{N}\s'-]/gu, '').trim();
      if (nameQuery.length < 3) {
        return NextResponse.json({ success: false, error: 'Pencarian nama minimal 3 karakter.' }, { status: 400 });
      }
      const escapedName = nameQuery.replace(/"/g, '');
      filters.push(`nama.ilike."%${escapedName}%"`);
      filters.push(`department.ilike."%${escapedName}%"`);
      filters.push(`site_name.ilike."%${escapedName}%"`);
    }

    let employeeQuery = supabaseAdmin!
      .from('employees')
      .select('nik, nama, gender, department, division, job_position, site_name, national_id, age, birth_date')
      .or(filters.join(','))
      .ilike('employment_status', 'Aktif');
    if (caller.role === 'pic') employeeQuery = employeeQuery.eq('site_name', caller.site!);
    const { data, error } = await employeeQuery.limit(20);

    if (error) {
      console.error('Employee search failed:', error);
      return NextResponse.json({ success: false, error: 'Gagal mencari data karyawan.' }, { status: 500 });
    }

    const employees = (data || []).map(row => decryptEmployee(row) as EmployeeLookupRow);
    return NextResponse.json(
      employees.length
        ? { success: true, data: employees }
        : { success: false, error: 'Karyawan tidak ditemukan.' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Employee search request failed:', error);
    return NextResponse.json({ success: false, error: 'Gagal memproses pencarian karyawan.' }, { status: 500 });
  }
}
