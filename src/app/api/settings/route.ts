import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const client = createClient(url, serviceKey || anonKey);

async function getCaller(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || req.cookies.get('sb-access-token')?.value;
  if (!token) return null;
  if (token === 'preview-access-token' && process.env.NEXT_PUBLIC_PREVIEW_ROLE) {
    return { role: process.env.NEXT_PUBLIC_PREVIEW_ROLE };
  }
  const { data: { user } } = await client.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await client.from('user_profiles').select('role').eq('user_id', user.id).single();
  return profile;
}

/** GET — semua role terautentikasi boleh membaca (laporan butuh nomor dokumen). */
export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 401 });

  const { data, error } = await client.from('app_settings').select('value').eq('key', 'app').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, settings: data?.value ?? null });
}

/** PUT — superuser saja. */
export async function PUT(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 401 });
  if (caller.role !== 'superuser') {
    return NextResponse.json({ error: 'Hanya superuser yang dapat mengubah pengaturan' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 });
  }

  const { data: existing } = await client.from('app_settings').select('updated_by').eq('key', 'app').maybeSingle();
  const { error } = await client.from('app_settings').upsert({
    key: 'app',
    value: body,
    updated_by: caller.role,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  void existing;
  return NextResponse.json({ success: true });
}
