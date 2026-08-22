'use client';

import { useState, useEffect } from 'react';

const JOBSITES = [
  'All Site','Aceh','Angsana','Balikpapan','Banjarmasin','Banyuwangi',
  'Batu Kajang','Bengalon','Binuang','Binungan','Bontang','Bukit Pinang',
  'Bunyu','Gorontalo','Gunung Bintang Awai','Gunung Mas','Gunung Sari',
  'Halmahera Timur','Head Office','Kaliorang','Kapuas Tengah','Kaubun',
  'Kayong Utara','Kelubir','Ketapang','Konawe','Kota Baru','Kotamobagu',
  'Labanan','Lahat','Luwu','Malinau','Melak','Morowali','Muara Bungo',
  'Muara Enim','Muara Teweh','Murung Raya','Palu','Rantau','Samarinda',
  'Sangatta','Satui','Sebakis','Senakin','Soroako','Tabang',
  'Tanjung Redeb','Tanjung Tabalong','Tenggarong','Tri Yoga Morowali',
  'Tuhup','Wetar',
];

const MONTHS = ['Semua','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

export default function DataManPowerTable() {
  const [siteFilter, setSiteFilter] = useState('All Site');
  const [monthFilter, setMonthFilter] = useState('Semua');
  const [yearFilter, setYearFilter] = useState('2026');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (siteFilter !== 'All Site') params.set('jobsite', siteFilter);
        if (monthFilter !== 'Semua') params.set('bulan', String(MONTHS.indexOf(monthFilter)));
        params.set('tahun', yearFilter);

        const res = await fetch(`/api/manpower?${params}`);
        const json = await res.json();
        if (json.success) setRows(json.data || []);
      } catch {
        // Supabase not connected
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [siteFilter, monthFilter, yearFilter]);

  return (
    <div className="raw-table-container">
      <div className="raw-table-header-bar">
        <span>Data Man Power per Site per Bulan</span>
        <span style={{ color: 'var(--fg-dim)' }}>{rows.length} records</span>
      </div>
      <div className="raw-table-filter-bar">
        <div className="filter-tag">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
          Filter
        </div>
        <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
          {JOBSITES.map(s => (<option key={s} value={s}>{s}</option>))}
        </select>
        <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
          {MONTHS.map(m => (<option key={m} value={m}>{m}</option>))}
        </select>
        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
          <option value="2026">2026</option><option value="2025">2025</option><option value="2024">2024</option>
        </select>
      </div>
      <div className="raw-table-scroll">
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Jobsite</th>
              <th>Bulan</th>
              <th>Tahun</th>
              <th>Man Power</th>
              <th>Hari Kerja</th>
              <th>Man Hours</th>
              <th>Kunjungan Klinik</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--fg-dim)' }}>Memuat data...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--fg-dim)' }}>
                  Belum ada data. Input melalui tab Man Power Bulanan.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={row.id || idx}>
                  <td style={{ color: 'var(--muted-foreground)' }}>{idx + 1}</td>
                  <td>{row.jobsite}</td>
                  <td>{MONTHS[row.bulan] || row.bulan}</td>
                  <td>{row.tahun}</td>
                  <td style={{ fontWeight: 600 }}>{row.man_power}</td>
                  <td>{row.hari_kerja}</td>
                  <td style={{ fontWeight: 600, color: '#00B894' }}>{row.man_hours}</td>
                  <td>{row.kunjungan_klinik || 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="raw-table-notes">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
        <span>Man Hours = Man Power x Hari Kerja (dihitung otomatis oleh Supabase). Data ini menjadi denominator perhitungan RKK, CMR, MFR, SSR, ASR, FR PAK, KAPTK.</span>
      </div>
    </div>
  );
}
