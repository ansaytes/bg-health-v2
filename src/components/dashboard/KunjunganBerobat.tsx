'use client';

const ChartPlaceholder = ({ id }: { id: string }) => (
  <div className="chart-box"><canvas id={id} /></div>
);

export default function KunjunganBerobat() {
  return (
    <div className="dashboard" style={{ overflowY: 'auto', height: '100%', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="kunjungan-top-bar" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <div className="kunjungan-filter-bar" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="filter-tag" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 11, height: 11 }}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
            Filter
          </div>
          <select defaultValue="all"><option value="all">Semua Bulan</option></select>
          <select defaultValue="all"><option value="all">Semua Week</option></select>
          <select defaultValue="all"><option value="all">Semua Departemen</option></select>
        </div>
        <div className="kunjungan-total-right" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
          <span className="mcu-total-label">Total Kunjungan:</span>
          <span className="mcu-total-num" style={{ fontSize: 14, fontWeight: 700, color: '#ff4d00' }}>0</span>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span style={{ color: '#00B894', fontWeight: 700 }}>Pasien Unik: 0</span>
          <span style={{ marginLeft: 8, color: '#FF4444', fontWeight: 700 }}>Rujuk RS: 0</span>
        </div>
      </div>

      {/* Row 1 — 2 charts, fill ~50% */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, height: 'calc(50vh - 30px)', minHeight: 180, flexShrink: 0 }}>
        <div className="card glow-orange" style={{ display: 'flex', flexDirection: 'column', padding: '8px 10px', overflow: 'hidden' }}>
          <div className="card-head" style={{ marginBottom: 3, flexShrink: 0 }}>
            <div className="card-icon" style={{ background: 'rgba(255,77,0,.1)', width: 20, height: 20, borderRadius: 5 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#ff4d00" strokeWidth="2" strokeLinecap="round" style={{ width: 10, height: 10 }}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
            </div>
            <div><h2>Tren Kunjungan per Bulan</h2><p>Jumlah kunjungan klinik per bulan</p></div>
          </div>
          <ChartPlaceholder id="kunjunganTrendChart" />
        </div>
        <div className="card glow-amber" style={{ display: 'flex', flexDirection: 'column', padding: '8px 10px', overflow: 'hidden' }}>
          <div className="card-head" style={{ marginBottom: 3, flexShrink: 0 }}>
            <div className="card-icon" style={{ background: 'rgba(255,140,66,.1)', width: 20, height: 20, borderRadius: 5 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#ff8c42" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
            </div>
            <div><h2>Pasien Kunjungan Berulang</h2><p>Karyawan yang berkunjungan lebih dari sekali</p></div>
          </div>
          <ChartPlaceholder id="kunjunganUlangChart" />
        </div>
      </div>

      {/* Row 2 — 3 charts, fill ~50% */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, height: 'calc(50vh - 30px)', minHeight: 180, flexShrink: 0 }}>
        <div className="card glow-coral" style={{ display: 'flex', flexDirection: 'column', padding: '8px 10px', overflow: 'hidden' }}>
          <div className="card-head" style={{ marginBottom: 3, flexShrink: 0 }}>
            <div className="card-icon" style={{ background: 'rgba(255,99,71,.1)', width: 20, height: 20, borderRadius: 5 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#ff6347" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
            </div>
            <div><h2>Top 10 Diagnosa</h2><p>Diagnosa terbanyak dari kunjungan</p></div>
          </div>
          <ChartPlaceholder id="kunjunganDiagnosaChart" />
        </div>
        <div className="card glow-teal" style={{ display: 'flex', flexDirection: 'column', padding: '8px 10px', overflow: 'hidden' }}>
          <div className="card-head" style={{ marginBottom: 3, flexShrink: 0 }}>
            <div className="card-icon" style={{ background: 'rgba(0,184,148,.1)', width: 20, height: 20, borderRadius: 5 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#00B894" strokeWidth="2" strokeLinecap="round" style={{ width: 10, height: 10 }}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
            </div>
            <div><h2>Top 10 Jenis Obat Keluar</h2><p>Agregasi jumlah obat per jenis terapi</p></div>
          </div>
          <ChartPlaceholder id="kunjunganObatChart" />
        </div>
        <div className="card glow-steel" style={{ display: 'flex', flexDirection: 'column', padding: '8px 10px', overflow: 'hidden' }}>
          <div className="card-head" style={{ marginBottom: 3, flexShrink: 0 }}>
            <div className="card-icon" style={{ background: 'rgba(119,136,153,.1)', width: 20, height: 20, borderRadius: 5 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#778899" strokeWidth="2" strokeLinecap="round" style={{ width: 10, height: 10 }}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg>
            </div>
            <div><h2>Distribusi Department</h2><p>Kunjungan berdasarkan departemen</p></div>
          </div>
          <ChartPlaceholder id="kunjunganDeptChart" />
        </div>
      </div>

      {/* Rujuk RS — di bawah, scroll untuk lihat */}
      <div style={{ flexShrink: 0, minHeight: 200 }}>
        <div className="card glow-coral" style={{ display: 'flex', flexDirection: 'column', minHeight: 200, padding: '8px 10px' }}>
          <div className="card-head" style={{ flexShrink: 0, marginBottom: 6 }}>
            <div className="card-icon" style={{ background: 'rgba(255,68,68,.1)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#FF4444" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            </div>
            <div><h2>Detail Karyawan Rujuk RS</h2><p>Identitas karyawan yang memerlukan rujukan rumah sakit</p></div>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--fg-dim)', fontSize: 9 }}>
              Data akan muncul setelah koneksi Supabase
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
