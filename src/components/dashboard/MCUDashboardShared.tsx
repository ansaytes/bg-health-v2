'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  Chart as ChartJS,
  registerables,
  type Chart as ChartInstance,
  type ChartConfiguration,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { supabase } from '@/lib/supabase';

ChartJS.register(...registerables, ChartDataLabels);

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

export function useMCUDashboardData() {
  const [rows, setRows] = useState<MCUDashboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch('/api/mcu/dashboard', {
          cache: 'no-store',
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'Gagal memuat data dashboard MCU');
        if (active) setRows(Array.isArray(json.employees) ? json.employees : []);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Gagal memuat data dashboard MCU');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [reloadToken]);

  return { rows, loading, error, refresh: () => setReloadToken(value => value + 1) };
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
  horizontal = false,
  centerText,
  percentLabels = false,
}: {
  type: 'bar' | 'doughnut';
  labels: string[];
  values: number[];
  colors: string[];
  horizontal?: boolean;
  centerText?: string;
  percentLabels?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<ChartInstance | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#e5e7eb' : '#374151';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const total = values.reduce((sum, value) => sum + value, 0);
    const config: ChartConfiguration = {
      type,
      data: {
        labels,
        datasets: [{
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
        animation: {
          duration: type === 'doughnut' ? 600 : 500,
          easing: 'easeOutQuart',
        },
        ...(type === 'doughnut' ? { cutout: '58%' } : {}),
        plugins: {
          legend: {
            display: type === 'doughnut',
            position: 'right',
            labels: { color: textColor, font: { size: 9 }, boxWidth: 10, usePointStyle: true },
          },
          tooltip: {
            callbacks: {
              label: context => {
                const value = Number(context.parsed.y ?? context.parsed.x ?? context.parsed);
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
            color: type === 'doughnut' ? '#ffffff' : textColor,
            font: { size: 9, weight: 'bold' },
            offset: 4,
          },
        },
        scales: type === 'bar' ? {
          x: { beginAtZero: true, grid: { color: horizontal ? gridColor : 'transparent' }, ticks: { color: textColor, font: { size: 8 } } },
          y: { beginAtZero: true, grid: { color: horizontal ? 'transparent' : gridColor }, ticks: { color: textColor, font: { size: 8 } } },
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

    chartRef.current = new ChartJS(canvasRef.current, config);
    return () => {
      chartRef.current?.stop();
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [type, labels, values, colors, horizontal, centerText, percentLabels]);

  return <div className="mcu-dashboard-chart"><canvas ref={canvasRef} /></div>;
}

export function MCUChartCard({
  title,
  children,
  className = 'glow-orange',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className} mcu-dashboard-card`}>
      <div className="card-head"><div><h2>{title}</h2></div></div>
      {children}
    </section>
  );
}