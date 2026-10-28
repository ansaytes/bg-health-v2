import { NextRequest, NextResponse } from 'next/server';

import { adminClient, getCaller } from '@/lib/questionnaire-store';
import { ITEM_INSPEKSI, nilaiInspeksi, type NilaiItem } from '@/lib/sanitasi-inspeksi';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sanitasi?site=<site>            — riwayat inspeksi
 * GET /api/sanitasi?site=<site>&id=<uuid>  — detail satu inspeksi
 * GET /api/sanitasi?template=1             — daftar item checklist (STD/005)
 *
 * POST /api/sanitasi — simpan satu sesi inspeksi.
 *
 * DASAR: BG/QSHE/STD/005 Rev.001 via SOP/028 poin 5.7.
 * Sebagian besar item DIHITUNG (rasio toilet, kebisingan, pencahayaan, indeks
 * vektor, kualitas udara), sisanya dinilai inspektur. Hasil penilaian dihitung
 * di server agar konsisten dengan dokumen.
 */
const ROLES_BACA = ['superuser', 'administrator', 'pic', 'manager'];
const ROLES_TULIS = ['superuser', 'administrator', 'pic'];

export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES_BACA.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  if (req.nextUrl.searchParams.get('template') === '1') {
    return NextResponse.json({ success: true, items: ITEM_INSPEKSI });
  }

  const client = adminClient();
  const picSite = caller.role === 'pic' ? caller.site ?? null : null;
  const site = picSite || req.nextUrl.searchParams.get('site')?.trim() || null;
  const id = req.nextUrl.searchParams.get('id')?.trim();

  if (id) {
    const { data, error } = await client.from('sanitasi_inspeksi').select('*').eq('id', id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Inspeksi tidak ditemukan' }, { status: 404 });
    return NextResponse.json({ success: true, inspeksi: data });
  }

  if (!site) {
    return NextResponse.json({ error: 'Parameter site wajib diisi' }, { status: 400 });
  }

  const { data, error } = await client
    .from('sanitasi_inspeksi')
    .select('id,site,tanggal,inspektur,ringkasan,catatan,created_at')
    .eq('site', site)
    .order('tanggal', { ascending: false })
    .limit(100);

  if (error) {
    if (/does not exist|PGRST205|42P01/i.test(error.message)) {
      return NextResponse.json({
        success: true, data: [], tabelSiap: false,
        catatan: 'Tabel belum dibuat. Jalankan migration 20261028_sanitasi_inspeksi.sql.',
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data ?? [], tabelSiap: true, site });
}

export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES_TULIS.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Hanya QSHE Medic / PIC yang dapat menyimpan inspeksi' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const site = String(body.site ?? '').trim();
  const tanggal = String(body.tanggal ?? '').slice(0, 10);
  if (!site || !tanggal) {
    return NextResponse.json({ error: 'site dan tanggal wajib diisi' }, { status: 400 });
  }
  if (caller.role === 'pic' && caller.site && caller.site.toLowerCase() !== site.toLowerCase()) {
    return NextResponse.json({ error: 'PIC hanya dapat mengisi inspeksi site sendiri' }, { status: 403 });
  }

  const nilai = (body.nilai && typeof body.nilai === 'object' ? body.nilai : {}) as Record<string, NilaiItem>;
  const hasil = nilaiInspeksi(nilai);

  const { error } = await adminClient().from('sanitasi_inspeksi').upsert({
    site,
    tanggal,
    inspektur: body.inspektur || null,
    nilai,
    // Hasil disimpan apa adanya agar audit tetap konsisten walau daftar item
    // berubah di kemudian hari.
    ringkasan: hasil.ringkasan,
    catatan: body.catatan || null,
    created_by: caller.userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'site,tanggal' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, ringkasan: hasil.ringkasan, items: hasil.items });
}
