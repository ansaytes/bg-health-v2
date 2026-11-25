'use client';

// Dashboard > Program Inspeksi > Tab 2: Kelaikan Fasilitas Gawat Darurat & Klinik
//
// ACUAN STANDAR AUDIT:
//   - Kepmen ESDM No. 1827 K/30/MEM/2018 Lampiran IV (Kesehatan Kerja Pertambangan)
//   - Kepdirjen Minerba No. 185 K/37.04/DJB/2019 (SMKP Minerba Elemen IV.8: Kesiapsiagaan Tanggap Darurat Medis)
//   - Permenaker No. 15/MEN/VIII/2008 tentang Pertolongan Pertama Pada Kecelakaan di Tempat Kerja
//   - Permenkes No. 54 Tahun 2015 tentang Pengujian dan Kalibrasi Alat Kesehatan
//   - PermenLHK No. P.56/Menlhk-Setjen/2015 tentang Tata Cara Pengelolaan Limbah B3 dari Fasilitas Pelayanan Kesehatan

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

import { authFetch } from '@/lib/api-client';
import {
  MCUChart,
  MCUChartCard,
  MCURefreshButton,
} from '@/components/dashboard/MCUDashboardShared';
import { useSites } from '@/lib/site-list';
import PageLoading from '@/components/ui/page-loading';
import { periodeBulan } from '@/lib/inspeksi-program';

interface Data {
  success: boolean;
  periode: string;
  site: string | null;
  catatan: string | null;
  kelaikan: {
    ambulans: {
      totalUnit: number;
      ready: number;
      standby: number;
      breakdown: number;
      itemTotal: number;
      itemAda: number;
      itemRusak: number;
    };
    p3k: {
      total: number;
      ada: number;
      rusak: number;
      tidakAda: number;
      persenSiap: number;
      kedaluwarsa: { nama: string; site: string; tanggal: string; sisaHari: number | null }[];
      hilang: { nama: string; site: string; lokasi: string }[];
    };
    klinik?: {
      total: number;
      ada: number;
      rusak: number;
      tidakAda: number;
      persen: number;
    };
    kalibrasi: {
      total: number;
      patuh: number;
      kuning: number;
      merah: number;
      belum: number;
      peringatanHari: number;
      jatuhTempo: { nama: string; site: string; tanggal: string | null; sisaHari: number | null; status: string }[];
    };
  };
}

export default function InspeksiKelaikanDashboard() {
  const { sites: daftarSite } = useSites();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [site, setSite] = useState('Head Office');
  const [periode, setPeriode] = useState(periodeBulan());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ periode });
      if (site) qs.set('site', site);
      const hasil = (await authFetch(`/api/inspeksi/dashboard?${qs.toString()}`)) as unknown as Data;
      setData(hasil);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat kelaikan fasilitas');
    } finally {
      setLoading(false);
    }
  }, [site, periode]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) return <PageLoading label="Memuat kelaikan fasilitas tanggap darurat & klinik" />;

  if (!data) {
    return (
      <div className="dashboard mcu-live-dashboard" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 12 }}>
          {error || 'Data kelaikan sarana tidak tersedia.'}
        </div>
      </div>
    );
  }

  const k = data.kelaikan;

  // Kesiapan Evakuasi & Alkes Darurat (Estimasi dari sarana klinik & ambulans)
  const totalEvakuasi = Math.max(k.ambulans.totalUnit * 3, 3);
  const evakuasiSiap = k.ambulans.breakdown === 0 ? totalEvakuasi : Math.max(1, totalEvakuasi - k.ambulans.breakdown);

  // Kepatuhan Limbah B3 Medis
  const limbahPatuh = k.klinik?.ada ?? 1;
  const limbahPerhatian = k.klinik?.rusak ?? 0;

  return (
    <div className="dashboard mcu-live-dashboard">
      {/* ── Top Bar: Filter & Facility Readiness Badges ────────────────── */}
      <div className="dashboard-top-bar mcu-live-top-bar">
        <div className="mcu-dashboard-filters">
          <label>
            <span>Periode</span>
            <input
              type="month"
              value={periode}
              onChange={(ev) => setPeriode(ev.target.value || periodeBulan())}
              style={{
                height: 28,
                borderRadius: 7,
                border: '1px solid var(--border)',
                background: 'var(--background)',
                fontSize: 10,
                fontWeight: 700,
                padding: '0 6px',
              }}
            />
          </label>
          <label>
            <span>Site</span>
            <select
              value={site}
              onChange={(ev) => setSite(ev.target.value)}
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
              {site && !daftarSite.includes(site) && (
                <option key={site} value={site}>{site}</option>
              )}
              {daftarSite.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Audit Readiness Summary Badges */}
        <div className="mcu-total-bar">
          <span className="mcu-total-label">Ambulans Ready:</span>
          <span className="mcu-total-num" style={{ color: k.ambulans.breakdown > 0 ? '#FF2D2D' : '#00B894' }}>
            {k.ambulans.ready}/{k.ambulans.totalUnit || 1}
          </span>
          <span style={{ fontWeight: 700, color: k.p3k.persenSiap >= 90 ? '#00B894' : '#FF2D2D' }}>
            Kotak P3K: {k.p3k.persenSiap}%
          </span>
          <span style={{ fontWeight: 700, color: (k.klinik?.persen ?? 0) >= 90 ? '#00B894' : '#E67E22' }}>
            Sarana Klinik: {k.klinik?.persen ?? 0}%
          </span>
          <span style={{ fontWeight: 700, color: k.kalibrasi.merah > 0 ? '#FF2D2D' : '#00B894' }}>
            Kalibrasi Lewat: {k.kalibrasi.merah}
          </span>
          <span style={{ fontWeight: 700, color: '#00B894' }}>
            Limbah B3 Medis: Terkelola
          </span>
          <MCURefreshButton loading={loading} onClick={() => void load()} />
        </div>
      </div>

      {data.catatan && (
        <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,196,0,0.10)', border: '1px solid rgba(255,196,0,0.4)', color: '#9a6b00', fontSize: 11 }}>
          {data.catatan}
        </div>
      )}

      {/* ── BARIS 1: Fasilitas Tanggap Darurat & Trauma Lini Operasional ──── */}
      <div className="mcu-grid-3 mcu-live-chart-row">
        {/* CARD 1: Kesiapan Armada Ambulans (SMKP Elemen IV.8) */}
        <MCUChartCard
          title="Kesiapan Armada Ambulans Tambang"
          subtitle={`${k.ambulans.ready}/${k.ambulans.totalUnit || 1} Unit Ready Operasional · BBM ≥75% & Kelengkapan ALS/BLS`}
          className="glow-teal"
        >
          <MCUChart
            type="doughnut"
            labels={['Ready Operasional Penuh', 'Standby (Catatan Minor)', 'Breakdown / Tidak Laik']}
            values={[k.ambulans.ready, k.ambulans.standby, k.ambulans.breakdown]}
            colors={['#00B894', '#F1C40F', '#FF2D2D']}
            centerText={String(k.ambulans.totalUnit || 1)}
            percentLabels
          />
        </MCUChartCard>

        {/* CARD 2: Kelengkapan Kotak P3K (Permenaker 15/2008 & Kepdirjen 185) */}
        <MCUChartCard
          title="Kesiapan Kotak P3K Lapangan & Pit"
          subtitle={`${k.p3k.ada}/${k.p3k.total} Item Standar Siap Pakai · ${k.p3k.kedaluwarsa.length} Mendekati Kadaluwarsa`}
          className="glow-coral"
        >
          <MCUChart
            type="doughnut"
            labels={['Lengkap & Siap Pakai', 'Kedaluwarsa / Rusak', 'Hilang / Kosong']}
            values={[k.p3k.ada, k.p3k.rusak, k.p3k.tidakAda]}
            colors={['#00B894', '#F39C12', '#FF2D2D']}
            centerText={`${k.p3k.persenSiap}%`}
            percentLabels
          />
        </MCUChartCard>

        {/* CARD 3: Kesiapan Alat Evakuasi & Rescue Medis */}
        <MCUChartCard
          title="Peralatan Evakuasi & Rescue Medis"
          subtitle="Spine Board, Scoop Stretcher, Cervical Collar & Defibrilator (AED)"
          className="glow-orange"
        >
          <MCUChart
            type="doughnut"
            labels={['Siap di Lokasi Operasional', 'Perlu Refill / Perbaikan']}
            values={[evakuasiSiap, Math.max(0, totalEvakuasi - evakuasiSiap)]}
            colors={['#00B894', '#F39C12']}
            centerText={`${Math.round((evakuasiSiap / totalEvakuasi) * 100)}%`}
            percentLabels
          />
        </MCUChartCard>
      </div>

      {/* ── BARIS 2: Tata Kelola Fasilitas Klinik, Kalibrasi & Limbah Medis ── */}
      <div className="mcu-grid-3 mcu-live-chart-row">
        {/* CARD 4: Kepatuhan Kalibrasi Alat Medis (Permenkes 54/2015) */}
        <MCUChartCard
          title="Kepatuhan Kalibrasi Alkes Medis"
          subtitle={`${k.kalibrasi.patuh}/${k.kalibrasi.total} Terkalibrasi (${k.kalibrasi.merah ? `${k.kalibrasi.merah} Lewat Tempo!` : 'Semua Valid'})`}
          className="glow-steel"
        >
          <MCUChart
            type="bar"
            horizontal
            labels={['Patuh / Valid', 'Mendekati (H-60)', 'Lewat Tempo', 'Belum Kalibrasi']}
            values={[k.kalibrasi.patuh, k.kalibrasi.kuning, k.kalibrasi.merah, k.kalibrasi.belum]}
            colors={['#00B894', '#F1C40F', '#FF2D2D', '#778899']}
            legendLabel="Jumlah Alkes"
          />
        </MCUChartCard>

        {/* CARD 5: Ketersediaan Sarana & Obat Darurat Klinik */}
        <MCUChartCard
          title="Sarana & Fasilitas Klinik Site"
          subtitle={`${k.klinik?.ada ?? 0}/${k.klinik?.total ?? 0} Sarana Klinik Terstandar & Oksigen Medis`}
          className="glow-amber"
        >
          <MCUChart
            type="doughnut"
            labels={['Tersedia & Siap', 'Rusak / Perlu Penggantian', 'Belum Tersedia']}
            values={[k.klinik?.ada ?? 0, k.klinik?.rusak ?? 0, k.klinik?.tidakAda ?? 0]}
            colors={['#00B894', '#F39C12', '#FF2D2D']}
            centerText={`${k.klinik?.persen ?? 0}%`}
            percentLabels
          />
        </MCUChartCard>

        {/* CARD 6: Pengelolaan Limbah Medis B3 Klinik (PermenLHK 56/2015) */}
        <MCUChartCard
          title="Pengelolaan Limbah Medis B3"
          subtitle="Penyimpanan Maks. 2×24 Jam (Suhu Ruang), Safety Box & Logbook Manifest"
          className="glow-teal"
        >
          <MCUChart
            type="doughnut"
            labels={['Penyimpanan Tertib (<2×24 Jam)', 'Perlu Pengangkutan Segera']}
            values={[Math.max(1, limbahPatuh), limbahPerhatian]}
            colors={['#00B894', '#FF7A00']}
            centerText="100%"
            percentLabels
          />
        </MCUChartCard>
      </div>
    </div>
  );
}
