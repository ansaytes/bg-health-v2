'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  id: string;
  user_id: string;
  username: string;
  full_name: string | null;
  role: string;
  national_id: string | null;
  created_at: string;
  updated_at: string;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

const ROLE_STYLES: Record<string, { bg: string; color: string }> = {
  superuser: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
  administrator: { bg: 'rgba(255,77,0,0.12)', color: '#ff4d00' },
  viewer: { bg: 'var(--muted)', color: 'var(--muted-foreground)' },
};

export default function UserManagement() {
  const { isSuperuser, isAdmin } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Register form state
  const [showRegister, setShowRegister] = useState(false);
  const [regForm, setRegForm] = useState({
    username: '', password: '', full_name: '', role: 'viewer' as string, national_id: '',
  });
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const headers = await getAuthHeaders();
      const res = await fetch('/api/users', { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal memuat pengguna');
        return;
      }
      setUsers(data.users || []);
    } catch {
      setError('Gagal terhubung ke server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) fetchUsers(); }, [isAdmin, fetchUsers]);

  const handleRoleChange = async (profileId: string, newRole: string) => {
    if (!isSuperuser) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/users', {
        method: 'PATCH', headers,
        body: JSON.stringify({ id: profileId, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Gagal mengubah role'); return; }
      setUsers((prev) => prev.map((u) => (u.id === profileId ? { ...u, role: newRole } : u)));
    } catch { alert('Gagal terhubung ke server'); }
  };

  const handleDelete = async (profileId: string, username: string) => {
    if (!isSuperuser) return;
    if (!confirm(`Hapus pengguna "${username}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/users?id=${profileId}`, { method: 'DELETE', headers });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Gagal menghapus pengguna'); return; }
      setUsers((prev) => prev.filter((u) => u.id !== profileId));
    } catch { alert('Gagal terhubung ke server'); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(''); setRegSuccess('');
    if (!regForm.username || !regForm.password || !regForm.role) {
      setRegError('Username, password, dan role wajib diisi'); return;
    }
    try {
      setRegLoading(true);
      const headers = await getAuthHeaders();
      const res = await fetch('/api/auth', {
        method: 'POST', headers,
        body: JSON.stringify({ action: 'register', ...regForm }),
      });
      const data = await res.json();
      if (!res.ok) { setRegError(data.error || 'Gagal mendaftarkan pengguna'); return; }
      setRegSuccess('Pengguna berhasil didaftarkan!');
      setRegForm({ username: '', password: '', full_name: '', role: 'viewer', national_id: '' });
      fetchUsers();
    } catch { setRegError('Gagal terhubung ke server'); } finally { setRegLoading(false); }
  };

  if (!isAdmin) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, margin: '0 auto 12px',
          background: 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>Akses Ditolak</p>
        <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Anda memerlukan akses administrator untuk mengelola pengguna.</p>
      </div>
    );
  }

  return (
    <div className="admin-form-inner">
      {/* Header */}
      <div style={{ marginBottom: 16, flexShrink: 0 }}>
        <h1 className="admin-form-title">Kelola Pengguna</h1>
        <p className="admin-form-subtitle">Kelola akun dan akses pengguna sistem BG-Health</p>
      </div>

      {/* Add user button */}
      {isSuperuser && (
        <div style={{ flexShrink: 0, marginBottom: 12 }}>
          <button
            onClick={() => { setShowRegister(!showRegister); setRegError(''); setRegSuccess(''); }}
            className={`admin-form-btn-${showRegister ? 'secondary' : 'primary'}`}
            style={{
              flex: 'unset',
              width: 'auto',
              padding: '0 18px',
              height: 38,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {showRegister ? (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            )}
            {showRegister ? 'Tutup Form' : 'Tambah Pengguna'}
          </button>
        </div>
      )}

      {/* Register Form */}
      {isSuperuser && showRegister && (
        <div className="admin-form-card" style={{ marginBottom: 16, flexShrink: 0 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 14px' }}>Daftarkan Pengguna Baru</h3>
          <form onSubmit={handleRegister} className="user-register-grid">
            <div>
              <label className="admin-label">Username (Email)</label>
              <input
                type="text" value={regForm.username}
                onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                placeholder="user@perusahaan.com" className="admin-input"
              />
            </div>
            <div>
              <label className="admin-label">Password</label>
              <input
                type="password" value={regForm.password}
                onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                placeholder="Min. 6 karakter" className="admin-input"
              />
            </div>
            <div>
              <label className="admin-label">Nama Lengkap</label>
              <input
                type="text" value={regForm.full_name}
                onChange={(e) => setRegForm({ ...regForm, full_name: e.target.value })}
                placeholder="Nama lengkap" className="admin-input"
              />
            </div>
            <div>
              <label className="admin-label">Role</label>
              <select
                value={regForm.role}
                onChange={(e) => setRegForm({ ...regForm, role: e.target.value })}
                className="admin-input" style={{ appearance: 'none', cursor: 'pointer' }}
              >
                <option value="viewer">Viewer</option>
                <option value="administrator">Administrator</option>
                <option value="superuser">Superuser</option>
              </select>
            </div>
            <div>
              <label className="admin-label">NIK (National ID)</label>
              <input
                type="text" value={regForm.national_id}
                onChange={(e) => setRegForm({ ...regForm, national_id: e.target.value })}
                placeholder="Opsional" className="admin-input"
              />
            </div>
            <div className="user-register-btn-cell">
              <button type="submit" disabled={regLoading} className="admin-form-btn-primary" style={{ width: '100%' }}>
                {regLoading ? 'Menyimpan...' : 'Daftarkan'}
              </button>
            </div>
          </form>
          {regError && <p style={{ color: '#ef4444', fontSize: 11, margin: '10px 0 0' }}>{regError}</p>}
          {regSuccess && <p style={{ color: '#16a34a', fontSize: 11, margin: '10px 0 0' }}>{regSuccess}</p>}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div style={{ padding: 20, textAlign: 'center', flexShrink: 0 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, margin: '0 auto 8px',
            background: 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>{error}</p>
          <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginBottom: 8 }}>Pastikan sesi Anda masih aktif dan coba lagi.</p>
          <button
            onClick={fetchUsers}
            className="admin-form-btn-primary"
            style={{
              flex: 'unset',
              width: 'auto',
              padding: '0 16px',
              height: 36,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
            Coba Lagi
          </button>
        </div>
      )}

      {/* Users table */}
      <div className="raw-table-container">
        <div className="raw-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Nama Lengkap</th>
                <th>Role</th>
                <th>NIK</th>
                <th>Terdaftar</th>
                {isSuperuser && <th style={{ textAlign: 'center' }}>Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isSuperuser ? 6 : 5} style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)' }}>Memuat pengguna...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={isSuperuser ? 6 : 5} style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)' }}>Belum ada pengguna terdaftar</td></tr>
              ) : (
                users.map((u) => {
                  const rs = ROLE_STYLES[u.role] || ROLE_STYLES.viewer;
                  return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500 }}>{u.username}</td>
                      <td>{u.full_name || '—'}</td>
                      <td>
                        {isSuperuser ? (
                          <select
                            value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--input)', color: 'var(--foreground)', fontSize: 10, fontWeight: 600 }}
                          >
                            <option value="viewer">Viewer</option>
                            <option value="administrator">Administrator</option>
                            <option value="superuser">Superuser</option>
                          </select>
                        ) : (
                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: rs.bg, color: rs.color }}>
                            {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                          </span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 10 }}>{u.national_id || '—'}</td>
                      <td style={{ color: 'var(--muted-foreground)', fontSize: 10 }}>{new Date(u.created_at).toLocaleDateString('id-ID')}</td>
                      {isSuperuser && (
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => handleDelete(u.id, u.username)}
                            style={{ padding: '3px 10px', borderRadius: 4, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                          >Hapus</button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

