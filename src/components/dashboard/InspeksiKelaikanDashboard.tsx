'use client';

// ============================================================
// Dashboard > Program Inspeksi > Tab 2: Kelaikan Fasilitas
// ============================================================
//
// Memantau kondisi fisik & kesiapan riil seluruh sarana kesehatan kerja:
//   • Setiap diagram donut murni 100% homogen (Ambulans dihitung per unit,
//     P3K per item, Klinik per fasilitas, Kalibrasi per alkes, Ergonomi per sarana).
//   • Tidak ada diagram campur aduk satuan.
//   • Tepat 2 Baris, maksimal 6 Kartu (mcu-grid-3 mcu-live-chart-row).

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
    ergonomi: {
      total: number;
      layak: number;
      rusak: number;
      persenLayak: number;
      perItem: { nama: string; rusak: number; layak: number }[];
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
  pica: {
    terulang: { objek: string; jumlah: number; picaIds: string[] }[];
  };
}

export default function InspeksiKelaikanDashboard() {
  const { sites: daftarSite } = useSites();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [site, setSite] = useState('');
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

  if (loading && !data) return <PageLoading label="Memuat kelaikan fasilitas sarana" />;

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
  const p = data.pica;

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
              {daftarSite.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Readiness Summary Badges */}
        <div className="mcu-total-bar">
          <span className="mcu-total-label">Ambulans Ready:</span>
          <span className="mcu-total-num" style={{ color: k.ambulans.breakdown > 0 ? '#FF2D2D' : '#00B894' }}>
            {k.ambulans.ready}/{k.ambulans.totalUnit || 1}
          </span>
          <span style={{ fontWeight: 700, color: k.p3k.persenSiap >= 90 ? '#00B894' : '#FF2D2D' }}>
            P3K: {k.p3k.persenSiap}%
          </span>
          <span style={{ fontWeight: 700, color: (k.klinik?.persen ?? 0) >= 90 ? '#00B894' : '#E67E22' }}>
            Klinik: {k.klinik?.persen ?? 0}%
          </span>
          <span style={{ fontWeight: 700, color: k.ergonomi.persenLayak >= 85 ? '#00B894' : '#E67E22' }}>
            Ergonomi: {k.ergonomi.persenLayak}%
          </span>
          <span style={{ fontWeight: 700, color: k.kalibrasi.merah > 0 ? '#FF2D2D' : 'inherit' }}>
            Kalibrasi Lewat: {k.kalibrasi.merah}
          </span>
          <MCURefreshButton loading={loading} onClick={() => void load()} />
        </div>
      </div>

      {data.catatan && (
        <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,196,0,0.10)', border: '1px solid rgba(255,196,0,0.4)', color: '#9a6b00', fontSize: 11 }}>
          {data.catatan}
        </div>
      )}

      {/* ── BARIS 1: Fasilitas Tanggap Darurat & Klinik (3 Kartu) ────────── */}
      <div className="mcu-grid-3 mcu-live-chart-row">
        {/* CARD 1: Kesiapan Armada Ambulans (Murni Unit Kendaraan) */}
        <MCUChartCard
          title="Kesiapan Armada Ambulans"
          subtitle={`${k.ambulans.ready}/${k.ambulans.totalUnit || 1} Unit Ready · BBM Standar ≥75%`}
          className="glow-teal"
        >
          <MCUChart
            type="doughnut"
            labels={['Ready (Siap Operasi)', 'Standby with Note', 'Breakdown (Perbaikan)']}
            values={[k.ambulans.ready, k.ambulans.standby, k.ambulans.breakdown]}
            colors={['#00B894', '#F1C40F', '#FF2D2D']}
            centerText={`${k.ambulans.totalUnit || 1} Unit`}
            percentLabels
          />
        </MCUChartCard>

        {/* CARD 2: Kelengkapan Kotak P3K (Murni Item Standar Palang Hijau) */}
        <MCUChartCard
          title="Kelengkapan Kotak P3K"
          subtitle={`${k.p3k.ada}/${k.p3k.total} Item Sesuai Permenaker 15/2008`}
          className="glow-coral"
        >
          <MCUChart
            type="doughnut"
            labels={['Lengkap & Siap', 'Rusak', 'Hilang / Kosong']}
            values={[k.p3k.ada, k.p3k.rusak, k.p3k.tidakAda]}
            colors={['#00B894', '#F39C12', '#FF2D2D']}
            centerText={`${k.p3k.persenSiap}%`}
            percentLabels
          />
        </MCUChartCard>

        {/* CARD 3: Ketersediaan Sarana & Prasarana Klinik */}
        <MCUChartCard
          title="Sarana & Prasarana Klinik"
          subtitle={`${k.klinik?.ada ?? 0}/${k.klinik?.total ?? 0} Sarana Klinik Terstandar`}
          className="glow-amber"
        >
          <MCUChart
            type="doughnut"
            labels={['Tersedia & Siap', 'Rusak', 'Belum Ada']}
            values={[k.klinik?.ada ?? 0, k.klinik?.rusak ?? 0, k.klinik?.tidakAda ?? 0]}
            colors={['#00B894', '#F39C12', '#FF2D2D']}
            centerText={`${k.klinik?.persen ?? 0}%`}
            percentLabels
          />
        </MCUChartCard>
      </div>

      {/* ── BARIS 2: Kalibrasi, Ergonomi & Temuan Berulang (3 Kartu) ─────── */}
      <div className="mcu-grid-3 mcu-live-chart-row">
        {/* CARD 4: Kepatuhan Kalibrasi Alat Medis */}
        <MCUChartCard
          title="Kepatuhan Kalibrasi Alat Medis"
          subtitle={`${k.kalibrasi.patuh}/${k.kalibrasi.total} Terkalibrasi (${k.kalibrasi.merah ? `${k.kalibrasi.merah} Lewat Tempo!` : 'Semua Valid'})`}
          className="glow-steel"
        >
          <MCUChart
            type="doughnut"
            labels={['Patuh / Valid', 'Mendekati (H-60)', 'Lewat Masa Berlaku', 'Belum Kalibrasi']}
            values={[k.kalibrasi.patuh, k.kalibrasi.kuning, k.kalibrasi.merah, k.kalibrasi.belum]}
            colors={['#00B894', '#F1C40F', '#FF2D2D', '#778899']}
            centerText={`${k.kalibrasi.total}`}
            percentLabels
          />
        </MCUChartCard>

        {/* CARD 5: Kelaikan Sarana Ergonomi Kerja */}
        <MCUChartCard
          title="Kelaikan Sarana Ergonomi"
          subtitle={`${k.ergonomi.layak}/${k.ergonomi.total} Unit Sarana Kerja Ergonomis Layak`}
          className="glow-teal"
        >
          <MCUChart
            type="doughnut"
            labels={['Layak Pakai', 'Rusak / Perlu Diganti']}
            values={[k.ergonomi.layak, k.ergonomi.rusak]}
            colors={['#00B894', '#FF2D2D']}
            centerText={`${k.ergonomi.persenLayak}%`}
            percentLabels
          />
        </MCUChartCard>

        {/* CARD 6: Top 5 Temuan Kerusakan Berulang */}
        <MCUChartCard
          title="Top 5 Temuan Kerusakan Berulang"
          subtitle="Objek temuan ketidaksesuaian berulang di lapangan"
          className="glow-orange"
        >
          {p.terulang.length === 0 ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#00B894',
                gap: 6,
                padding: 20,
              }}
            >
              <CheckCircle2 size={32} />
              <span style={{ fontSize: 12, fontWeight: 700 }}>Kondisi Terkendali</span>
              <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
                Tidak ada temuan kerusakan sarana yang berulang
              </span>
            </div>
          ) : (
            <MCUChart
              type="bar"
              horizontal
              labels={p.terulang.slice(0, 5).map((t) => t.objek)}
              values={p.terulang.slice(0, 5).map((t) => t.jumlah)}
              colors={['#FF7A00', '#E67E22', '#D35400', '#C0392B', '#962D00']}
              legendLabel="Kasus Berulang"
            />
          )}
        </MCUChartCard>
      </div>
    </div>
  );
}
