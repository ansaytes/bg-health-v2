'use client';

import { useState, useMemo } from 'react';

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

const COLUMNS = [
  { key: 'tanggalMCU', label: 'Tanggal MCU' },
  { key: 'nik', label: 'NIK' },
  { key: 'nama', label: 'Nama' },
  { key: 'jobsite', label: 'Jobsite' },
  { key: 'jabatan', label: 'Jabatan' },
  { key: 'hasil', label: 'Hasil MCU' },
  { key: 'tindakLanjut', label: 'Tindak Lanjut' },
  { key: 'status', label: 'Status' },
];

const PLACEHOLDER_ROWS = [
  { tanggalMCU: '15/01/2026', nik: '230802778', nama: 'Putra Gunawan', jobsite: 'Aceh', jabatan: 'Driver', hasil: 'Fit', tindakLanjut: '-', status: 'Selesai' },
  { tanggalMCU: '16/01/2026', nik: '240704222', nama: 'Deki Maulana', jobsite: 'Aceh', jabatan: 'Driver', hasil: 'Fit Sebagian', tindakLanjut: 'Cek Laboratorium', status: 'Proses' },
  { tanggalMCU: '17/01/2026', nik: '230101260', nama: 'Andrianis', jobsite: 'Sangatta', jabatan: 'Mechanic', hasil: 'Tidak Fit', tindakLanjut: 'Rujuk Spesialis', status: 'Proses' },
  { tanggalMCU: '18/01/2026', nik: '250905415', nama: 'Nurussyahrul M.', jobsite: 'Angsana', jabatan: 'Operator', hasil: 'Fit', tindakLanjut: '-', status: 'Selesai' },
];

export default function RecordMCUTable() {
  const [siteFilter, setSiteFilter] = useState('All Site');
  const [monthFilter, setMonthFilter] = useState('Semua');
  const [yearFilter, setYearFilter] = useState('2026');

  const filteredRows = useMemo(() => {
    return PLACEHOLDER_ROWS.filter(r => {
      if (siteFilter !== 'All Site' && r.jobsite !== siteFilter) return false;
      return true;
    });
  }, [siteFilter, monthFilter, yearFilter]);

  const fitCount = filteredRows.filter(r => r.hasil === 'Fit').length;
  const tidakFitCount = filteredRows.filter(r => r.hasil === 'Tidak Fit').length;
  const selesaiCount = filteredRows.filter(r => r.status === 'Selesai').length;

  return (
    <div className="raw-table-container" style={{ position: 'absolute', inset: 0 }}>
      {/* Header Bar */}
      <div className="raw-table-header-bar">
        <span style={{ fontWeight: 700 }}>Rekap MCU</span>
        <span style={{ color: 'var(--muted-foreground)' }}>
          {filteredRows.length} records
          <span style={{ margin: '0 6px', opacity: 0.3 }}>|</span>
          {fitCount} fit
          <span style={{ margin: '0 6px', opacity: 0.3 }}>|</span>
          {tidakFitCount} tidak fit
          <span style={{ margin: '0 6px', opacity: 0.3 }}>|</span>
          {selesaiCount} selesai
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

      {/* Table - fills remaining height */}
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
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
                  Tidak ada data untuk filter ini.
                </td>
              </tr>
            ) : (
              filteredRows.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ color: 'var(--muted-foreground)' }}>{idx + 1}</td>
                  {COLUMNS.map(col => {
                    const val = row[col.key as keyof typeof row] || '-';
                    const isStatus = col.key === 'status';
                    const isHasil = col.key === 'hasil';
                    let color: string | undefined;
                    if (isStatus) {
                      color = val === 'Selesai' ? '#00B894' : '#ff4d00';
                    } else if (isHasil) {
                      color = val === 'Fit' ? '#00B894' : val === 'Tidak Fit' ? '#FF4444' : '#FDCB6E';
                    }
                    return (
                      <td key={col.key} style={{ fontWeight: (isStatus || isHasil) ? 600 : 400, color }}>
                        {String(val)}
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
