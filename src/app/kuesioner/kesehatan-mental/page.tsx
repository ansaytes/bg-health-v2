import type { Metadata } from 'next';
import Link from 'next/link';

import InputMentalHealthPage from '@/components/administrator/InputMentalHealthPage';

// ============================================================
// Halaman publik kuesioner Kesehatan Mental
// ============================================================
//
// Sama seperti Gangguan Tidur: route terpisah supaya bisa dibuka tanpa login,
// tapi memakai komponen yang sama dengan yang dipakai petugas QSHE. Satu
// implementasi aturan skor untuk kedua jenis pemakai.
// ============================================================

export const metadata: Metadata = {
  title: 'Kuesioner Kesehatan Mental — BG-Health',
  description: 'SRQ-20, DASS-21, dan Zung SDS untuk skrining kesehatan mental karyawan.',
};

export default function KuesionerKesehatanMentalPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--background, #f6f6f8)' }}>
      <div style={{ padding: '12px 20px 0', maxWidth: 1180, margin: '0 auto' }}>
        <Link href="/kuesioner" style={{ fontSize: 13, color: 'var(--fg-dim, #666)' }}>
          ← Kembali ke daftar kuesioner
        </Link>
      </div>
      <InputMentalHealthPage />
    </main>
  );
}
