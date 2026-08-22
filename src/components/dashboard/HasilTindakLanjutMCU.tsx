'use client';

const ChartPlaceholder = ({ id }: { id: string }) => (
  <div className="chart-box"><canvas id={id} /></div>
);

export default function HasilTindakLanjutMCU() {
  return (
    <div className="dashboard">
      {/* Total Bar — NO update button */}
      <div className="mcu-total-bar">
        <span className="mcu-total-label">Total Karyawan:</span>
        <span className="mcu-total-num">0</span>
        <span style={{ color: 'var(--border)' }}>|</span>
        <span style={{ marginLeft: 4, color: '#ff8c42', fontWeight: 700 }}>Perlu FU: 0</span>
        <span style={{ marginLeft: 8, color: '#00B894', fontWeight: 700 }}>Selesai FU: 0</span>
        <span style={{ marginLeft: 8, color: '#555', fontWeight: 700 }}>Belum Selesai Review: 0</span>
        <span style={{ marginLeft: 8, color: '#778899', fontWeight: 700 }}>Exempt: 0</span>
      </div>

      {/* Row 1 — 3 cards */}
      <div className="mcu-row1">
        <div className="card glow-orange">
          <div className="card-head">
            <div className="card-icon" style={{ background: 'rgba(255,77,0,.1)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#ff4d00" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
            </div>
            <div><h2>Top 10 Diseases</h2><p>Diagnosa terbanyak dari hasil MCU</p></div>
          </div>
          <ChartPlaceholder id="reviewDiseaseChart" />
        </div>

        <div className="card glow-amber">
          <div className="card-head">
            <div className="card-icon" style={{ background: 'rgba(255,140,66,.1)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#ff8c42" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
            </div>
            <div><h2>Status Follow Up</h2><p>Perlu FU vs Selesai FU</p></div>
          </div>
          <ChartPlaceholder id="reviewFuStatusChart" />
        </div>

        <div className="card glow-steel">
          <div className="card-head">
            <div className="card-icon" style={{ background: 'rgba(155,89,182,.1)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#9B59B6" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
            </div>
            <div><h2>Framingham Risk Score</h2><p>Distribusi kategori risiko kardiovaskular</p></div>
          </div>
          <ChartPlaceholder id="reviewFrsChart" />
        </div>
      </div>

      {/* Row 2 — 3 cards */}
      <div className="mcu-row2">
        <div className="card glow-coral">
          <div className="card-head">
            <div className="card-icon" style={{ background: 'rgba(255,99,71,.1)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#ff6347" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
            </div>
            <div><h2>Hasil MCU</h2><p>Distribusi hasil review MCU</p></div>
          </div>
          <ChartPlaceholder id="reviewResultChart" />
        </div>

        <div className="card glow-teal">
          <div className="card-head">
            <div className="card-icon" style={{ background: 'rgba(0,184,148,.1)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#00B894" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
            </div>
            <div><h2>10 Peringkat Konsultasi Dokter</h2><p>Dokter Yang Dituju Untuk Konsultasi Temuan MCU</p></div>
          </div>
          <ChartPlaceholder id="reviewFuTypeChart" />
        </div>

        <div className="card glow-steel">
          <div className="card-head">
            <div className="card-icon" style={{ background: 'rgba(119,136,153,.1)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#778899" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
            </div>
            <div><h2>Profil Zona Risiko</h2><p>Distribusi zona risiko kesehatan karyawan</p></div>
          </div>
          <ChartPlaceholder id="reviewRiskChart" />
        </div>
      </div>
    </div>
  );
}
