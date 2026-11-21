'use client';

// ============================================================
// Administrator > Higiene Industri > Health Risk Assessment (HRA)
// Tabel Evaluasi Risiko Kesehatan Kerja Modern (Expandable Rows)
// Acuan: Dokumen BG/QSHE/FORM/069 Rev.001
// ============================================================

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

interface HraTableProps {
  onEdit?: (entry: HraHazardEntry) => void;
  onAddNew?: () => void;
}

export default function HraTable({ onEdit, onAddNew }: HraTableProps) {
  const [data, setData] = useState<HraHazardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      if (kat === 'Tinggi') tinggi++;
      else if (kat === 'Sedang') sedang++;
      else rendah++;
    });
    return { total: data.length, tinggi, sedang, rendah };
  }, [data]);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 1. Header Toolbar & Ringkasan KPI */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--card)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
                Health Risk Assessment (HRA)
              </h1>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: 'var(--muted)',
                  color: 'var(--muted-foreground)',
                  border: '1px solid var(--border)',
                }}
              >
                FORM/069 Rev.001
              </span>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
              Identifikasi bahaya kesehatan, pemetaan kelompok berisiko, dan evaluasi hierarki pengendalian.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onAddNew && (
              <button
                type="button"
                onClick={onAddNew}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 11.5,
                  fontWeight: 700,
                  background: 'var(--brand-primary, #ff4d00)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
              >
                <Plus size={14} /> Tambah Entri HRA
              </button>
            )}
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              title="Muat ulang data"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 11.5,
                fontWeight: 600,
                background: 'var(--background)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Metrik Counter Badges */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: 'var(--muted)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 10.5, color: 'var(--muted-foreground)', fontWeight: 600 }}>Total Bahaya:</span>
            <b style={{ fontSize: 13, fontWeight: 800 }}>{summary.total}</b>
          </div>

          <div
            onClick={() => setRiskFilter(riskFilter === 'Tinggi' ? 'ALL' : 'Tinggi')}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: getRiskBg(16),
              border: `1px solid ${getRiskBorder(16)}`,
              color: getRiskColor(16),
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              outline: riskFilter === 'Tinggi' ? `2px solid ${getRiskColor(16)}` : 'none',
            }}
          >
            <AlertTriangle size={14} />
            <span style={{ fontSize: 10.5, fontWeight: 700 }}>Risiko Tinggi:</span>
            <b style={{ fontSize: 13, fontWeight: 800 }}>{summary.tinggi}</b>
          </div>

          <div
            onClick={() => setRiskFilter(riskFilter === 'Sedang' ? 'ALL' : 'Sedang')}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: getRiskBg(9),
              border: `1px solid ${getRiskBorder(9)}`,
              color: getRiskColor(9),
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              outline: riskFilter === 'Sedang' ? `2px solid ${getRiskColor(9)}` : 'none',
            }}
          >
            <ShieldAlert size={14} />
            <span style={{ fontSize: 10.5, fontWeight: 700 }}>Risiko Sedang:</span>
            <b style={{ fontSize: 13, fontWeight: 800 }}>{summary.sedang}</b>
          </div>

          <div
            onClick={() => setRiskFilter(riskFilter === 'Rendah' ? 'ALL' : 'Rendah')}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: getRiskBg(2),
              border: `1px solid ${getRiskBorder(2)}`,
              color: getRiskColor(2),
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              outline: riskFilter === 'Rendah' ? `2px solid ${getRiskColor(2)}` : 'none',
            }}
          >
            <ShieldCheck size={14} />
            <span style={{ fontSize: 10.5, fontWeight: 700 }}>Risiko Rendah:</span>
            <b style={{ fontSize: 13, fontWeight: 800 }}>{summary.rendah}</b>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0 10px',
              flex: 1,
              minWidth: 220,
              height: 32,
            }}
          >
            <Search size={14} style={{ color: 'var(--muted-foreground)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari aktivitas, kelompok berisiko, bahaya, atau efek kesehatan..."
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
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--muted-foreground)' }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Departemen */}
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
              padding: '0 10px',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">Semua Departemen</option>
            {deptOptions.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label} {d.desc ? `(${d.desc})` : ''}
              </option>
            ))}
          </select>

          {/* Filter Jenis Hazard */}
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
              padding: '0 10px',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">Semua Jenis Hazard</option>
            {HAZARD_TYPE_LIST.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>

          {/* Filter Risiko Level */}
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
              padding: '0 10px',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">Semua Level Risiko</option>
            <option value="Tinggi">🔴 Risiko Tinggi (R ≥ 15)</option>
            <option value="Sedang">🟡 Risiko Sedang (R 5 - 12)</option>
            <option value="Rendah">🟢 Risiko Rendah (R 1 - 4)</option>
          </select>
        </div>
      </div>

      {/* 2. Daftar Tabel Expandable */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px' }}>
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
            {data.map((item, idx) => {
              const isExpanded = expandedId === item.id;
              const katInit = getKategoriRisiko(item.init_r);
              const katRes = getKategoriRisiko(item.res_r);

              return (
                <div
                  key={item.id}
                  style={{
                    borderRadius: 10,
                    border: isExpanded ? '1px solid var(--brand-primary, #ff4d00)' : '1px solid var(--border)',
                    background: 'var(--card)',
                    overflow: 'hidden',
                    transition: 'all 0.15s ease',
                    boxShadow: isExpanded ? '0 3px 12px rgba(0,0,0,0.06)' : 'none',
                  }}
                >
                  {/* Row Summary Bar (Clickable) */}
                  <div
                    onClick={() => toggleExpand(item.id)}
                    style={{
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: 'pointer',
                      userSelect: 'none',
                      background: isExpanded ? 'rgba(255, 77, 0, 0.03)' : 'transparent',
                    }}
                  >
                    {/* Expand Indicator */}
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isExpanded ? 'var(--brand-primary, #ff4d00)' : 'var(--muted)',
                        color: isExpanded ? '#fff' : 'var(--muted-foreground)',
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>

                    {/* Departemen Badge */}
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'var(--muted)',
                        color: 'var(--foreground)',
                        border: '1px solid var(--border)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        flexShrink: 0,
                        minWidth: 84,
                        textAlign: 'center',
                      }}
                    >
                      {item.departemen}
                    </span>

                    {/* Main Title: Jenis Pekerjaan & Kelompok */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--foreground)' }}>
                          {item.jenis_pekerjaan}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                          • {item.kelompok_beresiko}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
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

                    {/* Hazard Category Tag */}
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'var(--muted)',
                        color: 'var(--foreground)',
                        border: '1px solid var(--border)',
                        flexShrink: 0,
                      }}
                    >
                      {item.jenis_hazard}
                    </span>

                    {/* Risk Badge (Initial -> Residual: P x E = R) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <div
                        title={`Initial Risk: P=${item.init_p} × E=${item.init_e} = R=${item.init_r} (${katInit})`}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 10.5,
                          fontWeight: 800,
                          background: getRiskBg(item.init_r),
                          color: getRiskColor(item.init_r),
                          border: `1px solid ${getRiskBorder(item.init_r)}`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span>Awal: R={item.init_r}</span>
                      </div>

                      <ArrowRight size={12} style={{ color: 'var(--muted-foreground)', opacity: 0.6 }} />

                      <div
                        title={`Residual Risk: P=${item.res_p} × E=${item.res_e} = R=${item.res_r} (${katRes})`}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 10.5,
                          fontWeight: 800,
                          background: getRiskBg(item.res_r),
                          color: getRiskColor(item.res_r),
                          border: `1px solid ${getRiskBorder(item.res_r)}`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span>Sisa: R={item.res_r}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(item)}
                          title="Edit entri HRA"
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            border: '1px solid var(--border)',
                            background: 'var(--background)',
                            color: 'var(--foreground)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
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
                          borderRadius: 6,
                          border: '1px solid var(--border)',
                          background: 'var(--background)',
                          color: '#E63946',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Detail View */}
                  {isExpanded && (
                    <div
                      style={{
                        padding: '14px 16px 16px',
                        borderTop: '1px solid var(--border)',
                        background: 'var(--background)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                      }}
                    >
                      {/* Grid 2 Kolom: Detail Bahaya & Efek */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                        {/* Kolom 1: Sumber & Efek Kesehatan */}
                        <div
                          style={{
                            padding: '10px 12px',
                            borderRadius: 8,
                            background: 'var(--card)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: 4 }}>
                            Sumber Bahaya Kesehatan & Efek
                          </div>
                          <div style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 8 }}>
                            <span style={{ fontWeight: 600 }}>Sumber: </span>
                            {item.sumber_hazard}
                          </div>
                          <div style={{ fontSize: 12, lineHeight: 1.5, color: '#e63946' }}>
                            <span style={{ fontWeight: 700 }}>Efek Kesehatan Potensial: </span>
                            {item.efek_kesehatan}
                          </div>
                        </div>

                        {/* Kolom 2: Skoring Matriks Risiko */}
                        <div
                          style={{
                            padding: '10px 12px',
                            borderRadius: 8,
                            background: 'var(--card)',
                            border: '1px solid var(--border)',
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 10,
                          }}
                        >
                          {/* Initial Risk Card */}
                          <div
                            style={{
                              padding: '8px 10px',
                              borderRadius: 6,
                              background: getRiskBg(item.init_r),
                              border: `1px solid ${getRiskBorder(item.init_r)}`,
                            }}
                          >
                            <div style={{ fontSize: 9.5, fontWeight: 800, color: getRiskColor(item.init_r), textTransform: 'uppercase' }}>
                              Initial Risk (P × E)
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 900, color: getRiskColor(item.init_r), margin: '2px 0' }}>
                              R = {item.init_r}
                            </div>
                            <div style={{ fontSize: 9.5, color: 'var(--foreground)', lineHeight: 1.3 }}>
                              Peluang / Probability (P): <b>{item.init_p}</b> ({PROBABILITY_LABELS[item.init_p]?.title || ''})<br />
                              Efek / Effect (E): <b>{item.init_e}</b> ({EFFECT_LABELS[item.init_e]?.title || ''})<br />
                              Kategori: <b>{katInit}</b>
                            </div>
                          </div>

                          {/* Residual Risk Card */}
                          <div
                            style={{
                              padding: '8px 10px',
                              borderRadius: 6,
                              background: getRiskBg(item.res_r),
                              border: `1px solid ${getRiskBorder(item.res_r)}`,
                            }}
                          >
                            <div style={{ fontSize: 9.5, fontWeight: 800, color: getRiskColor(item.res_r), textTransform: 'uppercase' }}>
                              Residual Risk (P × E)
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 900, color: getRiskColor(item.res_r), margin: '2px 0' }}>
                              R = {item.res_r}
                            </div>
                            <div style={{ fontSize: 9.5, color: 'var(--foreground)', lineHeight: 1.3 }}>
                              Peluang / Probability (P): <b>{item.res_p}</b> ({PROBABILITY_LABELS[item.res_p]?.title || ''})<br />
                              Efek / Effect (E): <b>{item.res_e}</b> ({EFFECT_LABELS[item.res_e]?.title || ''})<br />
                              Kategori: <b>{katRes}</b>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Tindakan Pengendalian & Hierarki Kontrol */}
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: 'var(--card)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
                            Tindakan Pencegahan / Pengendalian yang Ditetapkan
                          </span>
                          {item.kontrol_tingkat && (
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: 4,
                                background: 'rgba(52, 152, 219, 0.15)',
                                color: '#2980b9',
                                border: '1px solid rgba(52, 152, 219, 0.3)',
                              }}
                            >
                              Tingkat Kontrol: {item.kontrol_tingkat}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--foreground)' }}>
                          {item.tindakan_pencegahan || 'Belum ada catatan pengendalian khusus.'}
                        </div>
                      </div>

                      {/* Regulasi Terkait */}
                      {item.regulasi && (
                        <div
                          style={{
                            padding: '8px 12px',
                            borderRadius: 6,
                            background: 'var(--muted)',
                            fontSize: 11,
                            color: 'var(--muted-foreground)',
                            lineHeight: 1.4,
                            display: 'flex',
                            gap: 6,
                          }}
                        >
                          <BookOpen size={13} style={{ flexShrink: 0, marginTop: 2, opacity: 0.7 }} />
                          <div>
                            <b style={{ color: 'var(--foreground)' }}>Dasar Regulasi: </b>
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
      <Popup state={popupState} closePopup={closePopup} />
    </div>
  );
}
