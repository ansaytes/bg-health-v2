import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const MKEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

const LEADING_MAP: Record<string, string> = {
  'Man Power': 'man_power',
  'Man Hours': 'man_hours',
  'Total Kunjungan Klinik': 'kunjungan_klinik',
  'Tenaga Kerja Sakit': 'tk_sakit',
  'Total Absensi Sakit': 'absensi_sakit',
  'Spell': 'spell',
  'Penyakit Akibat Kerja': 'penyakit_akibat_kerja',
  'Kejadian Akibat Penyakit Tenaga Kerja': 'kejadian_penyakit_tk',
  'Layak Bekerja': 'layak_bekerja',
};

const LAGGING_MAP: Record<string, string> = {
  'RKK': 'rkk',
  'CMR': 'cmr',
  'MFR': 'mfr',
  'SSR': 'ssr',
  'ASR': 'asr',
  'FR PAK': 'fr_pak',
  'KAPTK': 'kaptk',
};

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams;
  const tahun = url.get('tahun') || '2026';
  const site = url.get('site') || 'All Site';
  const bulan = url.get('bulan');

  let q = supabase
    .from('health_indicators')
    .select('*')
    .eq('tahun', Number(tahun))
    .eq('jobsite', site)
    .order('bulan', { ascending: true });

  if (bulan) q = q.eq('bulan', Number(bulan));

  const { data, error } = await q;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const rows = data || [];

  const leading = Object.entries(LEADING_MAP).map(([label, col]) => {
    const entry: Record<string, unknown> = { indicator: label };
    let total = 0;
    MKEYS.forEach((m, i) => {
      const row = rows.find((r: { bulan: number }) => r.bulan === i + 1);
      const val = Number(row?.[col as keyof typeof row]) || 0;
      entry[m] = val;
      total += val;
    });
    entry.total = total;
    return entry;
  });

  const lagging = Object.entries(LAGGING_MAP).map(([label, col]) => {
    const entry: Record<string, unknown> = { indicator: label };
    let sumVal = 0;
    let count = 0;
    MKEYS.forEach((m, i) => {
      const row = rows.find((r: { bulan: number }) => r.bulan === i + 1);
      const val = Number(row?.[col as keyof typeof row]) || 0;
      entry[m] = val;
      if (val > 0) { sumVal += val; count++; }
    });
    entry.ytd = count > 0 ? sumVal / count : 0;
    return entry;
  });

  if (bulan) {
    const b = Number(bulan);
    const singleRow = rows.find((r: { bulan: number }) => r.bulan === b);
    return NextResponse.json({ success: true, data: { lagging, leading, site, row: singleRow || null } });
  }

  return NextResponse.json({ success: true, data: { lagging, leading, site } });
}

const ALL_FIELDS = [
  'man_power','man_hours','kunjungan_klinik','tk_sakit','absensi_sakit','spell',
  'penyakit_akibat_kerja','kejadian_penyakit_tk','layak_bekerja',
  'rkk','cmr','mfr','ssr','asr','fr_pak','kaptk',
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tahun, bulan, jobsite, ...fields } = body;

    if (!tahun || !bulan || !jobsite) {
      return NextResponse.json({ success: false, error: 'tahun, bulan, dan jobsite wajib diisi' }, { status: 400 });
    }

    const row: Record<string, unknown> = {
      tahun: parseInt(String(tahun)),
      bulan: parseInt(String(bulan)),
      jobsite: String(jobsite),
    };
    for (const f of ALL_FIELDS) {
      if (fields[f] !== undefined && fields[f] !== '') {
        row[f] = parseFloat(String(fields[f])) || 0;
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

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { tahun, bulan, jobsite, ...fields } = body;

    if (!tahun || !bulan || !jobsite) {
      return NextResponse.json({ success: false, error: 'tahun, bulan, dan jobsite wajib diisi' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    for (const f of ALL_FIELDS) {
      if (fields[f] !== undefined) updateData[f] = parseFloat(String(fields[f])) || 0;
    }

    const { data, error } = await supabase
      .from('health_indicators')
      .update(updateData)
      .eq('tahun', parseInt(String(tahun)))
      .eq('bulan', parseInt(String(bulan)))
      .eq('jobsite', String(jobsite))
      .select();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mengupdate data';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
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
