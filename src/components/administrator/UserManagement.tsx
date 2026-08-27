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

function getAccessToken(): string | null {
 if (typeof window === 'undefined') return null;
 const meta = document.querySelector('meta[name="sb-token"]');
 if (meta?.getAttribute('content')) return meta.getAttribute('content');
 // Try to get from supabase session
 return null;
}

async function getAuthHeaders(): Promise<HeadersInit> {
 const { data: { session } } = await supabase.auth.getSession();
 return {
   'Content-Type': 'application/json',
   ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
 };
}

export default function UserManagement() {
 const { isSuperuser, isAdmin } = useAuth();
 const [users, setUsers] = useState<UserProfile[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');

 // Register form state
 const [showRegister, setShowRegister] = useState(false);
 const [regForm, setRegForm] = useState({
   username: '',
   password: '',
   full_name: '',
   role: 'viewer' as string,
   national_id: '',
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

 useEffect(() => {
   if (isAdmin) fetchUsers();
 }, [isAdmin, fetchUsers]);

 const handleRoleChange = async (profileId: string, newRole: string) => {
   if (!isSuperuser) return;
   try {
     const headers = await getAuthHeaders();
     const res = await fetch('/api/users', {
       method: 'PATCH',
       headers,
       body: JSON.stringify({ id: profileId, role: newRole }),
     });
     const data = await res.json();
     if (!res.ok) {
       alert(data.error || 'Gagal mengubah role');
       return;
     }
     setUsers((prev) => prev.map((u) => (u.id === profileId ? { ...u, role: newRole } : u)));
   } catch {
     alert('Gagal terhubung ke server');
   }
 };

 const handleDelete = async (profileId: string, username: string) => {
   if (!isSuperuser) return;
   if (!confirm(`Hapus pengguna "${username}"? Tindakan ini tidak dapat dibatalkan.`)) return;
   try {
     const headers = await getAuthHeaders();
     const res = await fetch(`/api/users?id=${profileId}`, {
       method: 'DELETE',
       headers,
     });
     const data = await res.json();
     if (!res.ok) {
       alert(data.error || 'Gagal menghapus pengguna');
       return;
     }
     setUsers((prev) => prev.filter((u) => u.id !== profileId));
   } catch {
     alert('Gagal terhubung ke server');
   }
 };

 const handleRegister = async (e: React.FormEvent) => {
   e.preventDefault();
   setRegError('');
   setRegSuccess('');

   if (!regForm.username || !regForm.password || !regForm.role) {
     setRegError('Username, password, dan role wajib diisi');
     return;
   }

   try {
     setRegLoading(true);
     const headers = await getAuthHeaders();
     const res = await fetch('/api/auth', {
       method: 'POST',
       headers,
       body: JSON.stringify({ action: 'register', ...regForm }),
     });
     const data = await res.json();
     if (!res.ok) {
       setRegError(data.error || 'Gagal mendaftarkan pengguna');
       return;
     }
     setRegSuccess('Pengguna berhasil didaftarkan!');
     setRegForm({ username: '', password: '', full_name: '', role: 'viewer', national_id: '' });
     fetchUsers();
   } catch {
     setRegError('Gagal terhubung ke server');
   } finally {
     setRegLoading(false);
   }
 };

 if (!isAdmin) {
   return (
     <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)' }}>
       Akses ditolak
     </div>
   );
   }

 return (
     <div className="admin-form-container" style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>
       {/* Header */}
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
         <div>
           <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Kelola Pengguna</h2>
           <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '4px 0 0' }}>
             {users.length} pengguna terdaftar
           </p>
         </div>
         {isSuperuser && (
           <button
             onClick={() => setShowRegister(!showRegister)}
             style={{
               padding: '8px 16px',
               borderRadius: 8,
               border: '1px solid var(--border)',
               background: 'var(--primary)',
               color: 'var(--primary-foreground)',
               fontSize: 12,
               fontWeight: 600,
               cursor: 'pointer',
             }}
           >
             {showRegister ? 'Tutup Form' : '+ Tambah Pengguna'}
           </button>
         )}
       </div>

       {/* Register Form (superuser only) */}
       {isSuperuser && showRegister && (
         <div style={{
           flexShrink: 0,
           padding: 16,
           borderRadius: 10,
           border: '1px solid var(--border)',
           background: 'var(--card)',
         }}>
           <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', margin: '0 0 12px' }}>Daftarkan Pengguna Baru</h3>
           <form onSubmit={handleRegister} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
             <div style={{ flex: '1 1 140px', minWidth: 120 }}>
               <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>Username (Email)</label>
               <input
                 type="text"
                 value={regForm.username}
                 onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                 placeholder="user@perusahaan.com"
                 style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input)', color: 'var(--foreground)', fontSize: 12 }}
               />
             </div>
             <div style={{ flex: '1 1 120px', minWidth: 100 }}>
               <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>Password</label>
               <input
                 type="password"
                 value={regForm.password}
                 onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                 placeholder="Min. 6 karakter"
                 style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input)', color: 'var(--foreground)', fontSize: 12 }}
               />
             </div>
             <div style={{ flex: '1 1 140px', minWidth: 120 }}>
               <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>Nama Lengkap</label>
               <input
                 type="text"
                 value={regForm.full_name}
                 onChange={(e) => setRegForm({ ...regForm, full_name: e.target.value })}
                 placeholder="Nama lengkap"
                 style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input)', color: 'var(--foreground)', fontSize: 12 }}
               />
             </div>
             <div style={{ flex: '0 0 110px', minWidth: 100 }}>
               <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>Role</label>
               <select
                 value={regForm.role}
                 onChange={(e) => setRegForm({ ...regForm, role: e.target.value })}
                 style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input)', color: 'var(--foreground)', fontSize: 12 }}
               >
                 <option value="viewer">Viewer</option>
                 <option value="administrator">Administrator</option>
                 <option value="superuser">Superuser</option>
               </select>
             </div>
             <div style={{ flex: '1 1 120px', minWidth: 100 }}>
               <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>NIK</label>
               <input
                 type="text"
                 value={regForm.national_id}
                 onChange={(e) => setRegForm({ ...regForm, national_id: e.target.value })}
                 placeholder="Nomor Induk Karyawan"
                 style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input)', color: 'var(--foreground)', fontSize: 12 }}
               />
             </div>
             <button
               type="submit"
               disabled={regLoading}
               style={{
                 flexShrink: 0,
                 padding: '7px 20px',
                 borderRadius: 6,
                 border: 'none',
                 background: regLoading ? 'var(--muted-foreground)' : 'var(--primary)',
                 color: 'var(--primary-foreground)',
                 fontSize: 12,
                 fontWeight: 600,
                 cursor: regLoading ? 'not-allowed' : 'pointer',
               }}
             >
               {regLoading ? 'Menyimpan...' : 'Daftarkan'}
             </button>
           </form>
           {regError && <p style={{ color: 'var(--destructive)', fontSize: 11, margin: '8px 0 0' }}>{regError}</p>}
           {regSuccess && <p style={{ color: 'var(--green-600, #16a34a)', fontSize: 11, margin: '8px 0 0' }}>{regSuccess}</p>}
         </div>
       )}

       {/* Error state */}
       {error && !loading && (
         <div style={{ padding: 20, textAlign: 'center', color: 'var(--destructive)' }}>
           <p>{error}</p>
           <button onClick={fetchUsers} style={{ marginTop: 8, fontSize: 12, color: 'var(--primary)', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}>
             Coba lagi
           </button>
         </div>
       )}

       {/* Users table */}
       <div style={{ flex: 1, minHeight: 0, overflow: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
         {loading ? (
           <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>Memuat pengguna...</div>
         ) : (
           <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
             <thead>
               <tr style={{ background: 'var(--muted)', position: 'sticky', top: 0 }}>
                 <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--foreground)', borderBottom: '1px solid var(--border)' }}>Username</th>
                 <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--foreground)', borderBottom: '1px solid var(--border)' }}>Nama Lengkap</th>
                 <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--foreground)', borderBottom: '1px solid var(--border)' }}>Role</th>
                 <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--foreground)', borderBottom: '1px solid var(--border)' }}>NIK</th>
                 {isSuperuser && <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--foreground)', borderBottom: '1px solid var(--border)' }}>Aksi</th>}
               </tr>
             </thead>
             <tbody>
               {users.length === 0 ? (
                 <tr>
                   <td colSpan={isSuperuser ? 5 : 4} style={{ padding: 30, textAlign: 'center', color: 'var(--muted-foreground)' }}>
                     Belum ada pengguna
                   </td>
                 </tr>
               ) : (
                 users.map((u) => (
                   <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                     <td style={{ padding: '10px 12px', color: 'var(--foreground)' }}>{u.username}</td>
                     <td style={{ padding: '10px 12px', color: 'var(--foreground)' }}>{u.full_name || '—'}</td>
                     <td style={{ padding: '10px 12px' }}>
                       {isSuperuser ? (
                         <select
                           value={u.role}
                           onChange={(e) => handleRoleChange(u.id, e.target.value)}
                           style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--input)', color: 'var(--foreground)', fontSize: 11 }}
                         >
                           <option value="viewer">Viewer</option>
                           <option value="administrator">Administrator</option>
                           <option value="superuser">Superuser</option>
                         </select>
                       ) : (
                         <span style={{
                           padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                           background: u.role === 'superuser' ? 'var(--destructive, #ef4444)' : u.role === 'administrator' ? 'var(--primary)' : 'var(--muted)',
                           color: u.role === 'viewer' ? 'var(--foreground)' : 'var(--primary-foreground)',
                         }}>
                           {u.role}
                         </span>
                       )}
                     </td>
                     <td style={{ padding: '10px 12px', color: 'var(--foreground)' }}>{u.national_id || '—'}</td>
                     {isSuperuser && (
                       <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                         <button
                           onClick={() => handleDelete(u.id, u.username)}
                           style={{
                             padding: '4px 10px', borderRadius: 4, border: '1px solid var(--destructive, #ef4444)',
                             background: 'transparent', color: 'var(--destructive, #ef4444)', fontSize: 11, cursor: 'pointer',
                           }}
                         >
                           Hapus
                         </button>
                       </td>
                     )}
                   </tr>
                 ))
               )}
             </tbody>
           </table>
         )}
       </div>
     </div>
   );
}