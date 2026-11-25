'use client';
// Dashboard > Hearing Conservation. Data dari /api/hc?resource=dashboard:
//   - Noise mapping & pengendalian area (rambu peringatan, APT) dari hc_area + hc_noise_survey
//   - Distribusi karyawan per kategori pajanan (A/B/C) dari hc_exposure_class
//   - Cakupan audiometri Kat. A & B + derajat WHO dari mcu_records
//   - Kasus & tindak lanjut STS dari hc_sts_case
// Mengikuti template Monitoring MCU & Kunjungan Berobat: 2 baris .mcu-grid-3 dengan MCUChartCard + MCUChart.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChartOptions } from 'chart.js';
import { Ear } from 'lucide-react';

import { ChartJS } from '@/lib/chart-register';
import { authFetch } from '@/lib/api-client';
import { ZONA_COLOR } from '@/lib/hc-ergo';
import { useSites } from '@/lib/site-list';
import { BAR_LAYOUT, STANDAR_ANIMASI_BAR, gradientBatangArray, skalaBar, useAnimationReady } from '@/lib/chart-standard';
import PageLoading from '@/components/ui/page-loading';
import { MCUChart, MCUChartCard, MCURefreshButton } from '@/components/dashboard/MCUDashboardShared';

type D = Record<string, any>;

const KELAS_COLOR: Record<string, string> = {
  Normal: '#00B894',
  Ringan: '#F5C518',
  Sedang: '#F5A623',
  Berat: '#FF6B35',
  'Sangat Berat': '#E63946',
};
const KELAS_ORDER = ['Normal', 'Ringan', 'Sedang', 'Berat', 'Sangat Berat'];
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export default function HearingConservationDashboard() {
  const { sites: daftarSite } = useSites();
  const [d, setD] = useState<D | null>(null);
  const [site, setSite] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );

  const cakupanRef = useRef<HTMLCanvasElement | null>(null);
  const cakupanChartRef = useRef<ChartJS | null>(null);

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
      const r = await authFetch(`/api/hc?resource=dashboard&site=${encodeURIComponent(site)}`);
      setD(r.data as D);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat dashboard');
    } finally {
      setLoading(false);
    }
  }, [site]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const animReady = useAnimationReady([d]);

  // Stacked horizontal bar untuk Cakupan Audiometri Kategori A & B
  useEffect(() => {
    if (!d || !animReady || !cakupanRef.current) return;
    const cak = ((d.cakupan || []) as D[]).filter((c) => c.kategori === 'A' || c.kategori === 'B');
    const totalWajib = cak.reduce((s, c) => s + Number(c.total ?? 0), 0);
    if (totalWajib === 0) {
      cakupanChartRef.current?.destroy();
      cakupanChartRef.current = null;
      return;
    }

    const text = isDark ? '#F9FAFB' : '#111827';
    const grid = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const labels = cak.map((c) => `Kategori ${c.kategori}`);
    const sudahData = cak.map((c) => Number(c.sudahTahunIni ?? 0));
    const belumData = cak.map((c) => Math.max(0, Number(c.total ?? 0) - Number(c.sudahTahunIni ?? 0)));

    cakupanChartRef.current?.destroy();
    cakupanChartRef.current = new ChartJS(cakupanRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Sudah Tahun Ini',
            data: sudahData,
            backgroundColor: gradientBatangArray(['#00B894'], true) as never,
            borderRadius: 4,
            ...BAR_LAYOUT,
          },
          {
            label: 'Belum Tahun Ini',
            data: belumData,
            backgroundColor: gradientBatangArray(['#FF2D2D'], true) as never,
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
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { color: text, font: { size: 10, weight: 'bold', family: FONT }, boxWidth: 12, usePointStyle: true },
          },
          datalabels: {
            color: '#FFFFFF',
            anchor: 'center',
            align: 'center',
            font: { size: 10, weight: 'bold', family: FONT },
            formatter: (v: number) => (v > 0 ? String(v) : ''),
          },
        },
        scales: (() => {
          const s = skalaBar({
            horizontal: true,
            textColor: text,
            gridColor: grid,
            fontFamily: FONT,
            labelOf: (idx) => labels[idx] ?? '',
          }) as Record<string, any>;
          if (s.x) s.x.stacked = true;
          if (s.y) s.y.stacked = true;
          return s;
        })(),
      } as ChartOptions<'bar'>,
    });

    return () => {
      cakupanChartRef.current?.destroy();
      cakupanChartRef.current = null;
    };
  }, [d, isDark, animReady]);

  if (loading && !d) return <PageLoading label="Memuat Konservasi Pendengaran" />;

  if (!d) {
    return (
      <div className="dashboard mcu-live-dashboard" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 12 }}>
          {err || 'Data Konservasi Pendengaran tidak tersedia.'}
        </div>
      </div>
    );
  }

  const zonaVals = [
    Number(d.zona?.MERAH ?? 0),
    Number(d.zona?.KUNING ?? 0),
    Number(d.zona?.HIJAU ?? 0),
    Number(d.zona?.BELUM ?? 0),
  ];
  const nAreaTot = zonaVals.reduce((a, b) => a + b, 0);

  const cakupanList = (d.cakupan || []) as D[];
  const cakTotal = cakupanList.reduce((s, c) => s + Number(c.total ?? 0), 0);

  const katA = Number(d.kategori?.A ?? 0);
  const katB = Number(d.kategori?.B ?? 0);
  const katC = Number(d.kategori?.C ?? 0);
  const katTotal = katA + katB + katC;

  const kelasMap = (d.kelas || {}) as Record<string, number>;
  const kelasLabels = KELAS_ORDER.filter((k) => Number(kelasMap[k] ?? 0) > 0 || kelasMap[k] === 0);

  const kendali = d.pengendalian ?? { totalWajib: 0, rambuTerpasang: 0, rambuBelum: 0, aptTersedia: 0, aptBelum: 0 };
  const stsTotal =
    Number(d.sts?.suspek ?? 0) +
    Number(d.sts?.retestDijadwalkan ?? 0) +
    Number(d.sts?.terkonfirmasi ?? 0) +
    Number(d.sts?.retestTerlambat ?? 0);

  return (
    <div className="dashboard mcu-live-dashboard">
      {/* ── Top Bar: Filter & KPI Audit (pola Monitoring MCU) ─────────── */}
      <div className="dashboard-top-bar mcu-live-top-bar">
        <div className="mcu-dashboard-filters">
          <label>
            <span>Site</span>
            <select
              value={site}
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
              <option value="">Semua Site</option>
              {daftarSite.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mcu-total-bar">
          <span>Zona Merah <b style={{ color: ZONA_COLOR.MERAH }}>{d.zona?.MERAH ?? 0}</b>/{nAreaTot}</span>
          <span>Ukur Terlambat <b style={{ color: d.areaTerlambat ? '#E63946' : 'inherit' }}>{d.areaTerlambat ?? 0}</b></span>
          <span>STS Blm Ditindak <b style={{ color: d.sts?.belumDitindaklanjuti ? '#E63946' : 'inherit' }}>{d.sts?.belumDitindaklanjuti ?? 0}</b></span>
          <span>Audio Tdk Lengkap <b style={{ color: d.audiometri?.tidakLengkap ? '#d97706' : 'inherit' }}>{d.audiometri?.tidakLengkap ?? 0}</b></span>
          <span>Retest Terlambat <b style={{ color: d.sts?.retestTerlambat ? '#E63946' : 'inherit' }}>{d.sts?.retestTerlambat ?? 0}</b></span>
          <MCURefreshButton loading={loading} onClick={() => void loadData()} />
        </div>
      </div>

      {err && (
        <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 11 }}>
          {err}
        </div>
      )}

      {/* ── BARIS 1: Zona Area, Cakupan Audiometri A/B & Pajanan Karyawan ─ */}
      <div className="mcu-grid-3 mcu-live-chart-row">
        <MCUChartCard
          title="Zona Kebisingan Area"
          subtitle="Pengukuran terakhir (NAB 85 dBA)"
          className="glow-coral"
        >
          {nAreaTot > 0 ? (
            <MCUChart
              type="doughnut"
              labels={['Merah', 'Kuning', 'Hijau', 'Belum Diukur']}
              values={zonaVals}
              colors={['#E63946', '#F5C518', '#00B894', '#B0B7C3']}
              centerText={String(nAreaTot)}
              percentLabels
            />
          ) : (
            <Kosong label="Belum ada data area kebisingan" />
          )}
        </MCUChartCard>

        <MCUChartCard
          title="Cakupan Audiometri (Kat. A & B)"
          subtitle="Wajib tahunan (A >85 dBA) & berkala (B 82–85 dBA)"
          className="glow-teal"
        >
          {cakTotal > 0 ? (
            <div className="mcu-dashboard-chart"><canvas ref={cakupanRef} /></div>
          ) : (
            <Kosong label="Belum ada karyawan Kategori A/B" />
          )}
        </MCUChartCard>

        <MCUChartCard
          title="Karyawan per Kategori Pajanan"
          subtitle="A (>85 dBA) · B (82–85 dBA) · C (<82 dBA)"
          className="glow-amber"
        >
          {katTotal > 0 ? (
            <MCUChart
              type="doughnut"
              labels={['Kat. A (>85 dBA)', 'Kat. B (82–85 dBA)', 'Kat. C (<82 dBA)']}
              values={[katA, katB, katC]}
              colors={['#E63946', '#F5C518', '#00B894']}
              centerText={String(katTotal)}
              percentLabels
            />
          ) : (
            <Kosong label="Belum ada klasifikasi pajanan karyawan" />
          )}
        </MCUChartCard>
      </div>

      {/* ── BARIS 2: Derajat WHO, Pengendalian Rambu/APT & Kasus STS ───── */}
      <div className="mcu-grid-3 mcu-live-chart-row">
        <MCUChartCard
          title="Derajat Gangguan Pendengaran"
          subtitle="Klasifikasi WHO · telinga yang lebih baik"
          className="glow-steel"
        >
          {kelasLabels.length > 0 ? (
            <MCUChart
              type="bar"
              labels={kelasLabels}
              values={kelasLabels.map((k) => Number(kelasMap[k] ?? 0))}
              colors={kelasLabels.map((k) => KELAS_COLOR[k] || '#778899')}
              legendLabel="Karyawan"
            />
          ) : (
            <Kosong label="Belum ada data derajat audiometri" />
          )}
        </MCUChartCard>

        <MCUChartCard
          title="Pengendalian Area (Rambu & APT)"
          subtitle={`Area Zona Kuning/Merah (${kendali.totalWajib} area wajib kendali)`}
          className="glow-teal"
        >
          {kendali.totalWajib > 0 ? (
            <MCUChart
              type="bar"
              horizontal
              labels={['Rambu Terpasang', 'Rambu Belum', 'APT Tersedia', 'APT Belum']}
              values={[kendali.rambuTerpasang, kendali.rambuBelum, kendali.aptTersedia, kendali.aptBelum]}
              colors={['#00B894', '#FF2D2D', '#2E86DE', '#F5A623']}
              legendLabel="Jumlah Area"
            />
          ) : (
            <Kosong label="Belum ada area Zona Kuning/Merah terukur" />
          )}
        </MCUChartCard>

        <MCUChartCard
          title="Kasus & Tindak Lanjut STS"
          subtitle="Suspek, retest dijadwalkan, terkonfirmasi, terlambat"
          className="glow-orange"
        >
          {stsTotal > 0 ? (
            <MCUChart
              type="bar"
              labels={['Suspek', 'Retest', 'Konfirmasi', 'Terlambat']}
              values={[
                Number(d.sts?.suspek ?? 0),
                Number(d.sts?.retestDijadwalkan ?? 0),
                Number(d.sts?.terkonfirmasi ?? 0),
                Number(d.sts?.retestTerlambat ?? 0),
              ]}
              colors={['#E63946', '#F5A623', '#8E44AD', '#B91C1C']}
              legendLabel="Kasus STS"
            />
          ) : (
            <Kosong label="Belum ada kasus STS tercatat" />
          )}
        </MCUChartCard>
      </div>
    </div>
  );
}

function Kosong({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted-foreground)', gap: 6 }}>
      <Ear size={28} style={{ opacity: 0.3 }} />
      <span style={{ fontSize: 11 }}>{label}</span>
    </div>
  );
}
