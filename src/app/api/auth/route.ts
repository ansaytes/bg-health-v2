import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { handleLogin } from './login-action';
import { handleChangePassword } from './change-password-action';
import { handleRegister } from './register-action';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : supabase;

async function getSessionRole(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  let accessToken = authHeader?.replace('Bearer ', '');
  if (!accessToken) {
    const cookie = req.cookies.get('sb-access-token')?.value;
    if (cookie) accessToken = cookie;
  }
  if (!accessToken) return null;
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) return null;
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('role, full_name, username, site, employee_nik_hash')
    .eq('user_id', user.id)
    .single();
  return { user, role: (profile?.role as string) || 'disabled', profile };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    const ctx = {
      supabase, supabaseAdmin, supabaseServiceKey,
    };

    if (action === 'login') return handleLogin(body, ctx);
    if (action === 'change-password') return handleChangePassword(req, body, ctx);

    if (action === 'register') {
      const authInfo = await getSessionRole(req);
      const isSuperuser = authInfo?.role === 'superuser';
      return handleRegister(body, { supabaseAdmin, isSuperuser });
    }

    return NextResponse.json({ error: 'Action tidak dikenal' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
