'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  content: string | null;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

/* Get auth token for API calls */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

interface FormState {
  title: string;
  description: string;
  image_url: string;
  content: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

const emptyForm: FormState = {
  title: '',
  description: '',
  image_url: '',
  content: '',
  start_date: '',
  end_date: '',
  is_active: true,
};

export default function HealthCampaignForm() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health-campaigns');
      if (res.ok) {
        const json = await res.json();
        setCampaigns(json.campaigns || []);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);

    try {
      const headers = await getAuthHeaders();
      const body = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        image_url: form.image_url.trim() || null,
        content: form.content.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        is_active: form.is_active,
      };

      let res: Response;
      if (editingId) {
        // Update existing
        res = await fetch('/api/health-campaigns', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ id: editingId, ...body }),
        });
      } else {
        // Create new
        res = await fetch('/api/health-campaigns', {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
      }

      const json = await res.json();
      if (res.ok) {
        setForm(emptyForm);
        setEditingId(null);
        setShowForm(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        fetchCampaigns();
      }
    } catch {
      // error
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (campaign: Campaign) => {
    setEditingId(campaign.id);
    setForm({
      title: campaign.title,
      description: campaign.description || '',
      image_url: campaign.image_url || '',
      content: campaign.content || '',
      start_date: campaign.start_date || '',
      end_date: campaign.end_date || '',
      is_active: campaign.is_active,
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/health-campaigns?id=${deleteTarget.id}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        setDeleteTarget(null);
        fetchCampaigns();
      }
    } catch {
      // error
    } finally {
      setDeleting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 34,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--card)',
    padding: '0 10px',
    fontSize: 12,
    color: 'var(--foreground)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--foreground)',
    marginBottom: 4,
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
            onClick={() => { if (showForm) cancelForm(); else setShowForm(true); }}
            style={{ height: 34, padding: '0 14px', borderRadius: 8, border: 'none', background: showForm ? 'var(--muted)' : 'linear-gradient(135deg, #ff4d00, #ff6b2b)', color: showForm ? 'var(--foreground)' : '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {showForm ? 'Batal' : <span>Buat Postingan</span>}
          </button>
        </div>

        {showForm && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: 'var(--shadow)' }}>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Judul Campaign *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Masukkan judul campaign..."
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Deskripsi</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Tulis deskripsi singkat..."
                  rows={3}
                  style={{ ...inputStyle, height: 'auto', padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ marginBottom: 12, borderRadius: 10, border: '2px dashed var(--border)', padding: 24, textAlign: 'center' as const, background: 'var(--background)' }}>
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 8 }}>Upload gambar ke Google Drive, lalu tempel link di bawah</p>
                <input
                  type="url"
                  value={form.image_url}
                  onChange={e => setForm(p => ({ ...p, image_url: e.target.value }))}
                  placeholder="Tempel link gambar (Google Drive, dll)..."
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Konten Lengkap (opsional)</label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  placeholder="Konten lengkap campaign..."
                  rows={4}
                  style={{ ...inputStyle, height: 'auto', padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Tanggal Mulai</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Tanggal Selesai</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)' }}>Status Aktif</label>
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                  style={{
                    width: 40, height: 22, borderRadius: 11, border: 'none',
                    background: form.is_active ? '#00B894' : 'var(--muted)',
                    position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 3, left: form.is_active ? 21 : 3,
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </button>
                <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{form.is_active ? 'Aktif' : 'Tidak aktif'}</span>
              </div>

              <button
                type="submit"
                disabled={!form.title.trim() || saving}
                style={{ width: '100%', height: 38, borderRadius: 10, border: 'none', background: (!form.title.trim() || saving) ? 'var(--muted)' : 'linear-gradient(135deg, #ff4d00, #ff6b2b)', color: (!form.title.trim() || saving) ? 'var(--muted-foreground)' : '#fff', fontSize: 13, fontWeight: 600, cursor: (!form.title.trim() || saving) ? 'not-allowed' : 'pointer' }}
              >
                {saving ? 'Menyimpan...' : saved ? 'Tersimpan!' : editingId ? 'Perbarui Campaign' : 'Publikasikan'}
              </button>
            </form>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--fg-dim)', fontSize: 12 }}>Memuat campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--fg-dim)' }}>
            <p style={{ fontSize: 12 }}>Belum ada postingan health campaign.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
            {campaigns.map(campaign => (
              <div key={campaign.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
                {campaign.image_url && (
                  <div style={{ height: 120, overflow: 'hidden' }}>
                    <img src={campaign.image_url} alt={campaign.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                {!campaign.image_url && (
                  <div style={{ height: 80, background: 'linear-gradient(135deg, rgba(255,77,0,.15), rgba(255,77,0,.05))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                    </svg>
                  </div>
                )}
                <div style={{ padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: 0, lineHeight: 1.3 }}>{campaign.title}</h4>
                    <span style={{
                      fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 10, flexShrink: 0,
                      background: campaign.is_active ? 'rgba(0,184,148,0.12)' : 'var(--muted)',
                      color: campaign.is_active ? '#00B894' : 'var(--muted-foreground)',
                    }}>
                      {campaign.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  {campaign.description && (
                    <p style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.5, marginBottom: 8, margin: '0 0 8px 0' }}>{campaign.description}</p>
                  )}
                  {campaign.start_date && (
                    <p style={{ fontSize: 9, color: 'var(--muted-foreground)', marginBottom: 8, margin: '0 0 8px 0' }}>
                      {campaign.start_date}{campaign.end_date ? ` — ${campaign.end_date}` : ''}
                    </p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 9, color: 'var(--muted-foreground)' }}>{new Date(campaign.created_at).toLocaleDateString('id-ID')}</span>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={() => openEdit(campaign)}
                        style={{ fontSize: 9, color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}
                      >
                        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" />
                        </svg>
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(campaign)}
                        style={{ fontSize: 9, color: '#FF4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}
                      >
                        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus campaign <strong>"{deleteTarget?.title}"</strong>? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              style={{ background: '#FF4444', color: '#fff' }}
            >
              {deleting ? 'Menghapus...' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
