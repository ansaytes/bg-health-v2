'use client';
// Dashboard > Ergonomi. Data dari /api/ergo?resource=dashboard (12 bulan terakhir, survei berstatus Disetujui).
// Mengikuti template Monitoring MCU & Kunjungan Berobat: top bar filter + KPI ringkas, 2 baris kartu (.mcu-grid-3),
// campuran donut, bar, tren & tabel via MCUChartCard / MCUChart agar legend & label tidak pernah terpotong.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChartOptions } from 'chart.js';
import { Activity } from 'lucide-react';

import { ChartJS } from '@/lib/chart-register';
import { authFetch } from '@/lib/api-client';
import { KLAS_COLOR, type Klasifikasi } from '@/lib/hc-ergo';
import { Chip, fmtDate, tableStyle, tdStyle, thStyle } from '@/components/administrator/hc-ergo-ui';
import { useSites } from '@/lib/site-list';
import { useSiteLock } from '@/lib/auth-context';
import { BAR_LAYOUT, STANDAR_ANIMASI_BAR, gradientBatangArray, skalaBar, useAnimationReady } from '@/lib/chart-standard';
import PageLoading from '@/components/ui/page-loading';
import { MCUChart, MCUChartCard, MCURefreshButton } from '@/components/dashboard/MCUDashboardShared';

type D = Record<string, any>;
const KLAS: Klasifikasi[] = ['RENDAH', 'SEDANG', 'TINGGI', 'SANGAT_TINGGI'];
const KLAS_SHORT = ['Rendah', 'Sedang', 'Tinggi', 'Sangat Tinggi'];
const METODE = ['RULA', 'ROSA', 'WERA'] as const;
const METODE_COLORS = ['#2E86DE', '#00B894', '#F5A623'];
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export default function ErgonomiDashboard() {
  const { sites: daftarSite } = useSites();
  const [d, setD] = useState<D | null>(null);
  const { site, setSite, isLocked: isSiteLocked, lockedSite } = useSiteLock('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );

  const trendRef = useRef<HTMLCanvasElement | null>(null);
  const patuhRef = useRef<HTMLCanvasElement | null>(null);
  const charts = useRef<Record<string, ChartJS | null>>({});

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDark(root.classList.contains('dark'));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const r = await authFetch(`/api/ergo?resource=dashboard&site=${encodeURIComponent(site)}`);
      setD(r.data as D);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat dashboard ergonomi');
    } finally {
      setLoading(false);
    }
  }, [site]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const animReady = useAnimationReady([d]);

  useEffect(() => {
    if (!d || !animReady) return;
    const text = isDark ? '#F9FAFB' : '#111827';
    const grid = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const legend = {
      position: 'bottom' as const,
      labels: { color: text, font: { size: 10, weight: 'bold' as const, family: FONT }, boxWidth: 10, usePointStyle: true, padding: 8 },
    };

    const draw = (key: string, el: HTMLCanvasElement | null, make: () => ChartJS) => {
      if (!el) return;
      charts.current[key]?.destroy();
      charts.current[key] = make();
    };

    // Tren survei per bulan (bar + garis perlu PICA)
    const trend = (d.trend || []) as D[];
    const trendTotal = trend.reduce((s, t) => s + Number(t.total || 0), 0);
    if (trendTotal > 0 && trendRef.current) {
      const trendLabels = trend.map((t) => BLN[Number(String(t.bulan).slice(5)) - 1] ?? '-');
      draw('trend', trendRef.current, () => new ChartJS(trendRef.current!, {
        data: {
          labels: trendLabels,
          datasets: [
            {
              type: 'bar' as const,
              label: 'Total Survei',
              data: trend.map((t) => Number(t.total || 0)),
              backgroundColor: 'rgba(46,134,222,0.8)',
              borderRadius: 4,
              ...BAR_LAYOUT,
              order: 2,
            },
            {
              type: 'line' as const,
              label: 'Perlu PICA',
              data: trend.map((t) => Number(t.sedangKeAtas || 0)),
              borderColor: '#E63946',
              backgroundColor: '#E63946',
              tension: 0.35,
              pointRadius: 3,
              borderWidth: 2,
              order: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: STANDAR_ANIMASI_BAR,
          plugins: { legend, datalabels: { display: false } },
          scales: {
            x: { grid: { display: false }, border: { display: false }, ticks: { color: text, font: { size: 9, family: FONT }, autoSkip: false } },
            y: { beginAtZero: true, grace: '15%', grid: { color: grid }, border: { display: false }, ticks: { color: text, font: { size: 9, family: FONT }, precision: 0 } },
          },
        } as ChartOptions,
      }));
    } else {
      charts.current.trend?.destroy();
      charts.current.trend = null;
    }

    // Kepatuhan frekuensi survei per site (internal & pihak ketiga)
    const patuh = (d.kepatuhan || []) as D[];
    const patuhTotal = patuh.reduce((s, k) => s + Number(k.internalBulanIni || 0) + Number(k.pihakKetiga12Bulan || 0), 0);
    if (patuhTotal > 0 && patuhRef.current) {
      const patuhLabels = patuh.map((k) => String(k.site));
      draw('patuh', patuhRef.current, () => new ChartJS(patuhRef.current!, {
        type: 'bar',
        data: {
          labels: patuhLabels,
          datasets: [
            {
              label: 'Internal Bln Ini',
              data: patuh.map((k) => Number(k.internalBulanIni || 0)),
              backgroundColor: gradientBatangArray(['#2E86DE'], true) as never,
              borderRadius: 4,
              ...BAR_LAYOUT,
            },
            {
              label: 'Pihak Ketiga 12 Bln',
              data: patuh.map((k) => Number(k.pihakKetiga12Bulan || 0)),
              backgroundColor: gradientBatangArray(['#00B894'], true) as never,
              borderRadius: 4,
              ...BAR_LAYOUT,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: STANDAR_ANIMASI_BAR,
          indexAxis: 'y',
          plugins: { legend, datalabels: { display: false } },
          scales: skalaBar({
            horizontal: true,
            textColor: text,
            gridColor: grid,
            fontFamily: FONT,
            labelOf: (idx) => patuhLabels[idx] ?? '',
          }),
        } as ChartOptions<'bar'>,
      }));
    } else {
      charts.current.patuh?.destroy();
      charts.current.patuh = null;
    }

    return () => {
      Object.values(charts.current).forEach((c) => c?.destroy());
      charts.current = {};
    };
  }, [d, isDark, animReady]);

  if (loading && !d) return <PageLoading label="Memuat Ergonomi" />;

  if (!d) {
    return (
      <div className="dashboard mcu-live-dashboard" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 12 }}>
          {err || 'Data Ergonomi tidak tersedia.'}
        </div>
      </div>
    );
  }

  const totKlas = KLAS.map((k) => METODE.reduce((s, m) => s + Number(d.byKlas?.[m]?.[k] ?? 0), 0));
  const grandTotal = totKlas.reduce((s, v) => s + v, 0);

  const metodeVals = METODE.map((m) => Number(d.byMetode?.[m] ?? 0));
  const metodeTotal = metodeVals.reduce((s, v) => s + v, 0);

  const rk = d.rekomendasi || {};
  const rekomVals = [Number(rk.open ?? 0), Number(rk.progress ?? 0), Number(rk.closed ?? 0), Number(rk.lewatJatuhTempo ?? 0)];
  const rekomTotal = rekomVals.reduce((s, v) => s + v, 0);

  const trendTotal = ((d.trend || []) as D[]).reduce((s, t) => s + Number(t.total || 0), 0);
  const patuh = (d.kepatuhan || []) as D[];
  const patuhTotal = patuh.reduce((s, k) => s + Number(k.internalBulanIni || 0) + Number(k.pihakKetiga12Bulan || 0), 0);

  return (
    <div className="dashboard mcu-live-dashboard">
      {/* ── Top Bar: Filter & KPI Audit (pola Monitoring MCU) ─────────── */}
      <div className="dashboard-top-bar mcu-live-top-bar">
        <div className="mcu-dashboard-filters">
          <label>
            <span>Site</span>
            <select
              value={site}
              disabled={isSiteLocked}
              onChange={(e) => setSite(e.target.value)}
              style={{
                height: 28,
                width: 140,
                borderRadius: 7,
                border: '1px solid var(--border)',
                background: 'var(--background)',
                fontSize: 10,
                fontWeight: 700,
                padding: '0 6px',
              }}
            >
              {isSiteLocked && lockedSite ? (
                <option value={lockedSite}>{lockedSite}</option>
              ) : (
                <>
                  <option value="">Semua Site</option>
                  {daftarSite.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </>
              )}
            </select>
          </label>
        </div>

        <div className="mcu-total-bar">
          <span>Disetujui <b>{d.totalDisetujui ?? 0}</b></span>
          <span>Menunggu <b style={{ color: d.menungguPersetujuan ? '#F5A623' : 'inherit' }}>{d.menungguPersetujuan ?? 0}</b></span>
          <span>Perlu Ulang <b style={{ color: d.perluDiulang ? '#E63946' : 'inherit' }}>{d.perluDiulang ?? 0}</b></span>
          <span>Rekomendasi Aktif <b>{(rk.open ?? 0) + (rk.progress ?? 0)}</b></span>
          <span>Lewat Tempo <b style={{ color: rk.lewatJatuhTempo ? '#E63946' : 'inherit' }}>{rk.lewatJatuhTempo ?? 0}</b></span>
          <MCURefreshButton loading={loading} onClick={() => void loadData()} />
        </div>
      </div>

      {err && (
        <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 11 }}>
          {err}
        </div>
      )}

      {/* ── BARIS 1: Klasifikasi Risiko, Proporsi Metode & Tren Bulanan ── */}
      <div className="mcu-grid-3 mcu-live-chart-row">
        <MCUChartCard
          title="Distribusi Klasifikasi Risiko"
          subtitle="Seluruh survei disetujui · RULA, ROSA & WERA"
          className="glow-coral"
        >
          {grandTotal > 0 ? (
            <MCUChart
              type="doughnut"
              labels={KLAS_SHORT}
              values={totKlas}
              colors={KLAS.map((k) => KLAS_COLOR[k])}
              centerText={String(grandTotal)}
              percentLabels
            />
          ) : (
            <Kosong label="Belum ada survei ergonomi disetujui" />
          )}
        </MCUChartCard>

        <MCUChartCard
          title="Proporsi Survei per Metode"
          subtitle="Total penilaian disetujui · RULA · ROSA · WERA"
          className="glow-amber"
        >
          {metodeTotal > 0 ? (
            <MCUChart
              type="doughnut"
              labels={[...METODE]}
              values={metodeVals}
              colors={METODE_COLORS}
              centerText={String(metodeTotal)}
              percentLabels
            />
          ) : (
            <Kosong label="Belum ada data metode ergonomi" />
          )}
        </MCUChartCard>

        <MCUChartCard
          title="Tren Survei per Bulan"
          subtitle="Batang: total survei · garis: perlu PICA"
          className="glow-steel"
        >
          {trendTotal > 0 ? (
            <div className="mcu-dashboard-chart"><canvas ref={trendRef} /></div>
          ) : (
            <Kosong label="Belum ada tren survei 12 bulan" />
          )}
        </MCUChartCard>
      </div>

      {/* ── BARIS 2: Status Rekomendasi, Kepatuhan & Risiko Tinggi ─────── */}
      <div className="mcu-grid-3 mcu-live-chart-row">
        <MCUChartCard
          title="Status Rekomendasi"
          subtitle="Open · Progress · Closed · Lewat Tempo"
          className="glow-teal"
        >
          {rekomTotal > 0 ? (
            <MCUChart
              type="doughnut"
              labels={['Open', 'Progress', 'Closed', 'Lewat Tempo']}
              values={rekomVals}
              colors={['#E63946', '#F5A623', '#00B894', '#B91C1C']}
              centerText={String(rekomTotal)}
              percentLabels
            />
          ) : (
            <Kosong label="Belum ada rekomendasi ergonomi" />
          )}
        </MCUChartCard>

        <MCUChartCard
          title="Kepatuhan Frekuensi Survei"
          subtitle="Internal bulan ini & pihak ketiga 12 bulan per site"
          className="glow-orange"
        >
          {patuhTotal > 0 ? (
            <div className="mcu-dashboard-chart"><canvas ref={patuhRef} /></div>
          ) : (
            <Kosong label="Belum ada data kepatuhan site" />
          )}
        </MCUChartCard>

        <MCUChartCard
          title="Risiko Tinggi Terbaru"
          subtitle={`${(d.risikoTinggi || []).length} survei kategori Tinggi / Sangat Tinggi`}
          className="glow-coral"
        >
          <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {['Tanggal', 'Metode', 'Site / Area', 'Skor', 'Klasifikasi'].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(d.risikoTinggi || []).map((r: D) => (
                  <tr key={r.id}>
                    <td style={tdStyle}>{fmtDate(r.tanggal)}</td>
                    <td style={tdStyle}>{r.metode}</td>
                    <td style={tdStyle}>{r.site} : {r.area_kerja}</td>
                    <td style={tdStyle}>{r.skor_akhir}</td>
                    <td style={tdStyle}>
                      <Chip text={String(r.klasifikasi).replace('_', ' ')} color={KLAS_COLOR[r.klasifikasi as Klasifikasi]} />
                    </td>
                  </tr>
                ))}
                {!(d.risikoTinggi || []).length && (
                  <tr><td style={tdStyle} colSpan={5}>Tidak ada survei risiko tinggi.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </MCUChartCard>
      </div>
    </div>
  );
}

function Kosong({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted-foreground)', gap: 6 }}>
      <Activity size={28} style={{ opacity: 0.3 }} />
      <span style={{ fontSize: 11 }}>{label}</span>
    </div>
  );
}
