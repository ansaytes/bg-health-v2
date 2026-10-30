'use client';

// ============================================================
// Dashboard > SPIP — Sarana, Prasarana, Instalasi, Peralatan
// ============================================================
//
// DASAR: BG/QSHE/SOP/028 poin 5.5 — kelengkapan sarana & prasarana pelayanan
// kesehatan kerja (ruangan, peralatan medis, sarana penunjang, alat evakuasi).
//
// DESAIN mengikuti Monitoring MCU: kartu `.mcu-dashboard-card`, judul 12px,
// donut dengan total di tengah, bar horizontal untuk peringkat, satu layar
// penuh tanpa scroll.
//
// Angka yang ditampilkan untuk PELAPORAN:
//   • kepatuhan kelengkapan per site (poros utama — site mana yang tertinggal)
//   • kondisi alat per kategori
//   • alat yang kalibrasinya kedaluwarsa (risiko hasil pemeriksaan tidak sahih)

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
    jumlahSite: number; totalItemWajib: number; totalTersedia: number; persenNasional: number;
    rusak: number; kalibrasiLewat: number; belumDicatat: number; siteBelumLengkap: number;
  };
  perSite: { site: string; wajib: number; tersedia: number; rusak: number; kalibrasiLewat: number; persen: number }[];
  perKategori: { kategori: string; key: string; wajib: number; tersedia: number; rusak: number; belum: number }[];
  alatKalibrasiLewat: { nama: string; site: string; tanggal: string; hari: number }[];
}

export default function SPIPDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await authFetch('/api/sarana/dashboard');
      setData(r as unknown as Data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data SPIP');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading && !data) return <PageLoading label="Memuat SPIP" />;

  if (!data) {
    return (
      <div className="dashboard mcu-live-dashboard" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 12 }}>
          {error || 'Data SPIP tidak tersedia.'}
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
  // Site terbanyak yang belum lengkap (10 teratas) — peringkat terendah dulu.
  const siteRendah = data.perSite.slice(0, 10);

  return (
    <div className="dashboard mcu-live-dashboard" style={{ overflow: 'hidden', gap: 8 }}>
      <div className="mcu-live-top-bar" style={{ flexShrink: 0 }}>
        <div className="mcu-dashboard-filters">
          <label><span>Site</span><b style={{ fontSize: 11 }}>{r.jumlahSite}</b></label>
          <label><span>Kelengkapan</span><b style={{ fontSize: 11, color: r.persenNasional >= 90 ? '#00B894' : r.persenNasional >= 70 ? '#C99A00' : '#FF2D2D' }}>{r.persenNasional}%</b></label>
          <label><span>Rusak</span><b style={{ fontSize: 11, color: r.rusak ? '#FF7A00' : 'inherit' }}>{r.rusak}</b></label>
          <label><span>Kalibrasi lewat</span><b style={{ fontSize: 11, color: r.kalibrasiLewat ? '#FF2D2D' : 'inherit' }}>{r.kalibrasiLewat}</b></label>
          <button type="button" onClick={() => void load()} disabled={loading} className="mcu-dashboard-refresh">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
        {error && <span style={{ fontSize: 10, color: '#b3261e' }}>{error}</span>}
      </div>

      {/* Baris 1 — tiga donut */}
      <div className="mcu-live-chart-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, flex: 1, minHeight: 0 }}>
        <div className="card mcu-dashboard-card">
          <div className="card-head"><div><h2>Kelengkapan Sarana</h2><p>Tersedia vs wajib</p></div></div>
          <div className="mcu-dashboard-chart">
            <MCUChart
              type="doughnut"
              labels={['Tersedia', 'Belum tersedia']}
              values={[r.totalTersedia, Math.max(r.totalItemWajib - r.totalTersedia, 0)]}
              colors={['#00B894', '#FF7A00']}
              legendLabel="Item"
              centerText={`${r.persenNasional}%`}
              percentLabels
            />
          </div>
        </div>

        <div className="card mcu-dashboard-card">
          <div className="card-head"><div><h2>Status Kelengkapan Site</h2><p>Ambang 80%</p></div></div>
          <div className="mcu-dashboard-chart">
            <MCUChart
              type="doughnut"
              labels={['Lengkap (≥80%)', 'Belum lengkap (<80%)']}
              values={[r.jumlahSite - r.siteBelumLengkap, r.siteBelumLengkap]}
              colors={['#00B894', '#FF2D2D']}
              legendLabel="Site"
              centerText={String(r.jumlahSite)}
            />
          </div>
        </div>

        <div className="card mcu-dashboard-card">
          <div className="card-head"><div><h2>Kondisi Alat</h2><p>Seluruh site</p></div></div>
          <div className="mcu-dashboard-chart">
            <MCUChart
              type="doughnut"
              labels={['Baik/tersedia', 'Rusak', 'Kalibrasi lewat']}
              values={[r.totalTersedia - r.rusak, r.rusak, r.kalibrasiLewat]}
              colors={['#00B894', '#FF7A00', '#FF2D2D']}
              legendLabel="Item"
              centerText={String(r.totalTersedia)}
            />
          </div>
        </div>
      </div>

      {/* Baris 2 — peringkat site + kategori */}
      <div className="mcu-live-chart-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: 8, flex: 1, minHeight: 0 }}>
        <div className="card mcu-dashboard-card">
          <div className="card-head"><div><h2>Kelengkapan per Site</h2><p>10 site terendah (%)</p></div></div>
          <div className="mcu-dashboard-chart">
            <MCUChart
              type="bar"
              labels={siteRendah.map((s) => s.site)}
              values={siteRendah.map((s) => s.persen)}
              colors={siteRendah.map((s) => s.persen >= 90 ? '#00B894' : s.persen >= 80 ? '#F1C40F' : s.persen >= 60 ? '#FF7A00' : '#FF2D2D')}
              horizontal
              legendLabel="Kelengkapan (%)"
            />
          </div>
        </div>

        <div className="card mcu-dashboard-card">
          <div className="card-head"><div><h2>Kelengkapan per Kategori</h2><p>Item tersedia / wajib</p></div></div>
          <div className="mcu-dashboard-chart">
            <MCUChart
              type="bar"
              labels={data.perKategori.map((k) => k.kategori)}
              values={data.perKategori.map((k) => (k.wajib ? Number(((k.tersedia / k.wajib) * 100).toFixed(1)) : 0))}
              colors={data.perKategori.map((_, i) => PALET_BAR[i % PALET_BAR.length])}
              horizontal
              legendLabel="Kelengkapan (%)"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
