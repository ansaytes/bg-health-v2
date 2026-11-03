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

import DownloadButton from '@/components/ui/download-button';
import { invalidateKunjunganDashboardData } from '@/lib/dashboard-data';
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
const YEARS = ['Semua','2024','2025','2026','2027'];

const COLUMNS = [
  { key: 'tanggal', label: 'Tanggal' },
  { key: 'nik', label: 'NIK' },
  { key: 'nama', label: 'Nama' },
  { key: 'usia', label: 'Usia' },
  { key: 'jk', label: 'JK' },
  { key: 'jabatan', label: 'Jabatan' },
  { key: 'departemen', label: 'Departemen' },
  { key: 'jobsite', label: 'Site' },
  { key: 'keluhan', label: 'Keluhan' },
  { key: 'diagnosa', label: 'Diagnosa' },
  { key: 'jenis_obat', label: 'Jenis Obat' },
  { key: 'rujuk_rs', label: 'Rujuk RS' },
  { key: 'nama_rs', label: 'Nama RS' },
];

const EDITABLE_FIELDS = [
  { key: 'tanggal', label: 'Tanggal', type: 'date' },
  { key: 'nik', label: 'NIK', type: 'text' },
  { key: 'nama', label: 'Nama', type: 'text' },
  { key: 'usia', label: 'Usia', type: 'number' },
  { key: 'jk', label: 'Jenis Kelamin', type: 'select', options: ['Laki - Laki', 'Perempuan'] },
  { key: 'jabatan', label: 'Jabatan', type: 'text' },
  { key: 'departemen', label: 'Departemen', type: 'text' },
  { key: 'jobsite', label: 'Site', type: 'text' },
  { key: 'keluhan', label: 'Keluhan', type: 'text' },
  { key: 'diagnosa', label: 'Diagnosa', type: 'text' },
  { key: 'jenis_obat', label: 'Jenis Obat', type: 'text' },
  { key: 'rujuk_rs', label: 'Rujuk RS', type: 'select', options: ['Ya', 'Tidak'] },
  { key: 'nama_rs', label: 'Nama RS', type: 'text' },
];

/* Get auth token for API calls */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sesi login tidak valid. Silakan masuk kembali.');
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

/* Format date to dd/mm/yyyy */
function fmtDate(d: string | null): string {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '-';
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return dd + '/' + mm + '/' + dt.getFullYear();
}

function toDateInput(d: string | null): string {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toISOString().split('T')[0];
}

interface DataKunjunganTableProps {
  canEdit?: boolean;
}

export default function DataKunjunganTable({ canEdit = false }: DataKunjunganTableProps) {
  const [siteFilter, setSiteFilter] = useState('All Site');
  const [monthFilter, setMonthFilter] = useState('Semua');
  const [yearFilter, setYearFilter] = useState('Semua');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Edit state
  const [editRow, setEditRow] = useState<any>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteRow, setDeleteRow] = useState<any>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [auditRow, setAuditRow] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<Array<Record<string, any>>>([]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');

  /* Fetch from Supabase */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams();
      if (siteFilter !== 'All Site') params.set('jobsite', siteFilter);
      if (monthFilter !== 'Semua' && yearFilter !== 'Semua') {
        params.set('bulan', String(MONTHS.indexOf(monthFilter)));
      }
      if (yearFilter !== 'Semua') params.set('tahun', yearFilter);

      const headers = await getAuthHeaders();
      const res = await fetch(`/api/kunjungan?${params}`, { headers });
      const json = await res.json();
      if (json.success) setRows(json.data || []);
      else throw new Error(json.error || 'Gagal memuat data kunjungan.');
    } catch (error) {
      console.error('Gagal memuat data kunjungan:', error);
      setLoadError(error instanceof Error ? error.message : 'Gagal memuat data kunjungan.');
    } finally {
      setLoading(false);
    }
  }, [siteFilter, monthFilter, yearFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const visibleRows = rows.filter((row) => {
    if (monthFilter === 'Semua' || yearFilter !== 'Semua') return true;
    const month = String(row.tanggal ?? '').slice(5, 7);
    return month === String(MONTHS.indexOf(monthFilter)).padStart(2, '0');
  });
  const rujukCount = visibleRows.filter(r => r.rujuk_rs === true || r.rujukRS === 'Ya').length;

  /* Edit handlers */
  const openEdit = (row: any) => {
    setEditRow(row);
    const data: Record<string, string> = {};
    EDITABLE_FIELDS.forEach(f => {
      if (f.key === 'rujuk_rs') {
        data[f.key] = row.rujuk_rs === true || row.rujukRS === 'Ya' ? 'Ya' : 'Tidak';
      } else if (f.type === 'date') {
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
      const body: Record<string, unknown> = {
        tanggal: editData.tanggal || null,
        nik: editData.nik,
        nama: editData.nama,
        departemen: editData.departemen || null,
        jobsite: editData.jobsite || null,
        diagnosa: editData.diagnosa || null,
        jenis_obat: editData.jenis_obat || null,
        rujuk_rs: editData.rujuk_rs === 'Ya',
        nama_rs: editData.nama_rs || null,
      };

      const res = await fetch(`/api/kunjungan/${editRow.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        invalidateKunjunganDashboardData();
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
      const res = await fetch(`/api/kunjungan/${deleteRow.id}`, {
        method: 'DELETE',
        headers,
      });
      const json = await res.json();
      if (json.success) {
        invalidateKunjunganDashboardData();
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

  const openAudit = async (row: any) => {
    setAuditRow(row);
    setAuditLogs([]);
    setAuditError('');
    setAuditOpen(true);
    setAuditLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/kunjungan/${row.id}/audit`, { headers });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Gagal mengambil riwayat kunjungan.');
      setAuditLogs(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      setAuditError(error instanceof Error ? error.message : 'Gagal mengambil riwayat kunjungan.');
    } finally {
      setAuditLoading(false);
    }
  };

  const auditFieldLabel = (key: string) => COLUMNS.find((column) => column.key === key)?.label
    || EDITABLE_FIELDS.find((field) => field.key === key)?.label
    || key;
  const auditValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'string') {
      try {
        const parsed: unknown = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.map((item) => typeof item === 'object' && item !== null
          ? Object.values(item).join(' · ')
          : String(item)).join(', ');
      } catch {
        return value;
      }
    }
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  };

  const tableDataForExport = () => {
    return visibleRows.map((r, idx) => {
      let diagStr = '-';
      try {
        const parsed = typeof r.diagnosa === 'string' && r.diagnosa.startsWith('[') ? JSON.parse(r.diagnosa) : r.diagnosa;
        diagStr = Array.isArray(parsed) ? parsed.join(', ') : (r.diagnosa || '-');
      } catch {
        diagStr = r.diagnosa || '-';
      }

      let obatStr = '-';
      try {
        const rawObat = r.jenis_obat || r.jenisObat;
        const parsed = typeof rawObat === 'string' && rawObat.startsWith('[') ? JSON.parse(rawObat) : rawObat;
        obatStr = Array.isArray(parsed)
          ? parsed.map((m: any) => `${m.nama} ${m.aturan ? `(${m.aturan})` : ''} ${m.jumlah ? `- ${m.jumlah}` : ''}`.trim()).join('; ')
          : (rawObat || '-');
      } catch {
        obatStr = r.jenis_obat || r.jenisObat || '-';
      }

      const isRujuk = r.rujuk_rs === true || r.rujukRS === true || r.rujuk_rs === 'Ya';

      return {
        No: idx + 1,
        Tanggal: fmtDate(r.tanggal),
        NIK: r.nik || '-',
        Nama: r.nama || '-',
        Usia: r.usia != null ? r.usia : '-',
        JK: r.jk || '-',
        Jabatan: r.jabatan || '-',
        Departemen: r.departemen || '-',
        Jobsite: r.jobsite || '-',
        Keluhan: r.keluhan || '-',
        Diagnosa: diagStr,
        Jenis_Obat: obatStr,
        Rujuk_RS: isRujuk ? 'Ya' : 'Tidak',
        Nama_RS: r.nama_rs || r.namaRS || '-',
      };
    });
  };

  return (
    <div className="raw-table-container" style={{ position: 'absolute', inset: 0 }}>
      {/* Header Bar */}
      <div className="raw-table-header-bar">
        <span style={{ fontWeight: 700 }}>Data Kunjungan Berobat</span>
        <span style={{ color: 'var(--muted-foreground)' }}>
          {visibleRows.length} kunjungan
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
        <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
          <DownloadButton
            variant="compact"
            filename="Data_Kunjungan_Berobat"
            title="Data Kunjungan Berobat"
            getData={tableDataForExport}
          />
        </div>
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
              <th style={{ width: canEdit ? 104 : 54 }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={COLUMNS.length + 2} style={{ padding: 0 }}>
                  <div className="bm-loading is-inline" role="status" aria-live="polite" aria-label="Memuat data kunjungan berobat">
                    <div className="bm-loading-spinner">
                      <div className="bm-loading-ring" aria-hidden="true" />
                      <img src="/BM.png" alt="" className="bm-loading-logo" aria-hidden="true" />
                    </div>
                    <p className="bm-loading-label">Memuat data kunjungan berobat…</p>
                  </div>
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td role="alert" colSpan={COLUMNS.length + 2} style={{ padding: 40, textAlign: 'center', color: 'var(--destructive)', fontSize: 12 }}>
                  Gagal memuat data: {loadError}
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 2} style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
                  Tidak ada data untuk filter ini.
                </td>
              </tr>
            ) : (
              visibleRows.map((row, idx) => {
                const rujukVal = row.rujuk_rs === true ? 'Ya' : row.rujuk_rs === false ? 'Tidak' : row.rujukRS || '-';
                return (
                  <tr key={row.id || idx}>
                    <td style={{ color: 'var(--muted-foreground)' }}>{idx + 1}</td>
                    {COLUMNS.map(col => {
                      let val: React.ReactNode = '-';
                      let valStr: string = '-';
                      if (col.key === 'rujuk_rs') {
                        val = rujukVal;
                        valStr = rujukVal;
                      } else if (col.key === 'tanggal') {
                        val = fmtDate(row[col.key]);
                        valStr = fmtDate(row[col.key]);
                      } else if (col.key === 'diagnosa') {
                        try {
                          const parsed = JSON.parse(row[col.key]);
                          if (Array.isArray(parsed)) {
                            val = parsed.join(', ');
                            valStr = parsed.join(', ');
                          } else {
                            val = String(row[col.key] || '-');
                            valStr = String(row[col.key] || '-');
                          }
                        } catch {
                          val = String(row[col.key] || '-');
                          valStr = String(row[col.key] || '-');
                        }
                      } else if (col.key === 'jenis_obat') {
                        // The column might be called 'jenis_obat' in DB, so let's check row['jenis_obat'] as well
                        const raw = row[col.key] || row['jenis_obat'];
                        try {
                          const parsed = JSON.parse(raw);
                          if (Array.isArray(parsed)) {
                            val = (
                              <ul style={{ margin: 0, paddingLeft: '16px', listStyleType: 'disc' }}>
                                {parsed.map((m: any, i: number) => (
                                  <li key={i}>{m.nama} - {m.aturan} ({m.jumlah})</li>
                                ))}
                              </ul>
                            );
                            valStr = parsed.map((m: any) => `${m.nama} - ${m.aturan} (${m.jumlah})`).join(', ');
                          } else {
                            val = String(raw || '-');
                            valStr = String(raw || '-');
                          }
                        } catch {
                          val = String(raw || '-');
                          valStr = String(raw || '-');
                        }
                      } else {
                        val = String(row[col.key] || '-');
                        valStr = String(row[col.key] || '-');
                      }
                      const isRujuk = col.key === 'rujuk_rs';
                      return (
                        <td key={col.key} style={{
                          fontWeight: isRujuk ? 600 : 400,
                          color: isRujuk && valStr === 'Ya' ? '#ff4d00' : undefined,
                        }}>
                          {val}
                        </td>
                      );
                    })}
                    <td>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <button
                            onClick={() => void openAudit(row)}
                            title="Riwayat perubahan"
                            aria-label={`Riwayat perubahan ${row.nama}`}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center' }}
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                            </svg>
                          </button>
                          {canEdit && <>
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
                          </>}
                        </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
          <DialogHeader>
            <DialogTitle style={{ fontSize: 15 }}>Edit Data Kunjungan</DialogTitle>
            <DialogDescription>NIK: {editRow?.nik} — {editRow?.nama}</DialogDescription>
          </DialogHeader>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {EDITABLE_FIELDS.map(f => (
              <div key={f.key} style={['nik', 'nama', 'diagnosa', 'jenisObat', 'namaRS'].includes(f.key) ? { gridColumn: '1 / -1' } : undefined}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--foreground)', marginBottom: 3 }}>{f.label}</label>
                {f.type === 'select' ? (
                  <select
                    value={editData[f.key] || ''}
                    onChange={e => setEditData(prev => ({ ...prev, [f.key]: e.target.value }))}
                    style={{ width: '100%', height: 32, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--background)', padding: '0 8px', fontSize: 12, color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }}
                  >
                    {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
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
            <AlertDialogTitle>Hapus Data Kunjungan</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus kunjungan <strong>{deleteRow?.nik} — {deleteRow?.nama}</strong>? Tindakan ini tidak dapat dibatalkan.
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

      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="sm:max-w-2xl" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
          <DialogHeader>
            <DialogTitle>Riwayat Kunjungan</DialogTitle>
            <DialogDescription>
              {auditRow?.tanggal ? fmtDate(auditRow.tanggal) : '-'} · {auditRow?.nama || '-'} · NIK {auditRow?.nik || '-'}
            </DialogDescription>
          </DialogHeader>
          {auditLoading ? (
            <p role="status" className="py-6 text-center text-sm text-muted-foreground">Memuat riwayat perubahan...</p>
          ) : auditError ? (
            <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{auditError}</p>
          ) : auditLogs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Belum ada riwayat. Perubahan sejak audit log diaktifkan akan tercatat di sini.
            </p>
          ) : (
            <ol className="space-y-3">
              {auditLogs.map((log) => {
                const before = log.before_data && typeof log.before_data === 'object' ? log.before_data : {};
                const after = log.after_data && typeof log.after_data === 'object' ? log.after_data : {};
                const ignoredFields = ['id', 'created_by', 'created_by_role', 'updated_by', 'updated_by_role', 'created_at', 'updated_at'];
                const changedFields = log.action === 'INSERT'
                  ? Object.keys(after).filter((key) => !ignoredFields.includes(key))
                  : log.action === 'DELETE'
                    ? Object.keys(before).filter((key) => !ignoredFields.includes(key))
                    : Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
                      .filter((key) => !ignoredFields.includes(key)
                        && JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null));
                return (
                  <li key={log.id} className="rounded-lg border border-border p-3 text-xs">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <strong>{log.action === 'INSERT' ? 'Data dicatat' : log.action === 'UPDATE' ? 'Data diperbarui' : 'Data dihapus'}</strong>
                      <time dateTime={log.occurred_at} className="text-muted-foreground">
                        {new Date(log.occurred_at).toLocaleString('id-ID')}
                      </time>
                    </div>
                    <p className="mb-2 text-muted-foreground">
                      Pelaku: {log.actor_role || 'role tidak tercatat'} · {log.actor_user_id || 'pengguna historis tidak diketahui'}
                    </p>
                    {changedFields.length > 0 && (
                      <ul className="space-y-1">
                        {changedFields.map((key) => (
                          <li key={key}>
                            <span className="font-medium">{auditFieldLabel(key)}:</span>{' '}
                            {log.action === 'INSERT' ? (
                              <span>{auditValue(after[key])}</span>
                            ) : log.action === 'DELETE' ? (
                              <span className="text-muted-foreground">{auditValue(before[key])}</span>
                            ) : (
                              <>
                                <span className="text-muted-foreground">{auditValue(before[key])}</span>
                                {' → '}
                                <span>{auditValue(after[key])}</span>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
