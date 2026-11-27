'use client';

// Dashboard > Kesehatan Mental & Psikososial
//
// ACUAN STANDAR AUDIT:
//   - ISO 45003:2021 (Occupational Health & Safety - Psychological Health and Safety at Work)
//   - Kepdirjen Minerba No. 185 K/37.04/DJB/2019 (SMKP Minerba Bab II.4.5: Pengelolaan Kesehatan Jiwa Pekerja Tambang)
//   - Permenaker No. 5 Tahun 2018 (Faktor Psikologi Lingkungan Kerja - SDS-30)
//   - Standar WHO/Kemenkes: Self-Reporting Questionnaire (SRQ-20) & Depression Anxiety Stress Scales (DASS-21)
//
// INTEGRITAS DATA:
//   100% data riil dari tabel Supabase `mcu_mental_health` via /api/mental-health/dashboard.
//   Tidak ada angka estimasi atau proxy.

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, HeartPulse } from 'lucide-react';

import { authFetch } from '@/lib/api-client';
import {
  MCUChart,
  MCUChartCard,
  MCURefreshButton,
} from '@/components/dashboard/MCUDashboardShared';
import { useSites } from '@/lib/site-list';
import { useSiteLock } from '@/lib/auth-context';
import PageLoading from '@/components/ui/page-loading';

interface DataMentalHealth {
  totalResponden: number;
  bulan: string[];
  instrumen: {
    srq20: {
      terisi: number;
      perluTindakLanjut: number;
      rataRata: number;
      band: Record<string, number>;
    };
    dass21: {
      terisi: number;
      rataDepresi: number;
      rataAnsietas: number;
      rataStres: number;
      band: Record<string, number>;
    };
    sds: {
      terisi: number;
      perIndikator: {
        id: string;
        title: string;
        terisi: number;
        berat: number;
        sedang: number;
        ringan: number;
        rataRata: number;
      }[];
      berat: number;
    };
  };
  trend: { bulan: string; srq: number; perluTindakLanjut: number }[];
  perSite: { site: string; total: number; perluTindakLanjut: number }[];
}

const DASS_ORDER = ['Normal', 'Ringan', 'Sedang', 'Berat', 'Sangat Berat'] as const;
const DASS_COLORS: Record<string, string> = {
  Normal: '#00B894',
  Ringan: '#F1C40F',
  Sedang: '#E67E22',
  Berat: '#FF2D2D',
  'Sangat Berat': '#8E44AD',
};

const SDS_SHORT_LABELS: Record<string, string> = {
  'ketaksaan-peran': 'Ketaksaan Peran',
  'konflik-peran': 'Konflik Peran',
  'beban-kuantitatif': 'Beban Kuantitatif',
  'beban-kualitatif': 'Beban Kualitatif',
  'pengembangan-karir': 'Pengembangan Karir',
  'tanggung-jawab': 'Tanggung Jawab Orang',
};
const SDS_COLORS = ['#3498DB', '#9B59B6', '#FF2D2D', '#E67E22', '#1ABC9C', '#F1C40F'];
const sdsShortLabel = (id: string, fallback: string) => SDS_SHORT_LABELS[id] ?? fallback;

export default function MentalHealthDashboard() {
  const { sites: daftarSite } = useSites();
  const [data, setData] = useState<DataMentalHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { site, setSite, isLocked: isSiteLocked, lockedSite } = useSiteLock('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qSite = site ? `?site=${encodeURIComponent(site)}` : '';
      const res = await authFetch(`/api/mental-health/dashboard${qSite}`);
      setData((res as any).data as DataMentalHealth);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat dashboard kesehatan mental');
    } finally {
      setLoading(false);
    }
  }, [site]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading && !data) return <PageLoading label="Memuat dashboard kesehatan mental & psikososial" />;

  if (!data) {
    return (
      <div className="dashboard mcu-live-dashboard" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 12 }}>
          {error || 'Data kesehatan mental tidak tersedia.'}
        </div>
      </div>
    );
  }

  const i = data.instrumen;
  const totalResponden = data.totalResponden;

  const srqTerisi = i.srq20.terisi;
  const srqPerlu = i.srq20.perluTindakLanjut;
  const srqNormal = Math.max(0, srqTerisi - srqPerlu);

  const dassBands = DASS_ORDER.filter((k) => Number(i.dass21.band?.[k] ?? 0) > 0);
  const dassBerat = (i.dass21.band?.Berat ?? 0) + (i.dass21.band?.['Sangat Berat'] ?? 0);

  const sdsIndikator = (i.sds?.perIndikator ?? []).slice(0, 6);
  const sdsBeratTotal = i.sds?.berat ?? 0;

  const perSiteData = (data.perSite ?? []).slice(0, 8);

  return (
    <div className="dashboard mcu-live-dashboard">
      {/* ── Top Bar: Filter & Audit KPI Badges (100% Riil) ─────────────── */}
      <div className="dashboard-top-bar mcu-live-top-bar">
        <div className="mcu-dashboard-filters">
          <label>
            <span>Site</span>
            <select
              value={site}
              disabled={isSiteLocked}
              onChange={(e) => setSite(e.target.value)}
              style={{
                height: 28,
                width: 140,
                borderRadius: 7,
                border: '1px solid var(--border)',
                background: 'var(--background)',
                fontSize: 10,
                fontWeight: 700,
                padding: '0 6px',
              }}
            >
              {isSiteLocked && lockedSite ? (
                <option value={lockedSite}>{lockedSite}</option>
              ) : (
                <>
                  <option value="">Semua Site</option>
                  {daftarSite.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </>
              )}
            </select>
          </label>
        </div>

        {/* Audit-Grade KPI Badges (Murni Data Riil) */}
        <div className="mcu-total-bar">
          <span className="mcu-total-label">Total Responden:</span>
          <span className="mcu-total-num">{totalResponden}</span>
          <span style={{ fontWeight: 700, color: srqPerlu > 0 ? '#FF2D2D' : '#00B894' }}>
            SRQ-20 ≥6 (Perlu Evaluasi): {srqPerlu}
          </span>
          <span style={{ fontWeight: 700, color: dassBerat > 0 ? '#E67E22' : '#00B894' }}>
            DASS Berat/Sangat Berat: {dassBerat}
          </span>
          <span style={{ fontWeight: 700, color: sdsBeratTotal > 0 ? '#E67E22' : '#00B894' }}>
            SDS-30 Indikator Berat: {sdsBeratTotal}
          </span>
          <MCURefreshButton loading={loading} onClick={() => void loadData()} />
        </div>
      </div>

      {error && (
        <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 11 }}>
          {error}
        </div>
      )}

      {/* ── BARIS 1: Skrining Klinis Individu (SRQ-20 & DASS-21) ────────── */}
      <div className="mcu-grid-3 mcu-live-chart-row">
        {/* CARD 1: Hasil Skrining SRQ-20 */}
        <MCUChartCard
          title="Skrining SRQ-20 (WHO)"
          subtitle={`Ambang ≥6 = Perlu Evaluasi Medis · Rata-rata Skor: ${i.srq20.rataRata}`}
          className="glow-teal"
        >
          {srqTerisi > 0 ? (
            <MCUChart
              type="doughnut"
              labels={['Normal (<6)', 'Perlu Evaluasi Lanjut (≥6)']}
              values={[srqNormal, srqPerlu]}
              colors={['#00B894', '#FF2D2D']}
              centerText={String(srqTerisi)}
              percentLabels
            />
          ) : (
            <Kosong label="Belum ada responden SRQ-20" />
          )}
        </MCUChartCard>

        {/* CARD 2: Distribusi Tingkat Keparahan DASS-21 */}
        <MCUChartCard
          title="Tingkat Keparahan DASS-21"
          subtitle="Klasifikasi Derajat Tertinggi dari Depresi, Ansietas & Stres"
          className="glow-coral"
        >
          {dassBands.length > 0 ? (
            <MCUChart
              type="doughnut"
              labels={dassBands.map((k) => k)}
              values={dassBands.map((k) => Number(i.dass21.band[k]))}
              colors={dassBands.map((k) => DASS_COLORS[k] ?? '#778899')}
              centerText={String(i.dass21.terisi)}
              percentLabels
            />
          ) : (
            <Kosong label="Belum ada responden DASS-21" />
          )}
        </MCUChartCard>

        {/* CARD 3: Rata-rata Subskala DASS-21 */}
        <MCUChartCard
          title="Rata-rata Subskala DASS-21"
          subtitle="Profil Skor Depresi, Ansietas, dan Stres Responden"
          className="glow-amber"
        >
          {i.dass21.terisi > 0 ? (
            <MCUChart
              type="bar"
              labels={['Depresi', 'Ansietas', 'Stres']}
              values={[i.dass21.rataDepresi || 0, i.dass21.rataAnsietas || 0, i.dass21.rataStres || 0]}
              colors={['#3498DB', '#F39C12', '#FF2D2D']}
              legendLabel="Skor Rata-rata"
            />
          ) : (
            <Kosong label="Belum ada data subskala DASS-21" />
          )}
        </MCUChartCard>
      </div>

      {/* ── BARIS 2: Bahaya Psikososial Lingkungan Kerja (SDS-30) & Wilayah ─ */}
      <div className="mcu-grid-3 mcu-live-chart-row">
        {/* CARD 4: Stresor Lingkungan Kerja SDS-30 (Skor Rata-rata) */}
        <MCUChartCard
          title="Stresor Kerja SDS-30 (Skor Rata-rata)"
          subtitle="Survei Diagnosis Stres Kerja — Permenaker 5/2018 (Skala 5–35)"
          className="glow-steel"
        >
          {sdsIndikator.length > 0 ? (
            <MCUChart
              type="bar"
              horizontal
              labels={sdsIndikator.map((s) => sdsShortLabel(s.id, s.title))}
              values={sdsIndikator.map((s) => s.rataRata)}
              colors={sdsIndikator.map((s) => (s.rataRata > 24 ? '#FF2D2D' : s.rataRata >= 10 ? '#FF7A00' : '#00B894'))}
              legendLabel="Rata-rata Skor"
            />
          ) : (
            <Kosong label="Belum ada data SDS-30" />
          )}
        </MCUChartCard>

        {/* CARD 5: Prioritas Intervensi Stresor Berat (SDS-30 > 24) */}
        <MCUChartCard
          title="Kasus Stres Kerja Berat (SDS >24)"
          subtitle="Proporsi Pekerja Kategori Berat per Sumber Stresor (ISO 45003)"
          className="glow-orange"
        >
          {sdsIndikator.some((s) => s.berat > 0) ? (
            <MCUChart
              type="doughnut"
              labels={sdsIndikator.filter((s) => s.berat > 0).map((s) => sdsShortLabel(s.id, s.title))}
              values={sdsIndikator.filter((s) => s.berat > 0).map((s) => s.berat)}
              colors={sdsIndikator.filter((s) => s.berat > 0).map((_, idx) => SDS_COLORS[idx % SDS_COLORS.length])}
              centerText={String(sdsIndikator.reduce((sum, s) => sum + s.berat, 0))}
              percentLabels
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#00B894', gap: 6 }}>
              <CheckCircle2 size={32} />
              <span style={{ fontSize: 12, fontWeight: 700 }}>Nol Stresor Berat</span>
              <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Tidak ada indikator SDS-30 di atas ambang 24</span>
            </div>
          )}
        </MCUChartCard>

        {/* CARD 6: Sebaran SRQ-20 Perlu Evaluasi per Jobsite */}
        <MCUChartCard
          title="Sebaran SRQ ≥6 per Jobsite"
          subtitle="Jumlah Responden Perlu Tindak Lanjut di Setiap Site"
          className="glow-teal"
        >
          {perSiteData.length > 0 ? (
            <MCUChart
              type="bar"
              horizontal
              labels={perSiteData.map((p) => p.site)}
              values={perSiteData.map((p) => p.perluTindakLanjut)}
              colors={perSiteData.map((p) => (p.perluTindakLanjut > 0 ? '#FF2D2D' : '#00B894'))}
              legendLabel="SRQ-20 ≥ 6"
            />
          ) : (
            <Kosong label="Belum ada sebaran site" />
          )}
        </MCUChartCard>
      </div>
    </div>
  );
}

function Kosong({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted-foreground)', gap: 6 }}>
      <HeartPulse size={28} style={{ opacity: 0.3 }} />
      <span style={{ fontSize: 11 }}>{label}</span>
    </div>
  );
}
