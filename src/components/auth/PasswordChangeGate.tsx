'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

export default function PasswordChangeGate({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const mustChangePassword = user?.app_metadata?.must_change_password === true;

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password baru minimal 8 karakter.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak sama.');
      return;
    }
    if (!session?.access_token) {
      setError('Sesi login tidak ditemukan. Silakan masuk kembali.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'change-password', newPassword: password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Gagal mengganti password.');

      const { data, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || data.session?.user.app_metadata?.must_change_password === true) {
        await supabase.auth.signOut();
        window.location.assign('/?login=1');
        return;
      }
      setPassword('');
      setConfirmPassword('');
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : 'Gagal mengganti password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {children}
      {mustChangePassword && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="employee-password-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'grid',
            placeItems: 'center',
            padding: 20,
            background: 'rgba(0,0,0,.62)',
          }}
        >
          <form
            onSubmit={changePassword}
            style={{
              width: 'min(100%, 420px)',
              display: 'grid',
              gap: 14,
              padding: 24,
              border: '1px solid var(--border)',
              borderRadius: 14,
              background: 'var(--background)',
              color: 'var(--foreground)',
              boxShadow: '0 18px 55px rgba(0,0,0,.24)',
            }}
          >
            <div>
              <h2 id="employee-password-title" style={{ margin: '0 0 6px', fontSize: 19 }}>Ganti Password Awal</h2>
              <p style={{ margin: 0, color: 'var(--muted-foreground)', fontSize: 13, lineHeight: 1.5 }}>
                Untuk melindungi akun dan hasil kuesioner, buat password pribadi sebelum melanjutkan.
              </p>
            </div>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              Password baru
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={event => setPassword(event.target.value)}
                style={{ minHeight: 40, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--background)', color: 'var(--foreground)' }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              Ulangi password baru
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                style={{ minHeight: 40, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--background)', color: 'var(--foreground)' }}
              />
            </label>
            {error && <p role="alert" style={{ margin: 0, color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <button
              type="submit"
              disabled={saving}
              style={{ minHeight: 42, border: 0, borderRadius: 8, background: '#ff4d00', color: '#fff', fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}
            >
              {saving ? 'Menyimpan...' : 'Simpan Password'}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
