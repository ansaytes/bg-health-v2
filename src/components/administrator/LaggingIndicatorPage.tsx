'use client';

import { useState } from 'react';
import { JOBSITES } from '@/lib/lagging-data';
import InputLaggingIndicator from './InputLaggingIndicator';

/**
 * Lagging Indicator admin page.
 * Two internal tabs:
 *   Tab A: Statistik Kesehatan — monthly leading+lagging input per site per month
 *          POST /api/health-indicators
 *   Tab B: Data Karyawan Sakit — sick employee detail input (existing form)
 *          POST /api/sick-employees
 */

const FULL_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

interface IndicatorRow {
  tahun: number;
  bulan: number;
  jobsite: string;
  man_power: number;
  man_hours: number;
  kunjungan_klinik: number;
  tk_sakit: number;
  absensi_sakit: number;
  spell: number;
  penyakit_akibat_kerja: number;
  kejadian_penyakit_tk: number;
  layak_bekerja: number;
  rkk: number;
  cmr: number;
  mfr: number;
  ssr: number;
  asr: number;
  fr_pak: number;
  kaptk: number;
}

const EMPTY_ROW: IndicatorRow = {
  tahun: 2026, bulan: 1, jobsite: 'All Site',
  man_power: 0, man_hours: 0, kunjungan_klinik: 0, tk_sakit: 0,
  absensi_sakit: 0, spell: 0, penyakit_akibat_kerja: 0,
  kejadian_penyakit_tk: 0, layak_bekerja: 0,
  rkk: 0, cmr: 0, mfr: 0, ssr: 0, asr: 0, fr_pak: 0, kaptk: 0,
};

/**
 * Field definitions.
 *
 * Per Kepdirjen Minerba 1855.K/2019:
 *  - Leading indicators (proaktif/pencegahan) sudah ada di halaman terpisah:
 *    Review MCU, Kunjungan Berobat, Health Campaign, Health Talk (YouTube).
 *  - Yang diinput di form ini adalah: (a) denominator/aggregate bulanan untuk
 *    menghitung lagging, dan (b) lagging indicators itu sendiri.
 */

const DENOMINATOR_FIELDS: { key: keyof IndicatorRow; label: string; hint?: string }[] = [
  { key: 'man_power', label: 'Man Power', hint: 'Jumlah karyawan aktif bulan ini' },
  { key: 'man_hours', label: 'Man Hours', hint: 'Total jam kerja produktif' },
  { key: 'layak_bekerja', label: 'Layak Bekerja', hint: 'Jumlah yang dinyatakan fit-to-work' },
];

const AGGREGATE_FIELDS: { key: keyof IndicatorRow; label: string; hint?: string; sourcePage?: string }[] = [
  { key: 'kunjungan_klinik', label: 'Total Kunjungan Klinik', hint: 'Hanya Head Office yang ter-auto-aggregate dari Halaman Kunjungan Berobat' },
  { key: 'tk_sakit', label: 'Tenaga Kerja Sakit', hint: 'Jumlah karyawan yang sakit', sourcePage: 'Tab Data Karyawan Sakit' },
  { key: 'absensi_sakit', label: 'Total Absensi Sakit (hari)', hint: 'Total hari sakit', sourcePage: 'Tab Data Karyawan Sakit' },
  { key: 'spell', label: 'Spell', hint: 'Jumlah Spell (Kepdirjen 1855.K/2019)', sourcePage: 'Tab Data Karyawan Sakit' },
  { key: 'penyakit_akibat_kerja', label: 'Penyakit Akibat Kerja (PAK)', hint: 'Jumlah kasus PAK', sourcePage: 'Tab Data Karyawan Sakit' },
  { key: 'kejadian_penyakit_tk', label: 'Kejadian Akibat Penyakit TK', hint: 'Jumlah kejadian KAPTK' },
];

const LAGGING_FIELDS: { key: keyof IndicatorRow; label: string; formula: string; isPercent?: boolean }[] = [
  { key: 'rkk',    label: 'Rasio Kelayakan Kerja (RKK)',         formula: '= Layak Bekerja / Man Power', isPercent: true },
  { key: 'cmr',    label: 'Angka Kesakitan Kasar (CMR)',          formula: '= TK Sakit / Man Power', isPercent: true },
  { key: 'mfr',    label: 'Kekerapan Kesakitan (MFR)',            formula: '= (TK Sakit × 10⁶) / Man Hours' },
  { key: 'ssr',    label: 'Keparahan Penyakit (SSR)',             formula: '= Total Absensi Sakit / TK Sakit' },
  { key: 'asr',    label: 'Keparahan Absensi (ASR)',              formula: '= (Absensi Sakit × 10⁶) / Man Hours' },
  { key: 'fr_pak', label: 'Frekuensi PAK (FR PAK)',               formula: '= Penyakit Akibat Kerja / Man Power', isPercent: true },
  { key: 'kaptk',  label: 'Kejadian Akibat Penyakit TK (KAPTK)',   formula: 'Count kejadian' },
];

type TabKey = 'statistik' | 'karyawan-sakit';

export default function LaggingIndicatorPage() {
  const [tab, setTab] = useState<TabKey>('statistik');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', width: '90%', margin: '0 auto' }}>
      <div className="admin-form-inner">
        {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <h1 className="admin-form-title">Lagging Indicator</h1>
          <p className="admin-form-subtitle">
            Input data bulanan per jobsite untuk dashboard Statistik Kesehatan. Leading indicators (Review MCU, Kunjungan Berobat, Health Campaign, Health Talk) sudah ada di halaman masing-masing.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="admin-tab-row">
          <button
            className={`admin-tab-btn${tab === 'statistik' ? ' active' : ''}`}
            onClick={() => setTab('statistik')}
          >
            Statistik Kesehatan
          </button>
          <button
            className={`admin-tab-btn${tab === 'karyawan-sakit' ? ' active' : ''}`}
            onClick={() => setTab('karyawan-sakit')}
          >
            Data Karyawan Sakit
          </button>
        </div>

        {tab === 'statistik' ? <StatistikKesehatanForm /> : <InputLaggingIndicator />}
      </div>
    </div>
  );
}

/* ═══ Tab A: Statistik Kesehatan Form ═══ */
function StatistikKesehatanForm() {
  const [row, setRow] = useState<IndicatorRow>(EMPTY_ROW);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [aggregating, setAggregating] = useState(false);
  const [aggregateInfo, setAggregateInfo] = useState<string>('');

  const setField = (key: keyof IndicatorRow, value: string) => {
    const num = parseFloat(value);
    setRow(prev => ({ ...prev, [key]: isNaN(num) ? 0 : num }));
    setSaved(false);
  };

  /* Auto-calculate lagging from leading when user clicks the helper button */
  const autoCalcLagging = () => {
    const mp = row.man_power || 0;
    const mh = row.man_hours || 0;
    const tks = row.tk_sakit || 0;
    const abs = row.absensi_sakit || 0;
    const pak = row.penyakit_akibat_kerja || 0;
    const lb = row.layak_bekerja || 0;
    setRow(prev => ({
      ...prev,
      rkk:    mp > 0 ? lb / mp : 0,
      cmr:    mp > 0 ? tks / mp : 0,
      mfr:    mh > 0 ? (tks * 1_000_000) / mh : 0,
      ssr:    tks > 0 ? abs / tks : 0,
      asr:    mh > 0 ? (abs * 1_000_000) / mh : 0,
      fr_pak: mp > 0 ? pak / mp : 0,
    }));
    setSaved(false);
  };

  /* Auto-aggregate counts from kunjungan_berobat + sick_employees tables */
  const handleAutoAggregate = async () => {
    setAggregating(true);
    setErrorMsg('');
    setAggregateInfo('');
    try {
      const url = `/api/health-indicators/aggregate?tahun=${row.tahun}&bulan=${row.bulan}&jobsite=${encodeURIComponent(row.jobsite)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Gagal meng-aggregate');
      }
      const agg = json.data;
      const src = json.sources;
      setRow(prev => ({
        ...prev,
        kunjungan_klinik: agg.kunjungan_klinik,
        tk_sakit: agg.tk_sakit,
        absensi_sakit: agg.absensi_sakit,
        spell: agg.spell,
        penyakit_akibat_kerja: agg.penyakit_akibat_kerja,
        // kejadian_penyakit_tk not derivable from sick_employees — keep existing value
      }));
      setAggregateInfo(
        `${src.kunjungan_berobat_rows} kunjungan${row.jobsite === 'Head Office' || row.jobsite === 'All Site' ? '' : ' (HO only)'} + ${src.sick_employees_rows} karyawan sakit`
      );
      setSaved(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal meng-aggregate data');
    } finally {
      setAggregating(false);
    }
  };

  const handleLoad = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const url = `/api/health-indicators?tahun=${row.tahun}&bulan=${row.bulan}&jobsite=${encodeURIComponent(row.jobsite)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        const found = json.data[0];
        setRow({
          tahun: found.tahun, bulan: found.bulan, jobsite: found.jobsite,
          man_power: found.man_power || 0, man_hours: found.man_hours || 0,
          kunjungan_klinik: found.kunjungan_klinik || 0, tk_sakit: found.tk_sakit || 0,
          absensi_sakit: found.absensi_sakit || 0, spell: found.spell || 0,
          penyakit_akibat_kerja: found.penyakit_akibat_kerja || 0,
          kejadian_penyakit_tk: found.kejadian_penyakit_tk || 0,
          layak_bekerja: found.layak_bekerja || 0,
          rkk: found.rkk || 0, cmr: found.cmr || 0, mfr: found.mfr || 0,
          ssr: found.ssr || 0, asr: found.asr || 0, fr_pak: found.fr_pak || 0,
          kaptk: found.kaptk || 0,
        });
      } else {
        // No data — keep empty
        setRow(prev => ({ ...EMPTY_ROW, tahun: row.tahun, bulan: row.bulan, jobsite: row.jobsite }));
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSaving(true);
    try {
      const res = await fetch('/api/health-indicators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal menyimpan');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave}>
      <div className="admin-form-card" style={{ padding: '14px 16px' }}>
        {/* Section: Periode & Site */}
        <SectionHeader icon="calendar" title="Periode & Jobsite" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div>
            <label className="admin-label">Tahun <span style={{ color: 'var(--brand-primary)' }}>*</span></label>
            <input type="number" min="2020" max="2099"
              value={row.tahun}
              onChange={(e) => setRow(prev => ({ ...prev, tahun: parseInt(e.target.value) || 2026 }))}
              className="admin-input compact-input" />
          </div>
          <div>
            <label className="admin-label">Bulan <span style={{ color: 'var(--brand-primary)' }}>*</span></label>
            <select value={row.bulan} onChange={(e) => setRow(prev => ({ ...prev, bulan: parseInt(e.target.value) }))}
              className="admin-input compact-input">
              {FULL_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="admin-label">Jobsite <span style={{ color: 'var(--brand-primary)' }}>*</span></label>
            <select value={row.jobsite} onChange={(e) => setRow(prev => ({ ...prev, jobsite: e.target.value }))}
              className="admin-input compact-input">
              {JOBSITES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <button type="button" onClick={handleLoad} disabled={loading}
            className="admin-form-btn-secondary compact-btn">
            {loading ? 'Memuat...' : 'Muat Data'}
          </button>
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />

        {/* Section: Denominator / Data Konteks Bulanan */}
        <SectionHeader icon="users" title="Data Konteks Bulanan" subtitle="Denominator untuk perhitungan lagging indicators" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {DENOMINATOR_FIELDS.map(f => (
            <div key={f.key}>
              <label className="admin-label">{f.label}</label>
              <input type="number" min="0" step="any"
                value={row[f.key] as number}
                onChange={(e) => setField(f.key, e.target.value)}
                className="admin-input compact-input" placeholder="0" />
            </div>
          ))}
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />

        {/* Section: Aggregate Count Bulanan */}
        <SectionHeader icon="chart" title="Aggregate Count Bulanan" subtitle="Jumlah kejadian bulan ini — bisa di-auto-aggregate" />
        <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={handleAutoAggregate} disabled={aggregating}
            className="admin-form-btn-secondary compact-btn">
            {aggregating ? 'Meng-aggregate...' : 'Auto-Aggregate dari Halaman Lain'}
          </button>
          {aggregateInfo && (
            <span style={{ fontSize: 10, color: 'var(--success)', fontWeight: 500 }}>
              ✓ {aggregateInfo}
            </span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {AGGREGATE_FIELDS.map(f => (
            <div key={f.key}>
              <label className="admin-label">{f.label}</label>
              <input type="number" min="0" step="any"
                value={row[f.key] as number}
                onChange={(e) => setField(f.key, e.target.value)}
                className="admin-input compact-input" placeholder="0" />
              {f.hint && (
                <p style={{ fontSize: 9.5, color: 'var(--muted-foreground)', margin: '2px 0 0', lineHeight: 1.3 }}>
                  {f.hint}
                  {f.sourcePage && (
                    <span style={{ display: 'block', color: 'var(--brand-primary)', fontWeight: 600 }}>
                      ↳ Sumber: {f.sourcePage}
                    </span>
                  )}
                </p>
              )}
            </div>
          ))}
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />

        {/* Section: Lagging Indicators */}
        <SectionHeader icon="pulse" title="Lagging Indicators" subtitle="7 indikator turunan — bisa input manual atau auto-hitung" />
        <div style={{ marginBottom: 10 }}>
          <button type="button" onClick={autoCalcLagging}
            className="admin-form-btn-secondary compact-btn">
            Auto-Hitung dari Aggregate
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {LAGGING_FIELDS.map(f => (
            <div key={f.key}>
              <label className="admin-label">{f.label}</label>
              <input type="number" step="any"
                value={row[f.key] as number}
                onChange={(e) => setField(f.key, e.target.value)}
                className="admin-input compact-input" placeholder="0" />
            </div>
          ))}
        </div>

        {/* Buttons */}
        {errorMsg && <p className="login-error-msg" style={{ marginTop: 12, marginBottom: 8 }}>{errorMsg}</p>}
        <div style={{ marginTop: 14, display: 'flex', gap: 8, maxWidth: '100%' }}>
          <button type="submit" disabled={saving}
            className={`admin-form-btn-primary compact-btn${saved ? ' saved' : ''}`}>
            {saving ? 'Menyimpan...' : saved ? 'Tersimpan!' : 'Simpan Data'}
          </button>
          <button type="button" onClick={() => setRow(EMPTY_ROW)}
            className="admin-form-btn-secondary compact-btn">
            Reset
          </button>
        </div>
      </div>
    </form>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: 'calendar' | 'chart' | 'pulse' | 'users'; title: string; subtitle?: string }) {
  const iconPath = {
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
    chart: <><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></>,
    pulse: <><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  }[icon];

  return (
    <div className="admin-section-header">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--brand-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: -2 }}>
        {iconPath}
      </svg>
      <div>
        <h3 className="admin-section-title">{title}</h3>
        {subtitle && (
          <p className="admin-section-subtitle">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
