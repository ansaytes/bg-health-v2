'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  const topExpiredCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const topHabisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const topExpSoonCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fastMovingCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Chart instances
  const topExpiredChart = useRef<ChartJS | null>(null);
  const topHabisChart = useRef<ChartJS | null>(null);
  const topExpSoonChart = useRef<ChartJS | null>(null);
  const fastMovingChart = useRef<ChartJS | null>(null);

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

  // Operational Action Tab State
  const [actionTab, setActionTab] = useState<'semua' | 'habis' | 'kritis' | 'fast' | 'fefo'>('semua');
  const [isDashboardView, setIsDashboardView] = useState(true);
  const [arrowRotation, setArrowRotation] = useState(0);
  const [chartRenderKey, setChartRenderKey] = useState(0);

  const handleToggleView = useCallback(() => {
    setArrowRotation((r) => r + 180);
    setIsDashboardView((prev) => {
      if (prev) setActionTab('semua');
      return !prev;
    });
  }, []);

  // Trigger chart re-render when switching to dashboard view
  useEffect(() => {
    if (isDashboardView) {
      setChartRenderKey(prev => prev + 1);
    }
  }, [isDashboardView]);

  const openTableTab = useCallback((tab: 'semua' | 'habis' | 'kritis' | 'fast' | 'fefo') => {
    setActionTab(tab);
    setIsDashboardView(false);
    setArrowRotation((r) => (isDashboardView ? r + 180 : r));
  }, [isDashboardView]);

  // Specific Lists based on clinic operational needs
  const habisItems = useMemo(() => items.filter(i => (i.stock || 0) <= 0), [items]);
  const kritisItems = useMemo(() => items.filter(i => {
    const s = getStockStatus(i);
    return s === 'Kritis' || s === 'Menipis';
  }), [items]);
  const fastMovingList = useMemo(() => [...items].sort((a, b) => (b.avg_monthly_usage || 0) - (a.avg_monthly_usage || 0)), [items]);
  const topFastItem = fastMovingList[0] || null;
  const expiredItems = useMemo(() => items.filter(i => getExpiredStatus(i.tanggal_expired) === 'Sudah Kadaluarsa'), [items]);
  const expSoonItems = useMemo(() => items.filter(i => getExpiredStatus(i.tanggal_expired) === 'Kadaluarsa < 3 Bulan'), [items]);

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

    // 1. Top 10 Sudah Expired (Horizontal Bar)
    if (topExpiredCanvasRef.current) {
      const existing = ChartJS.getChart(topExpiredCanvasRef.current);
      if (existing) existing.destroy();
      if (topExpiredChart.current) topExpiredChart.current.destroy();

      const topExpired = items
        .filter(i => getExpiredStatus(i.tanggal_expired) === 'Sudah Kadaluarsa')
        .sort((a, b) => (b.stock || 0) - (a.stock || 0))
        .slice(0, 10);

      const labels = topExpired.map(i => i.name.length > 20 ? i.name.slice(0, 18) + '...' : i.name);
      const values = topExpired.map(i => i.stock || 0);

      const data: ChartData<'bar'> = {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: 'rgba(220, 38, 38, 0.85)',
            borderColor: '#dc2626',
            borderWidth: 1.5,
            borderRadius: 6,
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
              label: (ctx) => ` ${ctx.parsed.x} ${topExpired[ctx.dataIndex]?.unit || 'satuan'} expired`,
            },
          },
          datalabels: {
            anchor: 'end',
            align: 'right',
            color: textColor,
            font: { size: 9, weight: 'bold', family: fontFamily },
            formatter: (v) => (v > 0 ? `${v}` : ''),
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

      topExpiredChart.current = new ChartJS(topExpiredCanvasRef.current, {
        type: 'bar',
        data,
        options,
      });
    }

    // 2. Top 10 Stok Habis (Horizontal Bar)
    if (topHabisCanvasRef.current) {
      const existing = ChartJS.getChart(topHabisCanvasRef.current);
      if (existing) existing.destroy();
      if (topHabisChart.current) topHabisChart.current.destroy();

      const topHabis = items
        .filter(i => (i.stock || 0) <= 0)
        .sort((a, b) => (b.avg_monthly_usage || 0) - (a.avg_monthly_usage || 0))
        .slice(0, 10);

      const labels = topHabis.map(i => i.name.length > 20 ? i.name.slice(0, 18) + '...' : i.name);
      const values = topHabis.map(i => i.avg_monthly_usage || 0);

      const data: ChartData<'bar'> = {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: 'rgba(255, 68, 68, 0.85)',
            borderColor: '#FF4444',
            borderWidth: 1.5,
            borderRadius: 6,
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
              label: (ctx) => ` ${ctx.parsed.x} ${topHabis[ctx.dataIndex]?.unit || 'satuan'}/bulan kebutuhan`,
            },
          },
          datalabels: {
            anchor: 'end',
            align: 'right',
            color: textColor,
            font: { size: 9, weight: 'bold', family: fontFamily },
            formatter: (v) => (v > 0 ? `${v}` : ''),
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

      topHabisChart.current = new ChartJS(topHabisCanvasRef.current, {
        type: 'bar',
        data,
        options,
      });
    }

    // 3. Top 10 Akan Expired < 3 Bulan (Horizontal Bar)
    if (topExpSoonCanvasRef.current) {
      const existing = ChartJS.getChart(topExpSoonCanvasRef.current);
      if (existing) existing.destroy();
      if (topExpSoonChart.current) topExpSoonChart.current.destroy();

      const topExpSoon = items
        .filter(i => getExpiredStatus(i.tanggal_expired) === 'Kadaluarsa < 3 Bulan')
        .map(i => ({ ...i, daysLeft: getDaysUntilExpired(i.tanggal_expired) }))
        .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999))
        .slice(0, 10);

      const labels = topExpSoon.map(i => i.name.length > 20 ? i.name.slice(0, 18) + '...' : i.name);
      const values = topExpSoon.map(i => i.stock || 0);

      const data: ChartData<'bar'> = {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: 'rgba(230, 126, 34, 0.85)',
            borderColor: '#E67E22',
            borderWidth: 1.5,
            borderRadius: 6,
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
              label: (ctx) => ` ${ctx.parsed.x} ${topExpSoon[ctx.dataIndex]?.unit || 'satuan'} terancam`,
            },
          },
          datalabels: {
            anchor: 'end',
            align: 'right',
            color: textColor,
            font: { size: 9, weight: 'bold', family: fontFamily },
            formatter: (v) => (v > 0 ? `${v}` : ''),
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

      topExpSoonChart.current = new ChartJS(topExpSoonCanvasRef.current, {
        type: 'bar',
        data,
        options,
      });
    }

    // 4. Top 10 Fast-Moving Items (Horizontal Bar)
    if (fastMovingCanvasRef.current) {
      const existing = ChartJS.getChart(fastMovingCanvasRef.current);
      if (existing) existing.destroy();
      if (fastMovingChart.current) fastMovingChart.current.destroy();

      const topFast = [...items]
        .sort((a, b) => (b.avg_monthly_usage || 0) - (a.avg_monthly_usage || 0))
        .slice(0, 10);

      const labels = topFast.map(i => i.name.length > 20 ? i.name.slice(0, 18) + '...' : i.name);
      const values = topFast.map(i => i.avg_monthly_usage || 0);

      const paletteColors = [
        'rgba(255, 77, 0, 0.85)',   // #1 Degirol: Oranye
        'rgba(0, 188, 212, 0.85)',  // #2 Caviplex: Cyan
        'rgba(155, 89, 182, 0.85)', // #3 Anadex: Ungu
        'rgba(0, 184, 148, 0.85)',  // #4 Demacolin: Hijau
        'rgba(255, 152, 0, 0.85)',  // #5 Paratusin: Amber
        'rgba(233, 30, 99, 0.85)',   // #6 Vitacimin: Pink
        'rgba(52, 152, 219, 0.85)',  // #7 Atorvastatin: Biru
        'rgba(243, 156, 18, 0.85)',  // #8 Grantusif: Emas
        'rgba(26, 188, 156, 0.85)',  // #9 Graxine: Teal
        'rgba(230, 126, 34, 0.85)',  // #10 Paracetamol: Terracotta
      ];
      const paletteBorders = [
        '#ff4d00',
        '#00BCD4',
        '#9B59B6',
        '#00B894',
        '#FF9800',
        '#E91E63',
        '#3498DB',
        '#F39C12',
        '#1ABC9C',
        '#E67E22',
      ];

      const data: ChartData<'bar'> = {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: paletteColors.slice(0, values.length),
            borderColor: paletteBorders.slice(0, values.length),
            borderWidth: 1.5,
            borderRadius: 6,
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
              label: (ctx) => ` ${ctx.parsed.x} ${topFast[ctx.dataIndex]?.unit || 'satuan'}/bulan`,
            },
          },
          datalabels: {
            anchor: 'end',
            align: 'right',
            color: textColor,
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

    return () => {
      topExpiredChart.current?.destroy();
      topHabisChart.current?.destroy();
      topExpSoonChart.current?.destroy();
      fastMovingChart.current?.destroy();
    };
  }, [items, loading, isAuthorized, chartRenderKey]);

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
    <div className="dashboard" style={{ overflow: 'hidden', padding: '12px 16px', position: 'relative', flex: 1, minHeight: 0, height: '100%' }}>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%', overflow: 'hidden' }}>
        <button
          type="button"
          className="admin-toggle-arrow"
          onClick={handleToggleView}
          title={isDashboardView ? 'Lihat tabel inventory' : 'Kembali ke dashboard'}
          aria-label={isDashboardView ? 'Lihat tabel inventory' : 'Kembali ke dashboard'}
        >
          <motion.svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ rotate: arrowRotation }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <polyline points="9 6 15 12 9 18" />
          </motion.svg>
        </button>

        <AnimatePresence mode="wait">
          {isDashboardView ? (
            <motion.div
              key="inventory-dashboard"
              initial={{ opacity: 0, x: -36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -36 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              style={{ position: 'absolute', inset: 0, overflow: 'hidden', paddingRight: 28, display: 'flex', flexDirection: 'column' }}
            >
              {/* Header Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Boxes size={20} color="var(--brand-primary, #ff4d00)" />
                    Stok Obat & BHP
                  </h1>
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
                {/* Card 1: Obat Habis */}
                <div
                  className="card glow-coral"
                  onClick={() => openTableTab('habis')}
                  style={{
                    padding: '12px 14px',
                    cursor: 'pointer',
                    border: actionTab === 'habis' ? '2px solid #FF4444' : undefined,
                    transition: 'all 0.15s ease',
                  }}
                  title="Klik untuk melihat daftar obat yang stoknya habis"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 700 }}>Stok Habis</span>
                    <AlertCircle size={16} color="#FF4444" />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#FF4444', marginTop: 6 }}>
                    {habisItems.length}
                  </div>
                  <div style={{ fontSize: 10, color: habisItems.length > 0 ? '#b91c1c' : 'var(--muted-foreground)', marginTop: 2, fontWeight: 500 }}>
                    {habisItems.length > 0 ? 'Order segera' : 'Tersedia'}
                  </div>
                </div>

                {/* Card 2: Stok Kritis / Menipis */}
                <div
                  className="card glow-amber"
                  onClick={() => openTableTab('kritis')}
                  style={{
                    padding: '12px 14px',
                    cursor: 'pointer',
                    border: actionTab === 'kritis' ? '2px solid #FF9800' : undefined,
                    transition: 'all 0.15s ease',
                  }}
                  title="Klik untuk melihat daftar obat yang stoknya menipis"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: '#d97706', fontWeight: 700 }}>Stok Menipis</span>
                    <AlertTriangle size={16} color="#FF9800" />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#FF9800', marginTop: 6 }}>
                    {kritisItems.length}
                  </div>
                  <div style={{ fontSize: 10, color: '#b45309', marginTop: 2, fontWeight: 500 }}>
                    &lt; 3 bulan pemakaian
                  </div>
                </div>

                {/* Card 3: Top Fast-Moving Item #1 */}
                <div
                  className="card glow-teal"
                  onClick={() => openTableTab('fast')}
                  style={{
                    padding: '12px 14px',
                    cursor: 'pointer',
                    border: actionTab === 'fast' ? '2px solid #00BCD4' : undefined,
                    transition: 'all 0.15s ease',
                  }}
                  title="Klik untuk melihat ranking obat fast moving"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: '#00838f', fontWeight: 700 }}>Fast-Moving</span>
                    <Boxes size={16} color="#00BCD4" />
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--foreground)', marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {topFastItem?.name || '-'}
                  </div>
                  <div style={{ fontSize: 10.5, color: '#00BCD4', marginTop: 2, fontWeight: 700 }}>
                    {topFastItem?.avg_monthly_usage || 0} {topFastItem?.unit || 'unit'}/bln
                  </div>
                </div>

                {/* Card 4: Segera Expired (< 3 Bulan) */}
                <div
                  className="card glow-orange"
                  onClick={() => openTableTab('fefo')}
                  style={{
                    padding: '12px 14px',
                    cursor: 'pointer',
                    border: actionTab === 'fefo' ? '2px solid #E67E22' : undefined,
                    transition: 'all 0.15s ease',
                  }}
                  title="Klik untuk melihat obat yang mendekati masa expired"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: '#c2410c', fontWeight: 700 }}>Expired &lt; 3 Bln</span>
                    <Clock size={16} color="#E67E22" />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#E67E22', marginTop: 6 }}>
                    {expSoonItems.length}
                  </div>
                  <div style={{ fontSize: 10, color: '#9a3412', marginTop: 2, fontWeight: 500 }}>
                    Prioritas FEFO
                  </div>
                </div>

                {/* Card 5: Sudah Kadaluarsa */}
                <div
                  className="card glow-coral"
                  onClick={() => openTableTab('fefo')}
                  style={{
                    padding: '12px 14px',
                    cursor: 'pointer',
                    border: actionTab === 'fefo' ? '2px solid #dc2626' : undefined,
                    transition: 'all 0.15s ease',
                  }}
                  title="Klik untuk melihat obat yang sudah kadaluarsa"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 700 }}>Sudah Expired</span>
                    <ShieldAlert size={16} color="#dc2626" />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626', marginTop: 6 }}>
                    {expiredItems.length}
                  </div>
                  <div style={{ fontSize: 10, color: '#991b1b', marginTop: 2, fontWeight: 500 }}>
                    {expiredItems.length > 0 ? 'Tarik & Berita Acara' : 'Aman'}
                  </div>
                </div>
              </div>

              {/* 4 Charts Grid */}
              <div key="charts-grid" style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {/* Chart 1: Top Sudah Expired */}
        <div className="card glow-coral" style={{ padding: '12px 14px', minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--foreground)' }}>Stok Obat/BHP Expired</h3>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <canvas ref={topExpiredCanvasRef} />
          </div>
        </div>

        {/* Chart 2: Top Stok Habis */}
        <div className="card glow-orange" style={{ padding: '12px 14px', minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--foreground)' }}>Stok Habis (kebutuhan/bln)</h3>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <canvas ref={topHabisCanvasRef} />
          </div>
        </div>

        {/* Chart 3: Top Akan Expired < 3 Bulan */}
        <div className="card glow-amber" style={{ padding: '12px 14px', minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--foreground)' }}>Stok Akan Expired &lt; 3 Bln</h3>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <canvas ref={topExpSoonCanvasRef} />
          </div>
        </div>

        {/* Chart 4: Top Fast Moving */}
        <div className="card glow-teal" style={{ padding: '12px 14px', minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--foreground)' }}>Pemakaian per Bulan</h3>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <canvas ref={fastMovingCanvasRef} />
          </div>
        </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="inventory-table"
              initial={{ opacity: 0, x: 36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 36 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              style={{ position: 'absolute', inset: 0, overflow: 'hidden', paddingRight: 28, display: 'flex', flexDirection: 'column' }}
            >
      <div className="card glow-steel" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        {/* Tab Headers */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleToggleView}
              style={{
                height: 32,
                padding: '0 12px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--background)',
                color: 'var(--foreground)',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              ← Kembali ke Dashboard
            </button>
            <button
              type="button"
              onClick={() => setActionTab('semua')}
              style={{
                height: 32,
                padding: '0 12px',
                borderRadius: 6,
                border: 'none',
                background: actionTab === 'semua' ? '#ff4d00' : 'var(--muted)',
                color: actionTab === 'semua' ? '#ffffff' : 'var(--foreground)',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <PackageCheck size={14} />
              Semua ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setActionTab('habis')}
              style={{
                height: 32,
                padding: '0 12px',
                borderRadius: 6,
                border: 'none',
                background: actionTab === 'habis' ? '#FF4444' : 'var(--muted)',
                color: actionTab === 'habis' ? '#ffffff' : 'var(--foreground)',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <AlertCircle size={14} />
              Habis ({habisItems.length})
            </button>

            <button
              type="button"
              onClick={() => setActionTab('kritis')}
              style={{
                height: 32,
                padding: '0 12px',
                borderRadius: 6,
                border: 'none',
                background: actionTab === 'kritis' ? '#FF9800' : 'var(--muted)',
                color: actionTab === 'kritis' ? '#ffffff' : 'var(--foreground)',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <AlertTriangle size={14} />
              Menipis ({kritisItems.length})
            </button>

            <button
              type="button"
              onClick={() => setActionTab('fast')}
              style={{
                height: 32,
                padding: '0 12px',
                borderRadius: 6,
                border: 'none',
                background: actionTab === 'fast' ? '#00BCD4' : 'var(--muted)',
                color: actionTab === 'fast' ? '#ffffff' : 'var(--foreground)',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Boxes size={14} />
              Fast-Moving
            </button>

            <button
              type="button"
              onClick={() => setActionTab('fefo')}
              style={{
                height: 32,
                padding: '0 12px',
                borderRadius: 6,
                border: 'none',
                background: actionTab === 'fefo' ? '#E67E22' : 'var(--muted)',
                color: actionTab === 'fefo' ? '#ffffff' : 'var(--foreground)',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Clock size={14} />
              Expired/FEFO ({expiredItems.length + expSoonItems.length})
            </button>
          </div>

          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
            {actionTab === 'semua' && `${filteredItems.length} item`}
            {actionTab === 'habis' && `${habisItems.length} item stok 0`}
            {actionTab === 'kritis' && `${kritisItems.length} item stok menipis`}
            {actionTab === 'fast' && `15 item fast-moving`}
            {actionTab === 'fefo' && `${expiredItems.length + expSoonItems.length} item expired/FEFO`}
          </span>
        </div>

        {/* Tab Content 1: OBAT HABIS */}
        {actionTab === 'habis' && (
          <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>No</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Nama</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Kategori</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Stok</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Pakai/Bln</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Rekomendasi</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'center' }}>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {habisItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#00B894' }}>
                      ✓ Semua stok tersedia
                    </td>
                  </tr>
                ) : (
                  habisItems.map((item, idx) => {
                    const bufferMin = Math.max(10, (item.avg_monthly_usage || 0) * 3);
                    return (
                      <tr key={item.id || idx} style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,68,68,0.04)' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--muted-foreground)' }}>{idx + 1}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--foreground)' }}>{item.name}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--muted-foreground)' }}>{item.category}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#FF4444' }}>
                          0 {item.unit}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{item.avg_monthly_usage} {item.unit}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#ff4d00' }}>
                          +{bufferMin} {item.unit}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <span style={{ background: 'rgba(255,68,68,0.15)', color: '#FF4444', padding: '3px 8px', borderRadius: 4, fontSize: 10.5, fontWeight: 800 }}>
                            HABIS
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#FF4444' }}>
                            Order
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab Content 2: STOK KRITIS / TINGGAL SEDIKIT */}
        {actionTab === 'kritis' && (
          <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>No</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Nama</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Stok</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Pakai/Bln</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Batas Aman</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Kurang</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {kritisItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#00B894' }}>
                      ✓ Semua stok aman
                    </td>
                  </tr>
                ) : (
                  kritisItems.map((item, idx) => {
                    const safeLimit = Math.max(1, (item.avg_monthly_usage || 0) * 3);
                    const defisit = Math.max(0, safeLimit - item.stock);
                    const isVeryLow = item.stock <= 5;
                    return (
                      <tr key={item.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--muted-foreground)' }}>{idx + 1}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{item.name}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: isVeryLow ? '#FF4444' : '#FF9800' }}>
                          {item.stock} {item.unit}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{item.avg_monthly_usage} {item.unit}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--muted-foreground)' }}>
                          {safeLimit} {item.unit}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#FF4444' }}>
                          +{defisit} {item.unit}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <span style={{
                            background: isVeryLow ? 'rgba(255,68,68,0.15)' : 'rgba(255,152,0,0.15)',
                            color: isVeryLow ? '#FF4444' : '#d97706',
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: 10.5,
                            fontWeight: 700,
                          }}>
                            {isVeryLow ? 'KRITIS' : 'MENIPIS'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab Content 3: 15 OBAT FAST-MOVING */}
        {actionTab === 'fast' && (
          <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px 10px', fontWeight: 600, width: 45 }}>Rank</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Nama</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Pakai/Bln</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Stok</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'center' }}>Cukup</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {fastMovingList.slice(0, 15).map((item, idx) => {
                  const status = getStockStatus(item);
                  const isEnough = item.stock >= (item.avg_monthly_usage * 3);
                  return (
                    <tr key={item.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 800, color: idx < 3 ? '#ff4d00' : 'var(--muted-foreground)' }}>
                        #{idx + 1}
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{item.name}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#00BCD4' }}>
                        {item.avg_monthly_usage} {item.unit}/bln
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: item.stock <= 5 ? '#FF4444' : undefined }}>
                        {item.stock} {item.unit}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <span style={{
                          color: isEnough ? '#00B894' : item.stock === 0 ? '#FF4444' : '#FF9800',
                          fontWeight: 700,
                          fontSize: 11,
                        }}>
                          {item.stock === 0 ? 'Habis' : `${Math.round((item.stock / Math.max(1, item.avg_monthly_usage)) * 10) / 10} bln`}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <span style={{
                          background: item.stock === 0 ? 'rgba(255,68,68,0.15)' : isEnough ? 'rgba(0,184,148,0.15)' : 'rgba(255,152,0,0.15)',
                          color: item.stock === 0 ? '#FF4444' : isEnough ? '#00B894' : '#d97706',
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 10.5,
                          fontWeight: 700,
                        }}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab Content 4: FEFO / KADALUARSA */}
        {actionTab === 'fefo' && (
          <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>No</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Nama</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Tgl Expired</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Sisa</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Stok</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'center' }}>Status FEFO</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'center' }}>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {criticalExpiredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#00B894' }}>
                      ✓ Tidak ada obat &lt; 3 bulan expired
                    </td>
                  </tr>
                ) : (
                  criticalExpiredItems.map((item, idx) => {
                    const isPassed = (item.daysLeft ?? 0) <= 0;
                    return (
                      <tr key={item.id || idx} style={{ borderBottom: '1px solid var(--border)', background: isPassed ? 'rgba(255,68,68,0.06)' : undefined }}>
                        <td style={{ padding: '8px 10px', color: 'var(--muted-foreground)' }}>{idx + 1}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{item.name}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11.5 }}>
                          {item.tanggal_expired}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: isPassed ? '#FF4444' : '#d97706' }}>
                          {isPassed ? `${Math.abs(item.daysLeft ?? 0)} hari lewat` : `${item.daysLeft} hari`}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>
                          {item.stock} {item.unit}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <span style={{
                            background: isPassed ? 'rgba(255,68,68,0.15)' : 'rgba(255,152,0,0.15)',
                            color: isPassed ? '#FF4444' : '#d97706',
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: 10.5,
                            fontWeight: 700,
                          }}>
                            {isPassed ? 'Expired' : '&lt; 3 BLN'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: isPassed ? '#FF4444' : '#00B894',
                          }}>
                            {isPassed ? 'Tarik & Berita Acara' : 'Prioritas FEFO'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {actionTab === 'semua' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
                  <input
                    type="text"
                    placeholder="Cari nama obat / BHP..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="admin-input"
                    style={{ width: 200, height: 32, fontSize: 12 }}
                  />

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

                <div style={{ flexShrink: 0 }}>
                  <DownloadButton
                    variant="compact"
                    filename={`Monitoring_Inventory_Klinik_${categoryFilter}`}
                    title="Monitoring Stok Obat & BHP Klinik"
                    getData={() => tableDataForExport}
                  />
                </div>
              </div>

              <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>No</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Nama</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Kategori</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Stok</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Satuan</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Pakai/Bln</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>ED</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Stok</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>ED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={9} style={{ padding: 30, textAlign: 'center', color: 'var(--muted-foreground)' }}>
                          Memuat...
                        </td>
                      </tr>
                    ) : filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ padding: 30, textAlign: 'center', color: 'var(--muted-foreground)' }}>
                          Tidak ada data
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
        )}
            </div>
          </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
