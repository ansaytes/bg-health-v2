'use client';
// Dashboard > Hearing Conservation. Data dari /api/hc?resource=dashboard (noise mapping, klasifikasi, audiometri MCU, STS).
import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '@/lib/api-client';
import { ZONA_COLOR, type Zona } from '@/lib/hc-ergo';
import { BarRow, Chip, SITES, Stat, fmtDate, tableStyle, tdStyle, thStyle } from '@/components/administrator/hc-ergo-ui';

type D = Record<string, any>;
const KELAS_COLOR: Record<string, string> = { Normal: '#00B894', Ringan: '#F5C518', Sedang: '#F5A623', Berat: '#FF6B35', 'Sangat Berat': '#E63946' };

export default function HearingConservationDashboard() {
  const [d, setD] = useState<D | null>(null);
  const [site, setSite] = useState('');
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    try { setErr(''); setD((await authFetch(`/api/hc?resource=dashboard&site=${encodeURIComponent(site)}`)).data); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Gagal memuat dashboard'); }
  }, [site]);
  useEffect(() => { const id = setTimeout(load, 0); return () => clearTimeout(id); }, [load]);

  if (err) return <div style={{ padding: 20, color: '#E63946', fontSize: 13 }}>{err}</div>;
  if (!d) return <div style={{ padding: 20, fontSize: 13 }}>Memuat…</div>;
  const maxKelas = Math.max(1, ...Object.values(d.kelas as Record<string, number>));
  const nAreaTot = Object.values(d.zona as Record<string, number>).reduce((a, b) => a + b, 0);

  return (
    <div className="dashboard" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="kunjungan-filter-bar">
        <select className="admin-filter-select" value={site} onChange={(e) => setSite(e.target.value)}><option value="">All Site</option>{SITES.map((s) => <option key={s}>{s}</option>)}</select>
        <span className="kunjungan-total-right">Konservasi Pendengaran — STD/033</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <Stat label="Area Zona Merah" value={d.zona.MERAH} color={ZONA_COLOR.MERAH} sub={`dari ${nAreaTot} area`} />
        <Stat label="Area Zona Kuning" value={d.zona.KUNING} color="#d4a000" />
        <Stat label="Area Zona Hijau" value={d.zona.HIJAU} color={ZONA_COLOR.HIJAU} />
        <Stat label="Ukur Ulang Terlambat" value={d.areaTerlambat} color={d.areaTerlambat ? '#E63946' : undefined} sub={`${d.zona.BELUM} area belum pernah diukur`} />
        <Stat label="STS Belum Ditindaklanjuti" value={d.sts.belumDitindaklanjuti} color={d.sts.belumDitindaklanjuti ? '#E63946' : undefined} />
        <Stat label="Retest Terlambat (>30 hr)" value={d.sts.retestTerlambat} color={d.sts.retestTerlambat ? '#E63946' : undefined} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
        <div className="card" style={{ padding: 12 }}>
          <div className="card-head"><h2>Karyawan Terpajan</h2></div>
          <BarRow label="Kategori A (rutin)" value={d.kategori.A} max={Math.max(1, d.kategori.A, d.kategori.B, d.kategori.C)} color="#E63946" />
          <BarRow label="Kategori B (insidental)" value={d.kategori.B} max={Math.max(1, d.kategori.A, d.kategori.B, d.kategori.C)} color="#F5A623" />
          <BarRow label="Kategori C (tidak)" value={d.kategori.C} max={Math.max(1, d.kategori.A, d.kategori.B, d.kategori.C)} color="#00B894" />
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div className="card-head"><h2>Cakupan Audiometri Tahun Ini</h2></div>
          {d.cakupan.map((c: D) => (
            <div key={c.kategori} style={{ marginBottom: 8 }}>
              <BarRow label={`Kategori ${c.kategori}`} value={c.sudahTahunIni} max={Math.max(1, c.total)} color="#2E86DE" />
              <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginLeft: 118 }}>
                {c.sudahTahunIni}/{c.total} sudah · {c.belumBaseline} belum punya baseline · {c.belumPernahAudiometri} belum pernah audiometri
              </div>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div className="card-head"><h2>Derajat Gangguan Pendengaran</h2></div>
          {Object.entries(d.kelas as Record<string, number>).map(([k, v]) => <BarRow key={k} label={k} value={v} max={maxKelas} color={KELAS_COLOR[k] || '#778899'} />)}
          {!Object.keys(d.kelas).length && <span style={{ fontSize: 11 }}>Belum ada data audiometri karyawan Kategori A/B.</span>}
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div className="card-head"><h2>Kasus STS</h2></div>
          <BarRow label="Suspek" value={d.sts.suspek} max={Math.max(1, d.sts.suspek, d.sts.retestDijadwalkan, d.sts.terkonfirmasi)} color="#E63946" />
          <BarRow label="Retest dijadwalkan" value={d.sts.retestDijadwalkan} max={Math.max(1, d.sts.suspek, d.sts.retestDijadwalkan, d.sts.terkonfirmasi)} color="#F5A623" />
          <BarRow label="Terkonfirmasi" value={d.sts.terkonfirmasi} max={Math.max(1, d.sts.suspek, d.sts.retestDijadwalkan, d.sts.terkonfirmasi)} color="#8E44AD" />
        </div>
      </div>

      <div className="card" style={{ padding: 12, overflow: 'auto' }}>
        <div className="card-head"><h2>Peta Kebisingan per Area</h2></div>
        <table style={tableStyle}>
          <thead><tr>{['Site', 'Area', 'Leq maks', 'Zona', 'Ukur terakhir', 'Jatuh tempo', 'Rambu', 'APT'].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>
            {(d.areas as D[]).map((a) => (
              <tr key={a.area_id}><td style={tdStyle}>{a.site}</td><td style={tdStyle}>{a.nama_area}</td><td style={tdStyle}>{a.leq_max ?? '-'}</td>
                <td style={tdStyle}>{a.zona ? <Chip text={a.zona} color={ZONA_COLOR[a.zona as Zona]} /> : <Chip text="BELUM DIUKUR" color="#778899" />}</td>
                <td style={tdStyle}>{fmtDate(a.tanggal_ukur)}</td>
                <td style={tdStyle}>{a.jatuh_tempo ? fmtDate(a.jatuh_tempo) : '-'} {a.terlambat && a.zona && <Chip text="TERLAMBAT" color="#E63946" />}</td>
                <td style={tdStyle}>{a.zona && a.zona !== 'HIJAU' ? (a.rambu_terpasang ? 'Ya' : <Chip text="BELUM" color="#E63946" />) : '-'}</td>
                <td style={tdStyle}>{a.zona && a.zona !== 'HIJAU' ? (a.apt_tersedia ? `NRR ${a.apt_nrr_tersedia ?? '?'}` : <Chip text="BELUM" color="#E63946" />) : '-'}</td></tr>
            ))}
            {!d.areas.length && <tr><td style={tdStyle} colSpan={8}>Belum ada area terdaftar.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
