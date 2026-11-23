'use client';

import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, Clock, AlertCircle, ArrowRight, LogOut, CheckCircle2 } from 'lucide-react';
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

  // Form State
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

  // Timer countdown 30 menit
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

  // Jika belum ada One-Time Token atau token kadaluarsa: Tampilkan Gate Verifikasi
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
        }}
      >
        <div
          style={{
            maxWidth: 460,
            width: '100%',
            background: 'var(--card)',
            borderRadius: 16,
            border: '1px solid var(--border)',
            padding: '28px 24px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          {/* Header Icon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #FF6F1A 0%, #FF4D00 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(255, 77, 0, 0.3)',
              }}
            >
              <Lock size={22} strokeWidth={2.3} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--foreground)' }}>
                Verifikasi Responden
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'rgba(255, 94, 0, 0.1)',
                    color: '#FF5E00',
                  }}
                >
                  ⏱️ One-Time Token (30 Menit)
                </span>
              </div>
            </div>
          </div>

          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5, margin: 0 }}>
            Semua pengisian kuesioner wajib dilakukan secara mandiri atas nama akun Anda sendiri. Sesi berlaku aktif maksimal <b>30 menit</b> demi keamanan dan validitas data klinis.
          </p>

          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(255, 59, 48, 0.08)',
                border: '1px solid rgba(255, 59, 48, 0.3)',
                color: '#d32f2f',
                fontSize: 12,
                lineHeight: 1.4,
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--foreground)',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                NIK Karyawan atau NIK KTP
              </label>
              <input
                type="text"
                value={nik}
                onChange={(e) => setNik(e.target.value)}
                placeholder="Contoh: 230802778 atau NIK KTP 16 digit"
                disabled={loading}
                style={{
                  width: '100%',
                  height: 38,
                  padding: '0 12px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--foreground)',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                Verifikasi Rahasia (Tanggal Lahir / NIK KTP)
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Format: YYYY-MM-DD, DDMMYYYY, atau NIK KTP"
                disabled={loading}
                style={{
                  width: '100%',
                  height: 38,
                  padding: '0 12px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: 10.5, color: 'var(--muted-foreground)', marginTop: 4, display: 'block' }}>
                Gunakan tanggal lahir Anda (misal 1995-10-24 atau 24101995) atau NIK KTP sebagai bukti identitas sah.
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 6,
                height: 42,
                borderRadius: 999,
                background: 'linear-gradient(180deg, #FF6F1A 0%, #FF4D00 100%)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                fontSize: 13,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(255, 77, 0, 0.32)',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.15s ease',
              }}
            >
              {loading ? 'Memverifikasi...' : 'Mulai Pengisian (Sesi 30 Menit)'}
              {!loading && <ArrowRight size={15} />}
            </button>
          </form>

          <div style={{ textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
              🔒 Dilindungi Enkripsi AES-256-GCM Sesuai UU Perlindungan Data Pribadi
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Jika One-Time Token Aktif: Tampilkan Banner Sesi + Render Form Kuesioner
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Banner Sesi 30 Menit yang Menempel di Atas Kuesioner */}
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
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 10px',
              borderRadius: 999,
              background: 'rgba(0,184,148,0.12)',
              color: '#00806a',
              fontWeight: 700,
              fontSize: 11,
            }}
          >
            <CheckCircle2 size={13} /> Sesi Responden Terverifikasi
          </span>
          <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>
            {session.identity.nama} (NIK: {session.identity.nikKaryawan || session.identity.nationalId})
          </span>
          <span style={{ color: 'var(--muted-foreground)' }}>• {session.identity.site}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 10px',
              borderRadius: 999,
              background: remainingMinutes <= 5 ? 'rgba(255, 59, 48, 0.12)' : 'rgba(255, 149, 0, 0.12)',
              color: remainingMinutes <= 5 ? '#FF3B30' : '#FF9500',
              fontWeight: 700,
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
              borderRadius: 999,
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
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
