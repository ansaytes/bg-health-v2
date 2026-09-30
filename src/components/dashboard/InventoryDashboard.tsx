'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  Chart as ChartJS,
  registerables,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import DownloadButton from '@/components/ui/download-button';
import { AlertTriangle, Clock, PackageCheck, AlertCircle, RefreshCw, ShieldAlert, Boxes } from 'lucide-react';

ChartJS.register(...registerables, ChartDataLabels);

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  avg_monthly_usage: number;
  stock: number;
  tanggal_masuk: string | null;
  tanggal_expired: string | null;
}

export default function InventoryDashboard() {
  const { user, profile } = useAuth();
  const role = profile?.role || 'guest';
  const isAuthorized = ['superuser', 'administrator'].includes(role);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Semua');
  const [stockStatusFilter, setStockStatusFilter] = useState('Semua');
  const [expiredStatusFilter, setExpiredStatusFilter] = useState('Semua');

  // Chart canvas refs
  const stockStatusCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const categoryCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fastMovingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const expiredTimelineCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Chart instances
  const stockStatusChart = useRef<ChartJS | null>(null);
  const categoryChart = useRef<ChartJS | null>(null);
  const fastMovingChart = useRef<ChartJS | null>(null);
  const expiredTimelineChart = useRef<ChartJS | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inventory');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setItems(json.data);
      }
    } catch (err) {
      console.error('Failed to load inventory data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthorized) {
      loadData();
    }
  }, [isAuthorized, loadData]);

  // Helper status calculations
  const now = new Date();

  const getStockStatus = (item: InventoryItem): 'Aman' | 'Menipis' | 'Kritis' | 'Habis' => {
    if (item.stock <= 0) return 'Habis';
    const monthly = item.avg_monthly_usage || 0;
    if (monthly > 0) {
      const monthsOfStock = item.stock / monthly;
      if (monthsOfStock <= 0.5 || item.stock <= 5) return 'Kritis';
      if (monthsOfStock <= 1.2) return 'Menipis';
      return 'Aman';
    }
    if (item.stock <= 5) return 'Kritis';
    if (item.stock <= 15) return 'Menipis';
    return 'Aman';
  };

  const getDaysUntilExpired = (dateStr: string | null): number | null => {
    if (!dateStr) return null;
    const expDate = new Date(dateStr);
    if (isNaN(expDate.getTime())) return null;
    const diffTime = expDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getExpiredStatus = (dateStr: string | null): 'Sudah Kadaluarsa' | 'Kadaluarsa < 3 Bulan' | 'Kadaluarsa < 6 Bulan' | 'Aman' | 'Tidak Ada Data' => {
    const days = getDaysUntilExpired(dateStr);
    if (days === null) return 'Tidak Ada Data';
    if (days <= 0) return 'Sudah Kadaluarsa';
    if (days <= 90) return 'Kadaluarsa < 3 Bulan';
    if (days <= 180) return 'Kadaluarsa < 6 Bulan';
    return 'Aman';
  };

  // KPIs
  const totalRagam = items.length;
  const totalStokFisik = useMemo(() => items.reduce((acc, i) => acc + (i.stock || 0), 0), [items]);
  
  const perluRestockCount = useMemo(() => {
    return items.filter(i => {
      const status = getStockStatus(i);
      return status === 'Menipis' || status === 'Kritis' || status === 'Habis';
    }).length;
  }, [items]);

  const expiredAlertCount = useMemo(() => {
    return items.filter(i => {
      const exp = getExpiredStatus(i.tanggal_expired);
      return exp === 'Sudah Kadaluarsa' || exp === 'Kadaluarsa < 3 Bulan';
    }).length;
  }, [items]);

  const totalAvgMonthly = useMemo(() => items.reduce((acc, i) => acc + (i.avg_monthly_usage || 0), 0), [items]);

  // Specific List: Items that are OUT OF STOCK or NEED RESTOCK (Critical / Low)
  const criticalStockItems = useMemo(() => {
    return items
      .filter(i => {
        const status = getStockStatus(i);
        return status === 'Habis' || status === 'Kritis' || status === 'Menipis';
      })
      .map(i => {
        const safeLimit = Math.max(1, (i.avg_monthly_usage || 0) * 3);
        const defisit = Math.max(0, safeLimit - i.stock);
        const status = getStockStatus(i);
        return {
          ...i,
          safeLimit,
          defisit,
          status,
        };
      })
      .sort((a, b) => {
        if (a.stock === 0 && b.stock !== 0) return -1;
        if (b.stock === 0 && a.stock !== 0) return 1;
        return b.defisit - a.defisit;
      });
  }, [items]);

  // Specific List: Items that are EXPIRED or EXPIRING SOON (< 3 Months)
  const criticalExpiredItems = useMemo(() => {
    return items
      .filter(i => {
        if (!i.tanggal_expired) return false;
        const exp = getExpiredStatus(i.tanggal_expired);
        return exp === 'Sudah Kadaluarsa' || exp === 'Kadaluarsa < 3 Bulan';
      })
      .map(i => {
        const expStatus = getExpiredStatus(i.tanggal_expired);
        const days = getDaysUntilExpired(i.tanggal_expired);
        return {
          ...i,
          expStatus,
          daysLeft: days,
        };
      })
      .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999));
  }, [items]);

  // Filtered Items for Table & Export
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Search by name
      if (searchQuery.trim() && !item.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) {
        return false;
      }
      // Category filter
      if (categoryFilter !== 'Semua' && (item.category || '').toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }
      // Stock Status filter
      if (stockStatusFilter !== 'Semua') {
        const status = getStockStatus(item);
        if (stockStatusFilter === 'Perlu Restock') {
          if (status === 'Aman') return false;
        } else if (status !== stockStatusFilter) {
          return false;
        }
      }
      // Expired Status filter
      if (expiredStatusFilter !== 'Semua') {
        const expStatus = getExpiredStatus(item.tanggal_expired);
        if (expiredStatusFilter === 'Kritis / Segera ED') {
          if (expStatus !== 'Sudah Kadaluarsa' && expStatus !== 'Kadaluarsa < 3 Bulan') return false;
        } else if (expStatus !== expiredStatusFilter) {
          return false;
        }
      }
      return true;
    });
  }, [items, searchQuery, categoryFilter, stockStatusFilter, expiredStatusFilter]);

  // Export Data for DownloadButton
  const tableDataForExport = useMemo(() => {
    return filteredItems.map((item, idx) => ({
      No: idx + 1,
      'Nama Item': item.name,
      Kategori: item.category || 'Obat',
      'Total Stok': item.stock,
      Satuan: item.unit,
      'Pemakaian/Bulan': item.avg_monthly_usage || 0,
      'Tgl Expired': item.tanggal_expired || '-',
      'Status Stok': getStockStatus(item),
      'Status Expired': getExpiredStatus(item.tanggal_expired),
    }));
  }, [filteredItems]);

  // Render Charts
  useEffect(() => {
    if (loading || !isAuthorized || items.length === 0) return;

    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#e5e7eb' : '#374151';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
    const fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

    // 1. Chart Status Ketersediaan Stok (Doughnut)
    if (stockStatusCanvasRef.current) {
      if (stockStatusChart.current) stockStatusChart.current.destroy();

      let aman = 0, menipis = 0, kritis = 0, habis = 0;
      items.forEach(i => {
        const s = getStockStatus(i);
        if (s === 'Aman') aman++;
        else if (s === 'Menipis') menipis++;
        else if (s === 'Kritis') kritis++;
        else if (s === 'Habis') habis++;
      });

      const data: ChartData<'doughnut'> = {
        labels: ['Stok Aman', 'Menipis', 'Kritis', 'Habis'],
        datasets: [
          {
            data: [aman, menipis, kritis, habis],
            backgroundColor: ['#00B894', '#FF9800', '#FF7043', '#FF4444'],
            hoverBackgroundColor: ['#26de81', '#ffa726', '#ff8a65', '#ff6b6b'],
            borderWidth: 2,
            borderColor: isDark ? '#1f2937' : '#ffffff',
          },
        ],
      };

      const options: ChartOptions<'doughnut'> = {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 10, font: { size: 10, family: fontFamily }, color: textColor },
          },
          datalabels: {
            color: '#ffffff',
            font: { weight: 'bold', size: 10, family: fontFamily },
            formatter: (value) => (value > 0 ? value : ''),
          },
        },
      };

      stockStatusChart.current = new ChartJS(stockStatusCanvasRef.current, {
        type: 'doughnut',
        data,
        options,
      });
    }

    // 2. Chart Distribusi Kategori (Doughnut)
    if (categoryCanvasRef.current) {
      if (categoryChart.current) categoryChart.current.destroy();

      const catCounts: Record<string, number> = {};
      items.forEach(i => {
        const cat = i.category || 'Obat';
        catCounts[cat] = (catCounts[cat] || 0) + 1;
      });

      const catLabels = Object.keys(catCounts);
      const catData = Object.values(catCounts);

      const data: ChartData<'doughnut'> = {
        labels: catLabels,
        datasets: [
          {
            data: catData,
            backgroundColor: ['#ff4d00', '#00BCD4', '#9B59B6', '#E91E63', '#3498DB'],
            borderWidth: 2,
            borderColor: isDark ? '#1f2937' : '#ffffff',
          },
        ],
      };

      const options: ChartOptions<'doughnut'> = {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 10, font: { size: 10, family: fontFamily }, color: textColor },
          },
          datalabels: {
            color: '#ffffff',
            font: { weight: 'bold', size: 10, family: fontFamily },
            formatter: (value) => (value > 0 ? value : ''),
          },
        },
      };

      categoryChart.current = new ChartJS(categoryCanvasRef.current, {
        type: 'doughnut',
        data,
        options,
      });
    }

    // 3. Top 10 Fast-Moving Items (Horizontal Bar)
    if (fastMovingCanvasRef.current) {
      if (fastMovingChart.current) fastMovingChart.current.destroy();

      const topFast = [...items]
        .sort((a, b) => (b.avg_monthly_usage || 0) - (a.avg_monthly_usage || 0))
        .slice(0, 10);

      const labels = topFast.map(i => i.name.length > 20 ? i.name.slice(0, 18) + '...' : i.name);
      const values = topFast.map(i => i.avg_monthly_usage || 0);

      const data: ChartData<'bar'> = {
        labels,
        datasets: [
          {
            label: 'Pemakaian/Bulan',
            data: values,
            backgroundColor: '#00BCD4',
            hoverBackgroundColor: '#26C6DA',
            borderRadius: 4,
            barThickness: 13,
          },
        ],
      };

      const options: ChartOptions<'bar'> = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.x} unit/bulan`,
            },
          },
          datalabels: {
            anchor: 'end',
            align: 'right',
            color: '#00BCD4',
            font: { size: 9, weight: 'bold', family: fontFamily },
            formatter: (v) => `${v}`,
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 8, family: fontFamily } },
          },
          y: {
            grid: { display: false },
            ticks: { color: textColor, font: { size: 8.5, family: fontFamily } },
          },
        },
      };

      fastMovingChart.current = new ChartJS(fastMovingCanvasRef.current, {
        type: 'bar',
        data,
        options,
      });
    }

    // 4. Status Expired Timeline (Bar Chart)
    if (expiredTimelineCanvasRef.current) {
      if (expiredTimelineChart.current) expiredTimelineChart.current.destroy();

      let expired = 0, under3m = 0, under6m = 0, safe = 0;
      items.forEach(i => {
        const s = getExpiredStatus(i.tanggal_expired);
        if (s === 'Sudah Kadaluarsa') expired++;
        else if (s === 'Kadaluarsa < 3 Bulan') under3m++;
        else if (s === 'Kadaluarsa < 6 Bulan') under6m++;
        else if (s === 'Aman') safe++;
      });

      const data: ChartData<'bar'> = {
        labels: ['Sudah ED', '< 3 Bulan', '3-6 Bulan', '> 6 Bulan'],
        datasets: [
          {
            data: [expired, under3m, under6m, safe],
            backgroundColor: ['#FF4444', '#FF9800', '#FFCA28', '#00B894'],
            borderRadius: 4,
            barThickness: 24,
          },
        ],
      };

      const options: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          datalabels: {
            anchor: 'end',
            align: 'top',
            color: textColor,
            font: { size: 9, weight: 'bold', family: fontFamily },
            formatter: (v) => (v > 0 ? `${v}` : ''),
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: { size: 8.5, family: fontFamily } },
          },
          y: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 8, family: fontFamily }, precision: 0 },
          },
        },
      };

      expiredTimelineChart.current = new ChartJS(expiredTimelineCanvasRef.current, {
        type: 'bar',
        data,
        options,
      });
    }

    return () => {
      stockStatusChart.current?.destroy();
      categoryChart.current?.destroy();
      fastMovingChart.current?.destroy();
      expiredTimelineChart.current?.destroy();
    };
  }, [items, loading, isAuthorized]);

  // Access guard
  if (!isAuthorized) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        flex: 1, minHeight: 400, textAlign: 'center', padding: 40,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16, background: 'rgba(255,68,68,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        }}>
          <ShieldAlert size={32} color="#FF4444" />
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', marginBottom: 8 }}>
          Akses Terbatas: Administrator & Superuser
        </h2>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)', maxWidth: 460 }}>
          Halaman monitoring stok obat, BHP, dan analisa FEFO klinik ini diproteksi dan hanya dapat diakses oleh Administrator dan Superuser klinik.
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard" style={{ overflowY: 'auto', overflowX: 'hidden', padding: '12px 16px' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Boxes size={20} color="var(--brand-primary, #ff4d00)" />
            Monitoring Stok Obat & BHP Klinik
          </h1>
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '4px 0 0 0' }}>
            Pemantauan ketersediaan stok fisik, peringatan restock, dan kontrol kedaluwarsa FEFO (First Expired First Out).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={loadData}
            title="Refresh Data"
            style={{
              height: 34,
              padding: '0 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
        {/* Total Ragam Item */}
        <div className="card glow-orange" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600, textTransform: 'uppercase' }}>Total Item</span>
            <Boxes size={16} color="#ff4d00" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#ff4d00', marginTop: 6 }}>
            {totalRagam}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 2 }}>Ragam Obat & BHP</div>
        </div>

        {/* Total Sisa Stok Fisik */}
        <div className="card glow-teal" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600, textTransform: 'uppercase' }}>Total Stok Fisik</span>
            <PackageCheck size={16} color="#00B894" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#00B894', marginTop: 6 }}>
            {totalStokFisik.toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 2 }}>Unit / Tablet / Pcs</div>
        </div>

        {/* Perlu Restock */}
        <div className="card glow-amber" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600, textTransform: 'uppercase' }}>Perlu Restock</span>
            <AlertTriangle size={16} color="#FF9800" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: perluRestockCount > 0 ? '#FF9800' : 'var(--foreground)', marginTop: 6 }}>
            {perluRestockCount}
          </div>
          <div style={{ fontSize: 10, color: perluRestockCount > 0 ? '#d97706' : 'var(--muted-foreground)', marginTop: 2 }}>
            {perluRestockCount > 0 ? 'Stok Menipis / Kritis' : 'Semua Stok Aman'}
          </div>
        </div>

        {/* Expired Soon / Kadaluarsa */}
        <div className="card glow-coral" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600, textTransform: 'uppercase' }}>Peringatan ED</span>
            <Clock size={16} color="#FF4444" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: expiredAlertCount > 0 ? '#FF4444' : 'var(--foreground)', marginTop: 6 }}>
            {expiredAlertCount}
          </div>
          <div style={{ fontSize: 10, color: expiredAlertCount > 0 ? '#dc2626' : 'var(--muted-foreground)', marginTop: 2 }}>
            {expiredAlertCount > 0 ? 'ED < 3 Bulan / Lewat' : 'Tidak Ada ED Dekat'}
          </div>
        </div>

        {/* Total Pemakaian Bulanan */}
        <div className="card glow-steel" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600, textTransform: 'uppercase' }}>Pemakaian/Bulan</span>
            <AlertCircle size={16} color="#778899" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--foreground)', marginTop: 6 }}>
            {totalAvgMonthly.toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 2 }}>Rata-rata kebutuhan/bln</div>
        </div>
      </div>

      {/* 4 Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {/* Chart 1: Status Ketersediaan */}
        <div className="card glow-orange" style={{ padding: '12px 14px', height: 210, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--foreground)' }}>Status Ketersediaan Stok</h3>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <canvas ref={stockStatusCanvasRef} />
          </div>
        </div>

        {/* Chart 2: Distribusi Kategori */}
        <div className="card glow-teal" style={{ padding: '12px 14px', height: 210, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--foreground)' }}>Komposisi Kategori</h3>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <canvas ref={categoryCanvasRef} />
          </div>
        </div>

        {/* Chart 3: Top Fast Moving */}
        <div className="card glow-coral" style={{ padding: '12px 14px', height: 210, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--foreground)' }}>Top Fast-Moving (Pakai/Bln)</h3>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <canvas ref={fastMovingCanvasRef} />
          </div>
        </div>

        {/* Chart 4: Timeline Kadaluarsa FEFO */}
        <div className="card glow-amber" style={{ padding: '12px 14px', height: 210, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--foreground)' }}>Distribusi Expired FEFO</h3>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <canvas ref={expiredTimelineCanvasRef} />
          </div>
        </div>
      </div>

      {/* ACTIONABLE WATCHLIST: ITEM SPESIFIK HABIS/RESTOCK & KADALUARSA */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {/* Panel Kiri: Item Habis & Kritis (Perlu Restock Segera) */}
        <div className="card glow-coral" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', minHeight: 280, maxHeight: 320 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(255,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={15} color="#FF4444" />
              </div>
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: 'var(--foreground)' }}>
                  Perlu Restock Segera (Habis / Menipis)
                </h3>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                  {criticalStockItems.length} item di bawah batas buffer aman klinik (3× rata-rata bulanan)
                </span>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr style={{ background: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 1 }}>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Nama Item</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>Sisa Stok</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>Batas Aman</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>Defisit</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {criticalStockItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#00B894' }}>
                      ✓ Seluruh stok obat dan BHP dalam kondisi aman.
                    </td>
                  </tr>
                ) : (
                  criticalStockItems.map((item, idx) => (
                    <tr key={item.id || idx} style={{ borderBottom: '1px solid var(--border)', background: item.stock === 0 ? 'rgba(255,68,68,0.05)' : undefined }}>
                      <td style={{ padding: '6px 8px', fontWeight: 600 }}>{item.name}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: item.stock === 0 ? '#FF4444' : '#FF9800' }}>
                        {item.stock} {item.unit}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--muted-foreground)' }}>
                        {item.safeLimit} {item.unit}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#FF4444' }}>
                        +{item.defisit}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <span style={{
                          background: item.stock === 0 ? 'rgba(255,68,68,0.15)' : 'rgba(255,152,0,0.15)',
                          color: item.stock === 0 ? '#FF4444' : '#d97706',
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 700,
                        }}>
                          {item.stock === 0 ? 'HABIS' : item.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel Kanan: Item Kadaluarsa & Segera Expired (FEFO Watchlist) */}
        <div className="card glow-amber" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', minHeight: 280, maxHeight: 320 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(255,152,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={15} color="#FF9800" />
              </div>
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: 'var(--foreground)' }}>
                  Peringatan FEFO & Kadaluarsa
                </h3>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                  {criticalExpiredItems.length} item sudah kadaluarsa atau akan expired dalam &lt; 3 bulan
                </span>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr style={{ background: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 1 }}>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Nama Item</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Tgl Expired</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Sisa Waktu</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>Stok Fisik</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'center' }}>Rekomendasi</th>
                </tr>
              </thead>
              <tbody>
                {criticalExpiredItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#00B894' }}>
                      ✓ Tidak ada obat atau BHP yang mendekati masa kadaluarsa (&lt; 3 bulan).
                    </td>
                  </tr>
                ) : (
                  criticalExpiredItems.map((item, idx) => {
                    const isPassed = (item.daysLeft ?? 0) <= 0;
                    return (
                      <tr key={item.id || idx} style={{ borderBottom: '1px solid var(--border)', background: isPassed ? 'rgba(255,68,68,0.06)' : undefined }}>
                        <td style={{ padding: '6px 8px', fontWeight: 600 }}>{item.name}</td>
                        <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 11 }}>
                          {item.tanggal_expired}
                        </td>
                        <td style={{ padding: '6px 8px', fontWeight: 600, color: isPassed ? '#FF4444' : '#d97706' }}>
                          {isPassed ? `Sudah Lewat (${Math.abs(item.daysLeft ?? 0)} hr)` : `${item.daysLeft} hari lagi`}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>
                          {item.stock} {item.unit}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <span style={{
                            background: isPassed ? 'rgba(255,68,68,0.15)' : 'rgba(255,152,0,0.15)',
                            color: isPassed ? '#FF4444' : '#d97706',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 700,
                          }}>
                            {isPassed ? 'Tarik / Retur' : 'Prioritaskan Resep'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tabel Data Monitoring Obat & BHP dengan DownloadButton */}
      <div className="card glow-steel" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', minHeight: 320 }}>
        {/* Table Filters & Download Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
            {/* Search Input */}
            <input
              type="text"
              placeholder="Cari nama obat / BHP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="admin-input"
              style={{ width: 200, height: 32, fontSize: 12 }}
            />

            {/* Filter Kategori */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="admin-input"
              style={{ width: 140, height: 32, fontSize: 12 }}
            >
              <option value="Semua">Semua Kategori</option>
              <option value="Obat">Obat</option>
              <option value="Bahan Medis">Bahan Medis</option>
              <option value="Lainnya">Lainnya</option>
            </select>

            {/* Filter Status Stok */}
            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value)}
              className="admin-input"
              style={{ width: 150, height: 32, fontSize: 12 }}
            >
              <option value="Semua">Semua Status Stok</option>
              <option value="Perlu Restock">Perlu Restock</option>
              <option value="Aman">Stok Aman</option>
              <option value="Menipis">Stok Menipis</option>
              <option value="Kritis">Stok Kritis</option>
              <option value="Habis">Stok Habis</option>
            </select>

            {/* Filter Status Expired */}
            <select
              value={expiredStatusFilter}
              onChange={(e) => setExpiredStatusFilter(e.target.value)}
              className="admin-input"
              style={{ width: 170, height: 32, fontSize: 12 }}
            >
              <option value="Semua">Semua Status Expired</option>
              <option value="Kritis / Segera ED">Kritis / Segera ED</option>
              <option value="Sudah Kadaluarsa">Sudah Kadaluarsa</option>
              <option value="Kadaluarsa < 3 Bulan">&lt; 3 Bulan</option>
              <option value="Kadaluarsa < 6 Bulan">3 - 6 Bulan</option>
              <option value="Aman">Aman (&gt; 6 Bulan)</option>
            </select>
          </div>

          {/* Download Button (Excel, CSV, PDF) */}
          <div style={{ flexShrink: 0 }}>
            <DownloadButton
              variant="compact"
              filename={`Monitoring_Inventory_Klinik_${categoryFilter}`}
              title="Monitoring Stok Obat & BHP Klinik"
              getData={() => tableDataForExport}
            />
          </div>
        </div>

        {/* Responsive Table */}
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 420 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '8px 10px', fontWeight: 600 }}>No</th>
                <th style={{ padding: '8px 10px', fontWeight: 600 }}>Nama Item Obat / BHP</th>
                <th style={{ padding: '8px 10px', fontWeight: 600 }}>Kategori</th>
                <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Total Stok</th>
                <th style={{ padding: '8px 10px', fontWeight: 600 }}>Satuan</th>
                <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Pakai/Bln</th>
                <th style={{ padding: '8px 10px', fontWeight: 600 }}>Expired Terdekat</th>
                <th style={{ padding: '8px 10px', fontWeight: 600 }}>Status Stok</th>
                <th style={{ padding: '8px 10px', fontWeight: 600 }}>Status Expired</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: 30, textAlign: 'center', color: 'var(--muted-foreground)' }}>
                    Memuat data stok inventory klinik...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 30, textAlign: 'center', color: 'var(--muted-foreground)' }}>
                    Tidak ada item yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const stockStatus = getStockStatus(item);
                  const expStatus = getExpiredStatus(item.tanggal_expired);

                  const stockBadgeStyle =
                    stockStatus === 'Aman'
                      ? { bg: 'rgba(0,184,148,0.1)', color: '#00B894' }
                      : stockStatus === 'Menipis'
                      ? { bg: 'rgba(255,152,0,0.1)', color: '#FF9800' }
                      : { bg: 'rgba(255,68,68,0.1)', color: '#FF4444' };

                  const expBadgeStyle =
                    expStatus === 'Aman'
                      ? { bg: 'rgba(0,184,148,0.1)', color: '#00B894' }
                      : expStatus === 'Kadaluarsa < 6 Bulan'
                      ? { bg: 'rgba(255,202,40,0.15)', color: '#b45309' }
                      : expStatus === 'Kadaluarsa < 3 Bulan'
                      ? { bg: 'rgba(255,152,0,0.15)', color: '#d97706' }
                      : expStatus === 'Sudah Kadaluarsa'
                      ? { bg: 'rgba(255,68,68,0.15)', color: '#dc2626' }
                      : { bg: 'rgba(0,0,0,0.05)', color: 'var(--muted-foreground)' };

                  return (
                    <tr
                      key={item.id || idx}
                      style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.12s' }}
                    >
                      <td style={{ padding: '8px 10px', color: 'var(--muted-foreground)' }}>{idx + 1}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--foreground)' }}>{item.name}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--muted-foreground)' }}>{item.category || 'Obat'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: item.stock <= 5 ? '#FF4444' : 'var(--foreground)' }}>
                        {item.stock}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--muted-foreground)' }}>{item.unit}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{item.avg_monthly_usage || 0}</td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11 }}>
                        {item.tanggal_expired || '-'}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          background: stockBadgeStyle.bg,
                          color: stockBadgeStyle.color,
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 10.5,
                          fontWeight: 700,
                        }}>
                          {stockStatus}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          background: expBadgeStyle.bg,
                          color: expBadgeStyle.color,
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 10.5,
                          fontWeight: 700,
                        }}>
                          {expStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
