import { NextRequest, NextResponse } from 'next/server';
import { getServerCaller, READ_ROLES, requireServerRole } from '@/lib/server-auth';
import { integrationAdminClient } from '@/lib/integration-settings';

const MKEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

export async function GET(req: NextRequest) {
  const caller = await getServerCaller(req);
  const denied = requireServerRole(caller, READ_ROLES);
  if (denied) return denied;
  if (caller!.role === 'pic' && !caller!.site) return NextResponse.json({ error: 'Site PIC belum ditetapkan' }, { status: 403 });
  const url = req.nextUrl.searchParams;
  const tahun = url.get('tahun') || '2026';

  const client = integrationAdminClient();
  let query = client
    .from('health_indicators')
    .select('jobsite, asr, bulan')
    .eq('tahun', Number(tahun))
    .neq('jobsite', 'All Site');
  if (caller!.role === 'pic') query = query.eq('jobsite', caller!.site!);
  const { data, error } = await query;

  if (error) {
    console.error('[ASR ranking] Query failed:', error.code);
    return NextResponse.json({ success: false, error: 'Gagal mengambil peringkat ASR.' }, { status: 500 });
  }

  const map = new Map<string, Record<string, number | string>>();

  for (const r of (data || [])) {
    const site = String(r.jobsite);
    if (!map.has(site)) {
      const entry: Record<string, number | string> = { name: site };
      MKEYS.forEach(m => { entry[m] = 0; });
      map.set(site, entry);
    }
    const entry = map.get(site)!;
    const mKey = MKEYS[(r.bulan as number) - 1];
    if (mKey) entry[mKey] = Number(r.asr) || 0;
  }

  const result = Array.from(map.values());
  return NextResponse.json({ success: true, data: result });
}
