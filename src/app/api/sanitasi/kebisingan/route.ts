import { NextRequest, NextResponse } from 'next/server';

import { adminClient, getCaller } from '@/lib/questionnaire-store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sanitasi/kebisingan?site=<site>
 *
 * Mengambil HASIL PENGUKURAN KEBISINGAN yang sudah ada di modul Hearing
 * Conservation (`hc_noise_survey` + `hc_noise_point`), untuk ditampilkan pada
 * inspeksi Higiene & Sanitasi.
 *
 * MENGAPA DIAMBIL DARI HC, BUKAN DIINPUT ULANG
 * Kebisingan sudah diukur dan dicatat lengkap di modul HC — lengkap dengan
 * per-area, per-titik, alat ukur, dan tanggal. Memintа petugas mengetik ulang
 * angka yang sama di form sanitasi hanya menghasilkan dua sumber yang bisa
 * berbeda, dan membuang waktu.
 *
 * BAGIAN LAIN TIDAK DIBUAT OTOMATIS
 * Pencahayaan (lux) dan kualitas udara (suhu, kelembapan, PM10, O2) BELUM punya
 * modul pengukuran sendiri, sehingga tetap diisi manual di form sanitasi.
 * Bila nanti dibuat modul tersendiri, endpoint ini bisa diperluas dengan pola
 * yang sama.
 */
export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !['superuser', 'administrator', 'pic', 'manager'].includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const site = req.nextUrl.searchParams.get('site')?.trim() || '';
  const client = adminClient();

  try {
    const { data, error } = await client
      .from('hc_noise_survey')
      .select('id,tanggal,tipe,petugas,area_id,hc_area(site,nama_area),hc_noise_point(kode_titik,leq_dba)')
      .order('tanggal', { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ success: true, tersedia: false, data: [], catatan: error.message });
    }

    type Baris = {
      id: string;
      tanggal: string | null;
      tipe: string | null;
      petugas: string | null;
      hc_area?: { site?: string | null; nama_area?: string | null } | null;
      hc_noise_point?: { kode_titik: string | null; leq_dba: number | null }[] | null;
    };

    const rows = (data ?? []) as unknown as Baris[];

    // Satu baris per area: titik dengan Leq tertinggi menjadi wakil area itu.
    const perArea = new Map<string, {
      area: string;
      site: string;
      tanggal: string | null;
      petugas: string | null;
      leqMax: number;
      jumlahTitik: number;
    }>();

    for (const r of rows) {
      const siteArea = String(r.hc_area?.site ?? '').trim();
      if (site && siteArea.toLowerCase() !== site.toLowerCase()) continue;
      const namaArea = String(r.hc_area?.nama_area ?? 'Area tidak bernama').trim();
      const titik = r.hc_noise_point ?? [];
      const leq = titik
        .map((t) => Number(t.leq_dba))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (!leq.length) continue;

      const key = `${siteArea}|${namaArea}`;
      const ada = perArea.get(key);
      const leqMax = Math.max(...leq);

      // Pertahankan pengukuran TERBARU per area.
      if (!ada || (r.tanggal && (!ada.tanggal || r.tanggal > ada.tanggal))) {
        perArea.set(key, {
          area: namaArea,
          site: siteArea,
          tanggal: r.tanggal,
          petugas: r.petugas,
          leqMax,
          jumlahTitik: titik.length,
        });
      }
    }

    const hasil = [...perArea.values()].sort((a, b) => b.leqMax - a.leqMax);

    return NextResponse.json({
      success: true,
      tersedia: true,
      data: hasil,
      // Ringkas untuk ditampilkan di form.
      ringkasan: {
        jumlahArea: hasil.length,
        leqTertinggi: hasil.length ? hasil[0].leqMax : null,
        areaDiAtasNAB: hasil.filter((a) => a.leqMax > 85).length,
      },
    });
  } catch (e) {
    return NextResponse.json({
      success: true,
      tersedia: false,
      data: [],
      catatan: e instanceof Error ? e.message : 'Modul kebisingan belum tersedia',
    });
  }
}
