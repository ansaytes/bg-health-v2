'use client';
// Dashboard > Ergonomi. Data dari /api/ergo?resource=dashboard (12 bulan terakhir, survei berstatus Disetujui).
import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '@/lib/api-client';
import { KLAS_COLOR, type Klasifikasi } from '@/lib/hc-ergo';
import { BarRow, Chip, SITES, Stat, fmtDate, tableStyle, tdStyle, thStyle } from '@/components/administrator/hc-ergo-ui';

type D = Record<string, any>;
const KLAS: Klasifikasi[] = ['RENDAH', 'SEDANG', 'TINGGI', 'SANGAT_TINGGI'];

export default function ErgonomiDashboard() {
  const [d, setD] = useState<D | null>(null);
  const [site, setSite] = useState('');
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    try { setErr(''); setD((await authFetch(`/api/ergo?resource=dashboard&site=${encodeURIComponent(site)}`)).data); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Gagal memuat dashboard'); }
  }, [site]);
  useEffect(() => { const id = setTimeout(load, 0); return () => clearTimeout(id); }, [load]);

  if (err) return <div style={{ padding: 20, color: '#E63946', fontSize: 13 }}>{err}</div>;
  if (!d) return <div style={{ padding: 20, fontSize: 13 }}>Memuat…</div>;
  const maxTrend = Math.max(1, ...d.trend.map((t: D) => t.total));
  const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  return (
    <div className="dashboard" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="kunjungan-filter-bar">
        <select className="admin-filter-select" value={site} onChange={(e) => setSite(e.target.value)}><option value="">All Site</option>{SITES.map((s) => <option key={s}>{s}</option>)}</select>
        <span className="kunjungan-total-right">Ergonomi RULA / ROSA / WERA — 12 bulan terakhir</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <Stat label="Survei Disetujui" value={d.totalDisetujui} />
        <Stat label="Menunggu Persetujuan" value={d.menungguPersetujuan} color={d.menungguPersetujuan ? '#F5A623' : undefined} />
        <Stat label="Hasil Tidak Sah / Ulang" value={d.perluDiulang} color={d.perluDiulang ? '#E63946' : undefined} />
        <Stat label="Rekomendasi Open" value={d.rekomendasi.open + d.rekomendasi.progress} sub={`${d.rekomendasi.closed} closed`} />
        <Stat label="Lewat Jatuh Tempo" value={d.rekomendasi.lewatJatuhTempo} color={d.rekomendasi.lewatJatuhTempo ? '#E63946' : undefined} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
        {(['RULA', 'ROSA', 'WERA'] as const).map((m) => (
          <div key={m} className="card" style={{ padding: 12 }}>
            <div className="card-head"><h2>{m} — {d.byMetode[m]} survei</h2></div>
            {KLAS.map((k) => {
              const v = d.byKlas[m]?.[k] ?? 0;
              if (m === 'WERA' && k === 'SANGAT_TINGGI') return null;
              return <BarRow key={k} label={k.replace('_', ' ')} value={v} max={Math.max(1, d.byMetode[m])} color={KLAS_COLOR[k]} />;
            })}
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div className="card-head"><h2>Tren Survei per Bulan (merah = sedang ke atas)</h2></div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 110 }}>
          {d.trend.map((t: D) => (
            <div key={t.bulan} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <span style={{ fontSize: 10, fontWeight: 700 }}>{t.total || ''}</span>
              <div style={{ width: '100%', height: `${(t.total / maxTrend) * 80}%`, minHeight: t.total ? 3 : 0, background: '#2E86DE', borderRadius: '3px 3px 0 0', position: 'relative' }}>
                <div style={{ position: 'absolute', bottom: 0, width: '100%', height: `${t.total ? (t.sedangKeAtas / t.total) * 100 : 0}%`, background: '#E63946', borderRadius: '0 0 0 0' }} />
              </div>
              <span style={{ fontSize: 9, color: 'var(--muted-foreground)' }}>{BLN[Number(t.bulan.slice(5)) - 1]}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 10 }}>
        <div className="card" style={{ padding: 12, overflow: 'auto' }}>
          <div className="card-head"><h2>Kepatuhan Frekuensi Survei (STD/036)</h2></div>
          <table style={tableStyle}>
            <thead><tr>{['Site', 'Internal bulan ini (≥1)', 'Pihak ketiga 12 bln (≥1)'].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {d.kepatuhan.map((k: D) => (
                <tr key={k.site}><td style={tdStyle}>{k.site}</td>
                  <td style={tdStyle}>{k.internalBulanIni} {k.internalBulanIni >= 1 ? <Chip text="OK" color="#00B894" /> : <Chip text="BELUM" color="#E63946" />}</td>
                  <td style={tdStyle}>{k.pihakKetiga12Bulan} {k.pihakKetiga12Bulan >= 1 ? <Chip text="OK" color="#00B894" /> : <Chip text="BELUM" color="#E63946" />}</td></tr>
              ))}
              {!d.kepatuhan.length && <tr><td style={tdStyle} colSpan={3}>Belum ada data.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card" style={{ padding: 12, overflow: 'auto' }}>
          <div className="card-head"><h2>Risiko Tinggi Terbaru</h2></div>
          <table style={tableStyle}>
            <thead><tr>{['Tanggal', 'Metode', 'Site / Area', 'Skor', 'Klasifikasi'].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {d.risikoTinggi.map((r: D) => (
                <tr key={r.id}><td style={tdStyle}>{fmtDate(r.tanggal)}</td><td style={tdStyle}>{r.metode}</td><td style={tdStyle}>{r.site} — {r.area_kerja}</td><td style={tdStyle}>{r.skor_akhir}</td>
                  <td style={tdStyle}><Chip text={String(r.klasifikasi).replace('_', ' ')} color={KLAS_COLOR[r.klasifikasi as Klasifikasi]} /></td></tr>
              ))}
              {!d.risikoTinggi.length && <tr><td style={tdStyle} colSpan={5}>Tidak ada.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
