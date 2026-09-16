'use client';
import { useEffect, useRef, useState } from 'react';

const ChartPlaceholder = ({ id }: { id: string }) => (
  <div className="chart-box"><canvas id={id} /></div>
);

export default function KunjunganBerobat() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rujukVisible, setRujukVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop > 10) {
        setRujukVisible(true);
      } else {
        setRujukVisible(false);
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="dashboard" ref={containerRef} style={{ overflowY: 'auto', overflowX: 'hidden' }}>
      {/* Top Bar */}
      <div className="kunjungan-top-bar" style={{ flexShrink: 0 }}>
        <div className="kunjungan-filter-bar">
          <div className="filter-tag">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
            Filter
          </div>
          <select defaultValue="all"><option value="all">Semua Bulan</option></select>
          <select defaultValue="all"><option value="all">Semua Week</option></select>
          <select defaultValue="all"><option value="all">Semua Departemen</option></select>
        </div>
        <div className="kunjungan-total-right">
          <span className="mcu-total-label">Total Kunjungan:</span>
          <span className="mcu-total-num">0</span>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span style={{ color: '#00B894', fontWeight: 700 }}>Pasien Unik: 0</span>
          <span style={{ marginLeft: 8, color: '#FF4444', fontWeight: 700 }}>Rujuk RS: 0</span>
        </div>
      </div>

      {/* Scroll Content — flex-shrink: 0, jadi lebih tinggi dari container → bisa scroll */}
      <div className="kunjungan-scroll-content">
        {/* Viewport fill wrapper — 2 rows of cards fill the screen */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: 'calc(100vh - 120px)', flexShrink: 0 }}>
          {/* Row 1 — 2 cards */}
          <div className="kunjungan-trend-row">
            <div className="card glow-orange">
              <div className="card-head">
                <div className="card-icon" style={{ background: 'rgba(255,77,0,.1)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#ff4d00" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                </div>
                <div><h2>Tren Kunjungan per Bulan</h2><p>Jumlah kunjungan klinik per bulan</p></div>
              </div>
              <ChartPlaceholder id="kunjunganTrendChart" />
            </div>
            <div className="card glow-amber">
              <div className="card-head">
                <div className="card-icon" style={{ background: 'rgba(255,140,66,.1)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#ff8c42" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
                </div>
                <div><h2>Pasien Kunjungan Berulang</h2><p>Karyawan yang berkunjungan lebih dari sekali</p></div>
              </div>
              <ChartPlaceholder id="kunjunganUlangChart" />
            </div>
          </div>
          {/* Row 2 — 3 cards */}
          <div className="kunjungan-row-charts">
            <div className="card glow-coral">
              <div className="card-head">
                <div className="card-icon" style={{ background: 'rgba(255,99,71,.1)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#ff6347" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
                </div>
                <div><h2>Top 10 Diagnosa</h2><p>Diagnosa terbanyak dari kunjungan</p></div>
              </div>
              <ChartPlaceholder id="kunjunganDiagnosaChart" />
            </div>
            <div className="card glow-teal">
              <div className="card-head">
                <div className="card-icon" style={{ background: 'rgba(0,184,148,.1)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#00B894" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                </div>
                <div><h2>Top 10 Jenis Obat Keluar</h2><p>Agregasi jumlah obat per jenis terapi</p></div>
              </div>
              <ChartPlaceholder id="kunjunganObatChart" />
            </div>
            <div className="card glow-steel">
              <div className="card-head">
                <div className="card-icon" style={{ background: 'rgba(119,136,153,.1)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#778899" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg>
                </div>
                <div><h2>Distribusi Department</h2><p>Kunjungan berdasarkan departemen</p></div>
              </div>
              <ChartPlaceholder id="kunjunganDeptChart" />
            </div>
          </div>
        </div>
        {/* Rujuk RS — hidden by default, show on scroll */}
        <div
          className={"kunjungan-rujuk-section" + (rujukVisible ? ' visible' : '')}
          style={{ marginTop: 0 }}
        >
          <div className="card glow-coral" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
            <div className="card-head" style={{ flexShrink: 0 }}>
              <div className="card-icon" style={{ background: 'rgba(255,68,68,.1)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#FF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
              </div>
              <div><h2>Detail Karyawan Rujuk RS</h2><p>Identitas karyawan yang memerlukan rujukan rumah sakit</p></div>
            </div>
            <div className="rujuk-table-wrap">
              <div className="rujuk-empty">Data akan muncul setelah koneksi Supabase</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
