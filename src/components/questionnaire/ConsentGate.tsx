'use client';

// ============================================================
// Persetujuan sebelum pengisian kuisioner kesehatan jiwa & fisik
// Standar Apple macOS Dialog Window & BG/QSHE/FORM/098 Rev.000
// ============================================================

import { useRef, useState, useEffect } from 'react';
import { ShieldCheck, FileText, CheckCircle2, AlertTriangle, ArrowDown } from 'lucide-react';

export interface ConsentState {
  accepted: boolean;
  acceptedAt: string | null;
  /** Disimpan untuk audit: semua butir FORM/098 disetujui lewat satu tombol. */
  shareItems: number[];
  declineShare: boolean;
}

export const EMPTY_CONSENT: ConsentState = {
  accepted: false,
  acceptedAt: null,
  shareItems: [1, 2, 3, 4, 5, 6],
  declineShare: false,
};

const PENJELASAN: string[] = [
  'Persetujuan ini mencakup pengisian kuesioner kesehatan kerja dan berbagi informasi antara QSHE Medic dengan dokter/psikolog Employee Assistance Program (EAP), agar konseling dan tindak lanjut medis berjalan selaras.',
  'EAP adalah layanan pendampingan. Psikolog EAP tidak menetapkan diagnosis, Zona Risiko PTM, maupun status kelayakan kerja. Penetapan tersebut tetap dilakukan oleh QSHE Medic berdasarkan penilaian dokter penanggung jawab.',
  'Persetujuan diberikan secara sukarela. Menolak atau mencabut persetujuan tidak dikenai sanksi dan tidak dicatat dalam berkas kepegawaian.',
  'Isi konseling tetap berada pada psikolog EAP. Namun bila ditemukan tanda bahaya atau kondisi yang membahayakan keselamatan karyawan maupun orang lain, psikolog EAP wajib segera menyampaikannya kepada QSHE Medic — ketentuan ini berlaku tanpa memerlukan persetujuan.',
  'Atasan dan personel Departemen HCGS di luar tim medis hanya menerima status kelayakan kerja dan pembatasan kerja, tanpa skor skrining maupun rincian diagnosis.',
  'Catatan konseling EAP disimpan terpisah dari berkas kepegawaian dan tidak dapat digunakan sebagai dasar penilaian kinerja, promosi, mutasi, sanksi, maupun pemutusan hubungan kerja.',
  'Anda dapat mencabut persetujuan ini seluruhnya atau sebagian kapan saja tanpa dikenai sanksi. Pencabutan berlaku sejak diterima QSHE Medic dan tidak berlaku surut atas informasi yang telah dibagikan.',
  'Persetujuan berlaku untuk satu siklus rujukan sampai pendampingan dinyatakan selesai. Rujukan baru memerlukan formulir baru.',
  'Data hasil pemeriksaan bersifat rahasia dan merupakan data pribadi spesifik sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.',
];

export default function ConsentGate({
  instrumen,
  onAccept,
  onDecline,
}: {
  instrumen: string;
  onAccept: (consent: ConsentState) => void;
  onDecline?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [reachedBottom, setReachedBottom] = useState(false);
  const [error, setError] = useState('');

  // Deteksi scroll sampai bawah (toleransi 6px).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 6) {
        setReachedBottom(true);
      }
    };
    // Jika konten pendek dan muat tanpa scroll
    if (el.scrollHeight <= el.clientHeight + 10) {
      setReachedBottom(true);
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  function submit() {
    if (!reachedBottom) {
      setError('Harap gulir lembar persetujuan sampai paling bawah untuk mengaktifkan tombol persetujuan.');
      return;
    }
    onAccept({
      accepted: true,
      acceptedAt: new Date().toISOString(),
      shareItems: EMPTY_CONSENT.shareItems,
      declineShare: false,
    });
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Persetujuan pengisian ${instrumen}`}
        style={{
          width: '100%',
          maxWidth: 620,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--card)',
          borderRadius: 14,
          border: '1px solid var(--border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.25), 0 2px 10px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}
      >
        {/* macOS Window Title Bar */}
        <div
          style={{
            height: 38,
            padding: '0 14px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--card)',
            flexShrink: 0,
            userSelect: 'none',
          }}
        >
          {/* Traffic Lights */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, width: 60 }}>
            <span
              onClick={onDecline}
              title="Tutup / Batal"
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: '#FF5F56',
                border: '1px solid #E0443E',
                display: 'inline-block',
                cursor: onDecline ? 'pointer' : 'default',
              }}
            />
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: '#FFBD2E',
                border: '1px solid #DEA123',
                display: 'inline-block',
              }}
            />
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: '#27C93F',
                border: '1px solid #1AAB29',
                display: 'inline-block',
              }}
            />
          </div>

          {/* Centered Window Title */}
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--foreground)',
              letterSpacing: '-0.01em',
              textAlign: 'center',
              flex: 1,
            }}
          >
            Persetujuan Responden — {instrumen}
          </div>

          <div style={{ width: 60 }} />
        </div>

        {/* Header Subtitle */}
        <div
          style={{
            padding: '12px 20px',
            background: 'var(--muted)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={15} style={{ color: '#FF5E00', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>
                Lembar Persetujuan Tindakan Medis &amp; Partisipasi (Informed Consent)
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--muted-foreground)', marginTop: 1 }}>
                Dokumen BG/QSHE/FORM/098 Rev.000 · UU No. 27/2022 Pelindungan Data Pribadi
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '16px 20px',
            fontSize: 12,
            lineHeight: 1.6,
            color: 'var(--foreground)',
          }}
        >
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {PENJELASAN.map((p, i) => (
              <li key={i} style={{ marginBottom: 10 }}>
                {p}
              </li>
            ))}
          </ol>

          <div
            style={{
              marginTop: 14,
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: 11.5,
              lineHeight: 1.5,
              background: 'rgba(255, 59, 48, 0.08)',
              border: '1px solid rgba(255, 59, 48, 0.28)',
              color: '#FF3B30',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <b>Tanda Bahaya:</b> Bila Anda memiliki pikiran yang mengancam keselamatan diri atau orang lain,
              segera hubungi petugas medis site. Penanganan darurat bersifat menyelamatkan dan bukan pelanggaran kerahasiaan.
            </div>
          </div>

          <div
            style={{
              marginTop: 14,
              padding: '8px 12px',
              borderRadius: 8,
              background: 'var(--muted)',
              fontSize: 11,
              color: 'var(--muted-foreground)',
              textAlign: 'center',
            }}
          >
            {reachedBottom ? (
              <span style={{ color: '#28a745', fontWeight: 600 }}>
                ✓ Anda telah membaca seluruh lembar persetujuan ini.
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <ArrowDown size={12} className="animate-bounce" />
                Gulir ke bawah sampai akhir untuk mengaktifkan tombol persetujuan.
              </span>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border)',
            background: 'var(--card)',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {error && (
            <p style={{ margin: 0, fontSize: 11, color: '#FF3B30', fontWeight: 600 }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {onDecline && (
              <button
                type="button"
                onClick={onDecline}
                style={{
                  height: 34,
                  padding: '0 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Batal
              </button>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={!reachedBottom}
              style={{
                height: 34,
                padding: '0 18px',
                borderRadius: 8,
                border: 'none',
                cursor: reachedBottom ? 'pointer' : 'not-allowed',
                fontSize: 12,
                fontWeight: 600,
                background: reachedBottom ? '#FF5E00' : 'var(--muted)',
                color: reachedBottom ? '#fff' : 'var(--muted-foreground)',
                opacity: reachedBottom ? 1 : 0.6,
                boxShadow: reachedBottom ? 'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 6px rgba(255,94,0,0.3)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              Saya Menyetujui &amp; Lanjutkan Mengisi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
