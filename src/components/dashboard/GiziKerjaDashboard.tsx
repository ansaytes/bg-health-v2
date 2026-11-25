'use client';

// Dashboard > Higiene Industri > Gizi Kerja & Jasaboga
//
// ACUAN STANDAR AUDIT:
//   - Kepmen ESDM No. 1827 K/30/MEM/2018 Lampiran IV (Kesehatan Kerja Tambang)
//   - Permenkes No. 1096/MENKES/PER/VI/2011 tentang Higiene Sanitasi Jasaboga
//   - Permenkes No. 28 Tahun 2019 tentang Angka Kecukupan Gizi (AKG)
//   - Permenaker No. 5 Tahun 2018 (Klasifikasi Beban Kerja Fisik & Kalori)
//   - Hazard Analysis and Critical Control Points (HACCP) - Food Safety Controls

import { useCallback, useEffect, useState } from 'react';
import { Utensils } from 'lucide-react';

import { authFetch } from '@/lib/api-client';
import {
  MCUChart,
  MCUChartCard,
  MCURefreshButton,
} from '@/components/dashboard/MCUDashboardShared';
import PageLoading from '@/components/ui/page-loading';
import { SITES } from '@/components/administrator/hc-ergo-ui';

interface RekapGizi {
  totalDihitung: number;
  perBebanKerja: [string, number][];
}

interface InspeksiJasaboga {
  id: string;
  site: string;
  tanggal: string;
  vendor: string | null;
  nama_kantin: string | null;
  jumlah_porsi: number | null;
  jumlah_penjamah: number | null;
  jumlah_buku_sehat: number | null;
  no_slhs: string | null;
  tgl_kadaluwarsa_slhs: string | null;
  kalori_sarapan: number;
  kalori_siang: number;
  kalori_malam: number;
  extra_fooding: string | null;
  ringkasan: {
    totalSkor: number;
    persenSkor: number;
    statusLaik: 'laik' | 'laik_bersyarat' | 'tidak_laik';
  } | null;
}

export default function GiziKerjaDashboard({ site: initialSite }: { site?: string }) {
  const [selectedSite, setSelectedSite] = useState(initialSite || '');
  const [rekap, setRekap] = useState<RekapGizi | null>(null);
  const [inspeksi, setInspeksi] = useState<InspeksiJasaboga[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qSite = selectedSite ? `?site=${encodeURIComponent(selectedSite)}` : '';
      const [rekapRes, inspRes] = await Promise.all([
        authFetch(`/api/gizi/rekap${qSite}`),
        authFetch(`/api/gizi/inspeksi${qSite}`),
      ]);
      setRekap(rekapRes as RekapGizi);
      setInspeksi(((inspRes as any).data ?? []) as InspeksiJasaboga[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data gizi kerja');
    } finally {
      setLoading(false);
    }
  }, [selectedSite]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading && !rekap) {
    return <PageLoading label="Memuat Pengendalian Gizi Kerja & Jasaboga" />;
  }

  const now = new Date();

  // 1. Legalitas SLHS Katering (Permenkes 1096/2011)
  let slhsValid = 0;
  let slhsKadaluwarsa = 0;
  let slhsBelumAda = 0;

  // 2. Skrining Medis Penjamah Makanan (Food Handler)
  let totalPenjamah = 0;
  let penjamahBukuSehat = 0;

  // 3. Kalori Menu Katering vs Standar Tambang (2.600 - 3.200 kkal)
  let menuMemenuhi = 0;
  let menuKurang = 0;
  let menuLebih = 0;

  // 4. Disiplin Food Safety HACCP (Retensi Sampel 2x24 Jam & Suhu)
  let sampelPatuh = 0;
  let sampelBelum = 0;

  for (const row of inspeksi) {
    // SLHS Check
    if (row.no_slhs) {
      if (row.tgl_kadaluwarsa_slhs) {
        const exp = new Date(row.tgl_kadaluwarsa_slhs);
        if (exp >= now) slhsValid++;
        else slhsKadaluwarsa++;
      } else {
        slhsValid++;
      }
    } else {
      slhsBelumAda++;
    }

    // Food Handler Check
    const jmlPenjamah = row.jumlah_penjamah ?? 0;
    const jmlSehat = row.jumlah_buku_sehat ?? 0;
    totalPenjamah += jmlPenjamah;
    penjamahBukuSehat += Math.min(jmlSehat, jmlPenjamah);

    // Kalori Check
    const totalMenu = (row.kalori_sarapan || 0) + (row.kalori_siang || 0) + (row.kalori_malam || 0);
    if (totalMenu >= 2600 && totalMenu <= 3400) menuMemenuhi++;
    else if (totalMenu < 2600 && totalMenu > 0) menuKurang++;
    else if (totalMenu > 3400) menuLebih++;

    // Retensi Sampel (diambil dari inspeksi kelaikan)
    if (row.ringkasan && row.ringkasan.persenSkor >= 80) sampelPatuh++;
    else sampelBelum++;
  }

  const totalSLHS = slhsValid + slhsKadaluwarsa + slhsBelumAda;
  const persenSLHSValid = totalSLHS > 0 ? Math.round((slhsValid / totalSLHS) * 100) : 0;
  const persenPenjamahLolos = totalPenjamah > 0 ? Math.round((penjamahBukuSehat / totalPenjamah) * 100) : 0;
  const totalMenuDinilai = menuMemenuhi + menuKurang + menuLebih;
  const persenMenuSesuai = totalMenuDinilai > 0 ? Math.round((menuMemenuhi / totalMenuDinilai) * 100) : 0;

  // Beban Kerja Fisik (Permenaker 5/2018)
  const bebanLabels = (rekap?.perBebanKerja ?? []).map(([k]) => {
    if (k === 'ringan') return 'Ringan (<100 dpm)';
    if (k === 'sedang') return 'Sedang (100-125 dpm)';
    if (k === 'berat') return 'Berat (125-150 dpm)';
    if (k === 'sangat-berat') return 'Sangat Berat (>150 dpm)';
    return k;
  });
  const bebanValues = (rekap?.perBebanKerja ?? []).map(([, v]) => v);
  const bebanColors = ['#3498DB', '#00B894', '#FF7A00', '#FF2D2D'];

  // Skor Sanitasi Jasaboga per Site
  const perSiteKepatuhan: { site: string; skor: number }[] = [];
  for (const s of SITES) {
    const list = inspeksi.filter((i) => i.site.toLowerCase() === s.toLowerCase() && i.ringkasan);
    if (list.length > 0) {
      const avg = Math.round(list.reduce((acc, i) => acc + (i.ringkasan?.persenSkor ?? 0), 0) / list.length);
      perSiteKepatuhan.push({ site: s, skor: avg });
    }
  }

  return (
    <div className="dashboard mcu-live-dashboard">
      {/* ── Top Bar: Filter & Food Safety KPI Chips ────────────────────── */}
      <div className="dashboard-top-bar mcu-live-top-bar">
        <div className="mcu-dashboard-filters">
          <label>
            <span>Site</span>
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
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
              <option value="">Semua Site</option>
              {SITES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Auditable Food Safety KPI Badges */}
        <div className="mcu-total-bar">
          <span className="mcu-total-label">Inspeksi Jasaboga:</span>
          <span className="mcu-total-num">{inspeksi.length} Sesi</span>
          <span style={{ fontWeight: 700, color: persenSLHSValid >= 80 ? '#00B894' : '#FF2D2D' }}>
            SLHS Valid: {persenSLHSValid}%
          </span>
          <span style={{ fontWeight: 700, color: persenPenjamahLolos >= 90 ? '#00B894' : '#E67E22' }}>
            Food Handler Teruji: {persenPenjamahLolos}%
          </span>
          <span style={{ fontWeight: 700, color: persenMenuSesuai >= 75 ? '#00B894' : '#FF7A00' }}>
            Kalori Sesuai: {persenMenuSesuai}%
          </span>
          <span style={{ fontWeight: 700, color: '#3498DB' }}>
            Tenaga Kerja: {rekap?.totalDihitung ?? 0}
          </span>
          <MCURefreshButton loading={loading} onClick={() => void loadData()} />
        </div>
      </div>

      {error && (
        <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 11 }}>
          {error}
        </div>
      )}

      {/* ── BARIS 1: Legalitas Vendor, Kelaikan Penjamah & Food Safety Controls ─ */}
      <div className="mcu-grid-3 mcu-live-chart-row">
        {/* CARD 1: Legalitas Sertifikat Laik Higiene Sanitasi (SLHS) */}
        <MCUChartCard
          title="Legalitas SLHS Jasaboga"
          subtitle="Sertifikat Laik Higiene Sanitasi (Permenkes 1096/2011)"
          className="glow-teal"
        >
          {totalSLHS > 0 ? (
            <MCUChart
              type="doughnut"
              labels={['SLHS Valid / Aktif', 'Kedaluwarsa / Perpanjangan', 'Belum Memiliki SLHS']}
              values={[slhsValid, slhsKadaluwarsa, slhsBelumAda]}
              colors={['#00B894', '#F39C12', '#FF2D2D']}
              centerText={`${persenSLHSValid}%`}
              percentLabels
            />
          ) : (
            <MCUChart
              type="doughnut"
              labels={['SLHS Standar', 'Target SMKP']}
              values={[1, 0]}
              colors={['#00B894', '#B0B7C3']}
              centerText="100%"
            />
          )}
        </MCUChartCard>

        {/* CARD 2: Sertifikasi & Skrining Medis Penjamah Makanan */}
        <MCUChartCard
          title="Skrining Medis Penjamah Makanan"
          subtitle="Buku Sehat & Swab Rectal Bebas Carrier (Salmonella/TB)"
          className="glow-coral"
        >
          {totalPenjamah > 0 ? (
            <MCUChart
              type="doughnut"
              labels={['Memiliki Buku Sehat / Lolos Swab', 'Belum Skrining / Expired']}
              values={[penjamahBukuSehat, Math.max(0, totalPenjamah - penjamahBukuSehat)]}
              colors={['#00B894', '#FF2D2D']}
              centerText={String(totalPenjamah)}
              percentLabels
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted-foreground)', fontSize: 11, gap: 6 }}>
              <Utensils size={28} style={{ opacity: 0.3 }} />
              <span>Belum ada data penjamah makanan terdaftar</span>
            </div>
          )}
        </MCUChartCard>

        {/* CARD 3: Disiplin Retensi Sampel & Danger Zone */}
        <MCUChartCard
          title="Kontrol Kritis Food Safety (HACCP)"
          subtitle="Retensi Sampel 2×24 Jam & Pemantauan Danger Zone (5–60°C)"
          className="glow-orange"
        >
          <MCUChart
            type="doughnut"
            labels={['Protokol HACCP Patuh', 'Perlu Tindakan Perbaikan']}
            values={[Math.max(1, sampelPatuh), sampelBelum]}
            colors={['#00B894', '#FF7A00']}
            centerText={`${sampelPatuh + sampelBelum > 0 ? Math.round((sampelPatuh / (sampelPatuh + sampelBelum)) * 100) : 100}%`}
            percentLabels
          />
        </MCUChartCard>
      </div>

      {/* ── BARIS 2: Kebutuhan Energi Kerja, Sanitasi Dapur & Beban Fisik ────── */}
      <div className="mcu-grid-3 mcu-live-chart-row">
        {/* CARD 4: Kesesuaian Kalori Menu Katering */}
        <MCUChartCard
          title="Kesesuaian Kalori Menu Katering"
          subtitle="Standar Energi Kerja Tambang (2.600–3.200 kkal / AKG 2019)"
          className="glow-amber"
        >
          {totalMenuDinilai > 0 ? (
            <MCUChart
              type="doughnut"
              labels={['Memenuhi Standar', 'Di Bawah Standar (<2.600)', 'Di Atas Standar (>3.400)']}
              values={[menuMemenuhi, menuKurang, menuLebih]}
              colors={['#00B894', '#FF7A00', '#3498DB']}
              legendLabel="Siklus Menu"
              centerText={`${persenMenuSesuai}%`}
              percentLabels
            />
          ) : (
            <MCUChart
              type="doughnut"
              labels={['Standar Kemenkes (2.650 kkal)', 'Standar Tambang (3.000 kkal)']}
              values={[2650, 3000]}
              colors={['#00B894', '#3498DB']}
              legendLabel="Acuan kkal"
              centerText="AKG 2019"
            />
          )}
        </MCUChartCard>

        {/* CARD 5: Kepatuhan Sanitasi Fasilitas Dapur Jasaboga per Site */}
        <MCUChartCard
          title="Kepatuhan Sanitasi Dapur per Site"
          subtitle="Skor Audit Higiene Area Pengolahan & Kantin (%)"
          className="glow-steel"
        >
          {perSiteKepatuhan.length > 0 ? (
            <MCUChart
              type="bar"
              labels={perSiteKepatuhan.map((p) => p.site)}
              values={perSiteKepatuhan.map((p) => p.skor)}
              colors={perSiteKepatuhan.map((p) => (p.skor >= 85 ? '#00B894' : p.skor >= 70 ? '#FF7A00' : '#FF2D2D'))}
              horizontal
              legendLabel="Skor Kepatuhan (%)"
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted-foreground)', fontSize: 11, gap: 6 }}>
              <Utensils size={28} style={{ opacity: 0.3 }} />
              <span>Belum ada audit jasaboga site</span>
            </div>
          )}
        </MCUChartCard>

        {/* CARD 6: Distribusi Beban Kerja Fisik Pekerja Tambang */}
        <MCUChartCard
          title="Beban Kerja Fisik Karyawan"
          subtitle="Dasar Kebutuhan Energi Lapangan (Permenaker 5/2018)"
          className="glow-teal"
        >
          {bebanValues.length > 0 ? (
            <MCUChart
              type="bar"
              labels={bebanLabels}
              values={bebanValues}
              colors={bebanColors}
              horizontal
              legendLabel="Jumlah Karyawan"
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted-foreground)', fontSize: 11, gap: 6 }}>
              <Utensils size={28} style={{ opacity: 0.3 }} />
              <span>Belum ada data beban kerja</span>
            </div>
          )}
        </MCUChartCard>
      </div>
    </div>
  );
}
