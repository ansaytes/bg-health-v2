import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
      const { error: profileError } = await client
        .from('user_profiles')
        .insert({
          user_id: newUser.user.id,
          username: approval.username || approval.email,
          full_name: approval.full_name,
          role: approval.role || 'viewer',
          national_id: approval.national_id || approval.nik,
        });

      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }

      // Update approval status
      await client
        .from('user_approvals')
        .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: caller.userId })
        .eq('id', id);

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
    const { email, password, full_name, national_id, nik, jabatan, jobsite } = body;

    if (!email || !password || !nik) {
      return NextResponse.json({ error: 'Email, password, dan NIK wajib diisi' }, { status: 400 });
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
        full_name: full_name || null,
        national_id: national_id || nik,
        nik,
        jabatan: jabatan || null,
        jobsite: jobsite || null,
        username: nik,
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
