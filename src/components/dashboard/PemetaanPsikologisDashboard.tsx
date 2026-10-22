'use client';
// Dashboard > Pemetaan Risiko Psikologis (SDS-30, Permenaker 5/2018).
// Agregasi tingkat DEPARTEMEN: rata-rata skor 6 indikator per departemen.
// Ambang skor mengikuti dokumen; ambang jumlah responden = kebijakan internal.
import { useEffect, useRef, useState } from 'react';
import { Chart as ChartJS, registerables, type ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { authFetch } from '@/lib/api-client';
import { SITES } from '@/components/administrator/hc-ergo-ui';
import { BAR_LAYOUT, STANDAR_ANIMASI_BAR, STANDAR_ANIMASI_DONUT } from '@/lib/chart-standard';

ChartJS.register(...registerables, ChartDataLabels);

type D = Record<string, any>;
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const GREEN = 'rgba(0, 184, 148, 0.72)';
const AMBER = 'rgba(243, 156, 18, 0.72)';
const RED = 'rgba(231, 76, 60, 0.72)';
const STEEL = 'rgba(119, 136, 153, 0.45)';

const TINGKAT_COLOR: Record<string, string> = { RINGAN: GREEN, SEDANG: AMBER, BERAT: RED };
const TINGKAT_TEXT: Record<string, string> = { RINGAN: '#00895f', SEDANG: '#b06a00', BERAT: '#c0392b' };

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
        {/* Canvas selalu dirender agar ref tidak null saat data datang belakangan. */}
        <div style={{ position: 'absolute', inset: 0, visibility: empty ? 'hidden' : 'visible' }}>{children}</div>
        {empty && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--muted-foreground)' }}>
            <span style={{ width: 38, height: 38, borderRadius: '50%', border: `2px dashed ${accent}55`, display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 800, color: `${accent}99` }}>–</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, textAlign: 'center', padding: '0 12px' }}>Data belum memadai</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Gaya kecil seragam untuk input tanggal di bar filter. */
const dateStyle: React.CSSProperties = {
  height: 28, padding: '0 8px', borderRadius: 7, border: '1px solid var(--border)',
  background: 'var(--background)', color: 'var(--foreground)', fontSize: 10,
  fontFamily: 'inherit', cursor: 'pointer', boxSizing: 'border-box',
};

export default function PemetaanPsikologisDashboard() {
  const [d, setD] = useState<D | null>(null);
  const [site, setSite] = useState('');
  const [minResponden, setMinResponden] = useState(20);
  const [kelompok, setKelompok] = useState<'departemen' | 'jabatan'>('departemen');
  const [baselineDari, setBaselineDari] = useState('');
  const [baselineSampai, setBaselineSampai] = useState('');
  const [err, setErr] = useState('');
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  const heatRef = useRef<HTMLCanvasElement | null>(null);
  const rankRef = useRef<HTMLCanvasElement | null>(null);
  const distribRef = useRef<HTMLCanvasElement | null>(null);
  const charts = useRef<Record<string, ChartJS | null>>({});
  const lastSignature = useRef<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setIsDark(document.documentElement.classList.contains('dark')), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    let alive = true;
    authFetch(`/api/mental-health/pemetaan?site=${encodeURIComponent(site)}&minResponden=${minResponden}&kelompok=${kelompok}&baselineDari=${encodeURIComponent(baselineDari)}&baselineSampai=${encodeURIComponent(baselineSampai)}`)
      .then((r) => { if (alive) { setD(r.data); setErr(''); } })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : 'Gagal memuat pemetaan'); });
    return () => { alive = false; };
  }, [site, minResponden, kelompok, baselineDari, baselineSampai]);

  useEffect(() => {
    if (!d) return;
    const text = isDark ? '#F9FAFB' : '#111827';
    const grid = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
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

    const memadai = (d.kelompokData || []).filter((j: D) => j.memadai);

    // 1. Heat map: departemen × indikator, warna = tingkat risiko.
    //    Dijadikan bar bertumpuk (6 seri) agar tetap terbaca tanpa tabel.
    const indikator = (d.indikator || []) as D[];
    draw('heat', heatRef.current, () => new ChartJS(heatRef.current!, {
      type: 'bar',
      data: {
        labels: memadai.map((j: D) => j.nama),
        datasets: [
          { label: 'Ringan', data: memadai.map((j: D) => j.jumlahPerTingkat.RINGAN), backgroundColor: GREEN, borderRadius: 2, maxBarThickness: BAR_LAYOUT.maxBarThickness, stack: 's' },
          { label: 'Sedang', data: memadai.map((j: D) => j.jumlahPerTingkat.SEDANG), backgroundColor: AMBER, borderRadius: 2, maxBarThickness: BAR_LAYOUT.maxBarThickness, stack: 's' },
          { label: 'Berat', data: memadai.map((j: D) => j.jumlahPerTingkat.BERAT), backgroundColor: RED, borderRadius: 2, maxBarThickness: BAR_LAYOUT.maxBarThickness, stack: 's' },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: anim, indexAxis: 'y',
        plugins: {
          legend: { position: 'bottom', labels: { color: text, font: { size: 9.5, weight: 'bold' as const, family: FONT }, boxWidth: 10, usePointStyle: true } },
          tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.x} indikator` } },
          datalabels: { display: false },
        },
        scales: {
          x: { stacked: true, beginAtZero: true, max: indikator.length, grid: { color: grid }, ticks: { color: text, font: { size: 9, family: FONT }, precision: 0 } },
          y: { stacked: true, grid: { display: false }, ticks: { color: text, font: { size: 9.5, family: FONT }, autoSkip: false }, title: { display: true, text: 'Departemen', color: text, font: { size: 9, weight: 'bold' as const, family: FONT } } },
        },
      } as ChartOptions<'bar'>,
    }));

    // 2. Rata-rata skor indikator per departemen — ditempatkan di kartu terpisah
    //    lewat tabel; di sini dipakai untuk donut komposisi risiko.
    const totals = memadai.reduce((acc: Record<string, number>, j: D) => {
      acc.RINGAN = (acc.RINGAN || 0) + j.jumlahPerTingkat.RINGAN;
      acc.SEDANG = (acc.SEDANG || 0) + j.jumlahPerTingkat.SEDANG;
      acc.BERAT = (acc.BERAT || 0) + j.jumlahPerTingkat.BERAT;
      return acc;
    }, {});
    const total = (totals.RINGAN || 0) + (totals.SEDANG || 0) + (totals.BERAT || 0);
    draw('distrib', distribRef.current, () => new ChartJS(distribRef.current!, {
      type: 'doughnut',
      data: {
        labels: ['Ringan', 'Sedang', 'Berat'],
        datasets: [{
          data: [totals.RINGAN || 0, totals.SEDANG || 0, totals.BERAT || 0],
          backgroundColor: [GREEN, AMBER, RED],
          borderColor: isDark ? '#1b1b1b' : '#fff', borderWidth: 2, hoverOffset: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: donutAnim, cutout: '62%', radius: '82%', rotation: 0, circumference: 360,
        plugins: {
          legend: { position: 'right', labels: { color: text, font: { size: 9.5, weight: 'bold' as const, family: FONT }, boxWidth: 10, usePointStyle: true } },
          tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed} indikator${total ? ` (${(c.parsed / total * 100).toFixed(1)}%)` : ''}` } },
          datalabels: {
            display: (c) => Number(c.dataset.data[c.dataIndex]) > 0,
            color: '#fff', font: { size: 10, weight: 'bold' as const, family: FONT },
            formatter: (v: number) => (total ? `${(v / total * 100).toFixed(0)}%` : ''),
          },
        },
      } as ChartOptions<'doughnut'>,
      plugins: [{
        id: 'peta-center',
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
          ctx.fillText(String(memadai.length), cx, cy - 6);
          ctx.globalAlpha = 0.6;
          ctx.font = `600 8.5px ${FONT}`;
          ctx.fillText('DEPARTEMEN', cx, cy + 12);
          ctx.restore();
        },
      }],
    }));

    // 3. Peringkat prioritas: Rata-rata indikator tertinggi.
    draw('rank', rankRef.current, () => new ChartJS(rankRef.current!, {
      type: 'bar',
      data: {
        labels: memadai.map((j: D) => j.nama),
        datasets: [{
          data: memadai.map((j: D) => j.tertinggi.rataRata),
          backgroundColor: memadai.map((j: D) => (j.tingkat ? TINGKAT_COLOR[j.tingkat] : STEEL)),
          borderRadius: 4, maxBarThickness: BAR_LAYOUT.maxBarThickness,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: anim, indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: {
            title: (items) => memadai[items[0].dataIndex].departemen,
            label: (c) => {
              const j = memadai[c.dataIndex];
              return [` ${j.tertinggi.title}: ${j.tertinggi.rataRata}`, ` Tingkat: ${j.tingkat}`, ` Responden: ${j.responden}`];
            },
          } },
          datalabels: {
            color: text, anchor: 'end', align: 'right', clamp: true, clip: false,
            font: { size: 9.5, weight: 'bold' as const, family: FONT },
            formatter: (v: number) => v.toFixed(1),
          },
        },
        scales: {
          x: { beginAtZero: true, max: 35, grid: { color: grid }, ticks: { color: text, font: { size: 9, family: FONT } }, title: { display: true, text: 'Rata-rata skor indikator', color: text, font: { size: 9, weight: 'bold' as const, family: FONT } } },
          y: { grid: { display: false }, ticks: { color: text, font: { size: 9.5, family: FONT }, autoSkip: false }, title: { display: true, text: 'Departemen', color: text, font: { size: 9, weight: 'bold' as const, family: FONT } } },
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
    <div className="bm-loading is-card" role="status" aria-live="polite" aria-label="Memuat pemetaan risiko psikologis">
      <div className="bm-loading-spinner"><div className="bm-loading-ring" aria-hidden="true" /><img src="/BM.png" alt="" className="bm-loading-logo" aria-hidden="true" /></div>
      <p className="bm-loading-label">Memuat pemetaan risiko psikologis…</p>
    </div>
  );

  const departemen = (d.kelompokData || []) as D[];
  const memadai = departemen.filter(j => j.memadai);
  const belum = departemen.filter(j => !j.memadai);
  const indikator = (d.indikator || []) as D[];

  return (
    <div className="dashboard" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="kunjungan-filter-bar" style={{ flexShrink: 0, flexWrap: 'wrap' }}>
        <select className="admin-filter-select" value={site} onChange={(e) => setSite(e.target.value)}><option value="">All Site</option>{SITES.map((s) => <option key={s}>{s}</option>)}</select>
        <select className="admin-filter-select" value={kelompok} onChange={(e) => setKelompok(e.target.value as 'departemen' | 'jabatan')} title="Kelompokkan hasil per">
          <option value="departemen">Per Departemen</option>
          <option value="jabatan">Per Jabatan</option>
        </select>
        <select className="admin-filter-select" value={minResponden} onChange={(e) => setMinResponden(Number(e.target.value))} title="Ambang minimum responden per kelompok">
          {[10, 15, 20, 25, 30].map(n => <option key={n} value={n}>Min. {n} responden</option>)}
        </select>
        {/* Baseline: periode pembanding. Kosong = tanpa pembanding. */}
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }} title="Periode pembanding untuk melihat perubahan skor">Baseline</span>
        <input type="date" value={baselineDari} onChange={(e) => setBaselineDari(e.target.value)} title="Baseline — tanggal mulai"
          style={dateStyle} />
        <span style={{ fontSize: 10, color: 'var(--muted-foreground)', fontWeight: 700 }}>s.d.</span>
        <input type="date" value={baselineSampai} onChange={(e) => setBaselineSampai(e.target.value)} title="Baseline — tanggal akhir"
          style={dateStyle} />
        {(baselineDari || baselineSampai) && (
          <button type="button" onClick={() => { setBaselineDari(''); setBaselineSampai(''); }}
            style={{ height: 28, padding: '0 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 10, cursor: 'pointer' }}>
            Hapus baseline
          </button>
        )}
        <span className="kunjungan-total-right" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span>Pemetaan Risiko Psikologis · per {kelompok === 'jabatan' ? 'Jabatan' : 'Departemen'}</span>
          <span>Responden lengkap <b>{d.totalRespondenLengkap}</b></span>
          <span>Kelompok dinilai <b>{d.jumlahKelompokMemadai}</b>/{d.jumlahKelompok}</span>
          <span>Risiko berat <b style={{ color: d.risikoBerat ? '#E74C3C' : 'inherit' }}>{d.risikoBerat}</b></span>
          <span>Risiko sedang <b style={{ color: d.risikoSedang ? '#b06a00' : 'inherit' }}>{d.risikoSedang}</b></span>
          {d.baseline && <span style={{ color: '#8E44AD', fontWeight: 700 }}>Baseline: {d.baseline.dari} → {d.baseline.sampai}</span>}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, flex: 1, minHeight: 0 }}>
        <ChartCard title="Komposisi Indikator" sub="6 indikator × 5 item · warna = tingkat risiko" accent="#E74C3C"
          empty={!memadai.length}>
          <canvas ref={heatRef} />
        </ChartCard>
        <ChartCard title="Sebaran Indikator" sub={`Seluruh departemen yang memenuhi min. ${d.minResponden} responden`} accent="#8E44AD"
          empty={!memadai.length}>
          <canvas ref={distribRef} />
        </ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1, minHeight: 0 }}>
        <ChartCard title="Prioritas Intervensi" sub="Rata-rata indikator tertinggi (skala 5–35)" accent="#ff4d00"
          empty={!memadai.length}>
          <canvas ref={rankRef} />
        </ChartCard>

        <div className="card" style={{ padding: '8px 10px', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="card-head" style={{ flexShrink: 0 }}>
            <span style={{ width: 4, height: 20, borderRadius: 2, background: '#778899', flexShrink: 0 }} />
            <div><h2>Rincian</h2><p>{memadai.length} departemen · skor rata-rata per indikator</p></div>
          </div>
          <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, background: 'var(--card)', zIndex: 1 }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid var(--border)', fontSize: 9, textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Departemen</th>
                  <th style={{ textAlign: 'center', padding: '4px 6px', borderBottom: '1px solid var(--border)', fontSize: 9, color: 'var(--muted-foreground)' }}>Resp.</th>
                  {indikator.map(i => (
                    <th key={i.id} title={i.title} style={{ textAlign: 'center', padding: '4px 4px', borderBottom: '1px solid var(--border)', fontSize: 8, color: 'var(--muted-foreground)' }}>
                      {String(i.title).split(' ')[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {memadai.map((j) => (
                  <tr key={j.nama}>
                    <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{j.nama}</td>
                    <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>{j.responden}</td>
                    {(j.indikator as D[]).map((ind) => {
                      const delta = j.delta ? Number(j.delta[ind.id]) : null;
                      return (
                        <td key={ind.id} title={`${ind.title}: ${ind.rataRata} (${ind.tingkat})${delta !== null ? ` · baseline ${j.baselineRataRata?.[ind.id]} → delta ${delta > 0 ? '+' : ''}${delta}` : ''}`}
                          style={{ padding: '4px 4px', borderBottom: '1px solid var(--border)', textAlign: 'center', fontWeight: 700, color: ind.tingkat ? TINGKAT_TEXT[ind.tingkat] : undefined }}>
                          {ind.rataRata}
                          {delta !== null && delta !== 0 && (
                            <div style={{ fontSize: 8, fontWeight: 700, color: delta > 0 ? '#c0392b' : '#00895f' }}>
                              {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {!memadai.length && <tr><td colSpan={2 + indikator.length} style={{ padding: 16, textAlign: 'center', color: 'var(--muted-foreground)' }}>Belum ada kelompok dengan responden memadai.</td></tr>}
              </tbody>
            </table>
          </div>
          {!!belum.length && (
            <div style={{ flexShrink: 0, fontSize: 9, color: 'var(--muted-foreground)', borderTop: '1px solid var(--border)', paddingTop: 4, marginTop: 4, lineHeight: 1.4 }}>
              <b>Data belum memadai</b> (&lt; {d.minResponden} responden, tidak dinilai): {belum.map(j => `${j.nama} (${j.responden})`).join(', ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
