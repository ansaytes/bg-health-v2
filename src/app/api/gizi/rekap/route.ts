import { NextRequest, NextResponse } from 'next/server';

import { getCaller } from '@/lib/questionnaire-store';
import { adminClient } from '@/lib/questionnaire-store';
import { hitungKebutuhanKalori, sarankanBebanKerja, type BebanKerja } from '@/lib/gizi-kerja';
import { siteDihitung } from '@/lib/site-filter';

export const dynamic = 'force-dynamic';

/**
 * GET /api/gizi/rekap — kebutuhan kalori AGREGAT per site & departemen.
 *
 * Dipakai untuk perencanaan menu kantin dan prioritas program gizi kerja
 * (SOP/028 poin 5.7). Tidak memuat identitas karyawan — hanya rata-rata dan
 * sebaran, konsisten dengan prinsip pelaporan agregat dokumen lain.
 */
export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !['superuser', 'administrator', 'pic', 'manager'].includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const siteFilter = caller.role === 'pic' ? caller.site ?? null : params.get('site')?.trim() || null;

  const client = adminClient();

  // Satu baris per karyawan: record MCU terbaru yang punya bb & tb.
  const { data, error } = await client
    .from('mcu_records')
    // mcu_records TIDAK memiliki kolom `department`/`division` — hanya jabatan
    // dan site. Departemen diambil dari tabel employees bila diperlukan, tetapi
    // untuk perencanaan menu per site cukup site.
    .select('nik_karyawan,nama,jabatan,usia,jenis_kelamin,bb,tb,site')
    .not('bb', 'is', null)
    .not('tb', 'is', null)
    .order('tgl_mcu', { ascending: false, nullsFirst: false })
    .limit(8000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const terbaru = new Map<string, Record<string, unknown>>();
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const nik = String(r.nik_karyawan ?? '').trim();
    if (!nik || terbaru.has(nik)) continue;
    terbaru.set(nik, r);
  }

  const perSite = new Map<string, { jumlah: number; totalKkal: number; totalImt: number; obesitas: number }>();
  const perBeban = new Map<string, number>();
  const distribusiImt = new Map<string, number>();
  let dihitung = 0;
  let tidakLengkap = 0;

  for (const r of terbaru.values()) {
    const site = String(r.site ?? '').trim();
    // Site "Batch" = calon karyawan, tidak dihitung.
    if (!siteDihitung(site)) continue;
    if (siteFilter && site.toLowerCase() !== siteFilter.toLowerCase()) continue;

    const berat = Number(r.bb ?? 0);
    const tinggi = Number(r.tb ?? 0);
    const usia = Number(r.usia ?? 0);
    const jk = String(r.jenis_kelamin ?? '');
    if (!berat || !tinggi || !usia || !jk) { tidakLengkap += 1; continue; }

    const beban = sarankanBebanKerja(String(r.jabatan ?? ''));
    const hasil = hitungKebutuhanKalori({
      jenisKelamin: jk, usia, beratKg: berat, tinggiCm: tinggi, bebanKerja: beban as BebanKerja,
    });
    if (!hasil) { tidakLengkap += 1; continue; }

    dihitung += 1;
    perBeban.set(beban, (perBeban.get(beban) ?? 0) + 1);
    distribusiImt.set(hasil.statusGizi, (distribusiImt.get(hasil.statusGizi) ?? 0) + 1);

    const key = site || 'Tidak tercatat';
    const agg = perSite.get(key) ?? { jumlah: 0, totalKkal: 0, totalImt: 0, obesitas: 0 };
    agg.jumlah += 1;
    agg.totalKkal += hasil.kebutuhanKkal;
    agg.totalImt += hasil.imt;
    if (hasil.imt >= 25) agg.obesitas += 1;
    perSite.set(key, agg);
  }

  const urut = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);

  return NextResponse.json({
    success: true,
    acuan: 'AKG Kemenkes RI 2019 + Mifflin-St Jeor (perkiraan perencanaan menu)',
    totalDihitung: dihitung,
    tidakLengkap,
    perSite: [...perSite.entries()]
      .map(([site, a]) => ({
        site,
        jumlah: a.jumlah,
        rataKkal: Math.round(a.totalKkal / a.jumlah),
        rataImt: Number((a.totalImt / a.jumlah).toFixed(1)),
        persenObesitas: Number(((a.obesitas / a.jumlah) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.jumlah - a.jumlah),
    perBebanKerja: urut(perBeban),
    distribusiStatusGizi: urut(distribusiImt),
  });
}
