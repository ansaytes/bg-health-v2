import { NextRequest, NextResponse } from 'next/server';

import { adminClient, getCaller } from '@/lib/questionnaire-store';
import { SDS_SECTIONS } from '@/lib/questionnaire-items';

export const dynamic = 'force-dynamic';

/**
 * GET /api/mental-health/sds-answers
 *
 * Tabel data jawaban SDS-30 untuk petugas (superuser & administrator saja).
 * Hanya jawaban per item, bukan hasil diagnosis — dipakai untuk audit kualitas
 * pengisian: siapa menjawab apa, kapan, dan skor indikatornya.
 *
 * Query: ?limit=200&site=&dari=&sampai=
 */

const TABLE = 'mcu_mental_health';

function isReviewer(caller: Awaited<ReturnType<typeof getCaller>>): boolean {
  const role = String(caller?.role ?? '');
  return role === 'superuser' || role === 'administrator';
}

export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) {
    return NextResponse.json({ error: 'Sesi login tidak ditemukan' }, { status: 401 });
  }
  if (!isReviewer(caller)) {
    return NextResponse.json({ error: 'Hanya superuser dan administrator dapat melihat data jawaban.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 200), 1), 500);
  const dari = searchParams.get('dari') || '';
  const sampai = searchParams.get('sampai') || '';

  const sdsCols = Array.from({ length: 30 }, (_, i) => `sds_${i + 1}`).join(',');
  const base = 'tgl_pemeriksaan,nik_karyawan_hash,nama,nik_karyawan,department,jabatan,site_name,indeks_sds,ringkasan_hasil';

  const client = adminClient();
  let q = client.from(TABLE).select(`${base},${sdsCols}`);
  if (dari) q = q.gte('tgl_pemeriksaan', dari);
  if (sampai) q = q.lte('tgl_pemeriksaan', sampai);
  const { data, error } = await q.order('tgl_pemeriksaan', { ascending: false }).limit(limit);
  const rawRows = (data ?? []) as unknown as Record<string, unknown>[];

  if (error) {
    // Kolom SDS belum ada → bukan error fatal, cukup tampilkan tabel kosong.
    if (/does not exist|PGRST204|42703/i.test(error.message)) {
      return NextResponse.json({ success: true, data: [], indikator: SDS_SECTIONS });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = rawRows.map((row) => {
    const jawaban = Array.from({ length: 30 }, (_, i) => {
      const v = row[`sds_${i + 1}`];
      return v === null || v === undefined || v === '' ? null : Number(v);
    });
    // Skor per indikator dihitung dengan pembagian resmi 6 × 5 item.
    const indikator = SDS_SECTIONS.map((section) => {
      const nilai = section.items
        .map((no) => jawaban[no - 1])
        .filter((v): v is number => typeof v === 'number');
      const terisi = nilai.length;
      const skor = nilai.reduce((a, b) => a + b, 0);
      const rata = terisi ? skor / terisi : 0;
      const tingkat = skor > 24 ? 'BERAT' : skor >= 10 ? 'SEDANG' : 'RINGAN';
      return { id: section.id, title: section.title, skor, terisi, rata: Number(rata.toFixed(2)), tingkat };
    });
    return {
      tanggal: String(row.tgl_pemeriksaan ?? ''),
      nama: String(row.nama ?? ''),
      nik: String(row.nik_karyawan ?? ''),
      department: String(row.department ?? ''),
      jabatan: String(row.jabatan ?? ''),
      site: String(row.site_name ?? ''),
      jawaban,
      indikator,
      indeks: row.indeks_sds ?? null,
      ringkasan: String(row.ringkasan_hasil ?? ''),
    };
  });

  return NextResponse.json({ success: true, data: rows, indikator: SDS_SECTIONS });
}
