'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { JENIS_META, PRIORITAS_WARNA, type JenisNotifikasi, type Notifikasi } from '@/lib/notifikasi-medic';

interface Approval {
  id: number;
  email: string;
  full_name: string | null;
  nik: string | null;
  jabatan: string | null;
  jobsite: string | null;
  created_at: string;
}

/**
 * Bell notifikasi — dua sumber:
 *  1. Pendaftaran akun menunggu persetujuan (superuser saja).
 *  2. Tindak lanjut QSHE Medic: kontrol ProKawan, MCU expired, surat
 *     kelayakan, batas waktu PAK, jadwal pemantauan karyawan sakit.
 *
 * Notifikasi Medic dihitung ON-DEMAND di server (bukan cron), sehingga selalu
 * akurat tanpa proses latar belakang. Isinya sengaja hanya NAMA + JENIS
 * TINDAKAN — tanpa diagnosis/nilai lab (INK/016 4.7.3e, UU 27/2022).
 *
 * PENGELOMPOKAN & NAVIGASI
 *  • Dikelompokkan per kategori (jenis notifikasi) agar daftar panjang tetap
 *    terbaca, dengan hitungan di setiap judul kelompok.
 *  • Seluruh daftar berada dalam SATU area scroll sehingga semua notifikasi
 *    dapat dibaca tanpa terpotong.
 *  • Klik notifikasi membawa ke halaman terkait. Server sudah menyaring
 *    notifikasi sesuai role, sehingga notifikasi ke halaman yang tidak boleh
 *    dibuka tidak pernah dikirim.
 */
export default function NotificationBell({ isSuperuser, canMedic = false }: {
  isSuperuser: boolean;
  canMedic?: boolean;
}) {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [medic, setMedic] = useState<Notifikasi[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const canViewApprovals = isSuperuser;
  const canView = canViewApprovals || canMedic;

  const fetchApprovals = async () => {
    if (!canViewApprovals) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/notifications', {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const json = await res.json();
      if (json.notifications) setApprovals(json.notifications);
    } catch {
      // silent fail
    }
  };

  const fetchMedic = async () => {
    if (!canMedic) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/notifikasi', {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) return;
      const json = await res.json();
      if (Array.isArray(json.daftar)) setMedic(json.daftar as Notifikasi[]);
    } catch {
      // silent fail
    }
  };

  const fetchSemua = async () => {
    if (!canView) return;
    setLoading(true);
    try {
      await Promise.all([fetchApprovals(), fetchMedic()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) void fetchSemua();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, canMedic]);

  // Poll 30 detik — server menyimpan cache 5 menit, jadi ini ringan.
  useEffect(() => {
    if (!canView) return;
    const interval = setInterval(() => { void fetchSemua(); }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, canMedic]);

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

  // Kelompokkan per kategori. Urutan kategori mengikuti urutan JENIS_META
  // sehingga konsisten; di dalam kelompok, urutan dari server (kritis dulu).
  const grup = useMemo(() => {
    const map = new Map<JenisNotifikasi, Notifikasi[]>();
    for (const n of medic) {
      const list = map.get(n.jenis) ?? [];
      list.push(n);
      map.set(n.jenis, list);
    }
    return [...map.entries()];
  }, [medic]);

  if (!canView) return null;

  const count = approvals.length + medic.length;
  const totalKritis = medic.filter((m) => m.prioritas === 'kritis').length;

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(!open); if (!open) void fetchSemua(); }}
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
            // Merah bila ada yang KRITIS (mis. PAK lewat batas), oranye biasa.
            background: totalKritis > 0 ? '#FF2D2D' : '#ff4d00', color: '#fff',
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
              width: 380, maxWidth: '92vw',
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.20)',
              zIndex: 200,
              // flex column: header tetap, daftar bisa discroll.
              display: 'flex', flexDirection: 'column',
              maxHeight: 'min(560px, 78vh)',
            }}
            className="notification-dropdown"
          >
            {/* Header tetap */}
            <div style={{
              padding: '12px 16px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
                Notifikasi
              </span>
              {count > 0 && (
                <span style={{ fontSize: 10, color: totalKritis > 0 ? '#FF2D2D' : '#ff4d00', fontWeight: 600 }}>
                  {count} tindak lanjut{totalKritis > 0 ? ` · ${totalKritis} kritis` : ''}
                </span>
              )}
            </div>

            {/* SATU area scroll untuk SEMUA isi — header kelompok ikut di dalam
                agar tidak memakan ruang dan semua notifikasi terbaca. */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {loading ? (
                <div className="bm-loading is-inline" role="status" aria-live="polite" aria-label="Memuat notifikasi">
                  <div className="bm-loading-spinner">
                    <div className="bm-loading-ring" aria-hidden="true" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/BM.png" alt="" className="bm-loading-logo" aria-hidden="true" />
                  </div>
                  <p className="bm-loading-label">Memuat notifikasi…</p>
                </div>
              ) : count === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
                  Tidak ada notifikasi
                </div>
              ) : (
                <>
                  {grup.map(([jenis, items]) => (
                    <div key={jenis}>
                      <div style={{
                        position: 'sticky', top: 0, zIndex: 1,
                        padding: '6px 16px', fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                        letterSpacing: '0.05em', color: 'var(--muted-foreground)',
                        background: 'var(--muted)', borderBottom: '1px solid var(--border)',
                        display: 'flex', justifyContent: 'space-between',
                      }}>
                        <span>{JENIS_META[jenis]?.label ?? jenis}</span>
                        <span>{items.length}</span>
                      </div>
                      {items.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => {
                            setOpen(false);
                            window.location.href = n.tautan;
                          }}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                            padding: '9px 16px', borderBottom: '1px solid var(--border)',
                            borderTop: 'none', borderRight: 'none',
                            borderLeft: `3px solid ${PRIORITAS_WARNA[n.prioritas]}`,
                            background: 'transparent', fontFamily: 'inherit',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                            <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 700, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {n.judul}
                            </span>
                            {n.sisaHari !== null && (
                              <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, color: PRIORITAS_WARNA[n.prioritas] }}>
                                {n.sisaHari < 0 ? `+${Math.abs(n.sisaHari)}h` : n.sisaHari === 0 ? 'hari ini' : `H-${n.sisaHari}`}
                              </span>
                            )}
                          </div>
                          {n.subjek && (
                            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--foreground)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {n.subjek}
                            </div>
                          )}
                          <div style={{ fontSize: 9.5, color: 'var(--muted-foreground)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {n.keterangan}
                          </div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: '#ff4d00', marginTop: 2 }}>
                            {n.aksi} →
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}

                  {approvals.length > 0 && (
                    <div>
                      <div style={{
                        position: 'sticky', top: 0, zIndex: 1,
                        padding: '6px 16px', fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                        letterSpacing: '0.05em', color: 'var(--muted-foreground)',
                        background: 'var(--muted)', borderBottom: '1px solid var(--border)',
                        display: 'flex', justifyContent: 'space-between',
                      }}>
                        <span>Pendaftaran Menunggu Persetujuan</span>
                        <span>{approvals.length}</span>
                      </div>
                      {approvals.map((a) => (
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
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
