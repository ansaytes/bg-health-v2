'use client';

// ============================================================
// Administrator > Checklist Kelaikan (satu halaman, tiga tab)
// ============================================================
//
// P3K, Ambulans, dan Sarana Ergonomi adalah SATU kelompok pekerjaan:
// memeriksa kelengkapan & kelayakan aset kesehatan kerja. Karena itu
// ketiganya digabung dalam satu menu bertab, bukan tiga menu terpisah —
// pengguna tidak perlu berpindah menu hanya untuk satu laporan inspeksi.
//
// Pola tab mengikuti Higiene Industri: `CenteredTabs` di atas, isi tab
// mengisi sisa tinggi layar.

import { useState } from 'react';

import CenteredTabs from '@/components/ui/centered-tabs';
import ChecklistFasilitas, { type JenisChecklist } from './ChecklistFasilitas';

const TABS: { key: JenisChecklist; label: string }[] = [
  { key: 'p3k', label: 'Kotak P3K' },
  { key: 'ambulans', label: 'Ambulans' },
  { key: 'ergonomi', label: 'Sarana Ergonomi' },
];

export default function ChecklistFasilitasTabs({ initialTab = 'p3k' }: { initialTab?: JenisChecklist }) {
  const [tab, setTab] = useState<JenisChecklist>(initialTab);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 16px 0', flexShrink: 0 }}>
        <CenteredTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel="Checklist kelaikan" compact />
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* key={tab} memaksa mount ulang saat pindah tab, sehingga data tiap
            checklist tidak tercampur dan site terpilih berlaku per tab. */}
        <ChecklistFasilitas key={tab} jenis={tab} />
      </div>
    </div>
  );
}
