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

function ChartCard({ title, sub, accent = '#ff4d00', tall, children }: { title: string; sub?: string; accent?: string; tall?: boolean; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: '10px 12px', minHeight: 0 }}>
      <div className="card-head">
        <span style={{ width: 4, height: 26, borderRadius: 2, background: accent, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: tall ? 220 : 190 }}>{children}</div>
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
    draw('klas', klasRef.current, () => new ChartJS(klasRef.current!, {
      type: 'doughnut',
      data: {
        labels: KLAS_SHORT,
        datasets: [{ data: totKlas, backgroundColor: KLAS.map((k) => KLAS_COLOR[k]), borderWidth: 2, borderColor: cardBg, hoverOffset: 6 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: anim, cutout: '58%',
        plugins: {
          legend,
          datalabels: { color: '#fff', font: { size: 11, weight: 'bold', family: FONT }, formatter: (v: number) => (v ? String(v) : '') },
        },
      } as ChartOptions<'doughnut'>,
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

  return (
    <div className="dashboard" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="kunjungan-filter-bar">
        <select className="admin-filter-select" value={site} onChange={(e) => { setErr(''); setSite(e.target.value); }}><option value="">All Site</option>{SITES.map((s) => <option key={s}>{s}</option>)}</select>
        <span className="kunjungan-total-right">Ergonomi RULA / ROSA / WERA — 12 bulan terakhir</span>
      </div>

      {/* Ringkasan angka kunci */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        {[
          { l: 'Survei Disetujui', v: d.totalDisetujui },
          { l: 'Menunggu Persetujuan', v: d.menungguPersetujuan, c: d.menungguPersetujuan ? '#F5A623' : undefined },
          { l: 'Hasil Tidak Sah / Ulang', v: d.perluDiulang, c: d.perluDiulang ? '#E63946' : undefined },
          { l: 'Rekomendasi Aktif', v: d.rekomendasi.open + d.rekomendasi.progress, s: `${d.rekomendasi.closed} closed` },
          { l: 'Lewat Jatuh Tempo', v: d.rekomendasi.lewatJatuhTempo, c: d.rekomendasi.lewatJatuhTempo ? '#E63946' : undefined },
        ].map((s) => (
          <div key={s.l} className="card" style={{ padding: '8px 10px', gap: 0 }}>
            <span style={{ fontSize: 9.5, color: 'var(--muted-foreground)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.03em' }}>{s.l}</span>
            <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1, color: s.c || 'var(--foreground)' }}>{s.v}</span>
            {s.s && <span style={{ fontSize: 9.5, color: 'var(--muted-foreground)' }}>{s.s}</span>}
          </div>
        ))}
      </div>

      {/* Grafik utama */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
        <ChartCard title="Distribusi Klasifikasi Risiko" sub="Seluruh survei disetujui, semua metode" accent="#E63946"><canvas ref={klasRef} /></ChartCard>
        <ChartCard title="Klasifikasi per Metode" sub="RULA · ROSA · WERA" accent="#F5A623"><canvas ref={metodeRef} /></ChartCard>
        <ChartCard title="Status Rekomendasi" sub="Open · progress · closed · lewat tempo" accent="#00B894"><canvas ref={rekomRef} /></ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 10 }}>
        <ChartCard title="Tren Survei per Bulan" sub="Batang: total survei · garis: perlu PICA" accent="#2E86DE" tall><canvas ref={trendRef} /></ChartCard>
        <ChartCard title="Kepatuhan Frekuensi Survei" sub="Internal bulan ini & pihak ketiga 12 bulan" accent="#778899" tall><canvas ref={patuhRef} /></ChartCard>
      </div>

      {/* Tabel pendukung: area risiko tinggi + kepatuhan detail */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 10 }}>
        <div className="card" style={{ padding: '10px 12px', overflow: 'auto' }}>
          <div className="card-head">
            <span style={{ width: 4, height: 22, borderRadius: 2, background: '#E63946', flexShrink: 0 }} />
            <div><h2>Risiko Tinggi Terbaru</h2><p>{d.risikoTinggi.length} survei</p></div>
          </div>
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
        <div className="card" style={{ padding: '10px 12px', overflow: 'auto' }}>
          <div className="card-head">
            <span style={{ width: 4, height: 22, borderRadius: 2, background: '#778899', flexShrink: 0 }} />
            <div><h2>Kepatuhan per Site</h2><p>Internal ≥1/bulan · pihak ketiga ≥1/12 bulan</p></div>
          </div>
          <table style={tableStyle}>
            <thead><tr>{['Site', 'Internal bulan ini', 'Pihak ketiga 12 bln'].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {patuh.map((k) => (
                <tr key={k.site}><td style={tdStyle}>{k.site}</td>
                  <td style={tdStyle}>{k.internalBulanIni} {k.internalBulanIni >= 1 ? <Chip text="OK" color="#00B894" /> : <Chip text="BELUM" color="#E63946" />}</td>
                  <td style={tdStyle}>{k.pihakKetiga12Bulan} {k.pihakKetiga12Bulan >= 1 ? <Chip text="OK" color="#00B894" /> : <Chip text="BELUM" color="#E63946" />}</td></tr>
              ))}
              {!patuh.length && <tr><td style={tdStyle} colSpan={3}>Belum ada data.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
