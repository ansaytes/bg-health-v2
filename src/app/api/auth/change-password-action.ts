// change-password action extracted from src/app/api/auth/route.ts.
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export const MIN_PASSWORD_LENGTH = 8;
export const BLOCKED_PASSWORDS = new Set(['bagong1994']);

export async function handleChangePassword(
  req: NextRequest,
  body: Record<string, unknown>,
  ctx: { supabaseAdmin: SupabaseClient; supabaseServiceKey: string; employeeDefaultPassword: string },
): Promise<NextResponse> {
  const accessToken = req.headers.get('authorization')?.replace('Bearer ', '') || req.cookies.get('sb-access-token')?.value;
  if (!accessToken || !ctx.supabaseServiceKey) {
    return NextResponse.json({ error: 'Sesi atau konfigurasi autentikasi tidak tersedia' }, { status: 401 });
  }
  const { data: { user }, error: userError } = await ctx.supabaseAdmin.auth.getUser(accessToken);
  if (userError || !user) return NextResponse.json({ error: 'Sesi tidak valid. Silakan masuk kembali.' }, { status: 401 });
  if (user.app_metadata?.must_change_password !== true) {
    return NextResponse.json({ error: 'Tidak ada penggantian password wajib untuk akun ini' }, { status: 400 });
  }
  const newPassword = String(body.newPassword ?? '');
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: 'Password baru minimal 8 karakter' }, { status: 400 });
  }
  if (newPassword === ctx.employeeDefaultPassword || BLOCKED_PASSWORDS.has(newPassword)) {
    return NextResponse.json({ error: 'Password baru tidak boleh sama dengan password awal' }, { status: 400 });
  }
  const { error: updateError } = await ctx.supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: newPassword,
    app_metadata: { ...user.app_metadata, must_change_password: false },
  });
  if (updateError) {
    console.error('Required password update failed:', updateError);
    return NextResponse.json({ error: 'Gagal memperbarui password' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
