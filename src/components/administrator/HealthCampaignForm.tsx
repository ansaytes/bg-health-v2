'use client';

import { useState } from 'react';

interface Post {
  id: string;
  caption: string;
  imageUrl: string;
  type: 'campaign';
  createdAt: string;
}

const PLACEHOLDER_POSTS: Post[] = [
  { id: '1', caption: 'Cek kesehatan rutin bulan ini telah dimulai. Jangan lupa jadwal MCU Anda!', imageUrl: '', type: 'campaign', createdAt: '2026-08-15' },
  { id: '2', caption: 'Program vaksinasi influenza untuk seluruh karyawan dan keluarga.', imageUrl: '', type: 'campaign', createdAt: '2026-08-10' },
];

export default function HealthCampaignForm() {
  const [posts, setPosts] = useState<Post[]>(PLACEHOLDER_POSTS);
  const [caption, setCaption] = useState('');
  const [gdriveLink, setGdriveLink] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!caption.trim()) return;
    const newPost: Post = {
      id: String(Date.now()),
      caption: caption.trim(),
      imageUrl: gdriveLink.trim(),
      type: 'campaign',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setPosts(prev => [newPost, ...prev]);
    setCaption('');
    setGdriveLink('');
    setShowForm(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleDelete = (id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', width: '90%', margin: '0 auto' }}>
      <div style={{ padding: '16px 0', overflowY: 'auto', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', marginBottom: 2 }}>Health Campaign</h2>
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Kelola postingan health campaign untuk halaman Home.</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{ height: 34, padding: '0 14px', borderRadius: 8, border: 'none', background: showForm ? 'var(--muted)' : 'linear-gradient(135deg, #ff4d00, #ff6b2b)', color: showForm ? 'var(--foreground)' : '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {showForm ? 'Batal' : <span>Buat Postingan</span>}
          </button>
        </div>

        {showForm && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: 'var(--shadow)' }}>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 12, borderRadius: 10, border: '2px dashed var(--border)', padding: 24, textAlign: 'center' as const, background: 'var(--background)' }}>
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 8 }}>Upload gambar ke Google Drive, lalu tempel link di bawah</p>
                <input type="url" value={gdriveLink} onChange={(e) => setGdriveLink(e.target.value)} placeholder="Tempel link Google Drive gambar..." style={{ width: '100%', height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', padding: '0 10px', fontSize: 11, color: 'var(--foreground)', outline: 'none' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>Caption</label>
                <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Tulis caption postingan..." rows={3} style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', padding: '8px 12px', fontSize: 12, color: 'var(--foreground)', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <button type="submit" disabled={!caption.trim()} style={{ width: '100%', height: 38, borderRadius: 10, border: 'none', background: !caption.trim() ? 'var(--muted)' : 'linear-gradient(135deg, #ff4d00, #ff6b2b)', color: !caption.trim() ? 'var(--muted-foreground)' : '#fff', fontSize: 13, fontWeight: 600, cursor: !caption.trim() ? 'not-allowed' : 'pointer' }}>
                {saved ? 'Tersimpan!' : 'Publikasikan'}
              </button>
            </form>
          </div>
        )}

        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--fg-dim)' }}>
            <p style={{ fontSize: 12 }}>Belum ada postingan health campaign.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
            {posts.map(post => (
              <div key={post.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
                {post.imageUrl && (
                  <div style={{ height: 160, background: 'linear-gradient(135deg, rgba(255,77,0,.15), rgba(255,77,0,.05))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                )}
                <div style={{ padding: 12 }}>
                  <p style={{ fontSize: 12, color: 'var(--foreground)', lineHeight: 1.5, marginBottom: 8 }}>{post.caption}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 9, color: 'var(--muted-foreground)' }}>{post.createdAt}</span>
                    <button onClick={() => handleDelete(post.id)} style={{ fontSize: 9, color: '#FF4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Hapus</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
