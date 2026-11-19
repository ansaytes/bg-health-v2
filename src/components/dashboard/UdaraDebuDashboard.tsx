'use client';

// ============================================================
// Dashboard > Higiene Industri > Kualitas Udara & Debu Industri
// ============================================================
//
// ACUAN STANDAR:
// 1. Permenaker 5/2018 Pasal 40–42 (KUDR: Suhu 23–26°C, RH 40–60%, O2 19.5–23.5%, Volume 10 m3/org)
// 2. Permenkes 48/2016 Tabel 1 (Debu PM10 <= 0.15 mg/m3, Serat Asbes <= 0.1 serat/ml)

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Wind } from 'lucide-react';

import { authFetch } from '@/lib/api-client';
import { MCUChart } from '@/components/dashboard/MCUDashboardShared';
import PageLoading from '@/components/ui/page-loading';
import { PALET_BAR } from '@/lib/chart-standard';

interface Data {
  tabelSiap: boolean;
  catatan?: string;
  ringkasan: {
    jumlahRuang: number;
    sudahDiukur: number;
    belumDiukur: number;
    udaraTidakMemenuhi: number;
  };
  statusUdara: { label: string; memenuhi: number; tidakMemenuhi: number }[];
  tren: { bulan: string; memenuhi: number; tidak: number }[];
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export default function UdaraDebuDashboard({ site }: { site?: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = site ? `?site=${encodeURIComponent(site)}` : '';
      const r = await authFetch(`/api/lingkungan/dashboard${qs}`);
      setData(r as unknown as Data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data kualitas udara & debu');
    } finally {
      setLoading(false);
    }
  }, [site]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) return <PageLoading label="Memuat Dashboard Kualitas Udara & Debu" />;

  if (!data) {
    return (
      <div className="dashboard mcu-live-dashboard" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 12 }}>
          {error || 'Data kualitas udara tidak tersedia.'}
        </div>
      </div>
    );
  }

  if (!data.tabelSiap) {
    return (
      <div className="dashboard mcu-live-dashboard" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,196,0,0.10)', border: '1px solid rgba(255,196,0,0.4)', color: '#9a6b00', fontSize: 12 }}>
          {data.catatan}
        </div>
      </div>
    );
  }

  const r = data.ringkasan;
  const adaData = r.sudahDiukur > 0;
  const ruangMemenuhi = Math.max(0, r.sudahDiukur - r.udaraTidakMemenuhi);
  const persenKepatuhan = r.sudahDiukur > 0 ? Math.round((ruangMemenuhi / r.sudahDiukur) * 100) : 0;

  return (
    <div className="dashboard mcu-live-dashboard" style={{ overflow: 'hidden', gap: 8 }}>
      {/* Top Filter & Summary Bar */}
      <div className="mcu-live-top-bar" style={{ flexShrink: 0 }}>
        <div className="mcu-dashboard-filters">
          <label><span>Total Ruangan</span><b style={{ fontSize: 11 }}>{r.jumlahRuang}</b></label>
          <label><span>Sudah Diukur</span><b style={{ fontSize: 11 }}>{r.sudahDiukur}</b></label>
          <label><span>Udara Memenuhi</span><b style={{ fontSize: 11, color: '#00B894' }}>{ruangMemenuhi}</b></label>
          <label><span>Ada Parameter Gagal</span><b style={{ fontSize: 11, color: r.udaraTidakMemenuhi ? '#FF2D2D' : '#00B894' }}>{r.udaraTidakMemenuhi}</b></label>
          <label><span>Tingkat Kepatuhan</span><b style={{ fontSize: 11, color: persenKepatuhan >= 85 ? '#00B894' : '#FF7A00' }}>{persenKepatuhan}%</b></label>
          <button type="button" onClick={() => void load()} disabled={loading} className="mcu-dashboard-refresh">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
        {error && <span style={{ fontSize: 10, color: '#b3261e' }}>{error}</span>}
      </div>

      {/* Row 1: Charts */}
      <div className="mcu-live-chart-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, flex: 1, minHeight: 0 }}>
        <div className="card mcu-dashboard-card">
          <div className="card-head">
            <div>
              <h2>Status Kualitas Udara</h2>
              <p>Ruangan Memenuhi vs Melanggar Standar</p>
            </div>
          </div>
          <div className="mcu-dashboard-chart">
            {adaData ? (
              <MCUChart
                type="doughnut"
                labels={['Memenuhi Standar', 'Melanggar Standar']}
                values={[ruangMemenuhi, r.udaraTidakMemenuhi]}
                colors={['#00B894', '#FF2D2D']}
                legendLabel="Ruangan"
                centerText={String(r.sudahDiukur)}
                percentLabels
              />
            ) : <Kosong label="Belum ada data kualitas udara" />}
          </div>
        </div>

        <div className="card mcu-dashboard-card">
          <div className="card-head">
            <div>
              <h2>Status Pemantauan</h2>
              <p>Ruang Terpantau vs Belum Terpantau</p>
            </div>
          </div>
          <div className="mcu-dashboard-chart">
            {adaData ? (
              <MCUChart
                type="doughnut"
                labels={['Terpantau', 'Belum Terpantau']}
                values={[r.sudahDiukur, r.belumDiukur]}
                colors={['#3498DB', '#778899']}
                legendLabel="Ruang"
                centerText={String(r.jumlahRuang)}
              />
            ) : <Kosong label="Belum ada data pemantauan" />}
          </div>
        </div>

        <div className="card mcu-dashboard-card" style={{ gridColumn: 'span 2' }}>
          <div className="card-head">
            <div>
              <h2>Parameter Udara &amp; Debu Tidak Sesuai</h2>
              <p>Jumlah ruang dengan temuan per parameter K3 (Suhu, RH, O2, PM10, Asbes)</p>
            </div>
          </div>
          <div className="mcu-dashboard-chart">
            {data.statusUdara.length ? (
              <MCUChart
                type="bar"
                labels={data.statusUdara.map((u) => u.label)}
                values={data.statusUdara.map((u) => u.tidakMemenuhi)}
                colors={data.statusUdara.map((_, i) => PALET_BAR[i % PALET_BAR.length])}
                horizontal
                legendLabel="Ruang tidak memenuhi"
              />
            ) : <Kosong label="Tidak ada parameter yang melanggar standar" />}
          </div>
        </div>
      </div>

      {/* Row 2: Trend & Distribution */}
      <div className="mcu-live-chart-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 8, flex: 1, minHeight: 0 }}>
        <div className="card mcu-dashboard-card">
          <div className="card-head">
            <div>
              <h2>Kepatuhan Parameter Udara per Jenis</h2>
              <p>Ruangan memenuhi vs tidak memenuhi per parameter acuan</p>
            </div>
          </div>
          <div className="mcu-dashboard-chart">
            {data.statusUdara.length ? (
              <MCUChart
                type="bar"
                labels={data.statusUdara.map((u) => u.label)}
                values={data.statusUdara.map((u) => u.memenuhi)}
                colors={data.statusUdara.map((_, i) => PALET_BAR[(i + 2) % PALET_BAR.length])}
                horizontal
                legendLabel="Ruang memenuhi standar"
              />
            ) : <Kosong label="Belum ada data parameter" />}
          </div>
        </div>

        <div className="card mcu-dashboard-card">
          <div className="card-head">
            <div>
              <h2>Tren Kualitas Udara Bulanan</h2>
              <p>Jumlah ruangan dengan kualitas udara baik per bulan</p>
            </div>
          </div>
          <div className="mcu-dashboard-chart">
            {data.tren.length ? (
              <MCUChart
                type="bar"
                labels={data.tren.map((t) => {
                  const b = Number(String(t.bulan).slice(5)) - 1;
                  return BULAN[b] ?? t.bulan;
                })}
                values={data.tren.map((t) => t.memenuhi)}
                colors={data.tren.map((_, i) => PALET_BAR[i % PALET_BAR.length])}
                legendLabel="Ruangan memenuhi"
              />
            ) : <Kosong label="Belum ada tren pemantauan" />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kosong({ label = 'Belum ada data' }: { label?: string }) {
  return (
    <div
      role="status"
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 12,
        color: 'var(--muted-foreground)',
        textAlign: 'center',
      }}
    >
      <Wind size={28} style={{ opacity: 0.35, color: 'var(--brand-primary, #ff4d00)' }} />
      <span style={{ fontSize: 11.5, fontWeight: 600 }}>{label}</span>
    </div>
  );
}
