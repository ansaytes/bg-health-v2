'use client';

// Dashboard > Program Inspeksi > Tab 1: Kinerja Program & Manajemen Risiko Temuan
//
// ACUAN STANDAR AUDIT:
//   - Kepmen ESDM No. 1827 K/30/MEM/2018 Lampiran IV (Kesehatan Kerja Pertambangan)
//   - Kepdirjen Minerba No. 185 K/37.04/DJB/2019 (SMKP Minerba Elemen V: Pemantauan, Evaluasi & Tindak Lanjut)
//   - ISO 45001:2018 Klausul 9.1 (Monitoring & Measurement) & 10.2 (Corrective Action & Recurrence Prevention)
//
// Fokus Utama:
//   1. Capaian eksekusi jadwal inspeksi kritis (Plan vs Actual)
//   2. Profil keparahan risiko temuan PICA (Kritis 3 hari, Mayor 14 hari, Minor 30 hari)
//   3. Kecepatan resolusi & penutupan temuan kritis (MTTR Kritis)
//   4. Evaluasi pencegahan temuan berulang (Recurrent Non-Conformance)
//   5. Akuntabilitas penutupan PICA per departemen
//   6. Deteksi blindspot area kerja tambang (>30 hari tidak tersampling)

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

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
    terulang?: { objek: string; jumlah: number; picaIds: string[] }[];
    tingkat?: { kritis: number; mayor: number; minor: number };
    kritisAktif?: number;
    mttrKritis?: number | null;
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

  if (loading && !data) return <PageLoading label="Memuat kinerja program & mitigasi risiko temuan" />;

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

  // Profil Keparahan PICA
  const kritis = p.tingkat?.kritis ?? 0;
  const mayor = p.tingkat?.mayor ?? 0;
  const minor = p.tingkat?.minor ?? Math.max(0, p.total - kritis - mayor);
  const kritisAktif = p.kritisAktif ?? 0;

  // Temuan Berulang
  const terulang = p.terulang ?? [];

  return (
    <div className="dashboard mcu-live-dashboard">
      {/* ── Top Bar: Filter & Risk-Based KPI Chips ────────────────────── */}
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

        {/* Audit-Grade KPI Badges */}
        <div className="mcu-total-bar">
          <span className="mcu-total-label">Target Jadwal:</span>
          <span className="mcu-total-num">{e.target}</span>
          <span style={{ fontWeight: 700, color: e.persenSelesai >= 90 ? '#00B894' : e.persenSelesai >= 75 ? '#E67E22' : '#FF2D2D' }}>
            Realisasi: {e.selesai} ({e.persenSelesai}%)
          </span>
          <span style={{ fontWeight: 700, color: kritisAktif > 0 ? '#FF2D2D' : '#00B894' }}>
            Temuan Kritis Terbuka: {kritisAktif}
          </span>
          <span style={{ fontWeight: 700, color: p.overdue > 0 ? '#FF2D2D' : '#00B894' }}>
            PICA Overdue: {p.overdue}
          </span>
          <span style={{ fontWeight: 700, color: '#3498DB' }}>
            MTTR: {p.mttr !== null ? `${p.mttr} Hari` : '-'}
          </span>
          <span style={{ fontWeight: 700, color: c.blindspot.length > 0 ? '#E67E22' : '#00B894' }}>
            Blindspot: {c.blindspot.length} Area
          </span>
          <MCURefreshButton loading={loading} onClick={() => void load()} />
        </div>
      </div>

      {data.catatan && (
        <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,196,0,0.10)', border: '1px solid rgba(255,196,0,0.4)', color: '#9a6b00', fontSize: 11 }}>
          {data.catatan}
        </div>
      )}

      {/* ── BARIS 1: Eksekusi Program & Manajemen Risiko Temuan ────────── */}
      <div className="mcu-grid-3 mcu-live-chart-row">
        {/* CARD 1: Capaian Jadwal Program Inspeksi */}
        <MCUChartCard
          title="Capaian Jadwal Inspeksi"
          subtitle={`Target: ${e.target} · Selesai: ${e.selesai} · Terlewat: ${e.terlewat}`}
          className="glow-teal"
        >
          <MCUChart
            type="doughnut"
            labels={['Selesai Sesuai Rencana', 'Belum Terlaksana', 'Terlewat Jadwal']}
            values={[e.selesai, Math.max(0, e.target - e.selesai - e.terlewat), e.terlewat]}
            colors={['#00B894', '#B0B7C3', '#FF2D2D']}
            centerText={`${e.persenSelesai}%`}
            percentLabels
          />
        </MCUChartCard>

        {/* CARD 2: Profil Keparahan Temuan PICA (Risk Severity Matrix) */}
        <MCUChartCard
          title="Tingkat Risiko Temuan PICA"
          subtitle="Klasifikasi Risiko: Kritis (3 Hari), Mayor (14 Hari), Minor (30 Hari)"
          className="glow-coral"
        >
          {p.total > 0 ? (
            <MCUChart
              type="doughnut"
              labels={['Kritis (High Risk)', 'Mayor (Medium Risk)', 'Minor (Low Risk)']}
              values={[kritis, mayor, minor]}
              colors={['#FF2D2D', '#FF7A00', '#3498DB']}
              centerText={String(p.total)}
              percentLabels
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#00B894', gap: 6 }}>
              <CheckCircle2 size={32} />
              <span style={{ fontSize: 12, fontWeight: 700 }}>Zero Finding</span>
              <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Tidak ada temuan ketidaksesuaian</span>
            </div>
          )}
        </MCUChartCard>

        {/* CARD 3: Kecepatan Resolusi PICA & Status Overdue */}
        <MCUChartCard
          title="Kecepatan Resolusi PICA"
          subtitle={`MTTR Rata-rata: ${p.mttr !== null ? `${p.mttr} Hari` : '-'} · Closed: ${p.closed} · Overdue: ${p.overdue}`}
          className="glow-orange"
        >
          <MCUChart
            type="doughnut"
            labels={['Closed Selesai', 'Aktif Dalam Tenggat', 'Overdue Melewati SLA']}
            values={[p.closed, Math.max(0, p.aktif - p.overdue), p.overdue]}
            colors={['#00B894', '#3498DB', '#FF2D2D']}
            centerText={String(p.total)}
            percentLabels
          />
        </MCUChartCard>
      </div>

      {/* ── BARIS 2: Evaluasi Temuan Berulang, Akuntabilitas & Blindspot ── */}
      <div className="mcu-grid-3 mcu-live-chart-row">
        {/* CARD 4: Evaluasi Temuan Berulang (Recurrent Non-Conformance) */}
        <MCUChartCard
          title="Evaluasi Temuan Berulang"
          subtitle="Verifikasi Efektivitas Tindakan Korektif (ISO 45001 Klausul 10.2)"
          className="glow-amber"
        >
          {terulang.length === 0 ? (
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
              <CheckCircle2 size={32} color="#00B894" />
              <span style={{ fontSize: 12, fontWeight: 700 }}>Nol Temuan Berulang</span>
              <span style={{ fontSize: 10, color: 'var(--muted-foreground)', textAlign: 'center' }}>
                Tindakan korektif efektif, tidak ada objek dengan temuan berulang
              </span>
            </div>
          ) : (
            <MCUChart
              type="bar"
              horizontal
              labels={terulang.slice(0, 5).map((x) => x.objek)}
              values={terulang.slice(0, 5).map((x) => x.jumlah)}
              colors={terulang.slice(0, 5).map(() => '#FF7A00')}
              legendLabel="Frekuensi Temuan"
            />
          )}
        </MCUChartCard>

        {/* CARD 5: PICA per Departemen Penanggung Jawab */}
        <MCUChartCard
          title="PICA per Departemen"
          subtitle="Akuntabilitas Departemen Terhadap Tindak Lanjut Temuan"
          className="glow-steel"
        >
          {p.perDepartemen.length === 0 ? (
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
              <CheckCircle2 size={32} color="#00B894" />
              <span style={{ fontSize: 12, fontWeight: 700 }}>Seluruh PICA Terselesaikan</span>
              <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Tidak ada temuan aktif pada periode ini</span>
            </div>
          ) : (
            <MCUChart
              type="bar"
              horizontal
              labels={p.perDepartemen.slice(0, 6).map((d) => d.departemen)}
              values={p.perDepartemen.slice(0, 6).map((d) => d.aktif)}
              colors={p.perDepartemen.slice(0, 6).map((d) => (d.overdue > 0 ? '#FF2D2D' : '#3498DB'))}
              legendLabel="Temuan Aktif"
            />
          )}
        </MCUChartCard>

        {/* CARD 6: Deteksi Blindspot Area Operasional Tambang */}
        <MCUChartCard
          title="Deteksi Blindspot Fasilitas"
          subtitle={`Area/Fasilitas Belum Tersampling >${c.ambangHari} Hari (Kepdirjen 185 Elemen V)`}
          className="glow-coral"
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
              <CheckCircle2 size={32} color="#00B894" />
              <span style={{ fontSize: 12, fontWeight: 700 }}>Cakupan Sampling 100%</span>
              <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Seluruh area operasional telah tersampling</span>
            </div>
          ) : (
            <MCUChart
              type="bar"
              horizontal
              labels={c.blindspot.slice(0, 6).map((b) => `${b.label} (${b.site})`)}
              values={c.blindspot.slice(0, 6).map((b) => b.hariTerakhir ?? 90)}
              colors={c.blindspot.slice(0, 6).map((b) => ((b.hariTerakhir ?? 90) >= 60 ? '#FF2D2D' : '#FF7A00'))}
              legendLabel="Hari Belum Tersampling"
            />
          )}
        </MCUChartCard>
      </div>
    </div>
  );
}
