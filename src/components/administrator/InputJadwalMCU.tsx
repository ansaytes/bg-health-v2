'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Search,
  RefreshCw,
  Save,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Clock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useMCUStore } from '@/lib/store';

type Schedule = {
  id: string | null;
  nik_karyawan: string;
  nama: string;
  site: string;
  department?: string | null;
  jabatan?: string | null;
  tanggal_mcu_terakhir?: string | null;
  tanggal_jadwal: string;
  history?: string[];
  jenis_kelamin?: string | null;
  usia?: number | null;
  national_id?: string | null;
};

type SortKey = 'nik_karyawan' | 'nama' | 'site' | 'department' | 'jabatan' | 'tanggal_mcu_terakhir' | 'tanggal_jadwal';

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('id-ID');
}

export default function InputJadwalMCU() {
  const { session } = useAuth();
  const [rows, setRows] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [query, setQuery] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'filled' | 'empty'>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [siteOptions, setSiteOptions] = useState<string[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'nama', direction: 'asc' });

  const mcuFocusRequest = useMCUStore((s) => s.mcuFocusRequest);
  useEffect(() => {
    if (!mcuFocusRequest) return;
    const target = (mcuFocusRequest.nikKaryawan || mcuFocusRequest.nama || '').trim();
    if (target) {
      setQuery(target);
      setPage(1);
    }
  }, [mcuFocusRequest?.requestId]);

  const getAuthHeaders = async (): Promise<HeadersInit> => {
    const accessToken = session?.access_token || (await supabase.auth.getSession()).data.session?.access_token;
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (query.trim()) params.set('search', query.trim());
      if (siteFilter) params.set('site', siteFilter);
      if (departmentFilter.trim()) params.set('department', departmentFilter.trim());
      const response = await fetch(`/api/mcu/schedule?${params.toString()}`, { headers: await getAuthHeaders() });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Gagal memuat data karyawan');
      setRows(json.schedules || []);
      setTotal(json.total || 0);
      setTotalPages(json.totalPages || 0);
      setSiteOptions(json.sites || []);
      setDepartmentOptions(json.departments || []);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Gagal memuat data karyawan',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [page, query, siteFilter, departmentFilter]);

  const updateDate = (nik: string, value: string) => {
    setRows((current) => current.map((row) => (row.nik_karyawan === nik ? { ...row, tanggal_jadwal: value } : row)));
  };

  const save = async (row: Schedule) => {
    if (!row.tanggal_jadwal) {
      setMessage({ type: 'error', text: `Tanggal jadwal untuk ${row.nama} wajib diisi` });
      return;
    }
    setSaving(row.nik_karyawan);
    setMessage(null);
    try {
      const response = await fetch('/api/mcu/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({
          id: row.id,
          nikKaryawan: row.nik_karyawan,
          nationalId: row.national_id,
          nama: row.nama,
          jenisKelamin: row.jenis_kelamin,
          usia: row.usia,
          jabatan: row.jabatan,
          site: row.site,
          tanggalJadwal: row.tanggal_jadwal,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Gagal menyimpan jadwal');
      setMessage({ type: 'success', text: `Jadwal MCU ${row.nama} berhasil disimpan` });
      setTimeout(() => setMessage(null), 4000);
      await load();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Gagal menyimpan jadwal',
      });
    } finally {
      setSaving(null);
    }
  };

  const changeSort = (key: SortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const visibleRows = useMemo(() => {
    return rows
      .filter((row) =>
        scheduleFilter === 'all'
          ? true
          : scheduleFilter === 'filled'
          ? Boolean(row.tanggal_jadwal)
          : !row.tanggal_jadwal
      )
      .sort((a, b) => {
        const left = String(a[sort.key] || '');
        const right = String(b[sort.key] || '');
        return left.localeCompare(right, 'id', { numeric: true }) * (sort.direction === 'asc' ? 1 : -1);
      });
  }, [rows, scheduleFilter, sort]);

  // Statistik baris aktif
  const stats = useMemo(() => {
    let filled = 0;
    let empty = 0;
    rows.forEach((r) => {
      if (r.tanggal_jadwal) filled++;
      else empty++;
    });
    return { filled, empty };
  }, [rows]);

  const resetFilters = () => {
    setQuery('');
    setSiteFilter('');
    setDepartmentFilter('');
    setScheduleFilter('all');
    setPage(1);
  };

  const changePage = (nextPage: number) => {
    if (nextPage < 1 || (totalPages > 0 && nextPage > totalPages)) return;
    setPage(nextPage);
  };

  const hasActiveFilters = Boolean(query || siteFilter || departmentFilter || scheduleFilter !== 'all');

  const renderSortableHeader = (key: SortKey, label: string, width?: number | string) => (
    <th
      style={{
        textAlign: 'left',
        padding: '8px 12px',
        fontWeight: 600,
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: 'var(--muted-foreground)',
        width: width,
        userSelect: 'none',
      }}
    >
      <button
        type="button"
        onClick={() => changeSort(key)}
        style={{
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          font: 'inherit',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: 0,
        }}
      >
        <span>{label}</span>
        {sort.key === key &&
          (sort.direction === 'asc' ? (
            <ArrowUp size={11} style={{ color: '#FF5E00' }} />
          ) : (
            <ArrowDown size={11} style={{ color: '#FF5E00' }} />
          ))}
      </button>
    </th>
  );

  return (
    <div
      className="admin-scroll-body"
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--background)',
        padding: '14px 18px',
        gap: 12,
      }}
    >
      {/* ── macOS Control Bar & Toolbar (HRA Style Card) ─────────── */}
      <div
        style={{
          padding: '12px 16px',
          border: '1px solid var(--border)',
          borderRadius: 12,
          background: 'var(--card)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          flexShrink: 0,
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        {/* Top Header: Title + Primary Action */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: 'var(--foreground)' }}>
                  Input Jadwal MCU
                </h1>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'rgba(255, 94, 0, 0.09)',
                    color: '#FF5E00',
                    border: '1px solid rgba(255, 94, 0, 0.22)',
                  }}
                >
                  BERKALA
                </span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '2px 0 0', lineHeight: 1.3 }}>
                Atur jadwal Medical Check Up berkala untuk karyawan sesuai kewenangan jobsite.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              title="Muat ulang data"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 11.5,
                fontWeight: 600,
                background: 'var(--background)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                transition: 'all 0.15s ease',
              }}
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* macOS Segmented KPI Group */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              maxWidth: '100%',
              padding: 3,
              borderRadius: 8,
              background: 'var(--muted)',
              border: '1px solid var(--border)',
              gap: 3,
            }}
          >
            {/* Total */}
            <button
              type="button"
              onClick={() => setScheduleFilter('all')}
              style={{
                border: 'none',
                cursor: 'pointer',
                padding: '3px 12px',
                borderRadius: 6,
                fontSize: 10.5,
                fontWeight: 600,
                background: scheduleFilter === 'all' ? 'var(--card)' : 'transparent',
                color: scheduleFilter === 'all' ? '#FF5E00' : 'var(--foreground)',
                boxShadow: scheduleFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ color: scheduleFilter === 'all' ? '#FF5E00' : 'var(--muted-foreground)' }}>Total:</span>
              <b style={{ fontWeight: 800 }}>{total}</b>
            </button>

            {/* Sudah Dijadwalkan */}
            <button
              type="button"
              onClick={() => setScheduleFilter(scheduleFilter === 'filled' ? 'all' : 'filled')}
              style={{
                border: 'none',
                cursor: 'pointer',
                padding: '3px 12px',
                borderRadius: 6,
                fontSize: 10.5,
                fontWeight: 700,
                background: scheduleFilter === 'filled' ? '#34C759' : 'transparent',
                color: scheduleFilter === 'filled' ? '#fff' : '#34C759',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: scheduleFilter === 'filled' ? '0 1px 3px rgba(52, 199, 89, 0.35)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <CheckCircle2 size={11} />
              <span>Sudah Dijadwalkan</span>
              {stats.filled > 0 && <span style={{ opacity: 0.85 }}>({stats.filled})</span>}
            </button>

            {/* Belum Dijadwalkan */}
            <button
              type="button"
              onClick={() => setScheduleFilter(scheduleFilter === 'empty' ? 'all' : 'empty')}
              style={{
                border: 'none',
                cursor: 'pointer',
                padding: '3px 12px',
                borderRadius: 6,
                fontSize: 10.5,
                fontWeight: 700,
                background: scheduleFilter === 'empty' ? '#FF9500' : 'transparent',
                color: scheduleFilter === 'empty' ? '#fff' : '#FF9500',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: scheduleFilter === 'empty' ? '0 1px 3px rgba(255, 149, 0, 0.35)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Clock size={11} />
              <span>Belum Dijadwalkan</span>
              {stats.empty > 0 && <span style={{ opacity: 0.85 }}>({stats.empty})</span>}
            </button>
          </div>
        </div>

        {/* macOS Controls Filter Row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Spotlight Search */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0 12px',
              flex: 1,
              minWidth: 'min(100%, 200px)',
              height: 32,
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <Search size={13} style={{ color: 'var(--muted-foreground)' }} />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama, NIK, site, departemen, jabatan..."
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 11.5,
                color: 'var(--foreground)',
                width: '100%',
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setPage(1);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 11,
                  color: 'var(--muted-foreground)',
                  padding: 0,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* macOS Pop-Up: Site */}
          <select
            value={siteFilter}
            onChange={(e) => {
              setSiteFilter(e.target.value);
              setPage(1);
            }}
            style={{
              height: 32,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: 11.5,
              fontWeight: 500,
              padding: '0 10px',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <option value="">Semua Site</option>
            {siteOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* macOS Pop-Up: Departemen */}
          <select
            value={departmentFilter}
            onChange={(e) => {
              setDepartmentFilter(e.target.value);
              setPage(1);
            }}
            style={{
              height: 32,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: 11.5,
              fontWeight: 500,
              padding: '0 10px',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <option value="">Semua Departemen</option>
            {departmentOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              style={{
                height: 32,
                padding: '0 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--background)',
                color: '#FF5E00',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              Reset
            </button>
          )}

          {/* Counter info */}
          <span
            style={{
              fontSize: 10.5,
              padding: '4px 10px',
              borderRadius: 6,
              background: 'var(--muted)',
              color: 'var(--muted-foreground)',
              border: '1px solid var(--border)',
              whiteSpace: 'nowrap',
            }}
          >
            {visibleRows.length} dari {total} karyawan | Hal {page}/{totalPages || 1}
          </span>
        </div>
      </div>

      {/* ── Table Container (HRA Panel Style) ───────────────────── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Inline Message Alert */}
        {message && (
          <div
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              background: message.type === 'success' ? 'rgba(52, 199, 89, 0.12)' : 'rgba(255, 59, 48, 0.12)',
              color: message.type === 'success' ? '#248A3D' : '#FF3B30',
              border: `1px solid ${message.type === 'success' ? 'rgba(52, 199, 89, 0.25)' : 'rgba(255, 59, 48, 0.25)'}`,
              fontSize: 11.5,
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {message.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            <span style={{ fontWeight: 600 }}>{message.text}</span>
          </div>
        )}

        {/* macOS Table Card Panel */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            borderRadius: 12,
            background: 'var(--card)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          {/* Scrollable Table Area */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto' }}>
            {loading ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
                <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 8px', opacity: 0.5, color: '#FF5E00' }} />
                Memuat data karyawan & jadwal MCU...
              </div>
            ) : visibleRows.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
                <Calendar size={28} style={{ margin: '0 auto 10px', opacity: 0.35 }} />
                <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px', color: 'var(--foreground)' }}>
                  Tidak Ada Data Karyawan
                </h4>
                <p style={{ fontSize: 11, margin: 0 }}>
                  Coba sesuaikan kata kunci pencarian atau bersihkan filter di atas.
                </p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                <thead>
                  <tr
                    style={{
                      position: 'sticky',
                      top: 0,
                      background: 'var(--muted)',
                      zIndex: 2,
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <th
                      style={{
                        textAlign: 'center',
                        padding: '8px 12px',
                        fontWeight: 600,
                        width: 45,
                        fontSize: 10,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: 'var(--muted-foreground)',
                      }}
                    >
                      No
                    </th>
                    {renderSortableHeader('nik_karyawan', 'NIK Karyawan', 120)}
                    {renderSortableHeader('nama', 'Nama Lengkap')}
                    {renderSortableHeader('site', 'Site', 120)}
                    {renderSortableHeader('department', 'Departemen')}
                    {renderSortableHeader('jabatan', 'Jabatan')}
                    {renderSortableHeader('tanggal_mcu_terakhir', 'MCU Terakhir', 120)}
                    {renderSortableHeader('tanggal_jadwal', 'Jadwal MCU Berikutnya', 180)}
                    <th
                      style={{
                        textAlign: 'center',
                        padding: '8px 12px',
                        fontWeight: 600,
                        width: 95,
                        fontSize: 10,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: 'var(--muted-foreground)',
                      }}
                    >
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, index) => {
                    const isJobsite = row.site && !row.site.toLowerCase().includes('head office');
                    return (
                      <tr
                        key={row.nik_karyawan}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          transition: 'background 0.12s ease',
                        }}
                      >
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                          {(page - 1) * 20 + (index + 1)}
                        </td>
                        <td
                          style={{
                            padding: '8px 12px',
                            fontFamily: 'var(--font-mono, monospace)',
                            fontWeight: 600,
                            color: 'var(--foreground)',
                          }}
                        >
                          {row.nik_karyawan}
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--foreground)' }}>
                          {row.nama}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: isJobsite ? 'rgba(234, 88, 12, 0.12)' : 'rgba(0, 122, 255, 0.12)',
                              color: isJobsite ? '#ea580c' : '#007aff',
                              border: `1px solid ${isJobsite ? 'rgba(234, 88, 12, 0.25)' : 'rgba(0, 122, 255, 0.25)'}`,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {row.site || '-'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--muted-foreground)' }}>
                          {row.department || '-'}
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--foreground)' }}>
                          {row.jabatan || '-'}
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>
                          {formatDate(row.tanggal_mcu_terakhir)}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            type="date"
                            value={row.tanggal_jadwal || ''}
                            onChange={(e) => updateDate(row.nik_karyawan, e.target.value)}
                            style={{
                              height: 30,
                              borderRadius: 8,
                              border: '1px solid var(--border)',
                              background: 'var(--card)',
                              color: 'var(--foreground)',
                              fontSize: 11.5,
                              padding: '0 10px',
                              outline: 'none',
                              width: '100%',
                              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)',
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => void save(row)}
                            disabled={saving === row.nik_karyawan}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 5,
                              padding: '4px 12px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              background: 'linear-gradient(180deg, #FF6F1A 0%, #FF4D00 100%)',
                              color: '#fff',
                              border: 'none',
                              cursor: saving === row.nik_karyawan ? 'not-allowed' : 'pointer',
                              boxShadow: '0 2px 6px rgba(255, 77, 0, 0.28)',
                              opacity: saving === row.nik_karyawan ? 0.7 : 1,
                              transition: 'all 0.15s ease',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <Save size={12} />
                            {saving === row.nik_karyawan ? '...' : 'Simpan'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Table Footer / Pagination (macOS Style) ──────────── */}
          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 16px',
                borderTop: '1px solid var(--border)',
                background: 'var(--card)',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <button
                type="button"
                disabled={page === 1}
                onClick={() => changePage(page - 1)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 12px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  border: '1px solid var(--border)',
                  background: 'var(--background)',
                  color: page === 1 ? 'var(--muted-foreground)' : 'var(--foreground)',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  opacity: page === 1 ? 0.5 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                <ChevronLeft size={13} /> Sebelumnya
              </button>

              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)' }}>
                Halaman <b style={{ color: 'var(--foreground)' }}>{page}</b> dari <b>{totalPages}</b>
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => changePage(page + 1)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 12px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  border: '1px solid var(--border)',
                  background: 'var(--background)',
                  color: page >= totalPages ? 'var(--muted-foreground)' : 'var(--foreground)',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: page >= totalPages ? 0.5 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                Berikutnya <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
