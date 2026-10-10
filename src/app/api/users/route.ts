import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptEmployee, hashField } from '@/lib/encryption';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : supabase;

const PREVIEW_TOKEN = 'preview-access-token';
const PREVIEW_ROLE = process.env.NEXT_PUBLIC_PREVIEW_ROLE as string | undefined;

async function getCallerRole(req: NextRequest): Promise<{ userId: string; role: string } | null> {
  const authHeader = req.headers.get('authorization');
  let accessToken = authHeader?.replace('Bearer ', '');
  if (!accessToken) {
    const cookie = req.cookies.get('sb-access-token')?.value;
    if (cookie) accessToken = cookie;
  }
  if (!accessToken) return null;
  if (accessToken === 'preview-access-token' && PREVIEW_ROLE) {
    return { userId: 'preview-0000-0000-0000-000000000001', role: PREVIEW_ROLE };
  }

  const client = supabaseServiceKey ? supabaseAdmin : supabase;
  const { data: { user }, error } = await client.auth.getUser(accessToken);
  if (error || !user) return null;

  const { data: profile } = await client
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!profile) return null;
  return { userId: user.id, role: profile.role };
}

// GET /api/users — list all users (admin/superuser/manager only)
export async function GET(req: NextRequest) {
  try {
    const caller = await getCallerRole(req);
    if (!caller || !['superuser', 'administrator', 'manager'].includes(caller.role)) {
      return NextResponse.json({
        error: 'Akses ditolak',
        detail: !caller ? 'Tidak bisa memverifikasi sesi login. Pastikan SUPABASE_SERVICE_ROLE_KEY sudah diisi.' : 'Role Anda tidak punya akses ke halaman ini.',
        caller_found: !!caller,
        caller_role: caller?.role || null,
      }, { status: 403 });
    }

    const PREVIEW_TOKEN_VAL = 'preview-access-token';
    const reqAuthToken = req.headers.get('authorization')?.replace('Bearer ', '');
    if (reqAuthToken === PREVIEW_TOKEN_VAL && PREVIEW_ROLE) {
      const PREVIEW_MOCK_USERS = [
        { id: 'preview-1', user_id: 'preview-0000-0000-0000-000000000001', username: 'superuser.preview', full_name: 'Preview Superuser', role: 'superuser', national_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'preview-2', user_id: 'preview-0000-0000-0000-000000000002', username: 'admin.preview', full_name: 'Preview Administrator', role: 'administrator', national_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'preview-3', user_id: 'preview-0000-0000-0000-000000000003', username: 'manager.preview', full_name: 'Ir. Budi Manager, QSHE', role: 'manager', national_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'preview-4', user_id: 'preview-0000-0000-0000-000000000004', username: 'viewer.preview', full_name: 'Preview Viewer', role: 'viewer', national_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ];
      return NextResponse.json({ users: PREVIEW_MOCK_USERS });
    }

    const client = supabaseServiceKey ? supabaseAdmin : supabase;
    const { data, error } = await client
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const lookupHashes = [...new Set((data || []).flatMap(profile => [
      profile.employee_nik_hash,
      profile.national_id ? hashField(profile.national_id) : null,
      profile.username ? hashField(profile.username) : null,
    ]).filter((value): value is string => Boolean(value)))];
    const employeeSelect = 'nik,nik_hash,national_id,national_id_hash,nama,department,job_position,site_name';
    const [byNik, byNationalId] = lookupHashes.length
      ? await Promise.all([
        client.from('employees').select(employeeSelect).in('nik_hash', lookupHashes),
        client.from('employees').select(employeeSelect).in('national_id_hash', lookupHashes),
      ])
      : [{ data: [], error: null }, { data: [], error: null }];
    const employeeError = byNik.error || byNationalId.error;
    if (employeeError) return NextResponse.json({ error: employeeError.message }, { status: 500 });
    const employeeByHash = new Map<string, ReturnType<typeof decryptEmployee>>();
    for (const employee of [...(byNik.data || []), ...(byNationalId.data || [])]) {
      const decrypted = decryptEmployee(employee);
      if (employee.nik_hash) employeeByHash.set(employee.nik_hash, decrypted);
      if (employee.national_id_hash) employeeByHash.set(employee.national_id_hash, decrypted);
    }
    const enrichedUsers = (data || []).map(profile => {
      const employee = [
        profile.employee_nik_hash,
        profile.national_id ? hashField(profile.national_id) : null,
        profile.username ? hashField(profile.username) : null,
      ].map(value => value ? employeeByHash.get(value) : undefined).find(Boolean);
      return {
        ...profile,
        employee_nik: employee?.nik || null,
        employee_national_id: employee?.national_id || profile.national_id || null,
        employee_name: employee?.nama || profile.full_name || null,
        employee_department: employee?.department || null,
        employee_job_position: employee?.job_position || null,
        employee_site: employee?.site_name || profile.site || null,
      };
    });
    return NextResponse.json({ users: enrichedUsers });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// PATCH /api/users — update user role (superuser only)
export async function PATCH(req: NextRequest) {
  try {
    const caller = await getCallerRole(req);
    if (!caller || caller.role !== 'superuser') {
      return NextResponse.json({ error: 'Akses ditolak. Hanya superuser yang dapat mengubah role.' }, { status: 403 });
    }

    const body = await req.json();
    const { id, role } = body;

    if (!id || !role) {
      return NextResponse.json({ error: 'ID dan role wajib diisi' }, { status: 400 });
    }

    const validRoles = ['superuser', 'administrator', 'manager', 'pic', 'viewer', 'employee'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 });
    }

    const { data: targetProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', id)
      .maybeSingle();
    if (!targetProfile) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }
    if (targetProfile.role === 'employee' && role !== 'employee') {
      return NextResponse.json({ error: 'Gunakan pendaftaran role baru agar akun Employee diperbarui dengan password pribadi.' }, { status: 400 });
    }

    const { data: selfProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', caller.userId)
      .single();

    if (selfProfile && selfProfile.id === id) {
      return NextResponse.json({ error: 'Tidak dapat mengubah role sendiri' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .update({ role })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: data });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// DELETE /api/users?id=xxx — delete user (superuser only)
export async function DELETE(req: NextRequest) {
  try {
    const caller = await getCallerRole(req);
    if (!caller || caller.role !== 'superuser') {
      return NextResponse.json({ error: 'Akses ditolak. Hanya superuser yang dapat menghapus pengguna.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: 'ID pengguna wajib diisi' }, { status: 400 });
    }

    const { data: selfProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', caller.userId)
      .single();

    if (selfProfile && selfProfile.id === userId) {
      return NextResponse.json({ error: 'Tidak dapat menghapus akun sendiri' }, { status: 400 });
    }

    const { data: targetProfile } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('id', userId)
      .single();

    if (!targetProfile) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(targetProfile.user_id);
    if (deleteAuthError) {
      return NextResponse.json({ error: deleteAuthError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Pengguna berhasil dihapus' });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
