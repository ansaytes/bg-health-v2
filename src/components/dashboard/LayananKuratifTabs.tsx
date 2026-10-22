'use client';
// Dashboard > Layanan Kuratif.
// Dua halaman yang sebelumnya berdiri sendiri digabung menjadi tab:
//   1. Kunjungan Berobat
//   2. Monitoring Obat & BHP
// Tab diletakkan di TENGAH halaman (komponen CenteredTabs) agar simetris.
import { useState } from 'react';
import KunjunganBerobat from '@/components/dashboard/KunjunganBerobat';
import InventoryDashboard from '@/components/dashboard/InventoryDashboard';
import CenteredTabs from '@/components/ui/centered-tabs';

export type KuratifTab = 'kunjungan' | 'inventory';

const TABS: { key: KuratifTab; label: string }[] = [
  { key: 'kunjungan', label: 'Kunjungan Berobat' },
  { key: 'inventory', label: 'Monitoring Obat & BHP' },
];

export default function LayananKuratifTabs({ initialTab = 'kunjungan' }: { initialTab?: KuratifTab }) {
  const [tab, setTab] = useState<KuratifTab>(initialTab);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <CenteredTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel="Layanan Kuratif" />

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'kunjungan' ? <KunjunganBerobat /> : <InventoryDashboard />}
      </div>
    </div>
  );
}
