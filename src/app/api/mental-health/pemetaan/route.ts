import { NextRequest, NextResponse } from 'next/server';

import { adminClient, getCaller, pesanGalat } from '@/lib/questionnaire-store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/mental-health/pemetaan?site=&minResponden=&baselineDari=&baselineSampai=
 *
 * Pemetaan risiko psikologis lingkungan kerja tingkat DEPARTEMEN (SDS-30).
 *
 * DASAR DAN BATASAN
 *  - Ambang skor indikator mengikuti Lampiran Permenaker 5/2018 halaman 207:
 *    ≤9 ringan, 10–24 sedang, >24 berat. Itu satu-satunya angka yang resmi.
 *  - Permenaker TIDAK mengatur cara agregasi ke level departemen. Metode di sini
 *    adalah kebijakan internal: rata-rata skor indikator per departemen.
 *  - Ambang minimum responden 20 orang mengikuti praktik baku asesmen risiko
 *    psikososial (mis. WorkSafe ACT), agar hasil tidak mengidentifikasi individu.
 *  - Departemen dengan responden di bawah ambang ditandai "data belum memadai".
 *
 * BASELINE
 *  - Bila baselineDari/baselineSampai diisi, periode tersebut dipakai sebagai
 *    pembanding dan hasilnya diberi selisih (delta) per indikator.
 */

type Row = Record<string, any>;

export const INDIKATOR = [
  { id: 'ketaksaan-peran', title: 'Ketaksaan Peran', items: [1, 7, 13, 19, 25] },
  { id: 'konflik-peran', title: 'Konflik Peran', items: [2, 8, 14, 20, 26] },
  { id: 'beban-kuantitatif', title: 'Beban Kerja Kuantitatif', items: [3, 9, 15, 21, 27] },
  { id: 'beban-kualitatif', title: 'Beban Kerja Kualitatif', items: [4, 10, 16, 22, 28] },
  { id: 'pengembangan-karir', title: 'Pengembangan Karir', items: [5, 11, 17, 23, 29] },
  { id: 'tanggung-jawab', title: 'Tanggung Jawab Orang Lain', items: [6, 12, 18, 24, 30] },
];

export const MIN_RESPONDEN_DEFAULT = 20;

function tingkat(rataRata: number): 'RINGAN' | 'SEDANG' | 'BERAT' {
  if (rataRata > 24) return 'BERAT';
  if (rataRata >= 10) return 'SEDANG';
  return 'RINGAN';
}

const RANK = { RINGAN: 0, SEDANG: 1, BERAT: 2 } as const;

/** Ambil baris dengan kolom SDS yang benar-benar ada (turun bertahap). */
async function fetchRows(client: ReturnType<typeof adminClient>, base: string, from?: string, to?: string) {
  let lastError = 'Kolom SDS tidak ditemukan pada mcu_mental_health.';
  for (const n of [30, 20, 10, 0]) {
    const sdsCols = Array.from({ length: n }, (_, i) => `sds_${i + 1}`).join(',');
    let q = client.from('mcu_mental_health').select(sdsCols ? `${base},${sdsCols}` : base);
    if (from) q = q.gte('tgl_pemeriksaan', from);
    if (to) q = q.lte('tgl_pemeriksaan', to);
    const { data, error } = await q.order('tgl_pemeriksaan', { ascending: false });
    if (!error) return { rows: (data || []) as Row[], error: null as string | null };
    lastError = error.message;
    if (!/does not exist|PGRST204|42703/i.test(error.message)) return { rows: [] as Row[], error: error.message };
  }
  return { rows: [] as Row[], error: lastError };
}

/**
 * Kelompokkan baris menjadi rata-rata indikator.
 * mode 'departemen' → kunci = kolom department
 * mode 'jabatan'    → kunci = kolom jabatan
 */
function aggregate(rows: Row[], minResponden: number, mode: 'departemen' | 'jabatan') {
  const latest = new Map<string, Row>();
  for (const r of rows) {
    const key = String(r.nik_karyawan_hash || '');
    if (!key || latest.has(key)) continue;
    latest.set(key, r);
  }
  // Hanya yang menjawab lengkap 30 item.
  const lengkap = [...latest.values()].filter((r) =>
    Array.from({ length: 30 }, (_, i) => i + 1).every((n) => {
      const v = r[`sds_${n}`];
      return v !== null && v !== undefined && v !== '';
    }),
  );

  const buckets = new Map<string, { total: number; sums: Record<string, number> }>();
  for (const r of lengkap) {
    const raw = mode === 'jabatan' ? r.jabatan : r.department;
    const nama = String(raw || 'Tidak tercatat').trim() || 'Tidak tercatat';
    const b = buckets.get(nama) || { total: 0, sums: {} as Record<string, number> };
    b.total += 1;
    for (const ind of INDIKATOR) {
      b.sums[ind.id] = (b.sums[ind.id] || 0) + ind.items.reduce((a, no) => a + Number(r[`sds_${no}`] || 0), 0);
    }
    buckets.set(nama, b);
  }

  const hasil = [...buckets.entries()].map(([nama, b]) => {
    const memadai = b.total >= minResponden;
    const indikator = INDIKATOR.map((ind) => {
      const rata = Number((b.sums[ind.id] / b.total).toFixed(2));
      return { id: ind.id, title: ind.title, rataRata: rata, tingkat: memadai ? tingkat(rata) : null };
    });
    const tertinggi = indikator.reduce((a, i) => (i.rataRata > a.rataRata ? i : a), indikator[0]);
    const perTingkat = {
      RINGAN: indikator.filter(i => i.tingkat === 'RINGAN').length,
      SEDANG: indikator.filter(i => i.tingkat === 'SEDANG').length,
      BERAT: indikator.filter(i => i.tingkat === 'BERAT').length,
    };
    const tingkatKelompok = memadai
      ? (['BERAT', 'SEDANG', 'RINGAN'] as const).find(t => perTingkat[t] > 0) || 'RINGAN'
      : null;
    return {
      nama,
      responden: b.total,
      memadai,
      indikator,
      tertinggi: { id: tertinggi.id, title: tertinggi.title, rataRata: tertinggi.rataRata },
      perTingkat,
      tingkat: tingkatKelompok,
    };
  });

  hasil.sort((a, b) => {
    const ra = a.tingkat ? RANK[a.tingkat] : -1;
    const rb = b.tingkat ? RANK[b.tingkat] : -1;
    if (rb !== ra) return rb - ra;
    if (b.perTingkat.BERAT !== a.perTingkat.BERAT) return b.perTingkat.BERAT - a.perTingkat.BERAT;
    return b.tertinggi.rataRata - a.tertinggi.rataRata;
  });

  return { hasil, totalRespondenLengkap: lengkap.length };
}

export async function GET(req: NextRequest) {
  try {
    const caller = await getCaller(req);
    const role = String(caller?.role || '');
    if (!['administrator', 'superuser', 'manager'].includes(role)) {
      return NextResponse.json({ error: 'Akses ditolak. Khusus administrator, manager, dan superuser.' }, { status: 403 });
    }

    const p = new URL(req.url).searchParams;
    const site = p.get('site')?.trim() || '';
    const minResponden = Math.max(1, Number(p.get('minResponden') || MIN_RESPONDEN_DEFAULT));
    const baselineDari = p.get('baselineDari')?.trim() || '';
    const baselineSampai = p.get('baselineSampai')?.trim() || '';
    // Kelompok agregasi: departemen (default) atau jabatan.
    const kelompok = p.get('kelompok') === 'jabatan' ? 'jabatan' as const : 'departemen' as const;
    const client = adminClient();
    const base = 'nik_karyawan_hash,site,department,jabatan,tgl_pemeriksaan';

    const all = await fetchRows(client, base);
    if (all.error) throw new Error(all.error);
    const seed = site ? all.rows.filter(r => r.site === site) : all.rows;
    const kini = aggregate(seed, minResponden, kelompok);

    let baseline: ReturnType<typeof aggregate> | null = null;
    if (baselineDari && baselineSampai) {
      const b = await fetchRows(client, base, baselineDari, baselineSampai);
      if (b.error) throw new Error(b.error);
      baseline = aggregate(site ? b.rows.filter(r => r.site === site) : b.rows, minResponden, kelompok);
    }

    // Sisipkan nilai baseline & delta per indikator.
    const kelompokData = kini.hasil.map((d) => {
      const b = baseline?.hasil.find(x => x.nama === d.nama);
      return {
        ...d,
        baselineRataRata: b ? Object.fromEntries(b.indikator.map(i => [i.id, i.rataRata])) : null,
        delta: b ? Object.fromEntries(d.indikator.map((ind, i) => [ind.id, Number((ind.rataRata - b.indikator[i].rataRata).toFixed(2))])) : null,
      };
    });

    const memadai = kelompokData.filter(j => j.memadai);

    return NextResponse.json({
      success: true,
      data: {
        minResponden,
        mode: kelompok,
        baseline: baseline ? { dari: baselineDari, sampai: baselineSampai, jumlahKelompok: baseline.hasil.length } : null,
        totalRespondenLengkap: kini.totalRespondenLengkap,
        jumlahKelompok: kelompokData.length,
        jumlahKelompokMemadai: memadai.length,
        // alias lama
        jumlahDepartemen: kelompokData.length,
        jumlahDepartemenMemadai: memadai.length,
        risikoBerat: memadai.filter(j => j.tingkat === 'BERAT').length,
        risikoSedang: memadai.filter(j => j.tingkat === 'SEDANG').length,
        indikator: INDIKATOR.map(i => ({ id: i.id, title: i.title })),
        kelompokData,
        // alias lama agar klien lama tetap jalan
        departemen: kelompokData,
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: pesanGalat(err, 'Pemetaan risiko psikologis') }, { status: 500 });
  }
}
