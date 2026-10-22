'use client';
// Dashboard > Higiene Industri (faktor lingkungan kerja — Permenaker 5/2018 Pasal 5).
//   1. Hearing Conservation — faktor FISIKA (bising)
//   2. Ergonomi              — faktor ERGONOMI
//   3. Psikologi Lingkungan  — faktor PSIKOLOGI (SDS-30, pemetaan per departemen/jabatan)
//
// Catatan: SRQ-20 dan DASS-21 TIDAK di sini. Keduanya instrumen skrining klinis
// per individu, sehingga berada di menu Dashboard > Kesehatan Mental.
import { useState } from 'react';
import HearingConservationDashboard from '@/components/dashboard/HearingConservationDashboard';
import ErgonomiDashboard from '@/components/dashboard/ErgonomiDashboard';
import PemetaanPsikologisDashboard from '@/components/dashboard/PemetaanPsikologisDashboard';

export type HigieneTab = 'hearing' | 'ergonomi' | 'psikologi';

const TABS: { key: HigieneTab; label: string }[] = [
  { key: 'hearing', label: 'Hearing Conservation' },
  { key: 'ergonomi', label: 'Ergonomi' },
  { key: 'psikologi', label: 'Psikologi Lingkungan' },
];

export default function HigieneIndustriTabs({ initialTab = 'hearing' }: { initialTab?: HigieneTab }) {
  const [tab, setTab] = useState<HigieneTab>(initialTab);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div
        role="tablist"
        aria-label="Higiene Industri"
        style={{ display: 'flex', gap: 4, padding: '8px 12px 0', flexShrink: 0, borderBottom: '1px solid var(--border)' }}
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              style={{
                height: 32,
                padding: '0 16px',
                borderRadius: '8px 8px 0 0',
                border: '1px solid var(--border)',
                borderBottom: active ? '1px solid var(--card)' : '1px solid var(--border)',
                marginBottom: -1,
                background: active ? 'var(--card)' : 'transparent',
                color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
                fontSize: 12,
                fontWeight: active ? 700 : 600,
                cursor: 'pointer',
                transition: 'background .15s, color .15s',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* flex:1 + minHeight:0 agar tiap halaman tetap mengisi satu frame */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'hearing' && <HearingConservationDashboard />}
        {tab === 'ergonomi' && <ErgonomiDashboard />}
        {tab === 'psikologi' && <PemetaanPsikologisDashboard />}
      </div>
    </div>
  );
}
