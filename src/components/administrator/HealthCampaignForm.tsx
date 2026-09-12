'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

export default function HealthCampaignForm() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form fields — simple social media style
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health-campaigns');
      if (res.ok) {
        const json = await res.json();
        setCampaigns(json.campaigns || []);
      }
    } catch {
      // error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setImageUrl('');
    setIsActive(true);
    setEditingId(null);
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setErrorMsg('');

    try {
      const headers = await getAuthHeaders();
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        image_url: imageUrl.trim() || null,
        is_active: isActive,
      };

      let res: Response;
      if (editingId) {
        res = await fetch('/api/health-campaigns', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ id: editingId, ...body }),
        });
      } else {
        res = await fetch('/api/health-campaigns', {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
      }

      const json = await res.json();
      if (res.ok) {
        resetForm();
        setShowForm(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        fetchCampaigns();
      } else {
        setErrorMsg(json.error || 'Gagal menyimpan');
      }
    } catch {
      setErrorMsg('Gagal terhubung ke server');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (c: Campaign) => {
    setEditingId(c.id);
    setTitle(c.title);
    setDescription(c.description || '');
    setImageUrl(c.image_url || '');
    setIsActive(c.is_active);
    setShowForm(true);
    setErrorMsg('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus postingan ini?')) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/health-campaigns?id=${id}`, { method: 'DELETE', headers });
      if (res.ok) fetchCampaigns();
    } catch {
      // error
    }
  };

  const fmtDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch { return dateStr; }
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div className="loading-spinner"><img src="/BM.png" alt="Loading" /></div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto', paddingBottom: 60 }}>
      <div className="admin-form-inner">
        {/* Header */}
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="admin-form-title">Health Campaign</h1>
            <p className="admin-form-subtitle">Posting konten kampanye kesehatan — tampil di Home page</p>
          </div>
          <button
            onClick={() => { if (showForm) { resetForm(); setShowForm(false); } else { resetForm(); setShowForm(true); } }}
            className={`admin-form-btn-${showForm ? 'secondary' : 'primary'}`}
            style={{ flex: 'unset', width: 'auto', padding: '0 16px', height: 36, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {showForm ? (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            )}
            {showForm ? 'Tutup' : 'Buat Postingan'}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="admin-form-card" style={{ marginBottom: 16 }}>
            {errorMsg && <p className="login-error-msg" style={{ marginBottom: 10 }}>{errorMsg}</p>}
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label className="admin-label">Judul <span style={{ color: 'var(--brand-primary)' }}>*</span></label>
                <input type="text" className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul postingan" required />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label className="admin-label">Deskripsi</label>
                <textarea className="admin-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tulis deskripsi postingan..." rows={4} style={{ height: 'auto', padding: '10px 12px', resize: 'vertical', lineHeight: 1.5 }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label className="admin-label">URL Gambar (Google Drive / link langsung)</label>
                <input type="text" className="admin-input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://drive.google.com/... atau https://..." />
                {imageUrl && (
                  <div style={{ marginTop: 8, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--muted)', maxWidth: 400, aspectRatio: '4 / 3', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={(e) => { const img = e.target as HTMLImageElement; img.style.display = 'none'; const parent = img.parentElement; if (parent) parent.innerHTML = '<div style=\"text-align:center;color:var(--muted-foreground);font-size:11px;padding:20px\">Gambar gagal dimuat. Periksa URL atau pastikan akses publik.</div>'; }} />
                  </div>
                )}
              </div>
              <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <label className="admin-label" style={{ margin: 0 }}>Aktif?</label>
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={saving} className={`admin-form-btn-primary${saved ? ' saved' : ''}`}>
                  {saving ? 'Menyimpan...' : saved ? 'Tersimpan!' : editingId ? 'Update' : 'Posting'}
                </button>
                <button type="button" onClick={resetForm} className="admin-form-btn-secondary">
                  Reset
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Campaign List */}
        {campaigns.length === 0 ? (
          <div className="admin-form-card" style={{ textAlign: 'center', padding: 40, color: 'var(--muted-foreground)', fontSize: 12 }}>
            Belum ada postingan. Klik "Buat Postingan" untuk membuat.
          </div>
        ) : (
          campaigns.map((c) => (
            <div key={c.id} className="admin-form-card" style={{ marginBottom: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                {c.image_url && (
                  <div style={{ width: 60, height: 60, borderRadius: 8, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 4px' }}>{c.title}</p>
                  {c.description && <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '0 0 4px', lineHeight: 1.4 }}>{c.description}</p>}
                  <p style={{ fontSize: 9, color: 'var(--fg-dim)', margin: 0 }}>{fmtDate(c.created_at)} · {c.is_active ? 'Aktif' : 'Nonaktif'}</p>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => openEdit(c)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </button>
                  <button onClick={() => handleDelete(c.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#FF4444" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
