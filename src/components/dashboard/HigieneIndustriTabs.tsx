'use client';
// Dashboard > Higiene Industri (faktor lingkungan kerja — Permenaker 5/2018 Pasal 5).
//   1. Hearing Conservation — faktor FISIKA (bising)
//   2. Ergonomi              — faktor ERGONOMI
//   3. Psikologi Lingkungan Kerja — faktor PSIKOLOGI (SDS-30, pemetaan per departemen/jabatan)
//
// Catatan: SRQ-20 dan DASS-21 TIDAK di sini. Keduanya instrumen skrining klinis
// per individu, sehingga berada di menu Dashboard > Kesehatan Mental.
import { useState } from 'react';
import HearingConservationDashboard from '@/components/dashboard/HearingConservationDashboard';
import ErgonomiDashboard from '@/components/dashboard/ErgonomiDashboard';
import PemetaanPsikologisDashboard from '@/components/dashboard/PemetaanPsikologisDashboard';
import CenteredTabs from '@/components/ui/centered-tabs';

export type HigieneTab = 'hearing' | 'ergonomi' | 'psikologi';

const TABS: { key: HigieneTab; label: string }[] = [
  { key: 'hearing', label: 'Hearing Conservation' },
  { key: 'ergonomi', label: 'Ergonomi' },
  { key: 'psikologi', label: 'Psikologi Lingkungan Kerja' },
];

export default function HigieneIndustriTabs({ initialTab = 'hearing' }: { initialTab?: HigieneTab }) {
  const [tab, setTab] = useState<HigieneTab>(initialTab);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <CenteredTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel="Higiene Industri" />
      {/* flex:1 + minHeight:0 agar tiap halaman tetap mengisi satu frame */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'hearing' && <HearingConservationDashboard />}
        {tab === 'ergonomi' && <ErgonomiDashboard />}
        {tab === 'psikologi' && <PemetaanPsikologisDashboard />}
      </div>
    </div>
  );
}
