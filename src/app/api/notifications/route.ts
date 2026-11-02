import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readRegistrationLookupToken } from '@/lib/registration-lookup-token';
import { decryptEmployee, hashField } from '@/lib/encryption';
import { getServerCaller } from '@/lib/server-auth';
import { MIN_PASSWORD_LENGTH } from '@/app/api/auth/change-password-action';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseAnonKey || 'placeholder-anon-key');
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : supabase;

async function getCallerRole(req: NextRequest) {
  const caller = await getServerCaller(req);
  return caller ? { userId: caller.userId, role: caller.role } : null;
}

/** GET /api/notifications — list pending approvals (superuser only) */
export async function GET(req: NextRequest) {
  try {
    const caller = await getCallerRole(req);
    if (!caller || caller.role !== 'superuser') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'Layanan persetujuan belum dikonfigurasi' }, { status: 503 });
    }
    const { data, error } = await supabaseAdmin
      .from('user_approvals')
      .select('id,email,full_name,national_id,nik,jabatan,jobsite,username,role,status,created_at')
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

    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'Layanan persetujuan belum dikonfigurasi' }, { status: 503 });
    }

    // Get the approval request
    const { data: approval, error: fetchError } = await supabaseAdmin
      .from('user_approvals')
      .select('id,email,full_name,national_id,nik,jabatan,jobsite,username,role,status,auth_user_id')
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
      const requestedRole = 'employee';
      if (!approval.auth_user_id) {
        return NextResponse.json({ error: 'Permintaan lama tidak memiliki akun tertunda. Minta karyawan mendaftar ulang.' }, { status: 409 });
      }
      const { data: linkedProfile, error: linkedProfileError } = await supabaseAdmin
        .from('user_profiles')
        .select('id,user_id,role,username,full_name,national_id,employee_nik_hash,site')
        .eq('employee_nik_hash', employeeHash)
        .maybeSingle();
      if (linkedProfileError) {
        return NextResponse.json({ error: 'Gagal memeriksa akun karyawan' }, { status: 500 });
      }

      if (linkedProfile) {
        return NextResponse.json({ error: 'Karyawan ini sudah memiliki profil akun. Tinjau akun tersebut melalui Kelola Pengguna.' }, { status: 409 });
      }

      const { data: pendingAuth, error: pendingAuthError } = await supabaseAdmin.auth.admin.getUserById(approval.auth_user_id);
      if (pendingAuthError || !pendingAuth.user) {
        return NextResponse.json({ error: 'Akun tertunda tidak dapat diverifikasi' }, { status: 409 });
      }
      const { error: activateError } = await supabaseAdmin.auth.admin.updateUserById(approval.auth_user_id, {
        app_metadata: { ...pendingAuth.user.app_metadata, approval_pending: false },
      });
      if (activateError) {
        return NextResponse.json({ error: 'Gagal mengaktifkan akun' }, { status: 500 });
      }

      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          user_id: approval.auth_user_id,
          username: approval.username || approval.email,
          full_name: employeeData.nama || approval.full_name,
          role: requestedRole,
          national_id: employeeData.national_id || approval.national_id || approval.nik,
          employee_nik_hash: employeeHash,
          site: employeeData.site_name || null,
        });

      if (profileError) {
        await supabaseAdmin.auth.admin.updateUserById(approval.auth_user_id, {
          app_metadata: { ...pendingAuth.user.app_metadata, approval_pending: true },
        });
        return NextResponse.json({ error: 'Gagal membuat profil akun' }, { status: 500 });
      }

      // Update approval status
      const { error: approvalUpdateError } = await supabaseAdmin
        .from('user_approvals')
        .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: caller.userId })
        .eq('id', id);
      if (approvalUpdateError) {
        console.error('Failed to mark approved user request:', approvalUpdateError);
        return NextResponse.json({ error: 'Akun disetujui, tetapi status request gagal diperbarui.' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Akun Employee berhasil disetujui' });
    }

    if (action === 'reject') {
      const { error: rejectError } = await supabaseAdmin
        .from('user_approvals')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: caller.userId, reject_reason: body.reason || 'Ditolak' })
        .eq('id', id);
      if (rejectError) return NextResponse.json({ error: 'Gagal menolak permintaan' }, { status: 500 });
      if (approval.auth_user_id) {
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(approval.auth_user_id);
        if (deleteError) console.error('Failed to remove rejected pending account:', deleteError);
      }

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

    if (typeof email !== 'string' || typeof password !== 'string' || !employee) {
      return NextResponse.json({ error: 'Email, password, dan hasil lookup karyawan yang masih berlaku wajib diisi.' }, { status: 400 });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json({ error: 'Email atau password tidak memenuhi kebijakan keamanan.' }, { status: 400 });
    }

    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'Layanan pendaftaran belum dikonfigurasi' }, { status: 503 });
    }
    const employeeHash = hashField(employee.nik);
    if (!employeeHash) return NextResponse.json({ error: 'Identitas karyawan tidak valid' }, { status: 400 });
    const { data: existingProfile } = await supabaseAdmin.from('user_profiles')
      .select('id').eq('employee_nik_hash', employeeHash).maybeSingle();
    if (existingProfile) {
      return NextResponse.json({ error: 'Karyawan sudah memiliki akun. Silakan login atau hubungi Superuser.' }, { status: 409 });
    }

    // Check if email already pending
    const { data: existing } = await supabaseAdmin
      .from('user_approvals')
      .select('id, status')
      .eq('email', email)
      .single();

    if (existing && existing.status === 'pending') {
      return NextResponse.json({ error: 'Email sudah terdaftar dan menunggu persetujuan' }, { status: 409 });
    }

    const { data: createdAuth, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { approval_pending: true },
    });
    if (createAuthError || !createdAuth.user) {
      return NextResponse.json({ error: 'Tidak dapat membuat akun tertunda. Periksa email atau hubungi administrator.' }, { status: 409 });
    }

    const { data, error } = await supabaseAdmin
      .from('user_approvals')
      .insert({
        auth_user_id: createdAuth.user.id,
        email,
        full_name: employee.nama,
        national_id: employee.nationalId,
        nik: employee.nik,
        jabatan: employee.jabatan || null,
        jobsite: employee.jobsite || null,
        username: employee.nik,
        role: 'employee',
        status: 'pending',
      })
      .select('id,email,status,created_at')
      .single();

    if (error) {
      await supabaseAdmin.auth.admin.deleteUser(createdAuth.user.id);
      return NextResponse.json({ error: 'Gagal mengirim permintaan persetujuan' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Pendaftaran berhasil! Menunggu persetujuan superuser.', data });
  } catch (err) {
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  }
}
