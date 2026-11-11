import { NextRequest, NextResponse } from 'next/server';
import { decryptMCURecord } from '@/lib/encryption';
import { normalizeArea } from '@/lib/mcu-monitor';
import { siteDihitung } from '@/lib/site-filter';
import { getServerCaller, requireServerRole, STAFF_ROLES } from '@/lib/server-auth';
import { integrationAdminClient } from '@/lib/integration-settings';

const client = () => integrationAdminClient();

function normalizeMcuStatus(value: unknown, exempt: boolean, masaBerlaku?: unknown) {
  const status = String(value || '').trim().toLowerCase();
  if (exempt || /tidak perlu mine permit|\bexempt\b/.test(status)) return 'Exempt';
  if (status === 'no data') return 'No Data';
  if (status.includes('expired')) return 'Expired';
  if (status.includes('valid')) return 'Valid';
  // Status tidak dikenali/kosong: simpulkan dari kolom masa berlaku ("Expired 12 Hari" / "30 Hari lagi")
  const masa = String(masaBerlaku || '').trim().toLowerCase();
  if (/^expired\b/.test(masa)) return 'Expired';
  if (/hari\s*lagi/.test(masa)) return 'Valid';
  return 'No Data';
}

// Samakan penulisan nama jobsite agar "SATUI", "satui " dan "Satui" dihitung sebagai satu site.
function normalizeSiteName(value: unknown): string {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
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

const MONITOR_FIELDS = 'employee_id,nik_karyawan,nama,site,area_raw,client,jabatan,exempt,total_mcu,mcu_terakhir,kategori_mcu_terakhir,hasil_mcu,perlu_fu,rekomendasi_fu,item_fu,diagnosa,fram_score,fram_prob,frs_kategori,zona_risiko,masa_berlaku_mcu,status_mcu,status_follow_up,jadwal_mcu_selanjutnya';
const MONITOR_FIELDS_ALT = 'employee_id,nik_karyawan,nama,site,area_raw,client,jabatan,exempt,total_mcu,mcu_terakhir,kategori_mcu_terakhir,hasil_mcu,perlu_fu,rekomendasi_fu,item_fu,diagnosa,fram_score,fram_prob,frs_kategori,masa_berlaku_mcu,status_mcu,status_follow_up,jadwal_mcu_selanjutnya';

/**
 * VIEW `monitor_mcu` di database bisa belum memuat kolom `zona_risiko` /
 * `nik_karyawan` (mis. migration 010 belum diterapkan), sehingga select penuh
 * gagal dengan error Postgres "column ... does not exist". Pilih daftar kolom
 * pertama yang benar-benar ada agar dashboard tetap tampil.
 */
let monitorColumnsCache: string | null = null;

async function resolveMonitorColumns(): Promise<string> {
  if (monitorColumnsCache) return monitorColumnsCache;
  const candidates = [MONITOR_FIELDS, MONITOR_FIELDS_ALT];
  for (const fields of candidates) {
    const { error } = await client().from('monitor_mcu').select(fields).limit(1);
    if (!error) {
      monitorColumnsCache = fields;
      return fields;
    }
    if (!/does not exist|PGRST204|42703/i.test(error.message)) {
      monitorColumnsCache = fields;
      return fields;
    }
  }
  monitorColumnsCache = '*';
  return '*';
}

async function fetchAllMonitorMcuRows(): Promise<Record<string, unknown>[]> {
  const SELECT_FIELDS = await resolveMonitorColumns();
  const PAGE_SIZE = 1000;
  const rows: Record<string, unknown>[] = [];

  // Sequential pagination — avoids firing multiple concurrent queries against
  // the heavy 3-table CTE VIEW, which reliably caused statement timeouts.
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client()
      .from('monitor_mcu')
      .select(SELECT_FIELDS)
      // Urutan HARUS unik: order by site saja tidak deterministik, sehingga baris bisa
      // terlewat/ganda di antara halaman 1000-an dan hitungan grafik jadi keliru.
      .order('site', { ascending: true })
      .order('employee_id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as Record<string, unknown>[]));
    if (data.length < PAGE_SIZE) break; // last page — no more rows
  }

  return rows;
}

export async function GET(request: NextRequest) {
  try {
    const caller = await getServerCaller(request);
    const denied = requireServerRole(caller, STAFF_ROLES);
    if (denied) return denied;
    if (!caller) return NextResponse.json({ error: 'Sesi login tidak valid' }, { status: 401 });
    if (caller.role === 'pic' && !caller.site) {
      return NextResponse.json({ error: 'Site akun PIC belum ditentukan' }, { status: 403 });
    }

    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';
    const now = Date.now();

    let rawRows: Record<string, unknown>[];
    if (!forceRefresh && serverCache && (now - serverCache.timestamp < CACHE_TTL_MS)) {
      rawRows = serverCache.rows;
    } else {
      const fetched = await fetchAllMonitorMcuRows();
      rawRows = fetched.map(decryptMCURecord);
      serverCache = { rows: rawRows, timestamp: now };
    }

    const employees: Record<string, unknown>[] = rawRows.map(row => {
      const exempt = Boolean(row.exempt);
      return {
        ...row,
        site: normalizeSiteName(row.site) || null,
        client: String(row.client || '').trim() || 'PT. BDM',
        area: normalizeArea(row.area_raw, row.site),
        // VIEW versi lama menamai kolom ini `zonasi`; keduanya dipetakan ke
        // `zona_risiko` supaya tabel & grafik tetap terisi.
        zona_risiko: row.zona_risiko ?? row.zonasi ?? null,
        status_mcu: normalizeMcuStatus(row.status_mcu, exempt, row.masa_berlaku_mcu),
        status_follow_up: normalizeFollowUpStatus(row.status_follow_up, exempt),
      };
    })
      // Site "Batch" = calon karyawan, tidak dihitung pada dashboard.
      .filter(row => siteDihitung(row.site))
      .filter(row => caller.role !== 'pic' || !caller.site
        || caller.site.toLowerCase() === 'head office'
        || String(row['site'] || '').toLowerCase() === caller.site.toLowerCase());

    return NextResponse.json({ employees });
  } catch (error) {
    console.error('Gagal memuat data dashboard MCU:', error instanceof Error ? error.name : 'unknown error');
    return NextResponse.json({ error: 'Gagal memuat data dashboard MCU.' }, { status: 500 });
  }
}
