import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : supabase;

// Preview mode handling: if access token is the preview mock token,
// treat caller as the role specified in NEXT_PUBLIC_PREVIEW_ROLE.
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
  // Preview mode bypass — preview mode is set in .env.local via NEXT_PUBLIC_PREVIEW_ROLE
  if (accessToken === 'preview-access-token' && PREVIEW_ROLE) {
    return { userId: 'preview-0000-0000-0000-000000000001', role: PREVIEW_ROLE };
  }


  // Pakai admin client (service role) untuk getUser — bypass RLS
  const client = supabaseServiceKey ? supabaseAdmin : supabase;
  const { data: { user }, error } = await client.auth.getUser(accessToken);
  if (error || !user) return null;

  // Baca profile dengan admin client (bypass RLS di user_profiles)
  const { data: profile } = await client
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!profile) return null;
  return { userId: user.id, role: profile.role };
}

// GET /api/users — list all users (admin/superuser only)
export async function GET(req: NextRequest) {
  try {
    const caller = await getCallerRole(req);
    if (!caller || !['superuser', 'administrator'].includes(caller.role)) {
      return NextResponse.json({ 
        error: 'Akses ditolak',
        detail: !caller ? 'Tidak bisa memverifikasi sesi login. Pastikan SUPABASE_SERVICE_ROLE_KEY sudah diisi.' : 'Role Anda tidak punya akses ke halaman ini.',
        caller_found: !!caller,
        caller_role: caller?.role || null,
      }, { status: 403 });
    }

    // Preview mode: return mock user list so admin UI works without real Supabase
    const PREVIEW_TOKEN_VAL = 'preview-access-token';
    const reqAuthToken = req.headers.get('authorization')?.replace('Bearer ', '');
    if (reqAuthToken === PREVIEW_TOKEN_VAL && PREVIEW_ROLE) {
      const PREVIEW_MOCK_USERS = [
        { id: 'preview-1', user_id: 'preview-0000-0000-0000-000000000001', username: 'superuser.preview', full_name: 'Preview Superuser', role: 'superuser', national_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'preview-2', user_id: 'preview-0000-0000-0000-000000000002', username: 'admin.preview', full_name: 'Preview Administrator', role: 'administrator', national_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'preview-3', user_id: 'preview-0000-0000-0000-000000000003', username: 'viewer.preview', full_name: 'Preview Viewer', role: 'viewer', national_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ];
      return NextResponse.json({ users: PREVIEW_MOCK_USERS });
    }

    // Pakai admin client untuk bypass RLS
    const client = supabaseServiceKey ? supabaseAdmin : supabase;
    const { data, error } = await client
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: data });
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

    const validRoles = ['superuser', 'administrator', 'viewer'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 });
    }

    // Prevent self-demotion
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

    // Prevent self-deletion
    const { data: selfProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', caller.userId)
      .single();

    if (selfProfile && selfProfile.id === userId) {
      return NextResponse.json({ error: 'Tidak dapat menghapus akun sendiri' }, { status: 400 });
    }

    // Get the auth user_id from the profile
    const { data: targetProfile } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('id', userId)
      .single();

    if (!targetProfile) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    // Delete the profile (cascade will handle auth.users via ON DELETE CASCADE? No — RLS won't cascade to auth)
    // Delete auth user via admin API
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(targetProfile.user_id);
    if (deleteAuthError) {
      return NextResponse.json({ error: deleteAuthError.message }, { status: 500 });
    }

    // Profile will be deleted by ON DELETE CASCADE on auth.users(id)
    return NextResponse.json({ success: true, message: 'Pengguna berhasil dihapus' });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
