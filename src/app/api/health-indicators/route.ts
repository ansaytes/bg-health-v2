import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const ALLOWED_FIELDS = [
  'man_power','man_hours','kunjungan_klinik','tk_sakit','absensi_sakit','spell',
  'penyakit_akibat_kerja','kejadian_penyakit_tk','layak_bekerja',
  'rkk','cmr','mfr','ssr','asr','fr_pak','kaptk',
] as const;

/** Returns true if Supabase is properly configured (not placeholder) */
function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return !!(url && key && !url.includes('placeholder'));
}

export async function GET(request: NextRequest) {
  // Fail-fast: if Supabase is not configured, return empty data so frontend falls back to static
  if (!isSupabaseConfigured()) {
    const { searchParams } = new URL(request.url);
    const asr_ranking = searchParams.get('asr_ranking');
    const sites_list = searchParams.get('sites_list');
    if (sites_list === 'true') {
      return NextResponse.json({ success: true, data: ['All Site'] });
    }
    if (asr_ranking === 'true') {
      return NextResponse.json({ success: true, data: [] });
    }
    return NextResponse.json({ success: true, data: [] });
  }

  try {
    const { searchParams } = new URL(request.url);
    const tahun = searchParams.get('tahun');
    const bulan = searchParams.get('bulan');
    const jobsite = searchParams.get('jobsite');
    const asr_ranking = searchParams.get('asr_ranking');
    const sites_list = searchParams.get('sites_list');
    const view = searchParams.get('view'); // 'all_site' | 'ytd'

    // ── Distinct jobsite list (used by selectors) ──────────────
    if (sites_list === 'true') {
      let q = supabase
        .from('health_indicators')
        .select('jobsite')
        .neq('jobsite', 'All Site');
      if (tahun) q = q.eq('tahun', parseInt(tahun));
      q = q.order('jobsite', { ascending: true });
      const { data, error } = await q;
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      const unique = ['All Site', ...new Set((data || []).map((r: { jobsite: string }) => r.jobsite))];
      return NextResponse.json({ success: true, data: unique });
    }

    // ── ASR ranking: top 10 jobsites by ASR ───────────────────
    if (asr_ranking === 'true') {
      let q = supabase
        .from('health_indicators')
        .select('jobsite, asr, man_power, man_hours, bulan, tahun')
        .neq('jobsite', 'All Site')
        .gt('asr', 0);
      if (tahun) q = q.eq('tahun', parseInt(tahun));
      if (bulan) q = q.eq('bulan', parseInt(bulan));
      q = q.order('asr', { ascending: false }).limit(10);
      const { data, error } = await q;
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, data: data || [] });
    }

    // ── YTD view: per-site per-year aggregates ────────────────
    if (view === 'ytd') {
      let q = supabase.from('v_health_ytd_per_site').select('*');
      if (tahun) q = q.eq('tahun', parseInt(tahun));
      if (jobsite) q = q.eq('jobsite', jobsite);
      const { data, error } = await q;
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, data: data || [] });
    }

    // ── "All Site" aggregation view (preferred over manual All Site rows) ──
    if (view === 'all_site' || (jobsite === 'All Site' && !bulan)) {
      let q = supabase.from('v_health_all_site').select('*');
      if (tahun) q = q.eq('tahun', parseInt(tahun));
      if (bulan) q = q.eq('bulan', parseInt(bulan));
      q = q.order('bulan', { ascending: true });
      const { data, error } = await q;
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, data: data || [] });
    }

    // ── Default: raw rows from health_indicators ──────────────
    let q = supabase
      .from('health_indicators')
      .select('*')
      .order('bulan', { ascending: true });
    if (tahun) q = q.eq('tahun', parseInt(tahun));
    if (bulan) q = q.eq('bulan', parseInt(bulan));
    if (jobsite) q = q.eq('jobsite', jobsite);

    const { data, error } = await q;
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mengambil data';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tahun, bulan, jobsite, ...fields } = body;

    if (!tahun || !bulan || !jobsite) {
      return NextResponse.json({ success: false, error: 'tahun, bulan, dan jobsite wajib diisi' }, { status: 400 });
    }

    const row: Record<string, unknown> = {
      tahun: parseInt(tahun),
      bulan: parseInt(bulan),
      jobsite: String(jobsite),
    };
    for (const f of ALLOWED_FIELDS) {
      if (fields[f] !== undefined && fields[f] !== '') {
        row[f] = parseFloat(fields[f]) || 0;
      }
    }

    const { data, error } = await supabase
      .from('health_indicators')
      .upsert(row, { onConflict: 'tahun,bulan,jobsite' });

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menyimpan data';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { tahun, bulan, jobsite, ...fields } = body;

    if (!tahun || !bulan || !jobsite) {
      return NextResponse.json({ success: false, error: 'tahun, bulan, dan jobsite wajib diisi' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    for (const f of ALLOWED_FIELDS) {
      if (fields[f] !== undefined) updateData[f] = parseFloat(fields[f]) || 0;
    }

    const { data, error } = await supabase
      .from('health_indicators')
      .update(updateData)
      .eq('tahun', parseInt(tahun))
      .eq('bulan', parseInt(bulan))
      .eq('jobsite', String(jobsite))
      .select();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mengupdate data';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tahun = searchParams.get('tahun');
    const bulan = searchParams.get('bulan');
    const jobsite = searchParams.get('jobsite');

    if (!tahun || !bulan || !jobsite) {
      return NextResponse.json({ success: false, error: 'tahun, bulan, dan jobsite wajib diisi' }, { status: 400 });
    }

    const { error } = await supabase
      .from('health_indicators')
      .delete()
      .eq('tahun', parseInt(tahun))
      .eq('bulan', parseInt(bulan))
      .eq('jobsite', jobsite);

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menghapus data';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
