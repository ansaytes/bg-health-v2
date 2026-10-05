'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function QuestionnaireRouteGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return <main className="qh-page"><p role="status">Memeriksa sesi login...</p></main>;
  }

  if (!user || !profile) {
    const returnTo = `${pathname || '/kuesioner'}`;
    return (
      <main className="qh-page">
        <section className="qh-card">
          <h2 className="qh-card-title">Login diperlukan</h2>
          <p className="qh-description">Silakan login dengan akun Employee atau akun petugas untuk membuka kuesioner.</p>
          <Link className="qh-btn qh-btn-primary" href={`/?login=1&returnTo=${encodeURIComponent(returnTo)}`}>
            Login untuk melanjutkan
          </Link>
        </section>
      </main>
    );
  }

  return children;
}
