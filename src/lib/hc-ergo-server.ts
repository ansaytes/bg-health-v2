// src/lib/hc-ergo-server.ts — helper server untuk API /api/hc dan /api/ergo (pola sama dengan /api/mcu/records)
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptEmployee } from '@/lib/encryption';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const db = createClient(url, serviceKey || anonKey);

/** Roles that may access HC & Ergo modules (view + input). */
export const ALLOWED_ROLES = ['administrator', 'superuser', 'manager', 'pic'];

/** Roles that may approve / reject ergo surveys (QSHE Manager sign-off). */
export const APPROVER_ROLES = ['administrator', 'superuser', 'manager'];

export interface Caller { role: string; name: string; jabatan: string | null; }

/** Verifikasi token Supabase dan ambil role + nama dari user_profiles. */
export async function getCaller(req: NextRequest): Promise<Caller | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || req.cookies.get('sb-access-token')?.value;
  if (!token) return null;
  if (token === 'preview-access-token' && process.env.NEXT_PUBLIC_PREVIEW_ROLE) {
    return { role: process.env.NEXT_PUBLIC_PREVIEW_ROLE, name: 'Preview User', jabatan: 'Preview' };
  }
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await db.from('user_profiles').select('role, username, full_name, employee_nik_hash').eq('user_id', user.id).single();
  if (!profile) return null;
  // Nama & jabatan penyetuju diambil otomatis dari data employee yang tertaut ke akun.
  let name: string = profile.full_name || profile.username || 'user';
  let jabatan: string | null = null;
  if (profile.employee_nik_hash) {
    const { data: emp } = await db.from('employees').select('nama, job_position').eq('nik_hash', profile.employee_nik_hash).maybeSingle();
    if (emp) {
      const d = decryptEmployee(emp);
      name = d.nama || name;
      jabatan = d.job_position || null;
    }
  }
  return { role: profile.role, name, jabatan };
}

export async function requireCaller(req: NextRequest, roles: string[] = ADMIN_ROLES): Promise<{ caller: Caller } | { error: NextResponse }> {
  const caller = await getCaller(req);
  if (!caller || !roles.includes(caller.role)) {
    return { error: NextResponse.json({ success: false, error: 'Akses ditolak' }, { status: 403 }) };
  }
  return { caller };
}

export async function requireApprover(req: NextRequest): Promise<{ caller: Caller } | { error: NextResponse }> {
  const caller = await getCaller(req);
  if (!caller || !APPROVER_ROLES.includes(caller.role)) {
    return { error: NextResponse.json({ success: false, error: 'Hanya QSHE Manager / Administrator / Superuser yang dapat menyetujui atau menolak survei.' }, { status: 403 }) };
  }
  return { caller };
}

export const ok = (data: unknown, extra: Record<string, unknown> = {}) => NextResponse.json({ success: true, data, ...extra });
export const fail = (message: string, status = 400) => NextResponse.json({ success: false, error: message }, { status });
export const today = () => new Date().toISOString().slice(0, 10);
