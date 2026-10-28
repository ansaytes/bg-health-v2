'use client';

// ============================================================
// Dashboard > Laporan Mingguan
// ============================================================
//
// DASAR: BG/QSHE/SOP/028 poin 5.4.3 — "Laporan pelaksanaan pelayanan kesehatan
// kerja disampaikan kepada Manager QSHE setiap 1 (satu) minggu."
//
// ATURAN OPERASIONAL (PT BDM)
//   • Hari kerja Senin–Sabtu, laporan dibuat Sabtu, Minggu libur (HO).
//   • Nomor minggu: minggu kerja yang MEMUAT 1 Januari = Week 1.
//     Konsekuensinya Week 1 bisa dimulai di Desember tahun sebelumnya —
//     karena itu rentang tanggalnya selalu ditampilkan, bukan hanya nomornya.
//   • Pekan berjalan ditandai jelas: datanya belum lengkap sampai Sabtu.
//
// Semua angka AGREGAT. Tidak ada nama/NIK pasien di halaman ini.

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CalendarRange, Loader2, Printer, RefreshCw } from 'lucide-react';

import { authFetch } from '@/lib/api-client';

interface Rekap {
  periode: {
    tahun: number; minggu: number; label: string; mulai: string; selesai: string;
    berjalan: boolean; catatan: string;
  };
  daftarMinggu: { minggu: number; label: string; berjalan: boolean }[];
  site: string | null;
  kunjungan: {
    total: number; pasienUnik: number; rujukanRs: number;
    perHari: { hari: string; tanggal: string; jumlah: number }[];
    perDepartemen: [string, number][];
    topDiagnosa: [string, number][];
  };
  prokawan: { dijadwalkan: number; diperiksa: number; belumDiperiksa: number; memburuk: number; membaik: number };
  inventory: { totalItem: number; stokKritis: number; mendekatiEd: number };
  pak: { kasusBaru: number; lewatBatasWaktu: number };
}

export default function LaporanMingguan() {
  const [data, setData] = useState<Rekap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tahun, setTahun] = useState<number | null>(null);
  const [minggu, setMinggu] = useState<number | null>(null);

  const load = useCallback(async (th?: number | null, mg?: number | null) => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (th) qs.set('tahun', String(th));
      if (mg) qs.set('minggu', String(mg));
      const r = await authFetch(`/api/laporan/mingguan?${qs.toString()}`);
      setData(r as Rekap);
      setTahun((r as Rekap).periode.tahun);
      setMinggu((r as Rekap).periode.minggu);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat laporan mingguan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading && !data) {
    return (
      <div className="dashboard" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted-foreground)', fontSize: 12 }}>
          <Loader2 size={16} className="animate-spin" /> Menyusun laporan mingguan…
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="dashboard" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 12 }}>
          {error || 'Laporan tidak tersedia.'}
        </div>
      </div>
    );
  }

  const { periode, kunjungan, prokawan, inventory, pak } = data;
  const maksHari = Math.max(...kunjungan.perHari.map((h) => h.jumlah), 1);

  return (
    <div className="dashboard" style={{ overflow: 'hidden', gap: 8 }}>
      {/* Toolbar periode */}
      <div className="kunjungan-top-bar" style={{ flexShrink: 0 }}>
        <div className="kunjungan-filter-bar">
          <CalendarRange size={14} color="var(--muted-foreground)" />
          <select
            className="admin-filter-select"
            value={tahun ?? periode.tahun}
            onChange={(e) => { const t = Number(e.target.value); setTahun(t); setMinggu(1); void load(t, 1); }}
          >
            {[...new Set([periode.tahun - 1, periode.tahun, periode.tahun + 1])].sort().map((t) => (
              <option key={t} value={t}>Tahun {t}</option>
            ))}
          </select>
          <select
            className="admin-filter-select"
            value={minggu ?? periode.minggu}
            onChange={(e) => { const m = Number(e.target.value); setMinggu(m); void load(tahun ?? periode.tahun, m); }}
            style={{ minWidth: 240 }}
          >
            {data.daftarMinggu.map((w) => (
              <option key={w.minggu} value={w.minggu}>
                {w.label}{w.berjalan ? ' — berjalan' : ''}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void load(tahun, minggu)} disabled={loading} className="mcu-dashboard-refresh">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button type="button" onClick={() => window.print()} className="mcu-dashboard-refresh">
            <Printer size={13} /> Cetak
          </button>
        </div>
        <div className="kunjungan-total-right">
          <b style={{ fontSize: 11, color: 'var(--foreground)' }}>{periode.label}</b>
          {periode.berjalan && (
            <span style={{ color: '#C99A00', fontWeight: 700 }}>• pekan berjalan</span>
          )}
        </div>
      </div>

      {periode.berjalan && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(255,196,0,0.10)', border: '1px solid rgba(255,196,0,0.4)', color: '#9a6b00', fontSize: 10.5 }}>
          <AlertTriangle size={12} /> {periode.catatan}
        </div>
      )}

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8, flexShrink: 0 }}>
        <Kpi label="Kunjungan" nilai={kunjungan.total} ket={`${kunjungan.pasienUnik} pasien unik`} warna="#ff4d00" />
        <Kpi label="Rujuk RS" nilai={kunjungan.rujukanRs} ket="diteruskan ke faskes" warna={kunjungan.rujukanRs ? '#FF7A00' : '#00B894'} />
        <Kpi label="ProKawan Dijadwalkan" nilai={prokawan.dijadwalkan} ket={`${prokawan.diperiksa} sudah diperiksa`} warna="#3498DB" />
        <Kpi label="Belum Diperiksa" nilai={prokawan.belumDiperiksa} ket="jadwal pekan ini" warna={prokawan.belumDiperiksa ? '#FF2D2D' : '#00B894'} />
        <Kpi label="Stok Kritis" nilai={inventory.stokKritis} ket={`${inventory.mendekatiEd} mendekati ED`} warna={inventory.stokKritis ? '#FF7A00' : '#00B894'} />
        <Kpi label="PAK Baru" nilai={pak.kasusBaru} ket={pak.lewatBatasWaktu ? `${pak.lewatBatasWaktu} lewat batas` : 'tidak ada lewat batas'} warna={pak.lewatBatasWaktu ? '#FF2D2D' : '#778899'} />
      </div>

      {/* Baris 2: kunjungan per hari + ProKawan */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 8, flex: 1, minHeight: 0 }}>
        <div className="card" style={{ padding: '8px 10px', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="card-head" style={{ flexShrink: 0, marginBottom: 4 }}>
            <span style={{ width: 3, height: 18, borderRadius: 2, background: '#ff4d00', flexShrink: 0 }} />
            <div>
              <h2 style={{ fontSize: 11.5 }}>Kunjungan per Hari Kerja</h2>
              <p style={{ fontSize: 9 }}>Senin–Sabtu; Minggu libur (Head Office)</p>
            </div>
          </div>
          <div style={{ flexShrink: 0, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)', paddingBottom: 2, marginBottom: 6 }}>
            → Jumlah kunjungan
          </div>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'flex-end', gap: 8, padding: '0 4px' }}>
            {kunjungan.perHari.map((h) => (
              <div key={h.hari} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: h.jumlah ? '#ff4d00' : 'var(--muted-foreground)', marginBottom: 2 }}>
                  {h.jumlah}
                </span>
                <div
                  title={`${h.hari}, ${h.tanggal}: ${h.jumlah} kunjungan`}
                  style={{
                    width: '100%', maxWidth: 52,
                    height: `${Math.max((h.jumlah / maksHari) * 100, h.jumlah ? 6 : 2)}%`,
                    borderRadius: '4px 4px 0 0',
                    background: h.jumlah ? 'linear-gradient(180deg,#ff8c42,#ff4d00)' : 'var(--muted)',
                  }}
                />
                <span style={{ fontSize: 8.5, color: 'var(--muted-foreground)', marginTop: 3 }}>{h.hari.slice(0, 3)}</span>
              </div>
            ))}
          </div>
          <div style={{ flexShrink: 0, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)', borderTop: '1px solid var(--border)', paddingTop: 2, marginTop: 4 }}>
            ↑ Hari kerja
          </div>
        </div>

        <div className="card" style={{ padding: '8px 10px', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="card-head" style={{ flexShrink: 0, marginBottom: 4 }}>
            <span style={{ width: 3, height: 18, borderRadius: 2, background: '#3498DB', flexShrink: 0 }} />
            <div>
              <h2 style={{ fontSize: 11.5 }}>ProKawan Pekan Ini</h2>
              <p style={{ fontSize: 9 }}>Jadwal vs realisasi kontrol peserta</p>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
            <Baris label="Dijadwalkan" nilai={prokawan.dijadwalkan} maks={Math.max(prokawan.dijadwalkan, 1)} warna="#3498DB" />
            <Baris label="Sudah diperiksa" nilai={prokawan.diperiksa} maks={Math.max(prokawan.dijadwalkan, 1)} warna="#00B894" />
            <Baris label="Belum diperiksa" nilai={prokawan.belumDiperiksa} maks={Math.max(prokawan.dijadwalkan, 1)} warna="#FF2D2D" />
            <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 9.5 }}>
              <span style={{ color: '#00B894' }}>Membaik: <b>{prokawan.membaik}</b></span>
              <span style={{ color: '#FF2D2D' }}>Memburuk: <b>{prokawan.memburuk}</b></span>
            </div>
          </div>
        </div>
      </div>

      {/* Baris 3: top diagnosa + per departemen */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 0.85, minHeight: 0 }}>
        <PanelDaftar
          judul="Diagnosa Terbanyak"
          keterangan="Pekan ini"
          labelNilai="Jumlah kunjungan"
          labelKategori="Diagnosa"
          data={kunjungan.topDiagnosa}
        />
        <PanelDaftar
          judul="Kunjungan per Departemen"
          keterangan="Pekan ini"
          labelNilai="Jumlah kunjungan"
          labelKategori="Departemen"
          data={kunjungan.perDepartemen}
        />
      </div>
    </div>
  );
}

function Kpi({ label, nilai, ket, warna }: { label: string; nilai: number; ket: string; warna: string }) {
  return (
    <div className="card" style={{ padding: '7px 10px', minWidth: 0, justifyContent: 'center' }}>
      <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: warna, lineHeight: 1.15 }}>{nilai}</div>
      <div style={{ fontSize: 8.5, color: 'var(--muted-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ket}>
        {ket}
      </div>
    </div>
  );
}

function Baris({ label, nilai, maks, warna }: { label: string; nilai: number; maks: number; warna: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, marginBottom: 2 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ fontWeight: 800, color: warna }}>{nilai}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--muted)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min((nilai / maks) * 92, 100)}%`, height: '100%', borderRadius: 3, background: warna }} />
      </div>
    </div>
  );
}

function PanelDaftar({ judul, keterangan, data, labelNilai, labelKategori }: {
  judul: string;
  keterangan: string;
  data: [string, number][];
  labelNilai: string;
  labelKategori: string;
}) {
  const maks = Math.max(...data.map(([, v]) => v), 1);
  const PALET = ['#3498DB', '#2ECC71', '#F1C40F', '#E67E22', '#9B59B6', '#1ABC9C', '#E74C3C', '#95A5A6'];
  return (
    <div className="card" style={{ padding: '8px 10px', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="card-head" style={{ flexShrink: 0, marginBottom: 4 }}>
        <span style={{ width: 3, height: 18, borderRadius: 2, background: '#8E44AD', flexShrink: 0 }} />
        <div>
          <h2 style={{ fontSize: 11.5 }}>{judul}</h2>
          <p style={{ fontSize: 9 }}>{keterangan}</p>
        </div>
      </div>
      <div style={{ flexShrink: 0, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)', paddingBottom: 2, marginBottom: 4 }}>
        → {labelNilai}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'space-evenly' }}>
        {!data.length && <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: 0 }}>Belum ada data pekan ini.</p>}
        {data.map(([label, nilai], i) => (
          <div key={label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 9.5, lineHeight: 1.15, marginBottom: 1 }}>
              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={label}>{label}</span>
              <span style={{ fontWeight: 800, flexShrink: 0 }}>{nilai}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--muted)', overflow: 'hidden' }}>
              <div style={{ width: `${(nilai / maks) * 92}%`, height: '100%', borderRadius: 2, background: PALET[i % PALET.length] }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ flexShrink: 0, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)', borderTop: '1px solid var(--border)', paddingTop: 2, marginTop: 2 }}>
        ↑ {labelKategori}
      </div>
    </div>
  );
}
