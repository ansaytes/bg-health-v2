'use client';

import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, Clock, AlertCircle, LogOut, CheckCircle2 } from 'lucide-react';
import type { EmployeeIdentityView } from './QuestionnaireUI';

const STORAGE_KEY = 'bg_health_qtoken';

export interface StoredQuestionnaireSession {
  token: string;
  expiresAt: number;
  identity: EmployeeIdentityView;
}

export function getStoredSession(): StoredQuestionnaireSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredQuestionnaireSession;
    if (!data || typeof data.expiresAt !== 'number' || data.expiresAt <= Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function saveStoredSession(data: StoredQuestionnaireSession): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function clearStoredSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

interface QuestionnaireTokenGateProps {
  children: React.ReactNode;
}

export default function QuestionnaireTokenGate({ children }: QuestionnaireTokenGateProps) {
  const [session, setSession] = useState<StoredQuestionnaireSession | null>(null);
  const [mounted, setMounted] = useState(false);
  const [remainingMinutes, setRemainingMinutes] = useState(30);

  const [nik, setNik] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
    const existing = getStoredSession();
    if (existing) {
      setSession(existing);
      setRemainingMinutes(Math.max(1, Math.ceil((existing.expiresAt - Date.now()) / (60 * 1000))));
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      const remaining = session.expiresAt - Date.now();
      if (remaining <= 0) {
        clearStoredSession();
        setSession(null);
        setError('Sesi One-Time Token Anda telah berakhir (lewat 30 menit). Silakan verifikasi ulang untuk melanjutkan.');
      } else {
        setRemainingMinutes(Math.max(1, Math.ceil(remaining / (60 * 1000))));
      }
    }, 15000); // per 15 detik

    return () => clearInterval(interval);
  }, [session]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nik.trim()) {
      setError('Masukkan NIK Karyawan atau NIK KTP Anda.');
      return;
    }
    if (!pin.trim()) {
      setError('Masukkan Tanggal Lahir atau NIK KTP untuk verifikasi identitas.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/kuesioner/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nik: nik.trim(), pin: pin.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Verifikasi identitas gagal.');
      }

      const newSession: StoredQuestionnaireSession = {
        token: data.token,
        expiresAt: data.expiresAt,
        identity: data.identity,
      };
      saveStoredSession(newSession);
      setSession(newSession);
      setRemainingMinutes(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghubungi server verifikasi.');
    } finally {
      setLoading(false);
    }
  };

  const handleEndSession = () => {
    clearStoredSession();
    setSession(null);
    setNik('');
    setPin('');
    setError('');
  };

  if (!mounted) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)' }}>
        Memeriksa sesi kuesioner...
      </div>
    );
  }

  // Jika belum ada One-Time Token atau token kadaluarsa: Tampilkan Gate Verifikasi (macOS Window Style)
  if (!session) {
    return (
      <div
        style={{
          minHeight: '85vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px',
          background: 'var(--background)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif',
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Verifikasi Responden"
          style={{
            maxWidth: 440,
            width: '100%',
            background: 'var(--card)',
            borderRadius: 14,
            border: '1px solid var(--border)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.22), 0 2px 10px rgba(0,0,0,0.06)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* macOS Window Title Bar */}
          <div
            style={{
              height: 38,
              padding: '0 14px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--card)',
              flexShrink: 0,
              userSelect: 'none',
            }}
          >
            {/* macOS Window Header without fake traffic lights */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="brand-orange-dot" aria-hidden="true" />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--foreground)',
                  letterSpacing: '-0.01em',
                }}
              >
                Verifikasi Responden: One-Time Token
              </span>
            </div>
          </div>

          {/* macOS Window Body */}
          <div style={{ padding: '22px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: 'rgba(255, 94, 0, 0.1)',
                  border: '1px solid rgba(255, 94, 0, 0.25)',
                  color: '#FF5E00',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Lock size={20} strokeWidth={2.2} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--foreground)' }}>
                    Verifikasi Responden
                  </h2>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: '2px 7px',
                      borderRadius: 6,
                      background: 'rgba(255, 94, 0, 0.12)',
                      color: '#FF5E00',
                    }}
                  >
                    ⏱️ 30 Menit
                  </span>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--muted-foreground)', margin: '2px 0 0', lineHeight: 1.4 }}>
                  Verifikasi identitas karyawan sebelum pengisian instrumen skrining. Sesi One-Time Token aktif selama 30 menit.
                </p>
              </div>
            </div>

            {error && (
              <div
                style={{
                  padding: '9px 12px',
                  borderRadius: 8,
                  background: 'rgba(255, 59, 48, 0.08)',
                  border: '1px solid rgba(255, 59, 48, 0.25)',
                  color: '#d32f2f',
                  fontSize: 12,
                  lineHeight: 1.4,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--muted-foreground)',
                    marginBottom: 5,
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}
                >
                  NIK Karyawan
                </label>
                <input
                  type="text"
                  value={nik}
                  onChange={(e) => setNik(e.target.value)}
                  placeholder="Contoh: 230802778"
                  disabled={loading}
                  autoComplete="username"
                  className="focus-visible:ring-2 focus-visible:ring-[#FF5E00]/40 focus-visible:border-[#FF5E00]"
                  style={{
                    width: '100%',
                    height: 44,
                    minHeight: 44,
                    padding: '0 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    color: 'var(--foreground)',
                    fontSize: 14,
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4, display: 'block' }}>
                  Nomor Induk Karyawan PT. Bagong Dekaka Makmur
                </span>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--muted-foreground)',
                    marginBottom: 5,
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}
                >
                  Tanggal Lahir
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="ddmmyyyy (misal: 17081995)"
                  disabled={loading}
                  autoComplete="current-password"
                  className="focus-visible:ring-2 focus-visible:ring-[#FF5E00]/40 focus-visible:border-[#FF5E00]"
                  style={{
                    width: '100%',
                    height: 44,
                    minHeight: 44,
                    padding: '0 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    color: 'var(--foreground)',
                    fontSize: 14,
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4, display: 'block' }}>
                  Format 8 digit: Hari-Bulan-Tahun (ddmmyyyy)
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 6,
                  height: 44,
                  minHeight: 44,
                  borderRadius: 8,
                  background: '#FF5E00',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 2px 8px rgba(255, 94, 0, 0.25)',
                  opacity: loading ? 0.7 : 1,
                  transition: 'opacity 0.15s ease',
                }}
              >
                {loading ? 'Memverifikasi...' : 'Mulai Pengisian (Sesi 30 Menit)'}
              </button>
            </form>

            <div style={{ textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                🔒 Dilindungi Enkripsi AES-256 Sesuai UU No. 27/2022 (PDP)
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Jika One-Time Token Aktif: Tampilkan Banner Sesi + Render Form Kuesioner (macOS Toolbar)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Banner Sesi 30 Menit macOS Toolbar Style */}
      <div
        style={{
          background: 'var(--card)',
          borderBottom: '1px solid var(--border)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          fontSize: 12,
          position: 'sticky',
          top: 0,
          zIndex: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 9px',
              borderRadius: 6,
              background: 'rgba(0,184,148,0.12)',
              color: '#00806a',
              fontWeight: 600,
              fontSize: 11,
            }}
          >
            <CheckCircle2 size={13} /> Sesi Responden Terverifikasi
          </span>
          <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>
            {session.identity.nama} (NIK: {session.identity.nikKaryawan || session.identity.nationalId})
          </span>
          <span style={{ color: 'var(--muted-foreground)' }}>• {session.identity.site}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 9px',
              borderRadius: 6,
              background: remainingMinutes <= 5 ? 'rgba(255, 59, 48, 0.12)' : 'rgba(255, 149, 0, 0.12)',
              color: remainingMinutes <= 5 ? '#FF3B30' : '#FF9500',
              fontWeight: 600,
              fontSize: 11,
            }}
          >
            <Clock size={12} /> Sisa Sesi: {remainingMinutes} Menit
          </span>

          <button
            type="button"
            onClick={handleEndSession}
            title="Keluar dari sesi untuk mengosongkan tablet/perangkat"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            <LogOut size={12} /> Selesai / Ganti Akun
          </button>
        </div>
      </div>

      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
