'use client';

import { useEffect, useState } from 'react';

interface KPIData {
  rkk: number;
  cmr: number;
  mfr: number;
  ssr: number;
  asr: number;
  fr_pak: number;
  kaptk: number;
  total_man_power: number;
  total_man_hours: number;
  total_karyawan_sakit: number;
  total_hari_absensi: number;
}

const ChartPlaceholder = ({ id }: { id: string }) => (
   <div className="chart-box"><canvas id={id} /></div>
);

export default function DashboardView() {
  const [kpi, setKpi] = useState<KPIData | null>(null);
  const [sickList, setSickList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch KPI summary
        const kpiRes = await fetch('/api/kpi?bulan=1&tahun=2026');
        const kpiJson = await kpiRes.json();
        if (kpiJson.success && kpiJson.data) {
          const d = Array.isArray(kpiJson.data) ? kpiJson.data[0] : kpiJson.data;
          setKpi({
            rkk: d.rkk || 0, cmr: d.cmr || 0, mfr: d.mfr || 0,
            ssr: d.ssr || 0, asr: d.asr || 0, fr_pak: d.fr_pak || 0,
            kaptk: d.kaptk || 0, total_man_power: d.total_man_power || 0,
            total_man_hours: d.total_man_hours || 0,
            total_karyawan_sakit: d.total_karyawan_sakit || 0,
            total_hari_absensi: d.total_hari_absensi || 0,
          });
        }

        // Fetch sick list
        const sickRes = await fetch('/api/absensi?bulan=1&tahun=2026');
        const sickJson = await sickRes.json();
        if (sickJson.success) {
          setSickList(sickJson.data || []);
        }
      } catch {
        // Supabase not connected yet — show zeros
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const rkk = kpi?.rkk || 0;
  const cmr = kpi?.cmr || 0;
  const mfr = kpi?.mfr || 0;
  const ssr = kpi?.ssr || 0;
  const asr = kpi?.asr || 0;
  const frPak = kpi?.fr_pak || 0;
  const kaptk = kpi?.kaptk || 0;

  return (
    <div className="dashboard">
      {/* Filter Bar */}
      <div className="header-filter">
        <div className="filter-tag">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
          Filtering
        </div>
        <select defaultValue="All Site"><option>All Site</option></select>
        <select defaultValue="all"><option value="all">Bulan</option></select>
        <select defaultValue="2026" disabled><option value="2026">Tahun</option></select>
      </div>

      {/* 62/38 Grid */}
      <div className="health-main-grid">
        {/* Left Column */}
        <div className="health-left-col">
          {/* Statistik Kesehatan */}
          <div className="card glow-orange" style={{ flex: 1.3, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="card-head" style={{ flexShrink: 0 }}>
              <div className="card-icon" style={{ background: 'rgba(255,77,0,.1)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#ff4d00" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              </div>
              <div>
                <h2>Statistik Kesehatan</h2>
                <p>Seluruh jobsite</p>
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
                <div className="stat-val" style={{ color: '#FF4444' }}>{kaptk.toFixed(2)}</div>
                <div className="stat-label">KAPTK</div>
              </div>
            </div>
          </div>

          {/* ASR Ranking */}
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
            <div className="chart-box" style={{ flex: 1, minHeight: 0 }}><canvas id="asrChart" /></div>
          </div>
        </div>

        {/* Right Column: Sick List */}
        <div className="card glow-coral" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
          <div className="card-head" style={{ flexShrink: 0 }}>
            <div className="card-icon" style={{ background: 'rgba(255,99,71,.1)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#ff6347" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
            </div>
            <div>
              <h2>List Karyawan Sakit</h2>
              <p>{loading ? 'Memuat data...' : `${sickList.length} karyawan`}</p>
            </div>
          </div>
          <div className="sick-list">
            {sickList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 16, color: 'var(--fg-dim)', fontSize: 9 }}>
                {loading ? 'Memuat data...' : 'Belum ada data. Input melalui Administrator.'}
              </div>
            ) : (
              sickList.slice(0, 20).map((row, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '5px 10px', borderBottom: '1px solid var(--border)', fontSize: 10,
                }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                    <span style={{ color: 'var(--fg-dim)', width: 16, flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.nama}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexShrink: 0, color: 'var(--muted-foreground)' }}>
                    <span>{row.jobsite}</span>
                    <span style={{ color: '#ff4d00', fontWeight: 600 }}>{row.total_hari}h</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
