'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CalendarDays, ChevronLeft, ChevronRight, Search, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

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
  const { session } = useAuth();
  const [rows, setRows] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'filled' | 'empty'>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'nama', direction: 'asc' });

  const getAuthHeaders = async (): Promise<HeadersInit> => {
    const accessToken = session?.access_token || (await supabase.auth.getSession()).data.session?.access_token;
    return accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : {};
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (query.trim()) params.set('search', query.trim());
      if (siteFilter) params.set('site', siteFilter);
      if (departmentFilter.trim()) params.set('department', departmentFilter.trim());
      const response = await fetch(`/api/mcu/schedule?${params.toString()}`, { headers: await getAuthHeaders() });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Gagal memuat data karyawan');
      setRows(json.schedules || []);
      setTotal(json.total || 0);
      setTotalPages(json.totalPages || 0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal memuat data karyawan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 250);
    return () => window.clearTimeout(timer);
  }, [page, query, siteFilter, departmentFilter]);

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
        headers: { 'Content-Type': 'application/json', ...await getAuthHeaders() },
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
    return rows
      .filter(row => scheduleFilter === 'all' || (scheduleFilter === 'filled' ? Boolean(row.tanggal_jadwal) : !row.tanggal_jadwal))
      .sort((a, b) => {
        const left = String(a[sort.key] || '');
        const right = String(b[sort.key] || '');
        return left.localeCompare(right, 'id', { numeric: true }) * (sort.direction === 'asc' ? 1 : -1);
      });
  }, [rows, scheduleFilter, sort]);

  const siteOptions = Array.from(new Set(rows.map(row => row.site).filter(Boolean))).sort();
  const departmentOptions = Array.from(new Set(rows.map(row => row.department).filter(Boolean) as string[])).sort();

  const resetFilters = () => {
    setQuery('');
    setSiteFilter('');
    setDepartmentFilter('');
    setScheduleFilter('all');
    setPage(1);
  };

  const changePage = (nextPage: number) => {
    if (nextPage < 1 || (totalPages > 0 && nextPage > totalPages)) return;
    setPage(nextPage);
  };

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
        <div className="mcu-entry-search"><Search size={16} /><input aria-label="Cari karyawan" placeholder="Cari nama, site, departemen..." value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></div>
        <select className="mcu-entry-filter" aria-label="Filter site" value={siteFilter} onChange={event => { setSiteFilter(event.target.value); setPage(1); }}>
          <option value="">Semua Site</option>
          {siteOptions.map(site => <option key={site} value={site}>{site}</option>)}
        </select>
        <select className="mcu-entry-filter" aria-label="Filter departemen" value={departmentFilter} onChange={event => { setDepartmentFilter(event.target.value); setPage(1); }}>
          <option value="">Semua Departemen</option>
          {departmentOptions.map(department => <option key={department} value={department}>{department}</option>)}
        </select>
        <select className="mcu-entry-filter" aria-label="Filter status jadwal" value={scheduleFilter} onChange={event => setScheduleFilter(event.target.value as typeof scheduleFilter)}>
          <option value="all">Semua Jadwal</option>
          <option value="filled">Sudah Dijadwalkan</option>
          <option value="empty">Belum Dijadwalkan</option>
        </select>
        {(query || siteFilter || departmentFilter || scheduleFilter !== 'all') && <button type="button" className="mcu-filter-reset" onClick={resetFilters}>Reset</button>}
        <span className="mcu-entry-count">{visibleRows.length} dari {total} karyawan | Halaman {page} dari {totalPages || 1}</span>
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
      {totalPages > 1 && (
        <div className="mcu-entry-pagination">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => changePage(page - 1)}><ChevronLeft size={14} /> Sebelumnya</Button>
          <span>Halaman {page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => changePage(page + 1)}>Berikutnya <ChevronRight size={14} /></Button>
        </div>
      )}
    </div>
  );
}
