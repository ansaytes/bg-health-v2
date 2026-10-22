'use client';
// Pembungkus dua halaman MCU dalam satu menu bersepadu:
//   Tab 1 — Monitoring MCU
//   Tab 2 — Analisa & Tindak Lanjut Hasil MCU
//
// Kedua komponen aslinya tidak diubah; tab hanya mengganti yang dirender.
import { useState } from 'react';
import MonitoringMCU from '@/components/dashboard/MonitoringMCU';
import HasilTindakLanjutMCU from '@/components/dashboard/HasilTindakLanjutMCU';

type Tab = 'monitoring' | 'tindak-lanjut';

const TABS: { key: Tab; label: string }[] = [
  { key: 'monitoring', label: 'Monitoring MCU' },
  { key: 'tindak-lanjut', label: 'Analisa & Tindak Lanjut' },
];

export default function MonitoringMCUTabs({ initialTab = 'monitoring' }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div
        role="tablist"
        aria-label="Halaman MCU"
        style={{
          display: 'flex', gap: 4, padding: '8px 12px 0', justifyContent: 'center', flexShrink: 0,
          borderBottom: '1px solid var(--border)',
        }}
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

      {/* flex:1 + minHeight:0 agar masing-masing halaman tetap mengisi satu frame */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'monitoring' ? <MonitoringMCU /> : <HasilTindakLanjutMCU />}
      </div>
    </div>
  );
}
