import { NextRequest, NextResponse } from 'next/server';

import { getServerCaller, READ_ROLES, requireServerRole } from '@/lib/server-auth';
import { integrationAdminClient } from '@/lib/integration-settings';
import { siteDihitung } from '@/lib/site-filter';
import { JOBSITES } from '@/lib/lagging-data';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sites — daftar site master (dropdown bersama seluruh halaman).
 *
 * Mengapa di satu tempat:
 *  - Monitoring MCU mendapat list site dari baris `monitor_mcu`;
 *  - Halaman K3 (P3K, ambulans, ergonomi, program inspeksi, PICA, sarana
 *    klinik) sebelumnya mengambil `data.daftarSite` dari tabelnya sendiri
 *    → dropdown kosong saat tabel belum ada data, padahal site jelas ada.
 *
 * Sumber: `DISTINCT site` dari `monitor_mcu` (view dashboard MCU) —
 * konsisten dengan cara Monitoring MCU sendiri mengisi dropdown.
 * Fallback: `JOBSITES` dari `@/lib/lagging-data` bila query gagal.
 */
export async function GET(req: NextRequest) {
  const caller = await getServerCaller(req);
  const denied = requireServerRole(caller, READ_ROLES);
  if (denied) return denied;

  const client = integrationAdminClient();

  // Tampilkan site sesuai filter "Batch" (calon karyawan tidak dihitung
  // dalam agregat; tetap dipajang di dropdown admin bila ada).
  const { data, error } = await client
    .from('monitor_mcu')
    .select('site')
    .limit(5000);

  if (error) {
    // Tabel/view belum siap di skema — pakai fallback agar form tetap bisa
    // dipakai (sama seperti Monitoring MCU).
    return NextResponse.json({ success: true, sites: JOBSITES.filter(siteDihitung), source: 'fallback' });
  }

  const seen = new Set<string>();
  const sites: string[] = [];
  for (const row of data ?? []) {
    const nama = String(row.site ?? '').trim();
    if (!nama || seen.has(nama.toLowerCase())) continue;
    // Tampilkan semua site yang pernah masuk dashboard (kecuali Batch).
    if (!siteDihitung(nama)) continue;
    seen.add(nama.toLowerCase());
    sites.push(nama);
  }
  sites.sort((a, b) => a.localeCompare(b));

  if (!sites.length) {
    return NextResponse.json({ success: true, sites: JOBSITES.filter(siteDihitung), source: 'fallback' });
  }

  return NextResponse.json({ success: true, sites, source: 'database' });
}
