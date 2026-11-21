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
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top Tab Bar */}
      <div style={{ padding: '8px 16px 0', flexShrink: 0, borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
        <CenteredTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel="Health Risk Assessment" compact />
      </div>

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
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '10px 16px' }}>
      {/* Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
            Pemetaan Kategori Risiko Kesehatan Kerja Berdasarkan Jabatan
          </h2>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
            Dasar penetapan jenis pemeriksaan MCU khusus & klarifikasi keterkaitan pajanan kasus PAK (INK/017).
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '0 8px',
              height: 30,
              minWidth: 180,
            }}
          >
            <Search size={12} style={{ color: 'var(--muted-foreground)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari jabatan, lokasi, dept..."
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 11, color: 'var(--foreground)', width: '100%' }}
            />
          </div>

          <select
            value={filterKat}
            onChange={(e) => setFilterKat(e.target.value)}
            style={{
              height: 30,
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: 11,
              padding: '0 8px',
            }}
          >
            <option value="ALL">Semua Tingkat Risiko</option>
            <option value="Tinggi">🔴 Risiko Tinggi (R 15-25)</option>
            <option value="Sedang">🟡 Risiko Sedang (R 5-12)</option>
            <option value="Rendah">🟢 Risiko Rendah (R 1-4)</option>
          </select>

          <select
            value={filterLokasi}
            onChange={(e) => setFilterLokasi(e.target.value)}
            style={{
              height: 30,
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: 11,
              padding: '0 8px',
            }}
          >
            <option value="ALL">Semua Lokasi</option>
            <option value="Head Office">Head Office</option>
            <option value="Jobsite">Jobsite</option>
            <option value="Head Office & Jobsite">Head Office & Jobsite</option>
          </select>

          <button
            type="button"
            onClick={loadMappings}
            disabled={loading}
            title="Refresh pemetaan jabatan"
            style={{
              height: 30,
              padding: '0 10px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 11, marginBottom: 8 }}>
          {error}
        </div>
      )}

      {/* Table Content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 11.5 }}>
            <RefreshCw size={18} className="animate-spin" style={{ margin: '0 auto 8px', opacity: 0.5 }} />
            Memuat data pemetaan risiko jabatan...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 11.5 }}>
            Tidak ada jabatan yang cocok dengan filter atau database belum diisi.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, background: 'var(--muted)', zIndex: 1, borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 700, width: 36, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}>No</th>
                <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 700, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}>Jabatan</th>
                <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 700, width: 120, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}>Lokasi Kerja</th>
                <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 700, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}>Departemen</th>
                <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 700, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}>Kelompok Pekerja</th>
                <th style={{ textAlign: 'center', padding: '6px 10px', fontWeight: 700, width: 80, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}>R Max</th>
                <th style={{ textAlign: 'center', padding: '6px 10px', fontWeight: 700, width: 100, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}>Kategori</th>
                <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 700, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}>Dasar Pertimbangan</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const isTinggi = row.kategori_risiko === 'Tinggi' || row.nilai_r_tertinggi >= 15;
                const isSedang = row.kategori_risiko === 'Sedang' || (row.nilai_r_tertinggi >= 5 && row.nilai_r_tertinggi < 15);
                const color = isTinggi ? '#FF2D2D' : isSedang ? '#F5A623' : '#00B894';
                const bg = isTinggi ? 'rgba(255, 45, 45, 0.12)' : isSedang ? 'rgba(245, 166, 35, 0.12)' : 'rgba(0, 184, 148, 0.12)';
                const bdr = isTinggi ? 'rgba(255, 45, 45, 0.35)' : isSedang ? 'rgba(245, 166, 35, 0.35)' : 'rgba(0, 184, 148, 0.35)';

                const isJobsite = row.lokasi_kerja?.includes('Jobsite');
                const isHO = row.lokasi_kerja?.includes('Head Office');

                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 10px', color: 'var(--muted-foreground)' }}>{i + 1}</td>
                    <td style={{ padding: '6px 10px', fontWeight: 700 }}>{row.jabatan}</td>
                    <td style={{ padding: '6px 10px' }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: isJobsite && !isHO ? 'rgba(234, 88, 12, 0.12)' : isHO && !isJobsite ? 'rgba(59, 130, 246, 0.12)' : 'var(--muted)',
                          color: isJobsite && !isHO ? '#c2410c' : isHO && !isJobsite ? '#1d4ed8' : 'var(--foreground)',
                          border: '1px solid var(--border)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.lokasi_kerja || '-'}
                      </span>
                    </td>
                    <td style={{ padding: '6px 10px' }}>{row.departemen}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--muted-foreground)' }}>{row.kelompok_pekerja}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 800 }}>{row.nilai_r_tertinggi}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: bg, color, border: `1px solid ${bdr}` }}>
                        {row.kategori_risiko}
                      </span>
                    </td>
                    <td style={{ padding: '6px 10px', fontSize: 10.5, color: 'var(--muted-foreground)', maxWidth: 350 }}>
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
