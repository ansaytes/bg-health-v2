import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const ALLOWED_FIELDS = [
  'man_power','man_hours','kunjungan_klinik','tk_sakit','absensi_sakit','spell',
  'penyakit_akibat_kerja','kejadian_penyakit_tk','layak_bekerja',
  'rkk','cmr','mfr','ssr','asr','fr_pak','kaptk',
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tahun = searchParams.get('tahun');
    const bulan = searchParams.get('bulan');
    const jobsite = searchParams.get('jobsite');
    const asr_ranking = searchParams.get('asr_ranking');
    const sites_list = searchParams.get('sites_list');

    if (asr_ranking === 'true') {
      let q = supabase
        .from('health_indicators')
        .select('jobsite, asr, man_power, bulan')
        .neq('jobsite', 'All Site');
      if (tahun) q = q.eq('tahun', parseInt(tahun));
      if (bulan) q = q.eq('bulan', parseInt(bulan));
      q = q.order('asr', { ascending: false });
      const { data, error } = await q;
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, data: data || [] });
    }

    if (sites_list === 'true') {
      let q = supabase
        .from('health_indicators')
        .select('jobsite')
        .neq('jobsite', 'All Site');
      if (tahun) q = q.eq('tahun', parseInt(tahun));
      q = q.order('jobsite', { ascending: true });
      const { data, error } = await q;
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      const unique = [...new Set((data || []).map((r: { jobsite: string }) => r.jobsite))];
      return NextResponse.json({ success: true, data: unique });
    }

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
