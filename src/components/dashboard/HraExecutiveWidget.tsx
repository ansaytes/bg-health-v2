'use client';

// ============================================================
// HraExecutiveWidget.tsx — Widget Ringkasan HRA di Dashboard Eksekutif
// Dokumen Acuan: BG/QSHE/FORM/069 Rev.001 & Kepmen ESDM 1827/2018
// Memuat data agregat dari /api/hra?resource=dashboard
// ============================================================

import React, { useState, useEffect } from 'react';
import { authFetch } from '@/lib/api-client';
import { useMCUStore } from '@/lib/store';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Activity,
  Layers,
  FileText,
  BarChart3,
  Loader2,
} from 'lucide-react';

interface HraDashboardData {
  total: number;
  ringkasan: {
    tinggi: number;
    sedang: number;
    rendah: number;
  };
  perDept: Record<string, number>;
  perJenis: Record<string, number>;
}

export default function HraExecutiveWidget() {
  const store = useMCUStore();
  const [data, setData] = useState<HraDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    authFetch<{ success: boolean; data?: HraDashboardData }>('/api/hra?resource=dashboard')
      .then((res) => {
        if (!active) return;
        if (res && res.data) {
          setData(res.data);
        }
      })
      .catch((err) => {
        console.error('[HraExecutiveWidget] Error loading HRA summary:', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const total = data?.total || 0;
  const tinggi = data?.ringkasan?.tinggi || 0;
  const sedang = data?.ringkasan?.sedang || 0;
  const rendah = data?.ringkasan?.rendah || 0;

  // Persentase risiko
  const pctTinggi = total > 0 ? Math.round((tinggi / total) * 100) : 0;
  const pctSedang = total > 0 ? Math.round((sedang / total) * 100) : 0;
  const pctRendah = total > 0 ? Math.round((rendah / total) * 100) : 0;

  const perJenis = Object.entries(data?.perJenis || {}).sort((a, b) => b[1] - a[1]);
  const perDept = Object.entries(data?.perDept || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div
      className="card"
      style={{
        borderRadius: 12,
        padding: '14px 16px',
        marginTop: 12,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}
    >
      {/* Header Widget */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
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
            <h2
              style={{
                fontSize: 13,
                fontWeight: 700,
                margin: 0,
                color: 'var(--foreground)',
                letterSpacing: '-0.01em',
              }}
            >
              Health Hazard Risk Assessment (FORM/069 Rev.001)
            </h2>
            <p
              style={{
                fontSize: 10.5,
                color: 'var(--muted-foreground)',
                margin: '2px 0 0',
              }}
            >
              Identifikasi &amp; Pemetaan Risiko Kesehatan Kerja Seluruh Departemen (Permenaker 5/2018 &amp; SMKP)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            store.setActivePage('administrator');
            store.setActiveAdminSidebar('hra-admin');
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            fontWeight: 600,
            color: '#FF5E00',
            background: 'rgba(255, 94, 0, 0.08)',
            border: '1px solid rgba(255, 94, 0, 0.25)',
            padding: '4px 10px',
            borderRadius: 999,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <span>Kelola Matriks HRA</span>
          <ArrowRight size={12} />
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 11.5, color: 'var(--muted-foreground)' }}>
          <Loader2 className="size-4 animate-spin inline mr-2" />
          Memuat ringkasan data HRA...
        </div>
      ) : (
        <>
          {/* KPI Capsule Grid (4 Metrik) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 8,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                padding: '9px 12px',
                borderRadius: 9,
                background: 'var(--muted)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)' }}>
                Total Bahaya Terpetakan
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', marginTop: 2 }}>
                {total} <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--muted-foreground)' }}>Hazard</span>
              </div>
            </div>

            <div
              style={{
                padding: '9px 12px',
                borderRadius: 9,
                background: 'rgba(255, 59, 48, 0.08)',
                border: '1px solid rgba(255, 59, 48, 0.25)',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: '#FF3B30', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ShieldAlert size={12} /> High Risk (R 15–25)
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#FF3B30', marginTop: 2 }}>
                {tinggi} <span style={{ fontSize: 10, fontWeight: 600 }}>({pctTinggi}%)</span>
              </div>
            </div>

            <div
              style={{
                padding: '9px 12px',
                borderRadius: 9,
                background: 'rgba(255, 149, 0, 0.08)',
                border: '1px solid rgba(255, 149, 0, 0.25)',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: '#FF9500', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={12} /> Medium Risk (R 5–12)
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#FF9500', marginTop: 2 }}>
                {sedang} <span style={{ fontSize: 10, fontWeight: 600 }}>({pctSedang}%)</span>
              </div>
            </div>

            <div
              style={{
                padding: '9px 12px',
                borderRadius: 9,
                background: 'rgba(52, 199, 89, 0.08)',
                border: '1px solid rgba(52, 199, 89, 0.25)',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: '#34C759', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ShieldCheck size={12} /> Low Risk (R 1–4)
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#34C759', marginTop: 2 }}>
                {rendah} <span style={{ fontSize: 10, fontWeight: 600 }}>({pctRendah}%)</span>
              </div>
            </div>
          </div>

          {/* 2 Kolom Rincian Faktor & Departemen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {/* Kolom 1: Sebaran Jenis Faktor Bahaya */}
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 9,
                background: 'var(--muted)/30',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--muted-foreground)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Activity size={12} style={{ color: '#FF5E00' }} />
                <span>Distribusi Faktor Bahaya Kesehatan</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {perJenis.map(([jns, count]) => {
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={jns} style={{ fontSize: 11 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{jns}</span>
                        <span style={{ color: 'var(--muted-foreground)', fontSize: 10.5 }}>
                          <b>{count}</b> ({pct}%)
                        </span>
                      </div>
                      <div style={{ width: '100%', height: 5, borderRadius: 999, background: 'var(--muted)', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            borderRadius: 999,
                            background:
                              jns === 'Ergonomi'
                                ? '#FF9500'
                                : jns === 'Fisika'
                                ? '#007AFF'
                                : jns === 'Kimia'
                                ? '#AF52DE'
                                : jns.includes('Psikososial')
                                ? '#FF2D55'
                                : '#34C759',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Kolom 2: Beban Bahaya per Departemen */}
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 9,
                background: 'var(--muted)/30',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--muted-foreground)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Layers size={12} style={{ color: '#FF5E00' }} />
                <span>Beban Bahaya Berdasarkan Departemen</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 160, overflowY: 'auto' }}>
                {perDept.map(([dept, count], idx) => (
                  <div
                    key={dept}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 8px',
                      borderRadius: 6,
                      background: 'var(--background)',
                      border: '1px solid var(--border)',
                      fontSize: 11,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', width: 14 }}>
                        #{idx + 1}
                      </span>
                      <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{dept}</span>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 999,
                        background: 'rgba(255, 94, 0, 0.12)',
                        color: '#FF5E00',
                      }}
                    >
                      {count} Hazard
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
