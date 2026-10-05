import type { Metadata } from 'next';
import Link from 'next/link';

import GangguanTidurPage from '@/components/administrator/GangguanTidurPage';
import QuestionnaireRouteGuard from '@/components/questionnaire/QuestionnaireRouteGuard';

// ============================================================
// Halaman kuesioner Gangguan Tidur
// ============================================================
//
// Route terpisah dari tab Input MCU. Halaman ini wajib login dan membatasi
// akun Employee pada data miliknya sendiri.
// ============================================================

export const metadata: Metadata = {
  title: 'Kuesioner Gangguan Tidur — BG-Health',
  description: 'Epworth Sleepiness Scale untuk penilaian kantuk berlebihan di siang hari.',
};

export default function KuesionerGangguanTidurPage() {
  return (
    <QuestionnaireRouteGuard>
    <main style={{ minHeight: '100vh', background: 'var(--background, #f6f6f8)' }}>
      <div style={{ padding: '12px 20px 0', maxWidth: 1180, margin: '0 auto' }}>
        <Link href="/kuesioner" style={{ fontSize: 13, color: 'var(--fg-dim, #666)' }}>
          ← Kembali ke daftar kuesioner
        </Link>
      </div>
      <GangguanTidurPage />
    </main>
    </QuestionnaireRouteGuard>
  );
}
