import { NextRequest, NextResponse } from 'next/server';

import { adminClient, getCaller, pesanGalat } from '@/lib/questionnaire-store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/mental-health/dashboard?site=
 *
 * Agregat kuesioner kesehatan mental (SRQ-20, DASS-21, SDS-30) dari tabel
 * mcu_mental_health, dikelompokkan untuk kartu grafik dashboard.
 *
 * SDS-30 adalah Survei Diagnosis Stres 30 item (Lampiran Permenaker 5/2018):
 * skala 1–7, 6 indikator × 5 item, skor indikator 5–35.
 * Instrumen ini mengukur FAKTOR PSIKOLOGI KERJA, bukan depresi.
 */

type Row = Record<string, any>;

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function lastNMonths(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  now.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function srqBand(score: number): string {
  return score >= 6 ? 'Perlu Tindak Lanjut' : 'Normal';
}

/** DASS-21: skor subskala dikali 2 lalu dibaca pada tabel tingkat keparahan. */
function dassBand(depresi: number, ansietas: number, stres: number): string {
  const d = depresi * 2;
  const a = ansietas * 2;
  const s = stres * 2;
  const rankD = d >= 28 ? 4 : d >= 21 ? 3 : d >= 14 ? 2 : d >= 10 ? 1 : 0;
  const rankA = a >= 20 ? 4 : a >= 15 ? 3 : a >= 10 ? 2 : a >= 8 ? 1 : 0;
  const rankS = s >= 34 ? 4 : s >= 26 ? 3 : s >= 19 ? 2 : s >= 15 ? 1 : 0;
  const worst = Math.max(rankD, rankA, rankS);
  return ['Normal', 'Ringan', 'Sedang', 'Berat', 'Sangat Berat'][worst];
}

/** SDS-30: kategori per indikator, skor 5–35. */
function sdsBand(score: number): string {
  if (score >= 25) return 'Stres Tinggi';
  if (score >= 10) return 'Stres Sedang';
  return 'Stres Rendah';
}

/** Nomor item (1-based) milik tiap indikator SDS-30 — Permenaker 5/2018. */
const SDS_INDICATORS = [
  { id: 'ketaksaan-peran', title: 'Ketaksaan Peran', items: [1, 7, 13, 19, 25] },
  { id: 'konflik-peran', title: 'Konflik Peran', items: [2, 8, 14, 20, 26] },
  { id: 'beban-kuantitatif', title: 'Beban Kerja Kuantitatif Berlebih', items: [3, 9, 15, 21, 27] },
  { id: 'beban-kualitatif', title: 'Beban Kerja Kualitatif Berlebih', items: [4, 10, 16, 22, 28] },
  { id: 'pengembangan-karir', title: 'Pengembangan Karir', items: [5, 11, 17, 23, 29] },
  { id: 'tanggung-jawab', title: 'Tanggung Jawab Terhadap Orang Lain', items: [6, 12, 18, 24, 30] },
];

export async function GET(req: NextRequest) {
  try {
    const caller = await getCaller(req);
    const role = String(caller?.role || '');
    if (!['pic', 'administrator', 'superuser', 'manager'].includes(role)) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    const site = new URL(req.url).searchParams.get('site')?.trim() || '';
    const client = adminClient();

    const sdsItemCols = Array.from({ length: 30 }, (_, i) => `sds_${i + 1}`).join(',');
    const { data, error } = await client
      .from('mcu_mental_health')
      .select(`nik_karyawan_hash,site,tgl_pemeriksaan,skor_srq20,dass_depresi,dass_ansietas,dass_stres,${sdsItemCols}`)
      .order('tgl_pemeriksaan', { ascending: false });
    if (error) throw new Error(error.message);

    // Satu baris terbaru per karyawan, agar tren tidak dobel bila diisi ulang.
    const latest = new Map<string, Row>();
    for (const r of (data || []) as Row[]) {
      if (site && r.site !== site) continue;
      const key = String(r.nik_karyawan_hash || '');
      if (!key || latest.has(key)) continue;
      latest.set(key, r);
    }
    const rows = [...latest.values()];

    const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));

    const srq = rows.map(r => num(r.skor_srq20)).filter((v): v is number => v !== null && Number.isFinite(v));
    const dassRows = rows
      .filter(r => num(r.dass_depresi) !== null)
      .map(r => ({ depresi: num(r.dass_depresi) as number, ansietas: num(r.dass_ansietas) || 0, stres: num(r.dass_stres) || 0 }));

    // SDS-30 dinilai per indikator (5 item × skala 1–7). Hanya responden yang
    // mengisi kelima item indikator tersebut yang dihitung.
    const sdsPerIndikator = SDS_INDICATORS.map((ind) => {
      const scores = rows.map((r) => {
        const vals = ind.items.map((no) => num(r[`sds_${no}`]));
        if (vals.some((v) => v === null)) return null;
        return (vals as number[]).reduce((a, b) => a + b, 0);
      }).filter((v): v is number => v !== null);
      return {
        id: ind.id,
        title: ind.title,
        terisi: scores.length,
        tinggi: scores.filter(v => v >= 25).length,
        sedang: scores.filter(v => v >= 10 && v < 25).length,
        rendah: scores.filter(v => v < 10).length,
        rataRata: scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0,
      };
    });
    const sdsResponden = rows.filter(r => SDS_INDICATORS.every(ind => ind.items.every(no => num(r[`sds_${no}`]) !== null))).length;

    const countBy = (values: string[]) => values.reduce<Record<string, number>>((acc, k) => {
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});

    const months = lastNMonths(12);
    const trend = months.map(m => {
      const inMonth = (data || []).filter((r: Row) => String(r.tgl_pemeriksaan || '').startsWith(m)
        && (!site || r.site === site));
      return {
        bulan: m,
        srq: inMonth.length,
        perluTindakLanjut: inMonth.filter((r: Row) => Number(r.skor_srq20) >= 6).length,
      };
    });

    const siteList = [...new Set((data || []).map((r: Row) => String(r.site || '')).filter(Boolean))].sort();
    const perSite = siteList.map(s => {
      const own = rows.filter(r => r.site === s);
      return {
        site: s,
        total: own.length,
        perluTindakLanjut: own.filter(r => Number(r.skor_srq20) >= 6).length,
      };
    });

    const srqBands = srq.map(srqBand);
    const dassBands = dassRows.map(d => dassBand(d.depresi, d.ansietas, d.stres));

    const avg = (arr: number[]) => (arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : 0);

    return NextResponse.json({
      success: true,
      data: {
        totalResponden: rows.length,
        bulan: BULAN,
        instrumen: {
          srq20: {
            terisi: srq.length,
            perluTindakLanjut: srq.filter(v => v >= 6).length,
            rataRata: avg(srq),
            band: countBy(srqBands),
          },
          dass21: {
            terisi: dassRows.length,
            rataDepresi: avg(dassRows.map(d => d.depresi)),
            rataAnsietas: avg(dassRows.map(d => d.ansietas)),
            rataStres: avg(dassRows.map(d => d.stres)),
            band: countBy(dassBands),
          },
          sds: {
            terisi: sdsResponden,
            perIndikator: sdsPerIndikator,
            tinggi: sdsPerIndikator.reduce((a, i) => a + i.tinggi, 0),
          },
        },
        trend,
        perSite,
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: pesanGalat(err, 'Dashboard kesehatan mental') }, { status: 500 });
  }
}
