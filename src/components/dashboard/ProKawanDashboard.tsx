'use client';

// Dashboard > Layanan Kuratif > ProKawan
//
// Monitoring pelaksanaan ProKawan (BG/QSHE/INK/016) bagi karyawan Zona Kuning
// dan Zona Merah. Sumber data: /api/prokawan yang membaca zona risiko terakhir
// dari MCU (zona_risiko) dan menghitung jalur + jadwal kontrolnya.
//
// PENTING (kerahasiaan, INK 016 poin 4.7): dashboard ini agregat dan TIDAK
// menampilkan diagnosis. Hanya zona, jalur, jadwal, dan status kelayakan kerja.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  registerables,
  type ChartOptions,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { RefreshCw, Search, AlertTriangle } from 'lucide-react';

import { authFetch } from '@/lib/api-client';
import {
  BAR_LAYOUT,
  STANDAR_ANIMASI_BAR,
  STANDAR_ANIMASI_DONUT,
  PALET_BAR,
  skalaBar,
} from '@/lib/chart-standard';
import {
  JALUR_LABEL,
  JALUR_DESKRIPSI,
  STATUS_LABEL,
  STATUS_WARNA,
  ringkasProKawan,
  type JalurProKawan,
  type PesertaProKawan,
  type StatusKepatuhan,
} from '@/lib/prokawan';

ChartJS.register(...registerables, ChartDataLabels);

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

function useIsDark() {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains('dark'));
    sync();
    const ob = new MutationObserver(sync);
    ob.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => ob.disconnect();
  }, []);
  return isDark;
}

export default function ProKawanDashboard() {
  const [peserta, setPeserta] = useState<PesertaProKawan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterZona, setFilterZona] = useState<'semua' | 'Kuning' | 'Merah'>('semua');
  const [filterSite, setFilterSite] = useState('semua');
  const isDark = useIsDark();

  const zonaRef = useRef<HTMLCanvasElement | null>(null);
  const jalurRef = useRef<HTMLCanvasElement | null>(null);
  const statusRef = useRef<HTMLCanvasElement | null>(null);
  const siteRef = useRef<HTMLCanvasElement | null>(null);
  const charts = useRef<Record<string, ChartJS | null>>({});
  const lastSignature = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await authFetch('/api/prokawan');
      setPeserta(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data ProKawan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sites = useMemo(
    () => [...new Set(peserta.map((p) => p.site).filter(Boolean))].sort(),
    [peserta],
  );

  const filtered = useMemo(() => peserta.filter((p) => {
    if (filterZona !== 'semua' && p.zona !== filterZona) return false;
    if (filterSite !== 'semua' && p.site !== filterSite) return false;
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return `${p.nama} ${p.nik} ${p.department ?? ''} ${p.site}`.toLowerCase().includes(term);
  }), [peserta, filterZona, filterSite, search]);

  const ringkas = useMemo(() => ringkasProKawan(filtered), [filtered]);

  /* ── Charts ─────────────────────────────────────────────── */
  useEffect(() => {
    const text = isDark ? '#F9FAFB' : '#111827';
    const grid = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
    const cardBg = isDark ? '#1b1b1b' : '#ffffff';
    const signature = JSON.stringify([ringkas.total, ringkas.byZona, ringkas.byJalur, ringkas.byStatus, ringkas.bySite]);
    const shouldAnimate = lastSignature.current !== signature || !charts.current.zona;
    lastSignature.current = signature;
    const anim = shouldAnimate ? STANDAR_ANIMASI_BAR : (false as const);
    const donutAnim = shouldAnimate ? STANDAR_ANIMASI_DONUT : (false as const);

    const draw = (key: string, el: HTMLCanvasElement | null, make: () => ChartJS) => {
      if (!el) return;
      charts.current[key]?.destroy();
      charts.current[key] = make();
    };

    // 1. Komposisi zona
    const zonaTotal = ringkas.byZona.Kuning + ringkas.byZona.Merah;
    draw('zona', zonaRef.current, () => new ChartJS(zonaRef.current!, {
      type: 'doughnut',
      data: {
        labels: ['Zona Kuning', 'Zona Merah'],
        datasets: [{
          data: [ringkas.byZona.Kuning, ringkas.byZona.Merah],
          backgroundColor: ['#FFD400', '#FF2D2D'],
          borderColor: cardBg,
          borderWidth: 2,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: donutAnim,
        cutout: '62%', radius: '82%', rotation: 0, circumference: 360,
        plugins: {
          legend: { position: 'right', labels: { color: text, font: { size: 10, weight: 'bold', family: FONT }, boxWidth: 12, usePointStyle: true } },
          tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed}${zonaTotal ? ` (${(c.parsed / zonaTotal * 100).toFixed(1)}%)` : ''}` } },
          datalabels: {
            display: (c) => Number(c.dataset.data[c.dataIndex]) > 0,
            color: '#3a2a00',
            font: { size: 10, weight: 'bold' as const, family: FONT },
            formatter: (v: number) => (zonaTotal ? `${(v / zonaTotal * 100).toFixed(0)}%` : ''),
          },
        },
      } as ChartOptions<'doughnut'>,
      plugins: [{
        id: 'pk-zona-center',
        afterDraw: (chart) => {
          const { left, right, top, bottom } = chart.chartArea;
          const ctx = chart.ctx;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = text;
          ctx.font = `bold 20px ${FONT}`;
          ctx.fillText(String(zonaTotal), (left + right) / 2, (top + bottom) / 2 - 6);
          ctx.globalAlpha = 0.6;
          ctx.font = `600 8.5px ${FONT}`;
          ctx.fillText('PESERTA', (left + right) / 2, (top + bottom) / 2 + 12);
          ctx.restore();
        },
      }],
    }));

    // 2. Jalur pengendalian
    const jalurKeys = Object.keys(ringkas.byJalur) as JalurProKawan[];
    draw('jalur', jalurRef.current, () => new ChartJS(jalurRef.current!, {
      type: 'bar',
      data: {
        labels: jalurKeys.map((k) => JALUR_LABEL[k]),
        datasets: [{
          data: jalurKeys.map((k) => ringkas.byJalur[k]),
          backgroundColor: jalurKeys.map((_, i) => PALET_BAR[i % PALET_BAR.length]),
          borderRadius: 4,
          ...BAR_LAYOUT,
        }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: anim,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => ` ${c.parsed.x} peserta` } },
          datalabels: {
            color: text, anchor: 'end', align: 'right', clamp: true, clip: false,
            font: { size: 10, weight: 'bold' as const, family: FONT },
            formatter: (v: number) => (v ? String(v) : ''),
          },
        },
        scales: skalaBar({
          horizontal: true, textColor: text, gridColor: grid,
          categoryTitle: 'Jalur', valueTitle: 'Jumlah peserta',
        }),
      } as ChartOptions<'bar'>,
    }));

    // 3. Status kepatuhan
    const statusKeys: StatusKepatuhan[] = ['sesuai-jadwal', 'akan-datang', 'terlambat', 'belum-kontrol', 'selesai'];
    draw('status', statusRef.current, () => new ChartJS(statusRef.current!, {
      type: 'bar',
      data: {
        labels: statusKeys.map((k) => STATUS_LABEL[k]),
        datasets: [{
          data: statusKeys.map((k) => ringkas.byStatus[k]),
          backgroundColor: statusKeys.map((k) => STATUS_WARNA[k]),
          borderRadius: 4,
          ...BAR_LAYOUT,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: anim,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => ` ${c.parsed.y} peserta` } },
          datalabels: {
            color: text, anchor: 'end', align: 'top', clamp: true, clip: false,
            font: { size: 10, weight: 'bold' as const, family: FONT },
            formatter: (v: number) => (v ? String(v) : ''),
          },
        },
        scales: skalaBar({
          horizontal: false, textColor: text, gridColor: grid,
          categoryTitle: 'Status kepatuhan', valueTitle: 'Jumlah peserta',
        }),
      } as ChartOptions<'bar'>,
    }));

    // 4. Peserta per site
    const siteRows = ringkas.bySite.slice(0, 10);
    draw('site', siteRef.current, () => new ChartJS(siteRef.current!, {
      type: 'bar',
      data: {
        labels: siteRows.length ? siteRows.map(([s]) => s) : ['Belum ada data'],
        datasets: [{
          data: siteRows.length ? siteRows.map(([, v]) => v) : [0],
          backgroundColor: siteRows.map((_, i) => PALET_BAR[i % PALET_BAR.length]),
          borderRadius: 4,
          ...BAR_LAYOUT,
        }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: anim,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => ` ${c.parsed.x} peserta` } },
          datalabels: {
            color: text, anchor: 'end', align: 'right', clamp: true, clip: false,
            font: { size: 10, weight: 'bold' as const, family: FONT },
            formatter: (v: number) => (v ? String(v) : ''),
          },
        },
        scales: skalaBar({
          horizontal: true, textColor: text, gridColor: grid,
          categoryTitle: 'Site', valueTitle: 'Jumlah peserta',
        }),
      } as ChartOptions<'bar'>,
    }));

    return () => {
      Object.values(charts.current).forEach((c) => c?.destroy());
      charts.current = {};
    };
  }, [ringkas, isDark]);

  const th: React.CSSProperties = {
    padding: '6px 8px', borderBottom: '1px solid var(--border)', fontSize: 9.5,
    textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--muted-foreground)', fontWeight: 700,
    textAlign: 'left', whiteSpace: 'nowrap',
  };
  const td: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid var(--border)', fontSize: 11.5 };

  return (
    <div className="dashboard" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8, padding: 10, overflow: 'hidden' }}>

      {/* Filter bar */}
      <div className="kunjungan-filter-bar" style={{ flexShrink: 0, flexWrap: 'wrap' }}>
        <select className="admin-filter-select" value={filterZona} onChange={(e) => setFilterZona(e.target.value as typeof filterZona)}>
          <option value="semua">Semua Zona</option>
          <option value="Kuning">Zona Kuning</option>
          <option value="Merah">Zona Merah</option>
        </select>
        <select className="admin-filter-select" value={filterSite} onChange={(e) => setFilterSite(e.target.value)}>
          <option value="semua">Semua Site</option>
          {sites.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--background)' }}>
          <Search size={13} color="var(--muted-foreground)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama / NIK / departemen"
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 11, color: 'var(--foreground)', width: 190 }}
          />
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="mcu-dashboard-refresh"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
        <span className="kunjungan-total-right" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span>Peserta ProKawan <b>{ringkas.total}</b></span>
          <span>Kuning <b style={{ color: '#C99A00' }}>{ringkas.byZona.Kuning}</b></span>
          <span>Merah <b style={{ color: '#FF2D2D' }}>{ringkas.byZona.Merah}</b></span>
          <span>Terlambat <b style={{ color: ringkas.byStatus.terlambat ? '#FF2D2D' : 'inherit' }}>{ringkas.byStatus.terlambat}</b></span>
          <span>Kepatuhan <b>{ringkas.tingkatKepatuhan.toFixed(0)}%</b></span>
        </span>
      </div>

      {error && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 11.5, flexShrink: 0 }}>
          {error}
        </div>
      )}

      {/* Charts 2×2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, flexShrink: 0, height: '38%', minHeight: 190 }}>
        {[
          { key: 'zona', title: 'Komposisi Zona', sub: 'Peserta ProKawan per zona risiko', ref: zonaRef },
          { key: 'jalur', title: 'Jalur Pengendalian', sub: 'INK/016 poin 4.2', ref: jalurRef },
          { key: 'status', title: 'Status Kepatuhan', sub: 'Kontrol & pemantauan', ref: statusRef },
          { key: 'site', title: 'Peserta per Site', sub: '10 site terbanyak', ref: siteRef },
        ].map((c) => (
          <div key={c.key} className="card" style={{ padding: '8px 10px', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="card-head" style={{ flexShrink: 0 }}>
              <span style={{ width: 3, height: 20, borderRadius: 2, background: '#ff4d00', flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontSize: 12 }}>{c.title}</h2>
                <p style={{ fontSize: 9.5 }}>{c.sub}</p>
              </div>
            </div>
            <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
              <canvas ref={c.ref} />
            </div>
          </div>
        ))}
      </div>

      {/* Tabel peserta */}
      <div className="card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '8px 10px' }}>
        <div className="card-head" style={{ flexShrink: 0 }}>
          <span style={{ width: 3, height: 20, borderRadius: 2, background: '#FF2D2D', flexShrink: 0 }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ fontSize: 12 }}>Daftar Peserta ProKawan</h2>
            <p style={{ fontSize: 9.5 }}>
              Atasan hanya menerima status kelayakan kerja &amp; pembatasan kerja — tanpa skor maupun diagnosis (INK/016 poin 4.7.3 huruf e)
            </p>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, background: 'var(--card)', zIndex: 1 }}>
                <th style={th}>Karyawan</th>
                <th style={th}>Site / Departemen</th>
                <th style={th}>Zona</th>
                <th style={th}>Parameter Pemicu</th>
                <th style={th}>Jalur</th>
                <th style={th}>Jatuh Tempo</th>
                <th style={th}>Status</th>
                <th style={th}>Kelayakan Kerja</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={`${p.nik}-${i}`}>
                  <td style={td}>
                    <div style={{ fontWeight: 700 }}>{p.nama}</div>
                    <div style={{ fontSize: 9.5, color: 'var(--muted-foreground)' }}>{p.nik}</div>
                  </td>
                  <td style={{ ...td, fontSize: 10.5 }}>
                    {p.site}
                    <div style={{ fontSize: 9.5, color: 'var(--muted-foreground)' }}>{p.department ?? '—'}</div>
                  </td>
                  <td style={td}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 800,
                      background: p.zona === 'Merah' ? 'rgba(255,45,45,0.12)' : 'rgba(255,212,0,0.18)',
                      color: p.zona === 'Merah' ? '#FF2D2D' : '#9a6b00',
                    }}>
                      {p.zona}
                    </span>
                  </td>
                  <td style={{ ...td, fontSize: 10, maxWidth: 260 }}>
                    {p.triggers.slice(0, 2).map((t, k) => (
                      <div key={k} style={{ color: 'var(--muted-foreground)' }} title={t}>
                        {t.length > 62 ? `${t.slice(0, 60)}…` : t}
                      </div>
                    ))}
                    {p.triggers.length > 2 && (
                      <div style={{ fontSize: 9, color: 'var(--muted-foreground)' }}>+{p.triggers.length - 2} parameter lain</div>
                    )}
                  </td>
                  <td style={{ ...td, fontSize: 10.5 }} title={JALUR_DESKRIPSI[p.jalur]}>
                    {JALUR_LABEL[p.jalur]}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 10.5 }}>{p.jatuhTempo ?? '—'}</td>
                  <td style={td}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: STATUS_WARNA[p.status] }}>
                      {p.status === 'terlambat' && <AlertTriangle size={11} style={{ verticalAlign: -1, marginRight: 3 }} />}
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td style={{ ...td, fontSize: 10.5 }}>{p.kelayakanKerja ?? '—'}</td>
                </tr>
              ))}
              {!filtered.length && !loading && (
                <tr>
                  <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
                    Belum ada karyawan pada Zona Kuning atau Zona Merah.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
