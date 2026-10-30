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

async function fetchAllRows<T = Record<string, any>>(
  fetchPage: (from: number, to: number) => any,
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
  try {
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
  // ── OPTIMASI (perbaikan "canceling statement due to statement timeout") ──
  //
  // Versi lama mengambil SELURUH tabel `mcu_schedules` dan SELURUH VIEW
  // `monitor_mcu` (yang menggabungkan employees + mcu_records + mcu_schedules)
  // di setiap permintaan, padahal halaman ini hanya menampilkan 100 karyawan.
  // Untuk ±1.300 record MCU + 3.100 jadwal, query itu melewati batas waktu
  // statement Supabase dan permintaan gagal total.
  //
  // Sekarang hanya diambil untuk NIK yang ada di halaman ini:
  //   1. employeeQuery (100 baris) → daftar NIK
  //   2. mcu_schedules & monitor_mcu difilter dengan `.in(nik_karyawan, NIK)`
  //
  // Bila daftar NIK kosong (halaman melewati akhir data), tidak ada query
  // tambahan yang dijalankan sama sekali.
  const { data: employeeData, count: employeeCount, error: employeeError } = await employeeQuery;
  if (employeeError) {
    return NextResponse.json({ error: employeeError.message || 'Gagal memuat data MCU' }, { status: 500 });
  }

  const employees = (employeeData || []).map(decryptEmployee);
  const nikHalaman = employees
    .map((e) => String(e.nik || '').trim())
    .filter(Boolean);

  let scheduleData: Record<string, unknown>[] = [];
  let monitorData: Record<string, unknown>[] = [];
  let scheduleError: { message: string } | null = null;
  let monitorError: { message: string } | null = null;

  if (nikHalaman.length) {
    // `mcu_schedules.nik_karyawan` tersimpan TERENKRIPSI dengan IV acak, jadi
    // filter `.in()` tidak bisa memakai NIK polos. Yang dipakai adalah hash
    // deterministik `nik_karyawan_hash`.
    const hashes = nikHalaman.map((nik) => hashField(nik)).filter((h): h is string => Boolean(h));

    const [schedRes, monRes] = await Promise.all([
      hashes.length
        ? client.from('mcu_schedules')
          .select('id,nik_karyawan,nik_karyawan_hash,tanggal_jadwal,site')
          .in('nik_karyawan_hash', hashes)
        : Promise.resolve({ data: [], error: null }),
      // TANGGAL MCU TERAKHIR diambil langsung dari mcu_records, BUKAN dari VIEW
      // monitor_mcu. VIEW itu menggabungkan tiga tabel dan butuh ±6 detik
      // hanya untuk 100 NIK — cukup membuat halaman ini terasa macet.
      //
      // `nik_karyawan` di mcu_records terenkripsi, jadi filter memakai hash
      // deterministik `nik_karyawan_hash` (sama seperti mcu_schedules).
      hashes.length
        ? client.from('mcu_records')
          .select('nik_karyawan_hash,tgl_mcu')
          .in('nik_karyawan_hash', hashes)
          .not('tgl_mcu', 'is', null)
          .order('tgl_mcu', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
    scheduleData = (schedRes.data ?? []) as Record<string, unknown>[];
    monitorData = (monRes.data ?? []) as Record<string, unknown>[];
    scheduleError = schedRes.error;
    monitorError = monRes.error;
  }

  if (scheduleError || monitorError) {
    const error = scheduleError || monitorError;
    return NextResponse.json({ error: error?.message || 'Gagal memuat data MCU' }, { status: 500 });
  }
  // Daftar pilihan filter hanya butuh DISTINCT site & department, bukan seluruh
  // baris karyawan. Mengambil 2.700+ baris untuk dua dropdown ikut memperlambat
  // endpoint ini. Batas 5.000 cukup untuk seluruh kombinasi site+department
  // yang realistis, dan hanya dijalankan sekali per permintaan.
  const { data: filterEmployees, error: filterError } = await (() => {
    let query = client.from('employees')
      .select('site_name,department')
      .ilike('employment_status', 'Aktif')
      .eq('division', 'Mining')
      .limit(5000);
    if (user.role === 'pic' && user.site && user.site.toLowerCase() !== 'head office') {
      query = query.eq('site_name', user.site);
    }
    return query;
  })();
  if (filterError) return NextResponse.json({ error: filterError.message }, { status: 500 });
  const sites = [...new Set((filterEmployees || []).map(row => row.site_name).filter(Boolean))].sort();
  const departments = [...new Set((filterEmployees || []).map(row => row.department).filter(Boolean))].sort();
  // tgl_mcu terbaru per hash → dipetakan balik ke NIK karyawan.
  const hashByNik = new Map<string, string>();
  for (const nik of nikHalaman) {
    const h = hashField(nik);
    if (h) hashByNik.set(nik, h);
  }
  const tglByHash = new Map<string, string>();
  for (const row of (monitorData || []) as Record<string, unknown>[]) {
    const h = String(row.nik_karyawan_hash ?? '');
    const tgl = String(row.tgl_mcu ?? '').slice(0, 10);
    // Baris sudah terurut tgl_mcu DESC → yang pertama ditemukan adalah terbaru.
    if (h && tgl && !tglByHash.has(h)) tglByHash.set(h, tgl);
  }
  const monitorByNik = new Map<string, { tgl_mcu: string | null }>();
  for (const [nik, h] of hashByNik) {
    monitorByNik.set(nik, { tgl_mcu: tglByHash.get(h) ?? null });
  }
  const data = ((scheduleData || []) as Record<string, unknown>[]).filter(row =>
    user.role !== 'pic' || !user.site || user.site.toLowerCase() === 'head office' || row.site === user.site
  );
  const scheduleByNik = new Map(data.map(row => [String(decrypt(String(row.nik_karyawan ?? '')) || row.nik_karyawan), row]));
  const ids = data.map(row => String(row.id ?? ''));
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
      tanggal_mcu_terakhir: monitor?.tgl_mcu ?? null,
      tanggal_jadwal: String(schedule?.tanggal_jadwal ?? ''),
      history: schedule ? historyById.get(String(schedule.id ?? '')) || [] : [],
    };
  });
  return NextResponse.json({
    schedules: safeRows,
    site: user.site || null,
    page,
    pageSize,
    total: employeeCount || 0,
    totalPages: Math.ceil((employeeCount || 0) / pageSize),
    sites,
    departments,
  });
  } catch (error) {
    // Tanpa penangkap ini, kesalahan apa pun (termasuk nama kolom salah)
    // menjadi 500 tanpa pesan — menyulitkan diagnosis.
    const message = error instanceof Error ? error.message
      : (typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : 'Gagal memuat data MCU');
    console.error('GET /api/mcu/schedule:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
