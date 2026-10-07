'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Search, Eye, Pin, SlidersHorizontal, Edit, Trash2, ChevronDown, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { MCU_FIELDS } from '@/lib/mcu-fields';
import { useAuth } from '@/lib/auth-context';
import { useMCUStore } from '@/lib/store';

type RecordRow = Record<string, any>;

// Ciphertext AES-256-GCM (hex panjang) tidak boleh pernah tampil di tabel.
const CIPHERTEXT_PATTERN = /^[0-9a-f]{58,}$/i;

function short(val: any) {
  if (val == null || val === '') return '-';
  const text = String(val);
  return CIPHERTEXT_PATTERN.test(text) ? '-' : text;
}

// ---------------------------------------------------------------------------
// Filter kolom ala spreadsheet: daftar nilai unik + checkbox + pencarian.
// Panel dirender lewat portal (position: fixed) supaya tidak terpotong oleh
// area scroll tabel.
// ---------------------------------------------------------------------------
interface FilterOption { value: string; count: number }

interface ColFilterDropdownProps {
  label: string;
  /** undefined = semua nilai tampil (tidak ada filter) */
  selected: string[] | undefined;
  getOptions: () => FilterOption[];
  onChange: (next: string[] | undefined) => void;
}

const MAX_RENDERED_OPTIONS = 400;

function ColFilterDropdown({ label, selected, getOptions, onChange }: ColFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<FilterOption[]>([]);
  const [pos, setPos] = useState({ top: 0, left: 0, maxHeight: 360 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const openPanel = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const width = 290;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      const top = rect.bottom + 4;
      setPos({ top, left, maxHeight: Math.max(220, window.innerHeight - top - 12) });
    }
    // Opsi dihitung saat dibuka dari data yang lolos filter kolom LAIN (seperti spreadsheet).
    setOptions(getOptions());
    setSearch('');
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const hasFilter = selected !== undefined;
  const allValues = useMemo(() => options.map(o => o.value), [options]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? options.filter(o => o.value.toLowerCase().includes(q)) : options;
  }, [options, search]);
  const rendered = visible.slice(0, MAX_RENDERED_OPTIONS);
  const selectedSet = useMemo(() => new Set(selected ?? allValues), [selected, allValues]);

  const commit = (next: Set<string>) => {
    onChange(next.size >= allValues.length && allValues.every(v => next.has(v)) ? undefined : [...next]);
  };
  const toggle = (value: string) => {
    const next = new Set(selectedSet);
    if (next.has(value)) next.delete(value); else next.add(value);
    commit(next);
  };
  const selectAll = () => {
    if (!search.trim()) { onChange(undefined); return; }
    commit(new Set(visible.map(o => o.value)));
  };
  const clearVisible = () => {
    const next = new Set(selectedSet);
    visible.forEach(o => next.delete(o.value));
    commit(next);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`col-filter-btn${hasFilter ? ' is-active' : ''}${open ? ' is-open' : ''}`}
        onClick={() => (open ? setOpen(false) : openPanel())}
        title={hasFilter ? `Filter aktif: ${label}` : `Filter ${label}`}
        aria-label={`Filter ${label}`}
        aria-expanded={open}
      >
        <ChevronDown size={11} strokeWidth={2.6} />
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          className="col-filter-panel"
          style={{ top: pos.top, left: pos.left, maxHeight: pos.maxHeight }}
          role="dialog"
          aria-label={`Filter ${label}`}
        >
          <div className="col-filter-search">
            <Search size={12} />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nilai..."
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Hapus pencarian"><X size={12} /></button>
            )}
          </div>
          <div className="col-filter-actions">
            <button type="button" onClick={selectAll}>{search.trim() ? 'Pilih hasil pencarian' : 'Pilih semua'}</button>
            <button type="button" onClick={clearVisible}>{search.trim() ? 'Hapus hasil pencarian' : 'Kosongkan'}</button>
          </div>
          <div className="col-filter-list">
            {rendered.map(opt => (
              <label key={opt.value} className="col-filter-option">
                <input type="checkbox" checked={selectedSet.has(opt.value)} onChange={() => toggle(opt.value)} />
                <span className="col-filter-option-text" title={opt.value}>{opt.value === '-' ? '(Kosong)' : opt.value}</span>
                <span className="col-filter-option-count">{opt.count}</span>
              </label>
            ))}
            {visible.length === 0 && <div className="col-filter-empty">Tidak ditemukan</div>}
            {visible.length > MAX_RENDERED_OPTIONS && (
              <div className="col-filter-empty">Menampilkan {MAX_RENDERED_OPTIONS} dari {visible.length} nilai — persempit dengan pencarian.</div>
            )}
          </div>
          <div className="col-filter-footer">
            <span>{options.length} nilai</span>
            {hasFilter && <button type="button" onClick={() => { onChange(undefined); setOpen(false); }}>Hapus filter</button>}
            <button type="button" className="is-primary" onClick={() => setOpen(false)}>Selesai</button>
          </div>
        </div>,
        document.body,
      )}
    </>
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
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [recordLoaded, setRecordLoaded] = useState(false);
  const [pageSize, setPageSize] = useState(100);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [frozenColumns, setFrozenColumns] = useState<string[]>(['nik_karyawan', 'nama']);
  const [frozenColumnsMonitor, setFrozenColumnsMonitor] = useState<string[]>(['nik_karyawan', 'nama']);
  const [showFrozenPicker, setShowFrozenPicker] = useState(false);
  const [editingRow, setEditingRow] = useState<RecordRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<'record' | 'monitor'>('monitor');
  const [monitorRows, setMonitorRows] = useState<RecordRow[]>([]);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorSearch, setMonitorSearch] = useState('');
  const [monitorPage, setMonitorPage] = useState(1);

  // Filter per kolom ala spreadsheet: daftar nilai terpilih (undefined = semua nilai)
  const [monitorFilters, setMonitorFilters] = useState<Record<string, string[] | undefined>>({});
  const [recordFilters, setRecordFilters] = useState<Record<string, string[] | undefined>>({});

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

  // Memuat SEMUA record sekaligus (bertahap 500 baris per request agar ukuran respons aman),
  // sehingga filter kolom bekerja pada seluruh data, bukan hanya satu halaman.
  const load = async () => {
    setLoading(true);
    setError('');
    setLoadProgress(null);
    try {
      const all: RecordRow[] = [];
      let offset = 0;
      for (;;) {
        const { data: { session } } = await supabase.auth.getSession();
        const params = new URLSearchParams({ batch: '1', offset: String(offset), limit: '500' });
        const response = await fetch(`/api/mcu/records?${params.toString()}`, {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'Gagal memuat record MCU');
        const batch: RecordRow[] = json.records || [];
        all.push(...batch);
        setLoadProgress({ loaded: all.length, total: json.total || all.length });
        offset += batch.length;
        if (!json.hasMore || batch.length === 0) break;
      }
      setRows(all);
      setRecordLoaded(true);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat record MCU');
      store.showToast(err instanceof Error ? err.message : 'Gagal memuat record MCU', 'error');
    } finally {
      setLoading(false);
      setLoadProgress(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'record' && !recordLoaded && !loading) void load();
  }, [activeTab]);

  const loadMonitor = async (forceRefresh = false) => {
    setMonitorLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/mcu/monitor-table${forceRefresh ? '?refresh=true' : ''}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Gagal memuat tabel monitor MCU');
      setMonitorRows(Array.isArray(json.rows) ? json.rows : []);
      setMonitorPage(1);
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
    area: 85, client: 130, masa_kerja: 175, total_mcu: 90, pre_employee: 110,
    annual: 80, mcu_terakhir: 120, kategori_mcu_terakhir: 140, kesimpulan_mcu: 150,
    status_follow_up: 190, kesimpulan_fu: 150, masa_berlaku_mcu: 150,
    kategori_masa_berlaku: 150, jadwal_mcu_selanjutnya: 150, notifikasi_jadwal: 330,
    zona_status_kesehatan: 150, catatan: 220, diagnosa: 240, frs: 150,
  }), []);

  const getColWidth = (key: string): number => COLUMN_WIDTHS[key] || 110;

  const recordColumns = useMemo(() => MCU_FIELDS
    .map(f => ({ key: f.id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase(), label: f.id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase() }))
    .filter(c => !EXCLUDED_COLUMNS.has(c.key)), [EXCLUDED_COLUMNS]);

  // Urutan kolom Tabel Monitor MCU
  const monitorColumns = useMemo(() => [
    { key: 'nik_karyawan', label: 'NIK Karyawan' },
    { key: 'nama', label: 'Nama' },
    { key: 'jenis_kelamin', label: 'Jenis Kelamin' },
    { key: 'usia', label: 'Usia' },
    { key: 'jabatan', label: 'Jabatan' },
    { key: 'client', label: 'User' },
    { key: 'site', label: 'Site' },
    { key: 'area', label: 'Area' },
    { key: 'masa_kerja', label: 'Masa Kerja' },
    { key: 'total_mcu', label: 'Total MCU' },
    { key: 'pre_employee', label: 'Pre Employee' },
    { key: 'annual', label: 'Annual' },
    { key: 'mcu_terakhir', label: 'MCU Terakhir' },
    { key: 'kategori_mcu_terakhir', label: 'Kategori MCU Terakhir' },
    { key: 'kesimpulan_mcu', label: 'Kesimpulan MCU' },
    { key: 'status_follow_up', label: 'Status Follow Up Terakhir' },
    { key: 'kesimpulan_fu', label: 'Kesimpulan FU Terakhir' },
    { key: 'masa_berlaku_mcu', label: 'Masa Berlaku MCU' },
    { key: 'kategori_masa_berlaku', label: 'Kategori' },
    { key: 'jadwal_mcu_selanjutnya', label: 'Jadwal MCU Selanjutnya' },
    { key: 'notifikasi_jadwal', label: 'Notifikasi Jadwal MCU' },
    { key: 'zona_status_kesehatan', label: 'Kategori Zona Status Kesehatan' },
    { key: 'catatan', label: 'Catatan' },
    { key: 'diagnosa', label: 'Diagnosa' },
    { key: 'frs', label: 'FRS' },
  ], []);

  const columns = activeTab === 'record' ? recordColumns : monitorColumns;
  const activeFrozenColumns = activeTab === 'record' ? frozenColumns : frozenColumnsMonitor;
  const setActiveFrozenColumns = activeTab === 'record' ? setFrozenColumns : setFrozenColumnsMonitor;

  const activeFilters = activeTab === 'record' ? recordFilters : monitorFilters;
  const activeFilterCount = Object.values(activeFilters).filter(v => v !== undefined).length;

  // Teks yang tampil di sel = nilai yang dipakai filter (kosong/ciphertext tampil '-').
  const cellText = (row: RecordRow, key: string) => short(row[key]);

  const setFilterValue = (colKey: string, value: string[] | undefined) => {
    if (activeTab === 'monitor') {
      setMonitorFilters(prev => ({ ...prev, [colKey]: value }));
      setMonitorPage(1);
    } else {
      setRecordFilters(prev => ({ ...prev, [colKey]: value }));
      setPage(1);
    }
  };
  const clearAllFilters = () => {
    if (activeTab === 'monitor') { setMonitorFilters({}); setMonitorPage(1); }
    else { setRecordFilters({}); setPage(1); }
  };

  const applyFilters = (source: RecordRow[], filters: Record<string, string[] | undefined>, exceptKey?: string) => {
    const active = Object.entries(filters).filter(([key, values]) => key !== exceptKey && values !== undefined) as [string, string[]][];
    if (!active.length) return source;
    const sets = active.map(([key, values]) => [key, new Set(values)] as const);
    return source.filter(row => sets.every(([key, set]) => set.has(cellText(row, key))));
  };

  // Hasil pencarian teks (NIK/Nama) sebelum filter kolom
  const searchedMonitorRows = useMemo(() => {
    const q = monitorSearch.trim().toLowerCase();
    if (!q) return monitorRows;
    return monitorRows.filter(r =>
      String(r.nik_karyawan || '').toLowerCase().includes(q) || String(r.nama || '').toLowerCase().includes(q));
  }, [monitorRows, monitorSearch]);

  const searchedRecordRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      String(r.nik_karyawan || '').toLowerCase().includes(q) || String(r.nama || '').toLowerCase().includes(q));
  }, [rows, search]);

  // Opsi dropdown sebuah kolom = nilai unik dari data yang lolos filter kolom LAIN (seperti spreadsheet)
  const getFilterOptions = (colKey: string): FilterOption[] => {
    const base = activeTab === 'monitor' ? searchedMonitorRows : searchedRecordRows;
    const scoped = applyFilters(base, activeFilters, colKey);
    const counts = new Map<string, number>();
    for (const row of scoped) {
      const text = cellText(row, colKey);
      counts.set(text, (counts.get(text) || 0) + 1);
    }
    // Nilai yang sudah dipilih tetapi tidak muncul lagi tetap ditampilkan agar bisa dilepas
    for (const value of activeFilters[colKey] ?? []) if (!counts.has(value)) counts.set(value, 0);
    return [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => {
        if (a.value === '-') return 1;
        if (b.value === '-') return -1;
        return a.value.localeCompare(b.value, 'id', { numeric: true, sensitivity: 'base' });
      });
  };

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

  const filteredMonitorRows = useMemo(
    () => applyFilters(searchedMonitorRows, monitorFilters),
    [searchedMonitorRows, monitorFilters]);
  const filteredRecordRows = useMemo(
    () => applyFilters(searchedRecordRows, recordFilters),
    [searchedRecordRows, recordFilters]);

  const activeFiltered = activeTab === 'record' ? filteredRecordRows : filteredMonitorRows;
  const displayPage = activeTab === 'record' ? page : monitorPage;
  const displayTotal = activeFiltered.length;
  const sourceTotal = activeTab === 'record' ? rows.length : monitorRows.length;
  const displayTotalPages = Math.max(1, Math.ceil(displayTotal / pageSize));
  const currentPage = Math.min(displayPage, displayTotalPages);
  const displayRows = useMemo(
    () => activeFiltered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [activeFiltered, currentPage, pageSize]);
  const displayLoading = activeTab === 'record' ? loading : monitorLoading;
  const setDisplayPage = (value: number) => (activeTab === 'record' ? setPage(value) : setMonitorPage(value));

  return (
    <div className="mcu-records-modern">
      <div className="mcu-records-card">
        {/* Tab nav — Monitor MCU di kiri, Record MCU di kanan */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 mb-4" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'monitor'}
            className={`px-4 py-3 text-sm font-medium border-b-2 ${activeTab === 'monitor' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('monitor')}
          >Monitor MCU</button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'record'}
            className={`px-4 py-3 text-sm font-medium border-b-2 ${activeTab === 'record' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('record')}
          >Record MCU</button>
        </div>

        {/* Header */}
        <div className="mcu-records-header">
          <div>
            <div className="mcu-records-kicker">DATABASE MCU</div>
            <h3>{activeTab === 'record' ? 'Tabel Record MCU Karyawan' : 'Tabel Monitor MCU Karyawan'}</h3>
          </div>
          <div className="mcu-records-actions">
            <div className="mcu-records-search">
              <Search size={14} />
              <input
                aria-label="Cari record MCU"
                placeholder="Cari NIK atau Nama..."
                value={activeTab === 'record' ? search : monitorSearch}
                onChange={e => {
                  if (activeTab === 'record') { setSearch(e.target.value); setPage(1); }
                  else { setMonitorSearch(e.target.value); setMonitorPage(1); }
                }}
              />
            </div>
            <button
              type="button"
              className="mcu-dashboard-refresh"
              onClick={() => { if (activeTab === 'monitor') void loadMonitor(true); else void load(); }}
              disabled={displayLoading}
              title={activeTab === 'monitor' ? 'Muat ulang data Monitor MCU' : 'Muat ulang data Record MCU'}
            >
              <RefreshCw size={14} className={displayLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <div className="mcu-records-count">
              {displayTotal === sourceTotal ? `${displayTotal} record` : `${displayTotal} dari ${sourceTotal} record`}
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => clearAllFilters()}
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
                  const hasFilter = activeFilters[c.key] !== undefined;
                  const thStyle: React.CSSProperties = {
                    width: `${w}px`, minWidth: `${w}px`, maxWidth: `${Math.max(w, 160)}px`,
                    ...(isFrozen ? { left: `${frozenOffsets[c.key]}px` } : {}),
                  };

                  return (
                    <th
                      key={c.key}
                      className={isFrozen ? 'is-frozen' : ''}
                      style={thStyle}
                    >
                      <span className="mcu-th-inner">
                        <span className={hasFilter ? 'mcu-th-label is-filtered' : 'mcu-th-label'}>{c.label}</span>
                        {isFrozen && <Pin size={11} />}
                        <ColFilterDropdown
                          label={c.label}
                          selected={activeFilters[c.key]}
                          getOptions={() => getFilterOptions(c.key)}
                          onChange={v => setFilterValue(c.key, v)}
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
                    {activeTab === 'record' && loadProgress && (
                      <div className="mcu-records-progress">Memuat data {loadProgress.loaded} / {loadProgress.total}…</div>
                    )}
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr><td colSpan={columns.length + 2} style={{ padding: 36, textAlign: 'center' }}>{error || (activeFilterCount > 0 || (activeTab === 'record' ? search : monitorSearch) ? 'Tidak ada data yang cocok dengan filter.' : 'Belum ada data.')}</td></tr>
              ) : displayRows.map((row, idx) => {
                const id = String(row.id ?? row.nik_karyawan ?? `${currentPage}-${idx}`);
                const isExp = !!expanded[id];
                const zoneKey = activeTab === 'record' ? row.zonasi : row.zona_status_kesehatan;
                return (
                  <Fragment key={id}>
                    <tr className={`mcu-zone-${String(zoneKey || 'belum-lengkap').toLowerCase().replace(/\s+/g, '-')}`}>
                      <td className="mcu-records-index">{(currentPage - 1) * pageSize + idx + 1}</td>
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
                      <td className="mcu-records-action">
                        <div className="mcu-records-action-inner">
                        <Button size="sm" variant="ghost" onClick={() => setExpanded(s => ({ ...s, [id]: !s[id] }))} title={isExp ? 'Tutup detail' : 'Lihat detail'}><Eye size={14} /></Button>
                        {activeTab === 'record' && (isSuperuser || isAdmin) && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(row)} title="Edit data"><Edit size={14} /></Button>
                            <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => handleDelete(String(row.id), row.nama)} title="Hapus data"><Trash2 size={14} /></Button>
                          </>
                        )}
                        </div>
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
        <div className="mcu-records-pagination">
          <label className="mcu-records-pagesize">
            Baris per halaman
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); setMonitorPage(1); }}>
              {[50, 100, 250, 500].map(size => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setDisplayPage(currentPage - 1)}>
            <ChevronLeft size={14} /> Sebelumnya
          </Button>
          <div>Halaman {currentPage} / {displayTotalPages}</div>
          <Button size="sm" variant="outline" disabled={currentPage >= displayTotalPages} onClick={() => setDisplayPage(currentPage + 1)}>
            Berikutnya <ChevronRight size={14} />
          </Button>
        </div>

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
