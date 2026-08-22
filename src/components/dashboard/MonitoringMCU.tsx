'use client';

const ChartPlaceholder = ({ id }: { id: string }) => (
  <div className="chart-box"><canvas id={id} /></div>
);

export default function MonitoringMCU() {
  return (
    <div className="dashboard">
      {/* Total Bar — NO update button */}
      <div className="mcu-total-bar">
        <span className="mcu-total-label">Total Karyawan:</span>
        <span className="mcu-total-num">0</span>
        <span style={{ color: 'var(--border)' }}>|</span>
        <span style={{ marginLeft: 4, color: '#00B894', fontWeight: 700 }}>Valid: 0</span>
        <span style={{ marginLeft: 8, color: '#FF4444', fontWeight: 700 }}>Expired: 0</span>
        <span style={{ marginLeft: 8, color: '#555', fontWeight: 700 }}>No Data: 0</span>
        <span style={{ marginLeft: 8, color: '#778899', fontWeight: 700 }}>Exempt: 0</span>
      </div>

      {/* Row 1 — 3 cards (mcu-grid-3) */}
      <div className="mcu-grid-3">
        <div className="card glow-orange">
          <div className="card-head">
            <div className="card-icon" style={{ background: 'rgba(255,77,0,.1)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#ff4d00" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
            </div>
            <div><h2>Status MCU</h2><p>Valid, Expired, Belum Ada MCU</p></div>
          </div>
          <ChartPlaceholder id="mcuStatusChart" />
        </div>

        <div className="card glow-coral">
          <div className="card-head">
            <div className="card-icon" style={{ background: 'rgba(255,99,71,.1)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#ff6347" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
            </div>
            <div><h2>Capaian Pelaksanaan MCU</h2><p>Rencana vs Realisasi MCU</p></div>
          </div>
          <ChartPlaceholder id="mcuCoverageChart" />
        </div>

        <div className="card glow-amber">
          <div className="card-head">
            <div className="card-icon" style={{ background: 'rgba(255,140,66,.1)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#ff8c42" strokeWidth="2" strokeLinecap="round"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" /></svg>
            </div>
            <div><h2>Tren Expired</h2><p>By Month</p></div>
          </div>
          <ChartPlaceholder id="mcuTrendChart" />
        </div>
      </div>

      {/* Row 2 — 3 cards (mcu-grid-3) */}
      <div className="mcu-grid-3">
        <div className="card glow-teal">
          <div className="card-head">
            <div className="card-icon" style={{ background: 'rgba(0,184,148,.1)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#00B894" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
            </div>
            <div><h2>10 Jobsite Data MCU Tidak Ditemukan Terbanyak</h2><p>Karyawan tanpa data MCU</p></div>
          </div>
          <ChartPlaceholder id="mcuNoDataChart" />
        </div>

        <div className="card glow-steel">
          <div className="card-head">
            <div className="card-icon" style={{ background: 'rgba(119,136,153,.1)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#778899" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="5" /><path d="M3 21v-2a7 7 0 0114 0v2" /><path d="M16 3.13a4 4 0 010 7.75" /><path d="M21 21v-2a4 4 0 00-3-3.87" /></svg>
            </div>
            <div><h2>Peringkat Jobsite MCU Tepat Waktu</h2><p>% Tepat Waktu per Total Manpower</p></div>
          </div>
          <ChartPlaceholder id="mcuTepatWaktuChart" />
        </div>

        <div className="card glow-orange">
          <div className="card-head">
            <div className="card-icon" style={{ background: 'rgba(255,77,0,.1)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#ff4d00" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
            </div>
            <div><h2>Jobsite Expired Terbanyak</h2><p>Karyawan MCU expired per jobsite</p></div>
          </div>
          <ChartPlaceholder id="mcuJobsiteChart" />
        </div>
      </div>
    </div>
  );
}
