// Tabel operasional inventory (Habis / Kritis / Fast-Moving / FEFO / Semua).
// Dipakai di halaman Admin → Layanan Kuratif → Inventory (tab "Analisa
// Operasional"). Di dashboard, komponen ini tidak ditampilkan — hanya
// infografik (KPI card + 4 chart) yang tetap tampil.
import { useMemo, useState } from 'react';
import DownloadButton from '@/components/ui/download-button';
import { AlertCircle, AlertTriangle, Boxes, Clock } from 'lucide-react';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  avg_monthly_usage: number;
  stock: number;
  tanggal_masuk: string | null;
  tanggal_expired: string | null;
  daysLeft?: number | null;
}

function getStockStatus(item: InventoryItem): 'Aman' | 'Menipis' | 'Kritis' | 'Habis' {
  if (item.stock <= 0) return 'Habis';
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
  const now = new Date();
  const diffTime = expDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getExpiredStatus(dateStr: string | null): 'Sudah Kadaluarsa' | 'Kadaluarsa < 3 Bulan' | 'Kadaluarsa < 6 Bulan' | 'Aman' | 'Tidak Ada Data' {
  const days = getDaysUntilExpired(dateStr);
  if (days === null) return 'Tidak Ada Data';
  if (days <= 0) return 'Sudah Kadaluarsa';
  if (days <= 90) return 'Kadaluarsa < 3 Bulan';
  if (days <= 180) return 'Kadaluarsa < 6 Bulan';
  return 'Aman';
}

export type InventoryTableTab = 'semua' | 'habis' | 'kritis' | 'fast' | 'fefo';

export default function InventoryOperationalTable({ items }: { items: InventoryItem[] }) {
  const [actionTab, setActionTab] = useState<InventoryTableTab>('semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Semua');
  const [stockStatusFilter, setStockStatusFilter] = useState('Semua');
  const [expiredStatusFilter, setExpiredStatusFilter] = useState('Semua');

  const habisItems = useMemo(() => items.filter(i => (i.stock || 0) <= 0), [items]);
  const kritisItems = useMemo(() => items.filter(i => {
    const s = getStockStatus(i);
    return s === 'Kritis' || s === 'Menipis';
  }), [items]);
  const fastMovingList = useMemo(() => [...items].sort((a, b) => (b.avg_monthly_usage || 0) - (a.avg_monthly_usage || 0)), [items]);
  const expiredItems = useMemo(() => items.filter(i => getExpiredStatus(i.tanggal_expired) === 'Sudah Kadaluarsa'), [items]);
  const expSoonItems = useMemo(() => items.filter(i => getExpiredStatus(i.tanggal_expired) === 'Kadaluarsa < 3 Bulan'), [items]);
  const criticalExpiredItems = useMemo(() => {
    return items
      .filter(i => {
        if (!i.tanggal_expired) return false;
        const exp = getExpiredStatus(i.tanggal_expired);
        return exp === 'Sudah Kadaluarsa' || exp === 'Kadaluarsa < 3 Bulan';
      })
      .map(i => ({ ...i, daysLeft: getDaysUntilExpired(i.tanggal_expired) }))
      .sort((a, b) => (a.daysLeft ?? 99999) - (b.daysLeft ?? 99999));
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = categoryFilter === 'Semua' || item.category === categoryFilter;
      const stockStatus = getStockStatus(item);
      const expStatus = getExpiredStatus(item.tanggal_expired);
      const matchStock = stockStatusFilter === 'Semua'
        ? true
        : stockStatusFilter === 'Kritis / Segera ED'
          ? (stockStatus === 'Kritis' || stockStatus === 'Menipis')
          : stockStatus === stockStatusFilter;
      const matchExpired = expiredStatusFilter === 'Semua'
        ? true
        : expiredStatusFilter === 'Kritis / Segera ED'
          ? (expStatus === 'Sudah Kadaluarsa' || expStatus === 'Kadaluarsa < 3 Bulan')
          : expStatus === expiredStatusFilter;
      return matchSearch && matchCategory && matchStock && matchExpired;
    });
  }, [items, searchQuery, categoryFilter, stockStatusFilter, expiredStatusFilter]);

  const tableDataForExport = () => filteredItems.map((i, idx) => ({
    No: idx + 1, Nama: i.name, Kategori: i.category, Stok: i.stock, Satuan: i.unit,
    'Pakai/Bulan': i.avg_monthly_usage, 'Tgl Expired': i.tanggal_expired || '-',
    'Status Stok': getStockStatus(i), 'Status Expired': getExpiredStatus(i.tanggal_expired),
  }));

  const tabBtn = (active: boolean, color = 'var(--muted)') => ({
    height: 32, padding: '0 12px', borderRadius: 6, border: 'none',
    background: active ? color : 'var(--muted)',
    color: active ? '#fff' : 'var(--foreground)',
    fontSize: 11.5, fontWeight: 700, cursor: 'pointer' as const,
    display: 'flex', alignItems: 'center', gap: 6,
  });

  const selStyle: React.CSSProperties = {
    height: 32, padding: '0 8px', borderRadius: 6,
    border: '1px solid var(--border)', background: 'var(--background)',
    color: 'var(--foreground)', fontSize: 11.5,
  };
  const inputStyle: React.CSSProperties = {
    height: 32, width: 160, padding: '0 10px', borderRadius: 6,
    border: '1px solid var(--border)', background: 'var(--background)',
    color: 'var(--foreground)', fontSize: 11.5,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setActionTab('semua')} style={tabBtn(actionTab === 'semua', 'var(--brand-primary, #ff4d00)')}>
            <Boxes size={14} /> Semua Item
          </button>
          <button type="button" onClick={() => setActionTab('habis')} style={tabBtn(actionTab === 'habis', '#FF4444')}>
            <AlertCircle size={14} /> Habis ({habisItems.length})
          </button>
          <button type="button" onClick={() => setActionTab('kritis')} style={tabBtn(actionTab === 'kritis', '#FF9800')}>
            <AlertTriangle size={14} /> Menipis ({kritisItems.length})
          </button>
          <button type="button" onClick={() => setActionTab('fast')} style={tabBtn(actionTab === 'fast', '#00BCD4')}>
            <Clock size={14} /> Fast-Moving
          </button>
          <button type="button" onClick={() => setActionTab('fefo')} style={tabBtn(actionTab === 'fefo', '#E67E22')}>
            <Clock size={14} /> Expired/FEFO ({expiredItems.length + expSoonItems.length})
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input type="text" placeholder="Cari nama…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={inputStyle} />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={selStyle}>
            <option value="Semua">Semua Kategori</option>
            <option value="Obat">Obat</option>
            <option value="Bahan Medis">Bahan Medis</option>
            <option value="Lainnya">Lainnya</option>
          </select>
          <select value={stockStatusFilter} onChange={(e) => setStockStatusFilter(e.target.value)} style={selStyle}>
            <option value="Semua">Semua Status Stok</option>
            <option value="Aman">Aman</option>
            <option value="Menipis">Menipis</option>
            <option value="Kritis">Kritis</option>
            <option value="Habis">Habis</option>
          </select>
          <select value={expiredStatusFilter} onChange={(e) => setExpiredStatusFilter(e.target.value)} style={selStyle}>
            <option value="Semua">Semua Status Expired</option>
            <option value="Kadaluarsa &lt; 3 Bulan">Kadaluarsa &lt; 3 Bulan</option>
            <option value="Kadaluarsa &lt; 6 Bulan">Kadaluarsa &lt; 6 Bulan</option>
            <option value="Sudah Kadaluarsa">Sudah Kadaluarsa</option>
            <option value="Kritis / Segera ED">Kritis / Segera ED</option>
          </select>
          <DownloadButton getData={tableDataForExport} filename={'inventory-' + actionTab + '-' + new Date().toISOString().slice(0, 10)} title="Inventory" variant="compact" />
        </div>
      </div>

      <div style={{ overflow: 'auto', flex: 1, minHeight: 0, background: 'var(--background)', borderRadius: 8, border: '1px solid var(--border)' }}>
        {actionTab === 'semua' && <SemuaItems items={filteredItems} />}
        {actionTab === 'habis' && <HabisItems items={habisItems} />}
        {actionTab === 'kritis' && <KritisItems items={kritisItems} />}
        {actionTab === 'fast' && <FastMovingItems items={fastMovingList} />}
        {actionTab === 'fefo' && <FefoItems items={criticalExpiredItems} />}
      </div>
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 600 };
const td: React.CSSProperties = { padding: '8px 10px' };
const thR: React.CSSProperties = { ...th, textAlign: 'right' as const };
const thC: React.CSSProperties = { ...th, textAlign: 'center' as const };
const tdR: React.CSSProperties = { ...td, textAlign: 'right' as const };
const tdC: React.CSSProperties = { ...td, textAlign: 'center' as const };

function SemuaItems({ items }: { items: InventoryItem[] }) {
  if (items.length === 0) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)' }}>Tidak ada item yang cocok.</div>;
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ background: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
          <th style={th}>No</th><th style={th}>Nama</th><th style={th}>Kategori</th>
          <th style={thR}>Stok</th><th style={th}>Satuan</th><th style={thR}>Pakai/Bln</th>
          <th style={th}>Tgl Expired</th><th style={thC}>Status Stok</th><th style={thC}>Status Expired</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, idx) => {
          const stockStatus = getStockStatus(item);
          const expStatus = getExpiredStatus(item.tanggal_expired);
          const stockColor = item.stock <= 5 ? '#FF4444' : 'var(--foreground)';
          const stockBadge =
            stockStatus === 'Habis'   ? { bg: 'rgba(255,68,68,0.15)', color: '#FF4444' }
            : stockStatus === 'Kritis'  ? { bg: 'rgba(255,152,0,0.15)', color: '#d97706' }
            : stockStatus === 'Menipis' ? { bg: 'rgba(255,202,40,0.15)', color: '#b45309' }
            : { bg: 'rgba(0,184,148,0.10)', color: '#00B894' };
          const expBadge =
            expStatus === 'Aman'                    ? { bg: 'rgba(0,184,148,0.1)', color: '#00B894' }
            : expStatus === 'Kadaluarsa < 6 Bulan' ? { bg: 'rgba(255,202,40,0.15)', color: '#b45309' }
            : expStatus === 'Kadaluarsa < 3 Bulan' ? { bg: 'rgba(255,152,0,0.15)', color: '#d97706' }
            : expStatus === 'Sudah Kadaluarsa'     ? { bg: 'rgba(255,68,68,0.15)', color: '#dc2626' }
            : { bg: 'rgba(0,0,0,0.05)', color: 'var(--muted-foreground)' };
          return (
            <tr key={item.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ ...td, color: 'var(--muted-foreground)' }}>{idx + 1}</td>
              <td style={{ ...td, fontWeight: 600 }}>{item.name}</td>
              <td style={{ ...td, color: 'var(--muted-foreground)' }}>{item.category || 'Obat'}</td>
              <td style={{ ...tdR, fontWeight: 700, color: stockColor }}>{item.stock}</td>
              <td style={{ ...td, color: 'var(--muted-foreground)' }}>{item.unit}</td>
              <td style={tdR}>{item.avg_monthly_usage || 0}</td>
              <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{item.tanggal_expired || '-'}</td>
              <td style={tdC}><span style={{ background: stockBadge.bg, color: stockBadge.color, padding: '2px 8px', borderRadius: 4, fontSize: 10.5, fontWeight: 700 }}>{stockStatus}</span></td>
              <td style={tdC}><span style={{ background: expBadge.bg, color: expBadge.color, padding: '2px 8px', borderRadius: 4, fontSize: 10.5, fontWeight: 700 }}>{expStatus}</span></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function HabisItems({ items }: { items: InventoryItem[] }) {
  if (items.length === 0) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#00B894' }}>✓ Semua stok tersedia</div>;
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ background: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
          <th style={th}>No</th><th style={th}>Nama</th><th style={th}>Kategori</th>
          <th style={thR}>Stok</th><th style={thR}>Pakai/Bln</th><th style={thR}>Rekomendasi</th>
          <th style={thC}>Status</th><th style={thC}>Tindakan</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, idx) => {
          const bufferMin = Math.max(10, (item.avg_monthly_usage || 0) * 3);
          return (
            <tr key={item.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ ...td, color: 'var(--muted-foreground)' }}>{idx + 1}</td>
              <td style={{ ...td, fontWeight: 700 }}>{item.name}</td>
              <td style={{ ...td, color: 'var(--muted-foreground)' }}>{item.category}</td>
              <td style={{ ...tdR, fontWeight: 800, color: '#FF4444' }}>0 {item.unit}</td>
              <td style={tdR}>{item.avg_monthly_usage} {item.unit}</td>
              <td style={{ ...tdR, fontWeight: 600, color: '#ff4d00' }}>+{bufferMin} {item.unit}</td>
              <td style={tdC}><span style={{ background: 'rgba(255,68,68,0.15)', color: '#FF4444', padding: '3px 8px', borderRadius: 4, fontSize: 10.5, fontWeight: 800 }}>HABIS</span></td>
              <td style={tdC}><span style={{ fontSize: 11, fontWeight: 700, color: '#FF4444' }}>Order</span></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}


function KritisItems({ items }: { items: InventoryItem[] }) {
  if (items.length === 0) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#00B894' }}>✓ Tidak ada stok kritis / menipis</div>;
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ background: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
          <th style={th}>No</th><th style={th}>Nama</th><th style={th}>Kategori</th>
          <th style={thR}>Stok</th><th style={thR}>Pakai/Bln</th><th style={thR}>Sisa (bln)</th><th style={thC}>Status</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, idx) => {
          const s = getStockStatus(item);
          const isKritis = s === 'Kritis';
          const monthsLeft = item.avg_monthly_usage > 0 ? item.stock / item.avg_monthly_usage : null;
          return (
            <tr key={item.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ ...td, color: 'var(--muted-foreground)' }}>{idx + 1}</td>
              <td style={{ ...td, fontWeight: 700 }}>{item.name}</td>
              <td style={{ ...td, color: 'var(--muted-foreground)' }}>{item.category}</td>
              <td style={{ ...tdR, fontWeight: 800, color: isKritis ? '#FF4444' : '#FF9800' }}>{item.stock} {item.unit}</td>
              <td style={tdR}>{item.avg_monthly_usage} {item.unit}</td>
              <td style={tdR}>{monthsLeft !== null ? Math.round(monthsLeft * 10) / 10 + ' bln' : '—'}</td>
              <td style={tdC}>
                <span style={{
                  background: isKritis ? 'rgba(255,68,68,0.15)' : 'rgba(255,152,0,0.15)',
                  color: isKritis ? '#FF4444' : '#d97706',
                  padding: '3px 8px', borderRadius: 4, fontSize: 10.5, fontWeight: 800,
                }}>
                  {isKritis ? 'KRITIS' : 'MENIPIS'}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FastMovingItems({ items }: { items: InventoryItem[] }) {
  const top = items.slice(0, 15);
  if (top.length === 0) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)' }}>Belum ada data fast-moving.</div>;
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ background: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
          <th style={th}>No</th><th style={th}>Nama</th><th style={th}>Kategori</th>
          <th style={thR}>Pakai/Bulan</th><th style={thR}>Stok</th>
          <th style={th}>Tgl Masuk</th><th style={th}>Tgl Expired</th>
        </tr>
      </thead>
      <tbody>
        {top.map((item, idx) => (
          <tr key={item.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
            <td style={{ ...td, color: 'var(--muted-foreground)' }}>{idx + 1}</td>
            <td style={{ ...td, fontWeight: 700 }}>{item.name}</td>
            <td style={{ ...td, color: 'var(--muted-foreground)' }}>{item.category}</td>
            <td style={{ ...tdR, fontWeight: 700, color: '#00BCD4' }}>{item.avg_monthly_usage || 0} {item.unit}</td>
            <td style={{ ...tdR, fontWeight: 700 }}>{item.stock} {item.unit}</td>
            <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{item.tanggal_masuk || '-'}</td>
            <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{item.tanggal_expired || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FefoItems({ items }: { items: InventoryItem[] }) {
  if (items.length === 0) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#00B894' }}>✓ Tidak ada item expired / akan expired &lt; 3 bulan</div>;
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ background: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
          <th style={th}>No</th><th style={th}>Nama</th><th style={th}>Tgl Expired</th>
          <th style={th}>Sisa</th><th style={thR}>Stok</th>
          <th style={thC}>Status FEFO</th><th style={thC}>Tindakan</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, idx) => {
          const isPassed = (item.daysLeft ?? 0) <= 0;
          return (
            <tr key={item.id || idx} style={{ borderBottom: '1px solid var(--border)', background: isPassed ? 'rgba(255,68,68,0.10)' : undefined }}>
              <td style={{ ...td, color: 'var(--muted-foreground)' }}>{idx + 1}</td>
              <td style={{ ...td, fontWeight: 600 }}>{item.name}</td>
              <td style={{ ...td, fontFamily: 'monospace', fontSize: 11.5 }}>{item.tanggal_expired}</td>
              <td style={{ ...td, fontWeight: 700, color: isPassed ? '#FF4444' : '#d97706' }}>
                {isPassed ? Math.abs(item.daysLeft ?? 0) + ' hari lewat' : item.daysLeft + ' hari'}
              </td>
              <td style={{ ...tdR, fontWeight: 700 }}>{item.stock} {item.unit}</td>
              <td style={tdC}>
                <span style={{
                  background: isPassed ? 'rgba(255,68,68,0.15)' : 'rgba(255,152,0,0.15)',
                  color: isPassed ? '#FF4444' : '#d97706',
                  padding: '3px 8px', borderRadius: 4, fontSize: 10.5, fontWeight: 700,
                }}>
                  {isPassed ? 'Expired' : '< 3 Bulan'}
                </span>
              </td>
              <td style={tdC}>
                <span style={{ fontSize: 11, fontWeight: 700, color: isPassed ? '#FF4444' : '#00B894' }}>
                  {isPassed ? 'Tarik &amp; Berita Acara' : 'Prioritas FEFO'}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

