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
      (m.kelompok_pekerja || '').toLowerCase().includes(search.toLowerCase());
    const matchKat = filterKat === 'ALL' || (m.kategori_risiko || '').toLowerCase() === filterKat.toLowerCase();
    return matchSearch && matchKat;
  });

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px 16px' }}>
      {/* Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 14.5, fontWeight: 800, margin: 0 }}>
            Pemetaan Kategori Risiko Kesehatan Kerja Berdasarkan Jabatan
          </h2>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
            Dasar penetapan jenis pemeriksaan MCU khusus & klarifikasi keterkaitan pajanan kasus PAK (INK/017).
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0 10px',
              height: 32,
              minWidth: 200,
            }}
          >
            <Search size={13} style={{ color: 'var(--muted-foreground)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari jabatan atau departemen..."
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 11.5, color: 'var(--foreground)' }}
            />
          </div>

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
              padding: '0 8px',
            }}
          >
            <option value="ALL">Semua Tingkat Risiko</option>
            <option value="Tinggi">🔴 Risiko Tinggi (R 15-25)</option>
            <option value="Sedang">🟡 Risiko Sedang (R 5-12)</option>
            <option value="Rendah">🟢 Risiko Rendah (R 1-4)</option>
          </select>

          <button
            type="button"
            onClick={loadMappings}
            disabled={loading}
            title="Refresh pemetaan jabatan"
            style={{
              height: 32,
              padding: '0 10px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11.5,
            }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 11.5, marginBottom: 8 }}>
          {error}
        </div>
      )}

      {/* Table Content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
            <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px', opacity: 0.5 }} />
            Memuat data pemetaan risiko jabatan dari database...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
            Tidak ada jabatan yang cocok dengan filter atau database belum diisi.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, background: 'var(--muted)', zIndex: 1, borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700, width: 40 }}>No</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700 }}>Jabatan</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700 }}>Departemen</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700 }}>Kelompok Pekerja</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 700, width: 100 }}>R Tertinggi</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 700, width: 120 }}>Kategori</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700 }}>Dasar Pertimbangan</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const isTinggi = row.kategori_risiko === 'Tinggi' || row.nilai_r_tertinggi >= 15;
                const isSedang = row.kategori_risiko === 'Sedang' || (row.nilai_r_tertinggi >= 5 && row.nilai_r_tertinggi < 15);
                const color = isTinggi ? '#FF2D2D' : isSedang ? '#F5A623' : '#00B894';
                const bg = isTinggi ? 'rgba(255, 45, 45, 0.1)' : isSedang ? 'rgba(245, 166, 35, 0.1)' : 'rgba(0, 184, 148, 0.1)';

                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--muted-foreground)' }}>{i + 1}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 700 }}>{row.jabatan}</td>
                    <td style={{ padding: '8px 12px' }}>{row.departemen}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--muted-foreground)' }}>{row.kelompok_pekerja}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800 }}>{row.nilai_r_tertinggi}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10.5, fontWeight: 800, background: bg, color }}>
                        {row.kategori_risiko}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--muted-foreground)', maxWidth: 350 }}>
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
