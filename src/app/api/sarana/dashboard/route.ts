import { NextRequest, NextResponse } from 'next/server';

import { adminClient, getCaller } from '@/lib/questionnaire-store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sarana/dashboard — ringkasan SPIP (Sarana, Prasarana, Instalasi, Peralatan)
 *
 * Yang dinilai:
 *  • KELENGKAPAN  — item wajib yang tersedia vs belum
 *  • KELAYAKAN    — kondisi alat: layak / rusak ringan / rusak berat
 *  • KALIBRASI    — kesesuaian & kepatuhan jadwal kalibrasi (batas 12 bulan)
 *  • PRIORITAS    — top item rusak & top item belum tersedia
 *
 * Query: ?site=<site>  atau ?all=1 untuk seluruh site
 * Akses: superuser, administrator, manager; pic dibatasi site-nya.
 */
const ROLES = ['superuser', 'administrator', 'manager', 'pic'];

const KATEGORI_LABEL: Record<string, string> = {
  ruangan: 'Ruangan',
  peralatan_medis: 'Peralatan Medis',
  sarana_penunjang: 'Sarana Penunjang',
  alat_evakuasi: 'Alat Evakuasi',
  perlengkapan_umum: 'Perlengkapan Umum',
};

/** Batas usia kalibrasi (bulan) sebelum dinyatakan tidak patuh. */
const BATAS_KALIBRASI_BULAN = 12;
/** Peringatan dini: kalibrasi mendekati batas. */
const PERINGATAN_KALIBRASI_BULAN = 10;

export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const client = adminClient();
  const picSite = caller.role === 'pic' ? caller.site ?? null : null;
  const siteParam = req.nextUrl.searchParams.get('site')?.trim() || '';
  const semuaMode = req.nextUrl.searchParams.get('all') === '1';
  const fokusSite = picSite || (semuaMode ? '' : siteParam);

  const [{ data: katalog, error: katError }, { data: kondisi, error: konError }] = await Promise.all([
    client.from('sarana_katalog').select('id,nama,kategori,wajib,perlu_kalibrasi').order('urutan'),
    client.from('sarana_site').select('site,katalog_id,status,jumlah,tanggal_kalibrasi,tanggal_inspeksi,updated_at'),
  ]);

  if (katError) {
    return NextResponse.json({
      success: true, tabelSiap: false,
      catatan: 'Tabel sarana belum dibuat. Jalankan migration 20261028_sarana_klinik.sql.',
    });
  }
  if (konError) return NextResponse.json({ error: konError.message }, { status: 500 });

  const katalogRows = (katalog ?? []) as Record<string, unknown>[];
  const kondisiRows = (kondisi ?? []) as Record<string, unknown>[];
  const katalogMap = new Map(katalogRows.map((k) => [String(k.id), k]));

  // Daftar site untuk dropdown.
  const daftarSite = [...new Set(kondisiRows.map((k) => String(k.site ?? '').trim()).filter(Boolean))].sort();

  // Site yang dihitung.
  const siteDipakai = fokusSite
    ? daftarSite.filter((s) => s.toLowerCase() === fokusSite.toLowerCase())
    : daftarSite;

  const sekarang = Date.now();
  const bulanLalu = (iso: string | null): number | null => {
    if (!iso) return null;
    const t = new Date(`${String(iso).slice(0, 10)}T00:00:00`).getTime();
    if (Number.isNaN(t)) return null;
    return Math.round((sekarang - t) / (86_400_000 * 30.44));
  };

  /* ── Akumulator ──────────────────────────────────────────────────── */
  let totalWajib = 0;
  let tersedia = 0;
  let rusak = 0;
  let tidakAda = 0;
  let tidakDiperlukan = 0;
  let belumDicatat = 0;

  const kalibrasi = { patuh: 0, mendekati: 0, lewat: 0, belumAda: 0 };
  const perKategori = new Map<string, { tersedia: number; rusak: number; belum: number }>();
  const itemBelum = new Map<string, number>();      // nama item → jumlah site belum ada
  const itemRusak = new Map<string, number>();      // nama item → jumlah site rusak
  const alatLewat: { nama: string; site: string; tanggal: string | null; bulan: number | null }[] = [];
  const perSite: { site: string; wajib: number; tersedia: number; rusak: number; persen: number }[] = [];

  for (const site of siteDipakai) {
    const rowsSite = kondisiRows.filter((k) => String(k.site ?? '').trim() === site);
    const byKatalog = new Map(rowsSite.map((r) => [String(r.katalog_id), r]));

    let sWajib = 0;
    let sTersedia = 0;
    let sRusak = 0;

    for (const [id, k] of katalogMap) {
      // Hanya item wajib yang masuk perhitungan kepatuhan.
      if (!k.wajib) continue;
      const kategori = String(k.kategori ?? 'lain');
      if (kategori === 'obat') continue; // obat dikelola di halaman Inventory

      const agg = perKategori.get(kategori) ?? { tersedia: 0, rusak: 0, belum: 0 };
      const r = byKatalog.get(id);

      if (!r) {
        belumDicatat += 1;
        agg.belum += 1;
        perKategori.set(kategori, agg);
        const nama = String(k.nama ?? '');
        itemBelum.set(nama, (itemBelum.get(nama) ?? 0) + 1);
        continue;
      }

      if (r.status === 'tidak_diperlukan') { tidakDiperlukan += 1; continue; }

      totalWajib += 1;
      sWajib += 1;

      if (r.status === 'ada') { tersedia += 1; sTersedia += 1; agg.tersedia += 1; }
      if (r.status === 'rusak') {
        rusak += 1; sRusak += 1; agg.rusak += 1;
        const nama = String(k.nama ?? '');
        itemRusak.set(nama, (itemRusak.get(nama) ?? 0) + 1);
      }
      if (r.status === 'tidak_ada') {
        tidakAda += 1; agg.belum += 1;
        const nama = String(k.nama ?? '');
        itemBelum.set(nama, (itemBelum.get(nama) ?? 0) + 1);
      }
      perKategori.set(kategori, agg);

      // ── Kalibrasi ─────────────────────────────────────────────────
      if (k.perlu_kalibrasi) {
        const bulan = bulanLalu(r.tanggal_kalibrasi as string | null);
        if (bulan === null) {
          kalibrasi.belumAda += 1;
        } else if (bulan >= BATAS_KALIBRASI_BULAN) {
          kalibrasi.lewat += 1;
          alatLewat.push({
            nama: String(k.nama ?? ''), site,
            tanggal: r.tanggal_kalibrasi ? String(r.tanggal_kalibrasi).slice(0, 10) : null,
            bulan,
          });
        } else if (bulan >= PERINGATAN_KALIBRASI_BULAN) {
          kalibrasi.mendekati += 1;
          alatLewat.push({
            nama: String(k.nama ?? ''), site,
            tanggal: r.tanggal_kalibrasi ? String(r.tanggal_kalibrasi).slice(0, 10) : null,
            bulan,
          });
        } else {
          kalibrasi.patuh += 1;
        }
      }
    }

    if (sWajib > 0) {
      perSite.push({
        site, wajib: sWajib, tersedia: sTersedia, rusak: sRusak,
        persen: Number(((sTersedia / sWajib) * 100).toFixed(1)),
      });
    }
  }

  const urut = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  const totalKalibrasi = kalibrasi.patuh + kalibrasi.mendekati + kalibrasi.lewat + kalibrasi.belumAda;

  return NextResponse.json({
    success: true,
    tabelSiap: true,
    site: fokusSite || null,
    daftarSite,

    ringkasan: {
      jumlahSite: perSite.length,
      itemWajib: totalWajib,
      tersedia,
      rusak,
      tidakAda,
      tidakDiperlukan,
      belumDicatat,
      // KELENGKAPAN: tersedia / (tersedia + rusak + tidak ada)
      persenLengkap: totalWajib ? Number(((tersedia / totalWajib) * 100).toFixed(1)) : 0,
      // KELAYAKAN: (tersedia) / (tersedia + rusak) — hanya alat yang SUDAH ada
      persenLayak: (tersedia + rusak) ? Number(((tersedia / (tersedia + rusak)) * 100).toFixed(1)) : 0,
      // KEPATUHAN KALIBRASI: patuh / semua alat berkalibrasi
      persenKalibrasiPatuh: totalKalibrasi
        ? Number(((kalibrasi.patuh / totalKalibrasi) * 100).toFixed(1))
        : 0,
    },

    kelengkapan: {
      tersedia,
      rusak,
      tidakAda,
      tidakDiperlukan,
    },

    kelayakan: {
      layak: tersedia,
      rusak,
      persenLayak: (tersedia + rusak) ? Number(((tersedia / (tersedia + rusak)) * 100).toFixed(1)) : 0,
    },

    kalibrasi: {
      ...kalibrasi,
      batasBulan: BATAS_KALIBRASI_BULAN,
      peringatanBulan: PERINGATAN_KALIBRASI_BULAN,
    },

    perKategori: [...perKategori.entries()]
      .map(([key, v]) => ({ kategori: KATEGORI_LABEL[key] ?? key, key, ...v }))
      .sort((a, b) => (b.rusak + b.belum) - (a.rusak + a.belum)),

    topRusak: urut(itemRusak).slice(0, 10).map(([nama, jumlah]) => ({ nama, jumlah })),
    topBelum: urut(itemBelum).slice(0, 10).map(([nama, jumlah]) => ({ nama, jumlah })),
    alatKalibrasi: alatLewat.sort((a, b) => (b.bulan ?? 0) - (a.bulan ?? 0)).slice(0, 12),

    perSite: perSite.sort((a, b) => a.persen - b.persen),
  });
}
