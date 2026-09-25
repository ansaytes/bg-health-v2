'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { MCU_FIELDS } from '@/lib/mcu-fields';

type RecordRow = Record<string, string | number | null>;

function displayValue(value: RecordRow[string]) {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

export default function RecordMCUTable() {
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const params = new URLSearchParams({ page: String(page) });
      if (search.trim()) params.set('search', search.trim());
      const response = await fetch(`/api/mcu/records?${params.toString()}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Gagal memuat record MCU');
      setRows(json.records || []);
      setTotal(json.total || 0);
      setTotalPages(json.totalPages || 0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gagal memuat record MCU');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 250);
    return () => window.clearTimeout(timer);
  }, [page, search]);

  const columns = useMemo(() => MCU_FIELDS.map(field => ({
    key: field.id,
    label: field.label,
  })), []);

  return (
    <div className="raw-table-container mcu-records-page">
      <div className="mcu-records-header">
        <div>
          <h2>Record MCU</h2>
        </div>
        <span>{total} record</span>
      </div>
      <div className="mcu-records-search"><Search size={16} /><input aria-label="Cari record MCU" placeholder="Cari NIK Karyawan atau NIK KTP..." value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></div>
      {error && <div className="admin-alert">{error}</div>}
      <div className="raw-table-scroll mcu-records-scroll">
        <table>
          <thead><tr><th>No</th>{columns.map(column => <th key={column.key}>{column.label}</th>)}</tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={columns.length + 1} className="mcu-empty-state">Memuat record MCU...</td></tr>
              : rows.length === 0 ? <tr><td colSpan={columns.length + 1} className="mcu-empty-state">Belum ada record MCU.</td></tr>
              : rows.map((row, index) => <tr key={String(row.id || `${page}-${index}`)}>
                <td>{(page - 1) * 100 + index + 1}</td>
                {columns.map(column => <td key={column.key} title={displayValue(row[column.key])}>{displayValue(row[column.key])}</td>)}
              </tr>)}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && <div className="mcu-records-pagination">
        <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(current => current - 1)}><ChevronLeft size={14} /> Sebelumnya</Button>
        <span>Halaman {page} / {totalPages}</span>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(current => current + 1)}>Berikutnya <ChevronRight size={14} /></Button>
      </div>}
    </div>
  );
}
