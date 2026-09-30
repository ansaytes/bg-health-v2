import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

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

    if (jobsite && jobsite !== 'All Site' && jobsite !== 'all') {
      query = query.eq('jobsite', jobsite);
    }
    if (bulan && bulan !== '0' && bulan !== 'all' && bulan !== 'Semua') {
      const monthNum = parseInt(bulan, 10);
      const y = tahun && tahun !== 'all' && tahun !== 'Semua' ? tahun : '2026';
      const mStr = String(monthNum).padStart(2, '0');
      const lastDay = new Date(parseInt(y, 10), monthNum, 0).getDate();
      query = query.gte('tanggal', `${y}-${mStr}-01`).lte('tanggal', `${y}-${mStr}-${String(lastDay).padStart(2, '0')}`);
    } else if (tahun && tahun !== 'all' && tahun !== 'Semua') {
      query = query.gte('tanggal', `${tahun}-01-01`).lte('tanggal', `${tahun}-12-31`);
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
    const { nik, nama, departemen, jobsite, tanggal, diagnosa, jenis_obat, rujuk_rs, nama_rs, usia, jk, jabatan, keluhan } = body;

    // NIK is optional (e.g. for new hires or interns not yet registered in employee table)
    if (!nama || !jobsite || !tanggal) {
      return NextResponse.json(
        { success: false, error: 'Nama, Jobsite, dan Tanggal wajib diisi' },
        { status: 400 }
      );
    }

    const row = {
      nik: nik && String(nik).trim() ? String(nik).trim() : null,
      nama: String(nama).trim(),
      departemen: departemen || null,
      jobsite,
      tanggal,
      diagnosa: diagnosa || null,
      jenis_obat: jenis_obat || null,
      rujuk_rs: rujuk_rs === 'Ya' || rujuk_rs === true,
      nama_rs: nama_rs || null,
      usia: usia ? parseInt(String(usia), 10) || null : null,
      jk: jk || null,
      jabatan: jabatan || null,
      keluhan: keluhan || null,
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
