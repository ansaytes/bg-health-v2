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

  const baseCols = 'id,site,tanggal,inspektur,vendor,nama_kantin,jumlah_porsi,jumlah_penjamah,jumlah_buku_sehat,no_slhs,tgl_kadaluwarsa_slhs,kalori_sarapan,kalori_siang,kalori_malam,extra_fooding,ringkasan,catatan,created_at';
  const picaCols = 'pica_no,pica_temuan,pica_akar_masalah,pica_tindakan,pica_pic,pica_due_date,pica_status,pica_items';

  const buildQuery = (cols: string) => {
    let q = client
      .from('gizi_inspeksi_jasaboga')
      .select(cols)
      .order('tanggal', { ascending: false })
      .limit(100);
    if (site) q = q.eq('site', site);
    return q;
  };

  let { data, error } = await buildQuery(`${baseCols},jawaban,${picaCols}`);

  // Fallback 1: Jika kolom PICA belum dimigrasi di Supabase
  if (error && /pica_|PGRST204|42703/i.test(error.message)) {
    ({ data, error } = await buildQuery(`${baseCols},jawaban`));
  }

  // Fallback 2: Bila kolom `jawaban` juga belum dimigrasi di Supabase
  if (error && /jawaban|PGRST204|42703/i.test(error.message)) {
    ({ data, error } = await buildQuery(baseCols));
  }

  if (error) {
    const errText = `${error.code ?? ''} ${error.message ?? ''}`;
    if (/does not exist|Could not find the table|PGRST205|42P01/i.test(errText)) {
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
    pica_no?: string;
    pica_temuan?: string;
    pica_akar_masalah?: string;
    pica_tindakan?: string;
    pica_pic?: string;
    pica_due_date?: string;
    pica_status?: string;
    pica_items?: unknown[];
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
  const baseRecord: Record<string, unknown> = {
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

  const picaRecord: Record<string, unknown> = {
    ...baseRecord,
    pica_no: body.pica_no?.trim() || null,
    pica_temuan: body.pica_temuan?.trim() || null,
    pica_akar_masalah: body.pica_akar_masalah?.trim() || null,
    pica_tindakan: body.pica_tindakan?.trim() || null,
    pica_pic: body.pica_pic?.trim() || null,
    pica_due_date: body.pica_due_date || null,
    pica_status: body.pica_status || 'OPEN',
    pica_items: Array.isArray(body.pica_items) ? body.pica_items : [],
  };

  let { data, error } = await client
    .from('gizi_inspeksi_jasaboga')
    .insert([picaRecord])
    .select('id,site,tanggal,created_at')
    .maybeSingle();

  // Fallback jika kolom PICA belum ada di tabel Supabase
  if (error && /pica_|PGRST204|42703/i.test(error.message)) {
    ({ data, error } = await client
      .from('gizi_inspeksi_jasaboga')
      .insert([baseRecord])
      .select('id,site,tanggal,created_at')
      .maybeSingle());
  }

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

export async function PATCH(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES_TULIS.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  let body: {
    id: string;
    pica_no?: string;
    pica_temuan?: string;
    pica_akar_masalah?: string;
    pica_tindakan?: string;
    pica_pic?: string;
    pica_due_date?: string | null;
    pica_status?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Format JSON tidak valid' }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: 'ID inspeksi wajib disertakan' }, { status: 400 });
  }

  const client = adminClient();
  const updatePayload: Record<string, unknown> = {};
  if ('pica_no' in body) updatePayload.pica_no = body.pica_no?.trim() || null;
  if ('pica_temuan' in body) updatePayload.pica_temuan = body.pica_temuan?.trim() || null;
  if ('pica_akar_masalah' in body) updatePayload.pica_akar_masalah = body.pica_akar_masalah?.trim() || null;
  if ('pica_tindakan' in body) updatePayload.pica_tindakan = body.pica_tindakan?.trim() || null;
  if ('pica_pic' in body) updatePayload.pica_pic = body.pica_pic?.trim() || null;
  if ('pica_due_date' in body) updatePayload.pica_due_date = body.pica_due_date || null;
  if ('pica_status' in body) updatePayload.pica_status = body.pica_status || 'OPEN';

  const { error } = await client
    .from('gizi_inspeksi_jasaboga')
    .update(updatePayload)
    .eq('id', body.id);

  if (error) {
    return NextResponse.json({ error: `Gagal memperbarui status PICA: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, pesan: 'PICA inspeksi jasaboga berhasil diperbarui' });
}
