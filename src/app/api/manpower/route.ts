import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/* ═══════════════════════════════════
   GET — Fetch man_power with filters
   Query params: ?jobsite=&bulan=&tahun=
   ═══════════════════════════════════ */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobsite = searchParams.get('jobsite') || '';
    const bulan = searchParams.get('bulan') || '';
    const tahun = searchParams.get('tahun') || '';

    let query = supabase.from('man_power').select('*').order('jobsite', { ascending: true });

    if (jobsite && jobsite !== 'All Site') {
      query = query.eq('jobsite', jobsite);
    }
    if (bulan) {
      query = query.eq('bulan', parseInt(bulan));
    }
    if (tahun) {
      query = query.eq('tahun', parseInt(tahun));
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mengambil data man power';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/* ═══════════════════════════════════
   POST — Insert or update man_power
   Body: { jobsite, bulan, tahun, man_power, kunjungan_klinik, hari_kerja }
   ═══════════════════════════════════ */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobsite, bulan, tahun, man_power, kunjungan_klinik, hari_kerja } = body;

    if (!jobsite || !bulan || !tahun || !man_power) {
      return NextResponse.json(
        { success: false, error: 'Jobsite, Bulan, Tahun, dan Man Power wajib diisi' },
        { status: 400 }
      );
    }

    const row = {
      jobsite,
      bulan: parseInt(bulan),
      tahun: parseInt(tahun),
      man_power: parseInt(man_power),
      kunjungan_klinik: parseInt(kunjungan_klinik) || 0,
      hari_kerja: parseInt(hari_kerja) || 0,
    };

    const { data, error } = await supabase.from('man_power').upsert(row, {
      onConflict: 'jobsite,bulan,tahun',
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Data Man Power berhasil disimpan',
      data,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menyimpan data man power';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
