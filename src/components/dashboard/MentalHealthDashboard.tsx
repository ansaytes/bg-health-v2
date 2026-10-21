'use client';
// Dashboard > Kesehatan Mental. Data dari /api/mental-health/dashboard.
// Gaya visual mengikuti Monitoring MCU / Hearing Conservation / Ergonomi:
// grid 3×2 grafik, ringkasan di bar atas, empty-state rapi bila belum ada data.
import { useEffect, useRef, useState } from 'react';
import { Chart as ChartJS, registerables, type ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { authFetch } from '@/lib/api-client';
import { sdsBandLabel } from '@/lib/questionnaire-scores';
import { SITES } from '@/components/administrator/hc-ergo-ui';

ChartJS.register(...registerables, ChartDataLabels);

type D = Record<string, any>;
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

// Warna lembut dan tidak saling bertabrakan: merah = perlu tindak lanjut,
// oranye = perlu perhatian, hijau = normal. Biru hanya untuk seri netral.
const RED = 'rgba(231, 76, 60, 0.72)';
const AMBER = 'rgba(243, 156, 18, 0.72)';
const GREEN = 'rgba(0, 184, 148, 0.72)';
const BLUE = 'rgba(52, 152, 219, 0.72)';
const STEEL = 'rgba(119, 136, 153, 0.55)';

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

export default function MentalHealthDashboard() {
  const [d, setD] = useState<D | null>(null);
  const [site, setSite] = useState('');
  const [err, setErr] = useState('');
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  const srqRef = useRef<HTMLCanvasElement | null>(null);
  const dassRef = useRef<HTMLCanvasElement | null>(null);
  const sdsRef = useRef<HTMLCanvasElement | null>(null);
  const trendRef = useRef<HTMLCanvasElement | null>(null);
  const siteRef = useRef<HTMLCanvasElement | null>(null);
  const charts = useRef<Record<string, ChartJS | null>>({});

  useEffect(() => {
    const id = setTimeout(() => setIsDark(document.documentElement.classList.contains('dark')), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    let alive = true;
    authFetch(`/api/mental-health/dashboard?site=${encodeURIComponent(site)}`)
      .then((r) => { if (alive) { setD(r.data); setErr(''); } })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : 'Gagal memuat dashboard'); });
    return () => { alive = false; };
  }, [site]);

  useEffect(() => {
    if (!d) return;
    const text = isDark ? '#F9FAFB' : '#111827';
    const grid = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
    const cardBg = isDark ? '#1b1b1b' : '#ffffff';
    const anim = { duration: 800, easing: 'easeOutQuart' as const };

    const draw = (key: string, el: HTMLCanvasElement | null, make: () => ChartJS) => {
      if (!el) return;
      charts.current[key]?.destroy();
      charts.current[key] = make();
    };
    const legendRight = {
      position: 'right' as const,
      labels: { color: text, font: { size: 9.5, weight: 'bold' as const, family: FONT }, boxWidth: 10, usePointStyle: true },
    };

    const BAND_COLOR: Record<string, string> = {
      Normal: GREEN,
      'Perlu Tindak Lanjut': RED,
      Ringan: 'rgba(241, 196, 15, 0.72)',
      Sedang: AMBER,
      Berat: RED,
      'Stres Rendah': GREEN,
      'Stres Sedang': AMBER,
      'Stres Tinggi': RED,
    };

    /** Donut dengan total di tengah — pola sama dengan kartu MCU. */
    const doughnut = (key: string, el: HTMLCanvasElement | null, labels: string[], values: number[], center: string, caption: string) => {
      const total = values.reduce((a, b) => a + b, 0);
      draw(key, el, () => new ChartJS(el!, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: labels.map(k => BAND_COLOR[k] || STEEL),
            borderColor: cardBg,
            borderWidth: 2,
            hoverOffset: 6,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: anim, cutout: '62%', radius: '82%',
          plugins: {
            legend: legendRight,
            tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed}${total ? ` (${(c.parsed / total * 100).toFixed(1)}%)` : ''}` } },
            datalabels: {
              display: (c) => Number(c.dataset.data[c.dataIndex]) > 0,
              color: '#ffffff',
              font: { size: 10, weight: 'bold' as const, family: FONT },
              formatter: (v: number) => (total ? `${(v / total * 100).toFixed(0)}%` : ''),
            },
          },
        } as ChartOptions<'doughnut'>,
        plugins: [{
          id: `mh-center-${key}`,
          afterDraw: (chart) => {
            const { left, right, top, bottom } = chart.chartArea;
            const ctx = chart.ctx;
            const cx = (left + right) / 2;
            const cy = (top + bottom) / 2;
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = text;
            ctx.font = `bold 20px ${FONT}`;
            ctx.fillText(center, cx, cy - 6);
            ctx.globalAlpha = 0.6;
            ctx.font = `600 8.5px ${FONT}`;
            ctx.fillText(caption, cx, cy + 12);
            ctx.restore();
          },
        }],
      }));
    };

    const bandEntries = (band: Record<string, number>, order: string[]) =>
      order.filter(k => (band?.[k] || 0) > 0).map(k => [k, band[k]] as [string, number]);

    // 1. SRQ-20 — ambang ≥6 perlu tindak lanjut
    const srqBand = bandEntries(d.instrumen.srq20.band || {}, ['Normal', 'Perlu Tindak Lanjut']);
    doughnut('srq', srqRef.current, srqBand.map(([k]) => k), srqBand.map(([, v]) => v), String(d.instrumen.srq20.terisi), 'RESPONDEN');

    // 2. DASS-21 — tingkat keparahan terburuk dari 3 subskala
    const dassBand = bandEntries(d.instrumen.dass21.band || {}, ['Normal', 'Ringan', 'Sedang', 'Berat', 'Sangat Berat']);
    doughnut('dass', dassRef.current, dassBand.map(([k]) => k), dassBand.map(([, v]) => v), String(d.instrumen.dass21.terisi), 'RESPONDEN');

    // 3. SDS-30 — 6 indikator faktor psikologi kerja (skor 5–35).
    //    Dihitung per indikator, bukan dari total 30 item.
    const ind = (d.instrumen.sds.perIndikator || []) as D[];
    const sdsLow = ind.reduce((a, i) => a + (i.rendah || 0), 0);
    const sdsMid = ind.reduce((a, i) => a + (i.sedang || 0), 0);
    const sdsHigh = ind.reduce((a, i) => a + (i.tinggi || 0), 0);
    const sdsBand: [string, number][] = [
      ['Stres Rendah', sdsLow], ['Stres Sedang', sdsMid], ['Stres Tinggi', sdsHigh],
    ];
    doughnut('sds', sdsRef.current, sdsBand.map(([k]) => k), sdsBand.map(([, v]) => v), String(d.instrumen.sds.terisi), 'RESPONDEN');

    // 4. Rata-rata skor per indikator SDS-30 (skala 5–35)
    draw('avg', trendRef.current, () => new ChartJS(trendRef.current!, {
      type: 'bar',
      data: {
        labels: ind.map(i => String(i.title)),
        datasets: [{
          data: ind.map(i => i.rataRata || 0),
          backgroundColor: ind.map(i => BAND_COLOR[sdsBandLabel(Number(i.rataRata || 0))] || STEEL),
          borderRadius: 5,
          maxBarThickness: 30,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: anim,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => ` Rata-rata ${c.parsed.y} dari 35` } },
          datalabels: { color: text, anchor: 'end', align: 'top', clamp: true, clip: false, font: { size: 9.5, weight: 'bold' as const, family: FONT }, formatter: (v: number) => (v ? String(v) : '') },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: text, font: { size: 8.5, family: FONT }, autoSkip: false, maxRotation: 40, minRotation: 0 } },
          y: { beginAtZero: true, suggestedMax: 35, grid: { color: grid }, ticks: { color: text, font: { size: 9, family: FONT } } },
        },
      } as ChartOptions<'bar'>,
    }));

    // 5. Tren pengisian SRQ-20 per bulan (batang total, garis perlu tindak lanjut)
    const trend = (d.trend || []) as D[];
    draw('trend', siteRef.current, () => new ChartJS(siteRef.current!, {
      data: {
        labels: trend.map(t => d.bulan[Number(String(t.bulan).slice(5)) - 1]),
        datasets: [
          { type: 'bar' as const, label: 'Diisi', data: trend.map(t => t.srq), backgroundColor: BLUE, borderRadius: 4, maxBarThickness: 26, order: 2 },
          { type: 'line' as const, label: 'Perlu tindak lanjut', data: trend.map(t => t.perluTindakLanjut), borderColor: '#E74C3C', backgroundColor: '#E74C3C', tension: 0.35, pointRadius: 3, borderWidth: 2, order: 1 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: anim,
        plugins: {
          legend: { position: 'bottom', labels: { color: text, font: { size: 9.5, family: FONT }, boxWidth: 10, usePointStyle: true } },
          datalabels: { display: false },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: text, font: { size: 9, family: FONT } } },
          y: { beginAtZero: true, grid: { color: grid }, ticks: { color: text, font: { size: 9, family: FONT }, precision: 0 } },
        },
      } as ChartOptions,
    }));

    return () => {
      Object.values(charts.current).forEach((c) => c?.destroy());
      charts.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, isDark]);

  if (err) return <div style={{ padding: 20, color: '#E63946', fontSize: 13 }}>{err}</div>;
  if (!d) return (
    <div className="bm-loading is-card" role="status" aria-live="polite" aria-label="Memuat dashboard kesehatan mental">
      <div className="bm-loading-spinner"><div className="bm-loading-ring" aria-hidden="true" /><img src="/BM.png" alt="" className="bm-loading-logo" aria-hidden="true" /></div>
      <p className="bm-loading-label">Memuat dashboard kesehatan mental…</p>
    </div>
  );

  const perSite = (d.perSite || []) as D[];
  const i = d.instrumen;

  return (
    <div className="dashboard mh-dash" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="kunjungan-filter-bar" style={{ flexShrink: 0, flexWrap: 'wrap' }}>
        <select className="admin-filter-select" value={site} onChange={(e) => setSite(e.target.value)}><option value="">All Site</option>{SITES.map((s) => <option key={s}>{s}</option>)}</select>
        <span className="kunjungan-total-right" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span>Kesehatan Mental · SRQ-20 · DASS-21 · SDS-30</span>
          <span>Responden <b>{d.totalResponden}</b></span>
          <span>SRQ ≥6 <b style={{ color: i.srq20.perluTindakLanjut ? '#E74C3C' : 'inherit' }}>{i.srq20.perluTindakLanjut}</b></span>
          <span>DASS terisi <b>{i.dass21.terisi}</b></span>
          <span>SDS-30 terisi <b>{i.sds.terisi}</b></span>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gridTemplateRows: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8, flex: 1, minHeight: 0 }}>
        <ChartCard title="SRQ-20" sub="Ambang ≥ 6 = perlu tindak lanjut" accent="#E74C3C" empty={!i.srq20.terisi}><canvas ref={srqRef} /></ChartCard>
        <ChartCard title="DASS-21" sub="Keparahan terburuk dari depresi, ansietas, stres" accent="#F39C12" empty={!i.dass21.terisi}><canvas ref={dassRef} /></ChartCard>
        <ChartCard title="SDS-30" sub="6 indikator × 5 item · skor 5–35" accent="#8E44AD" empty={!i.sds.terisi}><canvas ref={sdsRef} /></ChartCard>

        <ChartCard title="Rata-rata Skor Indikator SDS-30" sub="Skor indikator 5–35 · makin tinggi makin berat" accent="#3498DB" empty={!i.sds.terisi}><canvas ref={trendRef} /></ChartCard>
        <ChartCard title="Tren Pengisian & Kasus SRQ-20" sub="12 bulan terakhir" accent="#2E86DE" empty={!d.trend.some((t: D) => t.srq)}><canvas ref={siteRef} /></ChartCard>

        <div className="card" style={{ padding: '6px 10px', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="card-head" style={{ flexShrink: 0 }}>
            <span style={{ width: 4, height: 20, borderRadius: 2, background: '#778899', flexShrink: 0 }} />
            <div><h2>Sebaran per Site</h2><p>Responden &amp; kasus SRQ-20</p></div>
          </div>
          <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead><tr>{['Site', 'Responden', 'SRQ ≥6'].map(h => <th key={h} style={{ textAlign: 'left', padding: '5px 8px', borderBottom: '1px solid var(--border)', color: 'var(--muted-foreground)', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>)}</tr></thead>
              <tbody>
                {perSite.map((s) => (
                  <tr key={s.site}>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)' }}>{s.site}</td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>{s.total}</td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', fontWeight: 700, color: s.perluTindakLanjut ? '#E74C3C' : 'inherit' }}>{s.perluTindakLanjut}</td>
                  </tr>
                ))}
                {!perSite.length && <tr><td colSpan={3} style={{ padding: 16, textAlign: 'center', color: 'var(--muted-foreground)' }}>Belum ada data.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 9.5, color: 'var(--muted-foreground)', lineHeight: 1.5, flexShrink: 0 }}>
        Catatan: SDS-30 adalah Survei Diagnosis Stres (Lampiran Permenaker 5/2018) yang mengukur faktor psikologi kerja,
        bukan depresi. Skor per indikator 5–35: 5–9 rendah, 10–24 sedang, 25–35 tinggi.
        SRQ-20 dan DASS-21 bersifat skrining — diagnosis tetap ditetapkan dokter.
      </div>
    </div>
  );
}
