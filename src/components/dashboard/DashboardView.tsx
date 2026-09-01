'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'] as const;
const MONTH_FULL = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const MKEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

const STAT_DEFS = [
  { id: 'rkk', kw: 'RKK', color: '#00B894', pct: true, wide: true },
  { id: 'cmr', kw: 'CMR', color: '#00CEC9', pct: true },
  { id: 'mfr', kw: 'MFR', color: '#FF8C42', pct: false },
  { id: 'ssr', kw: 'SSR', color: '#FF6347', pct: false },
  { id: 'asr', kw: 'ASR', color: '#ff4d00', pct: false },
  { id: 'frpak', kw: 'FR PAK', color: '#778899', pct: true },
  { id: 'kaptk', kw: 'KAPTK', color: '#FF4444', pct: false },
];

interface LaggingEntry {
  indicator: string;
  jan: number; feb: number; mar: number; apr: number;
  may: number; jun: number; jul: number; aug: number;
  sep: number; oct: number; nov: number; dec: number;
  ytd: number;
}

interface LeadingEntry {
  indicator: string;
  jan: number; feb: number; mar: number; apr: number;
  may: number; jun: number; jul: number; aug: number;
  sep: number; oct: number; nov: number; dec: number;
  total: number;
}

interface SiteData {
  lagging: LaggingEntry[];
  leading: LeadingEntry[];
  site: string;
}

interface AsrSite {
  name: string;
  jan: number; feb: number; mar: number; apr: number;
  may: number; jun: number; jul: number; aug: number;
  sep: number; oct: number; nov: number; dec: number;
}

function findByLabel<T extends { indicator: string }>(arr: T[], kw: string): T | undefined {
  return arr.find(e => e.indicator.toUpperCase().includes(kw.toUpperCase()));
}

function N(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function fmtNum(v: number): string {
  if (v >= 1000000) return (v / 1000000).toFixed(v % 1000000 === 0 ? 0 : 1) + 'M';
  if (v >= 1000) return (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'K';
  return Math.round(v).toLocaleString('id-ID');
}

export default function DashboardView() {
  const [sites, setSites] = useState<string[]>(['All Site']);
  const [selectedSite, setSelectedSite] = useState('All Site');
  const [monthFilter, setMonthFilter] = useState('all');
  const [siteCache, setSiteCache] = useState<Record<string, SiteData>>({});
  const [asrAllSites, setAsrAllSites] = useState<AsrSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartReady, setChartReady] = useState(false);
  const chartDrawnRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const sitesRes = await fetch('/api/lagging-sites?tahun=2026');
        const sitesJson = await sitesRes.json();
        if (sitesJson.success && sitesJson.data.length > 0) {
          setSites(sitesJson.data);
        }

        const asrRes = await fetch('/api/asr-ranking?tahun=2026');
        const asrJson = await asrRes.json();
        if (asrJson.success) {
          setAsrAllSites(asrJson.data || []);
        }

        const dataRes = await fetch('/api/lagging-indicators?tahun=2026&site=All Site');
        const dataJson = await dataRes.json();
        if (dataJson.success) {
          setSiteCache(prev => ({ ...prev, 'All Site': dataJson.data }));
        }
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadSite = useCallback(async (site: string) => {
    if (siteCache[site]) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/lagging-indicators?tahun=2026&site=${encodeURIComponent(site)}`);
      const json = await res.json();
      if (json.success) {
        setSiteCache(prev => ({ ...prev, [site]: json.data }));
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [siteCache]);

  const handleSiteChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const site = e.target.value;
    setSelectedSite(site);
    if (!siteCache[site]) {
      loadSite(site);
    }
  }, [siteCache, loadSite]);

  const handleMonthChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setMonthFilter(e.target.value);
    setChartReady(false);
    chartDrawnRef.current = false;
  }, []);

  const currentData = siteCache[selectedSite];
  const lagging = currentData?.lagging || [];
  const leading = currentData?.leading || [];

  const getActiveMonthKey = useMemo(() => {
    if (monthFilter === 'all') {
      for (let i = 11; i >= 0; i--) {
        const mpEntry = currentData?.leading?.find(e => e.indicator === 'Man Power');
        if (mpEntry && Number(mpEntry[MKEYS[i] as keyof LeadingEntry]) > 0) return MKEYS[i];
      }
      return 'jan';
    }
    return MKEYS[MONTHS.indexOf(monthFilter as typeof MONTHS[number])];
  }, [monthFilter, currentData]);

  const getMonthLabel = useMemo(() => {
    if (monthFilter === 'all' && selectedSite === 'All Site') return 'YTD';
    if (monthFilter === 'all') {
      const idx = MKEYS.indexOf(getActiveMonthKey);
      return MONTH_FULL[idx] || 'YTD';
    }
    return String(monthFilter);
  }, [monthFilter, selectedSite, getActiveMonthKey]);

  const statValues = useMemo(() => {
    const vals: Record<string, number> = {};
    STAT_DEFS.forEach(sd => {
      const entry = findByLabel(lagging, sd.kw);
      let val = 0;
      if (monthFilter === 'all') {
        val = entry ? N(entry.ytd) : 0;
      } else {
        val = entry ? N(entry[getActiveMonthKey as keyof LaggingEntry]) : 0;
      }
      if (sd.pct) val = val * 100;
      vals[sd.id] = val;
    });
    return vals;
  }, [lagging, monthFilter, getActiveMonthKey]);

  const quickStats = useMemo(() => {
    const getVal = (kw: string): number => {
      const entry = findByLabel(leading, kw);
      if (!entry) return 0;
      if (monthFilter === 'all') return N(entry.total);
      return N(entry[getActiveMonthKey as keyof LeadingEntry]);
    };
    return {
      manPower: getVal('Man Power'),
      manHours: getVal('Man Hours'),
      tkSakit: getVal('Tenaga Kerja Sakit'),
      absensiSakit: getVal('Total Absensi Sakit'),
    };
  }, [leading, monthFilter, getActiveMonthKey]);

  const asrRanking = useMemo(() => {
    if (asrAllSites.length === 0) return [];

    const list: { name: string; asr: number; month: string }[] = [];

    asrAllSites.forEach(site => {
      const siteName = String(site.name);
      if (monthFilter === 'all') {
        let maxVal = 0, maxMonth = '';
        MKEYS.forEach((m, i) => {
          const v = Number(site[m as keyof AsrSite]);
          if (v > maxVal) { maxVal = v; maxMonth = MONTH_FULL[i] || ''; }
        });
        if (maxVal > 0) {
          const d = siteName.length > 14 ? siteName.slice(0, 14) + '..' : siteName;
          list.push({ name: d, asr: maxVal, month: maxMonth });
        }
      } else {
        const mKey = MKEYS[MONTHS.indexOf(monthFilter as typeof MONTHS[number])];
        const v = Number(site[mKey as keyof AsrSite]);
        if (v > 0) {
          const d = siteName.length > 14 ? siteName.slice(0, 14) + '..' : siteName;
          list.push({ name: d, asr: v, month: String(monthFilter) });
        }
      }
    });

    return list.sort((a, b) => b.asr - a.asr).slice(0, 10);
  }, [asrAllSites, monthFilter]);

  useEffect(() => {
    if (!chartReady || asrRanking.length === 0) return;
    if (chartDrawnRef.current) return;
    chartDrawnRef.current = true;

    const canvas = document.getElementById('asrChart') as HTMLCanvasElement | null;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    if (rect.width === 0) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const isDark = document.documentElement.classList.contains('dark');
    const tickColor = isDark ? '#aaaaaa' : '#666666';
    const gridColor = isDark ? '#333333' : 'rgba(0,0,0,0.06)';

    ctx.clearRect(0, 0, W, H);

    const maxVal = Math.max(...asrRanking.map(d => d.asr), 1);
    const pad = { top: 8, right: 40, bottom: 8, left: 85 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;
    const barH = Math.min(16, (chartH / asrRanking.length) * 0.55);
    const gap = chartH / asrRanking.length;

    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const x = pad.left + (chartW / gridLines) * i;
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, H - pad.bottom); ctx.stroke();
      const val = (maxVal / gridLines) * i;
      ctx.fillStyle = tickColor;
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(val.toFixed(0), x, H - pad.bottom + 2);
    }

    asrRanking.forEach((d, i) => {
      const y = pad.top + gap * i + (gap - barH) / 2;
      const w = Math.max((d.asr / maxVal) * chartW, 2);

      const grad = ctx.createLinearGradient(pad.left, 0, pad.left + w, 0);
      grad.addColorStop(0, '#F39C12');
      grad.addColorStop(1, '#F5B041');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(pad.left, y, w, barH, 3);
      ctx.fill();

      ctx.fillStyle = tickColor;
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(d.name, pad.left - 6, y + barH / 2);

      ctx.fillStyle = tickColor;
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(d.asr.toFixed(2), pad.left + w + 4, y + barH / 2);
    });
  }, [chartReady, asrRanking]);

  useEffect(() => {
    setChartReady(true);
    chartDrawnRef.current = false;
  }, [monthFilter, selectedSite]);

  const statsSubtitle = `${selectedSite}${monthFilter !== 'all' ? ' - ' + String(monthFilter) + ' 2026' : ' - YTD 2026'}`;

  return (
    <div className="dashboard" style={{ position: 'relative' }}>
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: 10, backdropFilter: 'blur(4px)' }}>
          <div className="spinner" />
        </div>
      )}

      <div className="mcu-total-bar" style={{ justifyContent: 'flex-end' }}>
        <div className="health-quick-stats">
          <div className="hqs-item">
            <span className="hqs-val">{fmtNum(quickStats.manPower)}</span>
            <span className="hqs-label">Man Power</span>
          </div>
          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
          <div className="hqs-item">
            <span className="hqs-val">{fmtNum(quickStats.manHours)}</span>
            <span className="hqs-label">Man Hours</span>
          </div>
          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
          <div className="hqs-item">
            <span className="hqs-val" style={{ color: '#FF6347' }}>{Math.round(quickStats.tkSakit)}</span>
            <span className="hqs-label">TK Sakit</span>
          </div>
          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
          <div className="hqs-item">
            <span className="hqs-val" style={{ color: '#FF8C42' }}>{Math.round(quickStats.absensiSakit)}</span>
            <span className="hqs-label">Hari Absensi</span>
          </div>
        </div>
      </div>

      <div className="header-filter">
        <div className="header-filter-left">
          <div className="filter-tag">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 11, height: 11 }}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
            Filtering
          </div>
          <select value={selectedSite} onChange={handleSiteChange}>
            {sites.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={monthFilter} onChange={handleMonthChange}>
            <option value="all">Bulan</option>
            {MONTHS.map((m, i) => <option key={i} value={m}>{m}</option>)}
          </select>
          <select value="2026" disabled><option value="2026">Tahun</option></select>
        </div>
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
                <p>{statsSubtitle}</p>
              </div>
            </div>
            <div className="stats-grid">
              {STAT_DEFS.map(sd => (
                <div
                  key={sd.id}
                  className={`stat-box${sd.wide ? ' stat-wide' : ''}`}
                  style={{ borderLeft: '3px solid ' + sd.color }}
                >
                  <div className="stat-val" style={{ color: sd.color }}>
                    {sd.pct
                      ? (statValues[sd.id] ?? 0).toFixed(2) + '%'
                      : (statValues[sd.id] ?? 0).toFixed(2)
                    }
                  </div>
                  <div className="stat-label">{sd.kw}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card glow-amber" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="card-head" style={{ flexShrink: 0 }}>
              <div className="card-icon" style={{ background: 'rgba(255,140,66,.1)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#ff8c42" strokeWidth="2" strokeLinecap="round"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" /></svg>
              </div>
              <div>
                <h2>10 Jobsite dengan ASR tertinggi</h2>
                <p>Keparahan Absensi Rate</p>
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
              <p>
                {monthFilter === 'all'
                  ? 'Harap Pilih Periode Bulan Untuk Menampilkan List Karyawan Sakit'
                  : selectedSite + ' - ' + String(monthFilter) + ' 2026'
                }
              </p>
            </div>
          </div>
          <div className="sick-list" id="sickListWrap">
            {monthFilter === 'all' ? (
              <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--fg-dim)', fontSize: 10 }}>
                Harap Pilih Periode Bulan Untuk Menampilkan List Karyawan Sakit
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--fg-dim)', fontSize: 9 }}>
                Data karyawan sakit akan diambil dari sumber terpisah.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
