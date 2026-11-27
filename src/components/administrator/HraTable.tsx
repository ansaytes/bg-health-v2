'use client';

// Administrator > Higiene Industri > Health Risk Assessment (HRA)
// Tabel Evaluasi Risiko Kesehatan Kerja Modern (Expandable Rows)
// Acuan: Dokumen BG/QSHE/FORM/069 Rev.001

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Edit2,
  Trash2,
  Plus,
  BookOpen,
  Activity,
  Layers,
  ArrowRight,
  ExternalLink,
  ClipboardList,
  Printer,
} from 'lucide-react';
import { authFetch } from '@/lib/api-client';
import {
  DEPARTEMEN_LIST,
  DepartemenItem,
  normalizeDepartment,
  HAZARD_TYPE_LIST,
  HraHazardEntry,
  LevelRisiko,
  getKategoriRisiko,
  getRiskColor,
  getRiskBg,
  getRiskBorder,
  PROBABILITY_LABELS,
  EFFECT_LABELS,
} from '@/lib/hra';
import { usePopup, Popup } from '@/lib/popup';
import HraPicaModal from './HraPicaModal';
import HraPrintModal from './HraPrintModal';

interface HraTableProps {
  onEdit?: (entry: HraHazardEntry) => void;
  onAddNew?: () => void;
}

export default function HraTable({ onEdit, onAddNew }: HraTableProps) {
  const [data, setData] = useState<HraHazardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [picaEntry, setPicaEntry] = useState<HraHazardEntry | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [hazardFilter, setHazardFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState<'ALL' | LevelRisiko>('ALL');
  const [deptOptions, setDeptOptions] = useState<DepartemenItem[]>(DEPARTEMEN_LIST);

  const { popup, popupState, closePopup } = usePopup();

  // Sinkronisasi daftar departemen dari tabel employees via /api/departments
  useEffect(() => {
    authFetch<{ success: boolean; departments: string[] }>('/api/departments')
      .then((res) => {
        if (res && res.departments && res.departments.length > 0) {
          const existingKeys = new Set(DEPARTEMEN_LIST.map((d) => d.key.toUpperCase()));
          const additions: DepartemenItem[] = res.departments
            .filter((d) => !existingKeys.has(d.trim().toUpperCase()))
            .map((d) => ({ key: d.trim().toUpperCase(), label: d.trim(), desc: 'Tabel Employees' }));
          setDeptOptions([...DEPARTEMEN_LIST, ...additions]);
        }
      })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const q = new URLSearchParams();
      if (deptFilter !== 'ALL') q.set('dept', deptFilter);
      if (hazardFilter !== 'ALL') q.set('hazard', hazardFilter);
      if (riskFilter !== 'ALL') q.set('risk', riskFilter);
      if (search.trim()) q.set('search', search.trim());

      const res = await authFetch(`/api/hra?${q.toString()}`);
      if (res && res.data) {
        setData(res.data);
      } else {
        setData([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data HRA');
    } finally {
      setLoading(false);
    }
  }, [deptFilter, hazardFilter, riskFilter, search]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleDelete = (entry: HraHazardEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    popup({
      type: 'confirm',
      title: 'Hapus Entri HRA?',
      message: `Hapus identifikasi risiko untuk "${entry.jenis_pekerjaan} - ${entry.jenis_hazard}"?`,
      confirmLabel: 'Hapus',
      onOk: async () => {
        try {
          await authFetch(`/api/hra?id=${encodeURIComponent(entry.id)}`, { method: 'DELETE' });
          setData((prev) => prev.filter((item) => item.id !== entry.id));
          popup({ type: 'success', title: 'Berhasil', message: 'Entri HRA telah dihapus.' });
        } catch (err) {
          popup({
            type: 'error',
            title: 'Gagal Menghapus',
            message: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.',
          });
        }
      },
    });
  };

  // Ringkasan metrik statistik
  const summary = useMemo(() => {
    let tinggi = 0;
    let sedang = 0;
    let rendah = 0;
    data.forEach((item) => {
      const kat = getKategoriRisiko(item.init_r);
      if (kat === 'High Risk') tinggi++;
      else if (kat === 'Medium Risk') sedang++;
      else rendah++;
    });
    return { total: data.length, tinggi, sedang, rendah };
  }, [data]);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--background)' }}>
      {/* ── macOS Control Bar & Toolbar ────────────────────────── */}
      <div
        style={{
          padding: '12px 18px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--card)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          flexShrink: 0,
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        }}
      >
        {/* Top Header: Title + Primary Action */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: 'var(--foreground)' }}>
              Health Risk Assesment
            </h1>
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '2px 0 0', lineHeight: 1.3 }}>
              Evaluasi identifikasi bahaya kerja, paparan per minggu, efek kesehatan &amp; hierarki kontrol
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onAddNew && (
              <button
                type="button"
                onClick={onAddNew}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 11.5,
                  fontWeight: 600,
                  background: 'linear-gradient(180deg, #FF6F1A 0%, #FF4D00 100%)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 2px 6px rgba(255,77,0,0.3)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Plus size={13} strokeWidth={2.5} /> Tambah Entri HRA
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              title="Cetak atau Ekspor Dokumen Resmi FORM/069 Rev.001"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 13px',
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
              <Printer size={13} style={{ color: '#FF5E00' }} />
              Cetak FORM/069
            </button>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              title="Muat ulang data"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 11.5,
                fontWeight: 500,
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

        {/* macOS Segmented KPI Filter Bar */}
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
            <span
              style={{
                padding: '3px 10px',
                borderRadius: 6,
                fontSize: 10.5,
                fontWeight: 600,
                color: 'var(--foreground)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span style={{ color: 'var(--muted-foreground)' }}>Total:</span>
              <b style={{ fontWeight: 800 }}>{summary.total}</b>
            </span>

            <button
              type="button"
              onClick={() => setRiskFilter(riskFilter === 'High Risk' ? 'ALL' : 'High Risk')}
              style={{
                border: 'none',
                cursor: 'pointer',
                padding: '3px 10px',
                borderRadius: 6,
                fontSize: 10.5,
                fontWeight: 700,
                background: riskFilter === 'High Risk' ? '#FF3B30' : 'rgba(255, 59, 48, 0.12)',
                color: riskFilter === 'High Risk' ? '#fff' : '#FF3B30',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: riskFilter === 'High Risk' ? '0 1px 3px rgba(255, 59, 48, 0.35)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <AlertTriangle size={11} />
              <span>High Risk:</span>
              <b>{summary.tinggi}</b>
            </button>

            <button
              type="button"
              onClick={() => setRiskFilter(riskFilter === 'Medium Risk' ? 'ALL' : 'Medium Risk')}
              style={{
                border: 'none',
                cursor: 'pointer',
                padding: '3px 10px',
                borderRadius: 6,
                fontSize: 10.5,
                fontWeight: 700,
                background: riskFilter === 'Medium Risk' ? '#FF9500' : 'rgba(255, 149, 0, 0.12)',
                color: riskFilter === 'Medium Risk' ? '#fff' : '#FF9500',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: riskFilter === 'Medium Risk' ? '0 1px 3px rgba(255, 149, 0, 0.35)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <ShieldAlert size={11} />
              <span>Medium:</span>
              <b>{summary.sedang}</b>
            </button>

            <button
              type="button"
              onClick={() => setRiskFilter(riskFilter === 'Low Risk' ? 'ALL' : 'Low Risk')}
              style={{
                border: 'none',
                cursor: 'pointer',
                padding: '3px 10px',
                borderRadius: 6,
                fontSize: 10.5,
                fontWeight: 700,
                background: riskFilter === 'Low Risk' ? '#34C759' : 'rgba(52, 199, 89, 0.12)',
                color: riskFilter === 'Low Risk' ? '#fff' : '#34C759',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: riskFilter === 'Low Risk' ? '0 1px 3px rgba(52, 199, 89, 0.35)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <ShieldCheck size={11} />
              <span>Low:</span>
              <b>{summary.rendah}</b>
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari aktivitas, kelompok, bahaya, atau efek..."
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 11.5,
                color: 'var(--foreground)',
                width: '100%',
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 11, color: 'var(--muted-foreground)', padding: 0 }}
              >
                ✕
              </button>
            )}
          </div>

          {/* macOS Pop-Up: Departemen */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
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
            <option value="ALL">Semua Departemen</option>
            {deptOptions.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label} {d.desc ? `(${d.desc})` : ''}
              </option>
            ))}
          </select>

          {/* macOS Pop-Up: Hazard */}
          <select
            value={hazardFilter}
            onChange={(e) => setHazardFilter(e.target.value)}
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
            <option value="ALL">Semua Hazard</option>
            {HAZARD_TYPE_LIST.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>

          {/* macOS Pop-Up: Level Risiko */}
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value as any)}
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
            <option value="ALL">Semua Level Risiko</option>
            <option value="High Risk">🔴 High Risk (R ≥ 15)</option>
            <option value="Medium Risk">🟡 Medium Risk (R 5 - 12)</option>
            <option value="Low Risk">🟢 Low Risk (R 1 - 4)</option>
          </select>
        </div>
      </div>

      {/* 2. Daftar Tabel Expandable */}
      <div className="admin-scroll-body" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px' }}>
        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(255,45,45,0.08)',
              color: '#b3261e',
              fontSize: 12,
              marginBottom: 10,
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px', opacity: 0.5 }} />
            Memuat daftar penilaian risiko kesehatan (HRA)...
          </div>
        ) : data.length === 0 ? (
          <div
            style={{
              padding: '48px 20px',
              textAlign: 'center',
              color: 'var(--muted-foreground)',
              background: 'var(--card)',
              borderRadius: 12,
              border: '1px dashed var(--border)',
            }}
          >
            <ShieldAlert size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px', color: 'var(--foreground)' }}>
              Tidak Ada Entri HRA Ditemukan
            </h3>
            <p style={{ fontSize: 11.5, margin: 0 }}>
              Coba sesuaikan kata kunci pencarian atau bersihkan filter di atas.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Table Header Columns (Rata Kiri Terstandarisasi) */}
            <div
              className="hra-table-header"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '0 14px',
                fontSize: 10.5,
                fontWeight: 700,
                color: 'var(--muted-foreground)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                userSelect: 'none',
              }}
            >
              <div style={{ width: 24, flexShrink: 0 }} />
              <div style={{ width: 140, flexShrink: 0 }}>Departemen</div>
              <div style={{ flex: 1, minWidth: 180 }}>Jenis Pekerjaan &amp; Bahaya</div>
              <div style={{ width: 110, flexShrink: 0 }}>Faktor Bahaya</div>
              <div style={{ width: 175, flexShrink: 0 }}>Tingkat Risiko</div>
              <div style={{ width: 64, flexShrink: 0, textAlign: 'right' }}>Aksi</div>
            </div>

            {data.map((item, idx) => {
              const isExpanded = expandedId === item.id;
              const katInit = getKategoriRisiko(item.init_r);
              const katRes = getKategoriRisiko(item.res_r);

              return (
                <div
                  key={item.id}
                  style={{
                    borderRadius: 12,
                    border: isExpanded ? '1px solid rgba(255, 94, 0, 0.45)' : '1px solid var(--border)',
                    background: 'var(--card)',
                    overflow: 'hidden',
                    transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: isExpanded
                      ? '0 6px 20px rgba(255, 94, 0, 0.08), 0 1px 3px rgba(0,0,0,0.04)'
                      : '0 1px 2px rgba(0,0,0,0.02)',
                  }}
                >
                  {/* Row Summary Bar (Clickable macOS List Item) */}
                  <div
                    className="hra-row-summary"
                    onClick={() => toggleExpand(item.id)}
                    style={{
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: 'pointer',
                      userSelect: 'none',
                      background: isExpanded ? 'rgba(255, 94, 0, 0.025)' : 'transparent',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {/* macOS Smooth Disclosure Circle */}
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isExpanded ? 'rgba(255, 94, 0, 0.12)' : 'var(--muted)',
                        color: isExpanded ? '#FF5E00' : 'var(--muted-foreground)',
                        flexShrink: 0,
                        transition: 'all 0.18s ease',
                      }}
                    >
                      <ChevronRight
                        size={13}
                        strokeWidth={2.5}
                        style={{
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                      />
                    </div>

                    {/* Departemen Badge Area (Rata Kiri Terstandarisasi) */}
                    <div className="hra-col-dept" style={{ width: 140, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          padding: '2.5px 8px',
                          borderRadius: 6,
                          background: 'rgba(255, 94, 0, 0.08)',
                          color: '#FF5E00',
                          border: '1px solid rgba(255, 94, 0, 0.22)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                          textAlign: 'left',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '100%',
                        }}
                        title={item.departemen}
                      >
                        {item.departemen}
                      </span>
                    </div>

                    {/* Main Title: Jenis Pekerjaan & Kelompok (Rata Kiri) */}
                    <div className="hra-col-title" style={{ flex: 1, minWidth: 180, textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>
                          {item.jenis_pekerjaan}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                          • {item.kelompok_beresiko}
                        </span>
                      </div>
                      <div
                        className="hra-col-title-source"
                        style={{
                          fontSize: 10.5,
                          color: 'var(--muted-foreground)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginTop: 2,
                        }}
                      >
                        <b>Sumber:</b> {item.sumber_hazard}
                      </div>
                    </div>

                    {/* Hazard Category Tag (Rata Kiri Terstandarisasi) */}
                    <div className="hra-col-hazard" style={{ width: 110, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2.5px 8px',
                          borderRadius: 6,
                          background: 'var(--muted)',
                          color: 'var(--muted-foreground)',
                          border: '1px solid var(--border)',
                          textAlign: 'left',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '100%',
                        }}
                        title={item.jenis_hazard}
                      >
                        {item.jenis_hazard}
                      </span>
                    </div>

                    {/* Risk Badge (Initial -> Residual: P x E = R) (Rata Kiri Terstandarisasi) */}
                    <div className="hra-col-risk" style={{ width: 175, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div
                        title={`Initial Risk: P=${item.init_p} × E=${item.init_e} = R=${item.init_r} (${katInit})`}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: 10,
                          fontWeight: 700,
                          background: getRiskBg(item.init_r),
                          color: getRiskColor(item.init_r),
                          border: `1px solid ${getRiskBorder(item.init_r)}`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span>Awal: R={item.init_r}</span>
                      </div>

                      <ArrowRight size={11} style={{ color: 'var(--muted-foreground)', opacity: 0.6, flexShrink: 0 }} />

                      <div
                        title={`Residual Risk: P=${item.res_p} × E=${item.res_e} = R=${item.res_r} (${katRes})`}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: 10,
                          fontWeight: 700,
                          background: getRiskBg(item.res_r),
                          color: getRiskColor(item.res_r),
                          border: `1px solid ${getRiskBorder(item.res_r)}`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span>Sisa: R={item.res_r}</span>
                      </div>
                    </div>

                    {/* macOS Action Buttons */}
                    <div className="hra-col-actions" style={{ width: 64, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(item)}
                          title="Edit entri HRA"
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                            background: 'var(--background)',
                            color: 'var(--foreground)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Edit2 size={12} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleDelete(item, e)}
                        title="Hapus entri HRA"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          background: 'var(--background)',
                          color: '#FF3B30',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* ── macOS Inset Inspector View ──────────────────── */}
                  {isExpanded && (
                    <div
                      style={{
                        padding: '14px 16px',
                        borderTop: '1px solid var(--border)',
                        background: 'var(--background)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                      }}
                    >
                      {/* Grid 2 Kolom: Detail Bahaya & Efek */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 12 }}>
                        {/* Kolom 1: Sumber & Efek Kesehatan (macOS Inset Card) */}
                        <div
                          style={{
                            padding: '12px 14px',
                            borderRadius: 10,
                            background: 'var(--card)',
                            border: '1px solid var(--border)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                          }}
                        >
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-foreground)', letterSpacing: '0.04em', marginBottom: 6 }}>
                            Sumber Bahaya &amp; Efek Kesehatan
                          </div>
                          <div style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 8, color: 'var(--foreground)' }}>
                            <span style={{ fontWeight: 600 }}>Sumber: </span>
                            {item.sumber_hazard}
                          </div>
                          <div style={{ fontSize: 12, lineHeight: 1.5, color: '#FF3B30' }}>
                            <span style={{ fontWeight: 700 }}>Efek Kesehatan Potensial: </span>
                            {item.efek_kesehatan}
                          </div>
                        </div>

                        {/* Kolom 2: Skoring Matriks Risiko (macOS Health Gauges) */}
                        <div
                          style={{
                            padding: '12px 14px',
                            borderRadius: 10,
                            background: 'var(--card)',
                            border: '1px solid var(--border)',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))',
                            gap: 10,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                          }}
                        >
                          {/* Initial Risk Card */}
                          <div
                            style={{
                              padding: '10px',
                              borderRadius: 8,
                              background: getRiskBg(item.init_r),
                              border: `1px solid ${getRiskBorder(item.init_r)}`,
                              textAlign: 'center',
                            }}
                          >
                            <div style={{ fontSize: 9.5, fontWeight: 700, color: getRiskColor(item.init_r), textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Initial Risk
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: getRiskColor(item.init_r), margin: '2px 0', letterSpacing: '-0.02em' }}>
                              R = {item.init_r}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--foreground)', lineHeight: 1.4 }}>
                              P: <b>{item.init_p}</b> • E: <b>{item.init_e}</b><br />
                              <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 4, fontSize: 9.5, fontWeight: 700, background: 'var(--background)', color: getRiskColor(item.init_r), border: `1px solid ${getRiskBorder(item.init_r)}` }}>
                                {katInit}
                              </span>
                            </div>
                          </div>

                          {/* Residual Risk Card */}
                          <div
                            style={{
                              padding: '10px',
                              borderRadius: 8,
                              background: getRiskBg(item.res_r),
                              border: `1px solid ${getRiskBorder(item.res_r)}`,
                              textAlign: 'center',
                            }}
                          >
                            <div style={{ fontSize: 9.5, fontWeight: 700, color: getRiskColor(item.res_r), textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Residual Risk
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: getRiskColor(item.res_r), margin: '2px 0', letterSpacing: '-0.02em' }}>
                              R = {item.res_r}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--foreground)', lineHeight: 1.4 }}>
                              P: <b>{item.res_p}</b> • E: <b>{item.res_e}</b><br />
                              <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 4, fontSize: 9.5, fontWeight: 700, background: 'var(--background)', color: getRiskColor(item.res_r), border: `1px solid ${getRiskBorder(item.res_r)}` }}>
                                {katRes}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Tindakan Pengendalian & Hierarki Kontrol */}
                      <div
                        style={{
                          padding: '12px 14px',
                          borderRadius: 10,
                          background: 'var(--card)',
                          border: '1px solid var(--border)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}>
                            Tindakan Pengendalian yang Ditetapkan
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {item.kontrol_tingkat && (
                              <span
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  background: 'rgba(0, 122, 255, 0.12)',
                                  color: '#007aff',
                                  border: '1px solid rgba(0, 122, 255, 0.25)',
                                }}
                              >
                                {item.kontrol_tingkat}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPicaEntry(item);
                              }}
                              title="Terbitkan tiket tindakan perbaikan (PICA) untuk pengendalian bahaya ini"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 9.5,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: 'rgba(255, 94, 0, 0.10)',
                                color: '#d9480f',
                                border: '1px solid rgba(255, 94, 0, 0.3)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <ClipboardList size={11} />
                              <span>Buat Tiket PICA</span>
                            </button>
                          </div>
                        </div>
                        <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--foreground)' }}>
                          {item.tindakan_pencegahan || 'Belum ada catatan pengendalian khusus.'}
                        </div>
                      </div>

                      {/* Referensi Regulasi */}
                      {item.regulasi && (
                        <div
                          style={{
                            padding: '10px 14px',
                            borderRadius: 10,
                            background: 'var(--card)',
                            border: '1px solid var(--border)',
                            fontSize: 11,
                            color: 'var(--muted-foreground)',
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 6,
                          }}
                        >
                          <BookOpen size={13} style={{ flexShrink: 0, color: '#FF5E00' }} />
                          <div style={{ lineHeight: 1.4 }}>
                            <b style={{ color: 'var(--foreground)' }}>Regulasi Acuan: </b>
                            {item.regulasi}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <HraPicaModal
        entry={picaEntry}
        isOpen={!!picaEntry}
        onClose={() => setPicaEntry(null)}
        onSuccess={(msg) => popup({ type: 'success', title: 'Berhasil', message: msg })}
      />
      <HraPrintModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        entries={data}
        currentDept={deptFilter}
      />
      <Popup state={popupState} closePopup={closePopup} />
    </div>
  );
}
