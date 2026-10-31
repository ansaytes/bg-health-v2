import { NextRequest, NextResponse } from 'next/server';

import { getCaller } from '@/lib/questionnaire-store';
import { adminClient } from '@/lib/questionnaire-store';
import { hitungKebutuhanKalori, sarankanBebanKerja, type BebanKerja } from '@/lib/gizi-kerja';
import { siteDihitung } from '@/lib/site-filter';

export const dynamic = 'force-dynamic';

/**
 * GET /api/gizi?nik=<NIK>        — hitung kalori satu karyawan dari data MCU
 * GET /api/gizi?site=<site>      — rekap agregat kebutuhan kalori per site
 *
 * DASAR: SOP/028 poin 5.7 (Gizi Kerja) + AKG Kemenkes 2019 sebagai acuan resmi.
 * STD/031 belum tersedia, sehingga perhitungan memakai AKG — sesuai keputusan
 * yang disetujui. Angka ini untuk PERENCANAAN MENU KANTIN, bukan preskripsi diet.
 *
 * Akses: QSHE Medic (beridentitas) & manager (agregat).
 */
export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !['superuser', 'administrator', 'pic', 'manager'].includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const nik = params.get('nik')?.trim();
  const bebanParam = params.get('beban') as BebanKerja | null;

  if (!nik) {
    return NextResponse.json({
      error: 'Parameter nik wajib diisi. Untuk rekap agregat gunakan /api/gizi/rekap.',
    }, { status: 400 });
  }

  const client = adminClient();
  const { data: rows, error } = await client
    .from('mcu_records')
    // Kolom `division` tidak ada di mcu_records — abaikan.
    .select('nama,jabatan,usia,jenis_kelamin,bb,tb,site')
    .eq('nik_karyawan', nik)
    .order('tgl_mcu', { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rec = rows?.[0];
  if (!rec) return NextResponse.json({ error: 'Data MCU karyawan tidak ditemukan' }, { status: 404 });
  // Site "Batch" = calon karyawan, bukan karyawan.
  if (!siteDihitung(rec.site)) {
    return NextResponse.json({ error: 'Karyawan site Batch tidak dihitung sebagai karyawan aktif' }, { status: 400 });
  }

  const berat = Number(rec.bb ?? 0);
  const tinggi = Number(rec.tb ?? 0);
  const usia = Number(rec.usia ?? 0);
  const jk = String(rec.jenis_kelamin ?? '');

  if (!berat || !tinggi || !usia || !jk) {
    return NextResponse.json({
      error: 'Data antropometri tidak lengkap (berat, tinggi, usia, jenis kelamin). Lengkapi lewat Review MCU.',
      data: { berat, tinggi, usia, jenisKelamin: jk },
    }, { status: 422 });
  }

  const beban: BebanKerja = bebanParam && ['ringan', 'sedang', 'berat', 'sangat-berat'].includes(bebanParam)
    ? bebanParam
    : sarankanBebanKerja(String(rec.jabatan ?? ''));

  const hasil = hitungKebutuhanKalori({
    jenisKelamin: jk, usia, beratKg: berat, tinggiCm: tinggi, bebanKerja: beban,
  });

  if (!hasil) return NextResponse.json({ error: 'Gagal menghitung kebutuhan kalori' }, { status: 500 });

  return NextResponse.json({
    success: true,
    karyawan: {
      nik,
      nama: rec.nama,
      jabatan: rec.jabatan,
      usia,
      jenisKelamin: jk,
      beratKg: berat,
      tinggiCm: tinggi,
    },
    bebanKerja: beban,
    bebanDisarankan: sarankanBebanKerja(String(rec.jabatan ?? '')),
    hasil,
  });
}
