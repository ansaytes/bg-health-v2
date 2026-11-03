'use client';

// ============================================================
// Dashboard > SPIP — Sarana, Prasarana, Instalasi, Peralatan
// ============================================================
//
// PILIH SITE: dashboard bisa melihat satu site (fokus) atau seluruh site.
// Sebelumnya tidak ada filter, sehingga saat sebuah site dipilih angkanya
// hanya berisi site itu — grafik "per site" jadi tidak berarti.
//
// ISI (yang dibutuhkan untuk pelaporan):
//   1. Kelengkapan     — tersedia vs belum tersedia
//   2. Kelayakan       — alat layak pakai vs rusak
//   3. Kalibrasi       — patuh / mendekati / lewat 12 bulan
//   4. Top 10 item rusak & top 10 item belum tersedia
//   5. Peringkat kelengkapan per site
//
// TEMPLATE mengikuti Monitoring MCU: kartu `.mcu-dashboard-card`, donut dengan
// total di tengah, bar horizontal, satu layar tanpa scroll.

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { authFetch } from '@/lib/api-client';
import { MCUChart } from '@/components/dashboard/MCUDashboardShared';
import PageLoading from '@/components/ui/page-loading';
import { PALET_BAR } from '@/lib/chart-standard';

interface Data {
  tabelSiap: boolean;
  catatan?: string;
  site: string | null;
  daftarSite: string[];
  ringkasan: {
    jumlahSite: number; itemWajib: number; tersedia: number; rusak: number;
    tidakAda: number; tidakDiperlukan: number; belumDicatat: number;
    persenLengkap: number; persenLayak: number; persenKalibrasiPatuh: number;
  };
  kelengkapan: { tersedia: number; rusak: number; tidakAda: number; tidakDiperlukan: number };
  kelayakan: { layak: number; rusak: number; persenLayak: number };
  kalibrasi: { patuh: number; mendekati: number; lewat: number; belumAda: number; batasBulan: number; peringatanBulan: number };
  perKategori: { kategori: string; key: string; tersedia: number; rusak: number; belum: number }[];
  topRusak: { nama: string; jumlah: number }[];
  topBelum: { nama: string; jumlah: number }[];
  alatKalibrasi: { nama: string; site: string; tanggal: string | null; bulan: number | null }[];
  perSite: { site: string; wajib: number; tersedia: number; rusak: number; persen: number }[];
}

export default function SPIPDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [site, setSite] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = site ? `?site=${encodeURIComponent(site)}` : '';
      const r = await authFetch(`/api/sarana/dashboard${qs}`);
      setData(r as unknown as Data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data SPIP');
    } finally {
      setLoading(false);
    }
  }, [site]);

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
  const k = data.kelengkapan;
  const kl = data.kalibrasi;
  const adaData = r.itemWajib > 0;

  if (!adaData) {
    return (
      <div className="dashboard mcu-live-dashboard" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>Belum ada data pengukuran</p>
      </div>
    );
  }

  return (
    <div className="dashboard mcu-live-dashboard" style={{ overflow: 'hidden', gap: 8 }}>
      {/* Filter site */}
      <div className="mcu-live-top-bar" style={{ flexShrink: 0 }}>
        <div className="mcu-dashboard-filters">
          <label>
            <span>Site</span>
            <select
              value={site}
              onChange={(e) => setSite(e.target.value)}
              style={{ height: 28, minWidth: 130, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--background)', fontSize: 10, fontWeight: 700, padding: '0 6px' }}
            >
              <option value="">Semua Site</option>
              {data.daftarSite.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label><span>Kelengkapan</span><b style={{ fontSize: 11, color: r.persenLengkap >= 90 ? '#00B894' : r.persenLengkap >= 70 ? '#C99A00' : '#FF2D2D' }}>{r.persenLengkap}%</b></label>
          <label><span>Kelayakan</span><b style={{ fontSize: 11, color: r.persenLayak >= 90 ? '#00B894' : '#FF7A00' }}>{r.persenLayak}%</b></label>
          <label><span>Kalibrasi patuh</span><b style={{ fontSize: 11, color: r.persenKalibrasiPatuh >= 90 ? '#00B894' : '#FF2D2D' }}>{r.persenKalibrasiPatuh}%</b></label>
          <button type="button" onClick={() => void load()} disabled={loading} className="mcu-dashboard-refresh">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
        {error && <span style={{ fontSize: 10, color: '#b3261e' }}>{error}</span>}
      </div>

      {/* Baris 1 — tiga donut */}
      <div className="mcu-live-chart-row">
        <div className="card mcu-dashboard-card">
          <div className="card-head"><div><h2>Kelengkapan</h2><p>Tersedia vs belum tersedia</p></div></div>
          <div className="mcu-dashboard-chart">
            <MCUChart
              type="doughnut"
              labels={['Tersedia', 'Tidak ada', 'Rusak', 'Tidak diperlukan']}
              values={[k.tersedia, k.tidakAda, k.rusak, k.tidakDiperlukan]}
              colors={['#00B894', '#FF7A00', '#FF2D2D', '#778899']}
              legendLabel="Item"
              centerText={String(r.itemWajib)}
              percentLabels
            />
          </div>
        </div>

        <div className="card mcu-dashboard-card">
          <div className="card-head"><div><h2>Kelayakan Alat</h2><p>Layak pakai vs rusak</p></div></div>
          <div className="mcu-dashboard-chart">
            <MCUChart
              type="doughnut"
              labels={['Layak pakai', 'Rusak']}
              values={[data.kelayakan.layak, data.kelayakan.rusak]}
              colors={['#00B894', '#FF2D2D']}
              legendLabel="Item"
              centerText={`${data.kelayakan.persenLayak}%`}
              percentLabels
            />
          </div>
        </div>

        <div className="card mcu-dashboard-card">
          <div className="card-head"><div><h2>Kalibrasi</h2><p>Batas {kl.batasBulan} bulan</p></div></div>
          <div className="mcu-dashboard-chart">
            <MCUChart
              type="doughnut"
              labels={['Patuh', `Mendekati (≥${kl.peringatanBulan} bln)`, 'Lewat', 'Belum pernah']}
              values={[kl.patuh, kl.mendekati, kl.lewat, kl.belumAda]}
              colors={['#00B894', '#F1C40F', '#FF2D2D', '#778899']}
              legendLabel="Alat"
              centerText={`${r.persenKalibrasiPatuh}%`}
              percentLabels
            />
          </div>
        </div>
      </div>

      {/* Baris 2 — top 10 rusak, top 10 belum, per kategori */}
      <div className="mcu-live-chart-row">
        <KartuChart judul="Top 10 SPIP Rusak" sub="Jumlah site dengan alat rusak" kosong={!data.topRusak.length} pesanKosong="Tidak ada alat rusak">
          <MCUChart
            type="bar"
            labels={data.topRusak.map((x) => x.nama)}
            values={data.topRusak.map((x) => x.jumlah)}
            colors={data.topRusak.map((_, i) => PALET_BAR[i % PALET_BAR.length])}
            horizontal
            legendLabel="Site"
          />
        </KartuChart>

        <KartuChart judul="Item Belum Tersedia" sub="Jumlah site yang belum menyediakan" kosong={!data.topBelum.length} pesanKosong="Semua item wajib sudah tercatat">
          <MCUChart
            type="bar"
            labels={data.topBelum.map((x) => x.nama)}
            values={data.topBelum.map((x) => x.jumlah)}
            colors={data.topBelum.map((_, i) => PALET_BAR[i % PALET_BAR.length])}
            horizontal
            legendLabel="Site"
          />
        </KartuChart>

        <div className="card mcu-dashboard-card">
          <div className="card-head"><div><h2>Status per Kategori</h2><p>Tersedia · rusak · belum</p></div></div>
          <div className="mcu-dashboard-chart">
            <MCUChart
              type="bar"
              labels={data.perKategori.map((x) => x.kategori)}
              values={data.perKategori.map((x) => x.rusak + x.belum)}
              colors={data.perKategori.map((_, i) => PALET_BAR[i % PALET_BAR.length])}
              horizontal
              legendLabel="Item bermasalah"
            />
          </div>
        </div>
      </div>

      {/* Baris 3 — per site + kalibrasi lewat */}
      <div className="mcu-live-chart-row mcu-live-chart-row--two">
        <div className="card mcu-dashboard-card">
          <div className="card-head"><div><h2>Kelengkapan per Site</h2><p>10 site terendah (%)</p></div></div>
          <div className="mcu-dashboard-chart">
            <MCUChart
              type="bar"
              labels={data.perSite.slice(0, 10).map((s) => s.site)}
              values={data.perSite.slice(0, 10).map((s) => s.persen)}
              colors={data.perSite.slice(0, 10).map((s) => s.persen >= 90 ? '#00B894' : s.persen >= 80 ? '#F1C40F' : s.persen >= 60 ? '#FF7A00' : '#FF2D2D')}
              horizontal
              legendLabel="Kelengkapan (%)"
            />
          </div>
        </div>

        <KartuChart judul="Kalibrasi Perlu Tindakan" sub="Bulan sejak kalibrasi terakhir" kosong={!data.alatKalibrasi.length} pesanKosong="Semua alat dalam masa kalibrasi">
          <MCUChart
            type="bar"
            labels={data.alatKalibrasi.map((a) => `${a.nama} · ${a.site}`)}
            values={data.alatKalibrasi.map((a) => a.bulan ?? kl.batasBulan)}
            colors={data.alatKalibrasi.map((a) => (a.bulan ?? 99) >= kl.batasBulan ? '#FF2D2D' : '#F1C40F')}
            horizontal
            legendLabel="Bulan"
          />
        </KartuChart>
      </div>
    </div>
  );
}

/**
 * Kartu chart dengan PENANGANAN KONDISI KOSONG.
 *
 * MASALAH YANG DISELESAIKAN
 * Sebelumnya diagram tanpa data tetap digambar sebagai grafik kosong dengan
 * sumbu 0/1/2 — itu tampak seperti bug, bukan informasi. Sekarang kartu
 * menampilkan pesan jelas dan tidak menggambar sumbu palsu.
 */
function KartuChart({ judul, sub, kosong, pesanKosong, children }: {
  judul: string;
  sub: string;
  kosong: boolean;
  pesanKosong: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card mcu-dashboard-card">
      <div className="card-head"><div><h2>{judul}</h2><p>{sub}</p></div></div>
      <div className="mcu-dashboard-chart">
        {kosong ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--muted-foreground)' }}>
            {pesanKosong}
          </div>
        ) : children}
      </div>
    </div>
  );
}
