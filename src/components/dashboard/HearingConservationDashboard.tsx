'use client';
// Dashboard > Hearing Conservation. Data dari /api/hc?resource=dashboard (noise mapping, klasifikasi, audiometri MCU, STS).
// Layout grafik-first: donut zona, bar kategori, cakupan audiometri, derajat WHO, status STS, tren Leq & tabel area.
import { useEffect, useRef, useState } from 'react';
import { Chart as ChartJS, registerables, type ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { authFetch } from '@/lib/api-client';
import { ZONA_COLOR, type Zona } from '@/lib/hc-ergo';
import { Chip, SITES, fmtDate, tableStyle, tdStyle, thStyle } from '@/components/administrator/hc-ergo-ui';
import { BAR_LAYOUT, STANDAR_ANIMASI_BAR, STANDAR_ANIMASI_DONUT, useAnimationReady } from '@/lib/chart-standard';

ChartJS.register(...registerables, ChartDataLabels);

type D = Record<string, any>;
const KELAS_COLOR: Record<string, string> = { Normal: '#00B894', Ringan: '#F5C518', Sedang: '#F5A623', Berat: '#FF6B35', 'Sangat Berat': '#E63946' };
const KELAS_ORDER = ['Normal', 'Ringan', 'Sedang', 'Berat', 'Sangat Berat'];
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

function ChartCard({ title, sub, accent = '#ff4d00', empty, children }: { title: string; sub?: string; accent?: string; empty?: boolean; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: '10px 12px', minHeight: 0 }}>
      <div className="card-head">
        <span style={{ width: 4, height: 26, borderRadius: 2, background: accent, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {empty ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--muted-foreground)' }}>
            <span style={{ width: 38, height: 38, borderRadius: '50%', border: `2px dashed ${accent}55`, display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 800, color: `${accent}99` }}>–</span>
            <span style={{ fontSize: 11.5, fontWeight: 600 }}>Belum ada data</span>
          </div>
        ) : children}
      </div>
    </div>
  );
}

export default function HearingConservationDashboard() {
  const [d, setD] = useState<D | null>(null);
  const [site, setSite] = useState('');
  const [err, setErr] = useState('');
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  const zonaRef = useRef<HTMLCanvasElement | null>(null);
  const kategoriRef = useRef<HTMLCanvasElement | null>(null);
  const cakupanRef = useRef<HTMLCanvasElement | null>(null);
  const kelasRef = useRef<HTMLCanvasElement | null>(null);
  const stsRef = useRef<HTMLCanvasElement | null>(null);
  const trendRef = useRef<HTMLCanvasElement | null>(null);
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
        ? { x: { beginAtZero: true, max, grid: { color: grid }, ticks: { color: text, font: { size: 9, family: FONT }, precision: 0 }, title: { display: true, text: 'Jumlah', color: text, font: { size: 9, weight: 'bold' as const, family: FONT } } },
            y: { grid: { display: false }, ticks: { color: text, font: { size: 9, family: FONT }, autoSkip: false }, title: { display: true, text: 'Kategori', color: text, font: { size: 9, weight: 'bold' as const, family: FONT } } } }
        : { x: { grid: { display: false }, ticks: { color: text, font: { size: 11, weight: 'bold' as const, family: FONT }, autoSkip: false }, title: { display: true, text: 'Kategori', color: text, font: { size: 9, weight: 'bold' as const, family: FONT } } },
            y: { beginAtZero: true, max, grid: { color: grid }, ticks: { color: text, font: { size: 9, family: FONT }, precision: 0 }, title: { display: true, text: 'Jumlah karyawan', color: text, font: { size: 9, weight: 'bold' as const, family: FONT } } } },
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

    // 2. Karyawan terpajan per kategori
    const katVals = [d.kategori.A || 0, d.kategori.B || 0, d.kategori.C || 0];
    draw('kategori', kategoriRef.current, () => new ChartJS(kategoriRef.current!, {
      type: 'bar',
      data: { labels: ['A · rutin', 'B · insidental', 'C · tidak terpajan'], datasets: [{ data: katVals, backgroundColor: ['#E63946', '#F5A623', '#00B894'], borderRadius: 4, ...BAR_LAYOUT }] },
      options: barOpts(false),
    }));

    // 3. Cakupan audiometri tahun ini (per kategori, stacked)
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
          x: { stacked: true, beginAtZero: true, grid: { color: grid }, ticks: { color: text, font: { size: 9, family: FONT }, precision: 0 }, title: { display: true, text: 'Jumlah karyawan', color: text, font: { size: 9, weight: 'bold' as const, family: FONT } } },
          y: { stacked: true, grid: { display: false }, ticks: { color: text, font: { size: 10, family: FONT } }, title: { display: true, text: 'Kategori pajanan', color: text, font: { size: 9, weight: 'bold' as const, family: FONT } } },
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

    // 5. Status kasus STS
    draw('sts', stsRef.current, () => new ChartJS(stsRef.current!, {
      type: 'bar',
      data: {
        labels: ['Suspek', 'Retest', 'Konfirmasi', 'Terlambat'],
        datasets: [{ data: [d.sts.suspek || 0, d.sts.retestDijadwalkan || 0, d.sts.terkonfirmasi || 0, d.sts.retestTerlambat || 0], backgroundColor: ['#E63946', '#F5A623', '#8E44AD', '#B91C1C'], borderRadius: 4, ...BAR_LAYOUT }],
      },
      options: barOpts(false),
    }));

    // 6. Tren Leq maks per area (8 pengukuran terakhir)
    const areas = (d.areas || []) as D[];
    const surv = areas
      .filter((a) => a.tanggal_ukur && a.leq_max != null)
      .sort((a, b) => String(a.tanggal_ukur).localeCompare(String(b.tanggal_ukur)))
      .slice(-8);
    draw('trend', trendRef.current, () => new ChartJS(trendRef.current!, {
      type: 'line',
      data: {
        labels: surv.length ? surv.map((a) => String(a.nama_area)) : ['Belum ada data pengukuran'],
        datasets: [{
          label: 'Leq maks dB(A)',
          data: surv.length ? surv.map((a) => Number(a.leq_max)) : [],
          borderColor: '#ff4d00', backgroundColor: 'rgba(255,77,0,0.14)', fill: true, tension: 0.35, pointRadius: 4, pointHoverRadius: 6,
          pointBackgroundColor: surv.length ? surv.map((a) => ZONA_COLOR[(a.zona as Zona) || 'HIJAU']) : '#ff4d00',
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: anim,
        plugins: {
          legend: { display: false },
          datalabels: { color: text, align: 'top', anchor: 'end', offset: 4, clamp: true, clip: false, font: { size: 9, weight: 'bold', family: FONT } },
          tooltip: { callbacks: { afterLabel: (c) => (surv[c.dataIndex]?.zona ? `Zona: ${surv[c.dataIndex].zona}` : '') } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: text, font: { size: 9, family: FONT }, maxRotation: 30 } },
          y: { beginAtZero: true, suggestedMax: 100, grid: { color: grid }, ticks: { color: text, font: { size: 9, family: FONT } } },
        },
      } as ChartOptions<'line'>,
    }));

    return () => {
      Object.values(charts.current).forEach((c) => c?.destroy());
      charts.current = {};
    };
  }, [d, isDark, animReady]);

  if (err) return <div style={{ padding: 20, color: '#E63946', fontSize: 13 }}>{err}</div>;
  if (!d) return (
    <div className="bm-loading is-card" role="status" aria-live="polite" aria-label="Memuat dashboard konservasi pendengaran">
      <div className="bm-loading-spinner"><div className="bm-loading-ring" aria-hidden="true" /><img src="/BM.png" alt="" className="bm-loading-logo" aria-hidden="true" /></div>
      <p className="bm-loading-label">Memuat dashboard konservasi pendengaran…</p>
    </div>
  );

  const areas = (d.areas || []) as D[];
  const nAreaTot = Object.values(d.zona as Record<string, number>).reduce((a, b) => a + b, 0);
  const kelasCount = Object.values((d.kelas || {}) as Record<string, number>).reduce((a, b) => a + b, 0);
  const katTotal = (d.kategori.A || 0) + (d.kategori.B || 0) + (d.kategori.C || 0);
  const cakTotal = ((d.cakupan || []) as D[]).reduce((s, c) => s + (c.total || 0), 0);
  const stsTotal = (d.sts.suspek || 0) + (d.sts.retestDijadwalkan || 0) + (d.sts.terkonfirmasi || 0) + (d.sts.retestTerlambat || 0);
  const adaUkur = areas.some((a) => a.tanggal_ukur && a.leq_max != null);

  return (
    <div className="dashboard hc-dash" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Ringkasan ringkas dalam satu baris, supaya 6 grafik mendapat ruang maksimum */}
      <div className="kunjungan-filter-bar" style={{ flexShrink: 0, flexWrap: 'wrap' }}>
        <select className="admin-filter-select" value={site} onChange={(e) => { setErr(''); setSite(e.target.value); }}><option value="">All Site</option>{SITES.map((s) => <option key={s}>{s}</option>)}</select>
        <span className="kunjungan-total-right" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span>Konservasi Pendengaran</span>
          <span>Zona merah <b style={{ color: ZONA_COLOR.MERAH }}>{d.zona.MERAH}</b>/{nAreaTot}</span>
          <span>Ukur terlambat <b style={{ color: d.areaTerlambat ? '#E63946' : 'inherit' }}>{d.areaTerlambat}</b></span>
          <span>STS belum ditindak <b style={{ color: d.sts.belumDitindaklanjuti ? '#E63946' : 'inherit' }}>{d.sts.belumDitindaklanjuti}</b></span>
          <span>Audiometri tidak lengkap <b style={{ color: d.audiometri.tidakLengkap ? '#d97706' : 'inherit' }}>{d.audiometri.tidakLengkap}</b></span>
          <span>Retest terlambat <b style={{ color: d.sts.retestTerlambat ? '#E63946' : 'inherit' }}>{d.sts.retestTerlambat}</b></span>
        </span>
      </div>

      {/* Enam grafik mengisi seluruh sisa frame — tanpa scroll halaman */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gridTemplateRows: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8, flex: 1, minHeight: 0 }}>
        <ChartCard title="Zona Kebisingan Area" sub="Area per zona hasil pengukuran terakhir" accent="#E63946" empty={!nAreaTot}><canvas ref={zonaRef} /></ChartCard>
        <ChartCard title="Karyawan Terpajan" sub="A rutin · B insidental · C tidak terpajan" accent="#F5A623" empty={!katTotal}><canvas ref={kategoriRef} /></ChartCard>
        <ChartCard title="Cakupan Audiometri Tahun Ini" sub="Kategori A & B — sudah vs belum diperiksa" accent="#2E86DE" empty={!cakTotal}><canvas ref={cakupanRef} /></ChartCard>
        <ChartCard title="Derajat Gangguan Pendengaran" sub="WHO · telinga yang lebih baik" accent="#8E44AD" empty={!kelasCount}><canvas ref={kelasRef} /></ChartCard>
        <ChartCard title="Kasus STS" sub="Suspek, retest, terkonfirmasi, terlambat" accent="#E63946" empty={!stsTotal}><canvas ref={stsRef} /></ChartCard>
        <ChartCard title="Leq Maks per Area" sub="Titik tertinggi (dB(A)) · warna titik = zona" accent="#ff4d00" empty={!adaUkur}><canvas ref={trendRef} /></ChartCard>
      </div>
    </div>
  );
}
