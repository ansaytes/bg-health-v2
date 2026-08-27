'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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

/* Editable fields (subset of COLUMNS) */
const EDITABLE_FIELDS = [
  { key: 'nik', label: 'NIK', type: 'text' },
  { key: 'nama', label: 'Nama', type: 'text' },
  { key: 'jobsite', label: 'Jobsite', type: 'text' },
  { key: 'jabatan', label: 'Jabatan', type: 'text' },
  { key: 'tgl_mulai_a', label: 'Tgl Mulai A', type: 'date' },
  { key: 'tgl_selesai_a', label: 'Tgl Selesai A', type: 'date' },
  { key: 'hari_a', label: 'Hari A', type: 'number' },
  { key: 'tgl_mulai_b', label: 'Tgl Mulai B', type: 'date' },
  { key: 'tgl_selesai_b', label: 'Tgl Selesai B', type: 'date' },
  { key: 'hari_b', label: 'Hari B', type: 'number' },
  { key: 'tgl_mulai_c', label: 'Tgl Mulai C', type: 'date' },
  { key: 'tgl_selesai_c', label: 'Tgl Selesai C', type: 'date' },
  { key: 'hari_c', label: 'Hari C', type: 'number' },
  { key: 'spell', label: 'Spell', type: 'number' },
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

/* Convert date string for input[type=date] */
function toDateInput(d: string | null): string {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toISOString().split('T')[0];
}

const DATE_KEYS = new Set(['tgl_mulai_a','tgl_selesai_a','tgl_mulai_b','tgl_selesai_b','tgl_mulai_c','tgl_selesai_c']);
const NUM_KEYS = new Set(['hari_a','hari_b','hari_c','spell']);

/* Get auth token for API calls */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

interface DataKesehatanTableProps {
  canEdit?: boolean;
}

export default function DataKesehatanTable({ canEdit = false }: DataKesehatanTableProps) {
  const [siteFilter, setSiteFilter] = useState('All Site');
  const [monthFilter, setMonthFilter] = useState('Semua');
  const [yearFilter, setYearFilter] = useState('2026');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editRow, setEditRow] = useState<any>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteRow, setDeleteRow] = useState<any>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* Fetch from Supabase */
  const fetchData = useCallback(async () => {
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
  }, [siteFilter, monthFilter, yearFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalSick = rows.reduce((s, r) => s + (r.hari_a || 0) + (r.hari_b || 0) + (r.hari_c || 0), 0);
  const totalSpell = rows.reduce((s, r) => s + (r.spell || 0), 0);
  const uniqueEmployees = new Set(rows.map((r: any) => r.nik)).size;

  /* Edit handlers */
  const openEdit = (row: any) => {
    setEditRow(row);
    const data: Record<string, string> = {};
    EDITABLE_FIELDS.forEach(f => {
      if (f.type === 'date') {
        data[f.key] = toDateInput(row[f.key]);
      } else {
        data[f.key] = String(row[f.key] ?? '');
      }
    });
    setEditData(data);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editRow) return;
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const body: Record<string, unknown> = {};
      EDITABLE_FIELDS.forEach(f => {
        if (f.type === 'number') {
          body[f.key] = parseInt(editData[f.key]) || 0;
        } else {
          body[f.key] = editData[f.key] || null;
        }
      });

      const res = await fetch(`/api/absensi/${editRow.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        setEditOpen(false);
        fetchData();
      }
    } catch {
      // error
    } finally {
      setSaving(false);
    }
  };

  /* Delete handlers */
  const openDelete = (row: any) => {
    setDeleteRow(row);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/absensi/${deleteRow.id}`, {
        method: 'DELETE',
        headers,
      });
      const json = await res.json();
      if (json.success) {
        setDeleteOpen(false);
        setDeleteRow(null);
        fetchData();
      }
    } catch {
      // error
    } finally {
      setDeleting(false);
    }
  };

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
              {canEdit && <th style={{ width: 70 }}>Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={COLUMNS.length + 1 + (canEdit ? 1 : 0)} style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
                  Memuat data...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 1 + (canEdit ? 1 : 0)} style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
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
                  {canEdit && (
                    <td>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <button
                          onClick={() => openEdit(row)}
                          title="Edit"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center' }}
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openDelete(row)}
                          title="Hapus"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#FF4444', display: 'flex', alignItems: 'center' }}
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
          <DialogHeader>
            <DialogTitle style={{ fontSize: 15 }}>Edit Data Karyawan Sakit</DialogTitle>
            <DialogDescription>NIK: {editRow?.nik} — {editRow?.nama}</DialogDescription>
          </DialogHeader>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {EDITABLE_FIELDS.map(f => (
              <div key={f.key} style={f.key === 'nama' || f.key === 'nik' ? { gridColumn: '1 / -1' } : undefined}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--foreground)', marginBottom: 3 }}>{f.label}</label>
                {f.type === 'date' ? (
                  <input
                    type="date"
                    value={editData[f.key] || ''}
                    onChange={e => setEditData(prev => ({ ...prev, [f.key]: e.target.value }))}
                    style={{ width: '100%', height: 32, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--background)', padding: '0 8px', fontSize: 12, color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }}
                  />
                ) : (
                  <input
                    type={f.type}
                    value={editData[f.key] || ''}
                    onChange={e => setEditData(prev => ({ ...prev, [f.key]: e.target.value }))}
                    style={{ width: '100%', height: 32, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--background)', padding: '0 8px', fontSize: 12, color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <button
              onClick={() => setEditOpen(false)}
              style={{ height: 34, padding: '0 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground)', fontSize: 12, cursor: 'pointer' }}
            >
              Batal
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              style={{ height: 34, padding: '0 16px', borderRadius: 8, border: 'none', background: saving ? 'var(--muted)' : 'linear-gradient(135deg, #ff4d00, #ff6b2b)', color: saving ? 'var(--muted-foreground)' : '#fff', fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data Absensi</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus data <strong>{deleteRow?.nik} — {deleteRow?.nama}</strong>? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              style={{ background: '#FF4444', color: '#fff' }}
            >
              {deleting ? 'Menghapus...' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
