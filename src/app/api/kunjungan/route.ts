import { NextRequest, NextResponse } from 'next/server';
import { integrationAdminClient } from '@/lib/integration-settings';
import { getServerCaller, STAFF_ROLES, requireServerRole } from '@/lib/server-auth';

const READ_ROLES = STAFF_ROLES;

/* ═══════════════════════════════════
   GET — Fetch kunjungan_berobat with filters
   Query params: ?jobsite=&bulan=&tahun=&rujuk_rs=true
   ═══════════════════════════════════ */
export async function GET(request: NextRequest) {
  try {
    const caller = await getServerCaller(request);
    const denied = requireServerRole(caller, READ_ROLES);
    if (denied) return denied;
    if (caller!.role === 'pic' && !caller!.site) {
      return NextResponse.json({ success: false, error: 'Site PIC belum ditetapkan' }, { status: 403 });
    }
    const supabase = integrationAdminClient();
    const { searchParams } = new URL(request.url);
    const jobsite = searchParams.get('jobsite') || '';
    const bulan = searchParams.get('bulan') || '';
    const tahun = searchParams.get('tahun') || '';
    const rujukRs = searchParams.get('rujuk_rs') || '';

    let query = supabase.from('kunjungan_berobat').select('*').order('tanggal', { ascending: false });

    if (caller!.role === 'pic') {
      if (jobsite && jobsite !== 'All Site' && jobsite !== 'all'
        && jobsite.toLowerCase() !== caller!.site!.toLowerCase()) {
        return NextResponse.json({ success: false, error: 'PIC hanya dapat melihat site sendiri' }, { status: 403 });
      }
      query = query.eq('jobsite', caller!.site);
    }
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
      console.error('[Kunjungan] Failed to read visit records:', error.code);
      return NextResponse.json({ success: false, error: 'Gagal mengambil data kunjungan.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch {
    return NextResponse.json({ success: false, error: 'Gagal mengambil data kunjungan.' }, { status: 500 });
  }
}

/* ═══════════════════════════════════
   POST — Insert new kunjungan_berobat
   ═══════════════════════════════════ */
export async function POST(request: NextRequest) {
  try {
    const caller = await getServerCaller(request);
    const denied = requireServerRole(caller, STAFF_ROLES);
    if (denied) return denied;
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Body permintaan tidak valid.' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const { nik, nama, departemen, jobsite, tanggal, diagnosa, jenis_obat, rujuk_rs, nama_rs, usia, jk, jabatan, keluhan, kategori } = input;

    // NIK is optional (e.g. for new hires or interns not yet registered in employee table)
    if (typeof nama !== 'string' || !nama.trim() || typeof jobsite !== 'string' || !jobsite.trim()
      || typeof tanggal !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      return NextResponse.json(
        { success: false, error: 'Nama, Jobsite, dan Tanggal wajib diisi' },
        { status: 400 }
      );
    }
    if (!['Umum', 'Kecelakaan Kerja', 'Penyakit Akibat Kerja'].includes(String(kategori))) {
      return NextResponse.json({ success: false, error: 'Kategori kunjungan tidak valid.' }, { status: 400 });
    }
    if (caller!.role === 'pic'
      && (!caller!.site || String(jobsite).trim().toLowerCase() !== caller!.site.trim().toLowerCase())) {
      return NextResponse.json({ success: false, error: 'PIC hanya dapat mencatat kunjungan di site sendiri' }, { status: 403 });
    }

    const row = {
      nik: nik && String(nik).trim() ? String(nik).trim() : null,
      nama: String(nama).trim(),
      departemen: departemen || null,
      jobsite: String(jobsite).trim(),
      tanggal,
      kategori,
      diagnosa: diagnosa || null,
      jenis_obat: jenis_obat || null,
      rujuk_rs: rujuk_rs === 'Ya' || rujuk_rs === true,
      nama_rs: nama_rs || null,
      usia: usia ? parseInt(String(usia), 10) || null : null,
      jk: jk || null,
      jabatan: jabatan || null,
      keluhan: keluhan || null,
    };

    const { data, error } = await integrationAdminClient().from('kunjungan_berobat').insert(row).select();

    if (error) {
      console.error('[Kunjungan] Failed to save visit record:', error.code);
      return NextResponse.json({ success: false, error: 'Gagal menyimpan data kunjungan.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Data kunjungan berhasil disimpan',
      data,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Gagal menyimpan data kunjungan.' }, { status: 500 });
  }
}
