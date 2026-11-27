'use client';

// Administrator > Higiene Industri > Riwayat Inspeksi Sanitasi
// Rekapitulasi hasil penilaian higiene & sanitasi per job site.
// Ditampilkan di panel tabel melalui tombol panah navigasi.

import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, RefreshCw } from 'lucide-react';

import { authFetch } from '@/lib/api-client';
import { Btn, SITES, fmtDate, tableStyle, thStyle, tdStyle } from './hc-ergo-ui';

interface Riwayat {
  id: string;
  site: string;
  tanggal: string;
  inspektur: string | null;
  ringkasan: {
    total: number;
    sesuai: number;
    tidakSesuai: number;
    belumDinilai: number;
    persenSesuai: number;
  } | null;
  catatan: string | null;
  created_at: string;
}

export default function InspeksiSanitasiTable() {
  const [site, setSite] = useState('');
  const [rows, setRows] = useState<Riwayat[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = site ? `?site=${encodeURIComponent(site)}` : '';
      const r = await authFetch(`/api/sanitasi${q}`);
      setRows((r.data ?? []) as Riwayat[]);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [site]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalSesi = rows.length;
  const sesiPatuh = rows.filter((r) => (r.ringkasan?.persenSesuai ?? 0) >= 85).length;
  const avgKepatuhan = totalSesi
    ? Math.round(rows.reduce((acc, r) => acc + (r.ringkasan?.persenSesuai ?? 0), 0) / totalSesi)
    : 0;

  return (
    <div className="admin-scroll-body" style={{ flex: 1, minHeight: 0, overflow: 'auto', width: '94%', margin: '0 auto' }}>
      <div className="admin-form-inner">
        <div style={{ marginBottom: 8 }}>
          <h1 className="admin-form-title">Rekapitulasi Riwayat Inspeksi Sanitasi</h1>
          <p className="admin-form-subtitle">
            Catatan kepatuhan fasilitas sanitasi (toilet, air minum, vektor, dan pengelolaan sampah) seluruh job site.
          </p>
        </div>

        {/* Filter bar */}
        <div className="kunjungan-filter-bar" style={{ marginBottom: 12 }}>
          <select className="admin-filter-select" value={site} onChange={(e) => setSite(e.target.value)}>
            <option value="">Semua Job Site</option>
            {SITES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button type="button" onClick={() => void load()} disabled={loading} className="mcu-dashboard-refresh">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <div className="kunjungan-total-right" style={{ display: 'flex', gap: 14, fontSize: 11.5 }}>
            <span>Total: <b>{totalSesi} sesi</b></span>
            <span>Rata-rata Kepatuhan: <b style={{ color: avgKepatuhan >= 85 ? '#00B894' : '#FF7A00' }}>{avgKepatuhan}%</b></span>
            <span>Memenuhi Standar (≥85%): <b style={{ color: '#00B894' }}>{sesiPatuh}</b></span>
          </div>
        </div>

        {/* Card Table */}
        <div className="admin-form-card" style={{ overflow: 'auto' }}>
          {!rows.length ? (
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', padding: '16px 8px', margin: 0 }}>
              <ClipboardCheck size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
              Belum ada riwayat inspeksi sanitasi yang tercatat.
            </p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  {['Tanggal', 'Job Site', 'Inspektur', 'Tingkat Kepatuhan', 'Sesuai', 'Tidak Sesuai', 'Belum Dinilai'].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const k = r.ringkasan;
                  const warna = !k ? 'inherit' : k.persenSesuai >= 85 ? '#00B894' : k.persenSesuai >= 70 ? '#FF7A00' : '#FF2D2D';

                  return (
                    <tr key={r.id}>
                      <td style={tdStyle}>{fmtDate(r.tanggal)}</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{r.site}</td>
                      <td style={tdStyle}>{r.inspektur ?? '-'}</td>
                      <td style={{ ...tdStyle, fontWeight: 800, color: warna }}>{k ? `${k.persenSesuai.toFixed(1)}%` : '-'}</td>
                      <td style={{ ...tdStyle, color: '#00B894' }}>{k?.sesuai ?? '-'}</td>
                      <td style={{ ...tdStyle, color: k?.tidakSesuai ? '#FF2D2D' : 'inherit' }}>{k?.tidakSesuai ?? '-'}</td>
                      <td style={{ ...tdStyle, color: 'var(--muted-foreground)' }}>{k?.belumDinilai ?? '-'}</td>
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
