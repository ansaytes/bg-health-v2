import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decrypt, encrypt, hashField } from '@/lib/encryption';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const client = createClient(url, serviceKey || anonKey);

async function caller(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || req.cookies.get('sb-access-token')?.value;
  if (!token) return null;
  if (token === 'preview-access-token' && process.env.NEXT_PUBLIC_PREVIEW_ROLE) {
    return { userId: 'preview', role: process.env.NEXT_PUBLIC_PREVIEW_ROLE, site: process.env.NEXT_PUBLIC_PREVIEW_SITE || 'Head Office' };
  }
  const { data: { user } } = await client.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await client.from('user_profiles').select('role,site').eq('user_id', user.id).single();
  return profile ? { userId: user.id, role: profile.role, site: profile.site } : null;
}

function canUseSite(user: { role: string; site?: string | null }, site: string) {
  return user.role !== 'pic' || (user.site || '').toLowerCase() === 'head office' || user.site === site;
}

export async function GET(req: NextRequest) {
  const user = await caller(req);
  if (!user || !['pic', 'superuser', 'administrator'].includes(user.role)) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }
  let query = client.from('mcu_schedules').select('*').order('site').order('nama');
  if (user.role === 'pic' && user.site && user.site.toLowerCase() !== 'head office') query = query.eq('site', user.site);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = (data || []).map(row => row.id);
  const { data: history } = ids.length
    ? await client.from('mcu_schedule_history').select('schedule_id,old_date,new_date,note,changed_at').in('schedule_id', ids).order('changed_at', { ascending: false })
    : { data: [] };
  const historyById = new Map<string, string[]>();
  for (const item of history || []) {
    const values = historyById.get(item.schedule_id) || [];
    values.push(`${item.changed_at}: ${item.old_date || '-'} → ${item.new_date}${item.note ? ` (${item.note})` : ''}`);
    historyById.set(item.schedule_id, values);
  }
  const safeRows = (data || []).map(row => ({
    ...row,
    national_id: decrypt(row.national_id) || row.national_id,
    nik_karyawan: decrypt(row.nik_karyawan) || row.nik_karyawan,
    nama: decrypt(row.nama) || row.nama,
    history: historyById.get(row.id) || [],
  }));
  return NextResponse.json({ schedules: safeRows, site: user.site || null });
}

export async function POST(req: NextRequest) {
  const user = await caller(req);
  if (!user || !['pic', 'superuser', 'administrator'].includes(user.role)) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }
  const body = await req.json();
  const { id, nikKaryawan, nationalId, nama, jenisKelamin, usia, jabatan, site, tanggalJadwal } = body;
  if (!nikKaryawan || !nama || !site || !tanggalJadwal) {
    return NextResponse.json({ error: 'NIK Karyawan, nama, site, dan tanggal jadwal wajib diisi' }, { status: 400 });
  }
  if (!id && !nationalId) return NextResponse.json({ error: 'NIK KTP wajib diisi untuk karyawan baru' }, { status: 400 });
  if (!canUseSite(user, site)) return NextResponse.json({ error: 'PIC hanya dapat mengelola site sendiri' }, { status: 403 });
  const key = hashField(nikKaryawan);
  const record = {
    nik_karyawan: encrypt(nikKaryawan),
    nik_karyawan_hash: key,
    national_id: nationalId ? encrypt(nationalId) : null,
    national_id_hash: nationalId ? hashField(nationalId) : null,
    nama: encrypt(nama), jenis_kelamin: jenisKelamin || null, usia: usia || null, jabatan: jabatan || null,
    site, tanggal_jadwal: tanggalJadwal,
  };
  if (id) {
    const { data: previous } = await client.from('mcu_schedules').select('*').eq('id', id).single();
    if (!previous) return NextResponse.json({ error: 'Jadwal tidak ditemukan' }, { status: 404 });
    const { error: updateError } = await client.from('mcu_schedules').update({
      nik_karyawan: record.nik_karyawan,
      nik_karyawan_hash: record.nik_karyawan_hash,
      nama: record.nama,
      jenis_kelamin: record.jenis_kelamin,
      usia: record.usia,
      jabatan: record.jabatan,
      site: record.site,
      tanggal_jadwal: record.tanggal_jadwal,
      national_id: previous.national_id,
      national_id_hash: previous.national_id_hash,
      updated_by: user.userId,
    }).eq('id', id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    await client.from('mcu_schedule_history').insert({ schedule_id: id, changed_by: user.userId, old_date: previous.tanggal_jadwal, new_date: tanggalJadwal, note: body.note || null });
    return NextResponse.json({ success: true, action: 'updated' });
  }
  const { error } = await client.from('mcu_schedules').insert({ ...record, created_by: user.userId, updated_by: user.userId });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, action: 'inserted' });
}
