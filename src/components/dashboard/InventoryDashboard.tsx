'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import type { ChartData, ChartOptions } from 'chart.js';
import { ChartJS } from '@/lib/chart-register';
import { AlertTriangle, Clock, AlertCircle, RefreshCw, ShieldAlert, Boxes } from 'lucide-react';
import { fetchDashboardData } from '@/lib/dashboard-data';
import { STANDAR_ANIMASI_BAR, STANDAR_ANIMASI_DONUT, animasiUlang, useAnimationReady } from '@/lib/chart-standard';

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
  const { profile } = useAuth();
  const role = profile?.role || 'guest';
  const isAuthorized = ['superuser', 'administrator'].includes(role);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );



  // Tunda pembuatan chart 2 frame agar animasi berjalan di depan pengguna
  // (container baru selesai transisi masuk pada frame-frame awal).
  const animReady = useAnimationReady([]);

  // Chart canvas refs
  const topExpiredCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stockStatusCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const topExpSoonCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fastMovingCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Chart instances
  const topExpiredChart = useRef<ChartJS | null>(null);
  const stockStatusChart = useRef<ChartJS | null>(null);
  const topExpSoonChart = useRef<ChartJS | null>(null);
  const fastMovingChart = useRef<ChartJS | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on full unmount
      if (topExpiredChart.current) topExpiredChart.current.destroy();
      if (stockStatusChart.current) stockStatusChart.current.destroy();
      if (topExpSoonChart.current) topExpSoonChart.current.destroy();
      if (fastMovingChart.current) fastMovingChart.current.destroy();
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDark(root.classList.contains('dark'));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const loadData = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const json = await fetchDashboardData<{ success: boolean; data?: InventoryItem[] }>('/api/inventory', force);
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

  // Dashboard hanya menampilkan infografik (KPI card + 4 chart). Tabel
  // operasional (Habis / Menipis / Fast-Moving / FEFO / Semua) sudah dipindah
  // ke halaman Admin → Layanan Kuratif → Inventory.
  const [chartRenderKey, setChartRenderKey] = useState(0);

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

  // Render Charts

  useEffect(() => {
    if (loading || !isAuthorized || items.length === 0 || !animReady) return;

    // ANIMASI STANDAR APLIKASI: selalu berjalan.
    const animationSettings = STANDAR_ANIMASI_BAR;
    const donutAnimationSettings = STANDAR_ANIMASI_DONUT;
      const textColor = isDark ? '#F9FAFB' : '#111827';
      const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
      const fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

      // 1. Top 10 Sudah Expired (Horizontal Bar)
      if (topExpiredCanvasRef.current) {

      const topExpired = items
        .filter(i => getExpiredStatus(i.tanggal_expired) === 'Sudah Kadaluarsa')
        .sort((a, b) => (b.stock || 0) - (a.stock || 0))
        .slice(0, 10);

      // Nama item bisa berulang (varian/kemasan) â€” beri penomoran agar label sumbu tetap unik.
      const rawExpired = topExpired.map(i => i.name.length > 22 ? i.name.slice(0, 20) + 'â€¦' : i.name);
      const dupExpired = new Map<string, number>();
      const labels = rawExpired.map(name => {
        const n = (dupExpired.get(name) || 0) + 1;
        dupExpired.set(name, n);
        return n > 1 ? `${name} (${n})` : name;
      });
      const values = topExpired.map(i => i.stock || 0);

      const data: ChartData<'bar'> = {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: 'rgba(231, 76, 60, 0.62)',
            hoverBackgroundColor: 'rgba(231, 76, 60, 0.85)',
            borderWidth: 0,
            borderRadius: 4,
            maxBarThickness: 18,
          },
        ],
      };

      const options: ChartOptions<'bar'> = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: animationSettings,
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
            font: { size: 10, weight: 'bold', family: fontFamily },
            formatter: (v) => (v > 0 ? `${v}` : ''),
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grace: '15%',
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 10, family: fontFamily }, padding: 4 },
          },
          y: {
            beginAtZero: true,
            grid: { display: false },
            ticks: {
              color: textColor,
              font: { size: 10, family: fontFamily },
              padding: 4,
              autoSkip: false,
              callback: (value) => {
                const label = labels[Number(value)] ?? String(value);
                return label.length > 26 ? `${label.slice(0, 24)}â€¦` : label;
              },
            },
          },
        },
      };

      if (topExpiredChart.current) {
        topExpiredChart.current.destroy();
        topExpiredChart.current = null;
      }

      topExpiredChart.current = new ChartJS(topExpiredCanvasRef.current, {
          type: 'bar',
          data,
          options,
        });
    }

    // 2. Status Stok (doughnut, total di tengah) â€” menggantikan bar tanpa nama
    if (stockStatusCanvasRef.current) {

      const ORDER = ['Aman', 'Menipis', 'Kritis', 'Habis'] as const;
      // Warna status tegas dan mudah dibedakan:
      // Habis = merah cerah, Menipis = kuning cerah, Kritis = oranye, Aman = hijau.
      const COLOR: Record<string, string> = { Aman: '#00C853', Menipis: '#FFD000', Kritis: '#FF7A00', Habis: '#FF2D2D' };
      const counts: Record<string, number> = { Aman: 0, Menipis: 0, Kritis: 0, Habis: 0 };
      items.forEach(i => {
        const status = getStockStatus(i);
        if (status in counts) counts[status]++;
      });
      const labels = ORDER.filter(k => counts[k] > 0) as unknown as string[];
      const values = labels.map(k => counts[k]);
      const total = values.reduce((a, b) => a + b, 0);

      const data: ChartData<'doughnut'> = {
        labels,
        datasets: [{
          data: values,
          backgroundColor: labels.map(k => COLOR[k]),
          borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
          borderWidth: 1,
          hoverOffset: 8,
        }],
      };

      const options: ChartOptions<'doughnut'> = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        radius: '82%',
        rotation: 0,
        circumference: 360,
        animation: donutAnimationSettings,
        plugins: {
          legend: {
            display: true,
            position: 'right',
            labels: { color: textColor, font: { size: 10, weight: 'bold', family: fontFamily }, boxWidth: 12, usePointStyle: true },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.parsed}${total ? ` (${(ctx.parsed / total * 100).toFixed(1)}%)` : ''}`,
            },
          },
          datalabels: {
            display: (ctx) => Number(ctx.dataset.data[ctx.dataIndex]) > 0,
            // Label % bisa berada di atas kuning cerah â†’ pakai warna kontras otomatis.
            color: (ctx) => {
              const bg = String((ctx.dataset.backgroundColor as string[])?.[ctx.dataIndex] ?? '#fff');
              const hex = bg.replace('#', '');
              const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
              return (0.299 * r + 0.587 * g + 0.114 * b) > 170 ? '#3a2a00' : '#ffffff';
            },
            font: { size: 10, weight: 'bold', family: fontFamily },
            formatter: (v: number) => (total ? `${(v / total * 100).toFixed(0)}%` : ''),
          },
        },
      };

      if (stockStatusChart.current) {
        stockStatusChart.current.destroy();
        stockStatusChart.current = null;
      }

      stockStatusChart.current = new ChartJS(stockStatusCanvasRef.current, {
          type: 'doughnut',
          data,
          options,
          plugins: [{
            id: 'inv-center-total',
            afterDraw: (chart) => {
              const { left, right, top, bottom } = chart.chartArea;
              const ctx = chart.ctx;
              ctx.save();
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = textColor;
              ctx.font = `bold 20px ${fontFamily}`;
              ctx.fillText(String(total), (left + right) / 2, (top + bottom) / 2 - 6);
              ctx.fillStyle = textColor;
              ctx.globalAlpha = 0.6;
              ctx.font = `600 9px ${fontFamily}`;
              ctx.fillText('TOTAL ITEM', (left + right) / 2, (top + bottom) / 2 + 12);
              ctx.restore();
            },
          }],
        });
    }

    // 3. Top 10 Akan Expired < 3 Bulan (Horizontal Bar)
    if (topExpSoonCanvasRef.current) {

      const topExpSoon = items
        .filter(i => getExpiredStatus(i.tanggal_expired) === 'Kadaluarsa < 3 Bulan')
        .map(i => ({ ...i, daysLeft: getDaysUntilExpired(i.tanggal_expired) }))
        .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999))
        .slice(0, 10);

      const rawExpSoon = topExpSoon.map(i => i.name.length > 22 ? i.name.slice(0, 20) + 'â€¦' : i.name);
      const dupExpSoon = new Map<string, number>();
      const labels = rawExpSoon.map(name => {
        const n = (dupExpSoon.get(name) || 0) + 1;
        dupExpSoon.set(name, n);
        return n > 1 ? `${name} (${n})` : name;
      });
      const values = topExpSoon.map(i => i.stock || 0);

      const data: ChartData<'bar'> = {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: 'rgba(243, 156, 18, 0.62)',
            hoverBackgroundColor: 'rgba(243, 156, 18, 0.85)',
            borderWidth: 0,
            borderRadius: 4,
            maxBarThickness: 18,
          },
        ],
      };

      const options: ChartOptions<'bar'> = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: animationSettings,
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
            font: { size: 10, weight: 'bold', family: fontFamily },
            formatter: (v) => (v > 0 ? `${v}` : ''),
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grace: '15%',
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 10, family: fontFamily }, padding: 4 },
          },
          y: {
            beginAtZero: true,
            grid: { display: false },
            ticks: {
              color: textColor,
              font: { size: 10, family: fontFamily },
              padding: 4,
              autoSkip: false,
              callback: (value) => {
                const label = labels[Number(value)] ?? String(value);
                return label.length > 26 ? `${label.slice(0, 24)}â€¦` : label;
              },
            },
          },
        },
      };

      if (topExpSoonChart.current) {
        topExpSoonChart.current.destroy();
        topExpSoonChart.current = null;
      }

      topExpSoonChart.current = new ChartJS(topExpSoonCanvasRef.current, {
          type: 'bar',
          data,
          options,
        });
    }

    // 4. Top 10 Fast-Moving Items (Horizontal Bar)
    if (fastMovingCanvasRef.current) {

      const topFast = [...items]
        .sort((a, b) => (b.avg_monthly_usage || 0) - (a.avg_monthly_usage || 0))
        .slice(0, 10);

      // Label sumbu harus unik: dua item berjulukan sama (mis. "Caviplex" ganda) tidak boleh
      // bertabrakan, karena Chart.js memakai indeks baris untuk memetakan label.
      const rawFast = topFast.map(i => i.name.length > 22 ? i.name.slice(0, 20) + 'â€¦' : i.name);
      const dupFast = new Map<string, number>();
      const labels = rawFast.map(name => {
        const n = (dupFast.get(name) || 0) + 1;
        dupFast.set(name, n);
        return n > 1 ? `${name} (${n})` : name;
      });
      const values = topFast.map(i => i.avg_monthly_usage || 0);

      // Satu batang = satu item; warna bergerak halus dari oranye brand ke kuning
      // sehingga tiap batang berbeda namun tidak kontras berdekatan.
      const paletteColors = values.map((_, idx) => {
        const fade = values.length > 1 ? idx / (values.length - 1) : 0;
        return `hsl(${22 + fade * 26}, 88%, ${50 + fade * 8}%)`;
      });
      const data: ChartData<'bar'> = {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: paletteColors,
            hoverBackgroundColor: '#FF4D00',
            borderWidth: 0,
            borderRadius: 4,
            maxBarThickness: 18,
          },
        ],
      };

      const options: ChartOptions<'bar'> = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: animationSettings,
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
            font: { size: 10, weight: 'bold', family: fontFamily },
            formatter: (v) => `${v}`,
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grace: '15%',
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 10, family: fontFamily }, padding: 4 },
          },
          y: {
            beginAtZero: true,
            grid: { display: false },
            ticks: {
              color: textColor,
              font: { size: 10, family: fontFamily },
              padding: 4,
              autoSkip: false,
              callback: (value) => {
                const label = labels[Number(value)] ?? String(value);
                return label.length > 26 ? `${label.slice(0, 24)}â€¦` : label;
              },
            },
          },
        },
      };

      if (fastMovingChart.current) {
        fastMovingChart.current.destroy();
        fastMovingChart.current = null;
      }

      fastMovingChart.current = new ChartJS(fastMovingCanvasRef.current, {
          type: 'bar',
          data,
          options,
        });
    }

    // PEMICU ANIMASI EKSPLISIT â€” lihat komentar di chart-standard.ts.
    // Tanpa ini keempat diagram tampil langsung jadi (Chart.js melewati
    // animasi bila canvas baru diberi ukuran / perubahan data kecil).
    for (const inst of [topExpiredChart, stockStatusChart, topExpSoonChart, fastMovingChart]) {
      animasiUlang(inst.current);
    }

    return () => {
      // Don't destroy on every re-render, only on full unmount
    };
     
  }, [items, chartRenderKey, loading, isAuthorized, isDark, animReady]);

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
        <AnimatePresence mode="wait">
          <motion.div
            key="inventory-dashboard"
            initial={{ opacity: 0, x: -36 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -36 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ position: 'absolute', inset: 0, overflow: 'hidden', paddingRight: 28, display: 'flex', flexDirection: 'column', background: 'var(--background)' }}
            onAnimationComplete={() => setChartRenderKey(prev => prev + 1)}
          >
              {/* Header Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexShrink: 0 }}>
                <div>
                  <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--foreground)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Boxes size={18} color="var(--brand-primary, #ff4d00)" />
                    Stok Obat & BHP
                  </h1>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => loadData(true)}
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 10, flexShrink: 0 }}>
                {/* Card 1: Obat Habis */}
                <div
                  className="card glow-coral"
                  style={{ padding: '8px 10px' }}
                  title="Jumlah item dengan stok habis"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>Stok Habis</span>
                    <AlertCircle size={14} color="#FF4444" />
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#FF4444', marginTop: 2, lineHeight: 1.1 }}>
                    {habisItems.length}
                  </div>
                  <div style={{ fontSize: 10, color: habisItems.length > 0 ? '#b91c1c' : 'var(--muted-foreground)', marginTop: 2, fontWeight: 500 }}>
                    {habisItems.length > 0 ? 'Order segera' : 'Tersedia'}
                  </div>
                </div>

                {/* Card 2: Stok Kritis / Menipis */}
                <div
                  className="card glow-amber"
                  style={{ padding: '8px 10px' }}
                  title="Jumlah item dengan stok menipis"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: '#9a6b00', fontWeight: 700 }}>Stok Menipis</span>
                    <AlertTriangle size={14} color="#E6B800" />
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#E6B800', marginTop: 2, lineHeight: 1.1 }}>
                    {kritisItems.length}
                  </div>
                  <div style={{ fontSize: 10, color: '#9a6b00', marginTop: 2, fontWeight: 500 }}>
                    &lt; 3 bulan pemakaian
                  </div>
                </div>

                {/* Card 3: Top Fast-Moving Item #1 */}
                <div
                  className="card glow-teal"
                  style={{ padding: '8px 10px' }}
                  title="Item dengan pemakaian rata-rata tertinggi per bulan"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: '#00838f', fontWeight: 700 }}>Fast-Moving</span>
                    <Boxes size={14} color="#00BCD4" />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', marginTop: 4, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {topFastItem?.name || '-'}
                  </div>
                  <div style={{ fontSize: 10.5, color: '#00BCD4', marginTop: 2, fontWeight: 700 }}>
                    {topFastItem?.avg_monthly_usage || 0} {topFastItem?.unit || 'unit'}/bln
                  </div>
                </div>

                {/* Card 4: Segera Expired (< 3 Bulan) */}
                <div
                  className="card glow-orange"
                  style={{ padding: '8px 10px' }}
                  title="Jumlah item yang akan kedaluwarsa dalam 3 bulan ke depan"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: '#c2410c', fontWeight: 700 }}>Expired &lt; 3 Bln</span>
                    <Clock size={14} color="#E67E22" />
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#E67E22', marginTop: 2, lineHeight: 1.1 }}>
                    {expSoonItems.length}
                  </div>
                  <div style={{ fontSize: 10, color: '#9a3412', marginTop: 2, fontWeight: 500 }}>
                    Prioritas FEFO
                  </div>
                </div>

                {/* Card 5: Sudah Kadaluarsa */}
                <div
                  className="card glow-coral"
                  style={{ padding: '8px 10px' }}
                  title="Jumlah item yang sudah kedaluwarsa"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>Sudah Expired</span>
                    <ShieldAlert size={14} color="#dc2626" />
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626', marginTop: 2, lineHeight: 1.1 }}>
                    {expiredItems.length}
                  </div>
                  <div style={{ fontSize: 10, color: '#991b1b', marginTop: 2, fontWeight: 500 }}>
                    {expiredItems.length > 0 ? 'Tarik & Berita Acara' : 'Aman'}
                  </div>
                </div>
              </div>

              {/* Grid grafik â€” dua baris, kartu lebar agar grafik dominan */}
              <div key="charts-grid" style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1.1fr 1fr', gap: 8 }}>
        {/* Chart 1: Top Sudah Expired */}
        <div className="card mcu-dashboard-card glow-coral" data-chart="expired" style={{ padding: '3px 6px' }}>
          <div className="card-head"><div><h2>Stok Obat/BHP Expired</h2><p className="mcu-dashboard-card-sub">10 item stok terbanyak, sudah kedaluwarsa</p></div></div>
          <div className="mcu-dashboard-chart">
            <canvas ref={topExpiredCanvasRef} className="inventory-chart-canvas" />
          </div>
        </div>

        {/* Chart 2: Status Stok (donut, total di tengah) */}
        <div className="card mcu-dashboard-card glow-orange" data-chart="status" style={{ padding: '3px 6px' }}>
          <div className="card-head"><div><h2>Status Stok Obat & BHP</h2><p className="mcu-dashboard-card-sub">Aman Â· menipis Â· kritis Â· habis</p></div></div>
          <div className="mcu-dashboard-chart">
            <canvas ref={stockStatusCanvasRef} className="inventory-chart-canvas" />
          </div>
        </div>

        {/* Chart 3: Top Akan Expired < 3 Bulan */}
        <div className="card mcu-dashboard-card glow-amber" data-chart="expsoon" style={{ padding: '3px 6px' }}>
          <div className="card-head"><div><h2>Stok Akan Expired &lt; 3 Bulan</h2><p className="mcu-dashboard-card-sub">10 item terdekat masa kedaluwarsa</p></div></div>
          <div className="mcu-dashboard-chart">
            <canvas ref={topExpSoonCanvasRef} className="inventory-chart-canvas" />
          </div>
        </div>

        {/* Chart 4: Top Fast Moving */}
        <div className="card mcu-dashboard-card glow-teal" data-chart="fast" style={{ padding: '3px 6px' }}>
          <div className="card-head"><div><h2>Peringkat Fast-Moving</h2><p className="mcu-dashboard-card-sub">10 item dengan pemakaian rata-rata tertinggi per bulan</p></div></div>
          <div className="mcu-dashboard-chart">
            <canvas ref={fastMovingCanvasRef} className="inventory-chart-canvas" />
          </div>
        </div>
              </div>
      </motion.div>
      </AnimatePresence>
    </div>
  </div>
  );
}
