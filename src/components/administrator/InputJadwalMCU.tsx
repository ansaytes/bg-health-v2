'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CalendarDays, Search, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Schedule = {
  id: string | null;
  nik_karyawan: string;
  nama: string;
  site: string;
  department?: string | null;
  jabatan?: string | null;
  tanggal_mcu_terakhir?: string | null;
  tanggal_jadwal: string;
  history?: string[];
  jenis_kelamin?: string | null;
  usia?: number | null;
  national_id?: string | null;
};

type SortKey = 'nik_karyawan' | 'nama' | 'site' | 'department' | 'jabatan' | 'tanggal_mcu_terakhir' | 'tanggal_jadwal';

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('id-ID');
}

export default function InputJadwalMCU() {
  const [rows, setRows] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'nama', direction: 'asc' });

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/mcu/schedule');
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Gagal memuat data karyawan');
      setRows(json.schedules || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal memuat data karyawan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const updateDate = (nik: string, value: string) => {
    setRows(current => current.map(row => row.nik_karyawan === nik ? { ...row, tanggal_jadwal: value } : row));
  };

  const save = async (row: Schedule) => {
    if (!row.tanggal_jadwal) {
      setMessage(`Tanggal jadwal untuk ${row.nama} wajib diisi`);
      return;
    }
    setSaving(row.nik_karyawan);
    setMessage('');
    try {
      const response = await fetch('/api/mcu/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: row.id,
          nikKaryawan: row.nik_karyawan,
          nationalId: row.national_id,
          nama: row.nama,
          jenisKelamin: row.jenis_kelamin,
          usia: row.usia,
          jabatan: row.jabatan,
          site: row.site,
          tanggalJadwal: row.tanggal_jadwal,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Gagal menyimpan jadwal');
      setMessage(`Jadwal ${row.nama} berhasil disimpan`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan jadwal');
    } finally {
      setSaving(null);
    }
  };

  const changeSort = (key: SortKey) => {
    setSort(current => current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: 'asc' });
  };

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows
      .filter(row => !needle || [row.nik_karyawan, row.nama, row.site, row.department, row.jabatan]
        .some(value => String(value || '').toLowerCase().includes(needle)))
      .sort((a, b) => {
        const left = String(a[sort.key] || '');
        const right = String(b[sort.key] || '');
        return left.localeCompare(right, 'id', { numeric: true }) * (sort.direction === 'asc' ? 1 : -1);
      });
  }, [rows, query, sort]);

  const header = (key: SortKey, label: string) => (
    <th>
      <button type="button" className="mcu-sort-button" onClick={() => changeSort(key)}>
        {label}
        {sort.key === key && (sort.direction === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
      </button>
    </th>
  );

  return (
    <div className="admin-form-container mcu-entry-page">
      <div className="admin-form-header">
        <div>
          <h2><CalendarDays size={20} /> Input Jadwal MCU</h2>
          <p>Atur jadwal MCU berikutnya untuk karyawan sesuai kewenangan site Anda.</p>
        </div>
      </div>
      {message && <div className="admin-alert">{message}</div>}
      <div className="mcu-entry-toolbar">
        <div className="mcu-entry-search"><Search size={16} /><input aria-label="Cari karyawan" placeholder="Cari NIK, nama, site, departemen..." value={query} onChange={event => setQuery(event.target.value)} /></div>
        <span className="mcu-entry-count">{visibleRows.length} dari {rows.length} karyawan</span>
      </div>
      <div className="raw-table-scroll mcu-entry-table">
        <table>
          <thead><tr>
            <th>No</th>{header('nik_karyawan', 'NIK Karyawan')}{header('nama', 'Nama')}{header('site', 'Site')}{header('department', 'Departemen')}{header('jabatan', 'Jabatan')}{header('tanggal_mcu_terakhir', 'MCU Terakhir')}{header('tanggal_jadwal', 'Jadwal MCU Berikutnya')}<th>Aksi</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={9} className="mcu-empty-state">Memuat data karyawan...</td></tr>
              : visibleRows.length === 0 ? <tr><td colSpan={9} className="mcu-empty-state">Tidak ada data karyawan.</td></tr>
              : visibleRows.map((row, index) => <tr key={row.nik_karyawan}>
                <td>{index + 1}</td><td className="mcu-nik">{row.nik_karyawan}</td><td className="mcu-name">{row.nama}</td><td>{row.site}</td><td>{row.department || '-'}</td><td>{row.jabatan || '-'}</td><td>{formatDate(row.tanggal_mcu_terakhir)}</td>
                <td><input className="admin-input mcu-date-input" type="date" value={row.tanggal_jadwal || ''} onChange={event => updateDate(row.nik_karyawan, event.target.value)} /></td>
                <td><Button size="sm" onClick={() => void save(row)} disabled={saving === row.nik_karyawan}><Save size={14} /> {saving === row.nik_karyawan ? '...' : 'Simpan'}</Button></td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
