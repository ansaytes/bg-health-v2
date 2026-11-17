'use client';

// ============================================================
// Administrator > Sarana & Prasarana (dua tab: Sarana Klinik + Checklist)
// ============================================================
//
// Sarana Klinik (katalog SOP/028) dan Checklist Kelaikan (P3K, Ambulans,
// Sarana Ergonomi) adalah SATU keluarga kerja: memeriksa kelengkapan &
// kelayakan aset kesehatan kerja. Karena itu digabung jadi satu menu
// bertab, bukan dua menu terpisah — pengguna tidak perlu berpindah menu
// hanya untuk satu laporan inspeksi.
//
// Tab 1 — Sarana Klinik (ruangan, alat medis, kalibrasi, kondisi aset).
// Tab 2 — Checklist Kelaikan (ChecklistFasilitasTabs dengan sub-tab
//          P3K / Ambulans / Sarana Ergonomi).
//
// `checklistTab` dipakai oleh rute lama `checklist-p3k` dsb. agar mendarat
// langsung di sub-tab yang sesuai.

import { useState } from 'react';

import CenteredTabs from '@/components/ui/centered-tabs';
import SaranaKlinik from './SaranaKlinik';
import ChecklistFasilitasTabs from './ChecklistFasilitasTabs';

type SaranaTab = 'saranaklinik' | 'checklist';

const TABS: { key: SaranaTab; label: string }[] = [
  { key: 'saranaklinik', label: 'Sarana Klinik' },
  { key: 'checklist', label: 'Checklist Kelaikan' },
];

export default function SaranaKlinikWithChecklist({
  initialTab = 'saranaklinik',
  checklistTab,
}: {
  initialTab?: SaranaTab;
  checklistTab?: Parameters<typeof ChecklistFasilitasTabs>[0]['initialTab'];
}) {
  const [tab, setTab] = useState<SaranaTab>(initialTab);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 16px 0', flexShrink: 0 }}>
        <CenteredTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel="Sarana & Prasarana" compact />
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'saranaklinik' ? (
          <SaranaKlinik />
        ) : (
          <ChecklistFasilitasTabs key={tab} initialTab={checklistTab} />
        )}
      </div>
    </div>
  );
}
