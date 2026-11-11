import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export interface ServerCaller {
  userId: string;
  role: string;
  site: string | null;
  employeeNikHash: string | null;
}

export async function getServerCaller(request: NextRequest): Promise<ServerCaller | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    || request.cookies.get('sb-access-token')?.value
    || '';
  if (!token) return null;
  if (!supabaseUrl || !serviceKey) return null;

  const client = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) return null;
  if (user.app_metadata?.approval_pending === true) return null;

  const { data: profile, error: profileError } = await client
    .from('user_profiles')
    .select('role,site,employee_nik_hash')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profileError || !profile || profile.role === 'viewer' || profile.role === 'disabled') return null;

  let site = typeof profile.site === 'string' ? profile.site : null;
  if (profile.role === 'pic' && profile.employee_nik_hash) {
    const { data: employee } = await client
      .from('employees')
      .select('site_name')
      .eq('nik_hash', profile.employee_nik_hash)
      .maybeSingle();
    site = employee?.site_name || site;
  }

  return {
    userId: user.id,
    role: String(profile.role),
    site,
    employeeNikHash: profile.employee_nik_hash || null,
  };
}

export function requireServerRole(
  caller: ServerCaller | null,
  roles: readonly string[],
): NextResponse | null {
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Autentikasi server belum dikonfigurasi.' }, { status: 503 });
  }
  if (!caller) return NextResponse.json({ error: 'Sesi login tidak valid' }, { status: 401 });
  if (!roles.includes(caller.role)) return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  return null;
}

export const STAFF_ROLES = ['superuser', 'administrator', 'pic'] as const;
export const READ_ROLES = ['superuser', 'administrator', 'pic', 'manager'] as const;
export const SYSTEM_ROLES = ['superuser'] as const;
