'use client';

import { useMemo, useState } from 'react';
import {
  MCUChart,
  MCUChartCard,
  MCUDashboardFilters,
  MCURefreshButton,
  useMCUDashboardData,
} from '@/components/dashboard/MCUDashboardShared';

const RESULT_ORDER = [
  'Fit To Work', 'Fit With Note', 'Fit With Restriction', 'Currently Unfit',
  'Temporary Unfit', 'Unfit', 'No Data',
];
const RESULT_COLORS: Record<string, string> = {
  'fit to work': '#00B894',
  'fit with note': '#FFD700',
  'fit with restriction': '#9B59B6',
  'currently unfit': '#FF4444',
  'temporary unfit': '#8B4513',
  unfit: '#FF4444',
  'no data': '#616161',
  'belum ada mcu': '#616161',
};

function splitValues(value: string | null) {
  return (value || '').split(/[,;\n|]+/).map(item => item.trim()).filter(Boolean);
}

function cleanAndNormalizeDiagnosis(raw: string): string | null {
  if (!raw) return null;
  // Hapus prefix seperti "ECG :" atau "TMT :"
  let val = raw.replace(/^(ECG|TMT|LAB|RONTGEN|X-RAY)\s*:\s*/i, '').trim();
  // Hapus konten bukti/angka dalam tanda kurung
  val = val.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

  const lower = val.toLowerCase();

  // Filter keluar temuan normal atau non-penyakit
  if (
    !lower ||
    lower === '-' ||
    lower === 'tidak ada' ||
    lower === 'n/a' ||
    lower === 'normal' ||
    lower.includes('within normal limit') ||
    lower.includes('optimal') ||
    lower.includes('desirable') ||
    lower.includes('anti-hbs') ||
    lower.includes('anti hbs') ||
    lower.includes('physical examination finding') ||
    lower.includes('orodental finding') ||
    lower.includes('non-specific finding') ||
    lower.includes('sinus rhythm') ||
    lower.includes('normal ecg')
  ) {
    return null;
  }

  // Konsolidasi kelompok penyakit medis sesuai standar klinis
  if (/hyperuricemia/i.test(lower)) return 'Hyperuricemia';
  if (/hypertension/i.test(lower)) return 'Hypertension';
  if (/elevated blood pressure|pre-?hypertension/i.test(lower)) return 'Elevated Blood Pressure';
  if (/obesity/i.test(lower)) return 'Obesity';
  if (/prediabetes/i.test(lower)) return 'Prediabetes';
  if (/diabetes\s*mellitus|diabetes/i.test(lower)) return 'Diabetes Mellitus';
  if (/dyslipidemia/i.test(lower)) return 'Dyslipidemia';
  if (/hypercholesterolemia|high total cholesterol/i.test(lower)) return 'Hypercholesterolemia';
  if (/hypertriglyceridemia|high triglyceride/i.test(lower)) return 'Hypertriglyceridemia';
  if (/low hdl/i.test(lower)) return 'Low HDL Cholesterol';
  if (/obstructive lung disease/i.test(lower)) return 'Obstructive Lung Disease';
  if (/hearing loss/i.test(lower)) return 'Noise-Induced Hearing Loss';
  if (/visual impairment/i.test(lower)) return 'Visual Impairment';
  if (/liver dysfunction/i.test(lower)) return 'Liver Dysfunction';
  if (/urinalysis abnormal|urine routine/i.test(lower)) return 'Urinalysis Abnormal';
  if (/erythrocytosis/i.test(lower)) return 'Erythrocytosis';
  if (/leukocytosis/i.test(lower)) return 'Leukocytosis';
  if (/thrombocytosis/i.test(lower)) return 'Thrombocytosis';
  if (/sinus bradycardia/i.test(lower)) return 'Sinus Bradycardia';

  return val;
}

export default function HasilTindakLanjutMCU() {
  const { rows, loading, error, refresh } = useMCUDashboardData();
  const [site, setSite] = useState('All Site');
  const [area, setArea] = useState('');
  const [clients, setClients] = useState<string[]>([]);

  const filtered = useMemo(() => rows.filter(row =>
    (site === 'All Site' || row.site === site)
    && (!area || row.area === area)
    && (!clients.length || (row.client && clients.includes(row.client))),
  ), [rows, site, area, clients]);

  const followUpSummary = useMemo(() => ({
    total: filtered.length,
    needs: filtered.filter(row => row.status_follow_up === 'Perlu FU').length,
    done: filtered.filter(row => row.status_follow_up === 'Selesai FU' || row.status_follow_up === 'Tidak Perlu FU').length,
    noReview: filtered.filter(row => row.status_follow_up === 'Belum Review').length,
    exempt: filtered.filter(row => row.status_follow_up === 'Exempt' || row.exempt).length,
  }), [filtered]);

  const diseases = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.filter(row => !row.exempt).forEach(row => {
      splitValues(row.diagnosa).forEach(value => {
        const diagnosis = cleanAndNormalizeDiagnosis(value);
        if (!diagnosis) return;
        counts.set(diagnosis, (counts.get(diagnosis) || 0) + 1);
      });
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [filtered]);

  const resultDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.filter(row => !row.exempt).forEach(row => {
      const raw = row.hasil_mcu?.trim();
      const result = !raw || raw.toLowerCase() === 'belum ada mcu' ? 'No Data' : raw;
      counts.set(result, (counts.get(result) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => {
      const ai = RESULT_ORDER.indexOf(a[0]);
      const bi = RESULT_ORDER.indexOf(b[0]);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return b[1] - a[1];
    });
  }, [filtered]);

  const frsDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.filter(row => !row.exempt).forEach(row => {
      const category = row.frs_kategori?.trim() || 'FRS Belum Dimapping';
      counts.set(category, (counts.get(category) || 0) + 1);
    });
    const preferred = ['High Risk', 'Intermediate Risk', 'Low Risk', 'FRS Belum Dimapping'];
    return [...counts.entries()].sort((a, b) => {
      const ai = preferred.indexOf(a[0]);
      const bi = preferred.indexOf(b[0]);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return b[1] - a[1];
    });
  }, [filtered]);

  const doctorTypes = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.filter(row => !row.exempt).forEach(row => {
      splitValues(row.rekomendasi_fu).filter(value => /dokter/i.test(value)).forEach(value => {
        const specialty = value.match(/dokter\s+sp\.?\s*([a-z]{1,4})/i)?.[1];
        const label = specialty
          ? `Dokter Sp. ${specialty.toUpperCase()}`
          : /dokter\s+gigi/i.test(value)
            ? 'Dokter Gigi'
          : value.match(/dokter\s+umum/i)
            ? 'Dokter Umum'
            : value;
        counts.set(label, (counts.get(label) || 0) + 1);
      });
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [filtered]);

  const riskDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.filter(row => !row.exempt).forEach(row => {
      const risk = row.zona_risiko?.trim() || 'Tidak Ada Data';
      counts.set(risk, (counts.get(risk) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const palette = ['#3498DB', '#00B894', '#FF8C42', '#FF4444', '#9B59B6', '#00BCD4', '#F39C12', '#E91E63', '#2ECC71', '#778899'];
  const resultColors = resultDistribution.map(([label]) => RESULT_COLORS[label.toLowerCase()] || '#616161');
  const frsColors = frsDistribution.map(([label]) => {
    const normalized = label.toLowerCase();
    if (normalized.includes('cek parameter')) return '#F39C12';
    if (normalized.includes('no data') || normalized.includes('tidak ada data') || normalized.includes('belum')) return '#616161';
    if (normalized.includes('high')) return '#E74C3C';
    if (normalized.includes('intermediate')) return '#FFD700';
    if (normalized.includes('low')) return '#00B894';
    return '#616161';
  });
  const riskColors = riskDistribution.map(([label], index) => {
    const normalized = label.toLowerCase();
    if (normalized.includes('belum lengkap')) return '#F39C12';
    if (normalized.includes('no data') || normalized.includes('tidak ada data') || normalized.includes('belum')) return '#616161';
    if (normalized === 'merah') return '#FF4444';
    if (normalized === 'kuning') return '#FFD700';
    if (normalized === 'hijau') return '#00B894';
    return palette[index % palette.length];
  });

  return (
    <div className="dashboard mcu-live-dashboard">
      <div className="dashboard-top-bar mcu-live-top-bar">
        <MCUDashboardFilters
          rows={rows}
          site={site}
          area={area}
          clients={clients}
          onSiteChange={value => { setSite(value); setArea(''); }}
          onAreaChange={setArea}
          onClientsChange={value => { setClients(value); setArea(''); setSite('All Site'); }}
        />
        <div className="mcu-total-bar">
          <span className="mcu-total-label">Total:</span>
          <span className="mcu-total-num">{followUpSummary.total}</span>
          <span className="mcu-total-fu">Perlu FU: {followUpSummary.needs}</span>
          <span className="mcu-total-done">Selesai FU: {followUpSummary.done}</span>
          <span className="mcu-total-nodata">Belum Review: {followUpSummary.noReview}</span>
          <span className="mcu-total-exempt">Exempt: {followUpSummary.exempt}</span>
          <MCURefreshButton loading={loading} onClick={refresh} />
        </div>
      </div>

      {loading ? (
        <div className="bm-loading is-card" role="status" aria-live="polite" aria-label="Memuat data analisa dan tindak lanjut MCU">
          <div className="bm-loading-spinner">
            <div className="bm-loading-ring" aria-hidden="true" />
            <img src="/BM.png" alt="" className="bm-loading-logo" aria-hidden="true" />
          </div>
        </div>
      )
        : error ? <div className="mcu-dashboard-message is-error">{error}</div>
          : <>
            <div className="mcu-row1 mcu-live-chart-row">
              <MCUChartCard title="Top 10 Diseases">
                <MCUChart type="bar" horizontal labels={diseases.map(([name]) => name)} values={diseases.map(([, count]) => count)} colors={diseases.map((_, index) => palette[index % palette.length])} legendLabel="Karyawan dengan diagnosis" />
              </MCUChartCard>
              <MCUChartCard title="Status Follow Up" className="glow-amber">
                <MCUChart type="doughnut" labels={['Selesai FU', 'Perlu FU']} values={[followUpSummary.done, followUpSummary.needs]} colors={['#00B894', '#FF8C42']} centerText={`${followUpSummary.done + followUpSummary.needs}`} percentLabels />
              </MCUChartCard>
              <MCUChartCard title="Framingham Risk Score" className="glow-steel">
                <MCUChart type="doughnut" labels={frsDistribution.map(([name]) => name)} values={frsDistribution.map(([, count]) => count)} colors={frsColors} centerText={`${frsDistribution.reduce((sum, [, count]) => sum + count, 0)}`} percentLabels />
              </MCUChartCard>
            </div>

            <div className="mcu-row2 mcu-live-chart-row">
              <MCUChartCard title="Hasil MCU" className="glow-coral">
                <MCUChart type="bar" labels={resultDistribution.map(([name]) => name)} values={resultDistribution.map(([, count]) => count)} colors={resultColors} legendLabel="Jumlah karyawan" />
              </MCUChartCard>
              <MCUChartCard title="10 Peringkat Konsultasi Dokter" className="glow-teal">
                <MCUChart type="bar" horizontal labels={doctorTypes.map(([name]) => name)} values={doctorTypes.map(([, count]) => count)} colors={Array(10).fill('#2ECC71')} legendLabel="Jumlah konsultasi" />
              </MCUChartCard>
              <MCUChartCard title="Profil Zona Risiko" className="glow-steel">
                <MCUChart type="doughnut" labels={riskDistribution.map(([name]) => name)} values={riskDistribution.map(([, count]) => count)} colors={riskColors} centerText={`${riskDistribution.reduce((sum, [, count]) => sum + count, 0)}`} percentLabels />
              </MCUChartCard>
            </div>
          </>}
    </div>
  );
}
