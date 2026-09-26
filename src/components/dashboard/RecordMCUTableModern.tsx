'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, Eye, Pin, SlidersHorizontal, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { MCU_FIELDS } from '@/lib/mcu-fields';
import { useAuth } from '@/lib/auth-context';
import { useMCUStore } from '@/lib/store';

type RecordRow = Record<string, any>;

function short(val: any) {
  if (val == null || val === '') return '-';
  return String(val);
}

export default function RecordMCUTableModern() {
  const { isSuperuser } = useAuth();
  const store = useMCUStore();
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [frozenColumns, setFrozenColumns] = useState<string[]>(['nik_karyawan', 'nama']);
  const [showFrozenPicker, setShowFrozenPicker] = useState(false);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus data MCU untuk ${name}?`)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/mcu/records/${id}`, {
        method: 'DELETE',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menghapus data');
      store.showToast('Data MCU berhasil dihapus', 'success');
      load();
    } catch (err) {
      store.showToast(err instanceof Error ? err.message : 'Gagal menghapus data', 'error');
    }
  };

  const handleEdit = (row: RecordRow) => {
    // Navigate to Review MCU and trigger recall by filling NIK
    // We can do this by setting store states
    store.setReviewStep('form');
    // But we need the decrypted data for the form.
    // We can just alert for now, or fetch the full record.
    alert('Untuk mengedit, silakan ke halaman Data Entry > Review MCU dan masukkan NIK Karyawan ini: ' + row.nik_karyawan);
  };

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat record MCU');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = window.setTimeout(() => { void load(); }, 180);
    return () => window.clearTimeout(t);
  }, [page, search]);

  const columns = useMemo(() => [
    { key: 'id', label: 'id' },
    { key: 'created_at', label: 'created_at' },
    { key: 'updated_at', label: 'updated_at' },
    ...MCU_FIELDS.filter(field => field.id !== 'nationalId').map(field => ({
      key: field.id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase(),
      label: field.id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase(),
    })),
    { key: 'nik_karyawan_hash', label: 'nik_karyawan_hash' },
  ], []);
  const frozenOffsets = useMemo(() => {
    const widths: Record<string, number> = { id: 180, created_at: 170, updated_at: 170, nik_karyawan: 150, nama: 210, site: 150, jabatan: 190, tgl_mcu: 150, status_mcu: 150, nik_karyawan_hash: 270 };
    let offset = 48;
    return Object.fromEntries(columns.filter(column => frozenColumns.includes(column.key)).map(({ key }) => {
      const value = [key, offset];
      offset += widths[key] || 150;
      return value;
    }));
  }, [frozenColumns]);
  const toggleFrozenColumn = (key: string) => {
    setFrozenColumns(current => current.includes(key)
      ? current.filter(column => column !== key)
      : [...current, key]);
  };

  return (
    <div className="mcu-records-modern">
      <div className="mcu-records-card">
        <div className="mcu-records-header">
          <div>
            <div className="mcu-records-kicker">DATABASE MCU</div>
            <h3>DATABASE</h3>
          </div>
          <div className="mcu-records-actions">
            <div className="mcu-records-search">
              <Search size={14} />
              <input aria-label="Cari record MCU" placeholder="Cari NIK Karyawan..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <div className="mcu-records-count">{total} record</div>
          </div>
        </div>

        <div className="mcu-records-toolbar">
          <div className="mcu-records-toolbar-title"><Pin size={14} /> Bekukan kolom</div>
          <div className="mcu-frozen-picker-wrap">
            <button type="button" className={`mcu-frozen-picker-button${showFrozenPicker ? ' is-open' : ''}`} onClick={() => setShowFrozenPicker(current => !current)} aria-expanded={showFrozenPicker}>
              <SlidersHorizontal size={14} /> {frozenColumns.length ? `${frozenColumns.length} kolom dipilih` : 'Pilih kolom'} 
            </button>
            {showFrozenPicker && (
              <div className="mcu-frozen-picker" role="group" aria-label="Pilih kolom frozen">
                {columns.map(column => (
                  <label key={column.key}>
                    <input type="checkbox" checked={frozenColumns.includes(column.key)} onChange={() => toggleFrozenColumn(column.key)} />
                    <span>{column.label}</span>
                  </label>
                ))}
                <button type="button" className="mcu-frozen-reset" onClick={() => setFrozenColumns([])}>Lepas semua</button>
              </div>
            )}
          </div>
          <span className="mcu-records-hint">Kolom terpilih tetap terlihat saat tabel digeser horizontal.</span>
        </div>

        <div className="mcu-records-table-wrap">
          <table className="mcu-records-table">
            <thead>
              <tr>
                <th className="mcu-records-index">#</th>
                {columns.map(c => <th key={c.key} className={frozenColumns.includes(c.key) ? 'is-frozen' : ''} style={frozenColumns.includes(c.key) ? { left: frozenOffsets[c.key] } : undefined}>{c.label}{frozenColumns.includes(c.key) && <Pin size={12} />}</th>)}
                <th className="mcu-records-action-head">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length + 2} style={{ padding: 40, textAlign: 'center' }}>Memuat record MCU...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={columns.length + 2} style={{ padding: 36, textAlign: 'center' }}>Belum ada record MCU.</td></tr>
              ) : rows.map((row, idx) => {
                const id = String(row.id || `${page}-${idx}`);
                const isExp = !!expanded[id];
                return (
                  <Fragment key={id}>
                    <tr>
                      <td className="mcu-records-index">{(page - 1) * 100 + idx + 1}</td>
                      {columns.map(c => <td key={c.key} className={frozenColumns.includes(c.key) ? 'is-frozen' : ''} style={frozenColumns.includes(c.key) ? { left: frozenOffsets[c.key] } : undefined} title={short(row[c.key])}>{short(row[c.key])}</td>)}
                      <td className="mcu-records-action" style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <Button size="sm" variant="ghost" onClick={() => setExpanded(s => ({ ...s, [id]: !s[id] }))} title={isExp ? 'Tutup detail' : 'Lihat detail'}><Eye size={14} /></Button>
                        {isSuperuser && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(row)} title="Edit data"><Edit size={14} /></Button>
                            <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => handleDelete(String(row.id), row.nama)} title="Hapus data"><Trash2 size={14} /></Button>
                          </>
                        )}
                      </td>
                    </tr>
                    {isExp && (
                      <tr>
                        <td colSpan={columns.length + 2} className="mcu-records-detail-cell">
                          <div className="mcu-records-detail">
                            <pre>{JSON.stringify(Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'national_id')), null, 2)}</pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mcu-records-pagination">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /> Sebelumnya</Button>
            <div>Halaman {page} / {totalPages}</div>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Berikutnya <ChevronRight size={14} /></Button>
          </div>
        )}
      </div>
    </div>
  );
}
