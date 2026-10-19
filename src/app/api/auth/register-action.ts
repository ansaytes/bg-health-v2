// register action extracted from src/app/api/auth/route.ts.
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptEmployee, hashField } from '@/lib/encryption';
import {
  findLegacyEmployeeProfile,
  legacyIdentityValues,
  type EmployeeLoginProfile,
} from '@/lib/auth-employee-profile';
import { MIN_PASSWORD_LENGTH, BLOCKED_PASSWORDS } from './change-password-action';

interface RegisterInput {
  username: string;
  password: string;
  role: string;
  fullName: string;
  nationalId: string;
  site: string;
  employeeNik: string;
}

function field(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Coerces and validates all register body fields before any DB access. */
export function validateRegisterInput(body: Record<string, unknown>): { input?: RegisterInput; error?: string; status?: number } {
  const username = field(body.username);
  const password = typeof body.password === 'string' ? body.password : '';
  const role = field(body.role);
  const fullName = field(body.full_name);
  const nationalId = field(body.national_id);
  const site = field(body.site);
  const employeeNik = field(body.employee_nik);

  if (!username) return { error: 'Username wajib diisi', status: 400 };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(username)) {
    return { error: 'Username harus berupa email yang valid', status: 400 };
  }
  if (!password) return { error: 'Password wajib diisi', status: 400 };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: 'Password minimal 8 karakter', status: 400 };
  }
  if (BLOCKED_PASSWORDS.has(password)) {
    return { error: 'Password tidak diperbolehkan', status: 400 };
  }
  if (!role) return { error: 'Role wajib dipilih', status: 400 };
  const validRoles = ['superuser', 'administrator', 'manager', 'pic', 'viewer', 'employee'];
  if (!validRoles.includes(role)) return { error: 'Role tidak valid', status: 400 };
  if (!employeeNik) return { error: 'NIK Karyawan wajib dipilih dari data employee', status: 400 };

  return {
    input: { username, password, role, fullName, nationalId, site, employeeNik },
  };
}

export async function handleRegister(
  req: NextRequest,
  body: Record<string, unknown>,
  ctx: { supabaseAdmin: SupabaseClient; isSuperuser: boolean; isPreview: boolean },
): Promise<NextResponse> {
  if (!ctx.isSuperuser) {
    return NextResponse.json({ error: 'Akses ditolak. Hanya administrator yang dapat mendaftarkan pengguna.' }, { status: 403 });
  }
  if (ctx.isPreview) {
    return NextResponse.json({
      success: true,
      message: 'Pengguna berhasil didaftarkan (preview mode — tidak disimpan ke database)',
      userId: 'preview-' + Date.now(),
    });
  }

  const validation = validateRegisterInput(body);
  if (!validation.input) {
    return NextResponse.json({ error: validation.error }, { status: validation.status ?? 400 });
  }
  const { username, password, role, fullName, nationalId, site, employeeNik } = validation.input;

  const employeeHash = hashField(employeeNik);
  if (!employeeHash) {
    return NextResponse.json({ error: 'NIK Karyawan tidak valid' }, { status: 400 });
  }
  const { data: employee } = await ctx.supabaseAdmin
    .from('employees')
    .select('nik,nama,national_id,site_name,job_position')
    .eq('nik_hash', employeeHash)
    .eq('employment_status', 'Aktif')
    .maybeSingle();
  if (!employee) {
    return NextResponse.json({ error: 'NIK Karyawan tidak ditemukan di data employee aktif' }, { status: 400 });
  }
  const employeeData = decryptEmployee(employee);
  if (role === 'manager' && !/manager/i.test(String(employeeData.job_position || ''))) {
    return NextResponse.json({ error: 'Role Manager hanya untuk karyawan dengan jabatan yang mengandung "Manager"' + (employeeData.job_position ? ` (jabatan saat ini: ${employeeData.job_position})` : '') }, { status: 400 });
  }

  const { data: emailProfiles, error: emailProfileError } = await ctx.supabaseAdmin
    .from('user_profiles').select('id,user_id,role,username,employee_nik_hash').eq('username', username).limit(2);
  if (emailProfileError) return NextResponse.json({ error: 'Gagal memeriksa username' }, { status: 500 });

  const employeeProfileResult = await ctx.supabaseAdmin
    .from('user_profiles')
    .select('id,user_id,role,username,employee_nik_hash,full_name,national_id,site')
    .eq('employee_nik_hash', employeeHash).maybeSingle();
  if (employeeProfileResult.error) return NextResponse.json({ error: 'Gagal memeriksa akun karyawan' }, { status: 500 });

  let employeeProfile = employeeProfileResult.data as EmployeeLoginProfile & { full_name?: string; national_id?: string; site?: string } | null;
  if (!employeeProfile) {
    const legacy = await findLegacyEmployeeProfile(
      ctx.supabaseAdmin,
      legacyIdentityValues(employeeData as { nik?: unknown; national_id?: unknown }),
    );
    if (legacy.error) return NextResponse.json({ error: legacy.error }, { status: legacy.status ?? 500 });
    employeeProfile = legacy.profile as typeof employeeProfile;
  }

  const usernameConflict = emailProfiles?.some(profile => profile.id !== employeeProfile?.id);
  if (usernameConflict || (emailProfiles?.length && !employeeProfile)) {
    return NextResponse.json({ error: 'Username sudah terdaftar' }, { status: 409 });
  }

  if (employeeProfile) {
    if (employeeProfile.role !== 'employee') {
      return NextResponse.json({ error: 'Karyawan ini sudah memiliki akun dengan role lebih tinggi' }, { status: 409 });
    }
    const oldProfile = {
      username: employeeProfile.username, full_name: employeeProfile.full_name, role: employeeProfile.role,
      national_id: employeeProfile.national_id, employee_nik_hash: employeeProfile.employee_nik_hash || null, site: employeeProfile.site,
    };
    const { error: updateProfileError } = await ctx.supabaseAdmin.from('user_profiles').update({
      username, full_name: employeeData.nama || fullName || null, role,
      national_id: employeeData.national_id || nationalId || null, employee_nik_hash: employeeHash,
      site: employeeData.site_name || (role === 'pic' ? (site || null) : null),
    }).eq('id', employeeProfile.id);
    if (updateProfileError) return NextResponse.json({ error: updateProfileError.message }, { status: 500 });

    const { data: existingAuthUser, error: existingAuthError } = await ctx.supabaseAdmin.auth.admin.getUserById(employeeProfile.user_id);
    if (existingAuthError || !existingAuthUser.user) {
      await ctx.supabaseAdmin.from('user_profiles').update(oldProfile).eq('id', employeeProfile.id);
      return NextResponse.json({ error: 'Akun karyawan tidak dapat diverifikasi' }, { status: 500 });
    }
    const { error: updateAuthError } = await ctx.supabaseAdmin.auth.admin.updateUserById(employeeProfile.user_id, {
      email: username, password, email_confirm: true,
      app_metadata: { ...existingAuthUser.user.app_metadata, must_change_password: false },
    });
    if (updateAuthError) {
      await ctx.supabaseAdmin.from('user_profiles').update(oldProfile).eq('id', employeeProfile.id);
      return NextResponse.json({ error: updateAuthError.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, message: 'Akun Employee berhasil ditingkatkan. Role lama telah diganti.', userId: employeeProfile.user_id });
  }

  const { data: newUser, error: createError } = await ctx.supabaseAdmin.auth.admin.createUser({
    email: username, password, email_confirm: true,
  });
  if (createError || !newUser.user) {
    return NextResponse.json({ error: createError?.message || 'Gagal membuat pengguna' }, { status: 500 });
  }

  const { error: profileError } = await ctx.supabaseAdmin.from('user_profiles').insert({
    user_id: newUser.user.id, username,
    full_name: employeeData.nama || fullName || null, role,
    national_id: employeeData.national_id || nationalId || null, employee_nik_hash: employeeHash,
    site: employeeData.site_name || (role === 'pic' ? (site || null) : null),
  });
  if (profileError) {
    await ctx.supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, message: 'Pengguna berhasil didaftarkan', userId: newUser.user.id });
}
