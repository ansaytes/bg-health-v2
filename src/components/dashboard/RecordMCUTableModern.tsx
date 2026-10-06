'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, Eye, Pin, SlidersHorizontal, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { preloadMCUDashboardData } from '@/components/dashboard/MCUDashboardShared';
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
  const { isSuperuser, isAdmin } = useAuth();
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
  const [frozenColumnsMonitor, setFrozenColumnsMonitor] = useState<string[]>(['nik_karyawan', 'nama']);
  const [showFrozenPicker, setShowFrozenPicker] = useState(false);
  const [editingRow, setEditingRow] = useState<RecordRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<'record' | 'monitor'>('record');
  const [monitorRows, setMonitorRows] = useState<RecordRow[]>([]);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorSearch, setMonitorSearch] = useState('');
  const [monitorPage, setMonitorPage] = useState(1);
  // Column filters: map of column key → filter value string
  const [monitorFilters, setMonitorFilters] = useState<Record<string, string>>({});
  const [showMonitorFilters, setShowMonitorFilters] = useState(false);
  const [recordFilters, setRecordFilters] = useState<Record<string, string>>({});
  const [showRecordFilters, setShowRecordFilters] = useState(false);

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

  const handleEdit = (row: RecordRow) => setEditingRow({ ...row });
  const saveEdit = async () => {
    if (!editingRow) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const formData: Record<string, string> = { id: String(editingRow.id) };
      MCU_FIELDS.forEach(field => {
        const key = field.id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase();
        formData[field.id] = editingRow[key] == null ? '' : String(editingRow[key]);
      });
      const response = await fetch('/api/mcu/save', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) }, body: JSON.stringify({ formData }) });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Gagal menyimpan perubahan');
      setEditingRow(null);
      store.showToast('Data MCU berhasil diperbarui', 'success');
      await load();
    } catch (err) { store.showToast(err instanceof Error ? err.message : 'Gagal menyimpan perubahan', 'error'); }
    finally { setSaving(false); }
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

  const loadMonitor = async () => {
    setMonitorLoading(true);
    try {
      // Use the shared module-level cache from MCUDashboardShared.
      // If charts on the same page already fetched the data, this costs zero
      // extra API calls. If not, it fires one request and populates the cache
      // for any other component that needs it.
      const rows = await preloadMCUDashboardData();
      setMonitorRows(rows as RecordRow[]);
    } catch (err) {
      store.showToast(err instanceof Error ? err.message : 'Gagal memuat monitor', 'error');
    } finally {
      setMonitorLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'monitor' && monitorRows.length === 0) {
      loadMonitor();
    }
  }, [activeTab]);

  const EXCLUDED_COLUMNS = useMemo(() => new Set([
    'id',
    'created_at',
    'updated_at',
    'nik_karyawan_hash',
    'national_id_hash',
    'national_id',
    'nationalid',
  ]), []);

  const COLUMN_WIDTHS: Record<string, number> = useMemo(() => ({
    // --- record MCU columns ---
    nik_karyawan: 130,
    nama: 180,
    usia: 55,
    jenis_kelamin: 95,
    jabatan: 140,
    site: 110,
    status_mcu: 115,
    tgl_mcu: 95,
    tempat_mcu: 135,
    gol_darah: 80,
    gigi_mulut: 150,
    fisik_head_to_toe: 150,
    hemoroid: 90,
    visus_jauh: 90,
    visus_dekat: 90,
    def_warna: 95,
    lapang_pandang: 110,
    fisik_mata: 130,
    merokok: 80,
    td_s: 70,
    td_d: 70,
    nadi: 70,
    bb: 65,
    tb: 65,
    bmi: 70,
    lp: 70,
    hb: 70,
    leukosit: 80,
    eritrosit: 80,
    hematokrit: 80,
    trombosit: 85,
    mcv: 70,
    mch: 70,
    mchc: 70,
    led: 70,
    chol: 75,
    tg: 75,
    hdl: 75,
    ldl: 75,
    gdp: 75,
    gd2pp: 75,
    hba1c: 75,
    diabetes: 80,
    au: 70,
    ureum: 75,
    kreatinin: 75,
    egfr: 75,
    sgot: 70,
    sgpt: 70,
    ggt: 70,
    alp: 70,
    billirubin: 75,
    ul: 100,
    zonasi: 95,
    kes_vendor: 120,
    perlu_fu: 80,
    link_mcu: 90,
    // --- monitor MCU columns ---
    area_raw: 80,
    client: 120,
    total_mcu: 80,
    mcu_terakhir: 115,
    masa_berlaku_mcu: 130,
    kategori_mcu_terakhir: 140,
    hasil_mcu: 120,
    diagnosa: 200,
    fram_score: 95,
    fram_prob: 95,
    frs_kategori: 115,
    zona_risiko: 95,
    rekomendasi_fu: 200,
    item_fu: 200,
    status_follow_up: 120,
    jadwal_mcu_selanjutnya: 145,
  }), []);

  const getColWidth = (key: string): number => COLUMN_WIDTHS[key] || 110;

  const recordColumns = useMemo(() => MCU_FIELDS
    .map(field => ({
      key: field.id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase(),
      label: field.id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase(),
    }))
    .filter(col => !EXCLUDED_COLUMNS.has(col.key)), [EXCLUDED_COLUMNS]);

  const monitorColumns = useMemo(() => [
    { key: 'nik_karyawan', label: 'nik_karyawan' },
    { key: 'nama', label: 'nama' },
    { key: 'site', label: 'site' },
    { key: 'area_raw', label: 'area' },
    { key: 'client', label: 'client' },
    { key: 'jabatan', label: 'jabatan' },
    { key: 'total_mcu', label: 'total_mcu' },
    { key: 'mcu_terakhir', label: 'tgl_mcu_terakhir' },
    { key: 'masa_berlaku_mcu', label: 'masa_berlaku_mcu' },
    { key: 'kategori_mcu_terakhir', label: 'kategori_mcu' },
    { key: 'hasil_mcu', label: 'kes_vendor' },
    { key: 'zona_risiko', label: 'zonasi' },
    { key: 'diagnosa', label: 'diagnosa_medis' },
    { key: 'fram_score', label: 'fram_score' },
    { key: 'fram_prob', label: 'fram_prob' },
    { key: 'frs_kategori', label: 'frs_kategori' },
    { key: 'perlu_fu', label: 'perlu_fu' },
    { key: 'rekomendasi_fu', label: 'rekomendasi_fu' },
    { key: 'item_fu', label: 'item_fu' },
    { key: 'status_mcu', label: 'status_mcu' },
    { key: 'status_follow_up', label: 'status_fu' },
    { key: 'jadwal_mcu_selanjutnya', label: 'jadwal_mcu_selanjutnya' },
  ], []);

  const columns = activeTab === 'record' ? recordColumns : monitorColumns;
  const activeFrozenColumns = activeTab === 'record' ? frozenColumns : frozenColumnsMonitor;
  const setActiveFrozenColumns = activeTab === 'record' ? setFrozenColumns : setFrozenColumnsMonitor;

  const frozenOffsets = useMemo(() => {
    let offset = 48; // index column width
    const offsets: Record<string, number> = {};
    for (const col of columns) {
      if (activeFrozenColumns.includes(col.key)) {
        offsets[col.key] = offset;
        offset += getColWidth(col.key);
      }
    }
    return offsets;
  }, [columns, activeFrozenColumns, COLUMN_WIDTHS]);

  const toggleFrozenColumn = (key: string) => {
    setActiveFrozenColumns(current => current.includes(key)
      ? current.filter(column => column !== key)
      : [...current, key]);
  };

  const filteredMonitorRows = useMemo(() => {
    let result = monitorRows;
    if (monitorSearch.trim()) {
      const lower = monitorSearch.toLowerCase();
      result = result.filter(r =>
        String(r.nik_karyawan || '').toLowerCase().includes(lower) ||
        String(r.nama || '').toLowerCase().includes(lower)
      );
    }
    for (const [key, value] of Object.entries(monitorFilters)) {
      if (!value.trim()) continue;
      const lower = value.trim().toLowerCase();
      result = result.filter(r => String(r[key] || '').toLowerCase().includes(lower));
    }
    return result;
  }, [monitorRows, monitorSearch, monitorFilters]);

  // Derive unique values for enum-like monitor columns (for <select> filter options)
  const monitorFilterOptions = useMemo(() => {
    const enumCols = ['site', 'area_raw', 'client', 'jabatan', 'zona_risiko', 'status_mcu', 'status_follow_up', 'hasil_mcu', 'kategori_mcu_terakhir', 'frs_kategori'];
    const opts: Record<string, string[]> = {};
    for (const col of enumCols) {
      const vals = [...new Set(monitorRows.map(r => String(r[col] || '')).filter(Boolean))].sort();
      if (vals.length > 0) opts[col] = vals;
    }
    return opts;
  }, [monitorRows]);

  // Columns available for filtering on the Record tab (subset — server-side paginated)
  const recordFilterCols = useMemo(() => [
    { key: 'site', label: 'site' },
    { key: 'jabatan', label: 'jabatan' },
    { key: 'zonasi', label: 'zonasi' },
    { key: 'kes_vendor', label: 'kes_vendor' },
    { key: 'status_mcu', label: 'status_mcu' },
    { key: 'perlu_fu', label: 'perlu_fu' },
  ], []);

  // Client-side record filter (applies to current page only — full server filter would need API extension)
  const filteredRecordRows = useMemo(() => {
    if (Object.values(recordFilters).every(v => !v.trim())) return rows;
    return rows.filter(row => {
      for (const [key, value] of Object.entries(recordFilters)) {
        if (!value.trim()) continue;
        if (!String(row[key] || '').toLowerCase().includes(value.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, recordFilters]);

  const pagedMonitorRows = useMemo(() => filteredMonitorRows.slice((monitorPage - 1) * 100, monitorPage * 100), [filteredMonitorRows, monitorPage]);
  const monitorTotalPages = Math.max(1, Math.ceil(filteredMonitorRows.length / 100));

  const displayRows = activeTab === 'record' ? filteredRecordRows : pagedMonitorRows;
  const displayTotal = activeTab === 'record' ? total : filteredMonitorRows.length;
  const displayPage = activeTab === 'record' ? page : monitorPage;
  const displayTotalPages = activeTab === 'record' ? totalPages : monitorTotalPages;
  const displayLoading = activeTab === 'record' ? loading : monitorLoading;
  const activeFilters = activeTab === 'record' ? recordFilters : monitorFilters;
  const setActiveFilters = activeTab === 'record' ? setRecordFilters : setMonitorFilters;
  const showFilters = activeTab === 'record' ? showRecordFilters : showMonitorFilters;
  const setShowFilters = activeTab === 'record' ? setShowRecordFilters : setShowMonitorFilters;
  const filterableCols = activeTab === 'record' ? recordFilterCols : monitorColumns;
  const activeFilterCount = Object.values(activeFilters).filter(v => v.trim()).length;

  return (
    <div className="mcu-records-modern">
      <div className="mcu-records-card">
        <div className="flex border-b border-gray-200 dark:border-gray-800 mb-4">
          <button className={`px-4 py-3 text-sm font-medium border-b-2 ${activeTab === 'record' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('record')}>Record MCU</button>
          <button className={`px-4 py-3 text-sm font-medium border-b-2 ${activeTab === 'monitor' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('monitor')}>Tabel Monitor</button>
        </div>
        <div className="mcu-records-header">
          <div>
            <div className="mcu-records-kicker">DATABASE MCU</div>
            <h3>{activeTab === 'record' ? 'Tabel Record MCU Karyawan' : 'Tabel Monitor MCU (View)'}</h3>
          </div>
          <div className="mcu-records-actions">
            <div className="mcu-records-search">
              <Search size={14} />
              <input aria-label="Cari record MCU" placeholder={activeTab === 'record' ? "Cari NIK Karyawan..." : "Cari NIK atau Nama..."} value={activeTab === 'record' ? search : monitorSearch} onChange={e => { activeTab === 'record' ? (setSearch(e.target.value), setPage(1)) : (setMonitorSearch(e.target.value), setMonitorPage(1)); }} />
            </div>
            <div className="mcu-records-count">{displayTotal} record</div>
          </div>
        </div>

        <div className="mcu-records-toolbar">
          <div className="mcu-records-toolbar-title"><Pin size={14} /> Bekukan kolom</div>
          <div className="mcu-frozen-picker-wrap">
            <button type="button" className={`mcu-frozen-picker-button${showFrozenPicker ? ' is-open' : ''}`} onClick={() => setShowFrozenPicker(current => !current)} aria-expanded={showFrozenPicker}>
              <SlidersHorizontal size={14} /> {activeFrozenColumns.length ? `${activeFrozenColumns.length} kolom dipilih` : 'Pilih kolom'} 
            </button>
            {showFrozenPicker && (
              <div className="mcu-frozen-picker" role="group" aria-label="Pilih kolom frozen">
                {columns.map(column => (
                  <label key={column.key}>
                    <input type="checkbox" checked={activeFrozenColumns.includes(column.key)} onChange={() => toggleFrozenColumn(column.key)} />
                    <span>{column.label}</span>
                  </label>
                ))}
                <button type="button" className="mcu-frozen-reset" onClick={() => setActiveFrozenColumns([])}>Lepas semua</button>
              </div>
            )}
          </div>
          <span className="mcu-records-hint">Kolom terpilih tetap terlihat saat tabel digeser horizontal.</span>
        </div>

        {/* Column Filter Panel */}
        <div className="mcu-records-toolbar" style={{ alignItems: 'flex-start', gap: 8 }}>
          <div className="mcu-records-toolbar-title" style={{ paddingTop: 2 }}><SlidersHorizontal size={14} /> Filter kolom</div>
          <button
            type="button"
            className={`mcu-frozen-picker-button${showFilters ? ' is-open' : ''}`}
            onClick={() => setShowFilters(v => !v)}
            aria-expanded={showFilters}
          >
            <Search size={14} />
            {activeFilterCount > 0 ? `${activeFilterCount} filter aktif` : 'Tambah filter'}
          </button>
          {activeFilterCount > 0 && (
            <button type="button" className="mcu-frozen-reset" style={{ marginLeft: 4, fontSize: 11 }} onClick={() => setActiveFilters({})}>
              Hapus semua filter
            </button>
          )}
          {showFilters && (
            <div className="mcu-frozen-picker" role="group" aria-label="Filter kolom" style={{ minWidth: 320, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {filterableCols.map(col => {
                const enumOpts = activeTab === 'monitor' ? (monitorFilterOptions[col.key] || null) : null;
                return (
                  <label key={col.key} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 140 }}>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{col.label}</span>
                    {enumOpts ? (
                      <select
                        className="admin-input"
                        style={{ fontSize: 12, padding: '2px 6px', height: 28 }}
                        value={activeFilters[col.key] || ''}
                        onChange={e => {
                          setActiveFilters(prev => ({ ...prev, [col.key]: e.target.value }));
                          if (activeTab === 'monitor') setMonitorPage(1);
                        }}
                      >
                        <option value="">Semua</option>
                        {enumOpts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <input
                        className="admin-input"
                        style={{ fontSize: 12, padding: '2px 6px', height: 28, minWidth: 120 }}
                        type="text"
                        placeholder={`Filter ${col.label}...`}
                        value={activeFilters[col.key] || ''}
                        onChange={e => {
                          setActiveFilters(prev => ({ ...prev, [col.key]: e.target.value }));
                          if (activeTab === 'monitor') setMonitorPage(1);
                        }}
                      />
                    )}
                  </label>
                );
              })}
            </div>
          )}
          {activeTab === 'record' && activeFilterCount > 0 && (
            <span className="mcu-records-hint" style={{ color: 'var(--color-warning, #d97706)' }}>
              Filter berlaku pada halaman saat ini saja. Gunakan fitur search NIK untuk pencarian lintas halaman.
            </span>
          )}
        </div>

        <div className="mcu-records-table-wrap">
          <table className="mcu-records-table">
            <thead>
              <tr>
                <th className="mcu-records-index">#</th>
                {columns.map(c => {
                  const isFrozen = activeFrozenColumns.includes(c.key);
                  const w = getColWidth(c.key);
                  const style: React.CSSProperties = {
                    width: `${w}px`,
                    minWidth: `${w}px`,
                    maxWidth: `${Math.max(w, 160)}px`,
                    ...(isFrozen ? { left: `${frozenOffsets[c.key]}px` } : {}),
                  };
                  return (
                    <th key={c.key} className={isFrozen ? 'is-frozen' : ''} style={style}>
                      {c.label}{isFrozen && <Pin size={12} />}
                    </th>
                  );
                })}
                <th className="mcu-records-action-head">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {displayLoading ? (
                <tr>
                  <td colSpan={columns.length + 2} style={{ padding: 40, textAlign: 'center' }}>
                    <div className="bm-loading is-inline" role="status" aria-live="polite" aria-label="Memuat data">
                      <div className="bm-loading-spinner">
                        <div className="bm-loading-ring" aria-hidden="true" />
                        <img src="/BM.png" alt="" className="bm-loading-logo" aria-hidden="true" />
                      </div>
                    </div>
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr><td colSpan={columns.length + 2} style={{ padding: 36, textAlign: 'center' }}>Belum ada data.</td></tr>
              ) : displayRows.map((row, idx) => {
                const id = String(row.id || `${displayPage}-${idx}`);
                const isExp = !!expanded[id];
                return (
                  <Fragment key={id}>
                    <tr className={activeTab === 'record' ? `mcu-zone-${String(row.zonasi || 'belum-lengkap').toLowerCase().replace(/\s+/g, '-')}` : `mcu-zone-${String(row.zona_risiko || 'belum-lengkap').toLowerCase().replace(/\s+/g, '-')}`}>
                      <td className="mcu-records-index">{(displayPage - 1) * 100 + idx + 1}</td>
                      {columns.map(c => {
                        const isFrozen = activeFrozenColumns.includes(c.key);
                        const w = getColWidth(c.key);
                        const style: React.CSSProperties = {
                          width: `${w}px`,
                          minWidth: `${w}px`,
                          maxWidth: `${Math.max(w, 160)}px`,
                          ...(isFrozen ? { left: `${frozenOffsets[c.key]}px` } : {}),
                        };
                        return (
                          <td key={c.key} className={isFrozen ? 'is-frozen' : ''} style={style} title={short(row[c.key])}>
                            {c.key === 'link_mcu' && row[c.key] ? (
                              <a href={String(row[c.key])} target="_blank" rel="noreferrer" className="mcu-record-link">Buka link</a>
                            ) : short(row[c.key])}
                          </td>
                        );
                      })}
                      <td className="mcu-records-action" style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <Button size="sm" variant="ghost" onClick={() => setExpanded(s => ({ ...s, [id]: !s[id] }))} title={isExp ? 'Tutup detail' : 'Lihat detail'}><Eye size={14} /></Button>
                        {activeTab === 'record' && (isSuperuser || isAdmin) && (
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
                            <pre>{JSON.stringify(Object.fromEntries(Object.entries(row).filter(([key]) => !EXCLUDED_COLUMNS.has(key))), null, 2)}</pre>
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

        {displayTotalPages > 1 && (
          <div className="mcu-records-pagination">
            <Button size="sm" variant="outline" disabled={displayPage === 1} onClick={() => activeTab === 'record' ? setPage(p => p - 1) : setMonitorPage(p => p - 1)}><ChevronLeft size={14} /> Sebelumnya</Button>
            <div>Halaman {displayPage} / {displayTotalPages}</div>
            <Button size="sm" variant="outline" disabled={displayPage >= displayTotalPages} onClick={() => activeTab === 'record' ? setPage(p => p + 1) : setMonitorPage(p => p + 1)}>Berikutnya <ChevronRight size={14} /></Button>
          </div>
        )}
        <Dialog open={!!editingRow} onOpenChange={open => !open && setEditingRow(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Edit MCU</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {MCU_FIELDS.map(field => {
                const key = field.id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase();
                return <label key={field.id} className="text-xs font-medium"><span>{field.label}</span><input className="admin-input w-full mt-1" value={editingRow?.[key] == null ? '' : String(editingRow[key])} onChange={event => setEditingRow(current => current ? { ...current, [key]: event.target.value } : current)} /></label>;
              })}
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditingRow(null)}>Batal</Button><Button onClick={saveEdit} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</Button></div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
