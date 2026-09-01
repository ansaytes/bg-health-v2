import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/* ═══════════════════════════════════
   GET — Ambil data statistik kesehatan
   ?tahun=2026&bulan=4
   ?mode=per_site&tahun=2026&bulan=4
   ═══════════════════════════════════ */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tahun = searchParams.get('tahun');
    const bulan = searchParams.get('bulan');
    const mode = searchParams.get('mode');

    if (mode === 'per_site') {
      let q = supabase
        .from('health_statistics_sites')
        .select('*')
        .order('asr', { ascending: false });
      if (tahun) q = q.eq('tahun', parseInt(tahun));
      if (bulan) q = q.eq('bulan', parseInt(bulan));
      const { data, error } = await q;
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, data: data || [] });
    }

    const q = supabase
      .from('health_statistics')
      .select('*')
      .order('bulan', { ascending: true });
    if (tahun) q.eq('tahun', parseInt(tahun));
    if (bulan) q.eq('bulan', parseInt(bulan));

    const { data, error } = await q;
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mengambil data';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/* ═══════════════════════════════════
   POST — Tambah / update data statistik bulanan
   Body: { tahun, bulan, man_power, man_hours, ... }
   ═══════════════════════════════════ */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tahun, bulan, ...fields } = body;

    if (!tahun || !bulan) {
      return NextResponse.json({ success: false, error: 'tahun dan bulan wajib diisi' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('health_statistics')
      .upsert({
        tahun: parseInt(tahun),
        bulan: parseInt(bulan),
        man_power: fields.man_power ?? 0,
        man_hours: fields.man_hours ?? 0,
        tk_sakit: fields.tk_sakit ?? 0,
        absensi_sakit: fields.absensi_sakit ?? 0,
        spell: fields.spell ?? 0,
        rkk: fields.rkk ?? 0,
        cmr: fields.cmr ?? 0,
        mfr: fields.mfr ?? 0,
        ssr: fields.ssr ?? 0,
        asr: fields.asr ?? 0,
        fr_pak: fields.fr_pak ?? 0,
        kaptk: fields.kaptk ?? 0,
      }, { onConflict: 'tahun,bulan' });

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menyimpan data';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/* ═══════════════════════════════════
   PUT — Update data statistik bulanan
   Body: { tahun, bulan, ...fields }
   ═══════════════════════════════════ */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { tahun, bulan, ...fields } = body;

    if (!tahun || !bulan) {
      return NextResponse.json({ success: false, error: 'tahun dan bulan wajib diisi' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = ['man_power', 'man_hours', 'tk_sakit', 'absensi_sakit', 'spell', 'rkk', 'cmr', 'mfr', 'ssr', 'asr', 'fr_pak', 'kaptk'];
    for (const f of allowedFields) {
      if (fields[f] !== undefined) updateData[f] = fields[f];
    }

    const { data, error } = await supabase
      .from('health_statistics')
      .update(updateData)
      .eq('tahun', parseInt(tahun))
      .eq('bulan', parseInt(bulan))
      .select();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mengupdate data';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/* ═══════════════════════════════════
   DELETE — Hapus data statistik bulanan
   ?tahun=2026&bulan=4
   ═══════════════════════════════════ */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tahun = searchParams.get('tahun');
    const bulan = searchParams.get('bulan');

    if (!tahun || !bulan) {
      return NextResponse.json({ success: false, error: 'tahun dan bulan wajib diisi' }, { status: 400 });
    }

    const { error } = await supabase
      .from('health_statistics')
      .delete()
      .eq('tahun', parseInt(tahun))
      .eq('bulan', parseInt(bulan));

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menghapus data';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}