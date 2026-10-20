'use client';
// Dashboard > Ergonomi. Data dari /api/ergo?resource=dashboard (12 bulan terakhir, survei berstatus Disetujui).
// Layout grafik-first: donut klasifikasi, bar per metode, tren bulanan, status rekomendasi, kepatuhan per site.
import { useEffect, useRef, useState } from 'react';
import { Chart as ChartJS, registerables, type ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { authFetch } from '@/lib/api-client';
import { KLAS_COLOR, type Klasifikasi } from '@/lib/hc-ergo';
import { Chip, SITES, fmtDate, tableStyle, tdStyle, thStyle } from '@/components/administrator/hc-ergo-ui';

ChartJS.register(...registerables, ChartDataLabels);

type D = Record<string, any>;
const KLAS: Klasifikasi[] = ['RENDAH', 'SEDANG', 'TINGGI', 'SANGAT_TINGGI'];
const KLAS_SHORT = ['Rendah', 'Sedang', 'Tinggi', 'Sgt Tinggi'];
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

function ChartCard({ title, sub, accent = '#ff4d00', empty, tall, children }: { title: string; sub?: string; accent?: string; empty?: boolean; tall?: boolean; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: '10px 12px', minHeight: 0 }}>
      <div className="card-head">
        <span style={{ width: 4, height: 26, borderRadius: 2, background: accent, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: tall ? 220 : 190 }}>
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

export default function ErgonomiDashboard() {
  const [d, setD] = useState<D | null>(null);
  const [site, setSite] = useState('');
  const [err, setErr] = useState('');
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  const klasRef = useRef<HTMLCanvasElement | null>(null);
  const metodeRef = useRef<HTMLCanvasElement | null>(null);
  const trendRef = useRef<HTMLCanvasElement | null>(null);
  const rekomRef = useRef<HTMLCanvasElement | null>(null);
  const patuhRef = useRef<HTMLCanvasElement | null>(null);
  const charts = useRef<Record<string, ChartJS | null>>({});

  useEffect(() => {
    // Tema dibaca setelah mount (bukan setState sinkron di body effect).
    const id = setTimeout(() => setIsDark(document.documentElement.classList.contains('dark')), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    let alive = true;
    authFetch(`/api/ergo?resource=dashboard&site=${encodeURIComponent(site)}`)
      .then((r) => { if (alive) setD(r.data); })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : 'Gagal memuat dashboard'); });
    return () => { alive = false; };
  }, [site]);

  useEffect(() => {
    if (!d) return;
    const text = isDark ? '#F9FAFB' : '#111827';
    const grid = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
    const cardBg = isDark ? '#1b1b1b' : '#ffffff';
    const anim = { duration: 800, easing: 'easeOutQuart' as const };
    const legend = { position: 'bottom' as const, labels: { color: text, font: { size: 10, family: FONT }, boxWidth: 9, boxHeight: 9, padding: 8 } };

    const draw = (key: string, el: HTMLCanvasElement | null, make: () => ChartJS) => {
      if (!el) return;
      charts.current[key]?.destroy();
      charts.current[key] = make();
    };
    const barOpts = (horizontal: boolean, stacked = false): ChartOptions<'bar'> => ({
      responsive: true, maintainAspectRatio: false, animation: anim, indexAxis: horizontal ? 'y' : 'x',
      plugins: {
        legend: stacked ? legend : { display: false },
        tooltip: { enabled: true },
        datalabels: {
          color: text, anchor: 'end', align: horizontal ? 'right' : 'top', clamp: true, clip: false,
          font: { size: 10, weight: 'bold', family: FONT }, formatter: (v: number) => (v ? String(v) : ''),
        },
      },
      scales: horizontal
        ? { x: { stacked, beginAtZero: true, grid: { color: grid }, ticks: { color: text, font: { size: 9, family: FONT }, precision: 0 } },
            y: { stacked, grid: { display: false }, ticks: { color: text, font: { size: 9, family: FONT }, autoSkip: false } } }
        : { x: { stacked, grid: { display: false }, ticks: { color: text, font: { size: 9, family: FONT }, autoSkip: false } },
            y: { stacked, beginAtZero: true, grid: { color: grid }, ticks: { color: text, font: { size: 9, family: FONT }, precision: 0 } } },
    } as ChartOptions<'bar'>);

    // 1. Donut distribusi klasifikasi risiko (semua metode)
    const totKlas = KLAS.map((k) => (['RULA', 'ROSA', 'WERA'] as const).reduce((s, m) => s + (d.byKlas[m]?.[k] || 0), 0));
    const grandTotal = totKlas.reduce((s, v) => s + v, 0);
    draw('klas', klasRef.current, () => new ChartJS(klasRef.current!, {
      type: 'doughnut',
      data: {
        labels: KLAS_SHORT,
        datasets: [{ data: totKlas, backgroundColor: KLAS.map((k) => KLAS_COLOR[k]), borderWidth: 2, borderColor: cardBg, hoverOffset: 6 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: anim, cutout: '62%', radius: '82%',
        plugins: {
          legend,
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed}${grandTotal ? ` (${(ctx.parsed / grandTotal * 100).toFixed(1)}%)` : ''}` } },
          datalabels: { color: '#fff', font: { size: 10, weight: 'bold', family: FONT }, formatter: (v: number) => (v ? String(v) : '') },
        },
      } as ChartOptions<'doughnut'>,
      plugins: [{
        id: 'ergo-center-total',
        afterDraw: (chart) => {
          const { left, right, top, bottom } = chart.chartArea;
          const ctx = chart.ctx;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = text;
          ctx.font = `bold 20px ${FONT}`;
          ctx.fillText(String(grandTotal), (left + right) / 2, (top + bottom) / 2 - 6);
          ctx.globalAlpha = 0.6;
          ctx.font = `600 9px ${FONT}`;
          ctx.fillText('TOTAL SURVEI', (left + right) / 2, (top + bottom) / 2 + 12);
          ctx.restore();
        },
      }],
    }));

    // 2. Klasifikasi per metode (stacked horizontal)
    const metode = ['RULA', 'ROSA', 'WERA'] as const;
    draw('metode', metodeRef.current, () => new ChartJS(metodeRef.current!, {
      type: 'bar',
      data: {
        labels: metode.map((m) => `${m} · ${d.byMetode[m] || 0}`),
        datasets: KLAS.map((k) => ({
          label: String(k).replace('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
          data: metode.map((m) => d.byKlas[m]?.[k] || 0),
          backgroundColor: KLAS_COLOR[k], borderRadius: 3, maxBarThickness: 26,
        })),
      },
      options: barOpts(true, true),
    }));

    // 3. Tren survei per bulan (bar + garis risiko sedang ke atas)
    const trend = (d.trend || []) as D[];
    draw('trend', trendRef.current, () => new ChartJS(trendRef.current!, {
      data: {
        labels: trend.length ? trend.map((t) => BLN[Number(String(t.bulan).slice(5)) - 1]) : ['-'],
        datasets: [
          { type: 'bar' as const, label: 'Total survei', data: trend.length ? trend.map((t) => t.total) : [0], backgroundColor: 'rgba(46,134,222,0.75)', borderRadius: 5, maxBarThickness: 34, order: 2 },
          { type: 'line' as const, label: 'Perlu PICA', data: trend.length ? trend.map((t) => t.sedangKeAtas) : [0], borderColor: '#E63946', backgroundColor: '#E63946', tension: 0.35, pointRadius: 3, borderWidth: 2, order: 1 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: anim,
        plugins: {
          legend,
          datalabels: { display: false },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: text, font: { size: 9, family: FONT } } },
          y: { beginAtZero: true, grid: { color: grid }, ticks: { color: text, font: { size: 9, family: FONT }, precision: 0 } },
        },
      } as ChartOptions,
    }));

    // 4. Status rekomendasi
    const rk = d.rekomendasi || {};
    draw('rekom', rekomRef.current, () => new ChartJS(rekomRef.current!, {
      type: 'bar',
      data: {
        labels: ['Open', 'Progress', 'Closed', 'Lewat tempo'],
        datasets: [{ data: [rk.open || 0, rk.progress || 0, rk.closed || 0, rk.lewatJatuhTempo || 0], backgroundColor: ['#E63946', '#F5A623', '#00B894', '#B91C1C'], borderRadius: 5, maxBarThickness: 40 }],
      },
      options: barOpts(false),
    }));

    // 5. Kepatuhan frekuensi survei per site (internal & pihak ketiga)
    const patuh = (d.kepatuhan || []) as D[];
    draw('patuh', patuhRef.current, () => new ChartJS(patuhRef.current!, {
      type: 'bar',
      data: {
        labels: patuh.length ? patuh.map((k) => String(k.site)) : ['Belum ada data'],
        datasets: [
          { label: 'Internal bulan ini', data: patuh.length ? patuh.map((k) => k.internalBulanIni) : [0], backgroundColor: '#2E86DE', borderRadius: 4, maxBarThickness: 26 },
          { label: 'Pihak ketiga 12 bln', data: patuh.length ? patuh.map((k) => k.pihakKetiga12Bulan) : [0], backgroundColor: '#00B894', borderRadius: 4, maxBarThickness: 26 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: anim, indexAxis: 'y',
        plugins: {
          legend,
          datalabels: { display: false },
        },
        scales: {
          x: { beginAtZero: true, grid: { color: grid }, ticks: { color: text, font: { size: 9, family: FONT }, precision: 0 } },
          y: { grid: { display: false }, ticks: { color: text, font: { size: 10, family: FONT }, autoSkip: false } },
        },
      } as ChartOptions<'bar'>,
    }));

    return () => {
      Object.values(charts.current).forEach((c) => c?.destroy());
      charts.current = {};
    };
  }, [d, isDark]);

  if (err) return <div style={{ padding: 20, color: '#E63946', fontSize: 13 }}>{err}</div>;
  if (!d) return (
    <div className="bm-loading is-card" role="status" aria-live="polite" aria-label="Memuat dashboard ergonomi">
      <div className="bm-loading-spinner"><div className="bm-loading-ring" aria-hidden="true" /><img src="/BM.png" alt="" className="bm-loading-logo" aria-hidden="true" /></div>
      <p className="bm-loading-label">Memuat dashboard ergonomi…</p>
    </div>
  );

  const patuh = (d.kepatuhan || []) as D[];
  // Nilai total untuk empty-state tiap kartu (data kosong tidak digambar sebagai sumbu 0–1).
  const grandTotal = KLAS.reduce((s, k) => s + (['RULA', 'ROSA', 'WERA'] as const).reduce((t, m) => t + (d.byKlas[m]?.[k] || 0), 0), 0);
  const rekomTotal = (d.rekomendasi?.open || 0) + (d.rekomendasi?.progress || 0) + (d.rekomendasi?.closed || 0);
  const trendTotal = ((d.trend || []) as D[]).reduce((s, t) => s + (t.total || 0), 0);
  const patuhTotal = patuh.reduce((s, k) => s + (k.internalBulanIni || 0) + (k.pihakKetiga12Bulan || 0), 0);

  return (
    <div className="dashboard" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="kunjungan-filter-bar" style={{ flexShrink: 0, flexWrap: 'wrap' }}>
        <select className="admin-filter-select" value={site} onChange={(e) => { setErr(''); setSite(e.target.value); }}><option value="">All Site</option>{SITES.map((s) => <option key={s}>{s}</option>)}</select>
        <span className="kunjungan-total-right" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span>Ergonomi RULA / ROSA / WERA · 12 bulan</span>
          <span>Disetujui <b>{d.totalDisetujui}</b></span>
          <span>Menunggu <b style={{ color: d.menungguPersetujuan ? '#F5A623' : 'inherit' }}>{d.menungguPersetujuan}</b></span>
          <span>Tidak sah/ulang <b style={{ color: d.perluDiulang ? '#E63946' : 'inherit' }}>{d.perluDiulang}</b></span>
          <span>Rekomendasi aktif <b>{d.rekomendasi.open + d.rekomendasi.progress}</b></span>
          <span>Lewat tempo <b style={{ color: d.rekomendasi.lewatJatuhTempo ? '#E63946' : 'inherit' }}>{d.rekomendasi.lewatJatuhTempo}</b></span>
        </span>
      </div>

      {/* Grafik utama — 3 kolom × 2 baris mengisi frame */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gridTemplateRows: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8, flex: 1, minHeight: 0 }}>
        <ChartCard title="Distribusi Klasifikasi Risiko" sub="Seluruh survei disetujui, semua metode" accent="#E63946" empty={!grandTotal}><canvas ref={klasRef} /></ChartCard>
        <ChartCard title="Klasifikasi per Metode" sub="RULA · ROSA · WERA" accent="#F5A623" empty={!grandTotal}><canvas ref={metodeRef} /></ChartCard>
        <ChartCard title="Status Rekomendasi" sub="Open · progress · closed · lewat tempo" accent="#00B894" empty={!rekomTotal}><canvas ref={rekomRef} /></ChartCard>
        <ChartCard title="Tren Survei per Bulan" sub="Batang: total survei · garis: perlu PICA" accent="#2E86DE" empty={!trendTotal}><canvas ref={trendRef} /></ChartCard>
        <ChartCard title="Kepatuhan Frekuensi Survei" sub="Internal bulan ini & pihak ketiga 12 bulan" accent="#778899" empty={!patuhTotal}><canvas ref={patuhRef} /></ChartCard>
        <div className="card" style={{ padding: '6px 10px', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="card-head" style={{ flexShrink: 0 }}>
            <span style={{ width: 4, height: 20, borderRadius: 2, background: '#E63946', flexShrink: 0 }} />
            <div><h2>Risiko Tinggi Terbaru</h2><p>{d.risikoTinggi.length} survei</p></div>
          </div>
          <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
            <table style={tableStyle}>
              <thead><tr>{['Tanggal', 'Metode', 'Site / Area', 'Skor', 'Klasifikasi'].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>
                {d.risikoTinggi.map((r: D) => (
                  <tr key={r.id}><td style={tdStyle}>{fmtDate(r.tanggal)}</td><td style={tdStyle}>{r.metode}</td><td style={tdStyle}>{r.site} — {r.area_kerja}</td><td style={tdStyle}>{r.skor_akhir}</td>
                    <td style={tdStyle}><Chip text={String(r.klasifikasi).replace('_', ' ')} color={KLAS_COLOR[r.klasifikasi as Klasifikasi]} /></td></tr>
                ))}
                {!d.risikoTinggi.length && <tr><td style={tdStyle} colSpan={5}>Tidak ada.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail kepatuhan per site ada di tab Administrator → Ergonomi */}
    </div>
  );
}
