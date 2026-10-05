import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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
    const { searchParams } = new URL(request.url);
    const bulan = searchParams.get('bulan') || '';
    const tahun = searchParams.get('tahun') || '';
    const jobsite = searchParams.get('jobsite') || '';
    const mode = searchParams.get('mode') || 'summary'; // summary | per_site | top_asr

    // ── Mode: top_asr (ranking chart) ──
    if (mode === 'top_asr') {
      let query = supabase
        .from('v_kpi_per_site')
        .select('*')
        .order('asr', { ascending: false })
        .limit(10);

      if (bulan) query = query.eq('bulan', parseInt(bulan));
      if (tahun) query = query.eq('tahun', parseInt(tahun));

      const { data, error } = await query;
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, data: data || [] });
    }

    // ── Mode: per_site (tabel breakdown) ──
    if (mode === 'per_site') {
      let query = supabase.from('v_kpi_per_site').select('*').order('asr', { ascending: false });
      if (bulan) query = query.eq('bulan', parseInt(bulan));
      if (tahun) query = query.eq('tahun', parseInt(tahun));
      if (jobsite && jobsite !== 'All Site') query = query.eq('jobsite', jobsite);

      const { data, error } = await query;
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, data: data || [] });
    }

    // ── Mode: summary (default — all site aggregated) ──
    let query = supabase.from('v_kpi_all_site').select('*').order('bulan', { ascending: true });
    if (bulan) query = query.eq('bulan', parseInt(bulan));
    if (tahun) query = query.eq('tahun', parseInt(tahun));

    const { data, error } = await query;
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    // If single row (filtered by bulan+tahun), return it directly
    const rows = data || [];
    const summary = rows.length === 1 ? rows[0] : rows;

    return NextResponse.json({ success: true, data: summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mengambil data KPI';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
