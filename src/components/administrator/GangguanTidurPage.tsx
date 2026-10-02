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
import { essBandLabel, scoreEss } from '@/lib/questionnaire-scores';
import {
  HistoryTable,
  IdentityPanel,
  ItemGroup,
  ResultDialog,
  ResultPanel,
  StatusBanner,
  SubmitBar,
  toneFor,
  useEmployeeLookup,
  useSubmitStatus,
  type ResultDialogData,
} from '@/components/questionnaire/QuestionnaireUI';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface EssHistoryRow {
  tanggal: string;
  skor: number | null;
  kategori: string;
  interpretasi: string;
  jumlah_terisi: number | null;
  catatan: string | null;
  dipakaiMCU: boolean;
}

export default function GangguanTidurPage() {
  const { query, setQuery, identity, history, setHistory, searching, error, search } = useEmployeeLookup('/api/ess');
  const submit = useSubmitStatus();

  const [values, setValues] = useState<Record<string, string>>({});
  const [tglEss, setTglEss] = useState(today());
  const [lokasiEss, setLokasiEss] = useState('');
  const [petugas, setPetugas] = useState('');
  const [catatan, setCatatan] = useState('');
  const [saved, setSaved] = useState<{ score: number; category: string; label: string; zonasi: string | null; mcuUpdated: number } | null>(null);
  const [resultDialog, setResultDialog] = useState<ResultDialogData | null>(null);

  const filled = ESS_ITEMS.filter((item) => values[item.id] !== undefined && values[item.id] !== '').length;
  const preview = scoreEss(values);

  function setAnswer(id: string, value: string) {
    setValues((prev) => ({ ...prev, [id]: value }));
  }

  async function refreshHistory() {
    if (!identity) return;
    const res = await fetch(`/api/ess?query=${encodeURIComponent(identity.nikKaryawan)}`);
    const body = await res.json();
    if (res.ok) setHistory(body.history ?? []);
  }

  function clearForm() {
    setValues({});
    setCatatan('');
    setSaved(null);
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
      const res = await fetch('/api/ess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, tglEss, lokasiEss, petugas, catatan, ...values }),
      });
      const body = await res.json();
      if (!res.ok) {
        submit.failure(body.error ?? 'Gagal menyimpan hasil ESS.');
        return;
      }

      setSaved({
        score: body.result.score,
        category: body.result.category,
        label: body.result.label,
        zonasi: body.zonasi ?? null,
        mcuUpdated: body.mcuUpdated ?? 0,
      });
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
      await refreshHistory();
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
          <div>
            <label className="qh-label" htmlFor="qh-ess-location">Lokasi</label>
            <input
              id="qh-ess-location"
              className="qh-input"
              value={lokasiEss}
              onChange={(e) => setLokasiEss(e.target.value)}
              placeholder="Opsional"
            />
          </div>
          <div>
            <label className="qh-label" htmlFor="qh-ess-petugas">Petugas</label>
            <input
              id="qh-ess-petugas"
              className="qh-input"
              value={petugas}
              onChange={(e) => setPetugas(e.target.value)}
              placeholder="Opsional"
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

      <div className="qh-two-col">
        <ResultPanel
          title="Pratinjau Hasil"
          lines={[
            { label: 'Item terisi', value: `${filled} / ${ESS_ITEMS.length}` },
            { label: 'Skor ESS', value: filled > 0 ? String(preview.score) : '—', tone: toneFor(preview.category) },
            { label: 'Kategori', value: filled > 0 ? preview.label : '—' },
          ]}
          footer={filled > 0 && filled < ESS_ITEMS.length
            ? 'Skor dihitung dengan prorata dari item yang terisi. Simpan setelah semua delapan item dijawab.'
            : 'Normal di bawah 11, kantuk berlebihan ringan–sedang 11–15, berat di atas 15.'}
        />

        {saved && (
          <ResultPanel
            title="Hasil Tersimpan"
            lines={[
              { label: 'Skor ESS', value: String(saved.score) },
              { label: 'Kategori', value: saved.label, tone: toneFor(saved.category) },
              { label: 'MCU yang ikut diperbarui', value: String(saved.mcuUpdated) },
            ]}
            zonasi={saved.zonasi}
            footer="MCU yang diperiksa SEBELUM tanggal ESS ini tidak diubah: zonanya mengunci hasil kuesioner yang berlaku saat pemeriksaannya."
          />
        )}
      </div>

      <div className="qh-card">
        <label className="qh-label" htmlFor="qh-ess-note">Catatan</label>
        <textarea
          id="qh-ess-note"
          className="qh-textarea"
          rows={3}
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Opsional, misalnya jam tidur, keluhan kantuk di siang hari, jam kerja shift malam, atau catatan rujukan."
        />
      </div>

      <div className="qh-card">
        <h3 className="qh-card-title">Riwayat Gangguan Tidur</h3>
        <p className="qh-description">
          Satu baris per tanggal pengukuran. Baris bertanda <strong>dipakai MCU</strong> adalah skor
          yang mengunci zona pada record MCU tersebut.
        </p>
        {!identity ? (
          <p className="qh-description">Cari karyawan lebih dulu untuk melihat riwayat.</p>
        ) : (
          <HistoryTable
            rows={(history as EssHistoryRow[]).map((row) => ({
              tanggal: row.tanggal,
              ringkasan: row.skor !== null ? `ESS ${row.skor} — ${row.interpretasi || essBandLabel(Number(row.skor))}` : 'Normal (tanpa angka)',
              detail: [
                row.jumlah_terisi !== null ? `${row.jumlah_terisi}/8 item` : null,
                row.catatan,
              ].filter(Boolean).join(' · ') || null,
              dipakaiMCU: row.dipakaiMCU,
            }))}
            empty="Belum ada hasil ESS untuk karyawan ini."
          />
        )}
      </div>

      <SubmitBar
        disabled={!canSave}
        saving={submit.status === 'saving'}
        onSubmit={handleSave}
        onReset={clearForm}
        hint="ESS untuk tanggal yang sama menimpa hasil sebelumnya. Tanggal berbeda menjadi riwayat baru."
      />

      <ResultDialog data={resultDialog} onClose={() => setResultDialog(null)} />
    </div>
  );
}