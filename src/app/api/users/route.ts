import { NextRequest, NextResponse } from 'next/server';
import { decryptEmployee, hashField } from '@/lib/encryption';
import { getServerCaller, requireServerRole } from '@/lib/server-auth';
import { integrationAdminClient } from '@/lib/integration-settings';

/** Pakai server-auth.ts agar konsisten dengan semua API lain — tidak duplikasi logika auth. */
const adminClient = () => integrationAdminClient();

// GET /api/users — list all users (superuser only)
export async function GET(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    const denied = requireServerRole(caller, ['superuser']);
    if (denied) return denied;

    const client = adminClient();
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
    const caller = await getServerCaller(req);
    const denied = requireServerRole(caller, ['superuser']);
    if (denied) return denied;

    const body = await req.json();
    const { id, role } = body;

    if (!id || !role) {
      return NextResponse.json({ error: 'ID dan role wajib diisi' }, { status: 400 });
    }

    const validRoles = ['superuser', 'administrator', 'manager', 'hc', 'pic', 'employee', 'disabled'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 });
    }

    const client = adminClient();
    const { data: targetProfile } = await client
      .from('user_profiles')
      .select('role,employee_nik_hash')
      .eq('id', id)
      .maybeSingle();
    if (!targetProfile) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }
    // Role Manager hanya untuk karyawan dengan jabatan yang mengandung "manager"
    if (role === 'manager') {
      const { data: emp } = targetProfile.employee_nik_hash
        ? await client.from('employees').select('job_position').eq('nik_hash', targetProfile.employee_nik_hash).maybeSingle()
        : { data: null };
      const jabatan = emp ? String(decryptEmployee(emp).job_position || '') : '';
      if (!/manager/i.test(jabatan)) {
        return NextResponse.json({ error: 'Role Manager hanya untuk karyawan dengan jabatan yang mengandung "Manager"' + (jabatan ? ` (jabatan saat ini: ${jabatan})` : '') }, { status: 400 });
      }
    }
    if (targetProfile.role === 'employee' && role !== 'employee') {
      return NextResponse.json({ error: 'Gunakan pendaftaran role baru agar akun Employee diperbarui dengan password pribadi.' }, { status: 400 });
    }

    // Cegah ubah role sendiri
    const { data: selfProfile } = await client
      .from('user_profiles')
      .select('id')
      .eq('user_id', caller!.userId)
      .single();

    if (selfProfile && selfProfile.id === id) {
      return NextResponse.json({ error: 'Tidak dapat mengubah role sendiri' }, { status: 400 });
    }

    const { data, error } = await client
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
    const caller = await getServerCaller(req);
    const denied = requireServerRole(caller, ['superuser']);
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: 'ID pengguna wajib diisi' }, { status: 400 });
    }

    const client = adminClient();

    // Cegah hapus akun sendiri
    const { data: selfProfile } = await client
      .from('user_profiles')
      .select('id')
      .eq('user_id', caller!.userId)
      .single();

    if (selfProfile && selfProfile.id === userId) {
      return NextResponse.json({ error: 'Tidak dapat menghapus akun sendiri' }, { status: 400 });
    }

    const { data: targetProfile } = await client
      .from('user_profiles')
      .select('user_id')
      .eq('id', userId)
      .maybeSingle();
    if (!targetProfile) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    const { error: deleteAuthError } = await client.auth.admin.deleteUser(targetProfile.user_id);
    if (deleteAuthError) {
      return NextResponse.json({ error: deleteAuthError.message }, { status: 500 });
    }

    const { error: deleteProfileError } = await client
      .from('user_profiles')
      .delete()
      .eq('id', userId);
    if (deleteProfileError) {
      return NextResponse.json({ error: deleteProfileError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Pengguna berhasil dihapus' });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
