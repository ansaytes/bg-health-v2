import { supabase } from '@/lib/supabase';

interface DashboardCacheEntry {
  expiresAt: number;
  request: Promise<unknown>;
}

const DASHBOARD_CACHE_TTL_MS = 2 * 60 * 1000;
const dashboardCache = new Map<string, DashboardCacheEntry>();

/**
 * Memuat data dashboard dengan menyertakan token sesi.
 *
 * MENGAPA TOKEN DIPERLUKAN DI SINI
 * Endpoint seperti `/api/sick-employees` sekarang MEWAJIBKAN login (sebelumnya
 * terbuka dan bisa diunduh siapa saja). Tanpa header Authorization, permintaan
 * dari dashboard mendapat 401 dan grafik menjadi kosong — inilah sebabnya
 * "Peringkat Karyawan Sakit" tidak menampilkan data meski filter sudah benar.
 */
async function tokenSesi(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return session.access_token;
  } catch {
    // Abaikan — lanjut ke fallback preview.
  }
  // Mode preview (hanya aktif bila env diset): token khusus yang diterima server.
  return process.env.NEXT_PUBLIC_PREVIEW_ROLE ? 'preview-access-token' : null;
}

export function fetchDashboardData<T>(url: string, force = false): Promise<T> {
  const now = Date.now();
  const cached = dashboardCache.get(url);
  if (!force && cached && cached.expiresAt > now) {
    return cached.request as Promise<T>;
  }
  if (force) dashboardCache.delete(url);

  const request = (async () => {
    const token = await tokenSesi();
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const payload: unknown = await response.json();
    if (!response.ok) {
      const message = typeof payload === 'object' && payload !== null && 'error' in payload
        && typeof payload.error === 'string'
        ? payload.error
        : `Gagal memuat data dashboard (${response.status})`;
      throw new Error(message);
    }
    return payload as T;
  })();

  const entry = { expiresAt: now + DASHBOARD_CACHE_TTL_MS, request };
  dashboardCache.set(url, entry);
  void request.catch(() => {
    if (dashboardCache.get(url) === entry) dashboardCache.delete(url);
  });
  return request;
}

export function clearDashboardDataCache() {
  dashboardCache.clear();
}

export async function preloadDashboardData({
  canViewMCU,
  canViewInventory,
}: {
  canViewMCU: boolean;
  canViewInventory: boolean;
}) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const periodStart = `${previousYear}-${String(previousMonth).padStart(2, '0')}-21`;
  const periodEnd = `${year}-${String(month).padStart(2, '0')}-20`;

  const requests: Array<{ label: string; request: Promise<unknown> }> = [
    {
      label: 'statistik kesehatan',
      request: fetchDashboardData(`/api/health-indicators?view=all_site&tahun=${year}`),
    },
    {
      label: 'peringkat ASR',
      request: fetchDashboardData(`/api/health-indicators?asr_ranking=true&tahun=${year}&bulan=${month}`),
    },
    {
      label: 'data karyawan sakit',
      request: fetchDashboardData(
        `/api/sick-employees?bulan=${month}&tahun=${year}&period_start=${periodStart}&period_end=${periodEnd}`,
      ),
    },
    {
      label: 'kunjungan berobat',
      request: fetchDashboardData('/api/kunjungan'),
    },
  ];

  if (canViewMCU) {
    const { preloadMCUDashboardData } = await import('@/components/dashboard/MCUDashboardShared');
    requests.push({ label: 'monitoring MCU', request: preloadMCUDashboardData() });
  }
  if (canViewInventory) {
    requests.push({ label: 'inventaris', request: fetchDashboardData('/api/inventory') });
  }

  const results = await Promise.allSettled(requests.map(({ request }) => request));
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`Preload dashboard ${requests[index].label} gagal:`, result.reason);
    }
  });
}
