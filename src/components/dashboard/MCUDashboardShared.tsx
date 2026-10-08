'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  Chart as ChartJS,
  registerables,
  type Chart as ChartInstance,
  type ChartConfiguration,
  type ChartOptions,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { supabase } from '@/lib/supabase';

ChartJS.register(...registerables, ChartDataLabels);

function contrastColor(background: unknown, fallback: string): string {
  if (typeof background !== 'string') return fallback;
  let red: number;
  let green: number;
  let blue: number;
  const hex = background.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  const rgb = background.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);

  if (hex) {
    const full = hex.length === 3 ? [...hex].map((part) => part + part).join('') : hex;
    red = parseInt(full.slice(0, 2), 16);
    green = parseInt(full.slice(2, 4), 16);
    blue = parseInt(full.slice(4, 6), 16);
  } else if (rgb) {
    red = Number(rgb[1]);
    green = Number(rgb[2]);
    blue = Number(rgb[3]);
  } else {
    return fallback;
  }

  const luminance = [red, green, blue]
    .map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);

  return luminance > 0.179 ? '#111827' : '#FFFFFF';
}


/** Terima 'YYYY-MM-DD[...]', 'DD/MM/YYYY', 'DD-MM-YYYY'; selain itu null. */
export function parseRowDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const dmy = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  return null;
}

/**
 * Tanggal kedaluwarsa MCU. Kolom masa_berlaku_mcu bisa berisi tanggal, atau teks
 * seperti "Expired 120 Hari" / "45 Hari lagi" (hasil hitung monitor MCU).
 */
export function expiryDateOf(value: string | null | undefined, today = new Date()): Date | null {
  const direct = parseRowDate(value);
  if (direct) return direct;
  const text = String(value || '').trim();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const expired = text.match(/expired\s+(\d+)\s*hari/i);
  if (expired) { base.setDate(base.getDate() - Number(expired[1])); return base; }
  const left = text.match(/(\d+)\s*hari\s*lagi/i);
  if (left) { base.setDate(base.getDate() + Number(left[1])); return base; }
  return null;
}

/** Samakan penulisan nama jobsite ("SATUI", "satui ", "Satui" -> "Satui"). */
export function normalizeSiteName(value: unknown): string {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

export interface MCUDashboardRow {
  employee_id: string;
  site: string | null;
  area: string;
  client: string | null;
  jabatan: string | null;
  exempt: boolean;
  total_mcu: number;
  mcu_2024_count: number;
  mcu_2025_count: number;
  mcu_2026_count: number;
  mcu_2024: string | null;
  mcu_2025: string | null;
  mcu_2026: string | null;
  mcu_terakhir: string | null;
  kategori_mcu_terakhir: string | null;
  hasil_mcu: string | null;
  perlu_fu: string | null;
  rekomendasi_fu: string | null;
  item_fu: string | null;
  diagnosa: string | null;
  fram_score: number | null;
  fram_prob: string | null;
  frs_kategori: string | null;
  zona_risiko: string | null;
  masa_berlaku_mcu: string | null;
  status_mcu: 'Valid' | 'Expired' | 'No Data' | 'Exempt';
  status_follow_up: 'Perlu FU' | 'Selesai FU' | 'Belum Review' | 'Tidak Perlu FU' | 'Exempt';
  jadwal_mcu_selanjutnya: string | null;
}

// Kedua halaman MCU memakai dataset yang sama; simpan hanya di memori aplikasi.
const DASHBOARD_CACHE_MS = 5 * 60 * 1000;

let dashboardCache: { rows: MCUDashboardRow[]; savedAt: number } | null = null;
let dashboardRequest: Promise<MCUDashboardRow[]> | null = null;
let dashboardGeneration = 0;

function getCachedRows(): { rows: MCUDashboardRow[]; savedAt: number } | null {
  if (dashboardCache && Date.now() - dashboardCache.savedAt < DASHBOARD_CACHE_MS) {
    return dashboardCache;
  }
  return null;
}

function saveCachedRows(rows: MCUDashboardRow[], generation: number) {
  if (generation !== dashboardGeneration) return;
  const entry = { rows, savedAt: Date.now() };
  dashboardCache = entry;
}

async function fetchDashboardRows(force = false) {
  if (!force && dashboardRequest) return dashboardRequest;
  const generation = dashboardGeneration;
  const runner = (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const url = force ? '/api/mcu/dashboard?refresh=true' : '/api/mcu/dashboard';
    const response = await fetch(url, {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Gagal memuat data dashboard MCU');
    const rows = Array.isArray(json.employees) ? json.employees : [];
    saveCachedRows(rows, generation);
    return rows;
  })();
  if (!force) dashboardRequest = runner;
  try {
    return await runner;
  } finally {
    if (!force && dashboardRequest === runner) dashboardRequest = null;
  }
}

export function preloadMCUDashboardData(): Promise<MCUDashboardRow[]> {
  const cached = getCachedRows();
  if (cached) return Promise.resolve(cached.rows);
  return fetchDashboardRows();
}

export function clearMCUDashboardData() {
  dashboardGeneration += 1;
  dashboardCache = null;
  dashboardRequest = null;
}

export function useMCUDashboardData() {
  const initialCache = getCachedRows();
  const [rows, setRows] = useState<MCUDashboardRow[]>(() => initialCache?.rows ?? []);
  const [loading, setLoading] = useState(!initialCache);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    const cache = getCachedRows();

    const load = async () => {
      if (cache && reloadToken === 0) {
        setRows(cache.rows);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const nextRows = await fetchDashboardRows(reloadToken > 0);
        if (active) setRows(nextRows);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Gagal memuat data dashboard MCU');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [reloadToken]);

  return {
    rows,
    loading,
    error,
    refresh: () => {
      clearMCUDashboardData();
      setReloadToken(value => value + 1);
    },
  };
}

export function MCURefreshButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button type="button" className="mcu-dashboard-refresh" onClick={onClick} disabled={loading} title="Refresh Data MCU">
      <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
      Refresh
    </button>
  );
}

export function MCUDashboardFilters({
  rows,
  site,
  area,
  clients,
  onSiteChange,
  onAreaChange,
  onClientsChange,
}: {
  rows: MCUDashboardRow[];
  site: string;
  area: string;
  clients: string[];
  onSiteChange: (value: string) => void;
  onAreaChange: (value: string) => void;
  onClientsChange: (value: string[]) => void;
}) {
  const eligibleRows = rows.filter(row => !clients.length || (row.client && clients.includes(row.client)));
  const siteOptions = [...new Set(eligibleRows.map(row => row.site).filter((value): value is string => !!value))].sort();
  const areaRows = eligibleRows.filter(row => site === 'All Site' || row.site === site);
  const areaOptions = [...new Set(areaRows.map(row => row.area).filter(Boolean))].sort();
  const clientOptions = [...new Set(rows.map(row => row.client).filter((value): value is string => !!value))].sort();

  return (
    <div className="mcu-dashboard-filters">
      <label>
        <span>Site</span>
        <select value={site} onChange={event => onSiteChange(event.target.value)}>
          <option value="All Site">All Site</option>
          {siteOptions.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label>
        <span>Area</span>
        <select value={area} onChange={event => onAreaChange(event.target.value)}>
          <option value="">Semua Area</option>
          {areaOptions.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <details className="mcu-dashboard-client-filter">
        <summary>{clients.length ? `${clients.length} Client dipilih` : 'Semua Client'}</summary>
        <div className="mcu-dashboard-client-options">
          <label>
            <input type="checkbox" checked={!clients.length} onChange={() => onClientsChange([])} />
            Semua Client
          </label>
          {clientOptions.map(value => (
            <label key={value}>
              <input
                type="checkbox"
                checked={clients.includes(value)}
                onChange={event => onClientsChange(
                  event.target.checked ? [...clients, value] : clients.filter(client => client !== value),
                )}
              />
              {value}
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

export function MCUChart({
  type,
  labels,
  values,
  colors,
  legendLabel = 'Jumlah',
  horizontal = false,
  centerText,
  percentLabels = false,
}: {
  type: 'bar' | 'doughnut';
  labels: string[];
  values: number[];
  colors: string[];
  legendLabel?: string;
  horizontal?: boolean;
  centerText?: string;
  percentLabels?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<ChartInstance | null>(null);
  // Prop array (labels/values/colors) dibuat ulang di setiap render induk. Memakai
  // identitas array sebagai dependency membuat chart dihancurkan lalu digambar ulang
  // (dengan animasi dari nol) tiap kali induk render -> layar berkedip. Karena itu
  // chart hanya dibangun ulang bila ISI datanya benar-benar berubah.
  const dataSignature = JSON.stringify([type, labels, values, colors, legendLabel, horizontal, centerText, percentLabels]);
  const lastAnimatedSignature = useRef<string | null>(null);
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDark(root.classList.contains('dark'));
    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();

    const textColor = isDark ? '#F9FAFB' : '#111827';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const total = values.reduce((sum, value) => sum + value, 0);
    const shouldAnimate = lastAnimatedSignature.current !== dataSignature;
    const animation = shouldAnimate ? {
      duration: type === 'doughnut' ? 600 : 500,
      easing: 'easeOutQuart' as const,
      ...(type === 'doughnut' ? { animateRotate: true, animateScale: false } : {}),
    } : false;
    
    let animTimeout: NodeJS.Timeout;
    if (shouldAnimate) {
      animTimeout = setTimeout(() => {
        lastAnimatedSignature.current = dataSignature;
      }, 50);
    }

    const config: ChartConfiguration = {
      type,
      data: {
        labels,
        datasets: [{
          label: legendLabel,
          data: values,
          backgroundColor: colors,
          borderColor: type === 'doughnut' ? 'rgba(128,128,128,0.18)' : colors,
          borderWidth: type === 'doughnut' ? 1 : 0,
          borderRadius: type === 'bar' ? 4 : undefined,
          maxBarThickness: 20,
          hoverOffset: type === 'doughnut' ? 8 : undefined,
        }],
      },
      options: {
        indexAxis: horizontal ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        // Mengikuti dashboard GAS: chart dibuat ulang dan dianimasikan setiap DATA berubah
        // (ganti halaman, filter, refresh). Ganti tema tidak mengulang animasi.
        //  - donut : berputar (animateRotate), tanpa scale, 600 ms, easeOutQuart
        //  - bar   : tumbuh dari garis dasar, 500 ms, easeOutQuart
        animation: animation as ChartOptions['animation'],
        ...(type === 'doughnut' ? { cutout: '62%', radius: '82%' } : {}),
        plugins: {
          legend: {
            display: type === 'doughnut',
            position: type === 'doughnut' ? 'right' : 'bottom',
            labels: { color: textColor, font: { size: 10, weight: 'bold', family: fontFamily }, boxWidth: 12, usePointStyle: true },
          },
          tooltip: {
            titleFont: { size: 11, family: fontFamily },
            bodyFont: { size: 12, family: fontFamily },
            callbacks: {
              label: context => {
                // Pada bar horizontal parsed.y adalah indeks kategori (0,1,...),
                // bukan nilai batang. Nilai sebenarnya selalu berada di sumbu x.
                const value = Number(horizontal ? context.parsed.x : context.parsed.y ?? context.parsed);
                const suffix = percentLabels && total ? ` (${(value / total * 100).toFixed(2)}%)` : '';
                return ` ${context.label}: ${value}${suffix}`;
              },
            },
          },
          datalabels: {
            display: type === 'doughnut' ? (context: { dataset: { data: unknown[] }; dataIndex: number }) => {
              const value = Number(context.dataset.data[context.dataIndex]);
              return total > 0 && value > 0;
            } : true,
            anchor: type === 'bar' ? 'end' : 'center',
            align: type === 'bar' ? (horizontal ? 'right' : 'top') : 'center',
            formatter: (value: number) => {
              if (value <= 0) return '';
              return percentLabels && total ? `${(value / total * 100).toFixed(1)}%` : `${value}`;
            },
            color: context => {
              if (type !== 'doughnut') return textColor;
              const backgrounds = context.dataset.backgroundColor;
              const background = Array.isArray(backgrounds)
                ? backgrounds[context.dataIndex]
                : backgrounds;
              return contrastColor(background, textColor);
            },
            font: { size: 10, weight: 'bold', family: fontFamily },
            offset: 4,
            clamp: true,
            clip: false,
          },
        },
        scales: type === 'bar' ? {
          x: {
            beginAtZero: true,
            grace: horizontal ? '15%' : undefined,
            grid: { color: horizontal ? gridColor : 'transparent' },
            ticks: { color: textColor, font: { size: 10, family: fontFamily }, padding: 4 },
          },
          y: {
            beginAtZero: true,
            grid: { color: horizontal ? 'transparent' : gridColor },
            ticks: {
              color: textColor,
              font: { size: 10, family: fontFamily },
              padding: 4,
              callback: (value: string | number) => {
                const categoryIndex = Number(value);
                const label = horizontal
                  ? (labels[categoryIndex] ?? String(value))
                  : String(value);
                return label.length > 26 ? `${label.slice(0, 24)}…` : label;
              },
            },
          },
        } : undefined,
      },
      plugins: centerText ? [{
        id: 'mcu-center-text',
        afterDraw: (chart: ChartInstance) => {
          const { left, right, top, bottom } = chart.chartArea;
          const ctx = chart.ctx;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = textColor;
          ctx.font = 'bold 18px sans-serif';
          ctx.fillText(centerText, (left + right) / 2, (top + bottom) / 2);
          ctx.restore();
        },
      }] : [],
    };

    let chartDelayTimeout = setTimeout(() => {
      if (canvasRef.current) {
        chartRef.current = new ChartJS(canvasRef.current, config);
      }
    }, 150);

    return () => {
      if (animTimeout) clearTimeout(animTimeout);
      clearTimeout(chartDelayTimeout);
      chartRef.current?.stop();
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSignature, isDark]);

  return (
    <div className="mcu-dashboard-chart">
      <canvas ref={canvasRef} key={dataSignature} />
    </div>
  );
}

export function MCUChartCard({
  title,
  subtitle,
  children,
  className = 'glow-orange',
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className} mcu-dashboard-card`}>
      <div className="card-head"><div><h2>{title}</h2>{subtitle && <p className="mcu-dashboard-card-sub">{subtitle}</p>}</div></div>
      {children}
    </section>
  );
}
