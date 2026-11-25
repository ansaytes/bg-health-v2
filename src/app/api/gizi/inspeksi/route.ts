import { NextRequest, NextResponse } from 'next/server';

import { adminClient, getCaller } from '@/lib/questionnaire-store';
import { CHECKLIST_GIZI, hitungSkorInspeksiGizi } from '@/lib/gizi-inspeksi';

export const dynamic = 'force-dynamic';

/**
 * GET  /api/gizi/inspeksi?site=<site>            — riwayat inspeksi jasaboga
 * GET  /api/gizi/inspeksi?id=<uuid>             — detail satu inspeksi
 * GET  /api/gizi/inspeksi?template=1            — daftar item checklist
 *
 * POST /api/gizi/inspeksi — simpan satu sesi inspeksi jasaboga / kantin.
 *
 * DASAR HUKUM:
 *  - Kepmen ESDM No. 1827 K/30/MEM/2018 Lampiran IV (Kesehatan Kerja)
 *  - Permenkes No. 1096/MENKES/PER/VI/2011 tentang Higiene Sanitasi Jasaboga
 *  - Permenkes No. 28 Tahun 2019 tentang Angka Kecukupan Gizi (AKG)
 */
const ROLES_BACA = ['superuser', 'administrator', 'pic', 'manager'];
const ROLES_TULIS = ['superuser', 'administrator', 'pic'];

export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES_BACA.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  if (req.nextUrl.searchParams.get('template') === '1') {
    return NextResponse.json({ success: true, items: CHECKLIST_GIZI });
  }

  const client = adminClient();
  const siteParam = req.nextUrl.searchParams.get('site')?.trim() || '';
  if (caller.role === 'pic' && !caller.site) {
    return NextResponse.json({ error: 'Site PIC belum ditetapkan.' }, { status: 403 });
  }
  if (caller.role === 'pic' && siteParam && siteParam.toLowerCase() !== caller.site!.toLowerCase()) {
    return NextResponse.json({ error: 'PIC hanya dapat melihat site sendiri.' }, { status: 403 });
  }
  const site = caller.role === 'pic' ? caller.site! : siteParam || null;
  const id = req.nextUrl.searchParams.get('id')?.trim();

  if (id) {
    const { data, error } = await client.from('gizi_inspeksi_jasaboga').select('*').eq('id', id).maybeSingle();
    if (error) {
      if (/does not exist|PGRST205|42P01/i.test(error.message)) {
        return NextResponse.json({ success: true, tabelSiap: false, inspeksi: null });
      }
      return NextResponse.json({ error: 'Gagal membaca inspeksi jasaboga.' }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'Inspeksi tidak ditemukan' }, { status: 404 });
    if (caller.role === 'pic' && String(data.site ?? '').toLowerCase() !== caller.site!.toLowerCase()) {
      return NextResponse.json({ error: 'PIC hanya dapat melihat site sendiri.' }, { status: 403 });
    }
    return NextResponse.json({ success: true, inspeksi: data });
  }

  let query = client
    .from('gizi_inspeksi_jasaboga')
    .select('id,site,tanggal,inspektur,vendor,nama_kantin,jumlah_porsi,jumlah_penjamah,jumlah_buku_sehat,no_slhs,tgl_kadaluwarsa_slhs,kalori_sarapan,kalori_siang,kalori_malam,extra_fooding,jawaban,ringkasan,catatan,created_at')
    .order('tanggal', { ascending: false })
    .limit(100);

  if (site) {
    query = query.eq('site', site);
  }

  const { data, error } = await query;

  if (error) {
    if (/does not exist|PGRST205|42P01/i.test(error.message)) {
      return NextResponse.json({
        success: true,
        data: [],
        tabelSiap: false,
        catatan: 'Tabel database gizi_inspeksi_jasaboga belum tersedia.',
      });
    }
    return NextResponse.json({ error: 'Gagal membaca riwayat inspeksi jasaboga.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data ?? [], tabelSiap: true, site });
}

export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES_TULIS.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  let body: {
    site?: string;
    tanggal?: string;
    inspektur?: string;
    vendor?: string;
    nama_kantin?: string;
    jumlah_porsi?: number;
    jumlah_penjamah?: number;
    jumlah_buku_sehat?: number;
    no_slhs?: string;
    tgl_kadaluwarsa_slhs?: string;
    kalori_sarapan?: number;
    kalori_siang?: number;
    kalori_malam?: number;
    extra_fooding?: string;
    jawaban?: Record<string, 'sesuai' | 'tidak_sesuai' | 'tidak_berlaku'>;
    catatan?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Format JSON tidak valid' }, { status: 400 });
  }

  const site = body.site?.trim();
  const tanggal = body.tanggal?.trim();
  const vendor = body.vendor?.trim() || '';
  const jawaban = body.jawaban ?? {};

  if (!site || !tanggal) {
    return NextResponse.json({ error: 'Parameter site dan tanggal wajib diisi' }, { status: 400 });
  }

  if (caller.role === 'pic' && caller.site && site.toLowerCase() !== caller.site.toLowerCase()) {
    return NextResponse.json({ error: 'PIC hanya dapat mengisi site sendiri' }, { status: 403 });
  }

  const inspektur = body.inspektur?.trim() || '—';
  const ringkasan = hitungSkorInspeksiGizi(jawaban);

  const client = adminClient();
  const record = {
    site,
    tanggal,
    inspektur,
    vendor,
    nama_kantin: body.nama_kantin || '',
    jumlah_porsi: Number(body.jumlah_porsi) || 0,
    jumlah_penjamah: Number(body.jumlah_penjamah) || 0,
    jumlah_buku_sehat: Number(body.jumlah_buku_sehat) || 0,
    no_slhs: body.no_slhs || '',
    tgl_kadaluwarsa_slhs: body.tgl_kadaluwarsa_slhs || null,
    kalori_sarapan: Number(body.kalori_sarapan) || 0,
    kalori_siang: Number(body.kalori_siang) || 0,
    kalori_malam: Number(body.kalori_malam) || 0,
    extra_fooding: body.extra_fooding || 'Tersedia',
    jawaban,
    ringkasan,
    catatan: body.catatan?.trim() || '',
    created_by: caller.userId,
  };

  const { data, error } = await client
    .from('gizi_inspeksi_jasaboga')
    .insert([record])
    .select('id,site,tanggal,created_at')
    .maybeSingle();

  if (error) {
    if (/does not exist|PGRST205|42P01/i.test(error.message)) {
      // Return ringkasan gracefully even if DB table hasn't been created yet
      return NextResponse.json({
        success: true,
        tabelSiap: false,
        ringkasan,
        pesan: 'Data inspeksi telah dihitung. Catatan: tabel database gizi_inspeksi_jasaboga belum dibuat.',
      });
    }
    return NextResponse.json({ error: `Gagal menyimpan inspeksi: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    tabelSiap: true,
    id: data?.id,
    ringkasan,
  });
}
