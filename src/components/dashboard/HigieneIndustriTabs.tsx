'use client';

// Dashboard > Higiene Industri (faktor lingkungan kerja — Permenaker 5/2018)
//   1. Hearing Conservation — faktor FISIKA (kebisingan)
//   2. Ergonomi              — faktor ERGONOMI
//   3. Psikologi Lingkungan Kerja — faktor PSIKOLOGI (SDS-30)
//   4. Pencahayaan           — faktor FISIKA (Permenkes 48/2016 Tabel 4)
//   5. Kualitas Udara & Debu — faktor FISIKA & KIMIA (Permenaker 5/2018 & Permenkes 48/2016)

import { useState } from 'react';
import HearingConservationDashboard from '@/components/dashboard/HearingConservationDashboard';
import ErgonomiDashboard from '@/components/dashboard/ErgonomiDashboard';
import HigieneSanitasiDashboard from '@/components/dashboard/HigieneSanitasiDashboard';
import PemetaanPsikologisDashboard from '@/components/dashboard/PemetaanPsikologisDashboard';
import PencahayaanDashboard from '@/components/dashboard/PencahayaanDashboard';
import UdaraDebuDashboard from '@/components/dashboard/UdaraDebuDashboard';
import CenteredTabs from '@/components/ui/centered-tabs';

export type HigieneTab = 'hearing' | 'ergonomi' | 'sanitasi' | 'psikologi' | 'cahaya' | 'udara';

const TABS: { key: HigieneTab; label: string }[] = [
  { key: 'hearing', label: 'Hearing Conservation' },
  { key: 'ergonomi', label: 'Ergonomi' },
  { key: 'sanitasi', label: 'Higiene & Sanitasi' },
  { key: 'psikologi', label: 'Psikologi Lingkungan Kerja' },
  { key: 'cahaya', label: 'Pencahayaan' },
  { key: 'udara', label: 'Kualitas Udara & Debu' },
];

export default function HigieneIndustriTabs({ initialTab = 'hearing' }: { initialTab?: HigieneTab }) {
  const [tab, setTab] = useState<HigieneTab>(initialTab);

  return (
    <div className="tab-module-container">
      <CenteredTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel="Higiene Industri" />
      {/* flex:1 + minHeight:0 di PC, auto di mobile agar kartu tidak terpotong */}
      <div className="tab-module-content">
        {tab === 'hearing' && <HearingConservationDashboard />}
        {tab === 'ergonomi' && <ErgonomiDashboard />}
        {tab === 'sanitasi' && <HigieneSanitasiDashboard />}
        {tab === 'psikologi' && <PemetaanPsikologisDashboard />}
        {tab === 'cahaya' && <PencahayaanDashboard />}
        {tab === 'udara' && <UdaraDebuDashboard />}
      </div>
    </div>
  );
}
