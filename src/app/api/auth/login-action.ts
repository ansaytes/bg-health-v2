// Login action extracted from src/app/api/auth/route.ts.
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptEmployee, hashField } from '@/lib/encryption';
import {
  findLegacyEmployeeProfile,
  legacyIdentityValues,
  type EmployeeLoginProfile,
} from '@/lib/auth-employee-profile';
import { orEq } from '@/lib/sql-safety';

export function isNumericIdentifier(username: string): boolean {
  return /^\d+$/.test(username);
}

export function requireEmployeeLoginConfigured(supabaseServiceKey: string): NextResponse | null {
  if (!supabaseServiceKey) {
    return NextResponse.json({ error: 'Login karyawan belum dikonfigurasi. Hubungi administrator.' }, { status: 500 });
  }
  return null;
}

/**
 * Resolves (or provisions) the auth account behind a numeric NIK/National-ID
 * login, returning the real Supabase email to sign in with.
 */
export async function resolveEmployeeLogin(
  supabaseAdmin: SupabaseClient,
  username: string,
  _password: string,
): Promise<{ loginEmail?: string; error?: string; status?: number }> {
  const identifierHash = hashField(username);
  if (!identifierHash) {
    return { error: 'Identitas login tidak valid', status: 400 };
  }
  const { data: employees, error: employeeError } = await supabaseAdmin
    .from('employees')
    .select('nik,nik_hash,national_id,national_id_hash,nama,site_name,employment_status')
    .or(`${orEq('nik_hash', identifierHash)},${orEq('national_id_hash', identifierHash)}`)
    .ilike('employment_status', 'Aktif')
    .limit(2);
  if (employeeError) {
    console.error('Employee login lookup failed:', employeeError);
    return { error: 'Gagal memeriksa data karyawan', status: 500 };
  }
  if (!employees?.length || employees.length > 1) {
    return { error: 'NIK Karyawan atau National ID tidak ditemukan', status: 401 };
  }
  const employee = employees[0];
  const employeeData = decryptEmployee(employee);
  const employeeHash = employee.nik_hash || hashField(String(employeeData.nik ?? ''));
  if (!employeeHash) {
    return { error: 'Data NIK Karyawan tidak valid', status: 500 };
  }

  let profile: EmployeeLoginProfile | null = null;
  const { data: linkedProfile, error: linkedProfileError } = await supabaseAdmin
    .from('user_profiles')
    .select('id,user_id,role,username,employee_nik_hash')
    .eq('employee_nik_hash', employeeHash)
    .maybeSingle();
  if (linkedProfileError) {
    console.error('Employee profile lookup failed:', linkedProfileError);
    return { error: 'Gagal memeriksa akun karyawan', status: 500 };
  }
  profile = linkedProfile;

  if (!profile) {
    const legacy = await findLegacyEmployeeProfile(
      supabaseAdmin,
      legacyIdentityValues(employeeData as { nik?: unknown; national_id?: unknown }),
    );
    if (legacy.error) return { error: legacy.error, status: legacy.status };
    profile = legacy.profile;
  }

  if (!profile) {
    return { error: 'NIK/National ID atau password salah', status: 401 };
  } else if (!profile.employee_nik_hash) {
    const { error: linkError } = await supabaseAdmin
      .from('user_profiles')
      .update({ employee_nik_hash: employeeHash })
      .eq('id', profile.id);
    if (linkError) {
      console.error('Legacy employee profile linking failed:', linkError);
      return { error: 'Gagal menghubungkan profil dengan data karyawan', status: 500 };
    }
  }

  const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
  if (authUserError || !authUser.user?.email) {
    console.error('Employee auth user lookup failed:', authUserError);
    return { error: 'Akun karyawan tidak dapat diverifikasi', status: 500 };
  }
  return { loginEmail: authUser.user.email };
}

export async function handleLogin(
  body: Record<string, unknown>,
  ctx: { supabase: SupabaseClient; supabaseAdmin: SupabaseClient; supabaseServiceKey: string },
): Promise<NextResponse> {
  const username = String(body.username ?? '').trim();
  const password = String(body.password ?? '');
  if (!username || !password) {
    return NextResponse.json({ error: 'NIK Karyawan, National ID, atau email dan password wajib diisi' }, { status: 400 });
  }
  if (!ctx.supabaseServiceKey) {
    return NextResponse.json({ error: 'Layanan autentikasi belum dikonfigurasi' }, { status: 503 });
  }
  const identifierHash = hashField(username.toLowerCase());
  if (!identifierHash) {
    return NextResponse.json({ error: 'NIK/National ID/email atau password salah' }, { status: 401 });
  }
  const { data: allowed, error: throttleError } = await ctx.supabaseAdmin.rpc('consume_login_attempt', {
    p_identifier_hash: identifierHash,
    p_limit: 10,
    p_window_seconds: 900,
  });
  if (throttleError) {
    console.error('Login rate limiter is unavailable:', throttleError);
    return NextResponse.json({ error: 'Layanan autentikasi sementara tidak tersedia' }, { status: 503 });
  }
  if (allowed !== true) {
    return NextResponse.json(
      { error: 'Terlalu banyak percobaan masuk. Coba kembali beberapa menit lagi.' },
      { status: 429, headers: { 'Retry-After': '900' } },
    );
  }

  let loginEmail = username;
  if (isNumericIdentifier(username)) {
    const notConfigured = requireEmployeeLoginConfigured(ctx.supabaseServiceKey);
    if (notConfigured) return notConfigured;
    const resolved = await resolveEmployeeLogin(
      ctx.supabaseAdmin, username, password,
    );
    if (resolved.error) {
      return NextResponse.json({
        error: resolved.status === 401 ? 'NIK/National ID/email atau password salah' : resolved.error,
      }, { status: resolved.status ?? 500 });
    }
    if (!resolved.loginEmail) {
      return NextResponse.json({ error: 'Akun karyawan tidak dapat diverifikasi' }, { status: 500 });
    }
    loginEmail = resolved.loginEmail;
  }

  const { data, error } = await ctx.supabase.auth.signInWithPassword({ email: loginEmail, password });
  if (error) return NextResponse.json({ error: 'NIK/National ID/email atau password salah' }, { status: 401 });

  let profile: ({ role: string } & Record<string, unknown>) | null = null;
  if (data.user) {
    const { data: pData } = await ctx.supabaseAdmin
      .from('user_profiles').select('*').eq('user_id', data.user.id).single();
    profile = pData;
  }
  if (!profile) return NextResponse.json({ error: 'Profil akun tidak ditemukan. Hubungi administrator.' }, { status: 403 });
  if (profile.role === 'viewer' || profile.role === 'disabled') {
    return NextResponse.json({ error: 'Akses akun dinonaktifkan. Hubungi Superuser.' }, { status: 403 });
  }
  if (data.user?.app_metadata?.approval_pending === true) {
    return NextResponse.json({ error: 'Pendaftaran masih menunggu persetujuan Superuser.' }, { status: 403 });
  }

  return NextResponse.json({
    session: data.session, user: data.user, profile,
    mustChangePassword: data.user?.app_metadata?.must_change_password === true,
  });
}
