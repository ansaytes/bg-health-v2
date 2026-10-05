import type { Metadata } from 'next';
import Link from 'next/link';
import QuestionnaireRouteGuard from '@/components/questionnaire/QuestionnaireRouteGuard';

// ============================================================
// Halaman daftar kuesioner karyawan
// ============================================================
//
// Halaman ini hanya tersedia untuk pengguna yang sudah masuk. Akun Employee
// hanya dapat melihat Home dan halaman kuesioner.
// ============================================================

export const metadata: Metadata = {
  title: 'Kuesioner Mandiri — BG-Health',
  description: 'Kuesioner Gangguan Tidur dan Kesehatan Mental PT. Bagong Dekaka Makmur.',
};

const KUESIONER = [
  {
    href: '/kuesioner/gangguan-tidur',
    title: 'Gangguan Tidur',
    subtitle: 'Epworth Sleepiness Scale — 8 pertanyaan',
    detail: 'Mengukur kantuk berlebihan di siang hari pada delapan situasi sehari-hari. '
      + 'ESS di atas 15 berarti tidak layak mengoperasikan alat berat atau bekerja pada shift malam.',
    waktu: 'sekitar 2 menit',
  },
  {
    href: '/kuesioner/kesehatan-mental',
    title: 'Kesehatan Mental',
    subtitle: 'SRQ-20, DASS-21, dan Zung SDS',
    detail: 'Tiga instrumen untuk menilai gejala depresi, ansietas, dan stres. '
      + 'Boleh diisi sebagian saja, misalnya hanya SRQ-20 yang paling singkat.',
    waktu: 'sekitar 6 menit',
  },
];

export default function KuesionerLandingPage() {
  return (
    <QuestionnaireRouteGuard>
    <div className="qh-page">
      <header className="qh-page-head">
        <h2>Kuesioner Mandiri</h2>
        <p>
          Kuesioner ini wajib diisi setelah login. Akun Employee hanya dapat mengisi kuesioner
          untuk dirinya sendiri; identitas karyawan akan diverifikasi otomatis.
        </p>
        <p className="qh-warn">
          Kuesioner adalah <strong>skrining</strong>, bukan pemeriksaan dokter. Hasilnya tidak
          dapat dipakai sebagai diagnosis, dan tidak boleh menjadi dasar keputusan tanpa
          konfirmasi tenaga kesehatan.
        </p>
      </header>

      <div className="qh-card">
        <h3 className="qh-card-title">Yang perlu disiapkan</h3>
        <ul className="qh-description" style={{ paddingLeft: 20, margin: 0, display: 'grid', gap: 6 }}>
          <li>Gunakan akun Employee dan pilih kuesioner yang ingin diisi.</li>
          <li>Tanggal pengisian — biarkan apa adanya bila memakai tanggal hari ini.</li>
          <li>
            Ingat kembali kondisimu dalam dua minggu terakhir, karena sebagian besar pertanyaan
            menanyakan rentang itu.
          </li>
        </ul>
      </div>

      <div className="qh-fields-grid">
        {KUESIONER.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="qh-card"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <h3 className="qh-card-title">{item.title}</h3>
            <p className="qh-card-subtitle">{item.subtitle}</p>
            <p className="qh-description">{item.detail}</p>
            <p className="qh-progress" style={{ display: 'inline-block', marginTop: 4 }}>{item.waktu}</p>
            <div style={{ marginTop: 12 }}>
              <span className="qh-btn qh-btn-primary" style={{ display: 'inline-block' }}>Mulai isi</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="qh-card">
        <h3 className="qh-card-title">Butuh bantuan?</h3>
        <p className="qh-description">
          Bila kamu merasa sedang tidak baik dan tidak yakin mau mengisinya sekarang, hubungi
          petugas QSHE. Kuesioner ini boleh diisi kapan saja, dan tidak harus lengkap dalam satu
          hari.
        </p>
      </div>
    </div>
    </QuestionnaireRouteGuard>
  );
}
