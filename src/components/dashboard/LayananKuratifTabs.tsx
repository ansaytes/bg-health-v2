'use client';
// Dashboard > Layanan Kuratif.
// Dua halaman yang sebelumnya berdiri sendiri digabung menjadi tab:
//   1. Kunjungan Berobat
//   2. Monitoring Obat & BHP
// Komponen aslinya tidak diubah; tab hanya mengganti yang dirender.
import { useState } from 'react';
import KunjunganBerobat from '@/components/dashboard/KunjunganBerobat';
import InventoryDashboard from '@/components/dashboard/InventoryDashboard';

export type KuratifTab = 'kunjungan' | 'inventory';

const TABS: { key: KuratifTab; label: string }[] = [
  { key: 'kunjungan', label: 'Kunjungan Berobat' },
  { key: 'inventory', label: 'Monitoring Obat & BHP' },
];

export default function LayananKuratifTabs({ initialTab = 'kunjungan' }: { initialTab?: KuratifTab }) {
  const [tab, setTab] = useState<KuratifTab>(initialTab);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div
        role="tablist"
        aria-label="Layanan Kuratif"
        style={{ display: 'flex', gap: 4, padding: '8px 12px 0', flexShrink: 0, borderBottom: '1px solid var(--border)' }}
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              style={{
                height: 32,
                padding: '0 16px',
                borderRadius: '8px 8px 0 0',
                border: '1px solid var(--border)',
                borderBottom: active ? '1px solid var(--card)' : '1px solid var(--border)',
                marginBottom: -1,
                background: active ? 'var(--card)' : 'transparent',
                color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
                fontSize: 12,
                fontWeight: active ? 700 : 600,
                cursor: 'pointer',
                transition: 'background .15s, color .15s',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'kunjungan' ? <KunjunganBerobat /> : <InventoryDashboard />}
      </div>
    </div>
  );
}
