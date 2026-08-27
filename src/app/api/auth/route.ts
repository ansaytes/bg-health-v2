import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Client-side Supabase (anon key) — for login, logout, session
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side admin client (service role) — for creating users
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Helper: verify session and get user profile role
async function getSessionRole(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  let accessToken = authHeader?.replace('Bearer ', '');

  // Fallback: check cookie
  if (!accessToken) {
    const cookie = req.cookies.get('sb-access-token')?.value;
    if (cookie) accessToken = cookie;
  }

  if (!accessToken) return null;

  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) return null;

  // Get profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, full_name, username')
    .eq('user_id', user.id)
    .single();

  return {
    user,
    role: (profile?.role as string) || 'viewer',
    profile,
  };
}

// POST /api/auth/login
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // --- LOGIN ---
    if (action === 'login') {
      const { username, password } = body;
      if (!username || !password) {
        return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 });
      }

      // Supabase Auth uses email — we store username as email
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username,
        password,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      // Fetch profile
      let profile = null;
      if (data.user) {
        const { data: pData } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', data.user.id)
          .single();
        profile = pData;
      }

      return NextResponse.json({
        session: data.session,
        user: data.user,
        profile,
      });
    }

    // --- REGISTER (admin only) ---
    if (action === 'register') {
      const { username, password, role, full_name, national_id } = body;

      // Verify caller is admin/superuser
      const authInfo = await getSessionRole(req);
      if (!authInfo || !['superuser', 'administrator'].includes(authInfo.role)) {
        return NextResponse.json({ error: 'Akses ditolak. Hanya administrator yang dapat mendaftarkan pengguna.' }, { status: 403 });
      }

      if (!username || !password || !role) {
        return NextResponse.json({ error: 'Username, password, dan role wajib diisi' }, { status: 400 });
      }

      const validRoles = ['superuser', 'administrator', 'viewer'];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 });
      }

      // Only superuser can create superuser or administrator
      if (authInfo.role === 'administrator' && role !== 'viewer') {
        return NextResponse.json({ error: 'Administrator hanya dapat membuat akun viewer' }, { status: 403 });
      }

      // Check if username already exists in profiles
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('username', username)
        .single();

      if (existingProfile) {
        return NextResponse.json({ error: 'Username sudah terdaftar' }, { status: 409 });
      }

      // Create auth user via admin API
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: username,
        password,
        email_confirm: true,
      });

      if (createError || !newUser.user) {
        return NextResponse.json({ error: createError?.message || 'Gagal membuat pengguna' }, { status: 500 });
      }

      // Insert profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: newUser.user.id,
          username,
          full_name: full_name || null,
          role,
          national_id: national_id || null,
        });

      if (profileError) {
        // Rollback: delete the auth user
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Pengguna berhasil didaftarkan',
        userId: newUser.user.id,
      });
    }

    // --- LOGOUT ---
    if (action === 'logout') {
      const authHeader = req.headers.get('authorization');
      let accessToken = authHeader?.replace('Bearer ', '');
      if (!accessToken) {
        const cookie = req.cookies.get('sb-access-token')?.value;
        if (cookie) accessToken = cookie;
      }

      if (accessToken) {
        // Set the session on the server client and sign out
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: '' });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Action tidak valid' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// GET /api/auth/session
export async function GET(req: NextRequest) {
  try {
    const authInfo = await getSessionRole(req);
    if (!authInfo) {
      return NextResponse.json({ user: null, profile: null, role: null });
    }
    return NextResponse.json({
      user: authInfo.user,
      profile: authInfo.profile,
      role: authInfo.role,
    });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
