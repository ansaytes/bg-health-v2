'use client';
// Dashboard > Kesehatan Mental. Data dari /api/mental-health/dashboard.
//
// Fokus halaman ini HANYA pada hasil skrining: SRQ-20 dan DASS-21.
// Tren pengisian sengaja tidak ditampilkan (bukan statistik yang dipakai untuk
// tindak lanjut). Tiga kartu (SRQ-20, DASS-21, skor subskala) disusun dalam satu
// baris sehingga memenuhi layar tanpa ruang kosong dan tanpa perlu scroll.
import { useEffect, useRef, useState } from 'react';
import { Chart as ChartJS, registerables, type ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { authFetch } from '@/lib/api-client';
import { SITES } from '@/components/administrator/hc-ergo-ui';
import { BAR_LAYOUT, STANDAR_ANIMASI_BAR, STANDAR_ANIMASI_DONUT } from '@/lib/chart-standard';

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
        {/* Canvas SELALU dirender (hanya disembunyikan) supaya ref tidak null saat
            data datang belakangan. Tanpa ini chart tidak pernah tergambar. */}
        <div style={{ position: 'absolute', inset: 0, visibility: empty ? 'hidden' : 'visible' }}>{children}</div>
        {empty && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--muted-foreground)' }}>
            <span style={{ width: 38, height: 38, borderRadius: '50%', border: `2px dashed ${accent}55`, display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 800, color: `${accent}99` }}>–</span>
            <span style={{ fontSize: 11.5, fontWeight: 600 }}>Belum ada data</span>
          </div>
        )}
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
  const subskalaRef = useRef<HTMLCanvasElement | null>(null);
  const siteRef = useRef<HTMLCanvasElement | null>(null);
  const charts = useRef<Record<string, ChartJS | null>>({});
  const lastSignature = useRef<string | null>(null);

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
    // Animasi hanya saat ISI DATA berubah (muat awal / ganti site), bukan saat tema
    // berganti. Tanpa penanda ini chart dibuat ulang terus dan animasinya terasa mati.
    const signature = JSON.stringify(d);
    const isDataChange = lastSignature.current !== signature;
    lastSignature.current = signature;
    const anim = isDataChange ? STANDAR_ANIMASI_BAR : (false as const);
    const donutAnim = isDataChange ? STANDAR_ANIMASI_DONUT : (false as const);

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
      'Stres Ringan': GREEN,
      'Stres Sedang': AMBER,
      'Stres Berat': RED,
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
          responsive: true, maintainAspectRatio: false, animation: donutAnim, cutout: '62%', radius: '82%', rotation: 0, circumference: 360,
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

    // 3. Rata-rata skor DASS-21 per subskala (skala 0–21).
    //    SDS-30 tidak di halaman ini: instrumen itu mengukur faktor psikologi
    //    lingkungan kerja dan berada di Higiene Industri.
    const d21 = d.instrumen.dass21 || {};
    draw('subskala', subskalaRef.current, () => new ChartJS(subskalaRef.current!, {
      type: 'bar',
      data: {
        labels: ['Depresi', 'Ansietas', 'Stres'],
        datasets: [{
          data: [d21.rataDepresi || 0, d21.rataAnsietas || 0, d21.rataStres || 0],
          backgroundColor: ['rgba(52,152,219,0.78)', 'rgba(243,156,18,0.78)', 'rgba(231,76,60,0.78)'],
          borderRadius: 4,
          ...BAR_LAYOUT,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: anim,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => ` Rata-rata ${c.parsed.y}` } },
          datalabels: { color: text, anchor: 'end', align: 'top', clamp: true, clip: false, font: { size: 10, weight: 'bold' as const, family: FONT }, formatter: (v: number) => (v ? String(v) : '') },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: text, font: { size: 10, family: FONT }, autoSkip: false }, title: { display: true, text: 'Subskala DASS-21', color: text, font: { size: 9, weight: 'bold' as const, family: FONT } } },
          y: { beginAtZero: true, grid: { color: grid }, ticks: { color: text, font: { size: 9, family: FONT } }, title: { display: true, text: 'Rata-rata skor', color: text, font: { size: 9, weight: 'bold' as const, family: FONT } } },
        },
      } as ChartOptions<'bar'>,
    }));

    // 4. Sebaran SRQ-20 per site (bukan tren — hanya distribusi wilayah).
    const perSiteData = (d.perSite || []) as D[];
    draw('site', siteRef.current, () => new ChartJS(siteRef.current!, {
      type: 'bar',
      data: {
        labels: perSiteData.length ? perSiteData.map((s) => String(s.site)) : ['Belum ada data'],
        datasets: [
          { label: 'Responden', data: perSiteData.length ? perSiteData.map((s) => s.total || 0) : [0], backgroundColor: 'rgba(52,152,219,0.78)', borderRadius: 4, ...BAR_LAYOUT },
          { label: 'SRQ-20 ≥ 6', data: perSiteData.length ? perSiteData.map((s) => s.perluTindakLanjut || 0) : [0], backgroundColor: 'rgba(231,76,60,0.80)', borderRadius: 4, ...BAR_LAYOUT },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: anim, indexAxis: 'y',
        plugins: {
          legend: { position: 'bottom', labels: { color: text, font: { size: 10, family: FONT }, boxWidth: 10, usePointStyle: true } },
          datalabels: { display: false },
        },
        scales: {
          x: { beginAtZero: true, grid: { color: grid }, ticks: { color: text, font: { size: 9, family: FONT }, precision: 0 }, title: { display: true, text: 'Jumlah orang', color: text, font: { size: 9, weight: 'bold' as const, family: FONT } } },
          y: { grid: { display: false }, ticks: { color: text, font: { size: 10, family: FONT }, autoSkip: false }, title: { display: true, text: 'Site', color: text, font: { size: 9, weight: 'bold' as const, family: FONT } } },
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
    <div className="bm-loading is-card" role="status" aria-live="polite" aria-label="Memuat dashboard kesehatan mental">
      <div className="bm-loading-spinner"><div className="bm-loading-ring" aria-hidden="true" /><img src="/BM.png" alt="" className="bm-loading-logo" aria-hidden="true" /></div>
      <p className="bm-loading-label">Memuat dashboard kesehatan mental…</p>
    </div>
  );

  const perSite = (d.perSite || []) as D[];
  const i = d.instrumen;
  // Ringkasan SRQ-20 ditonjolkan sebagai angka besar di bar atas agar hasil
  // skrining langsung terbaca sebelum melihat diagram.
  const srqPerlu = Number(i.srq20.perluTindakLanjut || 0);
  const srqTerisi = Number(i.srq20.terisi || 0);
  const srqPersen = srqTerisi ? (srqPerlu / srqTerisi) * 100 : 0;
  const dassPerlu = Object.entries((i.dass21.band || {}) as Record<string, number>)
    .filter(([k]) => ['Sedang', 'Berat', 'Sangat Berat'].includes(k))
    .reduce((sum, [, v]) => sum + Number(v || 0), 0);
  const dassTerisi = Number(i.dass21.terisi || 0);

  return (
    <div className="dashboard mh-dash" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <div className="kunjungan-filter-bar" style={{ flexShrink: 0, flexWrap: 'wrap' }}>
        <select className="admin-filter-select" value={site} onChange={(e) => setSite(e.target.value)}><option value="">All Site</option>{SITES.map((s) => <option key={s}>{s}</option>)}</select>
        <span className="kunjungan-total-right" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span>Kesehatan Mental · SRQ-20 · DASS-21</span>
          <span>Responden <b>{d.totalResponden}</b></span>
          <span>SRQ ≥6 <b style={{ color: i.srq20.perluTindakLanjut ? '#FF2D2D' : 'inherit' }}>{i.srq20.perluTindakLanjut}</b></span>
          <span>DASS terisi <b>{i.dass21.terisi}</b></span>
        </span>
      </div>

      {/* Highlight hasil skrining — yang paling penting untuk tindak lanjut. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, flexShrink: 0 }}>
        {[
          { label: 'SRQ-20 Terisi', value: srqTerisi, caption: 'responden', color: '#E74C3C' },
          { label: 'SRQ-20 ≥ 6', value: srqPerlu, caption: `${srqPersen.toFixed(1)}% perlu tindak lanjut`, color: '#E74C3C' },
          { label: 'DASS-21 Terisi', value: dassTerisi, caption: 'responden', color: '#F39C12' },
          { label: 'DASS-21 Perlu Perhatian', value: dassPerlu, caption: 'keparahan sedang ke atas', color: '#F39C12' },
        ].map((kpi) => (
          <div key={kpi.label} className="card" style={{ padding: '8px 12px', minHeight: 0 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{kpi.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.15, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{kpi.caption}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridTemplateRows: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 8, flex: 1, minHeight: 0 }}>
        <ChartCard title="SRQ-20" sub="Ambang ≥ 6 = perlu tindak lanjut" accent="#E74C3C" empty={!i.srq20.terisi}><canvas ref={srqRef} /></ChartCard>
        <ChartCard title="DASS-21" sub="Keparahan terburuk dari depresi, ansietas, stres" accent="#F39C12" empty={!i.dass21.terisi}><canvas ref={dassRef} /></ChartCard>
        <ChartCard title="Rata-rata Skor DASS-21" sub="Depresi · ansietas · stres (skala 0–21)" accent="#3498DB" empty={!i.dass21.terisi}><canvas ref={subskalaRef} /></ChartCard>
        <ChartCard title="Sebaran SRQ-20 per Site" sub="Responden &amp; kasus perlu tindak lanjut" accent="#2E86DE" empty={!perSite.length}><canvas ref={siteRef} /></ChartCard>
      </div>

      <div style={{ fontSize: 9.5, color: 'var(--muted-foreground)', lineHeight: 1.5, flexShrink: 0 }}>
        Catatan: SRQ-20 dan DASS-21 adalah instrumen skrining klinis per individu — diagnosis tetap ditetapkan dokter.
        Faktor psikologi lingkungan kerja (SDS-30) ada di Data Entry → Psikologi Lingkungan Kerja.
      </div>
    </div>
  );
}
