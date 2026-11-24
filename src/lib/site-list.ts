// Site master list — dipakai dropdown site di seluruh halaman
//
// Sumber: GET /api/sites (DISTINCT site dari monitor_mcu, fallback JOBSITES).
// Cache per module instance (bukan per komponen) agar halaman yang berbeda
// dalam satu sesi aplikasi tidak mengirim request berulang.
//
// Dipakai untuk semua dropdown site K3: Sarana & Prasarana, Checklist
// Kelaikan, Program Inspeksi, Register PICA, dashboard Higiene Industri,
// Ergonomi, Kesehatan Mental, dll.

import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '@/lib/api-client';
import { JOBSITES } from '@/lib/lagging-data';

let cache: string[] | null = null;
let inFlight: Promise<string[]> | null = null;

export function getCachedSites(): string[] | null {
  return cache;
}

export function setCachedSites(list: string[]) {
  cache = list;
}

async function loadSites(force = false): Promise<string[]> {
  if (!force && cache) return cache;
  if (!force && inFlight) return inFlight;

  const task = (async () => {
    try {
      const r = await authFetch('/api/sites');
      const sites = Array.isArray(r.sites) ? (r.sites as string[]).filter(Boolean) : [];
      const hasil = sites.length ? sites : JOBSITES.filter(s => s !== 'All Site');
      cache = hasil;
      return hasil;
    } catch {
      // Fallback agar dropdown tetap berfungsi saat server tidak bisa.
      const hasil = JOBSITES.filter(s => s !== 'All Site');
      cache = hasil;
      return hasil;
    } finally {
      inFlight = null;
    }
  })();

  inFlight = task;
  try {
    return await task;
  } finally {
    if (inFlight === task) inFlight = null;
  }
}

export interface UseSites {
  sites: string[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useSites(): UseSites {
  const [sites, setSites] = useState<string[]>(() => cache ?? []);
  const [loading, setLoading] = useState(!cache);

  const refresh = useCallback(async () => {
    setLoading(true);
    const hasil = await loadSites(true);
    setSites(hasil);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (cache) return;
    let alive = true;
    loadSites()
      .then((list) => { if (alive) setSites(list); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return { sites, loading, refresh };
}
