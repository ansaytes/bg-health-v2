'use client';

// ============================================================
// Halaman Input Kesehatan Mental — SRQ-20, DASS-21, Zung SDS
// ============================================================
//
// Ketiganya menilai kondisi mental yang sama dan sering diisi dalam satu sesi,
// jadi digabung dalam satu halaman dengan tiga bagian. Assessor boleh mengisi
// sebagian saja; yang tidak diisi tidak dihitung.
//
// Semua instrumen disimpan pada satu baris per karyawan per tanggal.
// Pengukuran ulang pada tanggal yang sama menimpa baris lama. Setelah
// tersimpan, skor terakhir disalin ke MCU terbaru dan zonasi dihitung ulang.
//
// ============================================================

import { useState } from 'react';

import { DASS21_ITEMS, DASS21_SECTIONS, SDS_ITEMS, SRQ20_ITEMS } from '@/lib/questionnaire-items';
import { scoreDass21, scoreSds, scoreSrq20 } from '@/lib/questionnaire-scores';
import {
  IdentityPanel,
  ItemGroup,
  ResultDialog,
  ResultPanel,
  StatusBanner,
  SubmitBar,
  questionnaireAuthHeaders,
  toneFor,
  useEmployeeLookup,
  useSubmitStatus,
  type ResultDialogData,
  type ScoreLine,
} from '@/components/questionnaire/QuestionnaireUI';

type Section = 'srq20' | 'dass21' | 'sds';

const SECTION_LABEL: Record<Section, string> = {
  srq20: 'SRQ-20',
  dass21: 'DASS-21',
  sds: 'Zung SDS',
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function countFilled(items: { id: string }[], values: Record<string, string>): number {
  return items.filter((item) => values[item.id] !== undefined && values[item.id] !== '').length;
}

/**
 * Menyusun baris hasil untuk popup dari respons server.
 *
 * Hanya instrumen yang benar-benar diisi yang ditampilkan. Menampilkan skor 0
 * untuk instrumen yang tidak diisi akan menyesatkan: pada DASS-21, "0" berarti
 * "tidak ada gejala sama sekali", bukan "tidak menjawab".
 */
function barisHasil(body: any): ScoreLine[] {
  const lines: ScoreLine[] = [];

  if (body.srq20?.answered > 0) {
    lines.push({
      label: 'SRQ-20',
      value: `${body.srq20.score} — ${body.srq20.label}`,
      tone: toneFor(body.srq20.category),
    });
  }

  const dass = body.dass21;
  if (dass?.answered > 0) {
    lines.push({
      label: 'DASS-21 depresi',
      value: `${dass.depresi.score} — ${dass.depresi.label}`,
      tone: toneFor(dass.depresi.category),
    });
    lines.push({
      label: 'DASS-21 ansietas',
      value: `${dass.ansietas.score} — ${dass.ansietas.label}`,
      tone: toneFor(dass.ansietas.category),
    });
    lines.push({
      label: 'DASS-21 stres',
      value: `${dass.stres.score} — ${dass.stres.label}`,
      tone: toneFor(dass.stres.category),
    });
  }

  if (body.sds?.answered > 0) {
    lines.push({
      label: 'Zung SDS',
      value: `${body.sds.rawIndex} — ${body.sds.label}`,
      tone: toneFor(body.sds.category),
    });
  }

  lines.push({
    label: 'Perlu rujukan',
    value: body.perluRujukan ? 'Ya' : 'Tidak',
    tone: body.perluRujukan ? 'bad' : 'good',
  });

  return lines;
}

export default function InputMentalHealthPage() {
  const { query, setQuery, identity, searching, error, search } = useEmployeeLookup('/api/mental-health');
  const submit = useSubmitStatus();

  const [values, setValues] = useState<Record<string, string>>({});
  const [active, setActive] = useState<Section>('srq20');
  const [tglPemeriksaan, setTglPemeriksaan] = useState(today());
  const [saved, setSaved] = useState<{ ringkasan: string; perluRujukan: boolean; zonasi: string | null; mcuUpdated: number } | null>(null);
  const [resultDialog, setResultDialog] = useState<ResultDialogData | null>(null);

  const srqFilled = countFilled(SRQ20_ITEMS, values);
  const dassFilled = countFilled(DASS21_ITEMS, values);
  const sdsFilled = countFilled(SDS_ITEMS, values);

  const srqPreview = scoreSrq20(values);
  const dassPreview = scoreDass21(values);
  const sdsPreview = scoreSds(values);

  function setAnswer(id: string, value: string) {
    setValues((prev) => ({ ...prev, [id]: value }));
  }

  function clearForm() {
    setValues({});
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
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        submit.failure(body.error ?? 'Gagal menyimpan hasil kesehatan mental.');
        return;
      }

      setSaved({
        ringkasan: body.ringkasan ?? '',
        perluRujukan: body.perluRujukan,
        zonasi: body.zonasi ?? null,
        mcuUpdated: body.mcuUpdated ?? 0,
      });
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

  const anyFilled = srqFilled + dassFilled + sdsFilled > 0;
  const canSave = !!identity && anyFilled && submit.status !== 'saving';

  return (
    <div className="qh-page">
      <header className="qh-page-head">
        <h2>Input Kesehatan Mental</h2>
        <p>
          SRQ-20, DASS-21, dan Zung SDS — parameter MENTAL HEALTH pada STD-006 Rev001.
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
            <label className="qh-label" htmlFor="qh-mh-date">Tanggal Pemeriksaan</label>
            <input
              id="qh-mh-date"
              type="date"
              className="qh-input"
              value={tglPemeriksaan}
              onChange={(e) => setTglPemeriksaan(e.target.value)}
            />
          </div>
        </div>
      </IdentityPanel>

      <nav className="qh-tabs">
        {(['srq20', 'dass21', 'sds'] as Section[]).map((section) => {
          const filled =
            section === 'srq20' ? srqFilled : section === 'dass21' ? dassFilled : sdsFilled;
          return (
            <button
              key={section}
              type="button"
              className={`qh-tab${active === section ? ' qh-tab-active' : ''}`}
              onClick={() => setActive(section)}
            >
              {SECTION_LABEL[section]}
              <span className="qh-tab-count">{filled}</span>
            </button>
          );
        })}
      </nav>

      {active === 'srq20' && (
        <ItemGroup
          title="SRQ-20"
          subtitle="Self-Reporting Questionnaire-20 (WHO)"
          description="Instrumen skrining gangguan mental emosional yang tervalidasi di Indonesia oleh Kemenkes RI. Skor 6 atau lebih berarti perlu tindak lanjut."
          items={SRQ20_ITEMS}
          values={values}
          onChange={setAnswer}
          columns={2}
          optionLabels={['Tidak', 'Ya']}
        />
      )}

      {active === 'dass21' && (
        <>
          <p className="qh-description">
            Dua puluh satu pernyataan diukur pada tiga skala terpisah: depresi, ansietas, dan stres.
            Pernyataan dikelompokkan di bawah sesuai subskalanya.
          </p>
          {DASS21_SECTIONS.map((section) => (
            <ItemGroup
              key={section.id}
              title={`DASS-21 — ${section.title}`}
              subtitle={section.subtitle}
              items={DASS21_ITEMS.filter((item) => {
                const number = Number(item.id.replace('dass', ''));
                return section.items.includes(number);
              })}
              values={values}
              onChange={setAnswer}
              columns={4}
              optionLabels={['Tidak pernah', 'Jarang', 'Kadang', 'Hampir selalu']}
            />
          ))}
        </>
      )}

      {active === 'sds' && (
        <ItemGroup
          title="Zung SDS"
          subtitle="Zung Self-Rating Depression Scale"
          description="Dua puluh pernyataan, jawaban 1 sampai 4, dijumlahkan menjadi indeks 20 sampai 80. Normal sampai 49, mild 50 sampai 59, moderate 60 sampai 69, severe 70 ke atas."
          items={SDS_ITEMS}
          values={values}
          onChange={setAnswer}
          columns={4}
          optionLabels={['Tidak pernah', 'Kadang', 'Sering', 'Hampir selalu']}
        />
      )}

      <div className="qh-two-col">
        <ResultPanel
          title="Pratinjau Hasil"
          lines={[
            { label: 'SRQ-20', value: srqFilled > 0 ? `${srqPreview.score} (${srqFilled}/${SRQ20_ITEMS.length}) — ${srqPreview.label}` : 'Belum diisi', tone: toneFor(srqPreview.category) },
            {
              label: 'DASS-21 depresi',
              value: dassFilled > 0 ? `${dassPreview.depresi.score} (${dassFilled}/${DASS21_ITEMS.length})` : 'Belum diisi',
              tone: toneFor(dassPreview.depresi.category),
            },
            {
              label: 'DASS-21 ansietas',
              value: dassFilled > 0 ? `${dassPreview.ansietas.score}` : 'Belum diisi',
              tone: toneFor(dassPreview.ansietas.category),
            },
            {
              label: 'DASS-21 stres',
              value: dassFilled > 0 ? `${dassPreview.stres.score}` : 'Belum diisi',
              tone: toneFor(dassPreview.stres.category),
            },
            {
              label: 'Zung SDS',
              value: sdsFilled > 0 ? `${sdsPreview.rawIndex} (${sdsFilled}/${SDS_ITEMS.length}) — ${sdsPreview.label}` : 'Belum diisi',
              tone: toneFor(sdsPreview.category),
            },
          ]}
          footer="Skor parsial hanya pratinjau. DASS-21 dan SDS dinilai penuh setelah semua itemnya terisi."
        />

        {saved && (
          <ResultPanel
            title="Hasil Tersimpan"
            lines={[
              { label: 'Ringkasan', value: saved.ringkasan || '—' },
              {
                label: 'Perlu rujukan',
                value: saved.perluRujukan ? 'Ya' : 'Tidak',
                tone: saved.perluRujukan ? 'bad' : 'good',
              },
              { label: 'MCU yang ikut diperbarui', value: String(saved.mcuUpdated) },
            ]}
            zonasi={saved.zonasi}
            footer="MCU yang diperiksa SEBELUM tanggal pemeriksaan ini tidak diubah: zonanya mengunci hasil kuesioner yang berlaku saat pemeriksaannya."
          />
        )}
      </div>

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