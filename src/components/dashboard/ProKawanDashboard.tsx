'use client';

// ============================================================
// Dashboard > ProKawan — AGREGAT, pola tampilan Monitoring MCU
// ============================================================
//
// Dasar:
//  • INK/016 poin 4.6.4 — rekapitulasi kepada manajemen AGREGAT, tanpa identitas.
//  • INK/016 poin 4.7.3 huruf e — atasan hanya menerima status kelayakan kerja.
//  • STD/006 poin 7.2 — rekapitulasi zonasi dalam bentuk agregat.
//  • UU 27/2022 — data kesehatan adalah data pribadi yang spesifik.
//
// DESAIN mengikuti dashboard Monitoring MCU:
//   • kartu `.mcu-dashboard-card` + `.mcu-dashboard-chart`, font 12px judul
//   • donut untuk komposisi (angka total di tengah), bar untuk peringkat
//   • keterangan kartu sesingkat mungkin — label sumbu sudah menjelaskan
//   • satu layar penuh tanpa scroll
//
// Data berasal dari /api/prokawan/dashboard yang hanya mengirim angka agregat.

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { authFetch } from '@/lib/api-client';
import { MCUChart } from '@/components/dashboard/MCUDashboardShared';
import PageLoading from '@/components/ui/page-loading';
import { PALET_BAR } from '@/lib/chart-standard';
import {
  JALUR_LABEL,
  STATUS_LABEL,
  STATUS_WARNA,
  type RingkasanAgregatProKawan,
  type StatusKepatuhan,
  type JalurProKawan,
} from '@/lib/prokawan';

const FONT_WARNA_JALUR: Record<JalurProKawan, string> = {
  'kontrol-dokter': '#3498DB',
  'pemantauan-paramedis': '#2ECC71',
  'evaluasi-alat-bantu': '#F1C40F',
  'konseling-eap': '#9B59B6',
};

export default function ProKawanDashboard() {
  const [ringkas, setRingkas] = useState<RingkasanAgregatProKawan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await authFetch('/api/prokawan/dashboard');
      if (!r.success || !r.ringkasan) throw new Error('Ringkasan ProKawan tidak tersedia');
      setRingkas(r.ringkasan as RingkasanAgregatProKawan);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data ProKawan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Spinner SATU per halaman (bukan per diagram), hilang begitu data siap.
  if (!ringkas) {
    return error
      ? (
        <div className="dashboard mcu-live-dashboard" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 12 }}>
            {error}
          </div>
        </div>
      )
      : <PageLoading label="Memuat ProKawan" />;
  }

  const total = ringkas.total;

  // Urutan tetap agar warna tidak berpindah saat nilainya berubah.
  const jalurKeys = Object.keys(ringkas.byJalur) as JalurProKawan[];
  const statusKeys: StatusKepatuhan[] = ['sesuai-jadwal', 'akan-datang', 'terlambat', 'belum-kontrol', 'selesai'];
  const jadwalKeys = ['lewatBerat', 'lewatRingan', 'segera', 'jauh', 'tanpaJadwal'] as const;
  const jadwalLabel: Record<typeof jadwalKeys[number], string> = {
    lewatBerat: 'Lewat >30 hari',
    lewatRingan: 'Lewat ≤30 hari',
    segera: 'Segera',
    jauh: 'Terjadwal',
    tanpaJadwal: 'Tanpa jadwal',
  };
  const jadwalWarna: Record<typeof jadwalKeys[number], string> = {
    lewatBerat: '#FF2D2D',
    lewatRingan: '#FF7A00',
    segera: '#3498DB',
    jauh: '#00B894',
    tanpaJadwal: '#778899',
  };

  return (
    <div className="dashboard mcu-live-dashboard" style={{ overflow: 'hidden', gap: 8 }}>
      {/* Filter bar — mengikuti pola Monitoring MCU */}
      <div className="mcu-live-top-bar" style={{ flexShrink: 0 }}>
        <div className="mcu-dashboard-filters">
          <label>
            <span>Peserta</span>
            <b style={{ fontSize: 11, color: 'var(--foreground)' }}>{total}</b>
          </label>
          <label>
            <span>Merah</span>
            <b style={{ fontSize: 11, color: '#FF2D2D' }}>{ringkas.byZona.Merah}</b>
          </label>
          <label>
            <span>Terlambat</span>
            <b style={{ fontSize: 11, color: ringkas.jumlahPerluTindakLanjut ? '#FF2D2D' : 'var(--foreground)' }}>
              {ringkas.jumlahPerluTindakLanjut}
            </b>
          </label>
          <label>
            <span>Kepatuhan</span>
            <b style={{ fontSize: 11, color: '#00B894' }}>{ringkas.tingkatKepatuhan.toFixed(0)}%</b>
          </label>
          <button type="button" onClick={() => void load()} disabled={loading} className="mcu-dashboard-refresh">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
        {error && <span style={{ fontSize: 10, color: '#b3261e' }}>{error}</span>}
      </div>

      {/* Baris 1 — donut komposisi */}
      <div className="mcu-live-chart-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, flex: 1, minHeight: 0 }}>
        <div className="card mcu-dashboard-card">
          <div className="card-head">
            <div><h2>Komposisi Zona</h2><p>Peserta per zona risiko</p></div>
          </div>
          <div className="mcu-dashboard-chart">
            <MCUChart
              type="doughnut"
              labels={['Zona Kuning', 'Zona Merah']}
              values={[ringkas.byZona.Kuning, ringkas.byZona.Merah]}
              colors={['#FFD400', '#FF2D2D']}
              legendLabel="Peserta"
              centerText={String(total)}
              percentLabels
            />
          </div>
        </div>

        <div className="card mcu-dashboard-card">
          <div className="card-head">
            <div><h2>Jalur Pengendalian</h2><p>INK/016 poin 4.2</p></div>
          </div>
          <div className="mcu-dashboard-chart">
            <MCUChart
              type="doughnut"
              labels={jalurKeys.map((k) => JALUR_LABEL[k])}
              values={jalurKeys.map((k) => ringkas.byJalur[k])}
              colors={jalurKeys.map((k) => FONT_WARNA_JALUR[k])}
              legendLabel="Peserta"
              centerText={String(total)}
              percentLabels
            />
          </div>
        </div>

        <div className="card mcu-dashboard-card">
          <div className="card-head">
            <div><h2>Status Kepatuhan</h2><p>Kontrol &amp; pemantauan</p></div>
          </div>
          <div className="mcu-dashboard-chart">
            <MCUChart
              type="bar"
              labels={statusKeys.map((k) => STATUS_LABEL[k])}
              values={statusKeys.map((k) => ringkas.byStatus[k])}
              colors={statusKeys.map((k) => STATUS_WARNA[k])}
              legendLabel="Peserta"
            />
          </div>
        </div>

        <div className="card mcu-dashboard-card">
          <div className="card-head">
            <div><h2>Status Jadwal</h2><p>Jatuh tempo kontrol</p></div>
          </div>
          <div className="mcu-dashboard-chart">
            <MCUChart
              type="bar"
              labels={jadwalKeys.map((k) => jadwalLabel[k])}
              values={jadwalKeys.map((k) => ringkas.byUmurJadwal[k])}
              colors={jadwalKeys.map((k) => jadwalWarna[k])}
              horizontal
              legendLabel="Peserta"
            />
          </div>
        </div>
      </div>

      {/* Baris 2 — peringkat */}
      <div className="mcu-live-chart-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 8, flex: 1, minHeight: 0 }}>
        <div className="card mcu-dashboard-card">
          <div className="card-head">
            <div><h2>Peringkat Trigger Zona</h2><p>Parameter pemicu terbanyak</p></div>
          </div>
          <div className="mcu-dashboard-chart">
            <MCUChart
              type="bar"
              labels={ringkas.byParameter.slice(0, 9).map(([k]) => k)}
              values={ringkas.byParameter.slice(0, 9).map(([, v]) => v)}
              colors={ringkas.byParameter.slice(0, 9).map((_, i) => PALET_BAR[i % PALET_BAR.length])}
              horizontal
              legendLabel="Peserta"
            />
          </div>
        </div>

        <div className="card mcu-dashboard-card">
          <div className="card-head">
            <div><h2>Frekuensi Kontrol</h2><p>Paling ketat antar parameter</p></div>
          </div>
          <div className="mcu-dashboard-chart">
            <MCUChart
              type="bar"
              labels={ringkas.byFrekuensi.map(([k]) => k)}
              values={ringkas.byFrekuensi.map(([, v]) => v)}
              colors={ringkas.byFrekuensi.map(([k]) =>
                k.startsWith('1') ? '#FF2D2D' : k.startsWith('3') ? '#FFD400' : k.startsWith('6') ? '#3498DB' : '#778899')}
              horizontal
              legendLabel="Peserta"
            />
          </div>
        </div>

        <div className="card mcu-dashboard-card">
          <div className="card-head">
            <div><h2>Kelayakan Kerja</h2><p>Status dari MCU</p></div>
          </div>
          <div className="mcu-dashboard-chart">
            <MCUChart
              type="bar"
              labels={ringkas.byKelayakan.map(([k]) => k)}
              values={ringkas.byKelayakan.map(([, v]) => v)}
              colors={ringkas.byKelayakan.map((_, i) => ['#00B894', '#3498DB', '#FF7A00', '#778899'][i % 4])}
              horizontal
              legendLabel="Peserta"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
