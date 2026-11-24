import { NextRequest, NextResponse } from 'next/server';

import { adminClient, getCaller } from '@/lib/questionnaire-store';
import {
  DEPARTEMEN_BAWAAN,
  JENIS_META,
  deskripsiTemuan,
  kunciPicaOtomatis,
  layakJadiPica,
  tenggatDariTingkat,
  tingkatDariStatus,
  tanggalISO,
  type TemuanMasuk,
} from '@/lib/inspeksi-program';

export const dynamic = 'force-dynamic';

/**
 * POST /api/pica/otomatis — buat PICA dari temuan inspeksi.
 *
 * Sumber temuan (semuanya sudah ada, tidak perlu input ulang):
 *   p3k_site               status rusak / tidak_ada
 *   ambulans_site          status rusak / tidak_ada
 *   ergonomi_sarana_site   rusak > 0
 *   sarana_site            status rusak / tidak_ada
 *
 * Aturan:
 *   • hanya `rusak` dan `tidak_ada` yang jadi PICA (lihat layakJadiPica),
 *   • tenggat dari tingkat (tidak_ada = kritis 3 hari, rusak = mayor 14 hari),
 *   • departemen diisi saran bawaan per jenis, tetap bisa diubah,
 *   • PICA yang sudah ada untuk objek+tanggal yang sama TIDAK dibuat ulang,
 *     sehingga tombolnya boleh ditekan berulang.
 *
 * Akses: superuser, administrator, manager, pic (site sendiri).
 */
const ROLES = ['superuser', 'administrator', 'manager', 'pic'];

const PESAN_TABEL =
  'Tabel PICA belum dibuat. Jalankan database/inspeksi_program.sql di SQL Editor Supabase.';

const belumAda = (pesan: string) => /42P01|PGRST205|does not exist|schema cache/i.test(pesan);

interface SumberTemuan {
  tabel: string;
  jenis: string;
  /** Nama objek diambil dari relasi katalog bila ada. */
  katalog?: { tabel: string; kolomNama: string };
  kolomLokasi?: string;
  /** Kunci objek untuk `objek_id` (mis. gabungan unit+katalog). */
  idDari: (row: Record<string, unknown>) => string;
  namaDari: (row: Record<string, unknown>, katalog: Map<string, string>) => string;
}

const SUMBER: SumberTemuan[] = [
  {
    tabel: 'p3k_site',
    jenis: 'p3k',
    katalog: { tabel: 'p3k_katalog', kolomNama: 'nama' },
    kolomLokasi: 'lokasi',
    idDari: r => String(r.katalog_id ?? ''),
    namaDari: (r, kat) => kat.get(String(r.katalog_id)) ?? 'Item P3K',
  },
  {
    tabel: 'ambulans_site',
    jenis: 'ambulans',
    katalog: { tabel: 'ambulans_katalog', kolomNama: 'nama' },
    kolomLokasi: 'unit',
    idDari: r => String(r.katalog_id ?? ''),
    namaDari: (r, kat) => kat.get(String(r.katalog_id)) ?? 'Item ambulans',
  },
  {
    tabel: 'ergonomi_sarana_site',
    jenis: 'ergonomi',
    katalog: { tabel: 'ergonomi_sarana_katalog', kolomNama: 'nama' },
    idDari: r => String(r.katalog_id ?? ''),
    namaDari: (r, kat) => kat.get(String(r.katalog_id)) ?? 'Sarana ergonomi',
  },
  {
    tabel: 'sarana_site',
    jenis: 'sarana_klinik',
    katalog: { tabel: 'sarana_katalog', kolomNama: 'nama' },
    idDari: r => String(r.katalog_id ?? ''),
    namaDari: (r, kat) => kat.get(String(r.katalog_id)) ?? 'Sarana klinik',
  },
];

export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const picSite = caller.role === 'pic' ? (caller.site ?? null) : null;
  const siteFilter = picSite || String(body?.site ?? '').trim();
  const jenisFilter = Array.isArray(body?.jenis) && body.jenis.length ? body.jenis as string[] : null;

  const client = adminClient();
  const sekarang = new Date();
  const hariIni = tanggalISO(sekarang);

//  Kumpulkan temuan dari semua sumber
  const temuan: (TemuanMasuk & { tingkat: string })[] = [];

  for (const sumber of SUMBER) {
    if (jenisFilter && !jenisFilter.includes(sumber.jenis)) continue;

    let q = client.from(sumber.tabel).select('*');
    if (siteFilter) q = q.eq('site', siteFilter);
    const { data: rows, error } = await q;
    if (error) continue; // tabel belum ada → lewati sumber ini
    if (!rows?.length) continue;

    // Nama katalog untuk semua baris sekaligus (hindari query per baris).
    // Nama tabel & kolom dipilih dinamis, sehingga tipenya dibaca sebagai
    // Record — Supabase tidak bisa menyimpulkan bentuk generiknya.
    const katalog = new Map<string, string>();
    const infoKatalog = sumber.katalog;
    if (infoKatalog) {
      // `select('*')`: daftar kolom dinamis tidak bisa di-parse tipe Supabase.
      const { data: kat } = await client.from(infoKatalog.tabel).select('*');
      for (const k of ((kat ?? []) as unknown as Record<string, unknown>[])) {
        katalog.set(String(k.id), String(k[infoKatalog.kolomNama] ?? ''));
      }
    }

    for (const r of rows as Record<string, unknown>[]) {
      // Ergonomi memakai hitungan unit, bukan status per item.
      const status = sumber.jenis === 'ergonomi'
        ? (Number(r.rusak ?? 0) > 0 ? 'rusak' : 'ada')
        : String(r.status ?? 'tidak_ada');

      const objekNama = sumber.namaDari(r, katalog);
      const lokasi = sumber.kolomLokasi ? String(r[sumber.kolomLokasi] ?? '').trim() || null : null;
      const catatan = sumber.jenis === 'ergonomi' && Number(r.rusak ?? 0) > 0
        ? `${Number(r.rusak)} unit rusak dari ${Number(r.jumlah ?? 0)}`
        : String(r.catatan ?? '').trim() || null;

      const t: TemuanMasuk & { tingkat: string } = {
        jenis: sumber.jenis,
        site: String(r.site ?? '').trim() || null,
        objek_id: sumber.idDari(r),
        objek_nama: objekNama,
        lokasi,
        status,
        catatan,
        tingkat: tingkatDariStatus(status),
      };
      if (layakJadiPica(t)) temuan.push(t);
    }
  }

  if (temuan.length === 0) {
    return NextResponse.json({ success: true, dibuat: 0, dilewati: 0, pesan: 'Tidak ada temuan baru.' });
  }

//  Lewati temuan yang sudah punya PICA (belum closed/dismissed)
  let qPica = client.from('pica').select('id,kunci_berulang,site,status');
  if (siteFilter) qPica = qPica.eq('site', siteFilter);
  const { data: picaAda, error: picaError } = await qPica;
  if (picaError) {
    if (belumAda(String(picaError.message ?? ''))) {
      return NextResponse.json({ error: PESAN_TABEL }, { status: 500 });
    }
    return NextResponse.json({ error: 'Gagal membaca PICA yang sudah ada.' }, { status: 500 });
  }

  // Kunci = kunci_berulang|site. PICA yang sudah closed TIDAK memblokir —
  // temuan yang muncul lagi setelah diperbaiki adalah temuan BARU (dan itulah
  // yang membuat "berulang" terdeteksi).
  const kunciAktif = new Set(
    (picaAda ?? [])
      .filter(p => !['closed', 'dismissed'].includes(String(p.status ?? '').toLowerCase()))
      .map(p => `${p.kunci_berulang ?? ''}|${String(p.site ?? '').toLowerCase()}`),
  );

  const baris = temuan
    .filter(t => {
      const kunci = `${kunciPicaOtomatis(t)}|${String(t.site ?? '').toLowerCase()}`;
      return !kunciAktif.has(kunci);
    })
    .map(t => ({
      // Map ke kolom FORM-039.
      sumber: 'inspeksi',
      jenis_inspeksi: t.jenis,
      site: t.site,
      objek_id: t.objek_id,
      objek_nama: t.objek_nama,
      lokasi: t.lokasi,
      deskripsi: deskripsiTemuan(t),
      tingkat: t.tingkat,
      departemen: DEPARTEMEN_BAWAAN[t.jenis] ?? null,
      inisiator: caller.userId ?? null,
      jenis_pica: JENIS_META[t.jenis as keyof typeof JENIS_META]?.label ?? t.jenis,
      tanggal_dibuat: hariIni,
      due_date: tenggatDariTingkat(t.tingkat, sekarang),
      status: 'open',
      kunci_berulang: kunciPicaOtomatis(t),
      // Kunci idempotensi: satu temuan pada satu site pada satu tanggal hanya
      // boleh punya satu PICA otomatis. Dijaga juga oleh unique index
      // `pica_sumber_unik`, sehingga dua klik bersamaan tidak menghasilkan
      // PICA ganda walau pengecekan di aplikasi terlewat.
      kunci_sumber: `${kunciPicaOtomatis(t)}|${String(t.site ?? '').toLowerCase()}|${hariIni}`,
      auto_dibuat: true,
    }));

  if (baris.length === 0) {
    return NextResponse.json({
      success: true,
      dibuat: 0,
      dilewati: temuan.length,
      pesan: 'Semua temuan sudah punya PICA aktif.',
    });
  }

  const { error } = await client.from('pica').insert(baris);
  if (error) {
    if (belumAda(String(error.message ?? ''))) {
      return NextResponse.json({ error: PESAN_TABEL }, { status: 500 });
    }
    console.error('[pica/otomatis]', error);
    return NextResponse.json({ error: 'Gagal membuat PICA otomatis.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    dibuat: baris.length,
    dilewati: temuan.length - baris.length,
    pesan: `${baris.length} PICA dibuat dari temuan inspeksi.`,
  });
}

/**
 * GET — pratinjau: berapa temuan yang AKAN menjadi PICA, tanpa menulis apa pun.
 * Berguna untuk tombol "Buat PICA dari temuan" agar angkanya terlihat dulu.
 */
export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const picSite = caller.role === 'pic' ? (caller.site ?? null) : null;
  const siteFilter = picSite || req.nextUrl.searchParams.get('site')?.trim() || '';
  const client = adminClient();

  const hasil: { jenis: string; label: string; jumlah: number }[] = [];
  for (const sumber of SUMBER) {
    let q = client.from(sumber.tabel).select('*').limit(5000);
    if (siteFilter) q = q.eq('site', siteFilter);
    const { data } = await q;
    if (!data?.length) continue;

    const n = sumber.jenis === 'ergonomi'
      ? (data as Record<string, unknown>[]).filter(r => Number(r.rusak ?? 0) > 0).length
      : (data as Record<string, unknown>[]).filter(r =>
        layakJadiPica({ ...(r as unknown as TemuanMasuk), jenis: sumber.jenis, status: String(r.status ?? '') })).length;

    if (n > 0) {
      hasil.push({
        jenis: sumber.jenis,
        label: JENIS_META[sumber.jenis as keyof typeof JENIS_META]?.label ?? sumber.jenis,
        jumlah: n,
      });
    }
  }

  return NextResponse.json({
    success: true,
    total: hasil.reduce((a, h) => a + h.jumlah, 0),
    perJenis: hasil,
  });
}
