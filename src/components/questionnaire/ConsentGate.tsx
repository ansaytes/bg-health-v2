'use client';

// ============================================================
// Persetujuan sebelum pengisian kuisioner kesehatan jiwa
// ============================================================
//
// POPUP modal dengan satu lembar penjelasan. Tombol persetujuan AKTIF hanya
// setelah pengguna SCROLL sampai paling bawah (indikator keterbacaan).
// Persetujuan tunggal mewakili seluruh lembar (partisipasi, kerahasiaan,
// berbagi informasi EAP) — tidak ada checklist terpisah.
//
// Dasar: BG/QSHE/FORM/098 Rev.000 & STD/006 Rev.002 Bab 8 poin 6.

import { useRef, useState, useEffect } from 'react';

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
  'Persetujuan ini mencakup pengisian kuesioner kesehatan jiwa dan berbagi informasi antara QSHE Medic dengan psikolog Employee Assistance Program (EAP), agar konseling dan tindak lanjut medis berjalan selaras.',
  'EAP adalah layanan pendampingan. Psikolog EAP tidak menetapkan diagnosis, Zona Risiko PTM, maupun status kelayakan kerja. Penetapan tersebut tetap dilakukan oleh QSHE Medic berdasarkan penilaian dokter.',
  'Persetujuan diberikan secara sukarela. Menolak atau mencabut persetujuan tidak dikenai sanksi dan tidak dicatat dalam berkas kepegawaian.',
  'Isi konseling tetap berada pada psikolog EAP. Namun bila ditemukan tanda bahaya atau kondisi yang membahayakan keselamatan karyawan maupun orang lain, psikolog EAP wajib segera menyampaikannya kepada QSHE Medic — ketentuan ini berlaku tanpa memerlukan persetujuan.',
  'Atasan dan personel Departemen HCGS di luar tim EAP hanya menerima status kelayakan kerja dan pembatasan kerja, tanpa skor skrining maupun diagnosis.',
  'Catatan konseling EAP disimpan terpisah dari berkas kepegawaian dan tidak dapat digunakan sebagai dasar penilaian kinerja, promosi, mutasi, sanksi, maupun pemutusan hubungan kerja.',
  'Anda dapat mencabut persetujuan ini seluruhnya atau sebagian kapan saja tanpa dikenai sanksi. Pencabutan berlaku sejak diterima QSHE Medic dan tidak berlaku surut atas informasi yang telah dibagikan.',
  'Persetujuan berlaku untuk satu rujukan sampai pendampingan EAP dinyatakan selesai. Rujukan baru memerlukan formulir baru.',
  'Data hasil pemeriksaan bersifat rahasia dan merupakan data pribadi spesifik sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.',
];

export default function ConsentGate({
  instrumen,
  onAccept,
}: {
  instrumen: string;
  onAccept: (consent: ConsentState) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [reachedBottom, setReachedBottom] = useState(false);
  const [error, setError] = useState('');

  // Deteksi scroll sampai bawah (toleransi 4px).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) setReachedBottom(true);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    // Jika isi lebih pendek dari kontainer, langsung aktifkan (dibaca via
    // microtask agar tidak setState sinkron di dalam effect).
    if (el.scrollHeight <= el.clientHeight) {
      void Promise.resolve().then(() => setReachedBottom(true));
    }
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  function submit() {
    if (!reachedBottom) {
      setError('Gulir lembar persetujuan sampai paling bawah untuk mengaktifkan tombol persetujuan.');
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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Persetujuan pengisian ${instrumen}`}
        style={{
          width: '100%', maxWidth: 620, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--foreground)' }}>
            Persetujuan — {instrumen}
          </h2>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '3px 0 0' }}>
            BG/QSHE/FORM/098 Rev.000 · Gulir sampai paling bawah untuk melanjutkan.
          </p>
        </div>

        {/* Isi — bisa di-scroll */}
        <div
          ref={scrollRef}
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 20px' }}
        >
          <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.65, fontSize: 12.5, color: 'var(--foreground)' }}>
            {PENJELASAN.map((p, i) => (
              <li key={i} style={{ marginBottom: 8 }}>{p}</li>
            ))}
          </ol>

          <div style={{
            marginTop: 14, padding: '10px 14px', borderRadius: 8, fontSize: 12, lineHeight: 1.6,
            background: 'rgba(255,45,45,0.07)', border: '1px solid rgba(255,45,45,0.35)', color: '#b3261e',
          }}>
            <b>Tanda bahaya.</b> Bila Anda memiliki pikiran untuk mengakhiri hidup, segera sampaikan
            kepada petugas kesehatan. Hal ini wajib ditindaklanjuti dokter pada hari yang sama dan
            bersifat menyelamatkan — bukan pelanggaran kerahasiaan.
          </div>

          <p style={{ fontSize: 11.5, color: 'var(--muted-foreground)', marginTop: 14, lineHeight: 1.6 }}>
            <b>Informasi yang tidak dibagikan:</b> isi konseling tetap berada pada psikolog EAP;
            jawaban per butir kuesioner tetap berada pada QSHE Medic dan dokter; serta informasi
            kesehatan lain yang tidak tercantum dalam lembar persetujuan ini.
          </p>

          {/* Penanda bawah — terlihat saat sudah mencapai akhir */}
          <div style={{ marginTop: 12, textAlign: 'center', fontSize: 11, color: 'var(--muted-foreground)' }}>
            {reachedBottom ? '✓ Anda telah membaca seluruh lembar persetujuan.' : '↓ Gulir ke bawah untuk membaca seluruh isi.'}
          </div>
        </div>

        {/* Footer — tombol tunggal */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          {error && (
            <p style={{ margin: '0 0 8px', fontSize: 11.5, color: '#b3261e' }}>{error}</p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!reachedBottom}
            style={{
              width: '100%', height: 42, borderRadius: 10, border: 'none', cursor: reachedBottom ? 'pointer' : 'not-allowed',
              fontSize: 13, fontWeight: 700,
              background: reachedBottom ? 'linear-gradient(135deg, #ff4d00, #ff6b2b)' : 'var(--muted)',
              color: reachedBottom ? '#fff' : 'var(--muted-foreground)',
              opacity: reachedBottom ? 1 : 0.6,
              transition: 'opacity .2s, background .2s',
            }}
          >
            Saya Setuju & Lanjutkan Mengisi
          </button>
        </div>
      </div>
    </div>
  );
}
