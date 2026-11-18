'use client';

// ============================================================
// Dashboard > Program Inspeksi (SMKP Minerba & QSHE Executive)
// ============================================================
//
// Standar template Dashboard Monitoring MCU / Pelayanan Kuratif:
//   • Top bar dengan filter Periode/Site + MCU Total Bar (Key KPI Badges)
//   • 2 Baris Chart (mcu-grid-3 mcu-live-chart-row), total maksimal 6 kartu
//   • Menggunakan MCUChartCard & MCUChart dengan standar animasi & palet warna K3
//
// BARIS 1: Kepatuhan Pelaksanaan & Kesiapan Tanggap Darurat
//   1. Capaian Jadwal Inspeksi (Plan vs Realisasi Bulanan)
//   2. Kesiapan Tanggap Darurat (Ambulans & Kotak P3K Palang Hijau)
//   3. Kelaikan Fasilitas & Sarana Kerja (Sarana Klinik & Ergonomi)
//
// BARIS 2: Kelaikan Teknis, Kalibrasi & Pengendalian Temuan
//   4. Kepatuhan Kalibrasi Alat Medis (Alat Kesehatan & Diagnostik)
//   5. Kinerja Penanganan PICA (Tindak Lanjut & MTTR Penutupan)
//   6. Cakupan Pengawasan & Deteksi Blindspot Area (>30 Hari)

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
  tabelSiap: Record<string, boolean>;
  catatan: string | null;
  eksekusi: {
    target: number;
    selesai: number;
    terlewat: number;
    belum: number;
    persenSelesai: number;
    warnaSelesai: 'hijau' | 'kuning' | 'merah';
    tepatWaktu: number;
    terlambat: number;
    persenTepatWaktu: number;
    terlewatPerJenis: { jenis: string; label: string; jumlah: number }[];
    tren: { periode: string; target: number; selesai: number; persen: number }[];
    daftarTerlewat: { id: number; label: string; site: string | null; objek: string | null; tanggal_rencana: string | null; hariTerlambat: number }[];
  };
  cakupan: {
    terdaftar: number;
    tersampling: number;
    persen: number;
    ambangHari: number;
    blindspot: { site: string; label: string; hariTerakhir: number | null; terakhir: string | null; jumlahObjek: number }[];
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
    sanitasi: {
      jumlahArea: number;
      diBawahStandar: number;
      rataRata: number | null;
      ambang: number;
      area: { site: string; tanggal: string; skor: number }[];
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
    total: number;
    aktif: number;
    closed: number;
    overdue: number;
    mttr: number | null;
    perDepartemen: { departemen: string; aktif: number; overdue: number; closed: number }[];
    terulang: { objek: string; jumlah: number; picaIds: string[] }[];
  };
  produktivitas: {
    perPetugas: { petugas: string; selesai: number; tepat: number; terlambat: number; terlewat: number }[];
    leadTime: { jumlah: number; rataHari: number | null };
  };
}

export default function InspeksiDashboard() {
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
      setError(e instanceof Error ? e.message : 'Gagal memuat dashboard inspeksi');
    } finally {
      setLoading(false);
    }
  }, [site, periode]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) return <PageLoading label="Memuat dashboard program inspeksi" />;

  if (!data) {
    return (
      <div className="dashboard mcu-live-dashboard" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 12 }}>
          {error || 'Data program inspeksi tidak tersedia.'}
        </div>
      </div>
    );
  }

  const e = data.eksekusi;
  const c = data.cakupan;
  const k = data.kelaikan;
  const p = data.pica;

  return (
    <div className="dashboard mcu-live-dashboard">
      {/* ── Top Bar: Filter & Executive KPI Indicators ─────────────────── */}
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

        {/* Executive Scorecard Badges */}
        <div className="mcu-total-bar">
          <span className="mcu-total-label">Target:</span>
          <span className="mcu-total-num">{e.target}</span>
          <span style={{ fontWeight: 700, color: e.persenSelesai >= 90 ? '#00B894' : e.persenSelesai >= 70 ? '#E67E22' : '#FF2D2D' }}>
            Selesai: {e.selesai} ({e.persenSelesai}%)
          </span>
          <span style={{ fontWeight: 700, color: e.terlewat ? '#FF2D2D' : 'inherit' }}>
            Terlewat: {e.terlewat}
          </span>
          <span style={{ fontWeight: 700, color: p.overdue ? '#FF2D2D' : 'inherit' }}>
            PICA Overdue: {p.overdue}
          </span>
          <span style={{ fontWeight: 700, color: k.kalibrasi.merah ? '#FF2D2D' : 'inherit' }}>
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

      {/* ── BARIS 1: Kepatuhan Pelaksanaan & Tanggap Darurat (3 Kartu) ──── */}
      <div className="mcu-grid-3 mcu-live-chart-row">
        {/* CARD 1: Capaian & Kepatuhan Jadwal Inspeksi */}
        <MCUChartCard
          title="Capaian Jadwal Inspeksi"
          subtitle={`Target: ${e.target} · Selesai: ${e.selesai} · Terlewat: ${e.terlewat}`}
          className="glow-coral"
        >
          <MCUChart
            type="doughnut"
            labels={['Tepat Waktu', 'Terlambat', 'Terlewat']}
            values={[e.tepatWaktu, e.terlambat, e.terlewat]}
            colors={['#00B894', '#F39C12', '#FF2D2D']}
            centerText={`${e.persenSelesai}%`}
            percentLabels
          />
        </MCUChartCard>

        {/* CARD 2: Kesiapan Tanggap Darurat (Ambulans & P3K Palang Hijau) */}
        <MCUChartCard
          title="Kesiapan Tanggap Darurat"
          subtitle={`Ambulans: ${k.ambulans.ready}/${k.ambulans.totalUnit || 1} Ready · P3K: ${k.p3k.persenSiap}% Siap`}
          className="glow-teal"
        >
          <MCUChart
            type="doughnut"
            labels={['Ambulans Siap (Ready)', 'P3K Siap Lengkap', 'P3K Rusak / Kurang', 'Ambulans Standby/Perbaikan']}
            values={[
              k.ambulans.ready,
              k.p3k.ada,
              k.p3k.rusak + k.p3k.tidakAda,
              k.ambulans.standby + k.ambulans.breakdown,
            ]}
            colors={['#00B894', '#2ECC71', '#FF2D2D', '#F39C12']}
            centerText={`${k.p3k.persenSiap}%`}
            percentLabels
          />
        </MCUChartCard>

        {/* CARD 3: Kelaikan Fasilitas & Sarana Kerja */}
        <MCUChartCard
          title="Kelaikan Fasilitas & Sarana Kerja"
          subtitle={`Klinik: ${k.klinik?.persen ?? 0}% · Ergonomi: ${k.ergonomi.persenLayak}% Layak`}
          className="glow-amber"
        >
          <MCUChart
            type="bar"
            horizontal
            labels={['Klinik Siap', 'Klinik Rusak/Kurang', 'Ergonomi Layak', 'Ergonomi Rusak']}
            values={[
              k.klinik?.ada ?? 0,
              (k.klinik?.rusak ?? 0) + (k.klinik?.tidakAda ?? 0),
              k.ergonomi.layak,
              k.ergonomi.rusak,
            ]}
            colors={['#00B894', '#FF2D2D', '#3498DB', '#E74C3C']}
            legendLabel="Item Fasilitas"
          />
        </MCUChartCard>
      </div>

      {/* ── BARIS 2: Kalibrasi, PICA & Deteksi Blindspot (3 Kartu) ───────── */}
      <div className="mcu-grid-3 mcu-live-chart-row">
        {/* CARD 4: Kepatuhan Kalibrasi Alat Medis */}
        <MCUChartCard
          title="Kepatuhan Kalibrasi Alat Medis"
          subtitle={`${k.kalibrasi.patuh}/${k.kalibrasi.total} Terkalibrasi (${k.kalibrasi.merah ? `${k.kalibrasi.merah} Lewat Tempo!` : 'Semua Valid'})`}
          className="glow-steel"
        >
          <MCUChart
            type="doughnut"
            labels={['Patuh / Aktif', 'Mendekati (H-60)', 'Lewat Masa Berlaku', 'Belum Kalibrasi']}
            values={[k.kalibrasi.patuh, k.kalibrasi.kuning, k.kalibrasi.merah, k.kalibrasi.belum]}
            colors={['#00B894', '#F1C40F', '#FF2D2D', '#778899']}
            centerText={`${k.kalibrasi.total}`}
            percentLabels
          />
        </MCUChartCard>

        {/* CARD 5: Kinerja Penanganan PICA */}
        <MCUChartCard
          title="Kinerja Penanganan PICA"
          subtitle={`MTTR: ${p.mttr !== null ? `${p.mttr} Hari` : '—'} · Closed: ${p.closed} · Overdue: ${p.overdue}`}
          className="glow-orange"
        >
          <MCUChart
            type="doughnut"
            labels={['Closed (Selesai)', 'Aktif Berjalan', 'Overdue (Lewat Tenggat)']}
            values={[p.closed, Math.max(0, p.aktif - p.overdue), p.overdue]}
            colors={['#00B894', '#3498DB', '#FF2D2D']}
            centerText={p.mttr !== null ? `${p.mttr}h` : `${p.total}`}
            percentLabels
          />
        </MCUChartCard>

        {/* CARD 6: Cakupan Pengawasan & Blindspot Area */}
        <MCUChartCard
          title="Cakupan Pengawasan & Blindspot"
          subtitle={`Cakupan Aset: ${c.persen}% · Ambang: >${c.ambangHari} Hari`}
          className="glow-teal"
        >
          {c.blindspot.length === 0 ? (
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
              <span style={{ fontSize: 12, fontWeight: 700 }}>Seluruh Area Terpantau Rutin</span>
              <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
                Tidak ada blindspot inspeksi &gt; {c.ambangHari} hari
              </span>
            </div>
          ) : (
            <MCUChart
              type="bar"
              horizontal
              labels={c.blindspot.slice(0, 5).map((b) => `${b.site} · ${b.label}`)}
              values={c.blindspot.slice(0, 5).map((b) => b.hariTerakhir ?? 365)}
              colors={c.blindspot.slice(0, 5).map((b) =>
                b.hariTerakhir === null || b.hariTerakhir > 90 ? '#FF2D2D' : '#FF7A00'
              )}
              legendLabel="Hari sejak inspeksi"
            />
          )}
        </MCUChartCard>
      </div>
    </div>
  );
}
