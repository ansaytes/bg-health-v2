'use client';

// Dashboard > Program Inspeksi (Dua Tab Strategis QSHE)
//
// 1. Tab "Kinerja Tim Inspeksi":
//    Memantau kedisiplinan, produktivitas, ketepatan waktu tim,
//    kecepatan penutupan temuan PICA (MTTR), serta deteksi blindspot.
//
// 2. Tab "Kelaikan Fasilitas":
//    Memantau kondisi riil fasilitas di lapangan (Ambulans, Kotak P3K,
//    Sarana Klinik, Kalibrasi Alkes, Ergonomi, dan Kerusakan Berulang).
//    Setiap diagram donut murni 100% homogen per jenis fasilitas.

import { useState } from 'react';

import InspeksiDashboard from '@/components/dashboard/InspeksiDashboard';
import InspeksiKelaikanDashboard from '@/components/dashboard/InspeksiKelaikanDashboard';
import CenteredTabs from '@/components/ui/centered-tabs';

export type ProgramInspeksiTab = 'kinerja' | 'kelaikan';

const TABS: { key: ProgramInspeksiTab; label: string }[] = [
  { key: 'kinerja', label: 'Kinerja Tim Inspeksi' },
  { key: 'kelaikan', label: 'Kelaikan Fasilitas' },
];

export default function ProgramInspeksiTabs({
  initialTab = 'kinerja',
}: {
  initialTab?: string;
}) {
  // Mapping backwards-compatible alias (eksekusi -> kinerja, kondisi-aset -> kelaikan)
  const normTab: ProgramInspeksiTab =
    initialTab === 'kondisi-aset' || initialTab === 'kelaikan'
      ? 'kelaikan'
      : 'kinerja';

  const [tab, setTab] = useState<ProgramInspeksiTab>(normTab);

  return (
    <div className="tab-module-container">
      <CenteredTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel="Program Inspeksi" />

      <div className="tab-module-content">
        {tab === 'kinerja' ? <InspeksiDashboard /> : <InspeksiKelaikanDashboard />}
      </div>
    </div>
  );
}
