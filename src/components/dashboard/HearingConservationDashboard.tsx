'use client';
// Dashboard > Hearing Conservation. Data dari /api/hc?resource=dashboard (noise mapping, klasifikasi, audiometri MCU, STS).
// Mengikuti template Monitoring MCU & Kunjungan Berobat: top bar filter + KPI ringkas, 2 baris kartu (.mcu-grid-3),
// campuran donut & bar via MCUChartCard / MCUChart agar legend & label tidak pernah terpotong.

import { useCallback, useEffect, useState } from 'react';
import { Ear } from 'lucide-react';

import { authFetch } from '@/lib/api-client';
import { ZONA_COLOR } from '@/lib/hc-ergo';
import { useSites } from '@/lib/site-list';
import PageLoading from '@/components/ui/page-loading';
import { MCUChart, MCUChartCard, MCURefreshButton } from '@/components/dashboard/MCUDashboardShared';

type D = Record<string, any>;

const KELAS_COLOR: Record<string, string> = {
  Normal: '#00B894',
  Ringan: '#F5C518',
  Sedang: '#F5A623',
  Berat: '#FF6B35',
  'Sangat Berat': '#E63946',
};
const KELAS_ORDER = ['Normal', 'Ringan', 'Sedang', 'Berat', 'Sangat Berat'];

export default function HearingConservationDashboard() {
  const { sites: daftarSite } = useSites();
  const [d, setD] = useState<D | null>(null);
  const [site, setSite] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const r = await authFetch(`/api/hc?resource=dashboard&site=${encodeURIComponent(site)}`);
      setD(r.data as D);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat dashboard');
    } finally {
      setLoading(false);
    }
  }, [site]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading && !d) return <PageLoading label="Memuat Konservasi Pendengaran" />;

  if (!d) {
    return (
      <div className="dashboard mcu-live-dashboard" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 12 }}>
          {err || 'Data Konservasi Pendengaran tidak tersedia.'}
        </div>
      </div>
    );
  }

  const zonaVals = [
    Number(d.zona?.MERAH ?? 0),
    Number(d.zona?.KUNING ?? 0),
    Number(d.zona?.HIJAU ?? 0),
    Number(d.zona?.BELUM ?? 0),
  ];
  const nAreaTot = zonaVals.reduce((a, b) => a + b, 0);

  const cakupanList = (d.cakupan || []) as D[];
  const cakA = cakupanList.find((c) => c.kategori === 'A') ?? { total: 0, sudahTahunIni: 0 };
  const cakB = cakupanList.find((c) => c.kategori === 'B') ?? { total: 0, sudahTahunIni: 0 };
  const katATotal = Number(cakA.total ?? 0);
  const katASudah = Number(cakA.sudahTahunIni ?? 0);
  const katBTotal = Number(cakB.total ?? 0);
  const katBSudah = Number(cakB.sudahTahunIni ?? 0);

  const kelasMap = (d.kelas || {}) as Record<string, number>;
  const kelasLabels = KELAS_ORDER.filter((k) => Number(kelasMap[k] ?? 0) > 0 || kelasMap[k] === 0);

  const katTotal = Number(d.kategori?.A ?? 0) + Number(d.kategori?.B ?? 0) + Number(d.kategori?.C ?? 0);
  const cakTotal = katATotal + katBTotal;
  const stsTotal =
    Number(d.sts?.suspek ?? 0) +
    Number(d.sts?.retestDijadwalkan ?? 0) +
    Number(d.sts?.terkonfirmasi ?? 0) +
    Number(d.sts?.retestTerlambat ?? 0);

  return (
    <div className="dashboard mcu-live-dashboard">
      {/* ── Top Bar: Filter & KPI Audit (pola Monitoring MCU) ─────────── */}
      <div className="dashboard-top-bar mcu-live-top-bar">
        <div className="mcu-dashboard-filters">
          <label>
            <span>Site</span>
            <select
              value={site}
              onChange={(e) => setSite(e.target.value)}
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
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mcu-total-bar">
          <span>Zona Merah <b style={{ color: ZONA_COLOR.MERAH }}>{d.zona?.MERAH ?? 0}</b>/{nAreaTot}</span>
          <span>Ukur Terlambat <b style={{ color: d.areaTerlambat ? '#E63946' : 'inherit' }}>{d.areaTerlambat ?? 0}</b></span>
          <span>STS Blm Ditindak <b style={{ color: d.sts?.belumDitindaklanjuti ? '#E63946' : 'inherit' }}>{d.sts?.belumDitindaklanjuti ?? 0}</b></span>
          <span>Audio Tdk Lengkap <b style={{ color: d.audiometri?.tidakLengkap ? '#d97706' : 'inherit' }}>{d.audiometri?.tidakLengkap ?? 0}</b></span>
          <span>Retest Terlambat <b style={{ color: d.sts?.retestTerlambat ? '#E63946' : 'inherit' }}>{d.sts?.retestTerlambat ?? 0}</b></span>
          <MCURefreshButton loading={loading} onClick={() => void loadData()} />
        </div>
      </div>

      {err && (
        <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 11 }}>
          {err}
        </div>
      )}

      {/* ── BARIS 1: Pemetaan Area, Derajat WHO & Cakupan Kategori A ───── */}
      <div className="mcu-grid-3 mcu-live-chart-row">
        <MCUChartCard
          title="Zona Kebisingan Area"
          subtitle="Pengukuran terakhir (NAB 85 dBA)"
          className="glow-coral"
        >
          {nAreaTot > 0 ? (
            <MCUChart
              type="doughnut"
              labels={['Merah', 'Kuning', 'Hijau', 'Belum Diukur']}
              values={zonaVals}
              colors={['#E63946', '#F5C518', '#00B894', '#B0B7C3']}
              centerText={String(nAreaTot)}
              percentLabels
            />
          ) : (
            <Kosong label="Belum ada data area kebisingan" />
          )}
        </MCUChartCard>

        <MCUChartCard
          title="Derajat Gangguan Pendengaran"
          subtitle="Klasifikasi WHO · telinga yang lebih baik"
          className="glow-steel"
        >
          {kelasLabels.length > 0 ? (
            <MCUChart
              type="bar"
              labels={kelasLabels}
              values={kelasLabels.map((k) => Number(kelasMap[k] ?? 0))}
              colors={kelasLabels.map((k) => KELAS_COLOR[k] || '#778899')}
              legendLabel="Karyawan"
            />
          ) : (
            <Kosong label="Belum ada data derajat audiometri" />
          )}
        </MCUChartCard>

        <MCUChartCard
          title="Cakupan Audiometri Kategori A"
          subtitle="Pajanan >85 dBA · wajib audiometri tahunan"
          className="glow-teal"
        >
          {katATotal > 0 ? (
            <MCUChart
              type="doughnut"
              labels={['Sudah Tahun Ini', 'Belum Tahun Ini']}
              values={[katASudah, Math.max(0, katATotal - katASudah)]}
              colors={['#00B894', '#FF2D2D']}
              centerText={String(katATotal)}
              percentLabels
            />
          ) : (
            <Kosong label="Belum ada karyawan Kategori A" />
          )}
        </MCUChartCard>
      </div>

      {/* ── BARIS 2: Cakupan Kategori B, STS & Evaluasi Efektivitas ────── */}
      <div className="mcu-grid-3 mcu-live-chart-row">
        <MCUChartCard
          title="Cakupan Audiometri Kategori B"
          subtitle="Pajanan 82–85 dBA · pengawasan berkala"
          className="glow-amber"
        >
          {katBTotal > 0 ? (
            <MCUChart
              type="doughnut"
              labels={['Sudah Tahun Ini', 'Belum Tahun Ini']}
              values={[katBSudah, Math.max(0, katBTotal - katBSudah)]}
              colors={['#2E86DE', '#F5A623']}
              centerText={String(katBTotal)}
              percentLabels
            />
          ) : (
            <Kosong label="Belum ada karyawan Kategori B" />
          )}
        </MCUChartCard>

        <MCUChartCard
          title="Kasus & Tindak Lanjut STS"
          subtitle="Suspek, retest dijadwalkan, terkonfirmasi, terlambat"
          className="glow-orange"
        >
          <MCUChart
            type="bar"
            labels={['Suspek', 'Retest', 'Konfirmasi', 'Terlambat']}
            values={[
              Number(d.sts?.suspek ?? 0),
              Number(d.sts?.retestDijadwalkan ?? 0),
              Number(d.sts?.terkonfirmasi ?? 0),
              Number(d.sts?.retestTerlambat ?? 0),
            ]}
            colors={['#E63946', '#F5A623', '#8E44AD', '#B91C1C']}
            legendLabel="Kasus STS"
          />
        </MCUChartCard>

        <MCUChartCard
          title="Evaluasi Efektivitas Tahunan"
          subtitle="Kepatuhan Program Konservasi Pendengaran (SOP/028)"
          className="glow-teal"
        >
          <EvaluasiTahunanBody
            d={d}
            nAreaTot={nAreaTot}
            katTotal={katTotal}
            cakTotal={cakTotal}
            stsTotal={stsTotal}
          />
        </MCUChartCard>
      </div>
    </div>
  );
}

function EvaluasiTahunanBody({ d, nAreaTot, katTotal, cakTotal, stsTotal }: {
  d: D; nAreaTot: number; katTotal: number; cakTotal: number; stsTotal: number;
}) {
  const areaTerlambat = Number(d.areaTerlambat ?? 0);
  const kepatuhanUkur = nAreaTot ? ((nAreaTot - areaTerlambat) / nAreaTot) * 100 : 0;
  const terperiksa = ((d.cakupan || []) as D[]).reduce((s, c) => s + Number(c.sudahTahunIni ?? 0), 0);
  const cakupan = cakTotal ? (terperiksa / cakTotal) * 100 : 0;
  const stsDitindak = Number(d.sts?.terkonfirmasi ?? 0) + Number(d.sts?.retestDijadwalkan ?? 0);
  const stsSelesai = stsTotal ? (stsDitindak / stsTotal) * 100 : 100;
  const katAB = Number(d.kategori?.A ?? 0) + Number(d.kategori?.B ?? 0);
  const cakTerpajan = katTotal ? (katAB / katTotal) * 100 : 0;

  const item = [
    {
      label: 'Kepatuhan Ukur Area',
      nilai: kepatuhanUkur,
      ket: `${nAreaTot - areaTerlambat}/${nAreaTot} area sesuai jadwal`,
    },
    {
      label: 'Cakupan Audiometri A & B',
      nilai: cakupan,
      ket: `${terperiksa}/${cakTotal} karyawan diperiksa`,
    },
    {
      label: 'Tindak Lanjut STS',
      nilai: stsSelesai,
      ket: stsTotal ? `${stsDitindak}/${stsTotal} kasus ditangani` : 'Belum ada kasus STS',
    },
    {
      label: 'Karyawan Terpajan A/B',
      nilai: cakTerpajan,
      ket: `${katAB}/${katTotal} terklasifikasi A/B`,
    },
  ];

  const terendah = Math.min(...item.map((i) => i.nilai));
  const warna = terendah >= 95 ? '#00B894' : terendah >= 80 ? '#F1C40F' : '#E63946';
  const statusLabel = terendah >= 95 ? 'Efektif' : terendah >= 80 ? 'Perlu Perbaikan' : 'Tidak Efektif';

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8, paddingTop: 4 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        borderRadius: 8,
        background: 'var(--muted)',
        borderLeft: `3px solid ${warna}`,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Status Program
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color: warna }}>{statusLabel}</span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', gap: 6 }}>
        {item.map((i) => {
          const w = i.nilai >= 95 ? '#00B894' : i.nilai >= 80 ? '#F1C40F' : '#E63946';
          return (
            <div key={i.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {i.label}
                </span>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: w, flexShrink: 0 }}>
                  {i.nilai.toFixed(0)}% <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--muted-foreground)' }}>({i.ket})</span>
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--muted)', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(i.nilai, 100)}%`, height: '100%', borderRadius: 3, background: w }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Kosong({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted-foreground)', gap: 6 }}>
      <Ear size={28} style={{ opacity: 0.3 }} />
      <span style={{ fontSize: 11 }}>{label}</span>
    </div>
  );
}
