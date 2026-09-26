import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptMCURecord, hashField } from '@/lib/encryption';
import { MCU_FIELDS } from '@/lib/mcu-fields';

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

export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !['pic', 'superuser', 'administrator'].includes(caller.role)) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const params = new URL(req.url).searchParams;
  const nik = params.get('nik')?.trim() || '';
  const nationalId = params.get('national_id')?.trim() || '';
  if (!nik && !nationalId) {
    const requestedPage = Number.parseInt(params.get('page') || '1', 10);
    const pageSize = 100;
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const from = (page - 1) * pageSize;
    const search = params.get('search')?.trim() || '';
    let listQuery = client.from('mcu_records').select('*', { count: 'exact' }).order('tgl_mcu', { ascending: false }).range(from, from + pageSize - 1);
    if (search) {
      const hash = hashField(search);
      listQuery = listQuery.or(`nik_karyawan_hash.eq.${hash},national_id_hash.eq.${hash}`);
    }
    const { data: records, count, error: listError } = await listQuery;
    if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });
    return NextResponse.json({
      records: (records || []).map(record => {
        const decrypted = decryptMCURecord(record);
        delete decrypted.national_id;
        return {
          ...decrypted,
          nik_karyawan_hash: record.nik_karyawan_hash,
        };
      }),
      page,
      pageSize,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize),
    });
  }

  let query = client.from('mcu_records').select('*').order('tgl_mcu', { ascending: false }).limit(1);
  if (nik) query = query.eq('nik_karyawan_hash', hashField(nik));
  else query = query.eq('national_id_hash', hashField(nationalId));

  const { data, error } = await query.maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ record: null });

  const record = decryptMCURecord(data);
  const snakeToCamelMap: Record<string, string> = {};
  for (const field of MCU_FIELDS) {
    const snakeKey = field.id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase();
    snakeToCamelMap[snakeKey] = field.id;
  }

  const formData: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (['created_at', 'updated_at'].includes(key) || value == null) continue;
    if (key === 'id') {
      formData.id = String(value);
      continue;
    }
    const camelKey = snakeToCamelMap[key] || key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
    formData[camelKey] = String(value);
  }
  return NextResponse.json({ record: formData, updatedAt: data.updated_at || data.created_at });
}
