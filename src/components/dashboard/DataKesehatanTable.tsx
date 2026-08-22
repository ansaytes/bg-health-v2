'use client';

import { useState, useMemo, useEffect } from 'react';

/* Column definitions matching Excel: Data Karyawan Sakit */
const COLUMNS = [
  { key: 'nik', label: 'NIK' },
  { key: 'nama', label: 'Nama' },
  { key: 'jobsite', label: 'Jobsite' },
  { key: 'jabatan', label: 'Jabatan' },
  { key: 'tgl_mulai_a', label: 'Tgl Mulai A' },
  { key: 'tgl_selesai_a', label: 'Tgl Selesai A' },
  { key: 'hari_a', label: 'Hari A' },
  { key: 'tgl_mulai_b', label: 'Tgl Mulai B' },
  { key: 'tgl_selesai_b', label: 'Tgl Selesai B' },
  { key: 'hari_b', label: 'Hari B' },
  { key: 'tgl_mulai_c', label: 'Tgl Mulai C' },
  { key: 'tgl_selesai_c', label: 'Tgl Selesai C' },
  { key: 'hari_c', label: 'Hari C' },
  { key: 'spell', label: 'Spell' },
];

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
const YEARS = ['2024','2025','2026','2027'];

/* Format date to dd/mm/yyyy */
function fmtDate(d: string | null): string {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '-';
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return dd + '/' + mm + '/' + dt.getFullYear();
}

const DATE_KEYS = new Set(['tgl_mulai_a','tgl_selesai_a','tgl_mulai_b','tgl_selesai_b','tgl_mulai_c','tgl_selesai_c']);
const NUM_KEYS = new Set(['hari_a','hari_b','hari_c','spell']);

export default function DataKesehatanTable() {
  const [siteFilter, setSiteFilter] = useState('All Site');
  const [monthFilter, setMonthFilter] = useState('Semua');
  const [yearFilter, setYearFilter] = useState('2026');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  /* Fetch from Supabase */
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (siteFilter !== 'All Site') params.set('jobsite', siteFilter);
        if (monthFilter !== 'Semua') params.set('bulan', String(MONTHS.indexOf(monthFilter)));
        params.set('tahun', yearFilter);

        const res = await fetch(`/api/absensi?${params}`);
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

  const totalSick = rows.reduce((s, r) => s + (r.hari_a || 0) + (r.hari_b || 0) + (r.hari_c || 0), 0);
  const totalSpell = rows.reduce((s, r) => s + (r.spell || 0), 0);
  const uniqueEmployees = new Set(rows.map((r: any) => r.nik)).size;

  return (
    <div className="raw-table-container">
      {/* Header Bar */}
      <div className="raw-table-header-bar">
        <span style={{ fontWeight: 700 }}>Data Karyawan Sakit</span>
        <span style={{ color: 'var(--muted-foreground)' }}>
          {rows.length} baris
          <span style={{ margin: '0 6px', opacity: 0.3 }}>|</span>
          {uniqueEmployees} karyawan
          <span style={{ margin: '0 6px', opacity: 0.3 }}>|</span>
          {totalSick} hari absensi
          <span style={{ margin: '0 6px', opacity: 0.3 }}>|</span>
          {totalSpell} spell
        </span>
      </div>

      {/* Filters */}
      <div className="raw-table-filter-bar">
        <div className="filter-tag">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11 }}>
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Filter
        </div>
        <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
          {JOBSITES.map(s => (<option key={s} value={s}>{s}</option>))}
        </select>
        <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
          {MONTHS.map(m => (<option key={m} value={m}>{m}</option>))}
        </select>
        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
          {YEARS.map(y => (<option key={y} value={y}>{y}</option>))}
        </select>
      </div>

      {/* Table */}
      <div className="raw-table-scroll">
        <table>
          <thead>
            <tr>
              <th>No</th>
              {COLUMNS.map(col => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
                  Memuat data...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
                  Tidak ada data untuk filter ini.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={row.id || idx}>
                  <td style={{ color: 'var(--muted-foreground)' }}>{idx + 1}</td>
                  {COLUMNS.map(col => {
                    const val = row[col.key];
                    const isDate = DATE_KEYS.has(col.key);
                    const isNum = NUM_KEYS.has(col.key);
                    let display: string;
                    if (isDate) {
                      display = fmtDate(val);
                    } else if (isNum) {
                      display = (val === 0 || val === '0') ? '-' : String(val);
                    } else {
                      display = String(val || '');
                    }
                    return (
                      <td key={col.key} style={{ fontWeight: isNum ? 600 : 400 }}>
                        {display}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
