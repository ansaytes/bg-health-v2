import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decrypt, decryptEmployee, decryptMCURecord, encrypt, hashField } from '@/lib/encryption';

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
  const { data: profile } = await client.from('user_profiles').select('role,site,username,national_id,employee_nik_hash').eq('user_id', user.id).single();
  if (!profile) return null;
  const employeeHash = profile.employee_nik_hash || hashField(profile.username);
  const employeeNationalIdHash = profile.national_id ? hashField(profile.national_id) : null;
  const employeeQuery = employeeHash
    ? client.from('employees').select('site_name').eq('nik_hash', employeeHash).maybeSingle()
    : employeeNationalIdHash
      ? client.from('employees').select('site_name').eq('national_id_hash', employeeNationalIdHash).maybeSingle()
      : Promise.resolve({ data: null });
  const { data: linkedEmployee } = await employeeQuery;
  return { userId: user.id, role: profile.role, site: linkedEmployee?.site_name || profile.site };
}

function canUseSite(user: { role: string; site?: string | null }, site: string) {
  return user.role !== 'pic' || (user.site || '').toLowerCase() === 'head office' || user.site === site;
}

async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>
) {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) return { data: null, error };
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return { data: rows, error: null };
  }
}

export async function GET(req: NextRequest) {
  const user = await caller(req);
  if (!user || !['pic', 'superuser', 'administrator'].includes(user.role)) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }
  const searchParams = new URL(req.url).searchParams;
  const requestedPage = Number.parseInt(searchParams.get('page') || '1', 10);
  const pageSize = 100;
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const siteFilter = searchParams.get('site')?.trim() || '';
  const departmentFilter = searchParams.get('department')?.trim() || '';
  const searchFilter = searchParams.get('search')?.trim() || '';
  const employeeFrom = (page - 1) * pageSize;
  let employeeQuery = client.from('employees')
    .select('nik,nama,gender,age,department,job_position,site_name,national_id', { count: 'exact' })
    .ilike('employment_status', 'Aktif')
    .eq('division', 'Mining')
    .order('site_name')
    .order('nama')
    .range(employeeFrom, employeeFrom + pageSize - 1);
  if (user.role === 'pic' && user.site && user.site.toLowerCase() !== 'head office') {
    employeeQuery = employeeQuery.eq('site_name', user.site);
  } else if (siteFilter) {
    employeeQuery = employeeQuery.eq('site_name', siteFilter);
  }
  if (departmentFilter) employeeQuery = employeeQuery.eq('department', departmentFilter);
  if (searchFilter) {
    const safeSearch = searchFilter.replace(/[(),]/g, '');
    if (safeSearch) employeeQuery = employeeQuery.or(`nama.ilike.%${safeSearch}%,department.ilike.%${safeSearch}%,site_name.ilike.%${safeSearch}%`);
  }
  const [{ data: employeeData, count: employeeCount, error: employeeError }, { data: scheduleData, error: scheduleError }, { data: monitorData, error: monitorError }] = await Promise.all([
    employeeQuery,
    fetchAllRows((from, to) => client.from('mcu_schedules').select('*').range(from, to)),
    fetchAllRows((from, to) => client.from('monitor_mcu').select('*').range(from, to)),
  ]);
  if (employeeError || scheduleError || monitorError) {
    const error = employeeError || scheduleError || monitorError;
    return NextResponse.json({ error: error?.message || 'Gagal memuat data MCU' }, { status: 500 });
  }
  const data = (scheduleData || []).filter(row =>
    user.role !== 'pic' || !user.site || user.site.toLowerCase() === 'head office' || row.site === user.site
  );
  const employees = (employeeData || []).map(decryptEmployee);
  const monitors = (monitorData || []).map(decryptMCURecord);
  const monitorByNik = new Map(monitors.map(record => [String(record.nik_karyawan || ''), record]));
  const scheduleByNik = new Map(data.map(row => [String(decrypt(row.nik_karyawan) || row.nik_karyawan), row]));
  const ids = data.map(row => row.id);
  const { data: history } = ids.length
    ? await client.from('mcu_schedule_history').select('schedule_id,old_date,new_date,note,changed_at').in('schedule_id', ids).order('changed_at', { ascending: false })
    : { data: [] };
  const historyById = new Map<string, string[]>();
  for (const item of history || []) {
    const values = historyById.get(item.schedule_id) || [];
    values.push(`${item.changed_at}: ${item.old_date || '-'} → ${item.new_date}${item.note ? ` (${item.note})` : ''}`);
    historyById.set(item.schedule_id, values);
  }
  const safeRows = employees.map(employee => {
    const nik = String(employee.nik || '');
    const schedule = scheduleByNik.get(nik);
    const monitor = monitorByNik.get(nik);
    return {
      id: schedule?.id || null,
      nik_karyawan: nik,
      national_id: employee.national_id || null,
      nama: employee.nama || '-',
      jenis_kelamin: employee.gender || null,
      usia: employee.age || null,
      department: employee.department || null,
      jabatan: employee.job_position || null,
      site: employee.site_name || '-',
      tanggal_mcu_terakhir: monitor?.tgl_mcu || null,
      tanggal_jadwal: schedule?.tanggal_jadwal || '',
      history: schedule ? historyById.get(schedule.id) || [] : [],
    };
  });
  return NextResponse.json({
    schedules: safeRows,
    site: user.site || null,
    page,
    pageSize,
    total: employeeCount || 0,
    totalPages: Math.ceil((employeeCount || 0) / pageSize),
  });
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
