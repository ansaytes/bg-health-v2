'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  Chart as ChartJS,
  registerables,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { fetchDashboardData } from '@/lib/dashboard-data';
import { BAR_LAYOUT, STANDAR_ANIMASI, STANDAR_ANIMASI_BAR, STANDAR_ANIMASI_DONUT, animasiUlang, useAnimationReady, warnaBar } from '@/lib/chart-standard';

// Register Chart.js plugins and all controllers/scales/elements
ChartJS.register(...registerables, ChartDataLabels);

interface KunjunganRecord {
  id: string;
  nik: string | null;
  nama: string;
  departemen: string | null;
  jobsite: string;
  tanggal: string;
  usia?: number | null;
  jk?: string | null;
  jabatan?: string | null;
  keluhan?: string | null;
  diagnosa: string | null;
  jenis_obat: string | null;
  rujuk_rs: boolean;
  nama_rs: string | null;
}

const BULAN_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const BULAN_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

function getWeekOfMonth(dateStr: string): number {
  if (!dateStr) return 1;
  const d = new Date(dateStr);
  const day = d.getDate();
  return Math.min(5, Math.max(1, Math.ceil(day / 7)));
}

function parseArrayField(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch {
        // fallback
      }
    }
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

interface MedItem {
  nama: string;
  aturan?: string;
  jumlah?: string | number;
}

/**
 * Nama singkat departemen untuk SUMBU diagram.
 * Nama panjang memakan hampir seluruh lebar kartu, sehingga label singkat di
 * dalam kurung yang dipakai. Departemen di luar daftar ditampilkan apa adanya.
 */
const DEPT_SHORT: { match: RegExp; short: string }[] = [
  { match: /^plant$/i, short: 'Plant' },
  { match: /^supply\s*chain/i, short: 'SCM' },
  { match: /^quality$/i, short: 'Quality' },
  { match: /^qshe|safety,?\s*health/i, short: 'QSHE' },
  { match: /^operation/i, short: 'Operation' },
  { match: /^human\s*capital|^hcgs/i, short: 'HCGS' },
  { match: /^training|^tdc/i, short: 'TDC' },
  { match: /^finance|^fat$/i, short: 'FAT' },
  { match: /^management$/i, short: 'Management' },
  { match: /^lainnya|^magang|^intern/i, short: 'Lainnya' },
];

function deptShortName(raw: string): string {
  const name = raw.trim();
  if (!name) return 'Lainnya';
  return DEPT_SHORT.find((d) => d.match.test(name))?.short ?? name;
}

function parseMedications(val: unknown): MedItem[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // fallback
      }
    }
  }
  return [];
}

export default function KunjunganBerobat() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rujukVisible, setRujukVisible] = useState(false);
  const [records, setRecords] = useState<KunjunganRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );

  // Filters
  const [selectedBulan, setSelectedBulan] = useState<string>('all');
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [selectedDept, setSelectedDept] = useState<string>('all');

  // Chart canvas refs
  const trendCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ulangCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const diagCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const obatCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const deptCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Chart instances
  const trendChartInst = useRef<ChartJS | null>(null);
  const ulangChartInst = useRef<ChartJS | null>(null);
  const diagChartInst = useRef<ChartJS | null>(null);
  const obatChartInst = useRef<ChartJS | null>(null);
  const deptChartInst = useRef<ChartJS | null>(null);

  // Chart hanya dibuat setelah halaman selesai transisi masuk (double RAF).
  // Tanpa ini animasi Chart.js selesai sebelum container terlihat pengguna,
  // sehingga diagram tampak statis / tidak beranimasi.
  const animReady = useAnimationReady([]);

  useEffect(() => {
    return () => {
      // Cleanup on full unmount
      if (trendChartInst.current) trendChartInst.current.destroy();
      if (ulangChartInst.current) ulangChartInst.current.destroy();
      if (diagChartInst.current) diagChartInst.current.destroy();
      if (obatChartInst.current) obatChartInst.current.destroy();
      if (deptChartInst.current) deptChartInst.current.destroy();
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDark(root.classList.contains('dark'));
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Scroll detection for Rujuk RS section
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop > 30) {
        setRujukVisible(true);
      } else {
        setRujukVisible(false);
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Fetch visit records
  const loadData = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const json = await fetchDashboardData<{ success: boolean; data?: KunjunganRecord[] }>('/api/kunjungan', force);
      if (json.success && Array.isArray(json.data)) {
        setRecords(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch kunjungan data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Unique departments for filter dropdown
  const departmentOptions = useMemo(() => {
    const depts = new Set<string>();
    records.forEach(r => {
      if (r.departemen && r.departemen.trim()) {
        depts.add(r.departemen.trim());
      }
    });
    return Array.from(depts).sort((a, b) => a.localeCompare(b));
  }, [records]);

  // Filtered dataset
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (!r.tanggal) return false;
      const d = new Date(r.tanggal);
      const monthNum = d.getMonth() + 1;
      const weekNum = getWeekOfMonth(r.tanggal);

      if (selectedBulan !== 'all' && monthNum !== parseInt(selectedBulan, 10)) {
        return false;
      }
      if (selectedWeek !== 'all' && weekNum !== parseInt(selectedWeek, 10)) {
        return false;
      }
      if (selectedDept !== 'all' && (r.departemen || '').trim() !== selectedDept) {
        return false;
      }
      return true;
    });
  }, [records, selectedBulan, selectedWeek, selectedDept]);

  // Top bar metrics
  const totalKunjungan = filteredRecords.length;
  const pasienUnik = useMemo(() => {
    const unique = new Set(filteredRecords.map(r => (r.nama || '').trim().toLowerCase()));
    return unique.size;
  }, [filteredRecords]);

  const rujukList = useMemo(() => {
    return filteredRecords.filter(r => r.rujuk_rs === true || !!r.nama_rs);
  }, [filteredRecords]);

  const totalRujukRS = rujukList.length;

  useEffect(() => {
    if (loading || !animReady) return;

    // ANIMASI STANDAR APLIKASI: selalu berjalan (chart selalu dibuat ulang
    // saat data berubah, dan dibuat baru saat pertama tampil).
    const animationSettings = STANDAR_ANIMASI_BAR;
    const lineAnimationSettings = STANDAR_ANIMASI;

      // Common theme colors
      const textColor = isDark ? '#F9FAFB' : '#111827';
      const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
      const fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

      // ───────────────────────────────────────────────
      // 1. TREN KUNJUNGAN PER BULAN (Line Chart)
      // ───────────────────────────────────────────────
      if (trendCanvasRef.current) {

      // Group by month (1..12) from all or filtered dataset
      const monthlyCounts = new Array(12).fill(0);
      // To see the trend of the whole year, use records filtered by Dept/Week, or overall
      const sourceForTrend = selectedDept !== 'all'
        ? records.filter(r => (r.departemen || '').trim() === selectedDept)
        : records;

      sourceForTrend.forEach(r => {
        if (!r.tanggal) return;
        const m = new Date(r.tanggal).getMonth();
        if (m >= 0 && m < 12) monthlyCounts[m]++;
      });

      const trendData: ChartData<'line'> = {
        labels: BULAN_SHORT,
        datasets: [
          {
            label: 'Kunjungan',
            data: monthlyCounts,
            borderColor: '#ff4d00',
            backgroundColor: 'rgba(255, 77, 0, 0.12)',
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 7,
            pointBackgroundColor: '#ff4d00',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
          },
        ],
      };

      const trendOptions: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        // Line animasi standar aplikasi: tumbuh dari kiri ke kanan.
        animation: { ...STANDAR_ANIMASI, duration: 1000 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 8,
            titleFont: { size: 11, family: fontFamily },
            bodyFont: { size: 12, weight: 'bold', family: fontFamily },
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.y} kunjungan`,
            },
          },
          datalabels: {
            display: (ctx) => {
              const val = ctx.dataset.data[ctx.dataIndex];
              return typeof val === 'number' && val > 0;
            },
            align: 'top',
            anchor: 'end',
            offset: 2,
            color: textColor,
            font: { size: 10, weight: 'bold', family: fontFamily },
            formatter: (val) => val,
          },
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 10, family: fontFamily } },
          },
          y: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { size: 10, family: fontFamily },
              precision: 0,
            },
          },
        },
      };

      // Chart selalu dibuat ulang — animasi dari nol dijamin berjalan.
      if (trendChartInst.current) {
        trendChartInst.current.destroy();
        trendChartInst.current = null;
      }
      trendChartInst.current = new ChartJS(trendCanvasRef.current, {
        type: 'line',
        data: trendData,
        options: trendOptions,
      });
    }

      // ───────────────────────────────────────────────
      // 2. PASIEN KUNJUNGAN BERULANG (Horizontal Bar)
      // ───────────────────────────────────────────────
      if (ulangCanvasRef.current) {

      const patientCounts: Record<string, { nama: string; dept: string; count: number }> = {};
      filteredRecords.forEach(r => {
        const key = (r.nama || '').trim();
        if (!key) return;
        if (!patientCounts[key]) {
          patientCounts[key] = { nama: key, dept: r.departemen || '', count: 0 };
        }
        patientCounts[key].count++;
      });

      // Filter patients with >1 visits
      const repeatPatients = Object.values(patientCounts)
        .filter(p => p.count > 1)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const labels = repeatPatients.map(p => p.nama);
      const dataValues = repeatPatients.map(p => p.count);

      const ulangData: ChartData<'bar'> = {
        labels: labels.length > 0 ? labels : ['Belum ada kunjungan berulang'],
        datasets: [
          {
            label: 'Jumlah Kunjungan',
            data: labels.length > 0 ? dataValues : [0],
            // Warna berbeda per batang, harmonis (tidak kontras berdekatan).
            backgroundColor: (labels.length > 0 ? dataValues : [0]).map((_, i) => warnaBar(i)),
            hoverBackgroundColor: '#FF8C42',
            borderRadius: 4,
            ...BAR_LAYOUT,
          },
        ],
      };

      const ulangOptions: ChartOptions<'bar'> = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: animationSettings,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.x}x kunjungan`,
            },
          },
          datalabels: {
            display: labels.length > 0,
            anchor: 'end',
            align: 'right',
            color: textColor,
            font: { size: 10, weight: 'bold', family: fontFamily },
            formatter: (val) => `${val}x`,
            clamp: true,
            clip: false,
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grace: '12%',
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 10, family: fontFamily }, precision: 0 },
            title: { display: true, text: 'Jumlah kunjungan', color: textColor, font: { size: 9, weight: 'bold' as const, family: fontFamily } },
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: textColor,
              font: { size: 9, family: fontFamily },
              autoSkip: false,
            },
            title: { display: true, text: 'Nama pasien', color: textColor, font: { size: 9, weight: 'bold' as const, family: fontFamily } },
          },
        },
      };

      if (ulangChartInst.current) {
        ulangChartInst.current.destroy();
        ulangChartInst.current = null;
      }

      ulangChartInst.current = new ChartJS(ulangCanvasRef.current, {
          type: 'bar',
          data: ulangData,
          options: ulangOptions,
        });
    }

    // ───────────────────────────────────────────────
    // 3. TOP 10 DIAGNOSA (Horizontal Bar)
    // ───────────────────────────────────────────────
    if (diagCanvasRef.current) {

      const diagCounts: Record<string, number> = {};
      filteredRecords.forEach(r => {
        const diagList = parseArrayField(r.diagnosa);
        diagList.forEach(d => {
          const clean = d.trim();
          if (clean && clean !== '-' && clean !== '[]') {
            diagCounts[clean] = (diagCounts[clean] || 0) + 1;
          }
        });
      });

      const topDiag = Object.entries(diagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      const diagLabels = topDiag.map(([k]) => k);
      const diagValues = topDiag.map(([, v]) => v);

      const diagData: ChartData<'bar'> = {
        labels: diagLabels.length > 0 ? diagLabels : ['Belum ada diagnosa'],
        datasets: [
          {
            label: 'Kasus',
            data: diagLabels.length > 0 ? diagValues : [0],
            backgroundColor: (diagLabels.length > 0 ? diagValues : [0]).map((_, i) => warnaBar(i)),
            hoverBackgroundColor: '#E91E63',
            borderRadius: 4,
            ...BAR_LAYOUT,
          },
        ],
      };

      const diagOptions: ChartOptions<'bar'> = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: animationSettings,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.x} kasus`,
            },
          },
          datalabels: {
            display: diagLabels.length > 0,
            anchor: 'end',
            align: 'right',
            color: textColor,
            font: { size: 10, weight: 'bold', family: fontFamily },
            formatter: (val) => `${val}`,
            clamp: true,
            clip: false,
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grace: '12%',
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 10, family: fontFamily }, precision: 0 },
            title: { display: true, text: 'Jumlah kasus', color: textColor, font: { size: 9, weight: 'bold' as const, family: fontFamily } },
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: textColor,
              font: { size: 10, family: fontFamily },
              callback: function(val) {
                const label = this.getLabelForValue(Number(val));
                return label.length > 22 ? label.slice(0, 20) + '...' : label;
              },
            },
            title: { display: true, text: 'Diagnosa', color: textColor, font: { size: 9, weight: 'bold' as const, family: fontFamily } },
          },
        },
      };

      if (diagChartInst.current) {
        diagChartInst.current.destroy();
        diagChartInst.current = null;
      }

      diagChartInst.current = new ChartJS(diagCanvasRef.current, {
          type: 'bar',
          data: diagData,
          options: diagOptions,
        });
    }

    // ───────────────────────────────────────────────
    // 4. TOP 10 JENIS OBAT KELUAR (Horizontal Bar)
    // ───────────────────────────────────────────────
    if (obatCanvasRef.current) {

      const obatCounts: Record<string, number> = {};
      filteredRecords.forEach(r => {
        const meds = parseMedications(r.jenis_obat);
        meds.forEach(m => {
          const cleanName = (m.nama || '').trim();
          if (cleanName && cleanName.toLowerCase() !== 'rujuk rs') {
            const qty = parseInt(String(m.jumlah || '1'), 10) || 1;
            obatCounts[cleanName] = (obatCounts[cleanName] || 0) + qty;
          }
        });
      });

      const topObat = Object.entries(obatCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      const obatLabels = topObat.map(([k]) => k);
      const obatValues = topObat.map(([, v]) => v);

      const obatData: ChartData<'bar'> = {
        labels: obatLabels.length > 0 ? obatLabels : ['Belum ada resep obat'],
        datasets: [
          {
            label: 'Jumlah Keluar',
            data: obatLabels.length > 0 ? obatValues : [0],
            backgroundColor: (obatLabels.length > 0 ? obatValues : [0]).map((_, i) => warnaBar(i)),
            hoverBackgroundColor: '#00BCD4',
            borderRadius: 4,
            ...BAR_LAYOUT,
          },
        ],
      };

      const obatOptions: ChartOptions<'bar'> = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: animationSettings,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.x} pcs/tablet`,
            },
          },
          datalabels: {
            display: obatLabels.length > 0,
            anchor: 'end',
            align: 'right',
            color: textColor,
            font: { size: 10, weight: 'bold', family: fontFamily },
            formatter: (val) => `${val}`,
            clamp: true,
            clip: false,
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grace: '12%',
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 10, family: fontFamily }, precision: 0 },
            title: { display: true, text: 'Jumlah keluar (pcs/tablet)', color: textColor, font: { size: 9, weight: 'bold' as const, family: fontFamily } },
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: textColor,
              font: { size: 10, family: fontFamily },
              callback: function(val) {
                const label = this.getLabelForValue(Number(val));
                return label.length > 22 ? label.slice(0, 20) + '...' : label;
              },
            },
            title: { display: true, text: 'Jenis obat', color: textColor, font: { size: 9, weight: 'bold' as const, family: fontFamily } },
          },
        },
      };

      if (obatChartInst.current) {
        obatChartInst.current.destroy();
        obatChartInst.current = null;
      }

      obatChartInst.current = new ChartJS(obatCanvasRef.current, {
          type: 'bar',
          data: obatData,
          options: obatOptions,
        });
    }

    // ───────────────────────────────────────────────
    // 5. DISTRIBUSI DEPARTMENT (Horizontal Bar)
    // ───────────────────────────────────────────────
    if (deptCanvasRef.current) {

      const deptCounts: Record<string, number> = {};
      filteredRecords.forEach(r => {
        const d = deptShortName(r.departemen || '') || 'Lainnya';
        deptCounts[d] = (deptCounts[d] || 0) + 1;
      });

      const topDept = Object.entries(deptCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      const deptLabels = topDept.map(([k]) => k);
      const deptValues = topDept.map(([, v]) => v);

      const deptData: ChartData<'bar'> = {
        labels: deptLabels.length > 0 ? deptLabels : ['Belum ada departemen'],
        datasets: [
          {
            label: 'Kunjungan',
            data: deptLabels.length > 0 ? deptValues : [0],
            backgroundColor: (deptLabels.length > 0 ? deptValues : [0]).map((_, i) => warnaBar(i)),
            hoverBackgroundColor: '#9B59B6',
            borderRadius: 4,
            ...BAR_LAYOUT,
          },
        ],
      };

      const deptOptions: ChartOptions<'bar'> = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: animationSettings,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.x} kunjungan`,
            },
          },
          datalabels: {
            display: deptLabels.length > 0,
            anchor: 'end',
            align: 'right',
            color: textColor,
            font: { size: 10, weight: 'bold', family: fontFamily },
            formatter: (val) => `${val}`,
            clamp: true,
            clip: false,
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grace: '12%',
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 10, family: fontFamily }, precision: 0 },
            title: { display: true, text: 'Jumlah kunjungan', color: textColor, font: { size: 9, weight: 'bold' as const, family: fontFamily } },
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: textColor,
              font: { size: 10, family: fontFamily },
              autoSkip: false,
              callback: function(val) {
                const label = this.getLabelForValue(Number(val));
                return label.length > 22 ? label.slice(0, 20) + '...' : label;
              },
            },
            title: { display: true, text: 'Departemen', color: textColor, font: { size: 9, weight: 'bold' as const, family: fontFamily } },
          },
        },
      };

      if (deptChartInst.current) {
        deptChartInst.current.destroy();
        deptChartInst.current = null;
      }

      deptChartInst.current = new ChartJS(deptCanvasRef.current, {
          type: 'bar',
          data: deptData,
          options: deptOptions,
        });
    }

    // PEMICU ANIMASI EKSPLISIT — lihat komentar di chart-standard.ts.
    // Chart.js melewati animasi bila canvas baru memperoleh ukuran atau bila
    // perubahan data dianggap kecil. reset()+update() memaksa kelima diagram
    // tumbuh dari keadaan kosong, sama seperti diagram ASR (yang berhasil)
    // karena ia menggambar ulang sendiri per requestAnimationFrame.
    for (const inst of [trendChartInst, ulangChartInst, diagChartInst, obatChartInst, deptChartInst]) {
      animasiUlang(inst.current);
    }

    return () => {
      // Don't destroy on every re-render, only on full unmount
    };
     
  }, [filteredRecords, records, selectedDept, loading, isDark, animReady]);

  return (
    <div className="dashboard" ref={containerRef} style={{ overflowY: 'auto', overflowX: 'hidden' }}>
      {/* Top Bar with Filters and Metrics */}
      <div className="kunjungan-top-bar" style={{ flexShrink: 0, paddingBottom: 6 }}>
        <div className="kunjungan-filter-bar">
          <div className="filter-tag">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Filter
          </div>

          {/* Filter Bulan */}
          <select
            value={selectedBulan}
            onChange={(e) => setSelectedBulan(e.target.value)}
            className="admin-filter-select"
          >
            <option value="all">Semua Bulan</option>
            {BULAN_NAMES.map((name, idx) => (
              <option key={name} value={String(idx + 1)}>
                {name}
              </option>
            ))}
          </select>

          {/* Filter Week */}
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="admin-filter-select"
          >
            <option value="all">Semua Week</option>
            <option value="1">Week 1 (Tgl 1-7)</option>
            <option value="2">Week 2 (Tgl 8-14)</option>
            <option value="3">Week 3 (Tgl 15-21)</option>
            <option value="4">Week 4 (Tgl 22-28)</option>
            <option value="5">Week 5 (Tgl 29-31)</option>
          </select>

          {/* Filter Departemen */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="admin-filter-select"
          >
            <option value="all">Semua Departemen</option>
            {departmentOptions.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => loadData(true)}
            title="Refresh Data"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--brand-primary, #ff4d00)',
              display: 'flex',
              alignItems: 'center',
              padding: '2px 4px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </button>
        </div>

        {/* Counter Summary */}
        <div className="kunjungan-total-right">
          <span className="mcu-total-label">Total Kunjungan:</span>
          <span className="mcu-total-num" style={{ color: '#ff4d00', fontWeight: 800 }}>
            {totalKunjungan}
          </span>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span style={{ color: '#00B894', fontWeight: 700 }}>
            Pasien Unik: {pasienUnik}
          </span>
          <span style={{ marginLeft: 8, color: '#FF4444', fontWeight: 700 }}>
            Rujuk RS: {totalRujukRS}
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="kunjungan-scroll-content">
        {/* Fill wrapper — 2 rows of charts */}
        <div className="kunjungan-chart-layout" style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
          {/* Row 1 — 2 cards: Tren & Pasien Berulang */}
          <div className="kunjungan-trend-row">
            <div className="card glow-orange">
              <div className="card-head">
                <div className="card-icon" style={{ background: 'rgba(255,77,0,.1)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#ff4d00" strokeWidth="2" strokeLinecap="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
                <div>
                  <h2>Tren Kunjungan per Bulan</h2>
                  <p>Jumlah kunjungan klinik sepanjang tahun 2026</p>
                </div>
              </div>
              <div className="chart-box" style={{ position: 'relative', width: '100%', height: '100%', minHeight: 180 }}>
                <canvas ref={trendCanvasRef} />
              </div>
            </div>

            <div className="card glow-amber">
              <div className="card-head">
                <div className="card-icon" style={{ background: 'rgba(255,140,66,.1)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#ff8c42" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                </div>
                <div>
                  <h2>Pasien Kunjungan Berulang</h2>
                  <p>Pasien yang berkunjung lebih dari satu kali</p>
                </div>
              </div>
              <div className="chart-box" style={{ position: 'relative', width: '100%', height: '100%', minHeight: 180 }}>
                <canvas ref={ulangCanvasRef} />
              </div>
            </div>
          </div>

          {/* Row 2 — 3 cards: Top Diagnosa, Top Obat, Distribusi Dept */}
          <div className="kunjungan-row-charts">
            <div className="card glow-coral">
              <div className="card-head">
                <div className="card-icon" style={{ background: 'rgba(255,99,71,.1)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#ff6347" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                </div>
                <div>
                  <h2>Top 10 Diagnosa</h2>
                  <p>Diagnosa terbanyak dari kunjungan</p>
                </div>
              </div>
              <div className="chart-box" style={{ position: 'relative', width: '100%', height: '100%', minHeight: 180 }}>
                <canvas ref={diagCanvasRef} />
              </div>
            </div>

            <div className="card glow-teal">
              <div className="card-head">
                <div className="card-icon" style={{ background: 'rgba(0,184,148,.1)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#00B894" strokeWidth="2" strokeLinecap="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
                <div>
                  <h2>Top 10 Jenis Obat Keluar</h2>
                  <p>Agregasi jumlah obat per jenis terapi</p>
                </div>
              </div>
              <div className="chart-box" style={{ position: 'relative', width: '100%', height: '100%', minHeight: 180 }}>
                <canvas ref={obatCanvasRef} />
              </div>
            </div>

            <div className="card glow-steel">
              <div className="card-head">
                <div className="card-icon" style={{ background: 'rgba(119,136,153,.1)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#778899" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                  </svg>
                </div>
                <div>
                  <h2>Distribusi Department</h2>
                  <p>Kunjungan berdasarkan departemen</p>
                </div>
              </div>
              <div className="chart-box" style={{ position: 'relative', width: '100%', height: '100%', minHeight: 180 }}>
                <canvas ref={deptCanvasRef} />
              </div>
            </div>
          </div>
        </div>

        {/* Row 3 — Rujuk RS Section (slides up on scroll or toggle) */}
        <div
          className={"kunjungan-rujuk-section" + (rujukVisible ? ' visible' : '')}
          style={{ marginTop: 12, paddingBottom: 20 }}
        >
          <div className="card glow-coral" style={{ display: 'flex', flexDirection: 'column', minHeight: 240, flex: 1 }}>
            <div className="card-head" style={{ flexShrink: 0, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="card-icon" style={{ background: 'rgba(255,68,68,.1)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#FF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                </div>
                <div>
                  <h2>Detail Karyawan Rujuk RS ({rujukList.length})</h2>
                  <p>Daftar pasien yang memerlukan rujukan ke rumah sakit</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setRujukVisible(prev => !prev)}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 11,
                  color: 'var(--muted-foreground)',
                  cursor: 'pointer',
                }}
              >
                {rujukVisible ? 'Sembunyikan' : 'Tampilkan'}
              </button>
            </div>

            <div className="rujuk-table-wrap" style={{ marginTop: 8 }}>
              {rujukList.length === 0 ? (
                <div className="rujuk-empty">
                  Tidak ada data karyawan yang dirujuk ke RS pada filter yang dipilih.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--accent-light, rgba(255,77,0,0.04))', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--foreground)' }}>No</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--foreground)' }}>Tanggal</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--foreground)' }}>NIK</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--foreground)' }}>Nama Pasien</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--foreground)' }}>Usia</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--foreground)' }}>JK</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--foreground)' }}>Jabatan</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--foreground)' }}>Departemen</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--foreground)' }}>Diagnosa</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--foreground)' }}>RS Rujukan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rujukList.map((row, idx) => (
                      <tr
                        key={row.id || idx}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          transition: 'background 0.12s',
                        }}
                      >
                        <td style={{ padding: '8px 10px', color: 'var(--muted-foreground)' }}>{idx + 1}</td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{row.tanggal || '-'}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: row.nik ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                          {row.nik || '(Tanpa NIK)'}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--foreground)' }}>{row.nama}</td>
                        <td style={{ padding: '8px 10px' }}>{row.usia ? `${row.usia} th` : '-'}</td>
                        <td style={{ padding: '8px 10px' }}>{row.jk || '-'}</td>
                        <td style={{ padding: '8px 10px' }}>{row.jabatan || '-'}</td>
                        <td style={{ padding: '8px 10px' }}>{row.departemen || '-'}</td>
                        <td style={{ padding: '8px 10px', color: '#ff4d00', fontWeight: 500 }}>
                          {parseArrayField(row.diagnosa).join(', ') || '-'}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: '#dc2626' }}>
                          {row.nama_rs || 'Rujuk RS'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
