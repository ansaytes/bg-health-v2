import { NextRequest, NextResponse } from 'next/server';

import { adminClient, getCaller } from '@/lib/questionnaire-store';
import {
  NAB_LUX,
  nilaiRuang,
  type PeruntukanRuang,
} from '@/lib/lingkungan-kerja';

export const dynamic = 'force-dynamic';

/**
 * GET /api/lingkungan/dashboard — ringkasan AGREGAT Pencahayaan & Kualitas
 * Udara untuk dashboard Higiene Industri.
 *
 * ACUAN: Permenaker 5/2018 Pasal 40–42 (KUDR) & Permenkes 48/2016 Tabel 1 & 4.
 *
 * Mengapa di Higiene Industri, bukan SPIP:
 *   Pencahayaan dan kualitas udara adalah FAKTOR LINGKUNGAN KERJA
 *   (Permenaker 5/2018 Pasal 5), sejenis dengan kebisingan — bukan sarana
 *   atau prasarana. SPIP mengurus Sarana, Prasarana, Instalasi, Peralatan.
 *
 * Isi ringkasan (semua AGREGAT, tanpa identitas):
 *   • kepatuhan lux per peruntukan ruang
 *   • sebaran status kualitas udara per parameter
 *   • peringkat ruang dengan lux terendah (prioritas perbaikan)
 *   • tren kepatuhan pengukuran per bulan
 *   • jumlah ruang yang belum pernah diukur
 */
const ROLES = ['superuser', 'administrator', 'manager', 'pic'];

export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const client = adminClient();
  const picSite = caller.role === 'pic' ? caller.site ?? null : null;
  const site = picSite || req.nextUrl.searchParams.get('site')?.trim() || '';

  const ruangQuery = client.from('lingkungan_ruang').select('*').order('nama_ruang');
  const { data: ruang, error } = site ? await ruangQuery.eq('site', site) : await ruangQuery;

  if (error) {
    if (/does not exist|Could not find the table|schema cache|PGRST204|PGRST205|42P01/i.test(error.message)) {
      return NextResponse.json({ success: true, tabelSiap: false, catatan: 'Jalankan migration 20261031_inspeksi_lingkungan.sql.' });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ruangRows = (ruang ?? []) as Record<string, unknown>[];
  const ids = ruangRows.map((r) => String(r.id));

  const { data: ukur } = ids.length
    ? await client.from('lingkungan_ukur').select('*').in('ruang_id', ids).order('tanggal', { ascending: false })
    : { data: [] as unknown[] };
  const ukurRows = (ukur ?? []) as Record<string, unknown>[];

  const { data: titik } = ukurRows.length
    ? await client.from('lingkungan_titik').select('*').in('ukur_id', ukurRows.map((u) => String(u.id)))
    : { data: [] as unknown[] };
  const titikRows = (titik ?? []) as Record<string, unknown>[];

  const titikByUkur = new Map<string, Record<string, unknown>[]>();
  for (const t of titikRows) {
    const key = String(t.ukur_id);
    const list = titikByUkur.get(key) ?? [];
    list.push(t);
    titikByUkur.set(key, list);
  }

  // Pengukuran terbaru per ruang.
  const ukurTerbaru = new Map<string, Record<string, unknown>>();
  for (const u of ukurRows) {
    const key = String(u.ruang_id);
    if (!ukurTerbaru.has(key)) ukurTerbaru.set(key, u);
  }

  type Baris = {
    ruang: string;
    peruntukan: PeruntukanRuang;
    nabLux: number | null;
    luxMin: number | null;
    statusLux: string;
    tidakMemenuhi: number;
    tanggal: string | null;
  };

  const baris: Baris[] = [];
  for (const r of ruangRows) {
    const u = ukurTerbaru.get(String(r.id));
    if (!u) {
      baris.push({
        ruang: String(r.nama_ruang), peruntukan: String(r.peruntukan) as PeruntukanRuang,
        nabLux: NAB_LUX[String(r.peruntukan) as PeruntukanRuang]?.min ?? null,
        luxMin: null, statusLux: 'tidak-dinilai', tidakMemenuhi: 0, tanggal: null,
      });
      continue;
    }
    const t = titikByUkur.get(String(u.id)) ?? [];
    const p = nilaiRuang({
      peruntukan: String(r.peruntukan) as PeruntukanRuang,
      luasM2: r.luas_m2 === null ? null : Number(r.luas_m2),
      jumlahPekerja: r.jumlah_pekerja === null ? null : Number(r.jumlah_pekerja),
      tinggiRuanganM: r.tinggi_ruangan_m === null ? null : Number(r.tinggi_ruangan_m),
      titik: t.map((x) => ({
        lux: x.lux === null ? null : Number(x.lux),
        suhu: x.suhu_c === null ? null : Number(x.suhu_c),
        kelembapan: x.kelembapan_pct === null ? null : Number(x.kelembapan_pct),
        oksigen: x.oksigen_pct === null ? null : Number(x.oksigen_pct),
        pm10: x.pm10_mg_m3 === null ? null : Number(x.pm10_mg_m3),
        asbes: x.asbes_serat_ml === null ? null : Number(x.asbes_serat_ml),
      })),
    });
    baris.push({
      ruang: String(r.nama_ruang),
      peruntukan: String(r.peruntukan) as PeruntukanRuang,
      nabLux: p.nabLux,
      luxMin: p.luxMin,
      statusLux: p.statusLux,
      tidakMemenuhi: p.jumlahTidakMemenuhi,
      tanggal: u.tanggal ? String(u.tanggal).slice(0, 10) : null,
    });
  }

  /* ── Agregat ─────────────────────────────────────────────────────── */
  const dinilai = baris.filter((b) => b.statusLux !== 'tidak-dinilai');

  // 1. Per peruntukan ruang
  const perPeruntukan = Object.keys(NAB_LUX)
    .map((k) => {
      const grup = dinilai.filter((b) => b.peruntukan === k);
      return {
        peruntukan: NAB_LUX[k as PeruntukanRuang].label,
        nabLux: NAB_LUX[k as PeruntukanRuang].min,
        memenuhi: grup.filter((b) => b.statusLux === 'memenuhi').length,
        tidakMemenuhi: grup.filter((b) => b.statusLux === 'tidak-memenuhi').length,
      };
    })
    .filter((x) => x.memenuhi + x.tidakMemenuhi > 0);

  // 2. Status tiap parameter udara (dari pengukuran terbaru seluruh ruang)
  const PARAM = [
    { key: 'suhu_c', label: 'Suhu', min: 23, max: 26 },
    { key: 'kelembapan_pct', label: 'Kelembapan', min: 40, max: 60 },
    { key: 'oksigen_pct', label: 'Oksigen', min: 19.5, max: 23.5 },
    { key: 'pm10_mg_m3', label: 'PM10', min: null as number | null, max: 0.15 },
    { key: 'asbes_serat_ml', label: 'Asbes', min: null as number | null, max: 0.1 },
  ];
  const statusUdara = PARAM.map((p) => {
    let memenuhi = 0, tidak = 0;
    for (const u of ukurTerbaru.values()) {
      const t = titikByUkur.get(String(u.id)) ?? [];
      const nilai = t
        .map((x) => Number(x[p.key]))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (!nilai.length) continue;
      // Parameter berbahaya (max saja) → nilai tertinggi; lainnya → nilai terjauh.
      const dipakai = p.min === null
        ? Math.max(...nilai)
        : nilai.reduce((acc, v) => {
          const jauh = (x: number) => Math.max(p.min! - x, x - p.max);
          return jauh(v) > jauh(acc) ? v : acc;
        });
      const ok = (p.min === null || dipakai >= p.min) && dipakai <= p.max;
      if (ok) memenuhi += 1; else tidak += 1;
    }
    return { label: p.label, memenuhi, tidakMemenuhi: tidak };
  }).filter((x) => x.memenuhi + x.tidakMemenuhi > 0);

  // 3. Ruang terendah — prioritas perbaikan
  const terendah = dinilai
    .filter((b) => b.luxMin !== null && b.nabLux !== null)
    .map((b) => ({ ...b, persenNab: Math.round(((b.luxMin ?? 0) / (b.nabLux ?? 1)) * 100) }))
    .sort((a, b) => a.persenNab - b.persenNab)
    .slice(0, 10);

  // 4. Tren jumlah ruang memenuhi per bulan
  const tren = new Map<string, { memenuhi: number; tidak: number }>();
  for (const u of ukurRows) {
    const bulan = String(u.tanggal ?? '').slice(0, 7);
    if (!bulan) continue;
    const r = ruangRows.find((x) => String(x.id) === String(u.ruang_id));
    if (!r) continue;
    const t = titikByUkur.get(String(u.id)) ?? [];
    const p = nilaiRuang({
      peruntukan: String(r.peruntukan) as PeruntukanRuang,
      luasM2: r.luas_m2 === null ? null : Number(r.luas_m2),
      jumlahPekerja: r.jumlah_pekerja === null ? null : Number(r.jumlah_pekerja),
      tinggiRuanganM: r.tinggi_ruangan_m === null ? null : Number(r.tinggi_ruangan_m),
      titik: t.map((x) => ({
        lux: x.lux === null ? null : Number(x.lux),
        suhu: x.suhu_c === null ? null : Number(x.suhu_c),
        kelembapan: x.kelembapan_pct === null ? null : Number(x.kelembapan_pct),
        oksigen: x.oksigen_pct === null ? null : Number(x.oksigen_pct),
        pm10: x.pm10_mg_m3 === null ? null : Number(x.pm10_mg_m3),
        asbes: x.asbes_serat_ml === null ? null : Number(x.asbes_serat_ml),
      })),
    });
    if (p.statusLux === 'tidak-dinilai') continue;
    const cur = tren.get(bulan) ?? { memenuhi: 0, tidak: 0 };
    if (p.statusLux === 'memenuhi') cur.memenuhi += 1; else cur.tidak += 1;
    tren.set(bulan, cur);
  }

  return NextResponse.json({
    success: true,
    tabelSiap: true,
    ringkasan: {
      jumlahRuang: baris.length,
      sudahDiukur: dinilai.length,
      belumDiukur: baris.length - dinilai.length,
      luxMemenuhi: dinilai.filter((b) => b.statusLux === 'memenuhi').length,
      luxTidakMemenuhi: dinilai.filter((b) => b.statusLux === 'tidak-memenuhi').length,
      udaraTidakMemenuhi: statusUdara.reduce((s, x) => s + x.tidakMemenuhi, 0),
    },
    perPeruntukan,
    statusUdara,
    terendah,
    tren: [...tren.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([bulan, v]) => ({ bulan, ...v })),
  });
}
