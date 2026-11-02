import { NextRequest, NextResponse } from 'next/server';
import { getServerCaller, READ_ROLES, requireServerRole } from '@/lib/server-auth';
import { integrationAdminClient } from '@/lib/integration-settings';

/* ═══════════════════════════════════
   GET — KPI Dashboard Statistik
   Menggunakan view v_kpi_all_site atau hitung manual.

   Params:
     ?bulan=&tahun=&jobsite=
     ?mode=per_site  → returns per-site breakdown
     ?mode=top_asr  → returns top 10 ASR ranking
   ═══════════════════════════════════ */
export async function GET(request: NextRequest) {
  try {
    const caller = await getServerCaller(request);
    const denied = requireServerRole(caller, READ_ROLES);
    if (denied) return denied;
    if (caller!.role === 'pic' && !caller!.site) return NextResponse.json({ error: 'Site PIC belum ditetapkan' }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const bulan = searchParams.get('bulan') || '';
    const tahun = searchParams.get('tahun') || '';
    let mode = searchParams.get('mode') || 'summary'; // summary | per_site | top_asr
    let jobsite = searchParams.get('jobsite') || '';
    if (caller!.role === 'pic') {
      if (jobsite && jobsite !== 'All Site' && jobsite.toLowerCase() !== caller!.site!.toLowerCase()) {
        return NextResponse.json({ error: 'PIC hanya dapat melihat site sendiri' }, { status: 403 });
      }
      jobsite = caller!.site!;
      if (mode === 'summary') mode = 'per_site';
    }
    const client = integrationAdminClient();
    // ── Mode: top_asr (ranking chart) ──
    if (mode === 'top_asr') {
      let query = client
        .from('v_kpi_per_site')
        .select('*')
        .order('asr', { ascending: false })
        .limit(10);

      if (bulan) query = query.eq('bulan', parseInt(bulan));
      if (tahun) query = query.eq('tahun', parseInt(tahun));
      if (caller!.role === 'pic') query = query.eq('jobsite', caller!.site);

      const { data, error } = await query;
      if (error) {
        console.error('[KPI] Top ASR query failed:', error.code);
        return NextResponse.json({ success: false, error: 'Gagal mengambil data KPI.' }, { status: 500 });
      }
      return NextResponse.json({ success: true, data: data || [] });
    }

    // ── Mode: per_site (tabel breakdown) ──
    if (mode === 'per_site') {
      let query = client.from('v_kpi_per_site').select('*').order('asr', { ascending: false });
      if (bulan) query = query.eq('bulan', parseInt(bulan));
      if (tahun) query = query.eq('tahun', parseInt(tahun));
      if (jobsite && jobsite !== 'All Site') query = query.eq('jobsite', jobsite);

      const { data, error } = await query;
      if (error) {
        console.error('[KPI] Per-site query failed:', error.code);
        return NextResponse.json({ success: false, error: 'Gagal mengambil data KPI.' }, { status: 500 });
      }
      return NextResponse.json({ success: true, data: data || [] });
    }

    // ── Mode: summary (default — all site aggregated) ──
    let query = client.from('v_kpi_all_site').select('*').order('bulan', { ascending: true });
    if (bulan) query = query.eq('bulan', parseInt(bulan));
    if (tahun) query = query.eq('tahun', parseInt(tahun));

    const { data, error } = await query;
    if (error) {
      console.error('[KPI] Summary query failed:', error.code);
      return NextResponse.json({ success: false, error: 'Gagal mengambil data KPI.' }, { status: 500 });
    }

    // If single row (filtered by bulan+tahun), return it directly
    const rows = data || [];
    const summary = rows.length === 1 ? rows[0] : rows;

    return NextResponse.json({ success: true, data: summary });
  } catch (err) {
    console.error('[KPI] Request failed:', err instanceof Error ? err.name : 'unknown error');
    return NextResponse.json({ success: false, error: 'Gagal mengambil data KPI.' }, { status: 500 });
  }
}
