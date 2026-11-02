import type { Metadata } from 'next';
import Link from 'next/link';

import InputPsikologiLingkunganPage from '@/components/administrator/InputPsikologiLingkunganPage';
import QuestionnaireRouteGuard from '@/components/questionnaire/QuestionnaireRouteGuard';

export const metadata: Metadata = {
  title: 'Kuesioner Psikologi Lingkungan Kerja — BG-Health',
  description: 'SDS-30 untuk skrining faktor psikologi lingkungan kerja.',
};

export default function KuesionerPsikologiLingkunganPage() {
  return (
    <QuestionnaireRouteGuard>
      <main style={{ minHeight: '100vh', background: 'var(--background, #f6f6f8)' }}>
        <div style={{ padding: '12px 20px 0', maxWidth: 1180, margin: '0 auto' }}>
          <Link href="/kuesioner" style={{ fontSize: 13, color: 'var(--fg-dim, #666)' }}>
            ← Kembali ke daftar kuesioner
          </Link>
        </div>
        <InputPsikologiLingkunganPage />
      </main>
    </QuestionnaireRouteGuard>
  );
}
