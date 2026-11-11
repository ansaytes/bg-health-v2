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

const DASHBOARD_FIELDS = 'employee_id,nik_karyawan,nama,site,area_raw,client,jabatan,exempt,total_mcu,mcu_terakhir,kategori_mcu_terakhir,frs_kategori,zona_risiko,masa_berlaku_mcu,status_mcu,status_follow_up,jadwal_mcu_selanjutnya';
const MONITOR_FIELDS = DASHBOARD_FIELDS;
const MONITOR_FIELDS_ALT = 'employee_id,nik_karyawan,nama,site,area_raw,client,jabatan,exempt,total_mcu,mcu_terakhir,kategori_mcu_terakhir,frs_kategori,masa_berlaku_mcu,status_mcu,status_follow_up,jadwal_mcu_selanjutnya';

/**
 * VIEW `monitor_mcu` di database bisa belum memuat kolom `zona_risiko` /
 * `nik_karyawan` (mis. migration 010 belum diterapkan), sehingga select penuh
 * gagal dengan error Postgres "column ... does not exist". Pilih daftar kolom
 * pertama yang benar-benar ada agar dashboard tetap tampil.
 */
let monitorColumnsCache: string | null = null;

async function resolveMonitorColumns(): Promise<string> {
  if (monitorColumnsCache) return monitorColumnsCache;
  const candidates = [DASHBOARD_FIELDS, MONITOR_FIELDS_ALT];
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

/**
 * Fetch SEMUA baris monitor_mcu yang dibutuhkan dashboard.
 *
 * Optimasi (benchmark 2026-11 vs implementasi lama):
 *   - Hapus ORDER BY: view adalah CTE 3-tabel berat; sorting menambah ±4s/request.
 *     Dashboard melakukan filter/agregat di client jadi urutan server tidak penting.
 *   - Hapus count(*): paginasi sampai halaman kosong saja, hemat 5+ detik.
 *   - Fetch hanya 16 kolom dashboard (bukan 27 kolom tabel admin):
 *     menghemat bandwidth dan menghindari dekripsi field teks panjang
 *     (diagnosa, hasil_mcu, rekomendasi_fu) yang tetap dibuang.
 *   - Konkurensi 5 (naik dari 3): tanpa ORDER BEBAN, request lebih ringan.
 */
async function fetchAllMonitorMcuRows(): Promise<Record<string, unknown>[]> {
  const SELECT_FIELDS = await resolveMonitorColumns();
  const PAGE_SIZE = 1000;
  const PAGE_CONCURRENCY = 5;

  const fetchPage = async (from: number): Promise<Record<string, unknown>[]> => {
    const { data, error } = await client()
      .from('monitor_mcu')
      .select(SELECT_FIELDS)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    return (data || []) as unknown as Record<string, unknown>[];
  };

  // Ambil semua halaman tanpa count() — berhenti saat ada halaman yang tidak penuh.
  const allRows: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    // Siapkan satu gelombang offset (maksimal PAGE_CONCURRENCY halaman).
    const batchOffsets: number[] = [];
    for (let b = 0; b < PAGE_CONCURRENCY; b++) {
      batchOffsets.push(offset);
      offset += PAGE_SIZE;
    }

    const pages = await Promise.all(batchOffsets.map(o => fetchPage(o)));
    let reachedEnd = false;
    for (const page of pages) {
      if (reachedEnd) break; // halaman setelah halaman terakhir tidak perlu dipakai
      allRows.push(...page);
      if (page.length < PAGE_SIZE) reachedEnd = true;
    }
    if (reachedEnd) break;
  }

  return allRows;
}

/**
 * Fallback sekuensial: dipakai bila gelombang paralel gagal (statement timeout
 * pada view berat). Lebih lambat tetapi jauh lebih ringan bagi database,
 * sehingga dashboard tetap terisi daripada menampilkan error.
 */
async function fetchAllMonitorMcuRowsSequential(): Promise<Record<string, unknown>[]> {
  const SELECT_FIELDS = await resolveMonitorColumns();
  const PAGE_SIZE = 1000;
  const rows: Record<string, unknown>[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client()
      .from('monitor_mcu')
      .select(SELECT_FIELDS)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data || []) as unknown as Record<string, unknown>[];
    if (page.length === 0) break;
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
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
      // Paralel dulu (cepat); bila view menolak beban serentak, ulangi sekuensial.
      let fetched: Record<string, unknown>[];
      try {
        fetched = await fetchAllMonitorMcuRows();
      } catch (parallelError) {
        console.warn(
          'Fetch paralel monitor_mcu gagal, beralih ke sekuensial:',
          parallelError instanceof Error ? parallelError.message : 'unknown',
        );
        fetched = await fetchAllMonitorMcuRowsSequential();
      }
      rawRows = fetched.map(decryptMCURecord);
      serverCache = { rows: rawRows, timestamp: now };
    }

    /*
     * Query di atas sudah hanya mengambil kolom yang dipakai dashboard
     * (DASHBOARD_FIELDS), jadi tidak ada lagi pemangkasan field di sini —
     * `hasil_mcu`, `diagnosa`, `rekomendasi_fu`, dan `item_fu` tidak pernah
     * ikut terunduh. Tabel admin memakai endpoint terpisah
     * `/api/mcu/monitor-table` yang tetap mengirim field lengkap.
     */
    const employees: Record<string, unknown>[] = rawRows.map(row => {
      const exempt = Boolean(row.exempt);
      return {
        nik_karyawan: row.nik_karyawan ?? null,
        nama: row.nama ?? null,
        site: normalizeSiteName(row.site) || null,
        client: String(row.client || '').trim() || 'PT. BDM',
        area: normalizeArea(row.area_raw, row.site),
        jabatan: row.jabatan ?? null,
        exempt,
        total_mcu: row.total_mcu ?? null,
        mcu_terakhir: row.mcu_terakhir ?? null,
        kategori_mcu_terakhir: row.kategori_mcu_terakhir ?? null,
        frs_kategori: row.frs_kategori ?? null,
        // VIEW versi lama menamai kolom ini `zonasi`; keduanya dipetakan ke
        // `zona_risiko` supaya tabel & grafik tetap terisi.
        zona_risiko: row.zona_risiko ?? row.zonasi ?? null,
        masa_berlaku_mcu: row.masa_berlaku_mcu ?? null,
        status_mcu: normalizeMcuStatus(row.status_mcu, exempt, row.masa_berlaku_mcu),
        status_follow_up: normalizeFollowUpStatus(row.status_follow_up, exempt),
        jadwal_mcu_selanjutnya: row.jadwal_mcu_selanjutnya ?? null,
      };
    })
      // Site "Batch" = calon karyawan, tidak dihitung pada dashboard.
      .filter(row => siteDihitung(row.site))
      .filter(row => caller.role !== 'pic' || !caller.site
        || caller.site.toLowerCase() === 'head office'
        || String(row['site'] || '').toLowerCase() === caller.site.toLowerCase());

    /*
     * Cache HTTP: respons dapat di-cache private selama 5 menit agar kunjungan
     * ulang tanpa fetch ulang. stale-while-revalidate membuat UI tampil
     * instan, background refresh memperbarui data di balik layar.
     */
    return NextResponse.json(
      { employees },
      {
        headers: {
          'Cache-Control': 'private, max-age=300, stale-while-revalidate=300',
        },
      },
    );
  } catch (error) {
    console.error('Gagal memuat data dashboard MCU:', error instanceof Error ? error.name : 'unknown error');
    return NextResponse.json({ error: 'Gagal memuat data dashboard MCU.' }, { status: 500 });
  }
}
