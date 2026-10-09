// src/lib/hc-ergo-server.ts — helper server untuk API /api/hc dan /api/ergo (pola sama dengan /api/mcu/records)
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const db = createClient(url, serviceKey || anonKey);

export const ALLOWED_ROLES = ['administrator', 'superuser'];

export interface Caller { role: string; name: string; }

/** Verifikasi token Supabase dan ambil role + nama dari user_profiles. */
export async function getCaller(req: NextRequest): Promise<Caller | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || req.cookies.get('sb-access-token')?.value;
  if (!token) return null;
  if (token === 'preview-access-token' && process.env.NEXT_PUBLIC_PREVIEW_ROLE) {
    return { role: process.env.NEXT_PUBLIC_PREVIEW_ROLE, name: 'preview' };
  }
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await db.from('user_profiles').select('role, username, full_name').eq('user_id', user.id).single();
  if (!profile) return null;
  return { role: profile.role, name: profile.full_name || profile.username || 'user' };
}

export async function requireCaller(req: NextRequest): Promise<{ caller: Caller } | { error: NextResponse }> {
  const caller = await getCaller(req);
  if (!caller || !ALLOWED_ROLES.includes(caller.role)) {
    return { error: NextResponse.json({ success: false, error: 'Akses ditolak' }, { status: 403 }) };
  }
  return { caller };
}

export const ok = (data: unknown, extra: Record<string, unknown> = {}) => NextResponse.json({ success: true, data, ...extra });
export const fail = (message: string, status = 400) => NextResponse.json({ success: false, error: message }, { status });
export const today = () => new Date().toISOString().slice(0, 10);
