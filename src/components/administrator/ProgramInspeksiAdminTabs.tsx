'use client';

// ============================================================
// Administrator > Program Inspeksi & Register PICA (satu menu bertab)
// ============================================================
//
// Program Inspeksi (rencana vs realisasi) dan Register PICA (temuan yang
// harus ditutup) adalah SATU alur kerja: jadwal pemeriksaan → temuan →
// penutupan. Digabung jadi satu menu bertab agar tidak dua menu untuk satu
// pekerjaan, mengikuti pola Higiene Industri & Monitoring MCU.
//
// Dua tab memakai `CenteredTabs` di atas; isi tab mengisi sisa tinggi layar.
// `key={tab}` memaksa mount ulang saat pindah tab agar data & filter tiap
// tab tidak tercampur.

import { useState } from 'react';

import CenteredTabs from '@/components/ui/centered-tabs';
import ProgramInspeksi from './ProgramInspeksi';
import PicaRegister from './PicaRegister';
import InspeksiApproval from '@/components/dashboard/InspeksiApproval';

export type ProgramInspeksiAdminTab = 'program' | 'approval' | 'pica';

const TABS: { key: ProgramInspeksiAdminTab; label: string }[] = [
  { key: 'program', label: 'Program Inspeksi' },
  { key: 'approval', label: 'Approval Inspeksi' },
  { key: 'pica', label: 'Register PICA' },
];

export default function ProgramInspeksiAdminTabs({ initialTab = 'program' }: { initialTab?: ProgramInspeksiAdminTab }) {
  const [tab, setTab] = useState<ProgramInspeksiAdminTab>(initialTab);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <CenteredTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel="Program Inspeksi & Register PICA" compact />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'program' ? (
          <ProgramInspeksi key="program" />
        ) : tab === 'approval' ? (
          <InspeksiApproval key="approval" />
        ) : (
          <PicaRegister key="pica" />
        )}
      </div>
    </div>
  );
}
