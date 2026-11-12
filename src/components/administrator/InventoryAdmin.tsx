'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Edit, Trash2, ArchiveRestore, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { fetchDashboardData } from '@/lib/dashboard-data';
import { usePopup, Popup } from '@/lib/popup';
import DownloadButton from '@/components/ui/download-button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  tanggal_masuk: string | null;
  tanggal_expired: string | null;
  avg_monthly_usage: number;
};

// Klasifikasi status stok — sama persis dengan yang dipakai dashboard
// (InventoryDashboard) dan tabel Analisa Operasional, supaya angka di kedua
// halaman tidak pernah berbeda.
type StockStatus = 'Aman' | 'Menipis' | 'Kritis' | 'Habis';

function getStockStatus(item: InventoryItem): StockStatus {
  if ((item.stock || 0) <= 0) return 'Habis';
  const monthly = item.avg_monthly_usage || 0;
  if (monthly > 0) {
    const monthsOfStock = item.stock / monthly;
    if (monthsOfStock <= 0.5 || item.stock <= 5) return 'Kritis';
    if (monthsOfStock <= 1.2) return 'Menipis';
    return 'Aman';
  }
  if (item.stock <= 5) return 'Kritis';
  if (item.stock <= 15) return 'Menipis';
  return 'Aman';
}

function getDaysUntilExpired(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const expDate = new Date(dateStr);
  if (isNaN(expDate.getTime())) return null;
  return Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

type ExpiredStatus = 'Sudah Kadaluarsa' | 'Kadaluarsa < 3 Bulan' | 'Kadaluarsa < 6 Bulan' | 'Aman' | 'Tidak Ada Data';

function getExpiredStatus(dateStr: string | null): ExpiredStatus {
  const days = getDaysUntilExpired(dateStr);
  if (days === null) return 'Tidak Ada Data';
  if (days <= 0) return 'Sudah Kadaluarsa';
  if (days <= 90) return 'Kadaluarsa < 3 Bulan';
  if (days <= 180) return 'Kadaluarsa < 6 Bulan';
  return 'Aman';
}

const STOCK_BADGE: Record<StockStatus, { bg: string; color: string }> = {
  Habis:   { bg: 'rgba(255,68,68,0.15)',  color: '#FF4444' },
  Kritis:  { bg: 'rgba(255,152,0,0.15)',  color: '#d97706' },
  Menipis: { bg: 'rgba(255,202,40,0.15)', color: '#b45309' },
  Aman:    { bg: 'rgba(0,184,148,0.10)',  color: '#00B894' },
};

const EXPIRED_BADGE: Record<ExpiredStatus, { bg: string; color: string }> = {
  'Aman':                    { bg: 'rgba(0,184,148,0.10)',  color: '#00B894' },
  'Kadaluarsa < 6 Bulan':    { bg: 'rgba(255,202,40,0.15)', color: '#b45309' },
  'Kadaluarsa < 3 Bulan':    { bg: 'rgba(255,152,0,0.15)',  color: '#d97706' },
  'Sudah Kadaluarsa':        { bg: 'rgba(255,68,68,0.15)',  color: '#dc2626' },
  'Tidak Ada Data':          { bg: 'rgba(0,0,0,0.05)',      color: 'var(--muted-foreground)' },
};

type StockFilter = 'Semua' | StockStatus | 'Fast Moving';

export default function InventoryAdmin() {
  const { isSuperuser } = useAuth();
  const { popup, popupState, closePopup } = usePopup();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Semua');
  // Filter klasifikasi status stok (Aman / Menipis / Kritis / Habis) + Fast Moving.
  const [stockFilter, setStockFilter] = useState<StockFilter>('Semua');
  
  
  
  // Add Master Item state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({
    name: '',
    category: 'Obat',
    unit: '',
    avg_monthly_usage: '',
  });
  const [editForm, setEditForm] = useState({
    name: '',
    category: 'Obat',
    unit: '',
    avg_monthly_usage: '',
  });

  // Restock / Add Batch state
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [restockSaving, setRestockSaving] = useState(false);
  const [restockForm, setRestockForm] = useState({
    jumlah_masuk: '',
    tanggal_masuk: '',
    tanggal_expired: '',
  });

  const fetchItems = async () => {
    setLoading(true);
    setError('');
    try {
      // Pakai fetchDashboardData (menempelkan token sesi Supabase + cache 2 menit
      // yang sama dengan dashboard) — fetch polos tanpa Authorization membuat
      // getServerCaller gagal menemukan sesi, sehingga endpoint menjawab 403
      // dan tabel terlihat kosong meski dashboard tetap normal.
      const json = await fetchDashboardData<{ success: boolean; data?: InventoryItem[] } & { error?: string }>('/api/inventory');
      if (json.success && Array.isArray(json.data)) {
        setItems(json.data);
      }
    } catch (err) {
      console.error('Gagal memuat inventory:', err);
      setError(err instanceof Error ? err.message : 'Gagal memuat data inventory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    // Reuse logika tokenSesi yang sama persis dengan fetchDashboardData
    // (lib/dashboard-data): ambil access_token dari sesi Supabase. Tanpa
    // header Authorization ini, POST/PATCH/DELETE ditolak 403 karena
    // getServerCaller tidak menemukan sesi.
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await getAuthHeaders() },
        body: JSON.stringify(addForm),
      });
      const json = await res.json();
      if (json.success) {
        setIsAddOpen(false);
        setAddForm({ name: '', category: 'Obat', unit: '', avg_monthly_usage: '' });
        await fetchItems();
        popup({ type: 'success', title: 'Berhasil', message: `Item "${addForm.name}" ditambahkan.` });
      } else {
        popup({ type: 'error', title: 'Gagal menyimpan item', message: json.error || 'Coba lagi.' });
      }
    } catch (err) {
      popup({ type: 'error', title: 'Gagal terhubung ke server', message: err instanceof Error ? err.message : 'Coba lagi.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setRestockSaving(true);
    try {
      const res = await fetch('/api/inventory/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await getAuthHeaders() },
        body: JSON.stringify({
          item_id: selectedItem.id,
          ...restockForm
        }),
      });
      const json = await res.json();
      if (json.success) {
        setIsRestockOpen(false);
        setRestockForm({ jumlah_masuk: '', tanggal_masuk: '', tanggal_expired: '' });
        await fetchItems();
        popup({ type: 'success', title: 'Berhasil', message: `Batch "${restockForm.jumlah_masuk} ${selectedItem.unit}" ditambahkan untuk ${selectedItem.name}.` });
      } else {
        popup({ type: 'error', title: 'Gagal menambah batch', message: json.error || 'Coba lagi.' });
      }
    } catch (err) {
      popup({ type: 'error', title: 'Gagal menambah batch', message: err instanceof Error ? err.message : 'Coba lagi.' });
    } finally {
      setRestockSaving(false);
    }
  };

  const openRestock = (item: InventoryItem) => {
    setSelectedItem(item);
    setRestockForm({
      jumlah_masuk: '',
      tanggal_masuk: new Date().toISOString().split('T')[0],
      tanggal_expired: ''
    });
    setIsRestockOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setEditForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      avg_monthly_usage: String(item.avg_monthly_usage ?? 0),
    });
    setIsEditOpen(true);
  };

  const handleEditItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingItem) return;
    setEditSaving(true);
    try {
      const res = await fetch('/api/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...await getAuthHeaders() },
        body: JSON.stringify({ id: editingItem.id, ...editForm }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Gagal mengubah item');

      setIsEditOpen(false);
      setEditingItem(null);
      await fetchItems();
      popup({ type: 'success', title: 'Berhasil', message: `Item "${editingItem.name}" diperbarui.` });
    } catch (err) {
      popup({ type: 'error', title: 'Gagal mengubah item', message: err instanceof Error ? err.message : 'Coba lagi.' });
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteItem = (item: InventoryItem) => {
    popup({
      type: 'confirm',
      title: 'Hapus item inventory?',
      message: `Hapus "${item.name}" secara permanen? Stok saat ini: ${item.stock} ${item.unit}. Semua batch dan riwayat transaksi terkait juga akan terhapus.`,
      confirmLabel: 'Hapus',
      onOk: async () => {
        setDeletingItemId(item.id);
        try {
          const res = await fetch(`/api/inventory?id=${encodeURIComponent(item.id)}`, {
            method: 'DELETE',
            headers: await getAuthHeaders(),
          });
          const json = await res.json();
          if (!res.ok || !json.success) throw new Error(json.error || 'Gagal menghapus item');
          await fetchItems();
          popup({ type: 'success', title: 'Berhasil', message: `Item "${item.name}" dihapus.` });
        } catch (err) {
          popup({ type: 'error', title: 'Gagal menghapus item', message: err instanceof Error ? err.message : 'Coba lagi.' });
        } finally {
          setDeletingItemId(null);
        }
      },
    });
  };

  // Fast Moving = item dengan pemakaian rata-rata per bulan tertinggi.
  // Ambangnya 15 item teratas (sama dengan tabel Fast-Moving di Analisa
  // Operasional) supaya daftarnya konsisten.
  const fastMovingIds = useMemo(() => {
    return new Set(
      [...items]
        .filter(i => (i.avg_monthly_usage || 0) > 0)
        .sort((a, b) => (b.avg_monthly_usage || 0) - (a.avg_monthly_usage || 0))
        .slice(0, 15)
        .map(i => i.id),
    );
  }, [items]);

  const filteredItems = items.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === 'Semua' || item.category === categoryFilter;
    const matchStock = stockFilter === 'Semua'
      ? true
      : stockFilter === 'Fast Moving'
        ? fastMovingIds.has(item.id)
        : getStockStatus(item) === stockFilter;
    return matchSearch && matchCategory && matchStock;
  });

  const tableDataForExport = () => {
    return filteredItems.map((i, idx) => ({
      No: idx + 1,
      Nama: i.name,
      Kategori: i.category,
      Tgl_Masuk_Aktif: i.tanggal_masuk || '-',
      Tgl_Expired_Terdekat: i.tanggal_expired || '-',
      Stok_Total: i.stock,
      Satuan: i.unit,
      Rata2_Pakai: i.avg_monthly_usage,
      Status_Stok: getStockStatus(i),
      Status_Expired: getExpiredStatus(i.tanggal_expired),
      Fast_Moving: fastMovingIds.has(i.id) ? 'Ya' : 'Tidak',
    }));
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 38, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--background)', padding: '0 12px', fontSize: 13, color: 'var(--foreground)', outline: 'none'
  };
  const inventoryHeaderCellStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: '1px solid var(--border)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    background: 'var(--background)',
    color: 'var(--foreground)',
  };

  return (
    <div className="admin-form-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 24px 8px 24px', height: '100%', minHeight: 0 }}>

      {/* HEADER LAYOUT: SYMMETRICAL & APPLE-LIKE */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
        <div>
          <h2 style={{ fontWeight: 700, letterSpacing: '-0.02em', fontSize: '20px', margin: 0, color: 'var(--foreground)' }}>Stok Obat & BHP</h2>
          <p style={{ color: 'var(--muted-foreground)', fontSize: '13px', margin: '4px 0 0 0' }}>Sistem FIFO/FEFO Otomatis berbasis Batch.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} style={{ borderRadius: '999px', padding: '0 20px', fontWeight: 600, border: '1px solid var(--border)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <Plus size={16} className="mr-2" /> Tambah Item Master
        </Button>
      </div>

      {/* Toolbar TANPA latar card: sebelumnya kotak putih membentang selebar
          halaman dan menyisakan area putih di kiri-kanan pencarian. Sekarang
          toolbar transparan (menyatu dengan background), sedangkan kotak
          pencarian & filter yang BERWARNA PUTIH agar menonjol. */}
      <div className="mcu-records-toolbar" style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'transparent', padding: '0', border: 'none', flexWrap: 'nowrap' }}>
        <div className="mcu-records-search" style={{ flex: '1 1 0px', minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--card)', padding: '0 12px', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', boxSizing: 'border-box' }}>
          <Search size={16} className="text-muted-foreground" style={{ flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Cari nama obat atau bahan medis..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', fontSize: '13px', height: '100%' }}
          />
        </div>
        <div style={{ flexShrink: 0, width: '180px' }}>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card)', fontSize: '13px', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
          >
            <option value="Semua">Semua Kategori</option>
            <option value="Obat">Obat</option>
            <option value="Bahan Medis">Bahan Medis</option>
            <option value="Lainnya">Lainnya</option>
          </select>
        </div>
        <div style={{ flexShrink: 0, width: '170px' }}>
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as StockFilter)}
            title="Filter klasifikasi status stok"
            style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card)', fontSize: '13px', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
          >
            <option value="Semua">Semua Status Stok</option>
            <option value="Aman">Aman</option>
            <option value="Menipis">Menipis</option>
            <option value="Kritis">Kritis</option>
            <option value="Habis">Habis</option>
            <option value="Fast Moving">Fast Moving</option>
          </select>
        </div>
        <div style={{ flexShrink: 0 }}>
          <DownloadButton
            variant="compact"
            filename="Data_Inventory_FEFO"
            title="Data Inventory FEFO"
            getData={tableDataForExport}
          />
        </div>
      </div>

      <div className="mcu-records-table-wrap inventory-admin-table-wrap" style={{ border: '1px solid var(--border)', borderRadius: '10px', flex: '1 1 auto', minHeight: 380, maxHeight: 'calc(100dvh - 200px)' }}>
        <table className="mcu-records-table inventory-admin-table" style={{ borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead style={{ background: 'var(--muted)', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <tr>
              <th style={inventoryHeaderCellStyle}>No</th>
              <th style={inventoryHeaderCellStyle}>Nama Item</th>
              <th style={inventoryHeaderCellStyle}>Tanggal Masuk</th>
              <th style={inventoryHeaderCellStyle}>Tgl Expired (Terdekat)</th>
              <th style={inventoryHeaderCellStyle}>Total Stok</th>
              <th style={inventoryHeaderCellStyle}>Pakai/Bln</th>
              <th style={{ ...inventoryHeaderCellStyle, textAlign: 'center' }}>Status Stok</th>
              <th style={{ ...inventoryHeaderCellStyle, textAlign: 'center' }}>Status Expired</th>
              <th style={{ ...inventoryHeaderCellStyle, textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ padding: 0 }}>
                  <div className="bm-loading is-inline" role="status" aria-live="polite" aria-label="Memuat data inventory admin">
                    <div className="bm-loading-spinner">
                      <div className="bm-loading-ring" aria-hidden="true" />
                      <img src="/BM.png" alt="" className="bm-loading-logo" aria-hidden="true" />
                    </div>
                    <p className="bm-loading-label">Memuat data inventory admin…</p>
                  </div>
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                  {error ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                      <span>Gagal memuat data: {error}</span>
                      <Button size="sm" variant="outline" onClick={() => void fetchItems()}>Coba Lagi</Button>
                    </div>
                  ) : 'Tidak ada data ditemukan.'}
                </td>
              </tr>
            ) : (
              filteredItems.map((item, idx) => {
                const stockStatus = getStockStatus(item);
                const expStatus = getExpiredStatus(item.tanggal_expired);
                const stockBadge = STOCK_BADGE[stockStatus];
                const expBadge = EXPIRED_BADGE[expStatus];
                const isFastMoving = fastMovingIds.has(item.id);

                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--muted-foreground)' }}>{idx + 1}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '2px' }}>{item.category}</div>
                    </td>

                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      {item.tanggal_masuk ? new Date(item.tanggal_masuk).toLocaleDateString('id-ID') : '-'}
                    </td>

                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      {item.tanggal_expired ? new Date(item.tanggal_expired).toLocaleDateString('id-ID') : '-'}
                    </td>

                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 700, fontSize: '14px' }}>{item.stock} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--muted-foreground)' }}>{item.unit}</span></div>
                    </td>

                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600 }}>{item.avg_monthly_usage || 0} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--muted-foreground)' }}>{item.unit}</span></div>
                      {isFastMoving && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 3, fontSize: 10, fontWeight: 700, color: '#00838f' }}>
                          <Clock size={10} /> Fast Moving
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ background: stockBadge.bg, color: stockBadge.color, padding: '3px 8px', borderRadius: 4, fontSize: 10.5, fontWeight: 800 }}>
                        {stockStatus.toUpperCase()}
                      </span>
                    </td>

                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ background: expBadge.bg, color: expBadge.color, padding: '3px 8px', borderRadius: 4, fontSize: 10.5, fontWeight: 700 }}>
                        {expStatus}
                      </span>
                    </td>

                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <Button size="sm" variant="outline" title="Tambah Stok / Restock (Batch Baru)" style={{ padding: '0 8px', height: '28px', fontSize: '12px', background: '#c2410c', color: '#ffffff', border: 'none' }} onClick={() => openRestock(item)}>
                          <ArchiveRestore size={13} className="mr-1" /> Restock
                        </Button>
                        <Button size="sm" variant="ghost" title={`Edit ${item.name}`} style={{ width: '28px', height: '28px', padding: 0 }} onClick={() => openEdit(item)}><Edit size={14} /></Button>
                        {isSuperuser && (
                          <Button size="sm" variant="ghost" title={`Hapus ${item.name}`} disabled={deletingItemId === item.id} style={{ width: '28px', height: '28px', padding: 0 }} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => void handleDeleteItem(item)}><Trash2 size={14} /></Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ADD MASTER ITEM DIALOG */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent style={{ maxWidth: 450 }}>
          <DialogHeader>
            <DialogTitle>Tambah Item Baru (Master)</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              <div>
                <label className="admin-label">Nama Obat / BHP</label>
                <input type="text" style={inputStyle} required value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})} placeholder="Cth: Paratusin" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="admin-label">Kategori</label>
                  <select style={inputStyle} value={addForm.category} onChange={e => setAddForm({...addForm, category: e.target.value})}>
                    <option value="Obat">Obat</option>
                    <option value="Bahan Medis">Bahan Medis</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="admin-label">Satuan</label>
                  <input type="text" style={inputStyle} required value={addForm.unit} onChange={e => setAddForm({...addForm, unit: e.target.value})} placeholder="Cth: Tablet, Botol" />
                </div>
              </div>
              <div>
                <label className="admin-label">Rata2 Pemakaian / Bulan</label>
                <input type="number" style={inputStyle} required value={addForm.avg_monthly_usage} onChange={e => setAddForm({...addForm, avg_monthly_usage: e.target.value})} placeholder="Cth: 30" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Batal</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT ITEM DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent style={{ maxWidth: 450 }}>
          <DialogHeader>
            <DialogTitle>Edit Item Master</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditItem} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              <div>
                <label className="admin-label">Nama Obat / BHP</label>
                <input type="text" style={inputStyle} required value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="admin-label">Kategori</label>
                  <select style={inputStyle} value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})}>
                    <option value="Obat">Obat</option>
                    <option value="Bahan Medis">Bahan Medis</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="admin-label">Satuan</label>
                  <input type="text" style={inputStyle} required value={editForm.unit} onChange={e => setEditForm({...editForm, unit: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="admin-label">Rata2 Pemakaian / Bulan</label>
                <input type="number" style={inputStyle} required value={editForm.avg_monthly_usage} onChange={e => setEditForm({...editForm, avg_monthly_usage: e.target.value})} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Batal</Button>
              <Button type="submit" disabled={editSaving}>{editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* RESTOCK DIALOG */}
      <Dialog open={isRestockOpen} onOpenChange={setIsRestockOpen}>
        <DialogContent style={{ maxWidth: 420 }}>
          <DialogHeader>
            <DialogTitle>Restock / Tambah Batch — {selectedItem?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRestock} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
            <div>
              <label className="admin-label">Jumlah Masuk</label>
              <input type="number" style={inputStyle} required min={1} value={restockForm.jumlah_masuk} onChange={e => setRestockForm({...restockForm, jumlah_masuk: e.target.value})} placeholder="Jumlah" />
            </div>
            <div>
              <label className="admin-label">Tanggal Masuk</label>
              <input type="date" style={inputStyle} required value={restockForm.tanggal_masuk} onChange={e => setRestockForm({...restockForm, tanggal_masuk: e.target.value})} />
            </div>
            <div>
              <label className="admin-label">Tanggal Expired</label>
              <input type="date" style={inputStyle} required value={restockForm.tanggal_expired} onChange={e => setRestockForm({...restockForm, tanggal_expired: e.target.value})} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRestockOpen(false)}>Batal</Button>
              <Button type="submit" disabled={restockSaving}>{restockSaving ? 'Menyimpan...' : 'Tambah Batch'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Popup state={popupState} closePopup={closePopup} />
    </div>
  );
}
