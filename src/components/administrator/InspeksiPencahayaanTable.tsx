'use client';

// Administrator > Higiene Industri > Riwayat Pengukuran Pencahayaan
// Rekapitulasi hasil pengukuran pencahayaan (Lux) per ruangan.
// Ditampilkan di panel tabel melalui tombol panah navigasi.

import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, RefreshCw } from 'lucide-react';

import { authFetch } from '@/lib/api-client';
import { NAB_LUX, type PeruntukanRuang } from '@/lib/lingkungan-kerja';
import { Btn, SITES, fmtDate, tableStyle, thStyle, tdStyle } from './hc-ergo-ui';

interface RuangItem {
  id: string;
  namaRuang: string;
  peruntukan: PeruntukanRuang;
  luasM2: number | null;
  jumlahPekerja: number | null;
  tinggiRuanganM: number | null;
  pengukuranTerakhir: Record<string, unknown> | null;
  penilaian: {
    nabLux: number | null;
    luxMin: number | null;
    luxRata: number | null;
    luxMaks: number | null;
    statusLux: string;
  } | null;
}

export default function InspeksiPencahayaanTable() {
  const [site, setSite] = useState('');
  const [data, setData] = useState<RuangItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const q = site ? `?site=${encodeURIComponent(site)}` : '';
      const r = await authFetch(`/api/lingkungan${q}`);
      setData((r.data ?? []) as RuangItem[]);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [site]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totalRuang = data.length;
  const sudahDiukur = data.filter((d) => d.penilaian).length;
  const memenuhi = data.filter((d) => d.penilaian?.statusLux === 'memenuhi').length;
  const tidakMemenuhi = data.filter((d) => d.penilaian?.statusLux === 'tidak-memenuhi').length;

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', width: '94%', margin: '0 auto' }}>
      <div className="admin-form-inner">
        <div style={{ marginBottom: 8 }}>
          <h1 className="admin-form-title">Rekapitulasi Pengukuran Pencahayaan Ruangan</h1>
          <p className="admin-form-subtitle">
            Daftar inventaris ruang kerja dan status kepatuhan intensitas lux terhadap Nilai Ambang Batas (NAB).
          </p>
        </div>

        {/* Filter bar */}
        <div className="kunjungan-filter-bar" style={{ marginBottom: 12 }}>
          <select className="admin-filter-select" value={site} onChange={(e) => setSite(e.target.value)}>
            <option value="">Semua Job Site</option>
            {SITES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button type="button" onClick={() => void loadData()} disabled={loading} className="mcu-dashboard-refresh">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <div className="kunjungan-total-right" style={{ display: 'flex', gap: 14, fontSize: 11.5 }}>
            <span>Total Ruang: <b>{totalRuang}</b></span>
            <span>Telah Diukur: <b>{sudahDiukur}</b></span>
            <span>Memenuhi: <b style={{ color: '#00B894' }}>{memenuhi}</b></span>
            <span>Di Bawah NAB: <b style={{ color: tidakMemenuhi ? '#FF2D2D' : 'inherit' }}>{tidakMemenuhi}</b></span>
          </div>
        </div>

        {/* Card Table */}
        <div className="admin-form-card" style={{ overflow: 'auto' }}>
          {!data.length ? (
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', padding: '16px 8px', margin: 0 }}>
              <ClipboardCheck size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
              Belum ada data pengukuran pencahayaan yang tercatat.
            </p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  {['Nama Ruangan', 'Peruntukan Ruang', 'Luas / Pekerja', 'Lux Terendah', 'Standar NAB', 'Status Kepatuhan', 'Tanggal Terakhir'].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((r) => {
                  const p = r.penilaian;
                  const status = p?.statusLux;
                  const warna = status === 'memenuhi' ? '#00B894' : status === 'tidak-memenuhi' ? '#FF2D2D' : 'var(--muted-foreground)';

                  return (
                    <tr key={r.id}>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{r.namaRuang}</td>
                      <td style={tdStyle}>{NAB_LUX[r.peruntukan]?.label || r.peruntukan}</td>
                      <td style={tdStyle}>{r.luasM2 ? `${r.luasM2} m²` : '-'} / {r.jumlahPekerja ? `${r.jumlahPekerja} org` : '-'}</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{p?.luxMin != null ? `${p.luxMin} Lux` : '-'}</td>
                      <td style={tdStyle}>{p?.nabLux != null ? `${p.nabLux} Lux` : '-'}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: warna }}>
                        {status === 'memenuhi' ? '✓ Memenuhi' : status === 'tidak-memenuhi' ? '✗ Di Bawah NAB' : 'Belum Diukur'}
                      </td>
                      <td style={tdStyle}>
                        {r.pengukuranTerakhir?.tanggal ? fmtDate(String(r.pengukuranTerakhir.tanggal)) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
