'use client';

// ============================================================
// Halaman Gangguan Tidur — Epworth Sleepiness Scale (ESS)
// ============================================================
//
// Sesuai STD-006 Rev001, parameter zonasi ini bernama "Gangguan Tidur /
// Excessive Daytime Sleepiness" dan menilai KANTUK BERLEBIHAN DI SIANG HARI
// yang mengganggu kualitas tidur, konsentrasi, dan kewaspadaan. Bukan
// pengukuran kualitas tidur secara umum — itu di luar lingkup ESS.
//
// Penting untuk keselamatan: STD-006 menyatakan ESS di atas 15 berarti
// "tidak layak operasi alat berat / shift malam". Kantuk siang hari adalah
// faktor risiko yang nyata bagi operator alat berat dan pekerja shift malam.
//
// Jadwalnya lebih sering daripada MCU (misal setiap 3 atau 6 bulan), dan
// tidak bergantung pada MCU. Hasilnya disimpan per tanggal di tabel mcu_ess,
// sehingga riwayat lengkapnya tidak pernah tertimpa oleh pemeriksaan baru.
// ============================================================

import { useState } from 'react';

import { ESS_ITEMS } from '@/lib/questionnaire-items';
import {
  IdentityPanel,
  ItemGroup,
  ResultDialog,
  StatusBanner,
  SubmitBar,
  questionnaireAuthHeaders,
  toneFor,
  useEmployeeLookup,
  useSubmitStatus,
  type ResultDialogData,
} from '@/components/questionnaire/QuestionnaireUI';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function GangguanTidurPage() {
  const { query, setQuery, identity, searching, error, search } = useEmployeeLookup('/api/ess');
  const submit = useSubmitStatus();

  const [values, setValues] = useState<Record<string, string>>({});
  const [tglEss, setTglEss] = useState(today());
  const [resultDialog, setResultDialog] = useState<ResultDialogData | null>(null);

  const filled = ESS_ITEMS.filter((item) => values[item.id] !== undefined && values[item.id] !== '').length;

  function setAnswer(id: string, value: string) {
    setValues((prev) => ({ ...prev, [id]: value }));
  }

  function clearForm() {
    setValues({});
    setResultDialog(null);
    submit.setStatus('idle');
    submit.setMessage('');
  }

  async function handleSave() {
    if (!identity) {
      submit.failure('Cari karyawan lebih dulu.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tglEss)) {
      submit.failure('Tanggal ESS wajib diisi dengan format YYYY-MM-DD.');
      return;
    }

    submit.setStatus('saving');
    submit.setMessage('');
    try {
      const headers = await questionnaireAuthHeaders();
      const res = await fetch('/api/ess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ query, tglEss, ...values }),
      });
      const body = await res.json();
      if (!res.ok) {
        submit.failure(body.error ?? 'Gagal menyimpan hasil ESS.');
        return;
      }

      setValues({});
      setResultDialog({
        nama: identity.nama,
        tanggal: tglEss,
        lines: [
          { label: 'Item terisi', value: `${body.result.answered} / ${body.result.total}` },
          { label: 'Skor ESS', value: String(body.result.score) },
          { label: 'Kategori', value: body.result.label, tone: toneFor(body.result.category) },
        ],
        kesimpulan: body.kesimpulan ?? '',
        zonaMCU: body.zonasi ?? null,
        mcuUpdated: body.mcuUpdated ?? 0,
      });
    } catch {
      submit.failure('Gagal menghubungi server. Coba lagi.');
    }
  }

  const canSave = !!identity && filled > 0 && submit.status !== 'saving';

  return (
    <div className="qh-page">
      <header className="qh-page-head">
        <h2>Gangguan Tidur</h2>
        <p>
          Epworth Sleepiness Scale — parameter <strong>Kualitas Tidur</strong> pada STD-006 Rev001.
          Delapan pertanyaan tentang kantuk di berbagai situasi, skor 0 sampai 32.
        </p>
        <p>
          ESS di atas 15 berarti <strong>tidak layak operasi alat berat atau shift malam</strong>.
          Jadwalkan pemeriksaan ini secara berkala, tidak hanya saat MCU.
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
            <label className="qh-label" htmlFor="qh-ess-date">Tanggal ESS</label>
            <input
              id="qh-ess-date"
              type="date"
              className="qh-input"
              value={tglEss}
              onChange={(e) => setTglEss(e.target.value)}
            />
          </div>
        </div>
      </IdentityPanel>

      <ItemGroup
        title="Delapan Situasi Kantuk"
        subtitle="Dalam keadaan seperti apa biasanya Anda merasa mengantuk"
        description="Pilih jawaban yang paling menggambarkan kondisi dalam dua minggu terakhir."
        items={ESS_ITEMS}
        values={values}
        onChange={setAnswer}
        columns={5}
        optionLabels={['Tidak pernah', 'Jarang', 'Kadang', 'Sering', 'Hampir setiap hari']}
      />

      <SubmitBar
        disabled={!canSave}
        saving={submit.status === 'saving'}
        onSubmit={handleSave}
        onReset={clearForm}
      />

      <ResultDialog data={resultDialog} onClose={() => setResultDialog(null)} />
    </div>
  );
}