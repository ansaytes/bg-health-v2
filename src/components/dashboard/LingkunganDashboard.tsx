'use client';

// ============================================================
// Dashboard > Higiene Industri > Pencahayaan & Kualitas Udara
// ============================================================
//
// ACUAN: Permenaker 5/2018 Pasal 40–42 (KUDR) & Permenkes 48/2016 Tabel 1 & 4.
//
// MENGAPA DI HIGIENE INDUSTRI
// Pencahayaan dan kualitas udara adalah FAKTOR LINGKUNGAN KERJA
// (Permenaker 5/2018 Pasal 5) — sejenis dengan kebisingan, bukan sarana/
// prasarana. SPIP mengurus Sarana, Prasarana, Instalasi, Peralatan.
//
// TEMPLATE SAMA dengan Monitoring MCU: 4 diagram berjajar, donut dengan total
// di tengah, bar horizontal untuk peringkat, satu halaman tanpa scroll.

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { authFetch } from '@/lib/api-client';
import { MCUChart } from '@/components/dashboard/MCUDashboardShared';
import PageLoading from '@/components/ui/page-loading';
import { PALET_BAR } from '@/lib/chart-standard';

interface Data {
  tabelSiap: boolean;
  catatan?: string;
  ringkasan: {
    jumlahRuang: number; sudahDiukur: number; belumDiukur: number;
    luxMemenuhi: number; luxTidakMemenuhi: number; udaraTidakMemenuhi: number;
  };
  perPeruntukan: { peruntukan: string; nabLux: number | null; memenuhi: number; tidakMemenuhi: number }[];
  statusUdara: { label: string; memenuhi: number; tidakMemenuhi: number }[];
  terendah: { ruang: string; nabLux: number | null; luxMin: number | null; persenNab: number }[];
  tren: { bulan: string; memenuhi: number; tidak: number }[];
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export default function LingkunganDashboard({ site }: { site?: string }) {
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
      setError(e instanceof Error ? e.message : 'Gagal memuat data pencahayaan & udara');
    } finally {
      setLoading(false);
    }
  }, [site]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !data) return <PageLoading label="Memuat Pencahayaan & Kualitas Udara" />;

  if (!data) {
    return (
      <div className="dashboard mcu-live-dashboard" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 12 }}>
          {error || 'Data tidak tersedia.'}
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

  if (!adaData) {
    return (
      <div className="dashboard mcu-live-dashboard" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>
          Belum ada data pengukuran
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard mcu-live-dashboard" style={{ overflow: 'hidden', gap: 8 }}>
      {/* Filter bar */}
      <div className="mcu-live-top-bar" style={{ flexShrink: 0 }}>
        <div className="mcu-dashboard-filters">
          <label><span>Ruang</span><b style={{ fontSize: 11 }}>{r.jumlahRuang}</b></label>
          <label><span>Sudah diukur</span><b style={{ fontSize: 11 }}>{r.sudahDiukur}</b></label>
          <label><span>Lux tidak memenuhi</span><b style={{ fontSize: 11, color: r.luxTidakMemenuhi ? '#FF2D2D' : '#00B894' }}>{r.luxTidakMemenuhi}</b></label>
          <label><span>Udara tidak memenuhi</span><b style={{ fontSize: 11, color: r.udaraTidakMemenuhi ? '#FF7A00' : '#00B894' }}>{r.udaraTidakMemenuhi}</b></label>
          <button type="button" onClick={() => void load()} disabled={loading} className="mcu-dashboard-refresh">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
        {error && <span style={{ fontSize: 10, color: '#b3261e' }}>{error}</span>}
      </div>

      {/* Baris 1 — dua donut + dua batang */}
      <div className="mcu-live-chart-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, flex: 1, minHeight: 0 }}>
        <div className="card mcu-dashboard-card">
          <div className="card-head"><div><h2>Kepatuhan Pencahayaan</h2><p>Ruang per status vs NAB</p></div></div>
          <div className="mcu-dashboard-chart">
            <MCUChart
              type="doughnut"
              labels={['Memenuhi', 'Tidak memenuhi']}
              values={[r.luxMemenuhi, r.luxTidakMemenuhi]}
              colors={['#00B894', '#FF2D2D']}
              legendLabel="Ruang"
              centerText={String(r.sudahDiukur)}
              percentLabels
            />
          </div>
        </div>

        <div className="card mcu-dashboard-card">
          <div className="card-head"><div><h2>Status Pengukuran</h2><p>Ruang sudah vs belum diukur</p></div></div>
          <div className="mcu-dashboard-chart">
            <MCUChart
              type="doughnut"
              labels={['Sudah diukur', 'Belum diukur']}
              values={[r.sudahDiukur, r.belumDiukur]}
              colors={['#3498DB', '#778899']}
              legendLabel="Ruang"
              centerText={String(r.jumlahRuang)}
            />
          </div>
        </div>

        <div className="card mcu-dashboard-card">
          <div className="card-head"><div><h2>Kepatuhan per Peruntukan</h2><p>Memenuhi · tidak memenuhi</p></div></div>
          <div className="mcu-dashboard-chart">
            <MCUChart
              type="bar"
              labels={data.perPeruntukan.map((p) => p.peruntukan)}
              values={data.perPeruntukan.map((p) => p.tidakMemenuhi)}
              colors={data.perPeruntukan.map((_, i) => PALET_BAR[i % PALET_BAR.length])}
              horizontal
              legendLabel="Ruang tidak memenuhi"
            />
          </div>
        </div>

        <div className="card mcu-dashboard-card">
          <div className="card-head"><div><h2>Kualitas Udara</h2><p>Parameter tidak memenuhi</p></div></div>
          <div className="mcu-dashboard-chart">
            <MCUChart
              type="bar"
              labels={data.statusUdara.map((u) => u.label)}
              values={data.statusUdara.map((u) => u.tidakMemenuhi)}
              colors={data.statusUdara.map((_, i) => PALET_BAR[i % PALET_BAR.length])}
              horizontal
              legendLabel="Ruang tidak memenuhi"
            />
          </div>
        </div>
      </div>

      {/* Baris 2 — ruang terendah + tren */}
      <div className="mcu-live-chart-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 8, flex: 1, minHeight: 0 }}>
        <div className="card mcu-dashboard-card">
          <div className="card-head"><div><h2>Ruang Terendah</h2><p>% lux terendah terhadap NAB — prioritas perbaikan</p></div></div>
          <div className="mcu-dashboard-chart">
            <MCUChart
              type="bar"
              labels={data.terendah.map((t) => t.ruang)}
              values={data.terendah.map((t) => t.persenNab)}
              colors={data.terendah.map((t) => t.persenNab >= 100 ? '#00B894' : t.persenNab >= 80 ? '#F1C40F' : t.persenNab >= 60 ? '#FF7A00' : '#FF2D2D')}
              horizontal
              legendLabel="% terhadap NAB"
            />
          </div>
        </div>

        <div className="card mcu-dashboard-card">
          <div className="card-head"><div><h2>Tren Pengukuran</h2><p>Ruang memenuhi per bulan</p></div></div>
          <div className="mcu-dashboard-chart">
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
          </div>
        </div>
      </div>
    </div>
  );
}
