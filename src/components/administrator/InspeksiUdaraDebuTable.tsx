'use client';

// Administrator > Higiene Industri > Riwayat Kualitas Udara & Debu
// Rekapitulasi hasil pemantauan kualitas udara dan debu industri per ruangan.
// Ditampilkan di panel tabel melalui tombol panah navigasi.

import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, RefreshCw } from 'lucide-react';

import { authFetch } from '@/lib/api-client';
import { type PeruntukanRuang } from '@/lib/lingkungan-kerja';
import { Btn, SITES, fmtDate, tableStyle, thStyle, tdStyle } from './hc-ergo-ui';

interface RuangItem {
  id: string;
  namaRuang: string;
  peruntukan: PeruntukanRuang;
  luasM2: number | null;
  jumlahPekerja: number | null;
  tinggiRuanganM: number | null;
  ventilasiBuatan: boolean;
  tanggalBersihVentilasi: string | null;
  pengukuranTerakhir: Record<string, unknown> | null;
  penilaian: {
    statusUdara: {
      parameter: string;
      label: string;
      nilai: number | null;
      min: number | null;
      max: number | null;
      satuan: string;
      status: string;
    }[];
    jumlahTidakMemenuhi: number;
    ruangUdaraPerOrang: number | null;
    statusRuangUdara: string;
  } | null;
}

export default function InspeksiUdaraDebuTable() {
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
  const sesuaiSemua = data.filter((d) => d.penilaian && d.penilaian.statusUdara && d.penilaian.statusUdara.every((x) => x.status === 'memenuhi')).length;
  const adaGagal = data.filter((d) => d.penilaian && d.penilaian.statusUdara && d.penilaian.statusUdara.some((x) => x.status === 'tidak-memenuhi')).length;

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', width: '94%', margin: '0 auto' }}>
      <div className="admin-form-inner">
        <div style={{ marginBottom: 8 }}>
          <h1 className="admin-form-title">Rekapitulasi Kualitas Udara &amp; Debu Ruangan</h1>
          <p className="admin-form-subtitle">
            Daftar hasil pengujian parameter kualitas udara dalam ruangan (KUDR), debu PM10, serat asbes, dan ventilasi tempat kerja.
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
            <span>Terpantau: <b>{sudahDiukur}</b></span>
            <span>Memenuhi Standar: <b style={{ color: '#00B894' }}>{sesuaiSemua}</b></span>
            <span>Ada Temuan: <b style={{ color: adaGagal ? '#FF2D2D' : 'inherit' }}>{adaGagal}</b></span>
          </div>
        </div>

        {/* Card Table */}
        <div className="admin-form-card" style={{ overflow: 'auto' }}>
          {!data.length ? (
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', padding: '16px 8px', margin: 0 }}>
              <ClipboardCheck size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
              Belum ada data pemantauan kualitas udara yang tercatat.
            </p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  {['Nama Ruangan', 'Peruntukan', 'Ventilasi Buatan', 'Parameter Terpantau', 'Temuan Tidak Sesuai', 'Tanggal Pemantauan'].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((r) => {
                  const p = r.penilaian;
                  const gagal = p?.statusUdara ? p.statusUdara.filter((x) => x.status === 'tidak-memenuhi').length : 0;
                  const warna = !p ? 'var(--muted-foreground)' : gagal === 0 ? '#00B894' : '#FF2D2D';

                  return (
                    <tr key={r.id}>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{r.namaRuang}</td>
                      <td style={tdStyle}>{r.peruntukan.replace('_', ' ')}</td>
                      <td style={tdStyle}>{r.ventilasiBuatan ? 'Ada (AC/Exhaust)' : 'Alami'}</td>
                      <td style={tdStyle}>
                        {p?.statusUdara ? (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {p.statusUdara.map((u, i) => (
                              <span
                                key={i}
                                style={{
                                  fontSize: 9.5,
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  background: u.status === 'memenuhi' ? 'rgba(0,184,148,0.1)' : 'rgba(255,45,45,0.1)',
                                  color: u.status === 'memenuhi' ? '#00B894' : '#FF2D2D',
                                  fontWeight: 600,
                                }}
                              >
                                {u.label}: {u.nilai ?? '-'}{u.satuan}
                              </span>
                            ))}
                          </div>
                        ) : '-'}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: warna }}>
                        {!p ? 'Belum Diukur' : gagal === 0 ? '✓ Sesuai Standar' : `✗ ${gagal} Parameter Gagal`}
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
