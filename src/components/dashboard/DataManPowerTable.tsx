'use client';

import { useState, useEffect, useCallback } from 'react';
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

const EDITABLE_FIELDS = [
  { key: 'jobsite', label: 'Jobsite', type: 'text' },
  { key: 'bulan', label: 'Bulan', type: 'number' },
  { key: 'tahun', label: 'Tahun', type: 'number' },
  { key: 'man_power', label: 'Man Power', type: 'number' },
  { key: 'hari_kerja', label: 'Hari Kerja', type: 'number' },
  { key: 'kunjungan_klinik', label: 'Kunjungan Klinik', type: 'number' },
];

/* Get auth token for API calls */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

interface DataManPowerTableProps {
  canEdit?: boolean;
}

export default function DataManPowerTable({ canEdit = false }: DataManPowerTableProps) {
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (siteFilter !== 'All Site') params.set('jobsite', siteFilter);
      if (monthFilter !== 'Semua') params.set('bulan', String(MONTHS.indexOf(monthFilter)));
      params.set('tahun', yearFilter);

      const res = await fetch(`/api/manpower?${params}`);
      const json = await res.json();
      if (json.success) setRows(json.data || []);
    } catch {
      // Supabase not connected
    } finally {
      setLoading(false);
    }
  }, [siteFilter, monthFilter, yearFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* Edit handlers */
  const openEdit = (row: any) => {
    setEditRow(row);
    const data: Record<string, string> = {};
    EDITABLE_FIELDS.forEach(f => {
      data[f.key] = String(row[f.key] ?? '');
    });
    setEditData(data);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editRow) return;
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const body: Record<string, unknown> = {
        jobsite: editData.jobsite,
        bulan: parseInt(editData.bulan) || 1,
        tahun: parseInt(editData.tahun) || 2026,
        man_power: parseInt(editData.man_power) || 0,
        hari_kerja: parseInt(editData.hari_kerja) || 0,
        kunjungan_klinik: parseInt(editData.kunjungan_klinik) || 0,
      };

      const res = await fetch(`/api/manpower/${editRow.id}`, {
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
      const res = await fetch(`/api/manpower/${deleteRow.id}`, {
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
      <div className="raw-table-header-bar">
        <span>Data Man Power per Site per Bulan</span>
        <span style={{ color: 'var(--fg-dim)' }}>{rows.length} records</span>
      </div>
      <div className="raw-table-filter-bar">
        <div className="filter-tag">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
          Filter
        </div>
        <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
          {JOBSITES.map(s => (<option key={s} value={s}>{s}</option>))}
        </select>
        <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
          {MONTHS.map(m => (<option key={m} value={m}>{m}</option>))}
        </select>
        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
          <option value="2026">2026</option><option value="2025">2025</option><option value="2024">2024</option>
        </select>
      </div>
      <div className="raw-table-scroll">
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Jobsite</th>
              <th>Bulan</th>
              <th>Tahun</th>
              <th>Man Power</th>
              <th>Hari Kerja</th>
              <th>Man Hours</th>
              <th>Kunjungan Klinik</th>
              {canEdit && <th style={{ width: 70 }}>Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8 + (canEdit ? 1 : 0)} style={{ textAlign: 'center', padding: 24, color: 'var(--fg-dim)' }}>Memuat data...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8 + (canEdit ? 1 : 0)} style={{ textAlign: 'center', padding: 24, color: 'var(--fg-dim)' }}>
                  Belum ada data. Input melalui tab Man Power Bulanan.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={row.id || idx}>
                  <td style={{ color: 'var(--muted-foreground)' }}>{idx + 1}</td>
                  <td>{row.jobsite}</td>
                  <td>{MONTHS[row.bulan] || row.bulan}</td>
                  <td>{row.tahun}</td>
                  <td style={{ fontWeight: 600 }}>{row.man_power}</td>
                  <td>{row.hari_kerja}</td>
                  <td style={{ fontWeight: 600, color: '#00B894' }}>{row.man_hours}</td>
                  <td>{row.kunjungan_klinik || 0}</td>
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
      <div className="raw-table-notes">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
        <span>Man Hours = Man Power x Hari Kerja (dihitung otomatis oleh Supabase). Data ini menjadi denominator perhitungan RKK, CMR, MFR, SSR, ASR, FR PAK, KAPTK.</span>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontSize: 15 }}>Edit Data Man Power</DialogTitle>
            <DialogDescription>{editRow?.jobsite} — {MONTHS[editRow?.bulan]} {editRow?.tahun}</DialogDescription>
          </DialogHeader>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {EDITABLE_FIELDS.map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--foreground)', marginBottom: 3 }}>{f.label}</label>
                <input
                  type={f.type}
                  value={editData[f.key] || ''}
                  onChange={e => setEditData(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: '100%', height: 32, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--background)', padding: '0 8px', fontSize: 12, color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }}
                />
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
            <AlertDialogTitle>Hapus Data Man Power</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus data <strong>{deleteRow?.jobsite} — {MONTHS[deleteRow?.bulan]} {deleteRow?.tahun}</strong>? Tindakan ini tidak dapat dibatalkan.
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
