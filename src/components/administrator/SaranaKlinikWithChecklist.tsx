'use client';

// ============================================================
// Administrator > Sarana & Program Inspeksi (Halaman Tunggal Terintegrasi)
// ============================================================
// Menggabungkan seluruh alur digitalisasi inspeksi fasilitas & aset:
//   1. Sarana Klinik   — Ruangan, alkes, APD, evakuasi klinik (SOP/028)
//   2. Kotak P3K       — Checklist kelaikan kotak P3K per lokasi (Permenaker 15/2008)
//   3. Ambulans        — Checklist kelaikan kendaraan & alkes evakuasi per unit
//   4. Sarana Ergonomi — Checklist kelaikan fasilitas ergonomi (Permenaker 5/2018)
//   5. Register PICA   — Penutupan temuan ketidaksesuaian (BG-QSHE-FORM-039)
//   6. Jadwal & Realisasi — Pemantauan rencana vs realisasi bulanan
//
// Alur kerja terpadu:
//   Checklist digital diisi di lapangan → Item rusak/tidak ada langsung terpantau
//   → Tombol pintas "Buka PICA" membawa inspektur/admin ke Register PICA
//   → Jadwal inspeksi bulan tersebut otomatis tercapai.

import { useState } from 'react';

import CenteredTabs from '@/components/ui/centered-tabs';
import SaranaKlinik from './SaranaKlinik';
import ChecklistFasilitas, { type JenisChecklist } from './ChecklistFasilitas';
import PicaRegister from './PicaRegister';
import ProgramInspeksi from './ProgramInspeksi';

export type UnifiedInspeksiTab =
  | 'sarana-klinik'
  | 'p3k'
  | 'ambulans'
  | 'ergonomi'
  | 'pica'
  | 'jadwal';

const TABS: { key: UnifiedInspeksiTab; label: string }[] = [
  { key: 'sarana-klinik', label: 'Sarana Klinik' },
  { key: 'p3k', label: 'Kotak P3K' },
  { key: 'ambulans', label: 'Ambulans' },
  { key: 'ergonomi', label: 'Sarana Ergonomi' },
  { key: 'pica', label: 'Register PICA' },
  { key: 'jadwal', label: 'Perencanaan Jadwal' },
];

export default function SaranaKlinikWithChecklist({
  initialTab = 'sarana-klinik',
  checklistTab,
}: {
  initialTab?: string;
  checklistTab?: JenisChecklist;
}) {
  const normalisasiTab = (): UnifiedInspeksiTab => {
    if (initialTab === 'pica') return 'pica';
    if (initialTab === 'jadwal' || initialTab === 'program' || initialTab === 'program-inspeksi') return 'jadwal';
    if (initialTab === 'checklist-p3k' || initialTab === 'p3k') return 'p3k';
    if (initialTab === 'checklist-ambulans' || initialTab === 'ambulans') return 'ambulans';
    if (initialTab === 'checklist-ergonomi' || initialTab === 'ergonomi') return 'ergonomi';
    if (initialTab === 'checklist' || initialTab === 'checklist-fasilitas') {
      if (checklistTab === 'ambulans') return 'ambulans';
      if (checklistTab === 'ergonomi') return 'ergonomi';
      return 'p3k';
    }
    return 'sarana-klinik';
  };

  const [tab, setTab] = useState<UnifiedInspeksiTab>(normalisasiTab());

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <CenteredTabs
        tabs={TABS}
        active={tab}
        onChange={(k) => setTab(k as UnifiedInspeksiTab)}
        ariaLabel="Sarana & Program Inspeksi"
        compact
      />

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'sarana-klinik' && (
          <SaranaKlinik key="sarana-klinik" onBukaPica={() => setTab('pica')} />
        )}
        {tab === 'p3k' && (
          <ChecklistFasilitas key="p3k" jenis="p3k" onBukaPica={() => setTab('pica')} />
        )}
        {tab === 'ambulans' && (
          <ChecklistFasilitas key="ambulans" jenis="ambulans" onBukaPica={() => setTab('pica')} />
        )}
        {tab === 'ergonomi' && (
          <ChecklistFasilitas key="ergonomi" jenis="ergonomi" onBukaPica={() => setTab('pica')} />
        )}
        {tab === 'pica' && (
          <PicaRegister key="pica" />
        )}
        {tab === 'jadwal' && (
          <ProgramInspeksi key="jadwal" />
        )}
      </div>
    </div>
  );
}
