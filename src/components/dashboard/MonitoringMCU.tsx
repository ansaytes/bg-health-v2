'use client';

import { useMemo, useState } from 'react';
import { MONTHS } from '@/lib/lagging-data';
import {
  MCUChart,
  MCUChartCard,
  MCUDashboardFilters,
  MCURefreshButton,
  useMCUDashboardData,
} from '@/components/dashboard/MCUDashboardShared';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const PALETTE = ['#00B894', '#FF4444', '#616161', '#778899'];
const CHART_COLORS = ['#00B894', '#F39C12', '#FF6B6B'];

function monthIndex(value: string | null) {
  if (!value) return -1;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? -1 : parsed.getMonth();
}

export default function MonitoringMCU() {
  const { rows, loading, error, refresh } = useMCUDashboardData();
  const [site, setSite] = useState('All Site');
  const [area, setArea] = useState('');
  const [clients, setClients] = useState<string[]>([]);
  const [coverageMonth, setCoverageMonth] = useState('all');

  const filtered = useMemo(() => rows.filter(row =>
    (site === 'All Site' || row.site === site)
    && (!area || row.area === area)
    && (!clients.length || (row.client && clients.includes(row.client))),
  ), [rows, site, area, clients]);

  const summary = useMemo(() => ({
    total: filtered.length,
    valid: filtered.filter(row => row.status_mcu === 'Valid').length,
    expired: filtered.filter(row => row.status_mcu === 'Expired').length,
    noData: filtered.filter(row => row.status_mcu === 'No Data').length,
    exempt: filtered.filter(row => row.status_mcu === 'Exempt').length,
  }), [filtered]);

  const statusChart = useMemo(() => [summary.valid, summary.expired, summary.noData], [summary]);

  const coverage = useMemo(() => {
    let onTime = 0;
    let late = 0;
    let pending = 0;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const targetMonth = coverageMonth === 'all' ? -1 : MONTHS.indexOf(coverageMonth as typeof MONTHS[number]);

    filtered.filter(row => !row.exempt).forEach(row => {
      if (targetMonth >= 0 && monthIndex(row.jadwal_mcu_selanjutnya) !== targetMonth) return;
      if (!row.jadwal_mcu_selanjutnya) {
        if (targetMonth < 0) pending++;
        return;
      }
      const scheduleDate = new Date(`${row.jadwal_mcu_selanjutnya.slice(0, 10)}T00:00:00`);
      if (Number.isNaN(scheduleDate.getTime()) || scheduleDate > now || !row.mcu_terakhir) {
        pending++;
        return;
      }
      const actualDate = new Date(`${row.mcu_terakhir.slice(0, 10)}T00:00:00`);
      if (Number.isNaN(actualDate.getTime())) {
        pending++;
      } else if (actualDate.getTime() <= scheduleDate.getTime()) {
        // Mengikuti GAS: realisasi MCU <= jadwal MCU berarti Tepat Waktu / Lebih Cepat
        onTime++;
      } else {
        // Realisasi MCU > jadwal MCU berarti Terlambat
        late++;
      }
    });

    return { onTime, late, pending, total: onTime + late + pending };
  }, [filtered, coverageMonth]);

  const expiredTrend = useMemo(() => {
    const values = Array(12).fill(0) as number[];
    filtered.filter(row => row.status_mcu === 'Expired').forEach(row => {
      const index = monthIndex(row.masa_berlaku_mcu);
      if (index >= 0) values[index]++;
    });
    return values;
  }, [filtered]);

  const noDataBySite = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.filter(row => row.status_mcu === 'No Data' && row.site).forEach(row => {
      counts.set(row.site!, (counts.get(row.site!) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [filtered]);

  const siteTimeliness = useMemo(() => {
    const groups = new Map<string, { total: number; onTime: number }>();
    filtered.filter(row => row.site).forEach(row => {
      const group = groups.get(row.site!) || { total: 0, onTime: 0 };
      group.total++;
      if (!row.exempt && row.jadwal_mcu_selanjutnya && row.mcu_terakhir) {
        const scheduled = new Date(`${row.jadwal_mcu_selanjutnya.slice(0, 10)}T00:00:00`).getTime();
        const actual = new Date(`${row.mcu_terakhir.slice(0, 10)}T00:00:00`).getTime();
        if (Number.isFinite(scheduled) && Number.isFinite(actual) && actual <= scheduled) group.onTime++;
      }
      groups.set(row.site!, group);
    });
    return [...groups.entries()]
      .map(([name, group]) => ({ name, percent: group.total ? group.onTime / group.total * 100 : 0 }))
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 10);
  }, [filtered]);

  const expiredBySite = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.filter(row => row.status_mcu === 'Expired' && row.site).forEach(row => {
      counts.set(row.site!, (counts.get(row.site!) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [filtered]);

  return (
    <div className="dashboard mcu-live-dashboard">
      <div className="dashboard-top-bar mcu-live-top-bar">
        <MCUDashboardFilters
          rows={rows}
          site={site}
          area={area}
          clients={clients}
          onSiteChange={value => { setSite(value); setArea(''); }}
          onAreaChange={setArea}
          onClientsChange={value => { setClients(value); setArea(''); setSite('All Site'); }}
        />
        <div className="mcu-total-bar">
          <span className="mcu-total-label">Total:</span>
          <span className="mcu-total-num">{summary.total}</span>
          <span className="mcu-total-valid">Valid: {summary.valid}</span>
          <span className="mcu-total-expired">Expired: {summary.expired}</span>
          <span className="mcu-total-nodata">No Data: {summary.noData}</span>
          <span className="mcu-total-exempt">Exempt: {summary.exempt}</span>
          <MCURefreshButton loading={loading} onClick={refresh} />
        </div>
      </div>

      {loading ? (
        <div className="bm-loading is-card" role="status" aria-live="polite" aria-label="Memuat data monitoring MCU">
          <div className="bm-loading-spinner">
            <div className="bm-loading-ring" aria-hidden="true" />
            <img src="/BM.png" alt="" className="bm-loading-logo" aria-hidden="true" />
          </div>
        </div>
      )
        : error ? <div className="mcu-dashboard-message is-error">{error}</div>
          : <>
            <div className="mcu-grid-3 mcu-live-chart-row">
              <MCUChartCard title="Status MCU">
                <MCUChart type="doughnut" labels={['Valid', 'Expired', 'No Data']} values={statusChart} colors={PALETTE.slice(0, 3)} centerText={`${summary.total}`} percentLabels />
              </MCUChartCard>
              <MCUChartCard title="Capaian Pelaksanaan MCU" className="glow-coral">
                <label className="mcu-coverage-filter">Bulan
                  <select value={coverageMonth} onChange={event => setCoverageMonth(event.target.value)}>
                    <option value="all">Semua Bulan</option>
                    {MONTHS.map(month => <option key={month} value={month}>{month}</option>)}
                  </select>
                </label>
                <MCUChart type="doughnut" labels={['Tepat Waktu', 'Terlambat', 'Belum Terlaksana']} values={[coverage.onTime, coverage.late, coverage.pending]} colors={CHART_COLORS} centerText={`${coverage.total}`} percentLabels />
              </MCUChartCard>
              <MCUChartCard title="Tren Expired" className="glow-amber">
                <MCUChart type="bar" labels={MONTH_LABELS} values={expiredTrend} colors={Array(12).fill('#E74C3C')} legendLabel="MCU kedaluwarsa" />
              </MCUChartCard>
            </div>

            <div className="mcu-grid-3 mcu-live-chart-row">
              <MCUChartCard title="10 Jobsite MCU Tidak Ditemukan Terbanyak" className="glow-teal">
                <MCUChart type="bar" horizontal labels={noDataBySite.map(([name]) => name)} values={noDataBySite.map(([, value]) => value)} colors={Array(10).fill('#616161')} legendLabel="Karyawan tanpa data MCU" />
              </MCUChartCard>
              <MCUChartCard title="Peringkat Jobsite MCU Tepat Waktu" className="glow-steel">
                <MCUChart type="bar" horizontal labels={siteTimeliness.map(row => row.name)} values={siteTimeliness.map(row => Number(row.percent.toFixed(2)))} colors={siteTimeliness.map(row => row.percent >= 80 ? '#00B894' : row.percent >= 50 ? '#F39C12' : '#FF4444')} legendLabel="MCU tepat waktu (%)" percentLabels />
              </MCUChartCard>
              <MCUChartCard title="Jobsite Expired Terbanyak">
                <MCUChart type="bar" horizontal labels={expiredBySite.map(([name]) => name)} values={expiredBySite.map(([, value]) => value)} colors={Array(10).fill('#E67E22')} legendLabel="Karyawan dengan MCU kedaluwarsa" />
              </MCUChartCard>
            </div>
          </>}
    </div>
  );
}
