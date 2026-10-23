'use client';
// Dashboard > Layanan Kuratif.
// Tiga halaman dalam satu menu bertab:
//   1. Kunjungan Berobat
//   2. Monitoring Obat & BHP
//   3. ProKawan — monitoring peserta Program Kesehatan Karyawan (Zona Kuning/Merah)
// Tab diletakkan di kiri halaman (komponen CenteredTabs).
import { useState } from 'react';
import KunjunganBerobat from '@/components/dashboard/KunjunganBerobat';
import InventoryDashboard from '@/components/dashboard/InventoryDashboard';
import ProKawanDashboard from '@/components/dashboard/ProKawanDashboard';
import CenteredTabs from '@/components/ui/centered-tabs';

export type KuratifTab = 'kunjungan' | 'inventory' | 'prokawan';

const TABS: { key: KuratifTab; label: string }[] = [
  { key: 'kunjungan', label: 'Kunjungan Berobat' },
  { key: 'inventory', label: 'Monitoring Obat & BHP' },
  { key: 'prokawan', label: 'ProKawan' },
];

export default function LayananKuratifTabs({ initialTab = 'kunjungan' }: { initialTab?: KuratifTab }) {
  const [tab, setTab] = useState<KuratifTab>(initialTab);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <CenteredTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel="Layanan Kuratif" />

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'kunjungan' && <KunjunganBerobat />}
        {tab === 'inventory' && <InventoryDashboard />}
        {tab === 'prokawan' && <ProKawanDashboard />}
      </div>
    </div>
  );
}
