import type { Metadata } from 'next';
import Link from 'next/link';

import InputMentalHealthPage from '@/components/administrator/InputMentalHealthPage';
import QuestionnaireRouteGuard from '@/components/questionnaire/QuestionnaireRouteGuard';

// ============================================================
// Halaman kuesioner Kesehatan Mental
// ============================================================
//
// Halaman kuesioner ini wajib login dan membatasi akun Employee pada data
// miliknya sendiri. Aturan skornya tetap sama dengan halaman petugas QSHE.
// ============================================================

export const metadata: Metadata = {
  title: 'Kuesioner Kesehatan Mental — BG-Health',
  description: 'SRQ-20, DASS-21, dan Zung SDS untuk skrining kesehatan mental karyawan.',
};

export default function KuesionerKesehatanMentalPage() {
  return (
    <QuestionnaireRouteGuard>
    <main style={{ minHeight: '100vh', background: 'var(--background, #f6f6f8)' }}>
      <div style={{ padding: '12px 20px 0', maxWidth: 1180, margin: '0 auto' }}>
        <Link href="/kuesioner" style={{ fontSize: 13, color: 'var(--fg-dim, #666)' }}>
          ← Kembali ke daftar kuesioner
        </Link>
      </div>
      <InputMentalHealthPage />
    </main>
    </QuestionnaireRouteGuard>
  );
}
