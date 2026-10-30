import { NextRequest, NextResponse } from 'next/server';

import { adminClient, getCaller } from '@/lib/questionnaire-store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sarana/dashboard — ringkasan AGREGAT Sarana & Prasarana (SPIP).
 *
 * DASAR: SOP/028 poin 5.5 — kelengkapan sarana & prasarana pelayanan kesehatan
 * kerja. Dashboard ini menjawab pertanyaan pelaporan: site mana yang belum
 * lengkap, kategori apa yang paling banyak bermasalah, dan alat mana yang
 * kalibrasinya kedaluwarsa.
 *
 * Akses: superuser, administrator, manager (agregat), pic (site sendiri).
 */
const ROLES = ['superuser', 'administrator', 'manager', 'pic'];

const KATEGORI_LABEL: Record<string, string> = {
  perlengkapan_umum: 'Perlengkapan Umum',
  ruangan: 'Ruangan',
  peralatan_medis: 'Peralatan Medis',
  sarana_penunjang: 'Sarana Penunjang',
  alat_evakuasi: 'Alat Evakuasi',
  obat: 'Obat & BHP',
};

export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const client = adminClient();
  const picSite = caller.role === 'pic' ? caller.site ?? null : null;

  const [{ data: katalog, error: katError }, { data: kondisi, error: konError }] = await Promise.all([
    client.from('sarana_katalog').select('id,nama,kategori,wajib,perlu_kalibrasi'),
    client.from('sarana_site').select('site,katalog_id,status,jumlah,tanggal_kalibrasi,updated_at'),
  ]);

  if (katError) {
    return NextResponse.json({
      success: true, tabelSiap: false, data: null,
      catatan: 'Tabel sarana belum dibuat. Jalankan migration 20261028_sarana_klinik.sql.',
    });
  }
  if (konError) return NextResponse.json({ error: konError.message }, { status: 500 });

  const katalogMap = new Map(
    ((katalog ?? []) as Record<string, unknown>[]).map((k) => [String(k.id), k]),
  );

  // Site yang punya catatan sarana (ditambah site PIC bila dibatasi).
  const semuaSite = [...new Set(
    ((kondisi ?? []) as Record<string, unknown>[]).map((k) => String(k.site ?? '').trim()).filter(Boolean),
  )].sort();

  const siteDipertimbangkan = picSite ? semuaSite.filter((s) => s.toLowerCase() === picSite.toLowerCase()) : semuaSite;

  const sekarang = Date.now();
  const perSite: { site: string; wajib: number; tersedia: number; rusak: number; kalibrasiLewat: number; persen: number }[] = [];
  const perKategori = new Map<string, { wajib: number; tersedia: number; rusak: number; belum: number }>();
  const alatKalibrasiLewat: { nama: string; site: string; tanggal: string; hari: number }[] = [];
  let rusakBerat = 0;
  let belumDicatat = 0;

  for (const site of siteDipertimbangkan) {
    const rows = ((kondisi ?? []) as Record<string, unknown>[]).filter((k) => String(k.site ?? '').trim() === site);
    const byKatalog = new Map(rows.map((r) => [String(r.katalog_id), r]));

    let wajib = 0;
    let tersedia = 0;
    let rusak = 0;
    let kalibrasiLewat = 0;

    for (const [id, k] of katalogMap) {
      if (!k.wajib) continue;
      const r = byKatalog.get(id);
      if (!r) { belumDicatat += 1; continue; }
      if (r.status === 'tidak_diperlukan') continue;

      wajib += 1;
      const kategori = String(k.kategori ?? 'lain');
      const agg = perKategori.get(kategori) ?? { wajib: 0, tersedia: 0, rusak: 0, belum: 0 };
      agg.wajib += 1;

      if (r.status === 'ada') { tersedia += 1; agg.tersedia += 1; }
      if (r.status === 'rusak') { rusak += 1; agg.rusak += 1; rusakBerat += 1; }
      if (r.status === 'tidak_ada') agg.belum += 1;
      perKategori.set(kategori, agg);

      // Kalibrasi: perlu_kalibrasi & tanggal > 365 hari.
      if (k.perlu_kalibrasi && r.tanggal_kalibrasi) {
        const tgl = new Date(`${String(r.tanggal_kalibrasi).slice(0, 10)}T00:00:00`).getTime();
        const hari = Math.round((sekarang - tgl) / 86_400_000);
        if (hari > 365) {
          kalibrasiLewat += 1;
          alatKalibrasiLewat.push({ nama: String(k.nama), site, tanggal: String(r.tanggal_kalibrasi).slice(0, 10), hari });
        }
      }
    }

    if (wajib > 0) {
      perSite.push({
        site, wajib, tersedia, rusak, kalibrasiLewat,
        persen: Number(((tersedia / wajib) * 100).toFixed(1)),
      });
    }
  }

  perSite.sort((a, b) => a.persen - b.persen);
  alatKalibrasiLewat.sort((a, b) => b.hari - a.hari);

  const totalWajib = perSite.reduce((s, x) => s + x.wajib, 0);
  const totalTersedia = perSite.reduce((s, x) => s + x.tersedia, 0);

  return NextResponse.json({
    success: true,
    tabelSiap: true,
    ringkasan: {
      jumlahSite: perSite.length,
      totalItemWajib: totalWajib,
      totalTersedia,
      persenNasional: totalWajib ? Number(((totalTersedia / totalWajib) * 100).toFixed(1)) : 0,
      rusak: rusakBerat,
      kalibrasiLewat: alatKalibrasiLewat.length,
      belumDicatat,
      siteBelumLengkap: perSite.filter((s) => s.persen < 80).length,
    },
    perSite,
    perKategori: [...perKategori.entries()].map(([key, v]) => ({
      kategori: KATEGORI_LABEL[key] ?? key, key, ...v,
    })),
    alatKalibrasiLewat: alatKalibrasiLewat.slice(0, 15),
    kategoriUrut: Object.entries(KATEGORI_LABEL).map(([key, label]) => ({ key, label })),
  });
}
