// src/lib/hc-ergo-server.ts — helper server untuk API /api/hc dan /api/ergo (pola sama dengan /api/mcu/records)
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptEmployee } from '@/lib/encryption';
import { getServerCaller } from '@/lib/server-auth';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const db = createClient(url, serviceKey || 'missing-service-role-key');

export const ADMIN_ROLES = ['administrator', 'superuser'];
export const ALLOWED_ROLES = ADMIN_ROLES;                 // dipakai /api/hc
/** Penyetuju dokumen ergonomi (FORM/116-118: "Disetujui oleh QSHE Manager / PJO"). */
export const APPROVER_ROLES = ['manager', 'superuser'];

export interface Caller { role: string; name: string; jabatan: string | null; site: string | null; userId: string; }

/** Verifikasi token Supabase dan ambil role + nama dari user_profiles. */
export async function getCaller(req: NextRequest): Promise<Caller | null> {
  const verified = await getServerCaller(req);
  if (!verified) return null;
  if (process.env.NODE_ENV !== 'production' && verified.userId.startsWith('preview-')) {
    return {
      role: verified.role,
      name: 'Preview User',
      jabatan: 'Preview',
      site: verified.site,
      userId: verified.userId,
    };
  }
  const { data: profile, error } = await db.from('user_profiles')
    .select('username, full_name, employee_nik_hash')
    .eq('user_id', verified.userId)
    .maybeSingle();
  if (error || !profile) return null;
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
  return { role: verified.role, name, jabatan, site: verified.site, userId: verified.userId };
}

export async function requireCaller(req: NextRequest, roles: string[] = ADMIN_ROLES): Promise<{ caller: Caller } | { error: NextResponse }> {
  const caller = await getCaller(req);
  if (!caller || !roles.includes(caller.role)) {
    return { error: NextResponse.json({ success: false, error: 'Akses ditolak' }, { status: 403 }) };
  }
  return { caller };
}

export const ok = (data: unknown, extra: Record<string, unknown> = {}) => NextResponse.json({ success: true, data, ...extra });
export const fail = (message: string, status = 400) => NextResponse.json({ success: false, error: message }, { status });
export const today = () => new Date().toISOString().slice(0, 10);
