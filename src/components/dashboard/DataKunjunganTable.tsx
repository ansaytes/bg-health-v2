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
  { key: 'tanggal', label: 'Tanggal' },
  { key: 'nik', label: 'NIK' },
  { key: 'nama', label: 'Nama' },
  { key: 'departemen', label: 'Departemen' },
  { key: 'site', label: 'Site' },
  { key: 'diagnosa', label: 'Diagnosa' },
  { key: 'jenisObat', label: 'Jenis Obat' },
  { key: 'rujukRS', label: 'Rujuk RS' },
  { key: 'namaRS', label: 'Nama RS' },
];

const PLACEHOLDER_ROWS = [
  { tanggal: '03/01/2026', nik: '230802778', nama: 'Putra Gunawan', departemen: 'Operation', site: 'Aceh', diagnosa: 'ISPA', jenisObat: 'Paracetamol, Amoxicillin', rujukRS: 'Tidak', namaRS: '-' },
  { tanggal: '05/01/2026', nik: '240704222', nama: 'Deki Maulana', departemen: 'Operation', site: 'Aceh', diagnosa: 'Demam Berdarah', jenisObat: 'Paracetamol', rujukRS: 'Ya', namaRS: 'RSUD Aceh' },
  { tanggal: '08/01/2026', nik: '230101260', nama: 'Andrianis', departemen: 'Mechanic', site: 'Sangatta', diagnosa: 'Typus', jenisObat: 'Ciprofloxacin', rujukRS: 'Tidak', namaRS: '-' },
  { tanggal: '10/01/2026', nik: '250905415', nama: 'Nurussyahrul M.', departemen: 'Operation', site: 'Angsana', diagnosa: 'Gastritis', jenisObat: 'Omeprazole, Antasida', rujukRS: 'Tidak', namaRS: '-' },
  { tanggal: '12/01/2026', nik: '241104497', nama: 'Alpiannor', departemen: 'HT', site: 'Bontang', diagnosa: 'Alergi', jenisObat: 'CTM, Loratadine', rujukRS: 'Tidak', namaRS: '-' },
];

export default function DataKunjunganTable() {
  const [siteFilter, setSiteFilter] = useState('All Site');
  const [monthFilter, setMonthFilter] = useState('Semua');
  const [yearFilter, setYearFilter] = useState('2026');

  const filteredRows = useMemo(() => {
    return PLACEHOLDER_ROWS.filter(r => {
      if (siteFilter !== 'All Site' && r.site !== siteFilter) return false;
      return true;
    });
  }, [siteFilter, monthFilter, yearFilter]);

  const rujukCount = filteredRows.filter(r => r.rujukRS === 'Ya').length;

  return (
    <div className="raw-table-container" style={{ position: 'absolute', inset: 0 }}>
      {/* Header Bar */}
      <div className="raw-table-header-bar">
        <span style={{ fontWeight: 700 }}>Data Kunjungan Berobat</span>
        <span style={{ color: 'var(--muted-foreground)' }}>
          {filteredRows.length} kunjungan
          <span style={{ margin: '0 6px', opacity: 0.3 }}>|</span>
          {rujukCount} rujuk RS
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
                    const isRujuk = col.key === 'rujukRS';
                    return (
                      <td key={col.key} style={{
                        fontWeight: isRujuk ? 600 : 400,
                        color: isRujuk && val === 'Ya' ? '#ff4d00' : undefined,
                      }}>
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
