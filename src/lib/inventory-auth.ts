import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

export const inventorySupabase = createClient(supabaseUrl, supabaseKey);

export async function getInventoryCallerRole(request: NextRequest): Promise<string | null> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
    || request.cookies.get('sb-access-token')?.value;
  if (!token) return null;

  const { data: { user }, error: authError } = await inventorySupabase.auth.getUser(token);
  if (authError || !user) return null;

  const { data: profile, error: profileError } = await inventorySupabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError || !profile) return null;
  return profile.role;
}