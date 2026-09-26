'use client';

import { useState } from 'react';
import { Package, Search, Plus, Edit, Trash2, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  tanggal_masuk: string;
  tanggal_expired: string;
  avg_monthly_usage: number;
  lastUpdated: string;
};

// Dummy data for initial UI
const DUMMY_INVENTORY: InventoryItem[] = [
  { id: '1', name: 'Paratusin', category: 'Obat', stock: 150, unit: 'Tablet', tanggal_masuk: '2026-09-01', tanggal_expired: '2027-09-01', avg_monthly_usage: 40, lastUpdated: '2026-09-25' },
  { id: '2', name: 'Caviplex', category: 'Obat', stock: 320, unit: 'Tablet', tanggal_masuk: '2026-08-15', tanggal_expired: '2026-11-20', avg_monthly_usage: 100, lastUpdated: '2026-09-25' },
  { id: '3', name: 'Diagit', category: 'Obat', stock: 20, unit: 'Tablet', tanggal_masuk: '2026-05-10', tanggal_expired: '2026-10-15', avg_monthly_usage: 10, lastUpdated: '2026-09-24' },
  { id: '4', name: 'Kasa Steril', category: 'Bahan Medis', stock: 45, unit: 'Kotak', tanggal_masuk: '2026-01-10', tanggal_expired: '2026-09-28', avg_monthly_usage: 20, lastUpdated: '2026-09-20' },
  { id: '5', name: 'Alkohol 70%', category: 'Bahan Medis', stock: 12, unit: 'Botol', tanggal_masuk: '2025-12-01', tanggal_expired: '2026-08-10', avg_monthly_usage: 5, lastUpdated: '2026-09-22' },
];

export default function InventoryAdmin() {
  const { isSuperuser } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>(DUMMY_INVENTORY);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Semua');

  const filteredItems = items.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === 'Semua' || item.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const getExpiryStatus = (expDateStr: string) => {
    const expDate = new Date(expDateStr);
    const now = new Date();
    const diffTime = expDate.getTime() - now.getTime();
    const diffMonths = diffTime / (1000 * 3600 * 24 * 30);
    
    if (diffMonths < 0) return { label: 'Expired', color: 'white', bg: 'black', isAlert: true };
    if (diffMonths < 1) return { label: '< 1 Bulan', color: 'white', bg: '#ef4444', isAlert: true };
    if (diffMonths < 3) return { label: '< 3 Bulan', color: '#854d0e', bg: '#fef08a', isAlert: true };
    return { label: 'Aman', color: '#10b981', bg: 'transparent', isAlert: false };
  };

  return (
    <div className="admin-form-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* HEADER LAYOUT: SYMMETRICAL & APPLE-LIKE */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'var(--brand-primary)', color: 'white', padding: '10px', borderRadius: '12px' }}>
            <Package size={24} />
          </div>
          <div>
            <h2 style={{ fontWeight: 700, letterSpacing: '-0.02em', fontSize: '22px', margin: 0, color: 'var(--foreground)' }}>Stok Obat & BHP</h2>
            <p style={{ color: 'var(--muted-foreground)', fontSize: '14px', margin: '2px 0 0 0' }}>Kelola ketersediaan inventaris klinik.</p>
          </div>
        </div>
        <Button onClick={() => alert('Fitur tambah item akan segera tersedia')} style={{ borderRadius: '999px', padding: '0 20px', fontWeight: 600 }}>
          <Plus size={16} className="mr-2" /> Tambah Item Baru
        </Button>
      </div>

      <div className="mcu-records-toolbar" style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'var(--card)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <div className="mcu-records-search" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--background)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <Search size={16} className="text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Cari nama obat atau bahan medis..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', fontSize: '14px' }}
          />
        </div>
        <select 
          value={categoryFilter} 
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', fontSize: '14px' }}
        >
          <option value="Semua">Semua Kategori</option>
          <option value="Obat">Obat</option>
          <option value="Bahan Medis">Bahan Medis</option>
          <option value="Lainnya">Lainnya</option>
        </select>
        <Button variant="outline" style={{ borderRadius: '8px' }} onClick={() => alert('Export data...')}><FileText size={16} className="mr-2" /> Export</Button>
      </div>

      <div className="mcu-records-table-wrap" style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
        <table className="mcu-records-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead style={{ background: 'var(--muted)', textAlign: 'left', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <tr>
              <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>No</th>
              <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Nama Item</th>
              <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Tgl Masuk</th>
              <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Tgl Expired</th>
              <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Stok</th>
              <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Status Stok</th>
              <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', textAlign: 'center', fontWeight: 600 }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted-foreground)' }}>Tidak ada data ditemukan.</td>
              </tr>
            ) : (
              filteredItems.map((item, idx) => {
                // Stock Logic
                const safeLimit = item.avg_monthly_usage * 3;
                const isLowStock = item.stock < safeLimit;
                
                // Expiry Logic
                const exp = getExpiryStatus(item.tanggal_expired);

                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
                    <td style={{ padding: '14px 16px', color: 'var(--muted-foreground)' }}>{idx + 1}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginTop: '2px' }}>{item.category}</div>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--muted-foreground)' }}>{item.tanggal_masuk}</td>
                    
                    {/* Expiry Column */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 500 }}>{item.tanggal_expired}</div>
                      {exp.isAlert && (
                        <div style={{ 
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          background: exp.bg, color: exp.color, 
                          padding: '2px 8px', borderRadius: '4px', fontSize: '11px', 
                          fontWeight: 700, marginTop: '4px' 
                        }}>
                          <AlertTriangle size={10} /> {exp.label}
                        </div>
                      )}
                    </td>
                    
                    {/* Stock Column */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: '15px' }}>{item.stock} <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--muted-foreground)' }}>{item.unit}</span></div>
                      <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '2px' }}>Aman: ≥ {safeLimit}</div>
                    </td>
                    
                    <td style={{ padding: '14px 16px' }}>
                      {isLowStock ? (
                        <span style={{ color: '#ef4444', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }}></span> Menipis
                        </span>
                      ) : (
                        <span style={{ color: '#10b981', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></span> Aman
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <Button size="sm" variant="ghost" style={{ width: '32px', height: '32px', padding: 0 }} onClick={() => alert(`Edit ${item.name}`)}><Edit size={15} /></Button>
                        {isSuperuser && (
                          <Button size="sm" variant="ghost" style={{ width: '32px', height: '32px', padding: 0 }} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => alert(`Hapus ${item.name}`)}><Trash2 size={15} /></Button>
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
    </div>
  );
}
