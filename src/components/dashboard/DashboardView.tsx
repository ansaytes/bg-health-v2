'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { MONTHS, JOBSITES } from '@/lib/lagging-data';

/* ──────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────── */

interface KpiRow {
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

interface AsrRankRow {
  jobsite: string;
  asr: number;
  man_power: number;
  bulan: number;
  tahun: number;
}

interface SickEmployee {
  id?: number;
  nik: string | null;
  nama: string;
  jobsite: string;
  jabatan: string | null;
  tgl_mulai_a: string | null;
  tgl_selesai_a: string | null;
  hari_a: number;
  tgl_mulai_b: string | null;
  tgl_selesai_b: string | null;
  hari_b: number;
  tgl_mulai_c: string | null;
  tgl_selesai_c: string | null;
  hari_c: number;
  jumlah_spell: number;
  bulan: number | null;
  tahun: number | null;
}

const MONTHS_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/* Period range: 21st of previous month → 20th of selected month */
function getSickPeriodRange(bulan: number, tahun: number) {
  const prevMonth = bulan === 1 ? 12 : bulan - 1;
  const prevYear = bulan === 1 ? tahun - 1 : tahun;
  return {
    start: `${prevYear}-${String(prevMonth).padStart(2, '0')}-21`,
    end: `${tahun}-${String(bulan).padStart(2, '0')}-20`,
    label: `21 ${MONTHS_FULL[prevMonth - 1]} ${prevYear} - 20 ${MONTHS_FULL[bulan - 1]} ${tahun}`,
  };
}

/* ──────────────────────────────────────────────────────────────
   Main Component — pure Supabase, no static fallback
   ────────────────────────────────────────────────────────────── */

export default function DashboardView() {
  const [selectedSite, setSelectedSite] = useState<string>('All Site');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>(1);

  const [kpiData, setKpiData] = useState<KpiRow[]>([]);
  const [asrRanking, setAsrRanking] = useState<AsrRankRow[]>([]);
  const [sickList, setSickList] = useState<SickEmployee[]>([]);
  const [loadingKpi, setLoadingKpi] = useState(true);
  const [loadingSick, setLoadingSick] = useState(false);
  const [loadingAsr, setLoadingAsr] = useState(false);
  const [chartReady, setChartReady] = useState(false);

  /* ─── Fetch KPI data when site/year changes ─────────────── */
  useEffect(() => {
    let cancelled = false;
    setLoadingKpi(true);
    (async () => {
      try {
        const view = selectedSite === 'All Site' ? 'view=all_site&' : '';
        const siteParam = selectedSite === 'All Site' ? '' : `jobsite=${encodeURIComponent(selectedSite)}&`;
        const url = `/api/health-indicators?${view}${siteParam}tahun=${selectedYear}`;
        const res = await fetch(url);
        const json = await res.json();
        if (!cancelled && json.success && Array.isArray(json.data)) {
          setKpiData(json.data);
        } else if (!cancelled) {
          setKpiData([]);
        }
      } catch {
        if (!cancelled) setKpiData([]);
      } finally {
        if (!cancelled) setLoadingKpi(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedSite, selectedYear]);

  /* ─── Determine display month ──────────────────────────── */
  const effectiveMonthIdx: number = useMemo(() => {
    if (selectedMonth === 'all') {
      if (kpiData.length > 0) {
        const maxBulan = kpiData.reduce((max, r) => Math.max(max, r.bulan), 0);
        if (maxBulan > 0) return maxBulan - 1;
      }
      return 0;
    }
    return selectedMonth - 1;
  }, [selectedMonth, kpiData]);

  const bulanNum = effectiveMonthIdx + 1;
  const isYTD = selectedMonth === 'all';

  /* ─── Compute currentMonth (single row to display) ─────── */
  const currentMonth = useMemo((): KpiRow | null => {
    if (kpiData.length === 0) return null;

    if (isYTD) {
      // YTD = SUM counts + AVG ratios/rates across all months with data
      const rows = kpiData.filter(r => r.man_power > 0 || r.man_hours > 0 || r.tk_sakit > 0);
      if (rows.length === 0) return null;
      const sum = (k: keyof KpiRow) => rows.reduce((acc, r) => acc + (r[k] as number), 0);
      const avg = (k: keyof KpiRow) => {
        let valid: KpiRow[] = rows;
        if (k === 'rkk' || k === 'cmr' || k === 'fr_pak') valid = rows.filter(r => r.man_power > 0);
        else if (k === 'mfr' || k === 'asr') valid = rows.filter(r => r.man_hours > 0);
        else if (k === 'ssr') valid = rows.filter(r => r.tk_sakit > 0);
        if (valid.length === 0) return 0;
        return valid.reduce((acc, r) => acc + (r[k] as number), 0) / valid.length;
      };
      return {
        tahun: selectedYear, bulan: 0, jobsite: selectedSite,
        man_power: Math.round(sum('man_power') / rows.length),
        man_hours: sum('man_hours'),
        kunjungan_klinik: sum('kunjungan_klinik'),
        tk_sakit: sum('tk_sakit'),
        absensi_sakit: sum('absensi_sakit'),
        spell: sum('spell'),
        penyakit_akibat_kerja: sum('penyakit_akibat_kerja'),
        kejadian_penyakit_tk: sum('kejadian_penyakit_tk'),
        layak_bekerja: Math.round(sum('layak_bekerja') / rows.length),
        rkk: avg('rkk'), cmr: avg('cmr'), mfr: avg('mfr'),
        ssr: avg('ssr'), asr: avg('asr'), fr_pak: avg('fr_pak'),
        kaptk: sum('kaptk'),
      };
    }

    // Specific month: find the row
    return kpiData.find(r => r.bulan === bulanNum) || null;
  }, [kpiData, bulanNum, isYTD, selectedSite, selectedYear]);

  /* ─── Fetch ASR ranking ────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    setLoadingAsr(true);
    (async () => {
      try {
        const url = isYTD
          ? `/api/health-indicators?asr_ranking=true&tahun=${selectedYear}`
          : `/api/health-indicators?asr_ranking=true&tahun=${selectedYear}&bulan=${bulanNum}`;
        const res = await fetch(url);
        const json = await res.json();
        if (!cancelled && json.success) {
          let rows: AsrRankRow[] = json.data || [];
          if (isYTD) {
            // Aggregate ASR across months per site (average)
            const bySite: Record<string, { sum: number; count: number; mp: number }> = {};
            rows.forEach((r: AsrRankRow) => {
              if (!bySite[r.jobsite]) bySite[r.jobsite] = { sum: 0, count: 0, mp: 0 };
              bySite[r.jobsite].sum += r.asr;
              bySite[r.jobsite].count++;
              bySite[r.jobsite].mp = Math.max(bySite[r.jobsite].mp, r.man_power);
            });
            rows = Object.entries(bySite)
              .map(([site, v]) => ({
                jobsite: site,
                asr: v.count > 0 ? v.sum / v.count : 0,
                man_power: v.mp,
                bulan: 0,
                tahun: selectedYear,
              }))
              .filter(s => s.asr > 0)
              .sort((a, b) => b.asr - a.asr)
              .slice(0, 10);
          }
          if (!cancelled) setAsrRanking(rows);
        }
      } catch {
        if (!cancelled) setAsrRanking([]);
      } finally {
        if (!cancelled) setLoadingAsr(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedYear, bulanNum, isYTD]);

  /* ─── Fetch sick list when month != 'all' ──────────────── */
  useEffect(() => {
    if (isYTD) {
      setSickList([]);
      return;
    }
    let cancelled = false;
    setLoadingSick(true);
    const period = getSickPeriodRange(bulanNum, selectedYear);
    (async () => {
      try {
        const url = `/api/sick-employees?bulan=${bulanNum}&tahun=${selectedYear}` +
          (selectedSite !== 'All Site' ? `&jobsite=${encodeURIComponent(selectedSite)}` : '') +
          `&period_start=${period.start}&period_end=${period.end}`;
        const res = await fetch(url);
        const json = await res.json();
        if (!cancelled && json.success) {
          setSickList(json.data || []);
        } else if (!cancelled) {
          setSickList([]);
        }
      } catch {
        if (!cancelled) setSickList([]);
      } finally {
        if (!cancelled) setLoadingSick(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isYTD, bulanNum, selectedYear, selectedSite]);

  /* ─── Stat values (safe access) ───────────────────────── */
  const rkk = (currentMonth?.rkk ?? 0) * 100;
  const cmr = (currentMonth?.cmr ?? 0) * 100;
  const mfr = currentMonth?.mfr ?? 0;
  const ssr = currentMonth?.ssr ?? 0;
  const asr = currentMonth?.asr ?? 0;
  const frPak = (currentMonth?.fr_pak ?? 0) * 100;
  const kaptk = currentMonth?.kaptk ?? 0;
  const manPower = currentMonth?.man_power ?? 0;
  const manHours = currentMonth?.man_hours ?? 0;
  const tkSakit = currentMonth?.tk_sakit ?? 0;
  const absensiSakit = currentMonth?.absensi_sakit ?? 0;

  /* ─── Period label ─────────────────────────────────────── */
  const periodLabel = isYTD
    ? `YTD ${selectedYear}`
    : getSickPeriodRange(bulanNum, selectedYear).label;

  /* ─── Handle month change ──────────────────────────────── */
  const handleMonthChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setSelectedMonth(v === 'all' ? 'all' : parseInt(v));
    setChartReady(false);
  }, []);

  /* ─── Chart canvas drawing ────────────────────────────── */
  const asrRank = asrRanking.slice(0, 10);

  useEffect(() => {
    if (!chartReady || asrRank.length === 0) return;
    const canvas = document.getElementById('asrChart') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const pad = { top: 8, right: 64, bottom: 22, left: 110 };
    const chartW = Math.max(W - pad.left - pad.right, 10);
    const chartH = Math.max(H - pad.top - pad.bottom, 10);

    const isDark = document.documentElement.classList.contains('dark');
    const textCol = isDark ? '#aaaaaa' : '#666666';
    const gridCol = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const maxVal = Math.max(...asrRank.map(d => d.asr), 1);

    ctx.clearRect(0, 0, W, H);

    const barCount = asrRank.length;
    const gap = chartH / barCount;
    const barH = Math.min(20, gap * 0.7);

    asrRank.forEach((d, i) => {
      const y = pad.top + gap * i + (gap - barH) / 2;
      const w = (d.asr / maxVal) * chartW;

      // Site name on the left
      ctx.fillStyle = isDark ? '#f0f0f0' : '#1a1a1a';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const label = d.jobsite.length > 14 ? d.jobsite.slice(0, 12) + '..' : d.jobsite;
      ctx.fillText(label, pad.left - 8, y + barH / 2);

      // Bar
      const grad = ctx.createLinearGradient(pad.left, 0, pad.left + w, 0);
      grad.addColorStop(0, '#E54B1A');
      grad.addColorStop(1, '#FF8C42');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(pad.left, y, Math.max(w, 2), barH, 3);
      ctx.fill();

      // Datalabel at bar end
      ctx.fillStyle = textCol;
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(d.asr.toFixed(2), pad.left + w + 6, y + barH / 2);
    });

    // Vertical grid lines + x-axis labels
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const x = pad.left + (chartW / gridLines) * i;
      ctx.strokeStyle = gridCol;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + chartH); ctx.stroke();
      const val = Math.round((maxVal / gridLines) * i);
      ctx.fillStyle = textCol;
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(val.toLocaleString('id-ID'), x, pad.top + chartH + 12);
    }
  }, [chartReady, asrRank]);

  useEffect(() => {
    const t = setTimeout(() => setChartReady(true), 50);
    return () => clearTimeout(t);
  }, [selectedMonth, selectedSite, selectedYear, asrRank.length]);

  const sickListCount = sickList.length;

  return (
    <div className="dashboard">
      {/* Header filter bar */}
      <div className="header-filter">
        <div className="filter-tag">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Filtering
        </div>
        <select value={selectedSite} onChange={(e) => { setSelectedSite(e.target.value); setChartReady(false); }}>
          {JOBSITES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={String(selectedMonth)} onChange={handleMonthChange}>
          <option value="all">Bulan (YTD)</option>
          {MONTHS.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select value={selectedYear} onChange={(e) => { setSelectedYear(parseInt(e.target.value)); setChartReady(false); }}>
          <option value={2025}>2025</option>
          <option value={2026}>2026</option>
          <option value={2027}>2027</option>
        </select>
      </div>

      <div className="health-main-grid">
        {/* LEFT column */}
        <div className="health-left-col">
          {/* Stat card */}
          <div className="card glow-orange" style={{ flex: 1.3, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="card-head" style={{ flexShrink: 0 }}>
              <div className="card-icon" style={{ background: 'rgba(229,75,26,.1)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              </div>
              <div>
                <h2>Statistik Kesehatan</h2>
                <p>{selectedSite === 'All Site' ? 'Seluruh jobsite' : selectedSite} - {periodLabel}</p>
              </div>
            </div>
            {loadingKpi ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: 11 }}>
                Memuat data...
              </div>
            ) : currentMonth ? (
              <>
                <div className="stats-grid">
                  <div className="stat-box stat-wide" style={{ borderLeft: '3px solid #00B894' }}>
                    <div className="stat-val" style={{ color: '#00B894' }}>{rkk.toFixed(2)}%</div>
                    <div className="stat-label">RKK - Rasio Kelayakan Kerja</div>
                  </div>
                  <div className="stat-box" style={{ borderLeft: '3px solid #00CEC9' }}>
                    <div className="stat-val" style={{ color: '#00CEC9' }}>{cmr.toFixed(2)}%</div>
                    <div className="stat-label">CMR</div>
                  </div>
                  <div className="stat-box" style={{ borderLeft: '3px solid #FF8C42' }}>
                    <div className="stat-val" style={{ color: '#FF8C42' }}>{mfr.toFixed(2)}</div>
                    <div className="stat-label">MFR</div>
                  </div>
                  <div className="stat-box" style={{ borderLeft: '3px solid #FF6347' }}>
                    <div className="stat-val" style={{ color: '#FF6347' }}>{ssr.toFixed(2)}</div>
                    <div className="stat-label">SSR</div>
                  </div>
                  <div className="stat-box" style={{ borderLeft: '3px solid #ff4d00' }}>
                    <div className="stat-val" style={{ color: '#ff4d00' }}>{asr.toFixed(2)}</div>
                    <div className="stat-label">ASR</div>
                  </div>
                  <div className="stat-box" style={{ borderLeft: '3px solid #778899' }}>
                    <div className="stat-val" style={{ color: '#778899' }}>{frPak.toFixed(2)}%</div>
                    <div className="stat-label">FR PAK</div>
                  </div>
                  <div className="stat-box" style={{ borderLeft: '3px solid #FF4444' }}>
                    <div className="stat-val" style={{ color: '#FF4444' }}>{kaptk.toFixed(0)}</div>
                    <div className="stat-label">KAPTK</div>
                  </div>
                </div>
                <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 20, flexWrap: 'wrap', flexShrink: 0 }}>
                  <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}><b style={{ color: 'var(--foreground)' }}>{manPower.toLocaleString('id-ID')}</b> Man Power</span>
                  <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}><b style={{ color: 'var(--foreground)' }}>{(manHours / 1000).toFixed(0)}K</b> Man Hours</span>
                  <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}><b style={{ color: 'var(--foreground)' }}>{tkSakit}</b> TK Sakit</span>
                  <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}><b style={{ color: 'var(--foreground)' }}>{absensiSakit}</b> Hari Absensi</span>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: 11, padding: 20, textAlign: 'center' }}>
                Belum ada data untuk {selectedSite} pada periode {periodLabel}
              </div>
            )}
          </div>

          {/* ASR ranking card */}
          <div className="card glow-amber" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="card-head" style={{ flexShrink: 0 }}>
              <div className="card-icon" style={{ background: 'rgba(255,140,66,.1)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#ff8c42" strokeWidth="2" strokeLinecap="round"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" /></svg>
              </div>
              <div>
                <h2>10 Jobsite dengan ASR tertinggi</h2>
                <p>{isYTD ? `YTD ${selectedYear}` : `${MONTHS[effectiveMonthIdx]} ${selectedYear}`}</p>
              </div>
            </div>
            <div className="chart-box" style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <canvas id="asrChart" style={{ position: 'absolute', inset: 0 }} />
              {loadingAsr && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: 11 }}>
                  Memuat ranking...
                </div>
              )}
              {!loadingAsr && asrRank.length === 0 && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: 11, textAlign: 'center', padding: 20 }}>
                  Belum ada data ASR untuk periode {isYTD ? `YTD ${selectedYear}` : `${MONTHS[effectiveMonthIdx]} ${selectedYear}`}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT column - Sick list */}
        <div className="card glow-coral sick-list-card">
          <div className="card-head" style={{ flexShrink: 0 }}>
            <div className="card-icon" style={{ background: 'rgba(255,99,71,.1)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#ff6347" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
            </div>
            <div>
              <h2>List Karyawan Sakit</h2>
              <p>{isYTD
                ? 'Harap Pilih Periode Bulan'
                : `${sickListCount} karyawan ${selectedSite !== 'All Site' ? `(${selectedSite})` : ''} - ${periodLabel}`}</p>
            </div>
          </div>
          <div className="sick-list-scroll">
            {isYTD ? (
              <div className="sick-empty-state">
                Harap Pilih Periode Bulan Untuk Menampilkan List Karyawan Sakit
              </div>
            ) : loadingSick ? (
              <div className="sick-empty-state">Memuat data karyawan sakit...</div>
            ) : sickList.length === 0 ? (
              <div className="sick-empty-state">Tidak ada karyawan sakit untuk periode ini.</div>
            ) : (
              <table className="sick-table">
                <thead>
                  <tr>
                    <th>NIK</th>
                    <th>Nama</th>
                    <th>Jobsite</th>
                    <th>Jabatan</th>
                    <th className="num-col">Hari A</th>
                    <th className="num-col">Hari B</th>
                    <th className="num-col">Hari C</th>
                    <th className="num-col">Spell</th>
                  </tr>
                </thead>
                <tbody>
                  {sickList.map((emp, idx) => (
                    <tr key={emp.id ?? idx}>
                      <td className="nik-cell">{emp.nik || '-'}</td>
                      <td className="nama-cell">{emp.nama}</td>
                      <td>{emp.jobsite}</td>
                      <td>{emp.jabatan || '-'}</td>
                      <td className="num-col">{emp.hari_a || '-'}</td>
                      <td className="num-col">{emp.hari_b || '-'}</td>
                      <td className="num-col">{emp.hari_c || '-'}</td>
                      <td className="num-col spell-cell">{emp.jumlah_spell}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
