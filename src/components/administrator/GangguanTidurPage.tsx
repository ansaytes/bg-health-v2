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

import { useState, useMemo } from 'react';
import { Clock, ShieldCheck, AlertCircle } from 'lucide-react';

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
import ConsentGate, { EMPTY_CONSENT, type ConsentState } from '@/components/questionnaire/ConsentGate';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function getPreShiftSession(): {
  key: string;
  title: string;
  desc: string;
  isRoutine: boolean;
  badgeColor: string;
  badgeBg: string;
} {
  const now = new Date();
  const hour = now.getHours();
  const min = now.getMinutes();
  const totalMin = hour * 60 + min;

  // 05:00 - 08:30 -> Pre-Shift Pagi
  if (totalMin >= 300 && totalMin <= 510) {
    return {
      key: 'PRE_SHIFT_PAGI',
      title: 'Jadwal Rutin: Pre-Shift Pagi (05:00 - 08:30)',
      desc: 'Sesi resmi skrining kelelahan & kantuk sebelum pengoperasian unit hauling / alat berat shift pagi.',
      isRoutine: true,
      badgeColor: '#28a745',
      badgeBg: 'rgba(40, 167, 69, 0.12)',
    };
  }
  // 17:00 - 20:00 -> Pre-Shift Malam
  if (totalMin >= 1020 && totalMin <= 1200) {
    return {
      key: 'PRE_SHIFT_MALAM',
      title: 'Jadwal Rutin: Pre-Shift Malam (17:00 - 20:00)',
      desc: 'Sesi resmi skrining kelelahan & kantuk sebelum pengoperasian unit shift malam.',
      isRoutine: true,
      badgeColor: '#007aff',
      badgeBg: 'rgba(0, 122, 255, 0.12)',
    };
  }
  // Di luar jendela rutin
  return {
    key: 'SUSULAN_EVALUASI',
    title: 'Di Luar Jendela Pre-Shift Rutin',
    desc: 'Pengisian tercatat sebagai evaluasi klinis mandiri / susulan di luar jadwal pre-shift operasional.',
    isRoutine: false,
    badgeColor: '#d97706',
    badgeBg: 'rgba(217, 119, 6, 0.12)',
  };
}

export default function GangguanTidurPage() {
  const { query, setQuery, identity, searching, error, search, isEmployee } = useEmployeeLookup('/api/ess');
  const submit = useSubmitStatus();

  const [values, setValues] = useState<Record<string, string>>({});
  const [tglEss, setTglEss] = useState(today());
  const [resultDialog, setResultDialog] = useState<ResultDialogData | null>(null);
  const [consent, setConsent] = useState<ConsentState>(EMPTY_CONSENT);

  const sessionInfo = useMemo(() => getPreShiftSession(), []);

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
        body: JSON.stringify({
          query: 'self',
          tglEss,
          sesiSkrining: sessionInfo.key,
          ...values,
        }),
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

  const canSave = !!identity && filled > 0 && consent.accepted && submit.status !== 'saving';

  // Gerbang persetujuan — wajib menyetujui lembar informed consent dulu.
  if (!consent.accepted) {
    return (
      <ConsentGate
        instrumen="Gangguan Tidur (Epworth Sleepiness Scale)"
        onAccept={(c) => setConsent(c)}
      />
    );
  }

  return (
    <div className="admin-form-container" style={{ padding: '0 16px 8px 16px', height: '100%', minHeight: 0, overflowY: 'auto' }}>
      <div className="admin-form-inner" style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ padding: '8px 0 4px', borderBottom: '1px solid var(--border)' }}>
          <h1 className="admin-form-title">Gangguan Tidur</h1>
          <p className="admin-form-subtitle">
            Epworth Sleepiness Scale (ESS) — Evaluasi kantuk siang hari (ambang kritis &gt; 15 tidak layak alat berat / shift malam) sesuai STD-006 Rev001.
          </p>
        </div>

        <StatusBanner status={error ? 'error' : submit.status} message={error || submit.message} />

        {/* ── Pre-Shift Routine Schedule Badge & Banner ──────────── */}
        <div
          style={{
            padding: '9px 13px',
            borderRadius: 10,
            background: sessionInfo.badgeBg,
            border: `1px solid ${sessionInfo.badgeColor}40`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Clock size={16} style={{ color: sessionInfo.badgeColor, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: sessionInfo.badgeColor }}>
                {sessionInfo.title}
              </div>
              <div style={{ fontSize: 10, color: 'var(--foreground)', opacity: 0.85, marginTop: 1 }}>
                {sessionInfo.desc}
              </div>
            </div>
          </div>
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              padding: '2.5px 9px',
              borderRadius: 999,
              background: 'var(--background)',
              color: sessionInfo.badgeColor,
              border: `1px solid ${sessionInfo.badgeColor}60`,
              letterSpacing: '0.02em',
            }}
          >
            {sessionInfo.isRoutine ? 'JADWAL RUTIN PRE-SHIFT' : 'PENGISIAN SUSULAN'}
          </span>
        </div>

      <IdentityPanel
        query={query}
        onQueryChange={setQuery}
        onSearch={() => search()}
        searching={searching}
        identity={identity}
        isEmployee={isEmployee}
      />

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
    </div>
  );
}