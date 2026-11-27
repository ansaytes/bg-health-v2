'use client';

// Administrator > Higiene Industri > Riwayat Inspeksi Jasaboga & Gizi
// Rekapitulasi hasil penilaian kelaikan jasaboga/kantin dan kalori menu.
// Ditampilkan di panel tabel melalui tombol panah navigasi (AdminTogglePanel).

import { useCallback, useEffect, useState } from 'react';
import { Award, CheckCircle2, RefreshCw, ShieldAlert, ShieldCheck, Utensils } from 'lucide-react';

import { authFetch } from '@/lib/api-client';
import { Btn, SITES, fmtDate, tableStyle, thStyle, tdStyle } from './hc-ergo-ui';

interface RiwayatGizi {
  id: string;
  site: string;
  tanggal: string;
  inspektur: string | null;
  vendor: string | null;
  nama_kantin: string | null;
  jumlah_porsi: number;
  jumlah_penjamah: number;
  jumlah_buku_sehat: number;
  no_slhs: string | null;
  tgl_kadaluwarsa_slhs: string | null;
  kalori_sarapan: number;
  kalori_siang: number;
  kalori_malam: number;
  extra_fooding: string | null;
  ringkasan: {
    totalSkor: number;
    persenSkor: number;
    statusLaik: 'laik' | 'laik_bersyarat' | 'tidak_laik';
    keteranganStatus: string;
    totalItemDinilai: number;
    totalSesuai: number;
    totalTidakSesuai: number;
  } | null;
  catatan: string | null;
  pica_no?: string | null;
  pica_temuan?: string | null;
  pica_akar_masalah?: string | null;
  pica_tindakan?: string | null;
  pica_pic?: string | null;
  pica_due_date?: string | null;
  pica_status?: 'OPEN' | 'IN_PROGRESS' | 'CLOSED' | null;
  created_at: string;
}

export default function GiziKerjaTable() {
  const [site, setSite] = useState('');
  const [rows, setRows] = useState<RiwayatGizi[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = site ? `?site=${encodeURIComponent(site)}` : '';
      const r = await authFetch(`/api/gizi/inspeksi${q}`);
      setRows((r.data ?? []) as RiwayatGizi[]);
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
  const sesiLaik = rows.filter((r) => r.ringkasan?.statusLaik === 'laik').length;
  const avgKepatuhan = totalSesi
    ? Math.round(rows.reduce((acc, r) => acc + (r.ringkasan?.persenSkor ?? 0), 0) / totalSesi)
    : 0;
  const avgKalori = totalSesi
    ? Math.round(
        rows.reduce(
          (acc, r) => acc + ((r.kalori_sarapan || 0) + (r.kalori_siang || 0) + (r.kalori_malam || 0)),
          0
        ) / totalSesi
      )
    : 0;
  const totalPicaOpen = rows.filter((r) => r.pica_status === 'OPEN' || (!r.pica_status && r.ringkasan && r.ringkasan.totalTidakSesuai > 0)).length;

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', width: '94%', margin: '0 auto' }}>
      <div className="admin-form-inner">
        {/* Header & Filter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 className="admin-form-title">Riwayat Inspeksi Jasaboga &amp; Gizi Kerja</h1>
            <p className="admin-form-subtitle">
              Rekap hasil audit kelaikan kantin katering dan kepatuhan kalori menu pekerja lapangan.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              className="admin-input"
              style={{ width: 160, height: 32, fontSize: 11 }}
              value={site}
              onChange={(e) => setSite(e.target.value)}
            >
              <option value="">Semua Site</option>
              {SITES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <Btn type="button" onClick={() => void load()} disabled={loading} style={{ height: 32, fontSize: 11 }}>
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </Btn>
          </div>
        </div>

        {/* Ringkasan KPI Badges */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 14 }}>
          <div style={BADGE_CARD}>
            <span style={BADGE_LABEL}>Total Inspeksi</span>
            <div style={BADGE_VALUE}>{totalSesi}</div>
            <span style={BADGE_SUB}>Sesi pemeriksaan tercatat</span>
          </div>

          <div style={BADGE_CARD}>
            <span style={BADGE_LABEL}>Jasaboga Laik</span>
            <div style={{ ...BADGE_VALUE, color: '#00B894' }}>{sesiLaik} <span style={{ fontSize: 12, fontWeight: 500 }}>({totalSesi ? Math.round((sesiLaik / totalSesi) * 100) : 0}%)</span></div>
            <span style={BADGE_SUB}>Skor kepatuhan ≥ 85%</span>
          </div>

          <div style={BADGE_CARD}>
            <span style={BADGE_LABEL}>Rata-rata Kepatuhan</span>
            <div style={{ ...BADGE_VALUE, color: avgKepatuhan >= 85 ? '#00B894' : '#FF7A00' }}>{avgKepatuhan}%</div>
            <span style={BADGE_SUB}>Standar kelaikan sanitasi</span>
          </div>

          <div style={BADGE_CARD}>
            <span style={BADGE_LABEL}>Rata-rata Kalori Menu</span>
            <div style={{ ...BADGE_VALUE, color: '#3498DB' }}>{avgKalori || '-'} <span style={{ fontSize: 11, fontWeight: 500 }}>kkal</span></div>
            <span style={BADGE_SUB}>Standar: 2.600 - 3.200 kkal</span>
          </div>

          <div style={BADGE_CARD}>
            <span style={BADGE_LABEL}>PICA Temuan</span>
            <div style={{ ...BADGE_VALUE, color: totalPicaOpen > 0 ? '#FF2D2D' : '#00B894' }}>
              {totalPicaOpen} <span style={{ fontSize: 11, fontWeight: 500 }}>Open</span>
            </div>
            <span style={BADGE_SUB}>Tindak lanjut perbaikan kantin</span>
          </div>
        </div>

        {/* Tabel Data */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--card)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Tanggal</th>
                  <th style={thStyle}>Site</th>
                  <th style={thStyle}>Vendor &amp; Kantin</th>
                  <th style={thStyle}>Inspektur</th>
                  <th style={thStyle}>SLHS &amp; Legalitas</th>
                  <th style={thStyle}>Food Handler</th>
                  <th style={thStyle}>Total Kalori</th>
                  <th style={thStyle}>Skor Higiene</th>
                  <th style={thStyle}>Status Kelaikan</th>
                  <th style={thStyle}>Register PICA</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const rk = r.ringkasan;
                  const totalKkal = (r.kalori_sarapan || 0) + (r.kalori_siang || 0) + (r.kalori_malam || 0);
                  const isLaik = rk?.statusLaik === 'laik';
                  const isBersyarat = rk?.statusLaik === 'laik_bersyarat';
                  const picaStatus = r.pica_status || (rk && rk.totalTidakSesuai > 0 ? 'OPEN' : 'CLOSED');
                  const picaColor = picaStatus === 'OPEN' ? '#FF2D2D' : picaStatus === 'IN_PROGRESS' ? '#FF7A00' : '#00B894';

                  return (
                    <tr key={r.id}>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtDate(r.tanggal)}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{r.site}</td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600 }}>{r.vendor || '-'}</div>
                        {r.nama_kantin && <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{r.nama_kantin}</div>}
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{r.inspektur || '-'}</td>
                      <td style={tdStyle}>
                        <div style={{ fontSize: 11 }}>{r.no_slhs || 'Belum Ada'}</div>
                        {r.tgl_kadaluwarsa_slhs && (
                          <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
                            Exp: {fmtDate(r.tgl_kadaluwarsa_slhs)}
                          </div>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontSize: 11 }}>
                          <b>{r.jumlah_buku_sehat}</b> / {r.jumlah_penjamah} Sehat
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
                          {r.jumlah_porsi} porsi/hari
                        </div>
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 800, color: totalKkal >= 2600 ? '#00B894' : '#FF7A00' }}>
                          {totalKkal ? `${totalKkal} kkal` : '-'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        {rk ? (
                          <span style={{ fontWeight: 800, color: isLaik ? '#00B894' : isBersyarat ? '#FF7A00' : '#FF2D2D' }}>
                            {rk.persenSkor}%
                          </span>
                        ) : '-'}
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        {rk ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontSize: 10,
                              fontWeight: 700,
                              background: isLaik ? 'rgba(0,184,148,0.12)' : isBersyarat ? 'rgba(255,122,0,0.12)' : 'rgba(255,45,45,0.12)',
                              color: isLaik ? '#00B894' : isBersyarat ? '#FF7A00' : '#FF2D2D',
                            }}
                          >
                            {isLaik ? <ShieldCheck size={12} /> : isBersyarat ? <ShieldAlert size={12} /> : <ShieldAlert size={12} />}
                            {isLaik ? 'Laik Operasional' : isBersyarat ? 'Laik Bersyarat' : 'Tidak Laik'}
                          </span>
                        ) : '-'}
                      </td>
                      <td style={{ ...tdStyle, minWidth: 220, fontSize: 10.5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{
                            padding: '1px 6px',
                            borderRadius: 4,
                            fontSize: 9.5,
                            fontWeight: 800,
                            background: `${picaColor}18`,
                            color: picaColor,
                            border: `1px solid ${picaColor}40`,
                          }}>
                            {picaStatus}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: 10.5, color: 'var(--foreground)' }}>
                            {r.pica_no || 'PICA Belum Diisi'}
                          </span>
                        </div>
                        {r.pica_temuan && (
                          <div style={{ color: 'var(--foreground)', fontWeight: 500, fontSize: 10, marginBottom: 2 }}>
                            <b>Temuan:</b> {r.pica_temuan.slice(0, 90)}{r.pica_temuan.length > 90 ? '...' : ''}
                          </div>
                        )}
                        {r.pica_tindakan && (
                          <div style={{ color: 'var(--muted-foreground)', fontSize: 9.5 }}>
                            <b>Tindakan:</b> {r.pica_tindakan.slice(0, 80)}{r.pica_tindakan.length > 80 ? '...' : ''}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 9.5, color: 'var(--muted-foreground)' }}>
                          {r.pica_pic && <span>PIC: <b>{r.pica_pic}</b></span>}
                          {r.pica_due_date && <span>Target: <b>{fmtDate(r.pica_due_date)}</b></span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && !loading && (
                  <tr>
                    <td colSpan={10} style={{ ...tdStyle, textAlign: 'center', padding: '28px 12px', color: 'var(--muted-foreground)' }}>
                      Belum ada data inspeksi jasaboga untuk site yang dipilih.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const BADGE_CARD: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 8,
  background: 'var(--card)',
  border: '1px solid var(--border)',
};

const BADGE_LABEL: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  fontWeight: 700,
  color: 'var(--muted-foreground)',
  letterSpacing: '0.04em',
};

const BADGE_VALUE: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: 'var(--foreground)',
  marginTop: 2,
};

const BADGE_SUB: React.CSSProperties = {
  fontSize: 9.5,
  color: 'var(--muted-foreground)',
};
