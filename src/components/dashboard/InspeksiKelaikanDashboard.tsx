'use client';

// Dashboard > Program Inspeksi > Tab 2: Kelaikan Fasilitas & Kesiapan Darurat
//
// ACUAN STANDAR AUDIT:
//   - Kepmen ESDM No. 1827 K/30/MEM/2018 Lampiran IV (Kesehatan Kerja Pertambangan)
//   - Kepdirjen Minerba No. 185 K/37.04/DJB/2019 (SMKP Minerba Elemen IV.8: Kesiapsiagaan Tanggap Darurat Medis)
//   - Permenaker No. 15/MEN/VIII/2008 tentang Pertolongan Pertama Pada Kecelakaan di Tempat Kerja
//   - Permenkes No. 54 Tahun 2015 tentang Pengujian dan Kalibrasi Alat Kesehatan
//
// INTEGRITAS DATA:
//   100% data riil dari Supabase (/api/inspeksi/dashboard):
//   ambulans_unit, ambulans_site, p3k_site, sarana_site (+ sarana_katalog), dan inspeksi_jadwal.

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList } from 'lucide-react';

import { authFetch } from '@/lib/api-client';
import {
  MCUChart,
  MCUChartCard,
  MCURefreshButton,
} from '@/components/dashboard/MCUDashboardShared';
import { useSites } from '@/lib/site-list';
import { useSiteLock } from '@/lib/auth-context';
import PageLoading from '@/components/ui/page-loading';
import { periodeBulan } from '@/lib/inspeksi-program';

interface Data {
  success: boolean;
  periode: string;
  site: string | null;
  catatan: string | null;
  eksekusi: {
    terlewatPerJenis?: { jenis: string; label: string; jumlah: number }[];
  };
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
  const { site, setSite, isLocked: isSiteLocked, lockedSite } = useSiteLock('Head Office');
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
  const itemAmbulansKosong = Math.max(0, k.ambulans.itemTotal - k.ambulans.itemAda - k.ambulans.itemRusak);
  const terlewatJenis = data.eksekusi?.terlewatPerJenis ?? [];

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
              disabled={isSiteLocked}
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
              {isSiteLocked && lockedSite ? (
                <option value={lockedSite}>{lockedSite}</option>
              ) : (
                <>
                  <option value="">Semua Site</option>
                  {site && !daftarSite.includes(site) && (
                    <option key={site} value={site}>{site}</option>
                  )}
                  {daftarSite.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </>
              )}
            </select>
          </label>
        </div>

        {/* Audit Readiness Summary Badges */}
        <div className="mcu-total-bar">
          <span className="mcu-total-label">Ambulans Ready:</span>
          <span className="mcu-total-num" style={{ color: k.ambulans.breakdown > 0 ? '#FF2D2D' : '#00B894' }}>
            {k.ambulans.ready}/{k.ambulans.totalUnit}
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
          <span style={{ fontWeight: 700, color: k.p3k.kedaluwarsa.length > 0 ? '#E67E22' : '#00B894' }}>
            P3K Kedaluwarsa: {k.p3k.kedaluwarsa.length}
          </span>
          <MCURefreshButton loading={loading} onClick={() => void load()} />
        </div>
      </div>

      {data.catatan && (
        <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,196,0,0.10)', border: '1px solid rgba(255,196,0,0.4)', color: '#9a6b00', fontSize: 11 }}>
          {data.catatan}
        </div>
      )}

      {/* ── BARIS 1: Kesiapan Tanggap Darurat (Ambulans, Perlengkapan & P3K) ── */}
      <div className="mcu-grid-3 mcu-live-chart-row">
        {/* CARD 1: Kesiapan Armada Ambulans (Murni Unit Kendaraan) */}
        <MCUChartCard
          title="Kesiapan Armada Ambulans"
          subtitle={`${k.ambulans.ready}/${k.ambulans.totalUnit} Unit Ready Operasional · BBM & Kelayakan Jalan`}
          className="glow-teal"
        >
          {k.ambulans.totalUnit > 0 ? (
            <MCUChart
              type="doughnut"
              labels={['Ready Operasional Penuh', 'Standby (Catatan Minor)', 'Breakdown / Tidak Laik']}
              values={[k.ambulans.ready, k.ambulans.standby, k.ambulans.breakdown]}
              colors={['#00B894', '#F1C40F', '#FF2D2D']}
              centerText={String(k.ambulans.totalUnit)}
              percentLabels
            />
          ) : (
            <Kosong label="Belum ada unit ambulans terdaftar" />
          )}
        </MCUChartCard>

        {/* CARD 2: Kelengkapan Item & Alkes Ambulans (Checklist ambulans_site) */}
        <MCUChartCard
          title="Kelengkapan Alkes & BHP Ambulans"
          subtitle={`${k.ambulans.itemAda}/${k.ambulans.itemTotal} Item Medis & Kabin Pasien Siap Pakai`}
          className="glow-orange"
        >
          {k.ambulans.itemTotal > 0 ? (
            <MCUChart
              type="doughnut"
              labels={['Ada & Siap Pakai', 'Rusak / Perlu Perbaikan', 'Tidak Ada / Kosong']}
              values={[k.ambulans.itemAda, k.ambulans.itemRusak, itemAmbulansKosong]}
              colors={['#00B894', '#F39C12', '#FF2D2D']}
              centerText={String(k.ambulans.itemTotal)}
              percentLabels
            />
          ) : (
            <Kosong label="Belum ada checklist item ambulans" />
          )}
        </MCUChartCard>

        {/* CARD 3: Kelengkapan Kotak P3K (Permenaker 15/2008 & Kepdirjen 185) */}
        <MCUChartCard
          title="Kesiapan Kotak P3K Lapangan"
          subtitle={`${k.p3k.ada}/${k.p3k.total} Item Standar · ${k.p3k.kedaluwarsa.length} Kedaluwarsa`}
          className="glow-coral"
        >
          {k.p3k.total > 0 ? (
            <MCUChart
              type="doughnut"
              labels={['Lengkap & Siap Pakai', 'Rusak / Kedaluwarsa', 'Hilang / Kosong']}
              values={[k.p3k.ada, k.p3k.rusak, k.p3k.tidakAda]}
              colors={['#00B894', '#F39C12', '#FF2D2D']}
              centerText={`${k.p3k.persenSiap}%`}
              percentLabels
            />
          ) : (
            <Kosong label="Belum ada data checklist P3K" />
          )}
        </MCUChartCard>
      </div>

      {/* ── BARIS 2: Tata Kelola Klinik Site, Kalibrasi & Tunggakan Inspeksi ── */}
      <div className="mcu-grid-3 mcu-live-chart-row">
        {/* CARD 4: Kepatuhan Kalibrasi Alat Medis (Permenkes 54/2015) */}
        <MCUChartCard
          title="Kepatuhan Kalibrasi Alkes Medis"
          subtitle={`${k.kalibrasi.patuh}/${k.kalibrasi.total} Terkalibrasi (${k.kalibrasi.merah ? `${k.kalibrasi.merah} Lewat Tempo!` : 'Semua Valid'})`}
          className="glow-steel"
        >
          {k.kalibrasi.total > 0 ? (
            <MCUChart
              type="doughnut"
              labels={['Patuh / Valid', 'Mendekati (H-60)', 'Lewat Tempo', 'Belum Kalibrasi']}
              values={[k.kalibrasi.patuh, k.kalibrasi.kuning, k.kalibrasi.merah, k.kalibrasi.belum]}
              colors={['#00B894', '#F1C40F', '#FF2D2D', '#778899']}
              centerText={String(k.kalibrasi.total)}
              percentLabels
            />
          ) : (
            <Kosong label="Belum ada alat medis wajib kalibrasi" />
          )}
        </MCUChartCard>

        {/* CARD 5: Ketersediaan Sarana & Prasarana Klinik Site */}
        <MCUChartCard
          title="Sarana & Prasarana Klinik Site"
          subtitle={`${k.klinik?.ada ?? 0}/${k.klinik?.total ?? 0} Sarana Klinik Terstandar`}
          className="glow-amber"
        >
          {(k.klinik?.total ?? 0) > 0 ? (
            <MCUChart
              type="doughnut"
              labels={['Tersedia & Siap', 'Rusak / Perlu Penggantian', 'Belum Tersedia']}
              values={[k.klinik?.ada ?? 0, k.klinik?.rusak ?? 0, k.klinik?.tidakAda ?? 0]}
              colors={['#00B894', '#F39C12', '#FF2D2D']}
              centerText={`${k.klinik?.persen ?? 0}%`}
              percentLabels
            />
          ) : (
            <Kosong label="Belum ada data sarana klinik" />
          )}
        </MCUChartCard>

        {/* CARD 6: Tunggakan Inspeksi Fasilitas per Jenis (Audit Compliance) */}
        <MCUChartCard
          title="Inspeksi Fasilitas Terlewat"
          subtitle="Jadwal inspeksi fasilitas yang melewati tenggat (H+1 dst)"
          className="glow-teal"
        >
          {terlewatJenis.length === 0 ? (
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
              <span style={{ fontSize: 12, fontWeight: 700 }}>Zero Overdue Schedule</span>
              <span style={{ fontSize: 10, color: 'var(--muted-foreground)', textAlign: 'center' }}>
                Seluruh jadwal inspeksi fasilitas terlaksana tepat waktu
              </span>
            </div>
          ) : (
            <MCUChart
              type="bar"
              horizontal
              labels={terlewatJenis.map((t) => t.label)}
              values={terlewatJenis.map((t) => t.jumlah)}
              colors={terlewatJenis.map(() => '#FF2D2D')}
              legendLabel="Jadwal Terlewat"
            />
          )}
        </MCUChartCard>
      </div>
    </div>
  );
}

function Kosong({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted-foreground)', fontSize: 11, gap: 6 }}>
      <ClipboardList size={28} style={{ opacity: 0.3 }} />
      <span>{label}</span>
    </div>
  );
}
