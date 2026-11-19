'use client';

// ============================================================
// Dashboard > Higiene Industri > Gizi Kerja & Jasaboga
// ============================================================
//
// ACUAN STANDAR:
//   - Permenkes No. 28 Tahun 2019 tentang Angka Kecukupan Gizi (AKG)
//   - Permenaker No. 5 Tahun 2018 (Klasifikasi Beban Kerja Fisik & Kalori)
//   - Permenkes No. 1096/2011 tentang Higiene Sanitasi Jasaboga
//   - Kepmen ESDM No. 1827 K/30/MEM/2018 Lampiran IV (Kesehatan Kerja Tambang)

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Utensils } from 'lucide-react';

import { authFetch } from '@/lib/api-client';
import { MCUChart } from '@/components/dashboard/MCUDashboardShared';
import PageLoading from '@/components/ui/page-loading';
import { PALET_BAR } from '@/lib/chart-standard';
import { SITES } from '@/components/administrator/hc-ergo-ui';

interface RekapGizi {
  totalDihitung: number;
  tidakLengkap: number;
  acuan: string;
  perSite: {
    site: string;
    jumlah: number;
    rataKkal: number;
    rataImt: number;
    persenObesitas: number;
  }[];
  perBebanKerja: [string, number][];
  distribusiStatusGizi: [string, number][];
}

interface InspeksiJasaboga {
  id: string;
  site: string;
  tanggal: string;
  vendor: string | null;
  nama_kantin: string | null;
  kalori_sarapan: number;
  kalori_siang: number;
  kalori_malam: number;
  ringkasan: {
    totalSkor: number;
    persenSkor: number;
    statusLaik: 'laik' | 'laik_bersyarat' | 'tidak_laik';
  } | null;
}

export default function GiziKerjaDashboard({ site: initialSite }: { site?: string }) {
  const [selectedSite, setSelectedSite] = useState(initialSite || '');
  const [rekap, setRekap] = useState<RekapGizi | null>(null);
  const [inspeksi, setInspeksi] = useState<InspeksiJasaboga[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qSite = selectedSite ? `?site=${encodeURIComponent(selectedSite)}` : '';
      const [rekapRes, inspRes] = await Promise.all([
        authFetch(`/api/gizi/rekap${qSite}`),
        authFetch(`/api/gizi/inspeksi${qSite}`),
      ]);
      setRekap(rekapRes as RekapGizi);
      setInspeksi((inspRes.data ?? []) as InspeksiJasaboga[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data gizi kerja');
    } finally {
      setLoading(false);
    }
  }, [selectedSite]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading && !rekap) {
    return <PageLoading label="Memuat Dashboard Gizi Kerja" />;
  }

  const totalKaryawan = rekap?.totalDihitung ?? 0;
  const sitesData = rekap?.perSite ?? [];
  const rataKkalNasional = sitesData.length
    ? Math.round(sitesData.reduce((acc, s) => acc + s.rataKkal, 0) / sitesData.length)
    : 0;
  const rataImtNasional = sitesData.length
    ? (sitesData.reduce((acc, s) => acc + s.rataImt, 0) / sitesData.length).toFixed(1)
    : '—';
  const totalObesitas = sitesData.length
    ? Math.round(sitesData.reduce((acc, s) => acc + s.persenObesitas, 0) / sitesData.length)
    : 0;

  // Evaluasi Kalori Katering dari inspeksi
  let menuMemenuhi = 0;
  let menuKurang = 0;
  let menuLebih = 0;
  for (const row of inspeksi) {
    const totalMenu = (row.kalori_sarapan || 0) + (row.kalori_siang || 0) + (row.kalori_malam || 0);
    if (totalMenu >= 2600 && totalMenu <= 3400) menuMemenuhi++;
    else if (totalMenu < 2600 && totalMenu > 0) menuKurang++;
    else if (totalMenu > 3400) menuLebih++;
  }
  const totalMenuDinilai = menuMemenuhi + menuKurang + menuLebih;

  // Status Gizi Chart Data
  const giziLabels = (rekap?.distribusiStatusGizi ?? []).map(([k]) => k);
  const giziValues = (rekap?.distribusiStatusGizi ?? []).map(([, v]) => v);
  const giziColors = giziLabels.map((lbl) => {
    const l = lbl.toLowerCase();
    if (l.includes('normal')) return '#00B894';
    if (l.includes('overweight')) return '#FF7A00';
    if (l.includes('obesitas')) return '#FF2D2D';
    if (l.includes('kurus') || l.includes('underweight')) return '#3498DB';
    return '#9B51E0';
  });

  // Beban Kerja Chart Data
  const bebanLabels = (rekap?.perBebanKerja ?? []).map(([k]) => {
    if (k === 'ringan') return 'Ringan (<100 dpm)';
    if (k === 'sedang') return 'Sedang (100-125 dpm)';
    if (k === 'berat') return 'Berat (125-150 dpm)';
    if (k === 'sangat-berat') return 'Sangat Berat (>150 dpm)';
    return k;
  });
  const bebanValues = (rekap?.perBebanKerja ?? []).map(([, v]) => v);
  const bebanColors = ['#3498DB', '#00B894', '#FF7A00', '#FF2D2D'];

  // Kepatuhan Jasaboga per Site
  const perSiteKepatuhan: { site: string; skor: number }[] = [];
  for (const s of SITES) {
    const list = inspeksi.filter((i) => i.site.toLowerCase() === s.toLowerCase() && i.ringkasan);
    if (list.length > 0) {
      const avg = Math.round(list.reduce((acc, i) => acc + (i.ringkasan?.persenSkor ?? 0), 0) / list.length);
      perSiteKepatuhan.push({ site: s, skor: avg });
    }
  }

  return (
    <div className="dashboard mcu-live-dashboard" style={{ overflow: 'hidden', gap: 8 }}>
      {/* Top Filter & Summary Bar */}
      <div className="mcu-live-top-bar" style={{ flexShrink: 0 }}>
        <div className="mcu-dashboard-filters">
          <select
            className="admin-filter-select"
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
            style={{ minWidth: 140 }}
          >
            <option value="">Semua Site</option>
            {SITES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <label><span>Total Karyawan</span><b style={{ fontSize: 11 }}>{totalKaryawan}</b></label>
          <label><span>Rata Kebutuhan Kalori</span><b style={{ fontSize: 11, color: '#3498DB' }}>{rataKkalNasional} kkal</b></label>
          <label><span>Rata-rata IMT</span><b style={{ fontSize: 11 }}>{rataImtNasional}</b></label>
          <label><span>Prevalensi Obesitas</span><b style={{ fontSize: 11, color: totalObesitas > 25 ? '#FF2D2D' : '#FF7A00' }}>{totalObesitas}%</b></label>
          <label><span>Inspeksi Jasaboga</span><b style={{ fontSize: 11, color: '#00B894' }}>{inspeksi.length} Sesi</b></label>

          <button type="button" onClick={() => void loadData()} disabled={loading} className="mcu-dashboard-refresh">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
        {error && <span style={{ fontSize: 10, color: '#b3261e' }}>{error}</span>}
      </div>

      {/* Row 1: Charts (4 Cards) */}
      <div className="mcu-live-chart-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, flex: 1, minHeight: 0 }}>
        {/* Card 1: Distribusi Status Gizi (IMT) */}
        <div className="card mcu-dashboard-card">
          <div className="card-head">
            <div>
              <h2>Status Gizi Pekerja (IMT)</h2>
              <p>Distribusi Kategori IMT dari Data MCU</p>
            </div>
          </div>
          <div className="mcu-dashboard-chart">
            {giziValues.length > 0 ? (
              <MCUChart
                type="doughnut"
                labels={giziLabels}
                values={giziValues}
                colors={giziColors}
                legendLabel="Karyawan"
                centerText={String(totalKaryawan)}
                percentLabels
              />
            ) : <Kosong label="Belum ada data status gizi" />}
          </div>
        </div>

        {/* Card 2: Kepatuhan Kalori Menu Katering */}
        <div className="card mcu-dashboard-card">
          <div className="card-head">
            <div>
              <h2>Kepatuhan Kalori Katering</h2>
              <p>Kesesuaian Kalori vs Standar 2.600–3.200 kkal</p>
            </div>
          </div>
          <div className="mcu-dashboard-chart">
            {totalMenuDinilai > 0 ? (
              <MCUChart
                type="doughnut"
                labels={['Memenuhi Standar', 'Di Bawah Standar', 'Di Atas Standar']}
                values={[menuMemenuhi, menuKurang, menuLebih]}
                colors={['#00B894', '#FF7A00', '#3498DB']}
                legendLabel="Siklus Menu"
                centerText={`${Math.round((menuMemenuhi / totalMenuDinilai) * 100)}%`}
                percentLabels
              />
            ) : (
              <MCUChart
                type="doughnut"
                labels={['Standar Kemenkes', 'Standar Tambang']}
                values={[2650, 3000]}
                colors={['#00B894', '#3498DB']}
                legendLabel="Acuan kkal"
                centerText="AKG 2019"
              />
            )}
          </div>
        </div>

        {/* Card 3: Distribusi Beban Kerja Fisik */}
        <div className="card mcu-dashboard-card">
          <div className="card-head">
            <div>
              <h2>Sebaran Beban Kerja Fisik</h2>
              <p>Kategori Beban Kerja (Permenaker 5/2018)</p>
            </div>
          </div>
          <div className="mcu-dashboard-chart">
            {bebanValues.length > 0 ? (
              <MCUChart
                type="bar"
                labels={bebanLabels}
                values={bebanValues}
                colors={bebanColors}
                horizontal
                legendLabel="Jumlah Karyawan"
              />
            ) : <Kosong label="Belum ada data beban kerja" />}
          </div>
        </div>

        {/* Card 4: Kepatuhan Kelaikan Jasaboga per Site */}
        <div className="card mcu-dashboard-card">
          <div className="card-head">
            <div>
              <h2>Kepatuhan Sanitasi Jasaboga</h2>
              <p>Skor Audit Higiene Kantin per Site (%)</p>
            </div>
          </div>
          <div className="mcu-dashboard-chart">
            {perSiteKepatuhan.length > 0 ? (
              <MCUChart
                type="bar"
                labels={perSiteKepatuhan.map((p) => p.site)}
                values={perSiteKepatuhan.map((p) => p.skor)}
                colors={perSiteKepatuhan.map((p) => (p.skor >= 85 ? '#00B894' : p.skor >= 70 ? '#FF7A00' : '#FF2D2D'))}
                horizontal
                legendLabel="Skor Kepatuhan (%)"
              />
            ) : (
              <Kosong label="Belum ada audit jasaboga site" />
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Charts (2 Cards) */}
      <div className="mcu-live-chart-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, flex: 1, minHeight: 0 }}>
        {/* Card 5: Kebutuhan Kalori Rata-rata per Site */}
        <div className="card mcu-dashboard-card">
          <div className="card-head">
            <div>
              <h2>Kebutuhan Kalori Kerja per Site</h2>
              <p>Rata-rata Kkal Karyawan Lapangan (AKG Mifflin-St Jeor)</p>
            </div>
          </div>
          <div className="mcu-dashboard-chart">
            {sitesData.length > 0 ? (
              <MCUChart
                type="bar"
                labels={sitesData.map((s) => s.site)}
                values={sitesData.map((s) => s.rataKkal)}
                colors={sitesData.map((_, i) => PALET_BAR[i % PALET_BAR.length])}
                horizontal
                legendLabel="Rata-rata kkal/hari"
              />
            ) : <Kosong label="Belum ada data kalori site" />}
          </div>
        </div>

        {/* Card 6: Prevalensi Obesitas per Site */}
        <div className="card mcu-dashboard-card">
          <div className="card-head">
            <div>
              <h2>Prevalensi Obesitas per Site</h2>
              <p>Persentase Karyawan dengan IMT ≥ 25 (Overweight &amp; Obesitas)</p>
            </div>
          </div>
          <div className="mcu-dashboard-chart">
            {sitesData.length > 0 ? (
              <MCUChart
                type="bar"
                labels={sitesData.map((s) => s.site)}
                values={sitesData.map((s) => s.persenObesitas)}
                colors={sitesData.map((s) => (s.persenObesitas > 30 ? '#FF2D2D' : '#FF7A00'))}
                horizontal
                legendLabel="% Obesitas"
              />
            ) : <Kosong label="Belum ada data obesitas site" />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kosong({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted-foreground)', fontSize: 11 }}>
      <Utensils size={28} style={{ opacity: 0.3, marginBottom: 6 }} />
      <span>{label}</span>
    </div>
  );
}
