import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readRegistrationLookupToken } from '@/lib/registration-lookup-token';
import { decryptEmployee, hashField } from '@/lib/encryption';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseAnonKey || 'placeholder-anon-key');
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : supabase;

// Preview mode handling
const PREVIEW_ROLE = process.env.NEXT_PUBLIC_PREVIEW_ROLE as string | undefined;

async function getCallerRole(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  let accessToken = authHeader?.replace('Bearer ', '');
  if (!accessToken) {
    const cookie = req.cookies.get('sb-access-token')?.value;
    if (cookie) accessToken = cookie;
  }
  if (!accessToken) return null;
  // Preview mode bypass
  if (accessToken === 'preview-access-token' && PREVIEW_ROLE) {
    return { userId: 'preview-0000-0000-0000-000000000001', role: PREVIEW_ROLE };
  }

  const client = supabaseServiceKey ? supabaseAdmin : createClient(supabaseUrl, supabaseAnonKey);
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

/** GET /api/notifications — list pending approvals (superuser only) */
export async function GET(req: NextRequest) {
  try {
    const caller = await getCallerRole(req);
    if (!caller || caller.role !== 'superuser') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const client = supabaseServiceKey ? supabaseAdmin : createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await client
      .from('user_approvals')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ notifications: data || [] });
  } catch (err) {
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  }
}

/** PATCH /api/notifications — approve or reject user */
export async function PATCH(req: NextRequest) {
  try {
    const caller = await getCallerRole(req);
    if (!caller || caller.role !== 'superuser') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await req.json();
    const { id, action } = body;

    if (!id || !action) {
      return NextResponse.json({ error: 'ID dan action wajib diisi' }, { status: 400 });
    }

    const client = supabaseServiceKey ? supabaseAdmin : createClient(supabaseUrl, supabaseAnonKey);

    // Get the approval request
    const { data: approval, error: fetchError } = await client
      .from('user_approvals')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !approval) {
      return NextResponse.json({ error: 'Request tidak ditemukan' }, { status: 404 });
    }

    if (action === 'approve') {
      const employeeHash = hashField(String(approval.nik || '').trim());
      if (!employeeHash) {
        return NextResponse.json({ error: 'NIK Karyawan pada permintaan ini tidak valid' }, { status: 400 });
      }
      const { data: employee, error: employeeError } = await supabaseAdmin
        .from('employees')
        .select('nik,national_id,nama,site_name,nik_hash')
        .eq('nik_hash', employeeHash)
        .eq('employment_status', 'Aktif')
        .maybeSingle();
      if (employeeError || !employee) {
        return NextResponse.json({ error: 'Karyawan aktif tidak ditemukan. Request tidak dapat disetujui.' }, { status: 400 });
      }
      const employeeData = decryptEmployee(employee);
      const requestedRole = approval.role || 'viewer';
      const { data: linkedProfile, error: linkedProfileError } = await supabaseAdmin
        .from('user_profiles')
        .select('id,user_id,role,username,full_name,national_id,employee_nik_hash,site')
        .eq('employee_nik_hash', employeeHash)
        .maybeSingle();
      if (linkedProfileError) {
        return NextResponse.json({ error: 'Gagal memeriksa akun karyawan' }, { status: 500 });
      }

      if (linkedProfile) {
        if (linkedProfile.role !== 'employee') {
          return NextResponse.json({ error: 'Karyawan ini sudah memiliki akun dengan role lebih tinggi.' }, { status: 409 });
        }
        const oldProfile = {
          username: linkedProfile.username,
          full_name: linkedProfile.full_name,
          role: linkedProfile.role,
          national_id: linkedProfile.national_id,
          employee_nik_hash: linkedProfile.employee_nik_hash,
          site: linkedProfile.site,
        };
        const { error: updateProfileError } = await supabaseAdmin
          .from('user_profiles')
          .update({
            username: approval.username || approval.email,
            full_name: employeeData.nama || approval.full_name,
            role: requestedRole,
            national_id: employeeData.national_id || approval.national_id,
            employee_nik_hash: employeeHash,
            site: employeeData.site_name || null,
          })
          .eq('id', linkedProfile.id);
        if (updateProfileError) {
          return NextResponse.json({ error: updateProfileError.message }, { status: 500 });
        }
        const { data: existingAuthUser, error: existingAuthError } = await supabaseAdmin.auth.admin.getUserById(linkedProfile.user_id);
        if (existingAuthError || !existingAuthUser.user) {
          await supabaseAdmin.from('user_profiles').update(oldProfile).eq('id', linkedProfile.id);
          return NextResponse.json({ error: 'Akun karyawan tidak dapat diverifikasi' }, { status: 500 });
        }
        const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(linkedProfile.user_id, {
          email: approval.email,
          password: approval.password,
          email_confirm: true,
          app_metadata: { ...existingAuthUser.user.app_metadata, must_change_password: false },
        });
        if (updateAuthError) {
          await supabaseAdmin.from('user_profiles').update(oldProfile).eq('id', linkedProfile.id);
          return NextResponse.json({ error: updateAuthError.message }, { status: 500 });
        }
        const { error: approvalUpdateError } = await client.from('user_approvals')
          .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: caller.userId })
          .eq('id', id);
        if (approvalUpdateError) {
          console.error('Failed to mark approved user request:', approvalUpdateError);
          return NextResponse.json({ error: 'Akun diperbarui, tetapi status request gagal diperbarui.' }, { status: 500 });
        }
        return NextResponse.json({ success: true, message: 'Akun Employee berhasil ditingkatkan. Role lama telah diganti.' });
      }

      // Create auth user via admin API
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: approval.email,
        password: approval.password,
        email_confirm: true,
      });

      if (createError || !newUser.user) {
        return NextResponse.json({ error: createError?.message || 'Gagal membuat user' }, { status: 500 });
      }

      // Insert profile
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          user_id: newUser.user.id,
          username: approval.username || approval.email,
          full_name: employeeData.nama || approval.full_name,
          role: requestedRole,
          national_id: employeeData.national_id || approval.national_id || approval.nik,
          employee_nik_hash: employeeHash,
          site: employeeData.site_name || null,
        });

      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }

      // Update approval status
      const { error: approvalUpdateError } = await client
        .from('user_approvals')
        .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: caller.userId })
        .eq('id', id);
      if (approvalUpdateError) {
        console.error('Failed to mark approved user request:', approvalUpdateError);
        return NextResponse.json({ error: 'Akun dibuat, tetapi status request gagal diperbarui.' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'User berhasil disetujui dan dibuat' });
    }

    if (action === 'reject') {
      await client
        .from('user_approvals')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: caller.userId, reject_reason: body.reason || 'Ditolak' })
        .eq('id', id);

      return NextResponse.json({ success: true, message: 'Request ditolak' });
    }

    return NextResponse.json({ error: 'Action tidak valid' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  }
}

/** POST /api/notifications — submit new registration request (public) */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, employee_lookup_token } = body;
    const employee = readRegistrationLookupToken(employee_lookup_token);

    if (!email || !password || !employee) {
      return NextResponse.json({ error: 'Email, password, dan hasil lookup karyawan yang masih berlaku wajib diisi.' }, { status: 400 });
    }

    const client = supabaseServiceKey ? supabaseAdmin : createClient(supabaseUrl, supabaseAnonKey);

    // Check if email already pending
    const { data: existing } = await client
      .from('user_approvals')
      .select('id, status')
      .eq('email', email)
      .single();

    if (existing && existing.status === 'pending') {
      return NextResponse.json({ error: 'Email sudah terdaftar dan menunggu persetujuan' }, { status: 409 });
    }

    const { data, error } = await client
      .from('user_approvals')
      .insert({
        email,
        password,
        full_name: employee.nama,
        national_id: employee.nationalId,
        nik: employee.nik,
        jabatan: employee.jabatan || null,
        jobsite: employee.jobsite || null,
        username: employee.nik,
        role: 'viewer',
        status: 'pending',
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, message: 'Pendaftaran berhasil! Menunggu persetujuan superuser.', data });
  } catch (err) {
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  }
}
