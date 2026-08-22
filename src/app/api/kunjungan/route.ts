import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/* ═══════════════════════════════════
   GET — Fetch kunjungan_berobat with filters
   Query params: ?jobsite=&bulan=&tahun=&rujuk_rs=true
   ═══════════════════════════════════ */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobsite = searchParams.get('jobsite') || '';
    const bulan = searchParams.get('bulan') || '';
    const tahun = searchParams.get('tahun') || '';
    const rujukRs = searchParams.get('rujuk_rs') || '';

    let query = supabase.from('kunjungan_berobat').select('*').order('tanggal', { ascending: false });

    if (jobsite && jobsite !== 'All Site') {
      query = query.eq('jobsite', jobsite);
    }
    if (bulan) {
      // Filter by month extracted from tanggal
      const monthNum = parseInt(bulan);
      const startDate = `${tahun || '2026'}-${String(monthNum).padStart(2, '0')}-01`;
      const endDate = `${tahun || '2026'}-${String(monthNum).padStart(2, '0')}-31`;
      query = query.gte('tanggal', startDate).lte('tanggal', endDate);
    }
    if (rujukRs === 'true') {
      query = query.eq('rujuk_rs', true);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mengambil data kunjungan';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/* ═══════════════════════════════════
   POST — Insert new kunjungan_berobat
   ═══════════════════════════════════ */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nik, nama, departemen, jobsite, tanggal, diagnosa, jenis_obat, rujuk_rs, nama_rs } = body;

    if (!nik || !nama || !jobsite || !tanggal) {
      return NextResponse.json(
        { success: false, error: 'NIK, Nama, Jobsite, dan Tanggal wajib diisi' },
        { status: 400 }
      );
    }

    const row = {
      nik,
      nama,
      departemen: departemen || null,
      jobsite,
      tanggal,
      diagnosa: diagnosa || null,
      jenis_obat: jenis_obat || null,
      rujuk_rs: rujuk_rs === 'Ya' || rujuk_rs === true,
      nama_rs: nama_rs || null,
    };

    const { data, error } = await supabase.from('kunjungan_berobat').insert(row).select();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Data kunjungan berhasil disimpan',
      data,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menyimpan data kunjungan';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
