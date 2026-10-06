'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, Eye, Pin, SlidersHorizontal, Edit, Trash2, ChevronDown, X } from 'lucide-react';
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

// ---------------------------------------------------------------------------
// Spreadsheet-style column filter dropdown
// ---------------------------------------------------------------------------
interface ColFilterDropdownProps {
  colKey: string;
  label: string;
  options: string[] | null; // null = free-text input
  value: string;
  onChange: (v: string) => void;
  anchorRef: React.RefObject<HTMLTableCellElement | null>;
}

function ColFilterDropdown({ colKey, label, options, value, onChange, anchorRef }: ColFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = useMemo(() => {
    if (!options) return null;
    if (!search.trim()) return options;
    return options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  const hasValue = value.trim() !== '';

  return (
    <div className="col-filter-wrap" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        className={`col-filter-btn${hasValue ? ' col-filter-btn--active' : ''}${open ? ' col-filter-btn--open' : ''}`}
        onClick={() => setOpen(v => !v)}
        title={hasValue ? `Filter: ${value}` : `Filter ${label}`}
        aria-label={`Filter ${label}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 2,
          padding: '1px 3px',
          marginLeft: 4,
          borderRadius: 3,
          border: hasValue ? '1px solid var(--primary, #0ea5e9)' : '1px solid transparent',
          background: hasValue ? 'rgba(14,165,233,0.10)' : 'transparent',
          color: hasValue ? 'var(--primary, #0ea5e9)' : 'inherit',
          cursor: 'pointer',
          fontSize: 10,
          lineHeight: 1,
          opacity: open ? 1 : 0.55,
          transition: 'opacity .15s, background .15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => { if (!hasValue && !open) e.currentTarget.style.opacity = '0.55'; }}
      >
        <ChevronDown size={10} strokeWidth={2.5} />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="col-filter-panel"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 1000,
            minWidth: 180,
            maxWidth: 260,
            background: 'var(--popover, #fff)',
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,.12)',
            padding: '6px 0',
            marginTop: 2,
          }}
        >
          {/* Search within options */}
          <div style={{ padding: '4px 8px 6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--border, #e5e7eb)', borderRadius: 4, padding: '3px 6px' }}>
              <Search size={11} style={{ opacity: 0.5, flexShrink: 0 }} />
              <input
                autoFocus
                type="text"
                value={options ? search : value}
                onChange={e => options ? setSearch(e.target.value) : onChange(e.target.value)}
                placeholder={options ? 'Cari...' : `Filter ${label}...`}
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, width: '100%' }}
              />
              {(options ? search : value) && (
                <button type="button" onClick={() => { options ? setSearch('') : onChange(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', opacity: 0.5 }}>
                  <X size={11} />
                </button>
              )}
            </div>
          </div>

          {options ? (
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {/* "Semua" option */}
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '5px 12px', fontSize: 12, cursor: 'pointer',
                  background: value === '' ? 'var(--accent, #f1f5f9)' : 'transparent',
                  border: 'none', fontStyle: 'italic', opacity: 0.7,
                }}
              >
                Semua
              </button>
              {(filtered || []).map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { onChange(opt); setOpen(false); setSearch(''); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '5px 12px', fontSize: 12, cursor: 'pointer',
                    background: value === opt ? 'var(--accent, #f1f5f9)' : 'transparent',
                    border: 'none', fontWeight: value === opt ? 600 : 400,
                    color: value === opt ? 'var(--primary, #0ea5e9)' : 'inherit',
                  }}
                >
                  {opt || '(kosong)'}
                </button>
              ))}
              {filtered && filtered.length === 0 && (
                <div style={{ padding: '6px 12px', fontSize: 11, opacity: 0.5 }}>Tidak ditemukan</div>
              )}
            </div>
          ) : (
            <div style={{ padding: '2px 8px 6px' }}>
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); }}
                style={{ fontSize: 11, color: 'var(--primary, #0ea5e9)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
              >
                Hapus filter
              </button>
            </div>
          )}

          {options && value && (
            <div style={{ borderTop: '1px solid var(--border, #e5e7eb)', padding: '4px 8px 2px' }}>
              <button
                type="button"
                onClick={() => { onChange(''); setSearch(''); setOpen(false); }}
                style={{ fontSize: 11, color: 'var(--primary, #0ea5e9)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
              >
                Hapus filter
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
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

  // Spreadsheet-style per-column filters
  const [monitorFilters, setMonitorFilters] = useState<Record<string, string>>({});
  const [recordFilters, setRecordFilters] = useState<Record<string, string>>({});

  // Refs for each th cell (used to position filter dropdowns)
  const thRefs = useRef<Record<string, React.RefObject<HTMLTableCellElement | null>>>({});
  const getThRef = (key: string) => {
    if (!thRefs.current[key]) thRefs.current[key] = { current: null };
    return thRefs.current[key] as React.RefObject<HTMLTableCellElement | null>;
  };

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
      const response = await fetch('/api/mcu/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ formData }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Gagal menyimpan perubahan');
      setEditingRow(null);
      store.showToast('Data MCU berhasil diperbarui', 'success');
      await load();
    } catch (err) {
      store.showToast(err instanceof Error ? err.message : 'Gagal menyimpan perubahan', 'error');
    } finally {
      setSaving(false);
    }
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
      const loadedRows = await preloadMCUDashboardData();
      setMonitorRows(loadedRows as RecordRow[]);
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
    'id', 'created_at', 'updated_at',
    'nik_karyawan_hash', 'national_id_hash', 'national_id', 'nationalid',
  ]), []);

  const COLUMN_WIDTHS: Record<string, number> = useMemo(() => ({
    // record MCU
    nik_karyawan: 130, nama: 180, usia: 55, jenis_kelamin: 95, jabatan: 140,
    site: 110, status_mcu: 115, tgl_mcu: 95, tempat_mcu: 135, gol_darah: 80,
    gigi_mulut: 150, fisik_head_to_toe: 150, hemoroid: 90, visus_jauh: 90,
    visus_dekat: 90, def_warna: 95, lapang_pandang: 110, fisik_mata: 130,
    merokok: 80, td_s: 70, td_d: 70, nadi: 70, bb: 65, tb: 65, bmi: 70,
    lp: 70, hb: 70, leukosit: 80, eritrosit: 80, hematokrit: 80, trombosit: 85,
    mcv: 70, mch: 70, mchc: 70, led: 70, chol: 75, tg: 75, hdl: 75, ldl: 75,
    gdp: 75, gd2pp: 75, hba1c: 75, diabetes: 80, au: 70, ureum: 75,
    kreatinin: 75, egfr: 75, sgot: 70, sgpt: 70, ggt: 70, alp: 70,
    billirubin: 75, ul: 100, zonasi: 95, kes_vendor: 120, perlu_fu: 80, link_mcu: 90,
    // monitor MCU
    area_raw: 80, client: 120, total_mcu: 80, mcu_terakhir: 115,
    masa_berlaku_mcu: 130, kategori_mcu_terakhir: 140, hasil_mcu: 120,
    diagnosa: 200, fram_score: 95, fram_prob: 95, frs_kategori: 115,
    zona_risiko: 95, rekomendasi_fu: 200, item_fu: 200,
    status_follow_up: 120, jadwal_mcu_selanjutnya: 145,
  }), []);

  const getColWidth = (key: string): number => COLUMN_WIDTHS[key] || 110;

  const recordColumns = useMemo(() => MCU_FIELDS
    .map(f => ({ key: f.id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase(), label: f.id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase() }))
    .filter(c => !EXCLUDED_COLUMNS.has(c.key)), [EXCLUDED_COLUMNS]);

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
  const activeFilters = activeTab === 'record' ? recordFilters : monitorFilters;
  const setActiveFilters = activeTab === 'record' ? setRecordFilters : setMonitorFilters;

  // Columns that get enum-style dropdowns (derive options from loaded data)
  const ENUM_COLS_MONITOR = new Set([
    'site', 'area_raw', 'client', 'jabatan', 'zona_risiko',
    'status_mcu', 'status_follow_up', 'hasil_mcu',
    'kategori_mcu_terakhir', 'frs_kategori', 'perlu_fu',
  ]);
  const ENUM_COLS_RECORD = new Set([
    'site', 'jabatan', 'jenis_kelamin', 'zonasi', 'kes_vendor',
    'status_mcu', 'perlu_fu', 'merokok', 'gol_darah',
  ]);

  // Unique values for each filterable column
  const filterOptions = useMemo(() => {
    const opts: Record<string, string[]> = {};
    const srcRows = activeTab === 'monitor' ? monitorRows : rows;
    const enumSet = activeTab === 'monitor' ? ENUM_COLS_MONITOR : ENUM_COLS_RECORD;
    for (const col of columns) {
      if (enumSet.has(col.key)) {
        const vals = [...new Set(srcRows.map(r => String(r[col.key] ?? '')).filter(Boolean))].sort();
        if (vals.length > 0) opts[col.key] = vals;
      }
    }
    return opts;
  }, [activeTab, monitorRows, rows, columns]);

  const frozenOffsets = useMemo(() => {
    let offset = 48;
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
    setActiveFrozenColumns(c => c.includes(key) ? c.filter(x => x !== key) : [...c, key]);
  };

  const filteredMonitorRows = useMemo(() => {
    let result = monitorRows;
    if (monitorSearch.trim()) {
      const lower = monitorSearch.toLowerCase();
      result = result.filter(r =>
        String(r.nik_karyawan || '').toLowerCase().includes(lower) ||
        String(r.nama || '').toLowerCase().includes(lower),
      );
    }
    for (const [key, value] of Object.entries(monitorFilters)) {
      if (!value.trim()) continue;
      result = result.filter(r => String(r[key] ?? '').toLowerCase().includes(value.toLowerCase()));
    }
    return result;
  }, [monitorRows, monitorSearch, monitorFilters]);

  const filteredRecordRows = useMemo(() => {
    if (Object.values(recordFilters).every(v => !v.trim())) return rows;
    return rows.filter(row => Object.entries(recordFilters).every(([k, v]) =>
      !v.trim() || String(row[k] ?? '').toLowerCase().includes(v.toLowerCase()),
    ));
  }, [rows, recordFilters]);

  const pagedMonitorRows = useMemo(() =>
    filteredMonitorRows.slice((monitorPage - 1) * 100, monitorPage * 100),
    [filteredMonitorRows, monitorPage]);
  const monitorTotalPages = Math.max(1, Math.ceil(filteredMonitorRows.length / 100));

  const displayRows = activeTab === 'record' ? filteredRecordRows : pagedMonitorRows;
  const displayTotal = activeTab === 'record' ? total : filteredMonitorRows.length;
  const displayPage = activeTab === 'record' ? page : monitorPage;
  const displayTotalPages = activeTab === 'record' ? totalPages : monitorTotalPages;
  const displayLoading = activeTab === 'record' ? loading : monitorLoading;
  const activeFilterCount = Object.values(activeFilters).filter(v => v.trim()).length;

  return (
    <div className="mcu-records-modern">
      <div className="mcu-records-card">
        {/* Tab nav */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 mb-4">
          <button
            className={`px-4 py-3 text-sm font-medium border-b-2 ${activeTab === 'record' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('record')}
          >Record MCU</button>
          <button
            className={`px-4 py-3 text-sm font-medium border-b-2 ${activeTab === 'monitor' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('monitor')}
          >Tabel Monitor</button>
        </div>

        {/* Header */}
        <div className="mcu-records-header">
          <div>
            <div className="mcu-records-kicker">DATABASE MCU</div>
            <h3>{activeTab === 'record' ? 'Tabel Record MCU Karyawan' : 'Tabel Monitor MCU (View)'}</h3>
          </div>
          <div className="mcu-records-actions">
            <div className="mcu-records-search">
              <Search size={14} />
              <input
                aria-label="Cari record MCU"
                placeholder={activeTab === 'record' ? 'Cari NIK Karyawan...' : 'Cari NIK atau Nama...'}
                value={activeTab === 'record' ? search : monitorSearch}
                onChange={e => {
                  if (activeTab === 'record') { setSearch(e.target.value); setPage(1); }
                  else { setMonitorSearch(e.target.value); setMonitorPage(1); }
                }}
              />
            </div>
            <div className="mcu-records-count">
              {displayTotal} record
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilters({})}
                  title="Hapus semua filter"
                  style={{ marginLeft: 6, fontSize: 10, color: 'var(--primary,#0ea5e9)', background: 'none', border: '1px solid var(--primary,#0ea5e9)', cursor: 'pointer', padding: '1px 4px', borderRadius: 3 }}
                >
                  {activeFilterCount} filter ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Freeze toolbar */}
        <div className="mcu-records-toolbar">
          <div className="mcu-records-toolbar-title"><Pin size={14} /> Bekukan kolom</div>
          <div className="mcu-frozen-picker-wrap">
            <button
              type="button"
              className={`mcu-frozen-picker-button${showFrozenPicker ? ' is-open' : ''}`}
              onClick={() => setShowFrozenPicker(v => !v)}
              aria-expanded={showFrozenPicker}
            >
              <SlidersHorizontal size={14} />
              {activeFrozenColumns.length ? `${activeFrozenColumns.length} kolom dipilih` : 'Pilih kolom'}
            </button>
            {showFrozenPicker && (
              <div className="mcu-frozen-picker" role="group" aria-label="Pilih kolom frozen">
                {columns.map(col => (
                  <label key={col.key}>
                    <input type="checkbox" checked={activeFrozenColumns.includes(col.key)} onChange={() => toggleFrozenColumn(col.key)} />
                    <span>{col.label}</span>
                  </label>
                ))}
                <button type="button" className="mcu-frozen-reset" onClick={() => setActiveFrozenColumns([])}>Lepas semua</button>
              </div>
            )}
          </div>
          <span className="mcu-records-hint">Kolom terpilih tetap terlihat saat tabel digeser horizontal.</span>
          {activeTab === 'record' && activeFilterCount > 0 && (
            <span className="mcu-records-hint" style={{ color: 'var(--color-warning,#d97706)', marginLeft: 8 }}>
              Filter kolom berlaku pada halaman saat ini.
            </span>
          )}
        </div>

        {/* Table */}
        <div className="mcu-records-table-wrap">
          <table className="mcu-records-table">
            <thead>
              <tr>
                <th className="mcu-records-index">#</th>
                {columns.map(c => {
                  const isFrozen = activeFrozenColumns.includes(c.key);
                  const w = getColWidth(c.key);
                  const hasFilter = !!(activeFilters[c.key]?.trim());
                  const thStyle: React.CSSProperties = {
                    width: `${w}px`, minWidth: `${w}px`, maxWidth: `${Math.max(w, 160)}px`,
                    ...(isFrozen ? { left: `${frozenOffsets[c.key]}px` } : {}),
                  };
                  // Enum columns get dropdown options; others get free-text input in dropdown
                  const enumOpts = filterOptions[c.key] ?? null;

                  return (
                    <th
                      key={c.key}
                      ref={getThRef(c.key) as React.Ref<HTMLTableCellElement>}
                      className={isFrozen ? 'is-frozen' : ''}
                      style={thStyle}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        <span style={hasFilter ? { color: 'var(--primary,#0ea5e9)', fontWeight: 700 } : undefined}>
                          {c.label}
                        </span>
                        {isFrozen && <Pin size={12} />}
                        <ColFilterDropdown
                          colKey={c.key}
                          label={c.label}
                          options={enumOpts}
                          value={activeFilters[c.key] || ''}
                          onChange={v => {
                            setActiveFilters(prev => ({ ...prev, [c.key]: v }));
                            if (activeTab === 'monitor') setMonitorPage(1);
                          }}
                          anchorRef={getThRef(c.key)}
                        />
                      </span>
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
                const zoneKey = activeTab === 'record' ? row.zonasi : row.zona_risiko;
                return (
                  <Fragment key={id}>
                    <tr className={`mcu-zone-${String(zoneKey || 'belum-lengkap').toLowerCase().replace(/\s+/g, '-')}`}>
                      <td className="mcu-records-index">{(displayPage - 1) * 100 + idx + 1}</td>
                      {columns.map(c => {
                        const isFrozen = activeFrozenColumns.includes(c.key);
                        const w = getColWidth(c.key);
                        const cellStyle: React.CSSProperties = {
                          width: `${w}px`, minWidth: `${w}px`, maxWidth: `${Math.max(w, 160)}px`,
                          ...(isFrozen ? { left: `${frozenOffsets[c.key]}px` } : {}),
                        };
                        return (
                          <td key={c.key} className={isFrozen ? 'is-frozen' : ''} style={cellStyle} title={short(row[c.key])}>
                            {c.key === 'link_mcu' && row[c.key]
                              ? <a href={String(row[c.key])} target="_blank" rel="noreferrer" className="mcu-record-link">Buka link</a>
                              : short(row[c.key])}
                          </td>
                        );
                      })}
                      <td className="mcu-records-action" style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
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
                            <pre>{JSON.stringify(Object.fromEntries(Object.entries(row).filter(([k]) => !EXCLUDED_COLUMNS.has(k))), null, 2)}</pre>
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

        {/* Pagination */}
        {displayTotalPages > 1 && (
          <div className="mcu-records-pagination">
            <Button size="sm" variant="outline" disabled={displayPage === 1} onClick={() => activeTab === 'record' ? setPage(p => p - 1) : setMonitorPage(p => p - 1)}>
              <ChevronLeft size={14} /> Sebelumnya
            </Button>
            <div>Halaman {displayPage} / {displayTotalPages}</div>
            <Button size="sm" variant="outline" disabled={displayPage >= displayTotalPages} onClick={() => activeTab === 'record' ? setPage(p => p + 1) : setMonitorPage(p => p + 1)}>
              Berikutnya <ChevronRight size={14} />
            </Button>
          </div>
        )}

        {/* Edit dialog */}
        <Dialog open={!!editingRow} onOpenChange={open => !open && setEditingRow(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Edit MCU</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {MCU_FIELDS.map(field => {
                const key = field.id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase();
                return (
                  <label key={field.id} className="text-xs font-medium">
                    <span>{field.label}</span>
                    <input
                      className="admin-input w-full mt-1"
                      value={editingRow?.[key] == null ? '' : String(editingRow[key])}
                      onChange={e => setEditingRow(cur => cur ? { ...cur, [key]: e.target.value } : cur)}
                    />
                  </label>
                );
              })}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingRow(null)}>Batal</Button>
              <Button onClick={saveEdit} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
