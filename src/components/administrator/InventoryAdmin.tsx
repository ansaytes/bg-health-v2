'use client';

import { useState } from 'react';
import { Package, Search, Plus, Edit, Trash2, SlidersHorizontal, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  minStock: number;
  lastUpdated: string;
};

// Dummy data for initial UI
const DUMMY_INVENTORY: InventoryItem[] = [
  { id: '1', name: 'Paratusin', category: 'Obat', stock: 150, unit: 'Tablet', minStock: 50, lastUpdated: '2026-09-25' },
  { id: '2', name: 'Caviplex', category: 'Obat', stock: 320, unit: 'Tablet', minStock: 100, lastUpdated: '2026-09-25' },
  { id: '3', name: 'Diagit', category: 'Obat', stock: 80, unit: 'Tablet', minStock: 50, lastUpdated: '2026-09-24' },
  { id: '4', name: 'Kasa Steril', category: 'Bahan Medis', stock: 45, unit: 'Kotak', minStock: 20, lastUpdated: '2026-09-20' },
  { id: '5', name: 'Alkohol 70%', category: 'Bahan Medis', stock: 12, unit: 'Botol', minStock: 10, lastUpdated: '2026-09-22' },
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

  return (
    <div className="admin-form-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="admin-form-header">
        <div>
          <h2><Package size={20} /> Stok Obat & Bahan Medis</h2>
          <p>Kelola ketersediaan stok obat-obatan, bahan medis habis pakai, dan item lainnya.</p>
        </div>
        <Button onClick={() => alert('Fitur tambah item akan segera tersedia')}><Plus size={16} className="mr-2" /> Tambah Item</Button>
      </div>

      <div className="mcu-records-toolbar" style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'var(--card)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <div className="mcu-records-search" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--background)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <Search size={16} className="text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Cari nama obat atau bahan medis..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%' }}
          />
        </div>
        <select 
          value={categoryFilter} 
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)' }}
        >
          <option value="Semua">Semua Kategori</option>
          <option value="Obat">Obat</option>
          <option value="Bahan Medis">Bahan Medis</option>
          <option value="Lainnya">Lainnya</option>
        </select>
        <Button variant="outline" onClick={() => alert('Export data...')}><FileText size={16} className="mr-2" /> Export</Button>
      </div>

      <div className="mcu-records-table-wrap" style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
        <table className="mcu-records-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--muted)', textAlign: 'left' }}>
            <tr>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>No</th>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Nama Item</th>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Kategori</th>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Stok Saat Ini</th>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Satuan</th>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Status</th>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted-foreground)' }}>Tidak ada data ditemukan.</td>
              </tr>
            ) : (
              filteredItems.map((item, idx) => {
                const isLowStock = item.stock <= item.minStock;
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
                    <td style={{ padding: '12px 16px' }}>{idx + 1}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{item.name}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', background: item.category === 'Obat' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: item.category === 'Obat' ? '#3b82f6' : '#10b981' }}>
                        {item.category}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 'bold', color: isLowStock ? '#ef4444' : 'inherit' }}>{item.stock}</td>
                    <td style={{ padding: '12px 16px' }}>{item.unit}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {isLowStock ? (
                        <span style={{ color: '#ef4444', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }}></span> Menipis
                        </span>
                      ) : (
                        <span style={{ color: '#10b981', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></span> Aman
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <Button size="sm" variant="ghost" onClick={() => alert(`Edit ${item.name}`)}><Edit size={14} /></Button>
                        {isSuperuser && (
                          <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => alert(`Hapus ${item.name}`)}><Trash2 size={14} /></Button>
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
