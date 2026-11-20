'use client';

import { useState } from 'react';
import { JOBSITES } from '@/lib/lagging-data';
import { authFetch } from '@/lib/api-client';
import InputLaggingIndicator from './InputLaggingIndicator';

/**
 * Lagging Indicator admin page.
 * Input statistik dan rekap absen sakit site tetap terpisah dari pemantauan
 * real-time sesuai peruntukan masing-masing.
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
  tahun: 0, bulan: 0, jobsite: '',
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
  { key: 'man_power', label: 'Σ Man Power', hint: 'Jumlah karyawan aktif bulan ini' },
  { key: 'man_hours', label: 'Man Hours', hint: 'Total jam kerja produktif' },
  { key: 'layak_bekerja', label: 'Layak Bekerja', hint: 'Jumlah yang dinyatakan fit-to-work' },
];

const AGGREGATE_FIELDS: { key: keyof IndicatorRow; label: string; hint?: string; sourcePage?: string }[] = [
  { key: 'kunjungan_klinik', label: 'Total Kunjungan Klinik', hint: 'Hanya Head Office yang ter-auto-aggregate dari Halaman Kunjungan Berobat' },
  { key: 'tk_sakit', label: 'Tenaga Kerja Sakit', hint: 'Rekap jumlah karyawan sakit dari site', sourcePage: 'Data Karyawan Sakit' },
  { key: 'absensi_sakit', label: 'Total Absensi Sakit (hari)', hint: 'Rekap hari absen sakit dari site', sourcePage: 'Data Karyawan Sakit' },
  { key: 'spell', label: 'Spell', hint: 'Jumlah Spell dari rekap site (Kepdirjen 1855.K/2019)', sourcePage: 'Data Karyawan Sakit' },
  { key: 'penyakit_akibat_kerja', label: 'Penyakit Akibat Kerja (PAK)', hint: 'Jumlah kasus PAK dari rekap site', sourcePage: 'Data Karyawan Sakit' },
  { key: 'kejadian_penyakit_tk', label: 'Kejadian Akibat Penyakit TK', hint: 'Jumlah kejadian KAPTK' },
];

const LAGGING_FIELDS: { key: keyof IndicatorRow; label: string; formula: string; isPercent?: boolean }[] = [
  { key: 'rkk',    label: 'Rasio Kelayakan Kerja (RKK)',         formula: '= Layak Bekerja / Σ Man Power', isPercent: true },
  { key: 'cmr',    label: 'Angka Kesakitan Kasar (CMR)',          formula: '= TK Sakit / Σ Man Power', isPercent: true },
  { key: 'mfr',    label: 'Kekerapan Kesakitan (MFR)',            formula: '= (TK Sakit × 10⁶) / Man Hours' },
  { key: 'ssr',    label: 'Keparahan Penyakit (SSR)',             formula: '= Total Absensi Sakit / TK Sakit' },
  { key: 'asr',    label: 'Keparahan Absensi (ASR)',              formula: '= (Absensi Sakit × 10⁶) / Man Hours' },
  { key: 'fr_pak', label: 'Frekuensi PAK (FR PAK)',               formula: '= Penyakit Akibat Kerja / Σ Man Power', isPercent: true },
  { key: 'kaptk',  label: 'Kejadian Akibat Penyakit TK (KAPTK)',   formula: 'Count kejadian' },
];

export default function LaggingIndicatorPage() {
  const [tab, setTab] = useState<'statistik' | 'karyawan-sakit'>('statistik');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', width: '100%', height: '100%', margin: '0 auto', paddingBottom: 0 }}>
      <div className="admin-form-inner">
        {/* Header */}
        <div style={{ marginBottom: 8 }}>
          <h1 className="admin-form-title">Lagging Indicator</h1>
          <p className="admin-form-subtitle">
            Input data bulanan per jobsite untuk dashboard Statistik Kesehatan.
          </p>
        </div>

        <div className="admin-tab-row">
          <button type="button" className={`admin-tab-btn${tab === 'statistik' ? ' active' : ''}`} onClick={() => setTab('statistik')}>
            Statistik Kesehatan
          </button>
          <button type="button" className={`admin-tab-btn${tab === 'karyawan-sakit' ? ' active' : ''}`} onClick={() => setTab('karyawan-sakit')}>
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

  /** Hitung nilai expected setiap lagging field dari denominator */
  const calcExpected = (r: IndicatorRow): Partial<Record<keyof IndicatorRow, number>> => {
    const mp = r.man_power || 0;
    const mh = r.man_hours || 0;
    const tks = r.tk_sakit || 0;
    const abs = r.absensi_sakit || 0;
    const pak = r.penyakit_akibat_kerja || 0;
    const lb = r.layak_bekerja || 0;
    return {
      rkk:    mp > 0 ? lb / mp : undefined,
      cmr:    mp > 0 ? tks / mp : undefined,
      mfr:    mh > 0 ? (tks * 1_000_000) / mh : undefined,
      ssr:    tks > 0 ? abs / tks : undefined,
      asr:    mh > 0 ? (abs * 1_000_000) / mh : undefined,
      fr_pak: mp > 0 ? pak / mp : undefined,
    };
  };

  const expected = calcExpected(row);

  /**
   * Mismatch: nilai user berbeda >5% dari expected (dan expected bukan undefined/0).
   * kaptk tidak ada formula — selalu undefined.
   */
  const isMismatch = (key: keyof IndicatorRow): boolean => {
    const exp = expected[key];
    if (exp === undefined || exp === 0) return false;
    const actual = row[key] as number;
    if (actual === 0) return false;
    return Math.abs(actual - exp) / Math.abs(exp) > 0.05;
  };

  /** Badge: apakah ada mismatch di salah satu lagging field */
  const showFormulaMismatch = LAGGING_FIELDS.some(f => isMismatch(f.key));

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
      const json = await authFetch<{ success: boolean; data: Record<string, number>; sources: { kunjungan_berobat_rows: number; sick_employees_rows: number }; error?: string }>(url);
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
      const json = await authFetch<{ success: boolean; data: IndicatorRow[]; error?: string }>(url);
      if (json.data && json.data.length > 0) {
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
        setRow({ ...EMPTY_ROW, tahun: row.tahun, bulan: row.bulan, jobsite: row.jobsite });
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
      await authFetch('/api/health-indicators', {
        method: 'POST',
        body: JSON.stringify(row),
      });
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
              value={row.tahun || ''}
              onChange={(e) => setRow(prev => ({ ...prev, tahun: parseInt(e.target.value) || 0 }))}
              placeholder="- Pilih Tahun -"
              className="admin-input compact-input" />
          </div>
          <div>
            <label className="admin-label">Bulan <span style={{ color: 'var(--brand-primary)' }}>*</span></label>
            <select value={row.bulan || ''} onChange={(e) => setRow(prev => ({ ...prev, bulan: parseInt(e.target.value) || 0 }))}
              className="admin-input compact-input">
              <option value="">- Pilih Bulan -</option>
              {FULL_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="admin-label">Jobsite <span style={{ color: 'var(--brand-primary)' }}>*</span></label>
            <select value={row.jobsite || ''} onChange={(e) => setRow(prev => ({ ...prev, jobsite: e.target.value }))}
              className="admin-input compact-input">
              <option value="">- Pilih Jobsite -</option>
              {JOBSITES.filter(s => s !== 'All Site').map(s => <option key={s} value={s}>{s}</option>)}
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

        {/* Section: Σ Man Power / Data Konteks Bulanan */}
        <SectionHeader icon="users" title="Data Konteks Bulanan" subtitle="Σ Man Power untuk perhitungan lagging indicators" />
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
        <SectionHeader icon="chart" title="Aggregate Count Bulanan" subtitle="Jumlah kejadian bulan ini" />
        <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={handleAutoAggregate} disabled={aggregating}
            className="admin-form-btn-secondary compact-btn">
            {aggregating ? 'Meng-aggregate...' : 'Auto-Aggregate'}
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
        <SectionHeader icon="pulse" title="Lagging Indicators" subtitle="7 Indikator - Kepdirjen no. 185" badge={showFormulaMismatch ? '⚠ Ada mismatch formula' : undefined} />
        <div style={{ marginBottom: 10 }}>
          <button type="button" onClick={autoCalcLagging}
            className="admin-form-btn-secondary compact-btn">
            Auto-Hitung
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {LAGGING_FIELDS.map(f => {
            const exp = expected[f.key];
            const mismatch = isMismatch(f.key);
            const expFormatted = exp !== undefined
              ? (f.isPercent ? (exp * 100).toFixed(2) + '%' : exp.toFixed(4))
              : null;
            return (
              <div key={f.key}>
                <label className="admin-label">{f.label}</label>
                <input type="number" step="any"
                  value={row[f.key] as number}
                  onChange={(e) => setField(f.key, e.target.value)}
                  className={`admin-input compact-input${mismatch ? ' input-warning' : ''}`}
                  style={mismatch ? { borderColor: 'var(--destructive, #dc2626)', outline: 'none' } : undefined}
                  placeholder="0" />
                {mismatch && expFormatted && (
                  <p style={{ fontSize: 9.5, color: 'var(--destructive, #dc2626)', margin: '2px 0 0', lineHeight: 1.3 }}>
                    ⚠ Perlu verifikasi: formula menghasilkan {expFormatted}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Buttons */}
        {errorMsg && <p className="login-error-msg" style={{ marginTop: 12, marginBottom: 8 }}>{errorMsg}</p>}
        <div style={{ marginTop: 14, display: 'flex', gap: 8, maxWidth: '100%', flexWrap: 'wrap' }}>
          <button type="submit" disabled={saving}
            className={`admin-form-btn-primary compact-btn${saved ? ' saved' : ''}`}>
            {saving ? 'Menyimpan...' : saved ? 'Tersimpan!' : 'Simpan Data'}
          </button>
          <button type="button" onClick={() => cetakLaporanSMKP(row)}
            className="admin-form-btn-secondary compact-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--muted)', borderColor: 'var(--border)' }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
            Cetak Laporan Bulanan SMKP
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

function SectionHeader({ icon, title, subtitle, badge }: { icon: 'calendar' | 'chart' | 'pulse' | 'users'; title: string; subtitle?: string; badge?: string }) {
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
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 className="admin-section-title">{title}</h3>
          {badge && (
            <span style={{
              fontSize: 9.5, fontWeight: 700, color: 'var(--destructive, #dc2626)',
              background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)',
              borderRadius: 4, padding: '1px 6px', lineHeight: 1.6,
            }}>
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="admin-section-subtitle">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function cetakLaporanSMKP(row: IndicatorRow) {
  if (!row.jobsite || !row.bulan || !row.tahun) {
    alert('Pilih periode tahun, bulan, dan jobsite terlebih dahulu.');
    return;
  }
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const namaBulan = FULL_MONTHS[row.bulan - 1] || String(row.bulan);
  const rkk = (row.rkk * 100).toFixed(2);
  const cmr = (row.cmr * 100).toFixed(2);
  const mfr = row.mfr.toFixed(2);
  const ssr = row.ssr.toFixed(2);
  const asr = row.asr.toFixed(2);
  const frPak = (row.fr_pak * 100).toFixed(2);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Laporan Statistik Kesehatan Kerja - ${row.jobsite} ${namaBulan} ${row.tahun}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 10pt; color: #111; margin: 15mm; line-height: 1.4; }
    h2 { margin: 0 0 4px 0; font-size: 13pt; text-align: center; }
    h3 { margin: 0 0 16px 0; font-size: 10.5pt; text-align: center; font-weight: normal; }
    .header-box { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 9.5pt; }
    th, td { border: 1px solid #333; padding: 5px 8px; }
    th { background: #f0f0f0; text-align: left; font-weight: bold; }
    .num { text-align: right; }
    .sign-box { display: flex; justify-content: space-between; margin-top: 36px; page-break-inside: avoid; }
    .sign-col { width: 220px; text-align: center; font-size: 9.5pt; }
    .sign-space { height: 65px; }
    @media print { body { margin: 10mm; } }
  </style>
</head>
<body>
  <div class="header-box">
    <h2>PT BAGONG DEKAKA MAKMUR</h2>
    <h3>DIVISI KESEHATAN KERJA &amp; HIGIENE INDUSTRI (QSHE DEPT)<br>
    LAPORAN KINERJA KESEHATAN KERJA BULANAN (KEPDIRJEN MINERBA 1855.K/2019)</h3>
  </div>

  <table style="border:none; margin-bottom: 12px;">
    <tr style="border:none;">
      <td style="border:none; width: 140px;"><b>Jobsite / Wilayah</b></td>
      <td style="border:none;">: ${row.jobsite}</td>
      <td style="border:none; width: 140px;"><b>Periode Pelaporan</b></td>
      <td style="border:none;">: ${namaBulan} ${row.tahun}</td>
    </tr>
    <tr style="border:none;">
      <td style="border:none;"><b>Tanggal Terbit</b></td>
      <td style="border:none;">: ${new Date().toLocaleDateString('id-ID')}</td>
      <td style="border:none;"><b>Status Dokumen</b></td>
      <td style="border:none;">: Dokumen Resmi Pengawasan K3 Tambang</td>
    </tr>
  </table>

  <h4 style="margin: 8px 0 6px 0; font-size: 10.5pt;">I. DATA DASAR &amp; KESAKITAN OPERASIONAL</h4>
  <table>
    <thead>
      <tr>
        <th style="width: 35px;">No</th>
        <th>Parameter Kesehatan Kerja</th>
        <th style="width: 140px;" class="num">Nilai Aktual</th>
        <th style="width: 180px;">Keterangan</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>Total Man Power Aktif (&Sigma; MP)</td><td class="num">${row.man_power.toLocaleString('id-ID')}</td><td>Karyawan aktif</td></tr>
      <tr><td>2</td><td>Total Jam Kerja Produktif (Man Hours)</td><td class="num">${row.man_hours.toLocaleString('id-ID')}</td><td>Jam kerja operasional</td></tr>
      <tr><td>3</td><td>Tenaga Kerja Layak Bekerja (Fit to Work)</td><td class="num">${row.layak_bekerja.toLocaleString('id-ID')}</td><td>Hasil evaluasi harian/MCU</td></tr>
      <tr><td>4</td><td>Kunjungan Rawat Jalan Klinik</td><td class="num">${row.kunjungan_klinik}</td><td>Pasien berobat</td></tr>
      <tr><td>5</td><td>Tenaga Kerja Sakit (TK Sakit)</td><td class="num">${row.tk_sakit}</td><td>Karyawan absen karena sakit</td></tr>
      <tr><td>6</td><td>Total Hari Absensi Sakit (Hari)</td><td class="num">${row.absensi_sakit}</td><td>Akumulasi hari istirahat dokter</td></tr>
      <tr><td>7</td><td>Frekuensi Kasus Sakit (Spell)</td><td class="num">${row.spell}</td><td>Episode sakit terpisah</td></tr>
      <tr><td>8</td><td>Penyakit Akibat Kerja (PAK)</td><td class="num">${row.penyakit_akibat_kerja}</td><td>Diagnosis okupasi definitif</td></tr>
      <tr><td>9</td><td>Kejadian Akibat Penyakit TK (KAPTK)</td><td class="num">${row.kejadian_penyakit_tk}</td><td>Kejadian medis fatal/darurat</td></tr>
    </tbody>
  </table>

  <h4 style="margin: 12px 0 6px 0; font-size: 10.5pt;">II. INDIKATOR KINERJA KESEHATAN (LAGGING INDICATORS)</h4>
  <table>
    <thead>
      <tr>
        <th style="width: 35px;">No</th>
        <th>Indikator Kinerja</th>
        <th style="width: 160px;">Formula Regulasi</th>
        <th style="width: 100px;" class="num">Capaian</th>
        <th style="width: 120px;">Target Acuan</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>Rasio Kelayakan Kerja (RKK)</td><td>(Layak Bekerja &divide; &Sigma; MP) &times; 100%</td><td class="num"><b>${rkk}%</b></td><td>&ge; 95%</td></tr>
      <tr><td>2</td><td>Angka Kesakitan Kasar (CMR)</td><td>(TK Sakit &divide; &Sigma; MP) &times; 100%</td><td class="num"><b>${cmr}%</b></td><td>&le; 10%</td></tr>
      <tr><td>3</td><td>Kekerapan Kesakitan (MFR)</td><td>(TK Sakit &times; 10&sup6;) &divide; Man Hours</td><td class="num"><b>${mfr}</b></td><td>&le; 10</td></tr>
      <tr><td>4</td><td>Keparahan Penyakit (SSR)</td><td>Total Hari Sakit &divide; TK Sakit</td><td class="num"><b>${ssr} hari</b></td><td>&le; 3 hari</td></tr>
      <tr><td>5</td><td>Keparahan Absensi Sakit (ASR)</td><td>(Hari Sakit &times; 10&sup6;) &divide; Man Hours</td><td class="num"><b>${asr}</b></td><td>&le; 50</td></tr>
      <tr><td>6</td><td>Frekuensi PAK (FR PAK)</td><td>(Kasus PAK &divide; &Sigma; MP) &times; 100%</td><td class="num"><b>${frPak}%</b></td><td>0% (Zero PAK)</td></tr>
    </tbody>
  </table>

  <div class="sign-box">
    <div class="sign-col">
      <div>Dibuat oleh,</div>
      <div><b>Paramedic / Tim Medis Site</b></div>
      <div class="sign-space"></div>
      <div>( __________________________ )</div>
    </div>
    <div class="sign-col">
      <div>Diperiksa oleh,</div>
      <div><b>Dokter Perusahaan / QSHE Medic</b></div>
      <div class="sign-space"></div>
      <div>( __________________________ )</div>
    </div>
    <div class="sign-col">
      <div>Disetujui oleh,</div>
      <div><b>PJO / Kepala Teknik Tambang</b></div>
      <div class="sign-space"></div>
      <div>( __________________________ )</div>
    </div>
  </div>
</body>
</html>
  `;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}
