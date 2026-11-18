'use client';

// ============================================================
// Dashboard > Program Inspeksi > Tab 1: Kinerja Tim Inspeksi
// ============================================================
//
// Khusus memantau akuntabilitas, kedisiplinan & kinerja operasional petugas:
//   • Capaian jadwal bulanan (Plan vs Actual) & ketepatan waktu inspektur
//   • Distribusi beban & produktivitas inspeksi per petugas
//   • Kecepatan resolusi PICA (MTTR) & temuan overdue per departemen
//   • Deteksi blindspot (area yang diabaikan/lama tidak diperiksa >30 hari)
//
// Mengikuti standar template MCU: Top bar + 2 Baris (mcu-grid-3), total 6 kartu.

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, UserCheck } from 'lucide-react';

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
  };
  cakupan: {
    terdaftar: number;
    tersampling: number;
    persen: number;
    ambangHari: number;
    blindspot: { site: string; label: string; hariTerakhir: number | null; terakhir: string | null; jumlahObjek: number }[];
  };
  pica: {
    total: number;
    aktif: number;
    closed: number;
    overdue: number;
    mttr: number | null;
    perDepartemen: { departemen: string; aktif: number; overdue: number; closed: number }[];
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
      setError(e instanceof Error ? e.message : 'Gagal memuat kinerja inspeksi');
    } finally {
      setLoading(false);
    }
  }, [site, periode]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) return <PageLoading label="Memuat kinerja tim inspeksi" />;

  if (!data) {
    return (
      <div className="dashboard mcu-live-dashboard" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 12 }}>
          {error || 'Data kinerja tim inspeksi tidak tersedia.'}
        </div>
      </div>
    );
  }

  const e = data.eksekusi;
  const c = data.cakupan;
  const p = data.pica;
  const pr = data.produktivitas;

  return (
    <div className="dashboard mcu-live-dashboard">
      {/* ── Top Bar: Filter & Team Performance Badges ─────────────────── */}
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

        {/* Accountability KPI Chips */}
        <div className="mcu-total-bar">
          <span className="mcu-total-label">Target Inspeksi:</span>
          <span className="mcu-total-num">{e.target}</span>
          <span style={{ fontWeight: 700, color: e.persenSelesai >= 90 ? '#00B894' : e.persenSelesai >= 70 ? '#E67E22' : '#FF2D2D' }}>
            Selesai: {e.selesai} ({e.persenSelesai}%)
          </span>
          <span style={{ fontWeight: 700, color: e.terlewat > 0 ? '#FF2D2D' : 'inherit' }}>
            Terlewat: {e.terlewat}
          </span>
          <span style={{ fontWeight: 700, color: p.overdue > 0 ? '#FF2D2D' : 'inherit' }}>
            PICA Overdue: {p.overdue}
          </span>
          <span style={{ fontWeight: 700, color: '#3498DB' }}>
            MTTR: {p.mttr !== null ? `${p.mttr} Hari` : '—'}
          </span>
          <MCURefreshButton loading={loading} onClick={() => void load()} />
        </div>
      </div>

      {data.catatan && (
        <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,196,0,0.10)', border: '1px solid rgba(255,196,0,0.4)', color: '#9a6b00', fontSize: 11 }}>
          {data.catatan}
        </div>
      )}

      {/* ── BARIS 1: Eksekusi Jadwal & Produktivitas Tim (3 Kartu) ──────── */}
      <div className="mcu-grid-3 mcu-live-chart-row">
        {/* CARD 1: Capaian Target Jadwal Inspeksi */}
        <MCUChartCard
          title="Capaian Jadwal Inspeksi"
          subtitle={`Target: ${e.target} · Selesai: ${e.selesai} · Terlewat: ${e.terlewat}`}
          className="glow-coral"
        >
          <MCUChart
            type="doughnut"
            labels={['Selesai', 'Belum Terlaksana', 'Terlewat']}
            values={[e.selesai, Math.max(0, e.target - e.selesai - e.terlewat), e.terlewat]}
            colors={['#00B894', '#B0B7C3', '#FF2D2D']}
            centerText={String(e.target)}
            percentLabels
          />
        </MCUChartCard>

        {/* CARD 2: Ketepatan Waktu Pelaksanaan */}
        <MCUChartCard
          title="Ketepatan Waktu Pelaksanaan"
          subtitle={`${e.tepatWaktu} Tepat Jadwal · ${e.terlambat} Terlambat`}
          className="glow-teal"
        >
          <MCUChart
            type="doughnut"
            labels={['Tepat Waktu', 'Terlambat']}
            values={[e.tepatWaktu, e.terlambat]}
            colors={['#00B894', '#F39C12']}
            centerText={String(e.selesai)}
            percentLabels
          />
        </MCUChartCard>

        {/* CARD 3: Beban & Produktivitas Petugas Pelaksana */}
        <MCUChartCard
          title="Produktivitas Petugas Pelaksana"
          subtitle="Distribusi inspeksi selesai per PIC/inspektur"
          className="glow-steel"
        >
          {pr.perPetugas.length === 0 ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--muted-foreground)',
                gap: 6,
                padding: 20,
              }}
            >
              <UserCheck size={32} />
              <span style={{ fontSize: 12 }}>Belum ada pencatatan nama petugas</span>
            </div>
          ) : (
            <MCUChart
              type="bar"
              horizontal
              labels={pr.perPetugas.slice(0, 6).map((x) => x.petugas)}
              values={pr.perPetugas.slice(0, 6).map((x) => x.selesai)}
              colors={pr.perPetugas.slice(0, 6).map(() => '#3498DB')}
              legendLabel="Inspeksi Selesai"
            />
          )}
        </MCUChartCard>
      </div>

      {/* ── BARIS 2: Kinerja PICA & Cakupan Pengawasan (3 Kartu) ────────── */}
      <div className="mcu-grid-3 mcu-live-chart-row">
        {/* CARD 4: Kinerja Resolusi PICA (MTTR) */}
        <MCUChartCard
          title="Kecepatan Resolusi PICA"
          subtitle={`MTTR: ${p.mttr !== null ? `${p.mttr} Hari` : '—'} · Closed: ${p.closed} · Overdue: ${p.overdue}`}
          className="glow-orange"
        >
          <MCUChart
            type="doughnut"
            labels={['Closed (Selesai)', 'Aktif Berjalan', 'Overdue (Lewat Tenggat)']}
            values={[p.closed, Math.max(0, p.aktif - p.overdue), p.overdue]}
            colors={['#00B894', '#3498DB', '#FF2D2D']}
            centerText={String(p.total)}
            percentLabels
          />
        </MCUChartCard>

        {/* CARD 5: PICA per Departemen Penanggung Jawab */}
        <MCUChartCard
          title="PICA per Departemen"
          subtitle="Departemen penanggung jawab temuan aktif"
          className="glow-amber"
        >
          {p.perDepartemen.length === 0 ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--muted-foreground)',
                gap: 6,
                padding: 20,
              }}
            >
              <CheckCircle2 size={32} color="#00B894" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#00B894' }}>Zero PICA Finding</span>
              <span style={{ fontSize: 10 }}>Tidak ada temuan PICA aktif pada periode ini</span>
            </div>
          ) : (
            <MCUChart
              type="bar"
              horizontal
              labels={p.perDepartemen.slice(0, 6).map((d) => d.departemen)}
              values={p.perDepartemen.slice(0, 6).map((d) => d.aktif)}
              colors={p.perDepartemen.slice(0, 6).map((d) => (d.overdue > 0 ? '#FF2D2D' : '#FF7A00'))}
              legendLabel="PICA Aktif"
            />
          )}
        </MCUChartCard>

        {/* CARD 6: Deteksi Blindspot Area (>30 Hari Tidak Diperiksa) */}
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
              <span style={{ fontSize: 12, fontWeight: 700 }}>Semua Area Terpantau Rutin</span>
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
