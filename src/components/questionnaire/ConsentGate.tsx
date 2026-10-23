'use client';

// ============================================================
// Persetujuan sebelum pengisian kuisioner kesehatan jiwa
// ============================================================
//
// Dasar: BG/QSHE/FORM/098 Rev.000 (Persetujuan Berbagi Informasi Kesehatan
// Jiwa) dan BG/QSHE/STD/006 Rev.002 Bab 8 poin 6: "Skrining kesehatan jiwa
// dilaksanakan setelah karyawan memperoleh penjelasan mengenai tujuan dan
// kerahasiaan hasilnya."
//
// Karyawan WAJIB membaca penjelasan dan memberi persetujuan sebelum mengisi
// SRQ-20, DASS-21, atau SDS-30. Tanpa persetujuan, form tidak bisa disimpan.
//
// Catatan penting: FORM/098 adalah formulir berbagi informasi Medic ↔ EAP.
// Untuk skrining, yang diminta di sini adalah PERSETUJUAN PARTISIPASI plus
// penjelasan kerahasiaan — bukan formulir rujukan EAP. Butir berbagi informasi
// EAP hanya ditampilkan bila petugas menandai karyawan dirujuk ke EAP.

import { useState } from 'react';

export interface ConsentState {
  accepted: boolean;
  acceptedAt: string | null;
  /** Butir berbagi informasi yang disetujui (FORM/098 bagian C). */
  shareItems: number[];
  /** true bila karyawan menolak berbagi ke EAP (tetap boleh mengisi skrining). */
  declineShare: boolean;
}

export const EMPTY_CONSENT: ConsentState = {
  accepted: false,
  acceptedAt: null,
  shareItems: [],
  declineShare: false,
};

/** Butir berbagi informasi FORM/098 bagian C. */
export const SHARE_ITEMS: { no: number; label: string; arah: string; grup: string }[] = [
  { no: 1, label: 'Alasan rujukan ke EAP', arah: 'QSHE Medic → EAP', grup: 'Saat rujukan (INK 016 poin 4.7.3 huruf a)' },
  { no: 2, label: 'Skor total SRQ-20', arah: 'QSHE Medic → EAP', grup: 'Saat rujukan (INK 016 poin 4.7.3 huruf a)' },
  { no: 3, label: 'Kategori DASS-21 per subskala (depresi, ansietas, stres)', arah: 'QSHE Medic → EAP', grup: 'Saat rujukan (INK 016 poin 4.7.3 huruf a)' },
  { no: 4, label: 'Kehadiran pada sesi konseling EAP', arah: 'EAP → QSHE Medic', grup: 'Selama dan setelah konseling (INK 016 poin 4.7.3 huruf b)' },
  { no: 5, label: 'Rekomendasi psikolog EAP: selesai, lanjut konseling, atau rujuk ke dokter', arah: 'EAP → QSHE Medic', grup: 'Selama dan setelah konseling (INK 016 poin 4.7.3 huruf b)' },
  { no: 6, label: 'Hasil skrining ulang SRQ-20 / DASS-21, apabila dilakukan oleh EAP', arah: 'EAP → QSHE Medic', grup: 'Selama dan setelah konseling (INK 016 poin 4.7.3 huruf b)' },
  { no: 7, label: 'Jawaban per butir SRQ-20 dan DASS-21', arah: 'QSHE Medic / dokter → EAP', grup: 'Khusus pendampingan Tanda Bahaya Kesehatan Jiwa (INK 016 poin 4.7.3 huruf d dan 4.8.1)' },
];

const PENJELASAN: string[] = [
  'Formulir ini mengatur informasi apa saja yang boleh dibagikan antara QSHE Medic dan psikolog Employee Assistance Program (EAP), agar konseling dan tindak lanjut medis berjalan selaras. Pembagian informasi hanya dilakukan untuk butir yang Anda setujui.',
  'EAP adalah layanan pendampingan. Psikolog EAP tidak menetapkan diagnosis, Zona Risiko PTM, maupun status kelayakan kerja. Penetapan tersebut tetap dilakukan oleh QSHE Medic berdasarkan penilaian dokter.',
  'Persetujuan diberikan secara sukarela. Menolak atau mencabut persetujuan tidak dikenai sanksi dan tidak dicatat dalam berkas kepegawaian.',
  'Isi konseling tetap berada pada psikolog EAP. Namun bila ditemukan tanda bahaya atau kondisi yang membahayakan keselamatan karyawan maupun orang lain, psikolog EAP wajib segera menyampaikannya kepada QSHE Medic. Ketentuan ini berlaku tanpa memerlukan persetujuan pada formulir ini.',
  'Atasan dan personel Departemen HCGS di luar tim EAP hanya menerima status kelayakan kerja dan pembatasan kerja, tanpa skor skrining maupun diagnosis.',
  'Catatan konseling EAP disimpan terpisah dari berkas kepegawaian dan tidak dapat digunakan sebagai dasar penilaian kinerja, promosi, mutasi, sanksi, maupun pemutusan hubungan kerja.',
  'Anda dapat mencabut persetujuan ini seluruhnya atau sebagian kapan saja tanpa dikenai sanksi. Pencabutan berlaku sejak diterima QSHE Medic dan tidak berlaku surut atas informasi yang telah dibagikan.',
  'Persetujuan ini berlaku untuk satu rujukan sampai pendampingan EAP dinyatakan selesai. Rujukan baru memerlukan formulir baru.',
  'Data hasil pemeriksaan bersifat rahasia dan merupakan data pribadi yang bersifat spesifik sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.',
];

/**
 * Panel persetujuan. `onAccept` dipanggil saat karyawan menyetujui dan mengisi
 * nama sebagai tanda tangan digital.
 */
export default function ConsentGate({
  instrumen,
  onAccept,
}: {
  /** Nama instrumen yang akan diisi, ditampilkan agar konteks jelas. */
  instrumen: string;
  onAccept: (consent: ConsentState) => void;
}) {
  const [checkedRead, setCheckedRead] = useState(false);
  const [agree, setAgree] = useState(false);
  const [nama, setNama] = useState('');
  const [share, setShare] = useState<number[]>([]);
  const [declineShare, setDeclineShare] = useState(false);
  const [error, setError] = useState('');

  const canContinue = checkedRead && agree && nama.trim().length >= 3;

  function submit() {
    if (!canContinue) {
      setError('Baca penjelasan, centang kedua pernyataan, dan isi nama lengkap sebagai tanda tangan.');
      return;
    }
    if (!declineShare && share.length === 0) {
      setError('Pilih minimal satu butir berbagi informasi, atau pilih "Tidak menyetujui berbagi informasi".');
      return;
    }
    setError('');
    onAccept({
      accepted: true,
      acceptedAt: new Date().toISOString(),
      shareItems: declineShare ? [] : share,
      declineShare,
    });
  }

  const grouped = SHARE_ITEMS.reduce<Record<string, typeof SHARE_ITEMS>>((acc, item) => {
    (acc[item.grup] ||= []).push(item);
    return acc;
  }, {});

  return (
    <div className="qh-page" style={{ maxWidth: 860, margin: '0 auto' }}>
      <header className="qh-page-head">
        <h2>Persetujuan Sebelum Pengisian</h2>
        <p>
          Instrumen <b>{instrumen}</b> merupakan skrining kesehatan jiwa. Bacalah penjelasan berikut
          sebelum melanjutkan. Formulir ini mengikuti <b>BG/QSHE/FORM/098 Rev.000</b>.
        </p>
      </header>

      <section className="qh-card">
        <h3 className="qh-card-title">A. Penjelasan kepada Karyawan</h3>
        <ol className="qh-description" style={{ margin: '4px 0 0', paddingLeft: 18, lineHeight: 1.7, fontSize: 12.5 }}>
          {PENJELASAN.map((p, i) => (
            <li key={i} style={{ marginBottom: 6 }}>{p}</li>
          ))}
        </ol>
        <p
          style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 8, fontSize: 12,
            background: 'rgba(255,45,45,0.07)', border: '1px solid rgba(255,45,45,0.35)', color: '#b3261e',
          }}
        >
          <b>Tanda bahaya.</b> Bila Anda memiliki pikiran untuk mengakhiri hidup, segera sampaikan
          kepada petugas kesehatan. Hal ini wajib ditindaklanjuti dokter pada hari yang sama dan
          bersifat menyelamatkan — bukan pelanggaran kerahasiaan.
        </p>
      </section>

      <section className="qh-card">
        <h3 className="qh-card-title">B. Persetujuan Berbagi Informasi (FORM/098 Bagian C)</h3>
        <p className="qh-description" style={{ fontSize: 12 }}>
          Beri tanda (✓) pada butir yang Anda setujui. Butir yang tidak ditandai dianggap tidak disetujui.
        </p>

        <label
          className={`qh-radio${declineShare ? ' qh-radio-active' : ''}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 10, cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            checked={declineShare}
            onChange={(e) => { setDeclineShare(e.target.checked); if (e.target.checked) setShare([]); }}
          />
          <span className="qh-radio-dot" aria-hidden="true" />
          <span className="qh-radio-label">Saya tidak menyetujui berbagi informasi apa pun</span>
        </label>

        {!declineShare && Object.entries(grouped).map(([grup, items]) => (
          <div key={grup} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: 4 }}>{grup}</div>
            {items.map((item) => {
              const on = share.includes(item.no);
              return (
                <label
                  key={item.no}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px',
                    borderRadius: 7, cursor: 'pointer', fontSize: 12,
                    background: on ? 'rgba(255,77,0,0.06)' : 'transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => setShare((prev) => e.target.checked
                      ? [...prev, item.no].sort((a, b) => a - b)
                      : prev.filter((n) => n !== item.no))}
                    style={{ marginTop: 2 }}
                  />
                  <span style={{ flex: 1 }}>
                    <b>{item.no}.</b> {item.label}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{item.arah}</span>
                </label>
              );
            })}
          </div>
        ))}

        <p style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.6, marginTop: 6 }}>
          <b>Informasi yang tidak dibagikan:</b> isi konseling tetap berada pada psikolog EAP; jawaban
          per butir SRQ-20 dan DASS-21 tetap berada pada QSHE Medic dan dokter, kecuali butir 7
          disetujui; serta informasi kesehatan lain yang tidak tercantum di atas.
        </p>
      </section>

      <section className="qh-card">
        <h3 className="qh-card-title">C. Pernyataan Karyawan</h3>

        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, marginBottom: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={checkedRead} onChange={(e) => setCheckedRead(e.target.checked)} style={{ marginTop: 3 }} />
          <span>Saya telah membaca dan memahami seluruh penjelasan pada bagian A, dan diberi kesempatan untuk bertanya.</span>
        </label>

        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, marginBottom: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3 }} />
          <span>
            Saya memberikan persetujuan sebagaimana tercantum pada bagian B secara <b>sukarela</b>,
            tanpa paksaan dari pihak mana pun.
          </span>
        </label>

        <label className="qh-label" htmlFor="qh-consent-nama">Nama lengkap (sebagai tanda tangan digital)</label>
        <input
          id="qh-consent-nama"
          className="qh-input"
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          placeholder="Tulis nama lengkap Anda"
          autoComplete="name"
        />
      </section>

      {error && (
        <div style={{ padding: '9px 12px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', border: '1px solid rgba(255,45,45,0.35)', color: '#b3261e', fontSize: 12 }}>
          {error}
        </div>
      )}

      <div className="qh-submitbar">
        <p className="qh-hint">
          Persetujuan ini dicatat beserta waktu pengisian pada rekam skrining Anda.
        </p>
        <div className="qh-submitbar-actions">
          <button
            type="button"
            className="qh-btn qh-btn-primary"
            onClick={submit}
            disabled={!canContinue}
            style={{ opacity: canContinue ? 1 : 0.55, cursor: canContinue ? 'pointer' : 'not-allowed' }}
          >
            Saya Setuju & Lanjutkan
          </button>
        </div>
      </div>
    </div>
  );
}
