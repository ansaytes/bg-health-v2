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

import { SDS_ITEMS, SDS_OPTIONS, SDS_SECTIONS } from '@/lib/questionnaire-items';
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
  type ScoreLine,
} from '@/components/questionnaire/QuestionnaireUI';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function countFilled(items: { id: string }[], values: Record<string, string>): number {
  return items.filter((item) => values[item.id] !== undefined && values[item.id] !== '').length;
}

function barisHasil(body: any): ScoreLine[] {
  const lines: ScoreLine[] = [];
  const sds = body.sds;

  if (sds?.answered > 0) {
    lines.push({
      label: 'SDS-30',
      value: `${sds.label} · total ${sds.rawIndex}/210`,
      tone: toneFor(sds.category),
    });
    for (const ind of (sds.indicators || [])) {
      lines.push({
        label: `· ${ind.title}`,
        value: `${ind.score}/35 — ${ind.label}`,
        tone: toneFor(ind.category),
      });
    }
  }

  return lines;
}

export default function InputPsikologiLingkunganPage() {
  const { query, setQuery, identity, searching, error, search } = useEmployeeLookup('/api/mental-health');
  const submit = useSubmitStatus();

  const [values, setValues] = useState<Record<string, string>>({});
  const [tglPemeriksaan, setTglPemeriksaan] = useState(today());
  const [resultDialog, setResultDialog] = useState<ResultDialogData | null>(null);
  // Petunjuk penilaian per indikator hanya untuk PETUGAS, bisa dibuka-tutup dan
  // tertutup secara default agar responden tidak melihatnya saat mengisi.
  const [showGuidance, setShowGuidance] = useState(false);

  const sdsFilled = countFilled(SDS_ITEMS, values);

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
        body: JSON.stringify({ query, tglPemeriksaan, ...values }),
      });
      const body = await res.json();
      if (!res.ok) {
        submit.failure(body.error ?? 'Gagal menyimpan hasil SDS-30.');
        return;
      }

      setResultDialog({
        nama: identity.nama,
        tanggal: tglPemeriksaan,
        lines: barisHasil(body),
        kesimpulan: body.kesimpulan ?? '',
        zonaMCU: body.zonasi ?? null,
        mcuUpdated: body.mcuUpdated ?? 0,
      });
    } catch {
      submit.failure('Gagal menghubungi server. Coba lagi.');
    }
  }

  const canSave = !!identity && sdsFilled > 0 && submit.status !== 'saving';

  return (
    <div className="qh-page">
      <header className="qh-page-head">
        <h2>Psikologi Lingkungan Kerja — SDS-30</h2>
        <p>
          30 pernyataan tentang kondisi kerja dalam <b>1 bulan terakhir</b>. Skor dipakai untuk
          pemetaan risiko psikologis per departemen (Higiene Industri), bukan diagnosis klinis.
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

      <div className="qh-description" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span>
          Pilih angka <b>1–7</b> untuk setiap pernyataan sesuai keterangan di bawah.
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 11, lineHeight: 1.6 }}>
          {SDS_OPTIONS.map((o) => (
            <span key={o.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <b style={{ display: 'inline-grid', placeItems: 'center', width: 18, height: 18, borderRadius: 4, background: 'var(--accent)', color: '#ff4d00', fontSize: 10 }}>{o.value}</b>
              {o.label}
            </span>
          ))}
        </div>

        {/* Petunjuk penilaian (untuk petugas) — disembunyikan dari pandangan responden. */}
        <div>
          <button
            type="button"
            onClick={() => setShowGuidance((v) => !v)}
            className="qh-btn"
            style={{ height: 28, padding: '0 12px', fontSize: 11.5 }}
            aria-expanded={showGuidance}
          >
            {showGuidance ? 'Sembunyikan' : 'Tampilkan'} petunjuk penilaian (petugas)
          </button>
          {showGuidance && (
            <div
              style={{
                marginTop: 8,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px dashed var(--border)',
                background: 'var(--accent)',
                fontSize: 11.5,
                lineHeight: 1.7,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Pembagian item untuk penilaian (Lampiran Permenaker 5/2018)</div>
              {SDS_SECTIONS.map((section) => (
                <div key={section.id}>
                  <b>{section.title}</b>: item {section.items.join(', ')}
                </div>
              ))}
              <div style={{ marginTop: 4, color: 'var(--muted-foreground)' }}>
                Skor indikator 5–35: ≤ 9 ringan · 10–24 sedang · &gt; 24 berat. Kategori tidak
                ditampilkan saat pengisian agar jawaban tidak terarah.
              </div>
            </div>
          )}
        </div>
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
  );
}
