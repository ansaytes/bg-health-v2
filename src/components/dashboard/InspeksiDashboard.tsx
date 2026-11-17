'use client';

// ============================================================
// Dashboard > Program Inspeksi
// ============================================================
//
// Lima kelompok metrik, mengikuti template dashboard Monitoring MCU:
//   • top bar dengan filter site/periode + tombol refresh
//   • kartu `.mcu-dashboard-card` berisi `MCUChart` (doughnut / bar)
//   • kartu dengan penanganan kondisi kosong (tidak menggambar sumbu palsu)
//
// 1. Eksekusi      — completion rate (Hijau ≥95, Kuning 85–94, Merah <85),
//                    on-time vs late, inspeksi terlewat (H+1)
// 2. Cakupan aset  — % aset terdaftar tersampling, blindspot 30–90 hari
// 3. Kelaikan      — ambulans, P3K, sanitasi, ergonomi, kalibrasi H-60
// 4. PICA          — MTTR, overdue, per departemen, top 5 berulang
// 5. Produktivitas — beban per petugas, reporting lead time

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { authFetch } from '@/lib/api-client';
import { MCUChart } from '@/components/dashboard/MCUDashboardShared';
import PageLoading from '@/components/ui/page-loading';
import { PALET_BAR } from '@/lib/chart-standard';
import { periodeBulan, labelPeriode } from '@/lib/inspeksi-program';

interface Data {
  success: boolean;
  periode: string;
  site: string | null;
  tabelSiap: Record<string, boolean>;
  catatan: string | null;
  eksekusi: {
    target: number; selesai: number; terlewat: number; belum: number;
    persenSelesai: number; warnaSelesai: 'hijau' | 'kuning' | 'merah';
    tepatWaktu: number; terlambat: number; persenTepatWaktu: number;
    terlewatPerJenis: { jenis: string; label: string; jumlah: number }[];
    tren: { periode: string; target: number; selesai: number; persen: number }[];
    daftarTerlewat: { id: number; label: string; site: string | null; objek: string | null; tanggal_rencana: string | null; hariTerlambat: number }[];
  };
  cakupan: {
    terdaftar: number; tersampling: number; persen: number; ambangHari: number;
    blindspot: { site: string; label: string; hariTerakhir: number | null; terakhir: string | null; jumlahObjek: number }[];
  };
  kelaikan: {
    ambulans: { totalUnit: number; ready: number; standby: number; breakdown: number; itemTotal: number; itemAda: number; itemRusak: number };
    p3k: { total: number; ada: number; rusak: number; tidakAda: number; persenSiap: number; kedaluwarsa: { nama: string; site: string; tanggal: string; sisaHari: number | null }[]; hilang: { nama: string; site: string; lokasi: string }[] };
    sanitasi: { jumlahArea: number; diBawahStandar: number; rataRata: number | null; ambang: number; area: { site: string; tanggal: string; skor: number }[] };
    ergonomi: { total: number; layak: number; rusak: number; persenLayak: number; perItem: { nama: string; rusak: number; layak: number }[] };
    kalibrasi: { total: number; patuh: number; kuning: number; merah: number; belum: number; peringatanHari: number; jatuhTempo: { nama: string; site: string; tanggal: string | null; sisaHari: number | null; status: string }[] };
  };
  pica: {
    total: number; aktif: number; closed: number; overdue: number; mttr: number | null;
    perDepartemen: { departemen: string; aktif: number; overdue: number; closed: number }[];
    terulang: { objek: string; jumlah: number; picaIds: string[] }[];
  };
  produktivitas: {
    perPetugas: { petugas: string; selesai: number; tepat: number; terlambat: number; terlewat: number }[];
    leadTime: { jumlah: number; rataHari: number | null };
  };
}

const WARNA = { hijau: '#00B894', kuning: '#F1C40F', merah: '#FF2D2D' };
const WARNA_SELESAI: Record<string, string> = WARNA;

export default function InspeksiDashboard() {
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
      const hasil = await authFetch(`/api/inspeksi/dashboard?${qs.toString()}`) as unknown as Data;
      setData(hasil);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat dashboard inspeksi');
    } finally {
      setLoading(false);
    }
  }, [site, periode]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !data) return <PageLoading label="Memuat dashboard inspeksi" />;

  if (!data) {
    return (
      <div className="dashboard mcu-live-dashboard" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 12 }}>
          {error || 'Data inspeksi tidak tersedia.'}
        </div>
      </div>
    );
  }

  const e = data.eksekusi;
  const c = data.cakupan;
  const k = data.kelaikan;
  const p = data.pica;
  const pr = data.produktivitas;
  const warnaE = WARNA_SELESAI[e.warnaSelesai];

  return (
    <div className="dashboard mcu-live-dashboard" style={{ overflow: 'hidden', gap: 8 }}>
      {/* Top bar — filter & indikator utama */}
      <div className="mcu-live-top-bar" style={{ flexShrink: 0 }}>
        <div className="mcu-dashboard-filters">
          <label>
            <span>Periode</span>
            <input
              type="month"
              value={periode}
              onChange={ev => setPeriode(ev.target.value || periodeBulan())}
              style={{ height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--background)', fontSize: 10, fontWeight: 700, padding: '0 6px' }}
            />
          </label>
          <label>
            <span>Site</span>
            <input
              value={site}
              onChange={ev => setSite(ev.target.value)}
              placeholder="Semua site"
              style={{ height: 28, width: 120, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--background)', fontSize: 10, fontWeight: 700, padding: '0 6px' }}
            />
          </label>
          <label>
            <span>Penyelesaian</span>
            <b style={{ fontSize: 11, color: warnaE }}>{e.persenSelesai}%</b>
          </label>
          <label>
            <span>PICA overdue</span>
            <b style={{ fontSize: 11, color: p.overdue ? WARNA.merah : 'inherit' }}>{p.overdue}</b>
          </label>
          <label>
            <span>Inspeksi terlewat</span>
            <b style={{ fontSize: 11, color: e.terlewat ? WARNA.merah : 'inherit' }}>{e.terlewat}</b>
          </label>
          <button type="button" onClick={() => void load()} disabled={loading} className="mcu-dashboard-refresh">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
        {error && <span style={{ fontSize: 10, color: '#b3261e' }}>{error}</span>}
      </div>

      {data.catatan && (
        <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,196,0,0.10)', border: '1px solid rgba(255,196,0,0.4)', color: '#9a6b00', fontSize: 11 }}>
          {data.catatan}
        </div>
      )}

      {/* ── 1. EKSEKUSI ─────────────────────────────────────────────────── */}
      <div className="mcu-live-chart-row">
        <div className="card mcu-dashboard-card">
          <div className="card-head"><div><h2>Penyelesaian Inspeksi</h2><p>{labelPeriode(data.periode)} · Hijau ≥95% · Kuning 85–94% · Merah &lt;85%</p></div></div>
          <div className="mcu-dashboard-chart">
            <KartuAngka
              utama={`${e.persenSelesai}%`}
              warna={warnaE}
              bawah={[
                { label: 'Target', nilai: e.target },
                { label: 'Selesai', nilai: e.selesai },
                { label: 'Belum', nilai: e.belum },
                { label: 'Terlewat', nilai: e.terlewat, warna: e.terlewat ? WARNA.merah : undefined },
              ]}
            />
          </div>
        </div>

        <div className="card mcu-dashboard-card">
          <div className="card-head"><div><h2>Ketepatan Waktu</h2><p>Tepat jadwal vs molor</p></div></div>
          <div className="mcu-dashboard-chart">
            <MCUChart
              type="doughnut"
              labels={['Tepat waktu', 'Terlambat']}
              values={[e.tepatWaktu, e.terlambat]}
              colors={[WARNA.hijau, WARNA.merah]}
              legendLabel="Inspeksi"
              centerText={`${e.persenTepatWaktu}%`}
              percentLabels
            />
          </div>
        </div>

        <KartuChart judul="Inspeksi Terlewat" sub="Lewat tanggal rencana (H+1), per jenis" kosong={!e.terlewatPerJenis.length} pesanKosong="Tidak ada inspeksi terlewat">
          <MCUChart
            type="bar"
            labels={e.terlewatPerJenis.map(x => x.label)}
            values={e.terlewatPerJenis.map(x => x.jumlah)}
            colors={e.terlewatPerJenis.map(() => WARNA.merah)}
            horizontal
            legendLabel="Terlewat"
          />
        </KartuChart>
      </div>

      {/* ── 2. CAKUPAN ASET ─────────────────────────────────────────────── */}
      <div className="mcu-live-chart-row mcu-live-chart-row--two">
        <div className="card mcu-dashboard-card">
          <div className="card-head"><div><h2>Cakupan Pengawasan Aset</h2><p>Aset terdaftar yang tersampling periode ini</p></div></div>
          <div className="mcu-dashboard-chart">
            <MCUChart
              type="doughnut"
              labels={['Tersampling', 'Belum tersampling']}
              values={[c.tersampling, Math.max(0, c.terdaftar - c.tersampling)]}
              colors={[WARNA.hijau, '#B0B7C3']}
              legendLabel="Aset"
              centerText={`${c.persen}%`}
              percentLabels
            />
          </div>
        </div>

        <KartuChart
          judul="Blindspot Area"
          sub={`Lokasi dengan keterpaparan inspeksi > ${c.ambangHari} hari`}
          kosong={!c.blindspot.length}
          pesanKosong="Semua area terpantau dalam 30 hari terakhir"
        >
          <MCUChart
            type="bar"
            labels={c.blindspot.map(b => `${b.site} · ${b.label}`)}
            values={c.blindspot.map(b => b.hariTerakhir ?? 365)}
            colors={c.blindspot.map(b => (b.hariTerakhir === null ? WARNA.merah : b.hariTerakhir > 90 ? WARNA.merah : '#FF7A00'))}
            horizontal
            legendLabel="Hari sejak inspeksi"
          />
        </KartuChart>
      </div>

      {/* ── 3. KELAIKAN FISIK ───────────────────────────────────────────── */}
      <div className="mcu-live-chart-row">
        <KartuChart
          judul="Kesiapan Ambulans"
          sub="Ready · Standby with Note · Breakdown"
          kosong={k.ambulans.totalUnit === 0}
          pesanKosong="Belum ada unit ambulans tercatat"
        >
          <MCUChart
            type="doughnut"
            labels={['Ready', 'Standby with Note', 'Breakdown']}
            values={[k.ambulans.ready, k.ambulans.standby, k.ambulans.breakdown]}
            colors={[WARNA.hijau, WARNA.kuning, WARNA.merah]}
            legendLabel="Unit"
            centerText={String(k.ambulans.totalUnit)}
            percentLabels
          />
        </KartuChart>

        <div className="card mcu-dashboard-card">
          <div className="card-head"><div><h2>Kotak P3K Siap Pakai</h2><p>Standar Permenaker 15/2008</p></div></div>
          <div className="mcu-dashboard-chart">
            <KartuAngka
              utama={`${k.p3k.persenSiap}%`}
              warna={k.p3k.persenSiap >= 90 ? WARNA.hijau : k.p3k.persenSiap >= 70 ? WARNA.kuning : WARNA.merah}
              bawah={[
                { label: 'Item tercatat', nilai: k.p3k.total },
                { label: 'Siap', nilai: k.p3k.ada },
                { label: 'Rusak', nilai: k.p3k.rusak, warna: k.p3k.rusak ? WARNA.merah : undefined },
                { label: 'Tidak ada', nilai: k.p3k.tidakAda, warna: k.p3k.tidakAda ? WARNA.merah : undefined },
              ]}
            />
          </div>
        </div>

        <KartuChart
          judul="Sanitasi Area"
          sub={`Skor 0–100 · merah bila < ${k.sanitasi.ambang}%`}
          kosong={!k.sanitasi.area.length}
          pesanKosong="Belum ada inspeksi sanitasi"
        >
          <MCUChart
            type="bar"
            labels={k.sanitasi.area.map(a => a.site)}
            values={k.sanitasi.area.map(a => a.skor)}
            colors={k.sanitasi.area.map(a => (a.skor < k.sanitasi.ambang ? WARNA.merah : a.skor >= 90 ? WARNA.hijau : WARNA.kuning))}
            horizontal
            legendLabel="Skor"
          />
        </KartuChart>
      </div>

      <div className="mcu-live-chart-row">
        <KartuChart
          judul="Sarana Ergonomi"
          sub="Layak vs rusak"
          kosong={k.ergonomi.total === 0}
          pesanKosong="Belum ada data sarana ergonomi"
        >
          <MCUChart
            type="doughnut"
            labels={['Layak', 'Rusak']}
            values={[k.ergonomi.layak, k.ergonomi.rusak]}
            colors={[WARNA.hijau, WARNA.merah]}
            legendLabel="Unit"
            centerText={`${k.ergonomi.persenLayak}%`}
            percentLabels
          />
        </KartuChart>

        <KartuChart
          judul="Kalibrasi Jatuh Tempo"
          sub={`Kuning H-${k.kalibrasi.peringatanHari} · Merah overdue`}
          kosong={!k.kalibrasi.jatuhTempo.length}
          pesanKosong="Semua alat dalam masa kalibrasi"
        >
          <MCUChart
            type="bar"
            labels={k.kalibrasi.jatuhTempo.map(a => `${a.nama} · ${a.site}`)}
            values={k.kalibrasi.jatuhTempo.map(a => Math.abs(a.sisaHari ?? 0))}
            colors={k.kalibrasi.jatuhTempo.map(a => (a.status === 'merah' ? WARNA.merah : WARNA.kuning))}
            horizontal
            legendLabel="Hari"
          />
        </KartuChart>

        <div className="card mcu-dashboard-card">
          <div className="card-head"><div><h2>Status Kalibrasi</h2><p>Patuh · kuning · lewat · belum pernah</p></div></div>
          <div className="mcu-dashboard-chart">
            <MCUChart
              type="doughnut"
              labels={['Patuh', 'Mendekati', 'Lewat', 'Belum pernah']}
              values={[k.kalibrasi.patuh, k.kalibrasi.kuning, k.kalibrasi.merah, k.kalibrasi.belum]}
              colors={[WARNA.hijau, WARNA.kuning, WARNA.merah, '#778899']}
              legendLabel="Alat"
              centerText={String(k.kalibrasi.total)}
              percentLabels
            />
          </div>
        </div>
      </div>

      {/* ── 4. PICA ─────────────────────────────────────────────────────── */}
      <div className="mcu-live-chart-row">
        <div className="card mcu-dashboard-card">
          <div className="card-head"><div><h2>Kinerja Penanganan PICA</h2><p>MTTR · overdue · status</p></div></div>
          <div className="mcu-dashboard-chart">
            <KartuAngka
              utama={p.mttr === null ? '—' : `${p.mttr} hari`}
              label="Rata-rata penutupan (MTTR)"
              warna={p.overdue ? WARNA.merah : WARNA.hijau}
              bawah={[
                { label: 'Aktif', nilai: p.aktif },
                { label: 'Overdue', nilai: p.overdue, warna: p.overdue ? WARNA.merah : undefined },
                { label: 'Closed', nilai: p.closed, warna: WARNA.hijau },
                { label: 'Total', nilai: p.total },
              ]}
            />
          </div>
        </div>

        <KartuChart
          judul="PICA per Departemen"
          sub="Aktif dan lewat tenggat"
          kosong={!p.perDepartemen.length}
          pesanKosong="Belum ada PICA"
        >
          <MCUChart
            type="bar"
            labels={p.perDepartemen.slice(0, 8).map(d => d.departemen)}
            values={p.perDepartemen.slice(0, 8).map(d => d.aktif)}
            colors={p.perDepartemen.slice(0, 8).map(d => (d.overdue ? WARNA.merah : '#FF7A00'))}
            horizontal
            legendLabel="PICA aktif"
          />
        </KartuChart>

        <KartuChart
          judul="Top 5 Temuan Berulang"
          sub="Objek yang PICA-nya berulang"
          kosong={!p.terulang.length}
          pesanKosong="Belum ada temuan berulang"
        >
          <MCUChart
            type="bar"
            labels={p.terulang.map(t => t.objek)}
            values={p.terulang.map(t => t.jumlah)}
            colors={p.terulang.map((_, i) => PALET_BAR[i % PALET_BAR.length])}
            horizontal
            legendLabel="Jumlah PICA"
          />
        </KartuChart>
      </div>

      {/* ── 5. PRODUKTIVITAS PETUGAS ────────────────────────────────────── */}
      <div className="mcu-live-chart-row mcu-live-chart-row--two">
        <KartuChart
          judul="Beban Inspeksi per Petugas"
          sub="Inspeksi selesai pada periode ini"
          kosong={!pr.perPetugas.length}
          pesanKosong="Belum ada petugas yang mencatat inspeksi"
        >
          <MCUChart
            type="bar"
            labels={pr.perPetugas.slice(0, 10).map(x => x.petugas)}
            values={pr.perPetugas.slice(0, 10).map(x => x.selesai)}
            colors={pr.perPetugas.slice(0, 10).map(() => '#3498DB')}
            horizontal
            legendLabel="Selesai"
          />
        </KartuChart>

        <div className="card mcu-dashboard-card">
          <div className="card-head"><div><h2>Reporting Lead Time</h2><p>Pemeriksaan selesai → laporan diterbitkan</p></div></div>
          <div className="mcu-dashboard-chart">
            <KartuAngka
              utama={pr.leadTime.rataHari === null ? '—' : `${pr.leadTime.rataHari} hari`}
              label="Rata-rata"
              warna={pr.leadTime.rataHari !== null && pr.leadTime.rataHari <= 1 ? WARNA.hijau : WARNA.kuning}
              bawah={[{ label: 'Laporan terukur', nilai: pr.leadTime.jumlah }]}
            />
          </div>
        </div>
      </div>

      {/* Rincian inspeksi terlewat — daftar, bukan grafik */}
      {e.daftarTerlewat.length > 0 && (
        <div className="card mcu-dashboard-card" style={{ flexShrink: 0 }}>
          <div className="card-head"><div><h2>Rincian Inspeksi Terlewat</h2><p>Paling lama terlambat di atas</p></div></div>
          <div style={{ maxHeight: 190, overflowY: 'auto', padding: '0 10px 8px' }}>
            <table style={{ width: '100%', fontSize: 10.5, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--muted-foreground)', textAlign: 'left' }}>
                  <th style={{ padding: '3px 4px' }}>Jenis</th>
                  <th style={{ padding: '3px 4px' }}>Site</th>
                  <th style={{ padding: '3px 4px' }}>Objek</th>
                  <th style={{ padding: '3px 4px' }}>Rencana</th>
                  <th style={{ padding: '3px 4px' }}>Terlambat</th>
                </tr>
              </thead>
              <tbody>
                {e.daftarTerlewat.slice(0, 40).map((d, i) => (
                  <tr key={`${d.id}-${i}`} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '3px 4px' }}>{d.label}</td>
                    <td style={{ padding: '3px 4px' }}>{d.site ?? '—'}</td>
                    <td style={{ padding: '3px 4px' }}>{d.objek ?? '—'}</td>
                    <td style={{ padding: '3px 4px' }}>{d.tanggal_rencana ?? '—'}</td>
                    <td style={{ padding: '3px 4px', color: WARNA.merah, fontWeight: 700 }}>{d.hariTerlambat} hari</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Kartu angka besar — untuk metrik yang lebih jelas dibaca sebagai satu angka
 * (persentase penyelesaian, MTTR, lead time) daripada sebagai diagram.
 */
function KartuAngka({
  utama,
  label,
  warna,
  bawah,
}: {
  utama: string;
  label?: string;
  warna: string;
  bawah: { label: string; nilai: number | string; warna?: string }[];
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <div style={{ fontSize: 40, fontWeight: 800, color: warna, lineHeight: 1 }}>{utama}</div>
      {label && <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{label}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', justifyContent: 'center', marginTop: 4 }}>
        {bawah.map(b => (
          <span key={b.label} style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
            {b.label}{' '}
            <b style={{ color: b.warna ?? 'var(--foreground)' }}>{b.nilai}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Kartu chart dengan penanganan kondisi kosong (pola sama dengan SPIP). */
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
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--muted-foreground)', textAlign: 'center', padding: 8 }}>
            {pesanKosong}
          </div>
        ) : children}
      </div>
    </div>
  );
}
