'use client';

// ============================================================
// Dashboard > Higiene Industri > Pencahayaan Tempat Kerja
// ============================================================
//
// ACUAN STANDAR: Permenkes 48/2016 Tabel 4 & Permenaker 5/2018.
// Menampilkan agregat kepatuhan intensitas pencahayaan pada bidang kerja (Lux)
// per peruntukan ruang di site.

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, SunMedium } from 'lucide-react';

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
    luxMemenuhi: number;
    luxTidakMemenuhi: number;
  };
  perPeruntukan: { peruntukan: string; nabLux: number | null; memenuhi: number; tidakMemenuhi: number }[];
  terendah: { ruang: string; nabLux: number | null; luxMin: number | null; persenNab: number }[];
  tren: { bulan: string; memenuhi: number; tidak: number }[];
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export default function PencahayaanDashboard({ site }: { site?: string }) {
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
      setError(e instanceof Error ? e.message : 'Gagal memuat data pencahayaan');
    } finally {
      setLoading(false);
    }
  }, [site]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) return <PageLoading label="Memuat Dashboard Pencahayaan" />;

  if (!data) {
    return (
      <div className="dashboard mcu-live-dashboard" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 12 }}>
          {error || 'Data pencahayaan tidak tersedia.'}
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
  const persenKepatuhan = r.sudahDiukur > 0 ? Math.round((r.luxMemenuhi / r.sudahDiukur) * 100) : 0;

  return (
    <div className="dashboard mcu-live-dashboard" style={{ overflow: 'hidden', gap: 8 }}>
      {/* Top Filter & Summary Bar */}
      <div className="mcu-live-top-bar" style={{ flexShrink: 0 }}>
        <div className="mcu-dashboard-filters">
          <label><span>Total Ruang</span><b style={{ fontSize: 11 }}>{r.jumlahRuang}</b></label>
          <label><span>Sudah Diukur</span><b style={{ fontSize: 11 }}>{r.sudahDiukur}</b></label>
          <label><span>Memenuhi NAB</span><b style={{ fontSize: 11, color: '#00B894' }}>{r.luxMemenuhi}</b></label>
          <label><span>Di Bawah NAB</span><b style={{ fontSize: 11, color: r.luxTidakMemenuhi ? '#FF2D2D' : '#00B894' }}>{r.luxTidakMemenuhi}</b></label>
          <label><span>Kepatuhan Lux</span><b style={{ fontSize: 11, color: persenKepatuhan >= 85 ? '#00B894' : '#FF7A00' }}>{persenKepatuhan}%</b></label>
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
              <h2>Kepatuhan Pencahayaan</h2>
              <p>Ruang Memenuhi vs Di Bawah NAB</p>
            </div>
          </div>
          <div className="mcu-dashboard-chart">
            {adaData ? (
              <MCUChart
                type="doughnut"
                labels={['Memenuhi NAB', 'Di Bawah NAB']}
                values={[r.luxMemenuhi, r.luxTidakMemenuhi]}
                colors={['#00B894', '#FF2D2D']}
                legendLabel="Ruang"
                centerText={String(r.sudahDiukur)}
                percentLabels
              />
            ) : <Kosong label="Belum ada data pencahayaan" />}
          </div>
        </div>

        <div className="card mcu-dashboard-card">
          <div className="card-head">
            <div>
              <h2>Cakupan Pengukuran</h2>
              <p>Ruang Sudah vs Belum Diukur</p>
            </div>
          </div>
          <div className="mcu-dashboard-chart">
            {adaData ? (
              <MCUChart
                type="doughnut"
                labels={['Sudah Diukur', 'Belum Diukur']}
                values={[r.sudahDiukur, r.belumDiukur]}
                colors={['#3498DB', '#778899']}
                legendLabel="Ruang"
                centerText={String(r.jumlahRuang)}
              />
            ) : <Kosong label="Belum ada data cakupan" />}
          </div>
        </div>

        <div className="card mcu-dashboard-card">
          <div className="card-head">
            <div>
              <h2>Pencahayaan per Peruntukan</h2>
              <p>Ruang di Bawah NAB per Fungsi</p>
            </div>
          </div>
          <div className="mcu-dashboard-chart">
            {data.perPeruntukan.length ? (
              <MCUChart
                type="bar"
                labels={data.perPeruntukan.map((p) => p.peruntukan)}
                values={data.perPeruntukan.map((p) => p.tidakMemenuhi)}
                colors={data.perPeruntukan.map((_, i) => PALET_BAR[i % PALET_BAR.length])}
                horizontal
                legendLabel="Ruang di bawah NAB"
              />
            ) : <Kosong label="Belum ada data peruntukan" />}
          </div>
        </div>

        <div className="card mcu-dashboard-card">
          <div className="card-head">
            <div>
              <h2>Prioritas Perbaikan Lampu</h2>
              <p>% Lux Terendah terhadap Standar NAB</p>
            </div>
          </div>
          <div className="mcu-dashboard-chart">
            {data.terendah.length ? (
              <MCUChart
                type="bar"
                labels={data.terendah.slice(0, 6).map((t) => t.ruang)}
                values={data.terendah.slice(0, 6).map((t) => t.persenNab)}
                colors={data.terendah.slice(0, 6).map((t) => (t.persenNab >= 100 ? '#00B894' : t.persenNab >= 80 ? '#F1C40F' : t.persenNab >= 60 ? '#FF7A00' : '#FF2D2D'))}
                horizontal
                legendLabel="% terhadap NAB"
              />
            ) : <Kosong label="Belum ada data ruang" />}
          </div>
        </div>
      </div>

      {/* Row 2: Trend & Distribution */}
      <div className="mcu-live-chart-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 8, flex: 1, minHeight: 0 }}>
        <div className="card mcu-dashboard-card">
          <div className="card-head">
            <div>
              <h2>Daftar Ruang Intensitas Rendah</h2>
              <p>Ruangan dengan nilai lux terendah vs nilai ambang batas</p>
            </div>
          </div>
          <div className="mcu-dashboard-chart">
            {data.terendah.length ? (
              <MCUChart
                type="bar"
                labels={data.terendah.map((t) => t.ruang)}
                values={data.terendah.map((t) => t.luxMin ?? 0)}
                colors={data.terendah.map((t) => (t.persenNab >= 100 ? '#00B894' : '#FF2D2D'))}
                horizontal
                legendLabel="Lux Terukur"
              />
            ) : <Kosong label="Belum ada catatan ruang" />}
          </div>
        </div>

        <div className="card mcu-dashboard-card">
          <div className="card-head">
            <div>
              <h2>Tren Kepatuhan Pencahayaan</h2>
              <p>Ruang memenuhi NAB per bulan</p>
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
                legendLabel="Ruang memenuhi"
              />
            ) : <Kosong label="Belum ada tren bulanan" />}
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
      <SunMedium size={28} style={{ opacity: 0.35, color: 'var(--brand-primary, #ff4d00)' }} />
      <span style={{ fontSize: 11.5, fontWeight: 600 }}>{label}</span>
    </div>
  );
}
