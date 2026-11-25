'use client';
// Dashboard > Hearing Conservation. Data dari /api/hc?resource=dashboard (noise mapping, klasifikasi, audiometri MCU, STS).
// Layout grafik-first: donut zona, bar kategori, cakupan audiometri, derajat WHO, status STS, tren Leq & tabel area.
import { useEffect, useRef, useState } from 'react';
import type { ChartOptions } from 'chart.js';
import { ChartJS } from '@/lib/chart-register';
import { authFetch } from '@/lib/api-client';
import { ZONA_COLOR, type Zona } from '@/lib/hc-ergo';
import { useSites } from '@/lib/site-list';
import { BAR_LAYOUT, STANDAR_ANIMASI_BAR, STANDAR_ANIMASI_DONUT, useAnimationReady } from '@/lib/chart-standard';
import PageLoading from '@/components/ui/page-loading';
import { MCUChartCard, MCURefreshButton } from '@/components/dashboard/MCUDashboardShared';

type D = Record<string, any>;
const KELAS_COLOR: Record<string, string> = { Normal: '#00B894', Ringan: '#F5C518', Sedang: '#F5A623', Berat: '#FF6B35', 'Sangat Berat': '#E63946' };
const KELAS_ORDER = ['Normal', 'Ringan', 'Sedang', 'Berat', 'Sangat Berat'];
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export default function HearingConservationDashboard() {
  const { sites: daftarSite } = useSites();
  const [d, setD] = useState<D | null>(null);
  const [site, setSite] = useState('');
  const [err, setErr] = useState('');
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  const zonaRef = useRef<HTMLCanvasElement | null>(null);
  const cakupanRef = useRef<HTMLCanvasElement | null>(null);
  const kelasRef = useRef<HTMLCanvasElement | null>(null);
  const stsRef = useRef<HTMLCanvasElement | null>(null);
  const charts = useRef<Record<string, ChartJS | null>>({});

  useEffect(() => {
    // Token tema hanya dibaca saat callback/pemuatan berikutnya (bukan setState sinkron di body effect).
    const id = setTimeout(() => setIsDark(document.documentElement.classList.contains('dark')), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    let alive = true;
    authFetch(`/api/hc?resource=dashboard&site=${encodeURIComponent(site)}`)
      .then((r) => { if (alive) setD(r.data); })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : 'Gagal memuat dashboard'); });
    return () => { alive = false; };
  }, [site]);

  // Tunda penggambaran 2 frame agar animasi Chart.js berjalan di depan pengguna.
  const animReady = useAnimationReady([]);

  useEffect(() => {
    if (!d || !animReady) return;
    const text = isDark ? '#F9FAFB' : '#111827';
    const grid = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
    const cardBg = isDark ? '#1b1b1b' : '#ffffff';
    const anim = STANDAR_ANIMASI_BAR;
    const nAreaTotRef = { current: [d.zona.MERAH || 0, d.zona.KUNING || 0, d.zona.HIJAU || 0, d.zona.BELUM || 0].reduce((a, b) => a + b, 0) };
    const legend = { position: 'bottom' as const, labels: { color: text, font: { size: 10, family: FONT }, boxWidth: 9, boxHeight: 9, padding: 8 } };

    /** Buat/segarkan chart pada canvas yang sama tanpa kebocoran instance. */
    const draw = (key: string, el: HTMLCanvasElement | null, make: () => ChartJS) => {
      if (!el) return;
      charts.current[key]?.destroy();
      charts.current[key] = make();
    };

    const barOpts = (horizontal: boolean, max?: number): ChartOptions<'bar'> => ({
      responsive: true, maintainAspectRatio: false, animation: anim, indexAxis: horizontal ? 'y' : 'x',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
        datalabels: {
          color: text, anchor: 'end', align: horizontal ? 'right' : 'top', clamp: true, clip: false,
          font: { size: 10, weight: 'bold', family: FONT }, formatter: (v: number) => (v ? String(v) : ''),
        },
      },
      scales: horizontal
        ? { x: { beginAtZero: true, max, grid: { color: grid }, ticks: { color: text, font: { size: 9, family: FONT }, precision: 0 } },
            y: { grid: { display: false }, ticks: { color: text, font: { size: 9, family: FONT }, autoSkip: false } } }
        : { x: { grid: { display: false }, ticks: { color: text, font: { size: 11, weight: 'bold' as const, family: FONT }, autoSkip: false } },
            y: { beginAtZero: true, max, grid: { color: grid }, ticks: { color: text, font: { size: 9, family: FONT }, precision: 0 } } },
    } as ChartOptions<'bar'>);

    // 1. Donut zona kebisingan area
    const zonaVals = [d.zona.MERAH || 0, d.zona.KUNING || 0, d.zona.HIJAU || 0, d.zona.BELUM || 0];
    draw('zona', zonaRef.current, () => new ChartJS(zonaRef.current!, {
      type: 'doughnut',
      data: {
        labels: ['Merah', 'Kuning', 'Hijau', 'Belum diukur'],
        datasets: [{ data: zonaVals, backgroundColor: ['#E63946', '#F5C518', '#00B894', '#B0B7C3'], borderWidth: 2, borderColor: cardBg, hoverOffset: 6 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: STANDAR_ANIMASI_DONUT, cutout: '58%', rotation: 0, circumference: 360,
        plugins: {
          legend,
          tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed}${nAreaTotRef.current ? ` (${(c.parsed / nAreaTotRef.current * 100).toFixed(1)}%)` : ''}` } },
          // Label nilai ditempatkan di luar cincin agar tidak menyilang; total ditampilkan di tengah.
          datalabels: { display: false },
        },
      } as ChartOptions<'doughnut'>,
      plugins: [{
        id: 'hc-center-total',
        afterDraw: (chart) => {
          const { left, right, top, bottom } = chart.chartArea;
          const ctx = chart.ctx;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = text;
          ctx.font = `bold 22px ${FONT}`;
          ctx.fillText(String(nAreaTotRef.current), (left + right) / 2, (top + bottom) / 2 - 6);
          ctx.globalAlpha = 0.6;
          ctx.font = `600 9px ${FONT}`;
          ctx.fillText('TOTAL AREA', (left + right) / 2, (top + bottom) / 2 + 12);
          ctx.restore();
        },
      }],
    }));

    // 2. Cakupan audiometri tahun ini (per kategori, stacked)
    const cak = (d.cakupan || []) as D[];
    draw('cakupan', cakupanRef.current, () => new ChartJS(cakupanRef.current!, {
      type: 'bar',
      data: {
        labels: cak.length ? cak.map((c) => `Kategori ${c.kategori}`) : ['Belum ada data'],
        datasets: [
          { label: 'Sudah tahun ini', data: cak.length ? cak.map((c) => c.sudahTahunIni) : [0], backgroundColor: '#2E86DE', borderRadius: 4, ...BAR_LAYOUT },
          { label: 'Belum tahun ini', data: cak.length ? cak.map((c) => Math.max(0, c.total - c.sudahTahunIni)) : [0], backgroundColor: isDark ? 'rgba(255,255,255,0.16)' : '#DDE3EA', borderRadius: 4, ...BAR_LAYOUT },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: anim, indexAxis: 'y',
        plugins: {
          legend,
          datalabels: { color: text, anchor: 'center', align: 'center', font: { size: 10, weight: 'bold', family: FONT }, formatter: (v: number) => (v ? String(v) : '') },
        },
        scales: {
          x: { stacked: true, beginAtZero: true, grid: { color: grid }, ticks: { color: text, font: { size: 9, family: FONT }, precision: 0 } },
          y: { stacked: true, grid: { display: false }, ticks: { color: text, font: { size: 10, family: FONT } } },
        },
      } as ChartOptions<'bar'>,
    }));

    // 4. Derajat gangguan pendengaran (WHO)
    const kelasMap = (d.kelas || {}) as Record<string, number>;
    const kelasLabels = KELAS_ORDER.filter((k) => kelasMap[k] != null);
    draw('kelas', kelasRef.current, () => new ChartJS(kelasRef.current!, {
      type: 'bar',
      data: {
        labels: kelasLabels.length ? kelasLabels : ['Belum ada data'],
        datasets: [{ data: kelasLabels.length ? kelasLabels.map((k) => kelasMap[k] || 0) : [0], backgroundColor: kelasLabels.length ? kelasLabels.map((k) => KELAS_COLOR[k] || '#778899') : ['#B0B7C3'], borderRadius: 4, ...BAR_LAYOUT }],
      },
      options: barOpts(false),
    }));

    // 4. Status kasus STS
    draw('sts', stsRef.current, () => new ChartJS(stsRef.current!, {
      type: 'bar',
      data: {
        labels: ['Suspek', 'Retest', 'Konfirmasi', 'Terlambat'],
        datasets: [{ data: [d.sts.suspek || 0, d.sts.retestDijadwalkan || 0, d.sts.terkonfirmasi || 0, d.sts.retestTerlambat || 0], backgroundColor: ['#E63946', '#F5A623', '#8E44AD', '#B91C1C'], borderRadius: 4, ...BAR_LAYOUT }],
      },
      options: barOpts(false),
    }));

    return () => {
      Object.values(charts.current).forEach((c) => c?.destroy());
      charts.current = {};
    };
  }, [d, isDark, animReady]);

  if (err) return <div style={{ padding: 20, color: '#E63946', fontSize: 13 }}>{err}</div>;
  if (!d) return <PageLoading label="Memuat Konservasi Pendengaran" />;
  // Spinner SATU untuk seluruh halaman (bukan per diagram), logo 75%.

  const nAreaTot = Object.values(d.zona as Record<string, number>).reduce((a, b) => a + b, 0);
  const katTotal = (d.kategori.A || 0) + (d.kategori.B || 0) + (d.kategori.C || 0);
  const cakTotal = ((d.cakupan || []) as D[]).reduce((s, c) => s + (c.total || 0), 0);
  const stsTotal = (d.sts.suspek || 0) + (d.sts.retestDijadwalkan || 0) + (d.sts.terkonfirmasi || 0) + (d.sts.retestTerlambat || 0);

  return (
    <div className="dashboard hc-dash" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Top bar : mengikuti pola Monitoring MCU */}
      <div className="mcu-live-top-bar" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select className="admin-filter-select" value={site} onChange={(e) => { setErr(''); setSite(e.target.value); }}>
            <option value="">All Site</option>
            {daftarSite.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <MCURefreshButton loading={false} onClick={() => {
            setErr('');
            authFetch(`/api/hc?resource=dashboard&site=${encodeURIComponent(site)}`)
              .then((r) => setD(r.data))
              .catch((e) => setErr(e instanceof Error ? e.message : 'Gagal refresh'));
          }} />
        </div>
        <span className="kunjungan-total-right" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span>Konservasi Pendengaran</span>
          <span>Zona merah <b style={{ color: ZONA_COLOR.MERAH }}>{d.zona.MERAH}</b>/{nAreaTot}</span>
          <span>Ukur terlambat <b style={{ color: d.areaTerlambat ? '#E63946' : 'inherit' }}>{d.areaTerlambat}</b></span>
          <span>STS belum ditindak <b style={{ color: d.sts.belumDitindaklanjuti ? '#E63946' : 'inherit' }}>{d.sts.belumDitindaklanjuti}</b></span>
          <span>Audiometri tidak lengkap <b style={{ color: d.audiometri.tidakLengkap ? '#d97706' : 'inherit' }}>{d.audiometri.tidakLengkap}</b></span>
          <span>Retest terlambat <b style={{ color: d.sts.retestTerlambat ? '#E63946' : 'inherit' }}>{d.sts.retestTerlambat}</b></span>
        </span>
      </div>

      {/* Empat grafik inti wajib audit dalam grid 2x2 agar lega dan tidak terpotong */}
      <div className="mcu-live-chart-row mcu-live-chart-row--two mcu-live-chart-row--two-rows" style={{ minHeight: 360 }}>
        <MCUChartCard title="Zona Kebisingan Area" subtitle="Area per zona hasil pengukuran terakhir (NAB 85 dBA)" className="glow-coral"><canvas ref={zonaRef} /></MCUChartCard>
        <MCUChartCard title="Cakupan Audiometri Tahun Ini" subtitle="Kategori A & B : sudah vs belum diperiksa" className="glow-teal"><canvas ref={cakupanRef} /></MCUChartCard>
        <MCUChartCard title="Derajat Gangguan Pendengaran" subtitle="Klasifikasi WHO · telinga yang lebih baik" className="glow-steel"><canvas ref={kelasRef} /></MCUChartCard>
        <MCUChartCard title="Kasus & Tindak Lanjut STS" subtitle="Suspek, retest dijadwalkan, terkonfirmasi, terlambat" className="glow-orange"><canvas ref={stsRef} /></MCUChartCard>
      </div>

      {/* Evaluasi efektivitas tahunan : SOP/028 poin 4.3.5:
          QSHE Manager "melakukan evaluasi tahunan terhadap efektivitas
          Program Konservasi Pendengaran". Indikator diambil dari data yang
          sudah ada di dashboard ini, sehingga tidak perlu input baru. */}
      <EvaluasiTahunan d={d} nAreaTot={nAreaTot} katTotal={katTotal} cakTotal={cakTotal} stsTotal={stsTotal} />
    </div>
  );
}

/**
 * Panel evaluasi efektivitas tahunan Program Konservasi Pendengaran.
 *
 * Empat indikator yang dapat dihitung tanpa input tambahan:
 *  1. Kepatuhan pengukuran area  — area dengan pengukuran ≤6 bulan (Zona
 *     Kuning/Merah) / ≤12 bulan (Zona Hijau), sesuai SOP/028 poin 5.5.2.
 *  2. Cakupan audiometri Kategori A & B — wajib tahunan (poin 5.5.3).
 *  3. Tindak lanjut STS — yang belum ditindaklanjuti adalah temuan risiko.
 *  4. Kecukupan APT — proporsi karyawan Zona Kuning/Merah yang wajib APT.
 */
function EvaluasiTahunan({ d, nAreaTot, katTotal, cakTotal, stsTotal }: {
  d: D; nAreaTot: number; katTotal: number; cakTotal: number; stsTotal: number;
}) {
  const areaTerlambat = Number(d.areaTerlambat ?? 0);
  const kepatuhanUkur = nAreaTot ? ((nAreaTot - areaTerlambat) / nAreaTot) * 100 : 0;
  const terperiksa = ((d.cakupan || []) as D[]).reduce((s, c) => s + (c.sudah || 0), 0);
  const cakupan = cakTotal ? (terperiksa / cakTotal) * 100 : 0;
  const stsDitindak = Number(d.sts.terkonfirmasi ?? 0) + Number(d.sts.retestDijadwalkan ?? 0);
  const stsSelesai = stsTotal ? (stsDitindak / stsTotal) * 100 : 100;

  const item = [
    {
      label: 'Kepatuhan pengukuran area',
      nilai: kepatuhanUkur,
      target: 100,
      ket: `${nAreaTot - areaTerlambat} dari ${nAreaTot} area terukur sesuai jadwal (≤6 bln Kuning/Merah, ≤12 bln Hijau)`,
    },
    {
      label: 'Cakupan audiometri A & B',
      nilai: cakupan,
      target: 100,
      ket: `${terperiksa} dari ${cakTotal} karyawan Kategori A/B sudah audiometri tahun ini`,
    },
    {
      label: 'Tindak lanjut STS',
      nilai: stsSelesai,
      target: 100,
      ket: stsTotal ? `${stsDitindak} dari ${stsTotal} kasus sudah retest/terkonfirmasi` : 'Belum ada kasus STS',
    },
    {
      label: 'Cakupan karyawan terpajan',
      nilai: katTotal ? ((Number(d.kategori.A ?? 0) + Number(d.kategori.B ?? 0)) / katTotal) * 100 : 0,
      target: 100,
      ket: `${Number(d.kategori.A ?? 0) + Number(d.kategori.B ?? 0)} dari ${katTotal} karyawan terklasifikasi A/B`,
    },
  ];

  // Status keseluruhan: merah bila ada indikator < 80%, kuning 80–95%, hijau > 95%.
  const terendah = Math.min(...item.map((i) => i.nilai));
  const warna = terendah >= 95 ? '#00B894' : terendah >= 80 ? '#F1C40F' : '#E63946';
  const label = terendah >= 95 ? 'Efektif' : terendah >= 80 ? 'Perlu Perbaikan' : 'Tidak Efektif';

  return (
    <div className="card hc-eval-card" style={{ flexShrink: 0, padding: '8px 10px', display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingRight: 12, borderRight: '1px solid var(--border)', minWidth: 132 }}>
        <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}>
          Evaluasi Tahunan
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: warna, lineHeight: 1.2 }}>{label}</div>
        <div style={{ fontSize: 8.5, color: 'var(--muted-foreground)', lineHeight: 1.3 }}>
          Efektivitas program tahunan
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 220, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {item.map((i) => {
          const w = i.nilai >= 95 ? '#00B894' : i.nilai >= 80 ? '#F1C40F' : '#E63946';
          return (
            <div key={i.label} style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 9, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={i.label}>
                  {i.label}
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, color: w, flexShrink: 0 }}>{i.nilai.toFixed(0)}%</span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: 'var(--muted)', overflow: 'hidden', margin: '2px 0 3px' }}>
                <div style={{ width: `${Math.min(i.nilai, 100)}%`, height: '100%', borderRadius: 3, background: w }} />
              </div>
              <div style={{ fontSize: 8, color: 'var(--muted-foreground)', lineHeight: 1.3, overflow: 'hidden' }} title={i.ket}>
                {i.ket}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
