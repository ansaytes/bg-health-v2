'use client';

// ============================================================
// Data Entry > Psikologi Lingkungan Kerja (SDS-30)
// ============================================================
//
// SDS-30 (Survei Diagnosis Stres, Lampiran Permenaker 5/2018) mengukur FAKTOR
// PSIKOLOGI LINGKUNGAN KERJA — berbeda dari SRQ-20/DASS-21 yang mengukur gejala
// klinis individu. Karena itu ia berdiri sebagai menu sendiri.
//
// Soal disajikan sebagai satu daftar bernomor 1–30 TANPA dikelompokkan per
// indikator. Nomor item tiap indikator (ketaksaan peran, konflik peran, dst.)
// hanya disampaikan sebagai PETUNJUK PENILAIAN bagi petugas — kalau kategori
// ditulis di samping soal, responden bisa menebak arah jawaban yang "diinginkan"
// dan data menjadi tidak valid. Permenaker memang membagi 30 item menjadi 6
// indikator × 5 item, tetapi pembagian itu untuk penilaian, bukan untuk
// ditampilkan saat pengisian.
//
// Data disimpan ke endpoint /api/mental-health yang sama (satu baris per
// karyawan per tanggal), hanya dengan item SDS yang terisi.

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';

import { SDS_ITEMS, SDS_OPTIONS } from '@/lib/questionnaire-items';
import SdsAnswersTable from '@/components/administrator/SdsAnswersTable';
import ConsentGate, { EMPTY_CONSENT, type ConsentState } from '@/components/questionnaire/ConsentGate';
import {
  IdentityPanel,
  ItemGroup,
  ResultDialog,
  StatusBanner,
  SubmitBar,
  questionnaireAuthHeaders,
  useEmployeeLookup,
  useSubmitStatus,
  type ResultDialogData,
} from '@/components/questionnaire/QuestionnaireUI';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function countFilled(items: { id: string }[], values: Record<string, string>): number {
  return items.filter((item) => values[item.id] !== undefined && values[item.id] !== '').length;
}

export default function InputPsikologiLingkunganPage() {
  const { query, setQuery, identity, searching, error, search } = useEmployeeLookup('/api/mental-health');
  const submit = useSubmitStatus();
  const { role } = useAuth();
  // Tabel data jawaban hanya untuk superuser & administrator.
  const canViewData = role === 'superuser' || role === 'administrator';

  const [values, setValues] = useState<Record<string, string>>({});
  const [tglPemeriksaan, setTglPemeriksaan] = useState(today());
  const [resultDialog, setResultDialog] = useState<ResultDialogData | null>(null);
  const [showData, setShowData] = useState(false);
  const [rotation, setRotation] = useState(0);
  // Persetujuan (FORM/098) wajib sebelum pengisian.
  const [consent, setConsent] = useState<ConsentState>(EMPTY_CONSENT);

  const sdsFilled = countFilled(SDS_ITEMS, values);

  function setAnswer(id: string, value: string) {
    setValues((prev) => ({ ...prev, [id]: value }));
  }

  function clearForm() {
    setValues({});
    setResultDialog(null);
    setConsent(EMPTY_CONSENT);
    submit.setStatus('idle');
    submit.setMessage('');
  }

  async function handleSave() {
    if (!identity) {
      submit.failure('Cari karyawan lebih dulu.');
      return;
    }
    if (!consent.accepted) {
      submit.failure('Persetujuan (FORM/098) wajib diberikan sebelum menyimpan hasil skrining.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tglPemeriksaan)) {
      submit.failure('Tanggal pemeriksaan wajib diisi dengan format YYYY-MM-DD.');
      return;
    }

    submit.setStatus('saving');
    submit.setMessage('');
    try {
      const headers = await questionnaireAuthHeaders();
      const res = await fetch('/api/mental-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          query,
          tglPemeriksaan,
          ...values,
          consent: {
            acceptedAt: consent.acceptedAt,
            shareItems: consent.shareItems,
            declineShare: consent.declineShare,
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        submit.failure(body.error ?? 'Gagal menyimpan hasil SDS-30.');
        return;
      }

      // SDS-30 menilai LINGKUNGAN KERJA, bukan individu. Karena itu hasilnya
      // tidak ditampilkan sebagai "nilai" kepada pengisi: skor individual baru
      // bermakna setelah diagregasi per departemen/jabatan. Peserta cukup
      // menerima ucapan terima kasih dan penjelasan penggunaan datanya.
      setResultDialog({
        nama: identity.nama,
        tanggal: tglPemeriksaan,
        lines: [],
        kesimpulan:
          `Terima kasih atas partisipasi Anda dalam proses pemetaan psikologi lingkungan kerja. `
          + `Hasil pengisian ini akan dijadikan sebagai acuan pengelolaan kesehatan kerja `
          + `PT. Bagong Dekaka Makmur.`,
        zonaMCU: null,
        mcuUpdated: 0,
      });
    } catch {
      submit.failure('Gagal menghubungi server. Coba lagi.');
    }
  }

  const canSave = !!identity && sdsFilled > 0 && consent.accepted && submit.status !== 'saving';

  // Gerbang persetujuan wajib sebelum pengisian (FORM/098).
  if (!consent.accepted) {
    return (
      <ConsentGate
        instrumen="SDS-30 (Psikologi Lingkungan Kerja)"
        onAccept={(c) => setConsent(c)}
      />
    );
  }

  return (
    <div className="qh-page" style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      <AnimatePresence mode="wait">
        {!showData ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ height: '100%', overflowY: 'auto' }}
          >
            <div>
              <header className="qh-page-head">
        <h2>Psikologi Lingkungan Kerja — SDS-30</h2>
        <p>
          30 pernyataan kondisi kerja <b>1 bulan terakhir</b>. Skor dan kategori dihitung
          otomatis oleh sistem untuk pemetaan risiko psikologis per departemen (Higiene Industri).
        </p>
      </header>

      <StatusBanner status={error ? 'error' : submit.status} message={error || submit.message} />

      <IdentityPanel
        query={query}
        onQueryChange={setQuery}
        onSearch={() => search()}
        searching={searching}
        identity={identity}
      >
        <div className="qh-fields-grid">
          <div>
            <label className="qh-label" htmlFor="qh-sds-date">Tanggal Pemeriksaan</label>
            <input
              id="qh-sds-date"
              type="date"
              className="qh-input"
              value={tglPemeriksaan}
              onChange={(e) => setTglPemeriksaan(e.target.value)}
            />
          </div>
        </div>
      </IdentityPanel>

      <div className="qh-description">
        {/* Petunjuk diringkas satu baris agar tidak memakan tempat.
            Kategori/indikator TIDAK ditampilkan di samping soal: skor
            dihitung otomatis oleh sistem, sehingga responden tidak bisa
            menebak arah jawaban yang "diinginkan". */}
        <span style={{ fontSize: 10, lineHeight: 1.5, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden' }}>
          Pilih <b>1–7</b> tiap pernyataan (kondisi <b>1 bulan terakhir</b>):
          {SDS_OPTIONS.map((o, i) => (
            <span key={o.value}>·{i === 0 ? ' ' : ' '}<b>{o.value}</b> {o.label} </span>
          ))}
        </span>
      </div>

      {/* Satu daftar 1–30, tanpa judul kategori per blok. */}
      <ItemGroup
        title="SDS-30"
        subtitle="Survei Diagnosis Stres — Permenaker 5/2018"
        items={SDS_ITEMS}
        values={values}
        onChange={setAnswer}
        columns={7}
        optionLabels={['1', '2', '3', '4', '5', '6', '7']}
      />

      <SubmitBar
        disabled={!canSave}
        saving={submit.status === 'saving'}
        onSubmit={handleSave}
        onReset={clearForm}
        hint={`${sdsFilled} dari ${SDS_ITEMS.length} pernyataan terisi`}
      />

      <ResultDialog data={resultDialog} onClose={() => setResultDialog(null)} />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="data"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ height: '100%', overflow: 'auto', paddingRight: 32 }}
          >
            <SdsAnswersTable />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tombol panah hanya terlihat untuk superuser & administrator. */}
      {canViewData && (
        <button
          type="button"
          onClick={() => { setRotation((r) => r + 180); setShowData((v) => !v); }}
          className="admin-toggle-arrow"
          title={showData ? 'Kembali ke form' : 'Lihat data jawaban'}
          aria-label={showData ? 'Kembali ke form' : 'Lihat data jawaban'}
        >
          <motion.svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ rotate: rotation }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <polyline points="9 6 15 12 9 18" />
          </motion.svg>
        </button>
      )}
    </div>
  );
}
