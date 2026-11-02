import { NextRequest, NextResponse } from 'next/server';
import { getServerCaller, READ_ROLES, requireServerRole } from '@/lib/server-auth';
import { integrationAdminClient } from '@/lib/integration-settings';

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
    .select('jobsite')
    .eq('tahun', Number(tahun))
    .order('jobsite');
  if (caller!.role === 'pic') query = query.eq('jobsite', caller!.site!);
  const { data, error } = await query;

  if (error) {
    console.error('[Lagging sites] Query failed:', error.code);
    return NextResponse.json({ success: false, error: 'Gagal mengambil daftar site.' }, { status: 500 });
  }

  const sites = [...new Set((data || []).map((r: { jobsite: string }) => r.jobsite))];
  const allIdx = caller!.role === 'pic' ? -1 : sites.indexOf('All Site');
  if (allIdx > 0) {
    sites.splice(allIdx, 1);
    sites.unshift('All Site');
  }

  return NextResponse.json({ success: true, data: sites });
}
