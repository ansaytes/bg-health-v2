'use client';

// HraRiskProfileCard.tsx — Profil Bahaya Kerja HRA pada Tinjauan MCU
// Standar: BG/QSHE/FORM/069 Rev.001 & Kepmen ESDM 1827 K/30/MEM/2018
// Menghubungkan riwayat jabatan pekerja dengan bahaya target organ pada MCU

import React, { useState, useEffect, useMemo } from 'react';
import { authFetch } from '@/lib/api-client';
import {
  HraHazardEntry,
  HraMappingJabatan,
  getRiskBg,
  getRiskColor,
  getRiskBorder,
} from '@/lib/hra';
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';

interface HraRiskProfileCardProps {
  jabatan?: string | null;
  departemen?: string | null;
}

export default function HraRiskProfileCard({
  jabatan,
  departemen,
}: HraRiskProfileCardProps) {
  const [hazards, setHazards] = useState<HraHazardEntry[]>([]);
  const [mapping, setMapping] = useState<HraMappingJabatan | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const jNorm = (jabatan || '').trim();
    const dNorm = (departemen || '').trim();

    if (!jNorm && !dNorm) {
      setHazards([]);
      setMapping(null);
      return;
    }

    let active = true;
    setLoading(true);

    const q = new URLSearchParams();
    if (jNorm) q.set('search', jNorm);
    else if (dNorm) q.set('dept', dNorm);

    const p1 = authFetch<{ success: boolean; data?: HraHazardEntry[] }>(
      `/api/hra?${q.toString()}`
    );
    const p2 = authFetch<{ success: boolean; data?: HraMappingJabatan[] }>(
      '/api/hra?resource=mapping'
    );

    Promise.all([p1, p2])
      .then(([resHazards, resMapping]) => {
        if (!active) return;

        let list = Array.isArray(resHazards?.data) ? resHazards.data : [];
        if (list.length === 0 && dNorm) {
          authFetch<{ success: boolean; data?: HraHazardEntry[] }>(
            `/api/hra?dept=${encodeURIComponent(dNorm)}`
          ).then((fb) => {
            if (active && fb?.data) setHazards(fb.data);
          }).catch(() => {});
        } else {
          setHazards(list);
        }

        if (Array.isArray(resMapping?.data) && jNorm) {
          const needle = jNorm.toLowerCase();
          const match = resMapping.data.find(
            (m) =>
              (m.jabatan && needle.includes(m.jabatan.toLowerCase())) ||
              (m.jabatan && m.jabatan.toLowerCase().includes(needle)) ||
              (m.kelompok_pekerja && m.kelompok_pekerja.toLowerCase().includes(needle))
          );
          setMapping(match || null);
        }
      })
      .catch((err) => {
        console.error('[HraRiskProfileCard] Gagal memuat profil HRA:', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [jabatan, departemen]);

  // Ekstraksi Organ Sasaran / Fokus Medis berdasarkan daftar hazard
  const focusTargets = useMemo(() => {
    const targets: { label: string; icon: string; desc: string }[] = [];
    const text = hazards.map((h) => `${h.jenis_hazard} ${h.sumber_hazard} ${h.efek_kesehatan}`).join(' ').toLowerCase();

    if (text.includes('bising') || text.includes('dengar') || text.includes('nihl') || text.includes('fisika')) {
      targets.push({
        label: 'Pendengaran (Audiometri)',
        icon: 'ear',
        desc: 'Paparan bising mesin/alat. Pantau STS & ambang dengar 2k-4k Hz.',
      });
    }
    if (text.includes('ergonomi') || text.includes('postur') || text.includes('getaran') || text.includes('tulang') || text.includes('lbp')) {
      targets.push({
        label: 'Muskuloskeletal & Tulang Belakang',
        icon: 'bone',
        desc: 'Postur kerja & getaran seluruh tubuh (Whole Body Vibration). Evaluasi LBP/HNP.',
      });
    }
    if (text.includes('debu') || text.includes('paru') || text.includes('silika') || text.includes('asap') || text.includes('las')) {
      targets.push({
        label: 'Respirasi & Paru (Spirometri)',
        icon: 'lungs',
        desc: 'Paparan partikulat/debu tambang. Pantau FEV1/FVC dan rontgen thoraks berkala.',
      });
    }
    if (text.includes('kimia') || text.includes('solvent') || text.includes('bbm') || text.includes('oli') || text.includes('logam')) {
      targets.push({
        label: 'Hepatobilier & Ginjal (Lab Kimia)',
        icon: 'flask',
        desc: 'Paparan bahan kimia/solvent. Cek SGOT, SGPT, kreatinin, eGFR.',
      });
    }
    if (text.includes('psikososial') || text.includes('shift') || text.includes('lelah') || text.includes('fatigue')) {
      targets.push({
        label: 'Neuropsikologi & Fatigue (ESS)',
        icon: 'brain',
        desc: 'Shift kerja malam / monotoni operasional. Pantau skor kantuk ESS & skrining mental.',
      });
    }

    return targets;
  }, [hazards]);

  if (!jabatan && !departemen) return null;

  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--card)',
        padding: '12px 14px',
        marginBottom: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}
    >
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: 'rgba(255, 94, 0, 0.12)',
              color: '#FF5E00',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            HRA
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>
              Profil Bahaya Kesehatan Kerja (FORM/069 Rev.001)
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--muted-foreground)' }}>
              Jabatan: <b>{jabatan || '-'}</b> · Departemen: <b>{departemen || '-'}</b>
            </div>
          </div>
        </div>

        {/* Risk Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {mapping ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2.5px 9px',
                borderRadius: 4,
                background: getRiskBg(mapping.nilai_r_tertinggi),
                color: getRiskColor(mapping.nilai_r_tertinggi),
                border: `1px solid ${getRiskBorder(mapping.nilai_r_tertinggi)}`,
              }}
            >
              Kategori: {mapping.kategori_risiko} (R Tertinggi = {mapping.nilai_r_tertinggi})
            </span>
          ) : hazards.length > 0 ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2.5px 9px',
                borderRadius: 4,
                background: 'rgba(255, 149, 0, 0.12)',
                color: '#FF9500',
                border: '1px solid rgba(255, 149, 0, 0.3)',
              }}
            >
              {hazards.length} Bahaya Terpetakan
            </span>
          ) : (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '2.5px 8px',
                borderRadius: 4,
                background: 'var(--muted)',
                color: 'var(--muted-foreground)',
              }}
            >
              Hazard Umum Dept
            </span>
          )}

          {hazards.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 10.5,
                fontWeight: 600,
                color: 'var(--foreground)',
                background: 'var(--background)',
                border: '1px solid var(--border)',
                padding: '2px 8px',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              {expanded ? (
                <>
                  Tutup <ChevronUp size={12} />
                </>
              ) : (
                <>
                  Rincian ({hazards.length}) <ChevronDown size={12} />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Fokus Organ Target Sasaran Medis (Dokter Reference) */}
      {focusTargets.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)', marginBottom: 6 }}>
            Fokus Evaluasi Medis Sesuai Paparan Pekerjaan
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 6 }}>
            {focusTargets.map((ft, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 7,
                  padding: '6px 8px',
                  borderRadius: 7,
                  background: 'var(--muted)',
                  border: '1px solid var(--border)',
                  fontSize: 11,
                }}
              >
                <div style={{ marginTop: 1, color: '#FF5E00', flexShrink: 0 }}>
                  <Activity size={13} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--foreground)', fontSize: 11 }}>{ft.label}</div>
                  <div style={{ fontSize: 9.5, color: 'var(--muted-foreground)', lineHeight: 1.35 }}>{ft.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expanded List of Specific HRA Hazards */}
      {expanded && hazards.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
            Matriks Bahaya Terinci (P × E = R)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
            {hazards.map((h) => (
              <div
                key={h.id}
                style={{
                  padding: '7px 9px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--background)',
                  fontSize: 11,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: 'var(--muted)',
                        color: 'var(--muted-foreground)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {h.jenis_hazard}
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{h.jenis_pekerjaan}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
                    <b>Sumber:</b> {h.sumber_hazard} · <b style={{ color: '#FF3B30' }}>Efek:</b> {h.efek_kesehatan}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 4,
                      background: getRiskBg(h.res_r),
                      color: getRiskColor(h.res_r),
                      border: `1px solid ${getRiskBorder(h.res_r)}`,
                    }}
                  >
                    Residual R={h.res_r}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
