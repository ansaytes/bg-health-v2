'use client';

import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

interface Approval {
  id: number;
  email: string;
  full_name: string | null;
  nik: string | null;
  jabatan: string | null;
  jobsite: string | null;
  created_at: string;
}

export default function NotificationBell({ isSuperuser }: { isSuperuser: boolean }) {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchApprovals = async () => {
    if (!isSuperuser) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/notifications', {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const json = await res.json();
      if (json.notifications) setApprovals(json.notifications);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperuser) fetchApprovals();
  }, [isSuperuser]);

  // Poll every 30 seconds
  useEffect(() => {
    if (!isSuperuser) return;
    const interval = setInterval(fetchApprovals, 30000);
    return () => clearInterval(interval);
  }, [isSuperuser]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleApprove = async (id: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ id, action: 'approve' }),
      });
      const json = await res.json();
      if (json.success) {
        setApprovals(prev => prev.filter(a => a.id !== id));
      } else {
        alert(json.error || 'Gagal menyetujui');
      }
    } catch {
      alert('Gagal terhubung ke server');
    }
  };

  const handleReject = async (id: number) => {
    if (!confirm('Tolak pendaftaran ini?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ id, action: 'reject' }),
      });
      const json = await res.json();
      if (json.success) {
        setApprovals(prev => prev.filter(a => a.id !== id));
      } else {
        alert(json.error || 'Gagal menolak');
      }
    } catch {
      alert('Gagal terhubung ke server');
    }
  };

  if (!isSuperuser) return null;

  const count = approvals.length;

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(!open); if (!open) fetchApprovals(); }}
        style={{
          width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--card)', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center', position: 'relative',
          flexShrink: 0, transition: 'all 0.2s',
        }}
        aria-label="Notifikasi"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 16, height: 16, borderRadius: 8,
            background: '#ff4d00', color: '#fff',
            fontSize: 9, fontWeight: 700, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', border: '2px solid var(--card)',
          }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute', top: 38, right: 0,
              width: 340, maxWidth: '90vw',
              background: 'solid var(--card)',
              backgroundColor: '#ffffff',
              border: '1px solid #E0E0E0',
              borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.20)',
              zIndex: 200, overflow: 'hidden',
            }}
            className="notification-dropdown"
          >
            <div style={{
              padding: '12px 16px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
                Notifikasi
              </span>
              {count > 0 && (
                <span style={{ fontSize: 10, color: '#ff4d00', fontWeight: 600 }}>
                  {count} pending
                </span>
              )}
            </div>

            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
                  Memuat...
                </div>
              ) : count === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
                  Tidak ada notifikasi
                </div>
              ) : (
                approvals.map((a) => (
                  <div key={a.id} style={{
                    padding: '12px 16px', borderBottom: '1px solid var(--border)',
                    display: 'flex', flexDirection: 'column', gap: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: 'rgba(255,77,0,0.10)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ff4d00" strokeWidth="2" strokeLinecap="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.full_name || a.email}
                        </p>
                        <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: 0 }}>
                          NIK: {a.nik} {a.jabatan ? `· ${a.jabatan}` : ''} {a.jobsite ? `· ${a.jobsite}` : ''}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                      <button
                        onClick={() => handleApprove(a.id)}
                        style={{
                          flex: 1, height: 28, borderRadius: 7, border: 'none',
                          background: '#00B894', color: '#fff', fontSize: 11,
                          fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        Setujui
                      </button>
                      <button
                        onClick={() => handleReject(a.id)}
                        style={{
                          height: 28, padding: '0 12px', borderRadius: 7,
                          border: '1px solid var(--border)', background: 'transparent',
                          color: 'var(--muted-foreground)', fontSize: 11, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        Tolak
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
