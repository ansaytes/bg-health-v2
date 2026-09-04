'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { MONTHS, ALL_SITE, getASRRanking as getStaticASRRanking, type SiteASR } from '@/lib/lagging-data';

interface KpiRow {
  tahun: number;
  bulan: number;
  man_power: number;
  man_hours: number;
  tk_sakit: number;
  absensi_sakit: number;
  spell: number;
  rkk: number;
  cmr: number;
  mfr: number;
  ssr: number;
  asr: number;
  fr_pak: number;
  kaptk: number;
}

interface SiteRow {
  tahun: number;
  bulan: number;
  jobsite: string;
  man_power: number;
  asr: number;
}

interface SickEmployee {
  nama: string;
  jobsite: string;
  jabatan: string;
  tanggal_mulai_a: string;
  tanggal_selesai_a: string;
  jumlah_hari_a: number;
  jumlah_spell: number;
}

function getStaticMonthIndex(): number {
  for (let i = 11; i >= 0; i--) {
    if (ALL_SITE.leading.man_power[i] > 0) return i;
  }
  return 0;
}

function getLatestMonthFromData(data: KpiRow[]): number {
  if (data.length === 0) return getStaticMonthIndex();
  const sorted = [...data].sort((a, b) => a.bulan - b.bulan);
  return sorted[sorted.length - 1].bulan - 1;
}

export default function DashboardView() {
  const [apiData, setApiData] = useState<KpiRow[]>([]);
  const [siteData, setSiteData] = useState<SiteRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<number>(getStaticMonthIndex());
  const [chartReady, setChartReady] = useState(false);
  const [sickList, setSickList] = useState<SickEmployee[]>([]);
  const fetchedRef = useRef(false);

  const useAPI = apiData.length > 0;

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    (async () => {
      try {
        const [kpiRes, siteRes] = await Promise.all([
          fetch('/api/health-statistics?tahun=2026'),
          fetch('/api/health-statistics-sites?tahun=2026'),
        ]);
        const kpiJson = await kpiRes.json();
        const siteJson = await siteRes.json();

        if (kpiJson.success && kpiJson.data.length > 0) {
          setApiData(kpiJson.data);
          const latestBulan = kpiJson.data.sort((a: KpiRow, b: KpiRow) => b.bulan - a.bulan)[0].bulan;
          setSelectedMonth(latestBulan - 1);
        }
        if (siteJson.success) {
          setSiteData(siteJson.data);
        }

        // Fetch sick employees for latest month
        const sickBulan = kpiJson.data && kpiJson.data.length > 0
          ? kpiJson.data.sort((a: KpiRow, b: KpiRow) => b.bulan - a.bulan)[0].bulan
          : 7;
        const sickRes = await fetch(`/api/sick-employees?bulan=${sickBulan}`);
        const sickJson = await sickRes.json();
        if (sickJson.success) {
          setSickList(sickJson.data || []);
        }
      } catch {
        // fallback to static data
      } finally {
        setFetching(false);
      }
    })();
  }, []);

  const monthIdx = selectedMonth;
  const bulanNum = monthIdx + 1;

  const currentMonth = useMemo((): KpiRow | null => {
    if (useAPI) {
      return apiData.find(r => r.bulan === bulanNum) || null;
    }
    return {
      tahun: 2026,
      bulan: bulanNum,
      man_power: ALL_SITE.leading.man_power[monthIdx],
      man_hours: ALL_SITE.leading.man_hours[monthIdx],
      tk_sakit: ALL_SITE.leading.tk_sakit[monthIdx],
      absensi_sakit: ALL_SITE.leading.absensi_sakit[monthIdx],
      spell: ALL_SITE.leading.spell[monthIdx],
      rkk: ALL_SITE.lagging.rkk[monthIdx],
      cmr: ALL_SITE.lagging.cmr[monthIdx],
      mfr: ALL_SITE.lagging.mfr[monthIdx],
      ssr: ALL_SITE.lagging.ssr[monthIdx],
      asr: ALL_SITE.lagging.asr[monthIdx],
      fr_pak: ALL_SITE.lagging.pak[monthIdx],
      kaptk: ALL_SITE.lagging.kaptk[monthIdx],
    };
  }, [useAPI, apiData, bulanNum, monthIdx]);

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

  const asrRanking = useMemo(() => {
    if (useAPI) {
      return siteData
        .filter(s => s.bulan === bulanNum && s.asr > 0)
        .map(s => ({ site: s.jobsite, asr: s.asr, mp: s.man_power }))
        .sort((a, b) => b.asr - a.asr)
        .slice(0, 10);
    }
    return getStaticASRRanking(monthIdx);
  }, [useAPI, siteData, bulanNum, monthIdx]);

  const handleMonthChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const m = parseInt(e.target.value);
    setSelectedMonth(m);
    setChartReady(false);
    // Fetch sick employees for selected month
    (async () => {
      try {
        const res = await fetch(`/api/sick-employees?bulan=${m + 1}`);
        const json = await res.json();
        if (json.success) setSickList(json.data || []);
      } catch { setSickList([]); }
    })();
  }, []);

  const hasData = useAPI
    ? apiData.some(r => r.bulan === bulanNum)
    : ALL_SITE.leading.man_power[monthIdx] > 0;

  useEffect(() => {
    if (!chartReady || asrRanking.length === 0) return;

    const canvas = document.getElementById('asrChart') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const pad = { top: 20, right: 16, bottom: 56, left: 52 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    const isDark = document.documentElement.classList.contains('dark');
    const textCol = isDark ? '#aaaaaa' : '#666666';
    const gridCol = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const maxVal = Math.max(...asrRanking.map(d => d.asr), 1);

    ctx.clearRect(0, 0, W, H);

    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = pad.top + (chartH / gridLines) * i;
      ctx.strokeStyle = gridCol;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      const val = Math.round(maxVal - (maxVal / gridLines) * i);
      ctx.fillStyle = textCol;
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(val.toLocaleString('id-ID'), pad.left - 6, y);
    }

    const barH = Math.min(24, (chartH / asrRanking.length) * 0.65);
    const gap = chartH / asrRanking.length;

    asrRanking.forEach((d, i) => {
      const y = pad.top + gap * i + (gap - barH) / 2;
      const w = (d.asr / maxVal) * chartW;

      const grad = ctx.createLinearGradient(pad.left, 0, pad.left + w, 0);
      grad.addColorStop(0, '#ff4d00');
      grad.addColorStop(1, '#ff8c42');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(pad.left, y, Math.max(w, 2), barH, 4);
      ctx.fill();

      ctx.fillStyle = isDark ? '#f0f0f0' : '#1a1a1a';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const label = d.site.length > 18 ? d.site.slice(0, 16) + '..' : d.site;
      ctx.fillText(label, pad.left + 4, y + barH / 2);

      if (w > 80) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.textAlign = 'right';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(d.asr.toLocaleString('id-ID', { maximumFractionDigits: 0 }), pad.left + w - 8, y + barH / 2);
      }
    });
  }, [chartReady, asrRanking]);

  useEffect(() => {
    setChartReady(true);
  }, [monthIdx]);

  return (
    <div className="dashboard">
      <div className="header-filter">
        <div className="filter-tag">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
          Filtering
        </div>
        <select value="All Site"><option>All Site</option></select>
        <select value={String(monthIdx)} onChange={handleMonthChange}>
          {MONTHS.map((m, i) => (
            <option key={i} value={i} disabled={
              useAPI
                ? !apiData.some(r => r.bulan === i + 1)
                : ALL_SITE.leading.man_power[i] === 0
            }>{m}</option>
          ))}
        </select>
        <select value="2026" disabled><option value="2026">Tahun</option></select>
      </div>

      <div className="health-main-grid">
        <div className="health-left-col">
          <div className="card glow-orange" style={{ flex: 1.3, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="card-head" style={{ flexShrink: 0 }}>
              <div className="card-icon" style={{ background: 'rgba(255,77,0,.1)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#ff4d00" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              </div>
              <div>
                <h2>Statistik Kesehatan</h2>
                <p>Seluruh jobsite - {MONTHS[monthIdx]} 2026</p>
              </div>
            </div>
            <div className="stats-grid">
              <div className="stat-box stat-wide" style={{ borderLeft: '3px solid #00B894' }}>
                <div className="stat-val" style={{ color: '#00B894' }}>{rkk.toFixed(2)}%</div>
                <div className="stat-label">RKK</div>
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
                <div className="stat-label">SSR (Spell)</div>
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
                <div className="stat-val" style={{ color: '#FF4444' }}>{kaptk.toFixed(2)}</div>
                <div className="stat-label">KAPTK</div>
              </div>
            </div>
            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 20, flexWrap: 'wrap', flexShrink: 0 }}>
              <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}><b style={{ color: 'var(--foreground)' }}>{manPower.toLocaleString('id-ID')}</b> Man Power</span>
              <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}><b style={{ color: 'var(--foreground)' }}>{(manHours / 1000).toFixed(0)}K</b> Man Hours</span>
              <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}><b style={{ color: 'var(--foreground)' }}>{tkSakit}</b> TK Sakit</span>
              <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}><b style={{ color: 'var(--foreground)' }}>{absensiSakit}</b> Hari Absensi</span>
            </div>
          </div>

          <div className="card glow-amber" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="card-head" style={{ flexShrink: 0 }}>
              <div className="card-icon" style={{ background: 'rgba(255,140,66,.1)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#ff8c42" strokeWidth="2" strokeLinecap="round"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" /></svg>
              </div>
              <div>
                <h2>10 Jobsite dengan ASR tertinggi</h2>
                <p>Keparahan Absensi Rate - {MONTHS[monthIdx]} 2026</p>
              </div>
            </div>
            <div className="chart-box" style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <canvas id="asrChart" style={{ position: 'absolute', inset: 0 }} />
            </div>
          </div>
        </div>

        <div className="card glow-coral" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
          <div className="card-head" style={{ flexShrink: 0 }}>
            <div className="card-icon" style={{ background: 'rgba(255,99,71,.1)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#ff6347" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
            </div>
            <div>
              <h2>List Karyawan Sakit</h2>
              <p>{MONTHS[monthIdx]} 2026{tkSakit > 0 ? ` (${tkSakit} orang)` : ''}</p>
            </div>
          </div>
          <div className="sick-list">
            {sickList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 16, color: 'var(--muted-foreground)', fontSize: 9 }}>
                {tkSakit > 0 ? 'Data karyawan sakit belum tersedia di database.' : 'Tidak ada karyawan sakit untuk periode ini.'}
              </div>
            ) : (
              <div className="raw-table-scroll">
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>Jobsite</th>
                      <th>Mulai</th>
                      <th>Hari</th>
                      <th>Spell</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sickList.map((emp, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500, fontSize: 9 }}>{emp.nama}</td>
                        <td style={{ fontSize: 9 }}>{emp.jobsite}</td>
                        <td style={{ fontSize: 9 }}>{emp.tanggal_mulai_a || '-'}</td>
                        <td style={{ textAlign: 'center', fontSize: 9 }}>{emp.jumlah_hari_a}</td>
                        <td style={{ textAlign: 'center', fontSize: 9 }}>{emp.jumlah_spell}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
