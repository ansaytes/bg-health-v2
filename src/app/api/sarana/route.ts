import { NextRequest, NextResponse } from 'next/server';

import { adminClient, getCaller } from '@/lib/questionnaire-store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sarana?site=<site>
 *
 * Daftar sarana & prasarana klinik untuk satu site, digabung dengan katalog
 * acuan SOP/028 poin 5.5.
 *
 * Desain: item yang belum dicatat per site tetap tampil dengan status
 * `tidak_ada` — bukan disembunyikan. Kekosongan data harus terlihat agar bisa
 * ditindaklanjuti, sama seperti prinsip pada dashboard lain.
 *
 * Akses: superuser, administrator, pic (site sendiri), manager (baca).
 */
const ROLES_BACA = ['superuser', 'administrator', 'pic', 'manager'];

export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES_BACA.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const client = adminClient();
  const siteParam = req.nextUrl.searchParams.get('site')?.trim() || '';
  const picSite = caller.role === 'pic' ? caller.site ?? null : null;
  const site = picSite || siteParam;

  if (!site) {
    return NextResponse.json({ error: 'Parameter site wajib diisi' }, { status: 400 });
  }

  const [{ data: katalog, error: katalogError }, { data: kondisi, error: kondisiError }] = await Promise.all([
    client.from('sarana_katalog').select('id,nama,kategori,wajib,perlu_kalibrasi,urutan').order('urutan'),
    client.from('sarana_site').select('*').eq('site', site),
  ]);

  if (katalogError) {
    return NextResponse.json({
      error: 'Tabel sarana belum dibuat. Jalankan migration 20261028_sarana_klinik.sql.',
      detail: katalogError.message,
    }, { status: 500 });
  }
  if (kondisiError) {
    return NextResponse.json({ error: kondisiError.message }, { status: 500 });
  }

  const byKatalog = new Map((kondisi ?? []).map((k) => [String(k.katalog_id), k]));

  const items = (katalog ?? []).map((kat) => {
    const c = byKatalog.get(String(kat.id));
    return {
      katalogId: kat.id,
      nama: kat.nama,
      kategori: kat.kategori,
      wajib: kat.wajib,
      perluKalibrasi: kat.perlu_kalibrasi,
      status: c?.status ?? 'tidak_ada',
      jumlah: c?.jumlah ?? null,
      kondisi: c?.kondisi ?? null,
      tanggalKalibrasi: c?.tanggal_kalibrasi ?? null,
      tanggalInspeksi: c?.tanggal_inspeksi ?? null,
      catatan: c?.catatan ?? null,
      tersedia: Boolean(c),
    };
  });

  // Ringkasan: hanya item WAJIB yang dihitung, item tamb tidak
  // boleh membuat persentase kepatuhan turun.
  const wajib = items.filter((i) => i.wajib && i.status !== 'tidak_diperlukan');
  const tersedia = wajib.filter((i) => i.status === 'ada');
  const rusak = items.filter((i) => i.status === 'rusak');
  const belumDicatat = items.filter((i) => !i.tersedia).length;
  const kalibrasiKedaluwarsa = items.filter((i) => {
    if (!i.perluKalibrasi || !i.tanggalKalibrasi) return false;
    const lewat = (Date.now() - new Date(`${i.tanggalKalibrasi}T00:00:00`).getTime()) / 86_400_000;
    return lewat > 365;
  }).length;

  return NextResponse.json({
    success: true,
    site,
    items,
    ringkasan: {
      total: items.length,
      wajib: wajib.length,
      tersedia: tersedia.length,
      persenWajibTerpenuhi: wajib.length ? (tersedia.length / wajib.length) * 100 : 100,
      rusak: rusak.length,
      belumDicatat,
      kalibrasiKedaluwarsa,
    },
    kategoriUrut: ['perlengkapan_umum', 'ruangan', 'peralatan_medis', 'sarana_penunjang', 'alat_evakuasi', 'obat'],
  });
}

/**
 * POST /api/sarana — simpan kondisi satu item (upsert per site + katalog).
 *
 * Body: { site, katalogId, status, jumlah?, kondisi?, tanggalKalibrasi?,
 *         tanggalInspeksi?, catatan? }
 */
export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !['superuser', 'administrator', 'pic'].includes(String(caller.role))) {
    return NextResponse.json({ error: 'Hanya QSHE Medic / PIC yang dapat mengubah data sarana' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const site = String(body.site ?? '').trim();
  const katalogId = String(body.katalogId ?? '').trim();
  if (!site || !katalogId) {
    return NextResponse.json({ error: 'site dan katalogId wajib diisi' }, { status: 400 });
  }
  if (caller.role === 'pic' && caller.site && caller.site.toLowerCase() !== site.toLowerCase()) {
    return NextResponse.json({ error: 'PIC hanya dapat mengubah sarana site sendiri' }, { status: 403 });
  }

  const status = String(body.status ?? 'tidak_ada');
  if (!['ada', 'tidak_ada', 'rusak', 'tidak_diperlukan'].includes(status)) {
    return NextResponse.json({ error: 'status tidak valid' }, { status: 400 });
  }

  const { error } = await adminClient().from('sarana_site').upsert({
    site,
    katalog_id: katalogId,
    status,
    jumlah: body.jumlah === '' || body.jumlah == null ? null : Number(body.jumlah),
    kondisi: body.kondisi || null,
    tanggal_kalibrasi: body.tanggalKalibrasi || null,
    tanggal_inspeksi: body.tanggalInspeksi || null,
    catatan: body.catatan || null,
    diperbarui_oleh: caller.userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'site,katalog_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** POST /api/sarana/katalog — tambah item sendiri sesuai kondisi lapangan. */
export async function PUT(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !['superuser', 'administrator'].includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const nama = String(body.nama ?? '').trim();
  if (!nama) return NextResponse.json({ error: 'Nama item wajib diisi' }, { status: 400 });

  const { data, error } = await adminClient().from('sarana_katalog').insert({
    nama,
    kategori: String(body.kategori ?? 'peralatan_medis'),
    wajib: body.wajib === true,
    perlu_kalibrasi: body.perluKalibrasi === true,
    // Item tambahan ditaruh paling akhir.
    urutan: 900 + Math.floor(Math.random() * 90),
  }).select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: data?.id });
}
