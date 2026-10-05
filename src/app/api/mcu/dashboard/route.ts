import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { hashField } from '@/lib/encryption';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const client = createClient(supabaseUrl, serviceKey || anonKey);
const previewRole = process.env.NEXT_PUBLIC_PREVIEW_ROLE;

const SITE_AREAS: Record<string, string> = Object.fromEntries(
  Object.entries({
    'Area 1': [
      'Satui', 'Angsana', 'Tanjung Tabalong', 'Rantau', 'Binuang', 'Senakin', 'Kota Baru',
      'Batu Kajang', 'Ketapang', 'Kapuas Tengah', 'Murung Raya', 'Muara Teweh', 'Tuhup',
      'Gunung Mas', 'Banjar Baru',
    ],
    'Area 2': [
      'Bontang', 'Samarinda', 'Tenggarong', 'Tabang', 'Gunung Sari', 'Bukit Pinang',
      'Sangatta', 'Bengalon', 'Kaliorang', 'Kaubun', 'Balikpapan', 'Melak',
    ],
    'Area 3': [
      'Muara Enim', 'Lahat', 'Muara Bungo', 'Banyuwangi', 'Wetar', 'Kotamobagu', 'Konawe',
      'Halmahera Timur', 'Gorontalo', 'Aceh', 'Palu', 'Malinau', 'Kelubir', 'Tanjung Redeb',
      'Labanan', 'Binungan', 'Bunyu', 'Sebakis', 'Morowali', 'Luwu', 'Soroako', 'Kayong Utara',
    ],
  }).flatMap(([area, sites]) => sites.map(site => [site.toLowerCase(), area])),
);

function normalizeArea(rawArea: unknown, site: unknown): string {
  const area = String(rawArea || '').trim().toLowerCase();
  if (area === '1' || area === 'area 1') return 'Area 1';
  if (area === '2' || area === 'area 2') return 'Area 2';
  if (area === '3' || area === 'area 3') return 'Area 3';
  if (area === 'head office' || area === 'ho') return 'HO';
  return SITE_AREAS[String(site || '').trim().toLowerCase()] || '';
}

function normalizeMcuStatus(value: unknown, exempt: boolean) {
  const status = String(value || '').trim().toLowerCase();
  if (exempt || /tidak perlu mine permit|\bexempt\b/.test(status)) return 'Exempt';
  if (status === 'no data' || !status) return 'No Data';
  if (status.includes('expired')) return 'Expired';
  if (status.includes('valid')) return 'Valid';
  return 'No Data';
}

function normalizeFollowUpStatus(value: unknown, exempt: boolean) {
  const status = String(value || '').trim().toLowerCase();
  if (exempt || /\bexempt\b|tidak perlu mine permit/.test(status)) return 'Exempt';
  if (/^close\s*:|fit to work|\bunfit\b/.test(status)) return 'Selesai FU';
  if (/^open\s*:/.test(status)) return 'Perlu FU';
  if (/selesai|done|complete/.test(status)) return 'Selesai FU';
  if (/tidak perlu|no follow/.test(status)) return 'Selesai FU';
  if (/perlu|pending/.test(status)) return 'Perlu FU';
  return 'Belum Review';
}

interface ServerCacheEntry {
  rows: Record<string, unknown>[];
  timestamp: number;
}
let serverCache: ServerCacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getCaller(request: NextRequest): Promise<{ role: string; site: string | null } | null> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
    || request.cookies.get('sb-access-token')?.value;
  if (!token) return null;
  if (token === 'preview-access-token' && previewRole) {
    return { role: previewRole, site: process.env.NEXT_PUBLIC_PREVIEW_SITE || 'Head Office' };
  }

  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) return null;

  const { data: profile, error: profileError } = await client
    .from('user_profiles')
    .select('role,site,username,national_id,employee_nik_hash')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError || !profile) return null;

  let site = profile.site || null;
  if (profile.role === 'pic') {
    const employeeHash = profile.employee_nik_hash || hashField(profile.username);
    const nationalIdHash = profile.national_id ? hashField(profile.national_id) : null;
    const employeeQuery = employeeHash
      ? client.from('employees').select('site_name').eq('nik_hash', employeeHash).maybeSingle()
      : nationalIdHash
        ? client.from('employees').select('site_name').eq('national_id_hash', nationalIdHash).maybeSingle()
        : Promise.resolve({ data: null });
    const { data: employee } = await employeeQuery;
    site = employee?.site_name || site;
  }

  return { role: profile.role, site };
}

async function fetchAllMonitorMcuRows(): Promise<Record<string, unknown>[]> {
  const SELECT_FIELDS = 'employee_id,site,area_raw,client,jabatan,exempt,total_mcu,mcu_2024_count,mcu_2025_count,mcu_2026_count,mcu_2024,mcu_2025,mcu_2026,mcu_terakhir,kategori_mcu_terakhir,hasil_mcu,perlu_fu,rekomendasi_fu,item_fu,diagnosa,fram_score,fram_prob,frs_kategori,zona_risiko,masa_berlaku_mcu,status_mcu,status_follow_up,jadwal_mcu_selanjutnya';
  const PAGE_SIZE = 1000;
  const rows: Record<string, unknown>[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('monitor_mcu')
      .select(SELECT_FIELDS)
      .order('site', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (data) rows.push(...data);
    if (!data || data.length < PAGE_SIZE) break;
  }

  return rows;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error
    && typeof error.message === 'string') {
    return error.message;
  }
  return 'Gagal memuat data dashboard MCU';
}

export async function GET(request: NextRequest) {
  try {
    if (!serviceKey) {
      return NextResponse.json({
        error: 'Dashboard MCU memerlukan SUPABASE_SERVICE_ROLE_KEY di environment server.',
      }, { status: 500 });
    }

    const caller = await getCaller(request);
    if (!caller || !['pic', 'administrator', 'superuser'].includes(caller.role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }
    if (caller.role === 'pic' && !caller.site) {
      return NextResponse.json({ error: 'Site akun PIC belum ditentukan' }, { status: 403 });
    }

    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';
    const now = Date.now();

    let rawRows: Record<string, unknown>[];
    if (!forceRefresh && serverCache && (now - serverCache.timestamp < CACHE_TTL_MS)) {
      rawRows = serverCache.rows;
    } else {
      rawRows = await fetchAllMonitorMcuRows();
      serverCache = { rows: rawRows, timestamp: now };
    }

    const employees: Record<string, unknown>[] = rawRows.map(row => {
      const exempt = Boolean(row.exempt);
      return {
        ...row,
        client: String(row.client || '').trim() || 'PT. BDM',
        area: normalizeArea(row.area_raw, row.site),
        status_mcu: normalizeMcuStatus(row.status_mcu, exempt),
        status_follow_up: normalizeFollowUpStatus(row.status_follow_up, exempt),
      };
    }).filter(row => caller.role !== 'pic' || !caller.site
      || caller.site.toLowerCase() === 'head office'
      || String(row['site'] || '').toLowerCase() === caller.site.toLowerCase());

    return NextResponse.json({ employees });
  } catch (error) {
    console.error('Gagal memuat data dashboard MCU:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
