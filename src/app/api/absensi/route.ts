import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getServerCaller, READ_ROLES, STAFF_ROLES, requireServerRole } from '@/lib/server-auth';

/* ═══════════════════════════════════
   GET — Fetch absensi_sakit with filters
   Query params: ?jobsite=&bulan=&tahun=
   ═══════════════════════════════════ */
export async function GET(request: NextRequest) {
  try {
    const caller = await getServerCaller(request);
    const denied = requireServerRole(caller, READ_ROLES);
    if (denied) return denied;
    if (caller!.role === 'pic' && !caller!.site) return NextResponse.json({ error: 'Site PIC belum ditetapkan' }, { status: 403 });
    const { searchParams } = new URL(request.url);
    let jobsite = searchParams.get('jobsite') || '';
    if (caller!.role === 'pic') {
      if (jobsite && jobsite !== 'All Site' && jobsite.toLowerCase() !== caller!.site!.toLowerCase()) {
        return NextResponse.json({ error: 'PIC hanya dapat melihat site sendiri' }, { status: 403 });
      }
      jobsite = caller!.site!;
    }
    const bulan = searchParams.get('bulan') || '';
    const tahun = searchParams.get('tahun') || '';

    let query = supabase.from('absensi_sakit').select('*').order('created_at', { ascending: false });

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
    const msg = err instanceof Error ? err.message : 'Gagal mengambil data absensi';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/* ═══════════════════════════════════
   POST — Insert new absensi_sakit
   Body: { nik, nama, jobsite, jabatan, bulan, tahun,
           tgl_mulai_a, tgl_selesai_a, hari_a, diag_a,
           tgl_mulai_b, tgl_selesai_b, hari_b, diag_b,
           tgl_mulai_c, tgl_selesai_c, hari_c, diag_c,
           spell, is_pak }
   ═══════════════════════════════════ */
export async function POST(request: NextRequest) {
  try {
    const caller = await getServerCaller(request);
    const denied = requireServerRole(caller, STAFF_ROLES);
    if (denied) return denied;
    const body = await request.json();
    const {
      nik, nama, jobsite, jabatan, bulan, tahun,
      tgl_mulai_a, tgl_selesai_a, hari_a, diag_a,
      tgl_mulai_b, tgl_selesai_b, hari_b, diag_b,
      tgl_mulai_c, tgl_selesai_c, hari_c, diag_c,
      spell, is_pak,
    } = body;

    if (!nik || !nama || !jobsite || !bulan || !tahun) {
      return NextResponse.json(
        { success: false, error: 'NIK, Nama, Jobsite, Bulan, dan Tahun wajib diisi' },
        { status: 400 }
      );
    }
    if (caller!.role === 'pic' && (!caller!.site || String(jobsite).toLowerCase() !== caller!.site.toLowerCase())) {
      return NextResponse.json({ error: 'PIC hanya dapat mencatat absensi pada site sendiri' }, { status: 403 });
    }

    const row = {
      nik,
      nama,
      jobsite,
      jabatan: jabatan || null,
      bulan: parseInt(bulan),
      tahun: parseInt(tahun),
      tgl_mulai_a: tgl_mulai_a || null,
      tgl_selesai_a: tgl_selesai_a || null,
      hari_a: parseInt(hari_a) || 0,
      diag_a: diag_a || null,
      tgl_mulai_b: tgl_mulai_b || null,
      tgl_selesai_b: tgl_selesai_b || null,
      hari_b: parseInt(hari_b) || 0,
      diag_b: diag_b || null,
      tgl_mulai_c: tgl_mulai_c || null,
      tgl_selesai_c: tgl_selesai_c || null,
      hari_c: parseInt(hari_c) || 0,
      diag_c: diag_c || null,
      spell: parseInt(spell) || 1,
      is_pak: is_pak === 'Ya' || is_pak === true,
    };

    const { data, error } = await supabase.from('absensi_sakit').upsert(row, {
      onConflict: 'nik,bulan,tahun',
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Data absensi berhasil disimpan',
      data,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menyimpan data absensi';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
