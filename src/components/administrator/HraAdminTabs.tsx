'use client';

// ============================================================
// Administrator > Higiene Industri > Health Risk Assessment (HRA)
// Container Tabs: Matriks HRA (Tabel Expandable), Form Input, dan Mapping Jabatan
// Acuan: Dokumen BG/QSHE/FORM/069 Rev.001
// Seluruh data dimuat dinamis dari database Supabase melalui API /api/hra
// ============================================================

import React, { useState, useEffect } from 'react';
import CenteredTabs from '@/components/ui/centered-tabs';
import HraTable from './HraTable';
import HraForm from './HraForm';
import { HraHazardEntry, HraMappingJabatan } from '@/lib/hra';
import { authFetch } from '@/lib/api-client';
import { ShieldCheck, ShieldAlert, AlertTriangle, Search, RefreshCw } from 'lucide-react';

type SubTab = 'tabel' | 'form' | 'mapping';

const TABS: { key: SubTab; label: string }[] = [
  { key: 'tabel', label: 'Matriks & Dokumen HRA' },
  { key: 'form', label: 'Form Input / Edit' },
  { key: 'mapping', label: 'Pemetaan Risiko Jabatan' },
];

export default function HraAdminTabs() {
  const [tab, setTab] = useState<SubTab>('tabel');
  const [editingEntry, setEditingEntry] = useState<HraHazardEntry | null>(null);

  const handleEdit = (entry: HraHazardEntry) => {
    setEditingEntry(entry);
    setTab('form');
  };

  const handleAddNew = () => {
    setEditingEntry(null);
    setTab('form');
  };

  const handleFormSuccess = () => {
    setEditingEntry(null);
    setTab('tabel');
  };

  const handleFormCancel = () => {
    setEditingEntry(null);
    setTab('tabel');
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--background)' }}>
      {/* ── Sub Tab HRA Rata Kiri Seragam dengan Modul Lain ──────── */}
      <CenteredTabs
        tabs={[
          { key: 'tabel', label: 'Matriks & Dokumen HRA' },
          { key: 'form', label: 'Form Input / Edit' },
          { key: 'mapping', label: 'Pemetaan Risiko Jabatan' },
        ]}
        active={tab}
        onChange={setTab}
        ariaLabel="Health Risk Assessment"
      />

      {/* Main Tab Content */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'tabel' && <HraTable onEdit={handleEdit} onAddNew={handleAddNew} />}

        {tab === 'form' && (
          <HraForm
            initialData={editingEntry}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        )}

        {tab === 'mapping' && <HraMappingView />}
      </div>
    </div>
  );
}

/** Tampilan Tab Mapping Risiko per Jabatan (Memuat dinamis dari tabel Supabase `hra_mapping_jabatan`) */
function HraMappingView() {
  const [mappings, setMappings] = useState<HraMappingJabatan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterKat, setFilterKat] = useState('ALL');
  const [filterLokasi, setFilterLokasi] = useState('ALL');

  const loadMappings = () => {
    setLoading(true);
    setError('');
    authFetch<{ success: boolean; data?: HraMappingJabatan[] }>('/api/hra?resource=mapping')
      .then((res) => {
        if (res && Array.isArray(res.data)) {
          setMappings(res.data);
        } else {
          setMappings([]);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Gagal memuat data pemetaan jabatan');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadMappings();
  }, []);

  const filtered = mappings.filter((m) => {
    const matchSearch =
      !search.trim() ||
      (m.jabatan || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.departemen || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.kelompok_pekerja || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.lokasi_kerja || '').toLowerCase().includes(search.toLowerCase());
    const matchKat = filterKat === 'ALL' || (m.kategori_risiko || '').toLowerCase() === filterKat.toLowerCase();
    const matchLokasi = filterLokasi === 'ALL' || (m.lokasi_kerja || '') === filterLokasi;
    return matchSearch && matchKat && matchLokasi;
  });

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px 18px' }}>
      {/* ── macOS Filter Bar ───────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, letterSpacing: '-0.015em', color: 'var(--foreground)' }}>
            Pemetaan Risiko Berdasarkan Jabatan
          </h2>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
            Dasar MCU khusus & kajian keterkaitan pajanan kasus PAK (INK/017)
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Spotlight Search Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 999,
              padding: '0 12px',
              height: 32,
              minWidth: 200,
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <Search size={13} style={{ color: 'var(--muted-foreground)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari jabatan, lokasi, departemen..."
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

          {/* macOS Pop-Up Select: Risiko */}
          <select
            value={filterKat}
            onChange={(e) => setFilterKat(e.target.value)}
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
            <option value="ALL">Semua Risiko</option>
            <option value="Tinggi">🔴 Risiko Tinggi (R 15-25)</option>
            <option value="Sedang">🟡 Risiko Sedang (R 5-12)</option>
            <option value="Rendah">🟢 Risiko Rendah (R 1-4)</option>
          </select>

          {/* macOS Pop-Up Select: Lokasi */}
          <select
            value={filterLokasi}
            onChange={(e) => setFilterLokasi(e.target.value)}
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
            <option value="ALL">Semua Lokasi</option>
            <option value="Head Office">Head Office</option>
            <option value="Jobsite">Jobsite</option>
            <option value="Head Office & Jobsite">Head Office & Jobsite</option>
          </select>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={loadMappings}
            disabled={loading}
            title="Refresh pemetaan jabatan"
            style={{
              height: 32,
              padding: '0 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11.5,
              fontWeight: 600,
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '8px 14px', borderRadius: 10, background: 'rgba(255,59,48,0.1)', color: '#FF3B30', fontSize: 11.5, marginBottom: 10, border: '1px solid rgba(255,59,48,0.2)' }}>
          {error}
        </div>
      )}

      {/* ── macOS Table Panel ──────────────────────────────── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          border: '1px solid var(--border)',
          borderRadius: 12,
          background: 'var(--card)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
            <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px', opacity: 0.5, color: '#FF5E00' }} />
            Memuat data pemetaan risiko jabatan...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
            Tidak ada jabatan yang cocok dengan filter atau kata kunci.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, background: 'var(--muted)', zIndex: 1, borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, width: 40, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}>No</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}>Jabatan</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, width: 130, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}>Lokasi Kerja</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}>Departemen</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}>Kelompok Pekerja</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600, width: 80, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}>R Max</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600, width: 100, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}>Kategori</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}>Dasar Pertimbangan</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const isTinggi = row.kategori_risiko === 'Tinggi' || row.nilai_r_tertinggi >= 15;
                const isSedang = row.kategori_risiko === 'Sedang' || (row.nilai_r_tertinggi >= 5 && row.nilai_r_tertinggi < 15);
                const color = isTinggi ? '#FF3B30' : isSedang ? '#FF9500' : '#34C759';
                const bg = isTinggi ? 'rgba(255, 59, 48, 0.12)' : isSedang ? 'rgba(255, 149, 0, 0.12)' : 'rgba(52, 199, 89, 0.12)';
                const bdr = isTinggi ? 'rgba(255, 59, 48, 0.28)' : isSedang ? 'rgba(255, 149, 0, 0.28)' : 'rgba(52, 199, 89, 0.28)';

                const isJobsite = row.lokasi_kerja?.includes('Jobsite');
                const isHO = row.lokasi_kerja?.includes('Head Office');

                return (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      transition: 'background 0.12s ease',
                    }}
                  >
                    <td style={{ padding: '8px 12px', color: 'var(--muted-foreground)' }}>{i + 1}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--foreground)' }}>{row.jabatan}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: isJobsite && !isHO ? 'rgba(234, 88, 12, 0.12)' : isHO && !isJobsite ? 'rgba(0, 122, 255, 0.12)' : 'var(--muted)',
                          color: isJobsite && !isHO ? '#ea580c' : isHO && !isJobsite ? '#007aff' : 'var(--foreground)',
                          border: `1px solid ${isJobsite && !isHO ? 'rgba(234, 88, 12, 0.25)' : isHO && !isJobsite ? 'rgba(0, 122, 255, 0.25)' : 'var(--border)'}`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.lokasi_kerja || '-'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>{row.departemen}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--muted-foreground)' }}>{row.kelompok_pekerja}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>{row.nilai_r_tertinggi}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <span
                        style={{
                          padding: '2px 9px',
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 700,
                          background: bg,
                          color,
                          border: `1px solid ${bdr}`,
                          letterSpacing: '0.02em',
                        }}
                      >
                        {row.kategori_risiko}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--muted-foreground)', maxWidth: 360, lineHeight: 1.4 }}>
                      {row.dasar_pertimbangan}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
