'use client';

import { useState, useEffect } from 'react';
import { Package, Search, Plus, Edit, Trash2, AlertTriangle, Loader2, ArchiveRestore } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
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

export default function InventoryAdmin() {
  const { isSuperuser } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Semua');
  
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
    try {
      const res = await fetch('/api/inventory');
      const json = await res.json();
      if (json.success) {
        setItems(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
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
      } else {
        alert(json.error);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menyimpan item');
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
      } else {
        alert(json.error);
      }
    } catch (err) {
      alert('Gagal menambah batch');
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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal mengubah item');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteItem = async (item: InventoryItem) => {
    const confirmed = window.confirm(
      `Hapus "${item.name}" secara permanen? Stok saat ini: ${item.stock} ${item.unit}. Semua batch dan riwayat transaksi terkait juga akan terhapus.`,
    );
    if (!confirmed) return;

    setDeletingItemId(item.id);
    try {
      const res = await fetch(`/api/inventory?id=${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Gagal menghapus item');
      await fetchItems();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus item');
    } finally {
      setDeletingItemId(null);
    }
  };

  const filteredItems = items.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === 'Semua' || item.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const getExpiryStatus = (expDateStr: string | null) => {
    if (!expDateStr) return { label: '-', color: 'inherit', bg: 'transparent', isAlert: false };
    const expDate = new Date(expDateStr);
    const now = new Date();
    const diffTime = expDate.getTime() - now.getTime();
    const diffMonths = diffTime / (1000 * 3600 * 24 * 30);
    
    if (diffMonths < 0) return { label: 'Expired', color: 'white', bg: 'black', isAlert: true };
    if (diffMonths < 1) return { label: '< 1 Bulan', color: 'white', bg: '#ef4444', isAlert: true };
    if (diffMonths < 3) return { label: '< 3 Bulan', color: '#854d0e', bg: '#fef08a', isAlert: true };
    return { label: 'Aman', color: '#10b981', bg: 'transparent', isAlert: false };
  };

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
      Status: i.stock < (i.avg_monthly_usage * 3) ? 'Menipis' : 'Aman'
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

      <div className="mcu-records-toolbar" style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'var(--card)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)', flexWrap: 'nowrap' }}>
        <div className="mcu-records-search" style={{ flex: '1 1 0px', minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--background)', padding: '0 12px', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', boxSizing: 'border-box' }}>
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
            style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--background)', fontSize: '13px', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
          >
            <option value="Semua">Semua Kategori</option>
            <option value="Obat">Obat</option>
            <option value="Bahan Medis">Bahan Medis</option>
            <option value="Lainnya">Lainnya</option>
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
              <th style={inventoryHeaderCellStyle}>Status</th>
              <th style={{ ...inventoryHeaderCellStyle, textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: 0 }}>
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
                <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted-foreground)' }}>Tidak ada data ditemukan.</td>
              </tr>
            ) : (
              filteredItems.map((item, idx) => {
                const safeLimit = item.avg_monthly_usage * 3;
                const isLowStock = item.stock < safeLimit;
                const exp = getExpiryStatus(item.tanggal_expired);

                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--muted-foreground)' }}>{idx + 1}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '2px' }}>{item.category}</div>
                    </td>

                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      {item.tanggal_masuk ? new Date(item.tanggal_masuk).toLocaleDateString('id-ID') : '-'}
                    </td>
                    
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 500 }}>{item.tanggal_expired ? new Date(item.tanggal_expired).toLocaleDateString('id-ID') : '-'}</div>
                      {exp.isAlert && (
                        <div style={{ 
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          background: exp.bg, color: exp.color, 
                          padding: '2px 6px', borderRadius: '4px', fontSize: '10px', 
                          fontWeight: 700, marginTop: '4px' 
                        }}>
                          <AlertTriangle size={10} /> {exp.label}
                        </div>
                      )}
                    </td>
                    
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 700, fontSize: '14px' }}>{item.stock} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--muted-foreground)' }}>{item.unit}</span></div>
                      <div style={{ fontSize: '10px', color: 'var(--muted-foreground)', marginTop: '2px' }}>Aman: ≥ {safeLimit}</div>
                    </td>
                    
                    <td style={{ padding: '10px 12px' }}>
                      {isLowStock ? (
                        <span style={{ color: '#ef4444', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }}></span> Menipis
                        </span>
                      ) : (
                        <span style={{ color: '#10b981', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }}></span> Aman
                        </span>
                      )}
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

    </div>
  );
}
