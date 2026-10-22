'use client';
// Pembungkus dua halaman MCU dalam satu menu bersepadu:
//   Tab 1 — Monitoring MCU
//   Tab 2 — Analisa & Tindak Lanjut Hasil MCU
//
// Kedua komponen aslinya tidak diubah; tab hanya mengganti yang dirender.
import { useState } from 'react';
import MonitoringMCU from '@/components/dashboard/MonitoringMCU';
import HasilTindakLanjutMCU from '@/components/dashboard/HasilTindakLanjutMCU';
import CenteredTabs from '@/components/ui/centered-tabs';

type Tab = 'monitoring' | 'tindak-lanjut';

const TABS: { key: Tab; label: string }[] = [
  { key: 'monitoring', label: 'Monitoring MCU' },
  { key: 'tindak-lanjut', label: 'Analisa & Tindak Lanjut' },
];

export default function MonitoringMCUTabs({ initialTab = 'monitoring' }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <CenteredTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel="Halaman MCU" />

      {/* flex:1 + minHeight:0 agar masing-masing halaman tetap mengisi satu frame */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'monitoring' ? <MonitoringMCU /> : <HasilTindakLanjutMCU />}
      </div>
    </div>
  );
}
