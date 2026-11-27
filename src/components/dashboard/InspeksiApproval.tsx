'use client';

// Data Entry / Dashboard > Approval Checklist Inspeksi Lapangan
// Verifikasi & Pengesahan Hasil Pemeriksaan Fasilitas Kesehatan Kerja:
//   - Kotak P3K (Permenaker 15/2008)
//   - Ambulans & Tanggap Darurat Medis Tambang
//   - Higiene Sanitasi Kantin / Jasaboga & Mess Karyawan
//   - Sarana & Prasarana Klinik Site
//   - Sarana Kerja Ergonomi & Kalibrasi Alat Medis
//
// Kewenangan: QSHE Manager, PJO, K3 Site, Superuser.
// Dilengkapi tombol verifikasi tunggal dan tombol "Setujui Semua" untuk efisiensi.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  ShieldCheck,
  Truck,
  User,
  UtensilsCrossed,
  X,
} from 'lucide-react';

import { authFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { JENIS_META, type JenisInspeksi, type BarisJadwal } from '@/lib/inspeksi-program';
import CenteredTabs from '@/components/ui/centered-tabs';
import { useSites } from '@/lib/site-list';

type TabKey = 'menunggu_persetujuan' | 'selesai' | 'ditolak';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'menunggu_persetujuan', label: 'Menunggu Persetujuan' },
  { key: 'selesai', label: 'Sudah Disetujui' },
  { key: 'ditolak', label: 'Ditolak / Evaluasi Ulang' },
];

const STATUS_TONE: Record<TabKey, { bg: string; border: string; text: string }> = {
  menunggu_persetujuan: { bg: 'rgba(255, 77, 0, 0.08)', border: 'rgba(255, 77, 0, 0.35)', text: '#FF4D00' },
  selesai: { bg: 'rgba(0, 184, 148, 0.10)', border: 'rgba(0, 184, 148, 0.35)', text: '#00795f' },
  ditolak: { bg: 'rgba(255, 45, 45, 0.08)', border: 'rgba(255, 45, 45, 0.35)', text: '#b3261e' },
};

export default function InspeksiApproval() {
  const { profile, role } = useAuth();
  const { sites: daftarSite } = useSites();

  const [tab, setTab] = useState<TabKey>('menunggu_persetujuan');
  const [selectedSite, setSelectedSite] = useState('');
  const [selectedJenis, setSelectedJenis] = useState<string>('');
  const [rows, setRows] = useState<(BarisJadwal & { status_efektif?: string; petugas_nama?: string | null })[]>([]);
  const [openId, setOpenId] = useState<string | number | null>(null);
  const [catatan, setCatatan] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | number | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);

  const canApprove = role === 'manager' || role === 'superuser';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        status: tab,
        semua_periode: '1',
      });
      if (selectedSite) qs.set('site', selectedSite);
      if (selectedJenis) qs.set('jenis', selectedJenis);

      const r = (await authFetch(`/api/inspeksi/jadwal?${qs.toString()}`)) as {
        success?: boolean;
        jadwal?: (BarisJadwal & { status_efektif?: string; petugas_nama?: string | null })[];
      };
      setRows(r.jadwal || []);
      setMsg(null);
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal memuat jadwal inspeksi' });
    } finally {
      setLoading(false);
    }
  }, [tab, selectedSite, selectedJenis]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const actSingle = async (row: BarisJadwal, action: 'approve' | 'reject') => {
    if (action === 'reject' && !catatan.trim()) {
      setMsg({ kind: 'err', text: 'Tuliskan catatan evaluasi atau alasan penolakan sebelum menolak.' });
      return;
    }
    setBusyId(row.id ?? null);
    try {
      await authFetch('/api/inspeksi/jadwal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aksi: action,
          id: row.id,
          catatan: catatan.trim() || undefined,
        }),
      });

      setMsg({
        kind: 'ok',
        text: action === 'approve'
          ? `Inspeksi "${row.objek_nama}" disetujui.`
          : `Inspeksi "${row.objek_nama}" ditolak untuk pemeriksaan ulang.`,
      });
      setCatatan('');
      setOpenId(null);
      await loadData();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal memproses aksi inspeksi' });
    } finally {
      setBusyId(null);
    }
  };

  const actApproveAll = async () => {
    if (!rows.length) return;
    setApprovingAll(true);
    try {
      const ids = rows.map((r) => r.id).filter(Boolean);
      const res = (await authFetch('/api/inspeksi/jadwal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aksi: 'approve_all',
          ids,
          site: selectedSite || undefined,
        }),
      })) as { success?: boolean; count?: number; pesan?: string };

      setMsg({
        kind: 'ok',
        text: res.pesan || `${res.count ?? ids.length} hasil inspeksi lapangan berhasil disetujui sekaligus.`,
      });
      await loadData();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menyetujui semua inspeksi' });
    } finally {
      setApprovingAll(false);
    }
  };

  const pendingCount = useMemo(() => rows.length, [rows]);

  const tabsWithCount = useMemo(() => [
    { key: 'menunggu_persetujuan' as const, label: 'Menunggu Persetujuan', count: tab === 'menunggu_persetujuan' ? rows.length : undefined },
    { key: 'selesai' as const, label: 'Sudah Disetujui', count: tab === 'selesai' ? rows.length : undefined },
    { key: 'ditolak' as const, label: 'Ditolak / Evaluasi Ulang', count: tab === 'ditolak' ? rows.length : undefined },
  ], [tab, rows.length]);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        padding: '10px 16px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* ── macOS Toolbar Header ─────────────────────────── */}
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          padding: '10px 16px',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src="/LogoBDM.png"
            alt="Logo BDM"
            width={32}
            height={32}
            style={{ height: 32, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#FF4D00',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              <h1 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--foreground)' }}>
                Approval Inspeksi Lapangan
              </h1>
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '2px 0 0', lineHeight: 1.3 }}>
              Pengesahan laporan checklist fasilitas kesehatan kerja oleh Pengawas Operasional / QSHE Manager / PJO
              {canApprove && (
                <> • Penyetuju: <b>{profile?.full_name || profile?.username || 'Pejabat Penyetuju'}</b></>
              )}
            </p>
          </div>
        </div>

        {tab === 'menunggu_persetujuan' && canApprove && pendingCount > 0 && (
          <button
            type="button"
            disabled={approvingAll || loading}
            onClick={() => void actApproveAll()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 14px',
              borderRadius: 8,
              background: '#00B894',
              color: '#fff',
              fontSize: 11.5,
              fontWeight: 700,
              border: 'none',
              cursor: approvingAll ? 'wait' : 'pointer',
              boxShadow: '0 1px 3px rgba(0,184,148,0.25)',
            }}
            title="Setujui seluruh hasil inspeksi yang telah diverifikasi kelengkapannya"
          >
            <CheckCircle2 size={13} />
            {approvingAll ? 'Memproses...' : `Setujui Semua (${pendingCount})`}
          </button>
        )}
      </div>

      {/* ── Notifikasi Aksi ───────────────────────────────── */}
      {msg && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 11.5,
            fontWeight: 600,
            background: msg.kind === 'ok' ? 'rgba(0,184,148,0.1)' : 'rgba(255,45,45,0.1)',
            border: `1px solid ${msg.kind === 'ok' ? 'rgba(0,184,148,0.4)' : 'rgba(255,45,45,0.4)'}`,
            color: msg.kind === 'ok' ? '#00795f' : '#b3261e',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{msg.text}</span>
          <button
            type="button"
            onClick={() => setMsg(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Filter Bar & Tab Navigasi ─────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <CenteredTabs tabs={tabsWithCount} active={tab} onChange={setTab} ariaLabel="Status Approval Inspeksi" compact />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
            style={{
              padding: '5px 10px',
              fontSize: 11,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              minHeight: 30,
            }}
          >
            <option value="">Semua Site</option>
            {daftarSite.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={selectedJenis}
            onChange={(e) => setSelectedJenis(e.target.value)}
            style={{
              padding: '5px 10px',
              fontSize: 11,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              minHeight: 30,
            }}
          >
            <option value="">Semua Jenis Fasilitas</option>
            {Object.entries(JENIS_META).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Daftar Kartu Inspeksi ─────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
            Memuat daftar inspeksi...
          </div>
        ) : rows.length === 0 ? (
          <div
            className="card"
            style={{
              padding: 36,
              textAlign: 'center',
              color: 'var(--muted-foreground)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <ShieldCheck size={36} style={{ opacity: 0.3 }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
              Tidak ada inspeksi pada status ini
            </div>
            <div style={{ fontSize: 11 }}>
              {tab === 'menunggu_persetujuan'
                ? 'Semua hasil checklist inspeksi lapangan telah selesai diverifikasi atau belum ada laporan baru.'
                : 'Belum ada riwayat pada kategori ini.'}
            </div>
          </div>
        ) : (
          rows.map((row) => {
            const isOpen = openId === row.id;
            const meta = JENIS_META[row.jenis as JenisInspeksi] ?? { label: row.jenis, area: 'Fasilitas' };
            const isBusy = busyId === row.id;
            const tone = STATUS_TONE[tab];

            return (
              <div
                key={String(row.id)}
                className="card"
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  borderColor: isOpen ? tone.border : 'var(--border)',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <div
                  onClick={() => setOpenId(isOpen ? null : row.id ?? null)}
                  style={{
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    cursor: 'pointer',
                    background: isOpen ? tone.bg : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        fontSize: 10.5,
                        fontWeight: 700,
                        background: 'var(--muted)',
                        color: 'var(--foreground)',
                        border: '1px solid var(--border)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {meta.label}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {row.objek_nama || 'Inspeksi Fasilitas'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', gap: 14, marginTop: 2, flexWrap: 'wrap' }}>
                        <span>Site: <b>{row.site || '-'}</b></span>
                        <span>Rencana: <b>{row.tanggal_rencana || '-'}</b></span>
                        <span>Realisasi: <b>{row.tanggal_selesai || '-'}</b></span>
                        <span>Petugas: <b>{row.petugas_nama || row.petugas || '-'}</b></span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 700,
                        background: tone.bg,
                        color: tone.text,
                        border: `1px solid ${tone.border}`,
                      }}
                    >
                      {tab === 'menunggu_persetujuan'
                        ? 'Menunggu Approval'
                        : tab === 'selesai'
                        ? 'Disetujui'
                        : 'Ditolak'}
                    </span>
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* Detail & Aksi Verification */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      style={{
                        borderTop: '1px solid var(--border)',
                        padding: '14px 18px',
                        background: 'var(--card)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: 10,
                          fontSize: 11.5,
                          background: 'var(--muted)',
                          padding: 10,
                          borderRadius: 8,
                        }}
                      >
                        <div>
                          <span style={{ color: 'var(--muted-foreground)', display: 'block', fontSize: 10 }}>Fasilitas / Objek</span>
                          <b>{row.objek_nama}</b>
                        </div>
                        <div>
                          <span style={{ color: 'var(--muted-foreground)', display: 'block', fontSize: 10 }}>Lokasi &amp; Site</span>
                          <b>{row.site}</b>
                        </div>
                        <div>
                          <span style={{ color: 'var(--muted-foreground)', display: 'block', fontSize: 10 }}>Waktu Pelaksanaan</span>
                          <b>{row.tanggal_selesai || row.tanggal_rencana}</b>
                        </div>
                        <div>
                          <span style={{ color: 'var(--muted-foreground)', display: 'block', fontSize: 10 }}>Inspektur / Pelapor</span>
                          <b>{row.petugas_nama || row.petugas || '-'}</b>
                        </div>
                      </div>

                      {row.catatan && (
                        <div style={{ fontSize: 11.5 }}>
                          <span style={{ color: 'var(--muted-foreground)', fontSize: 10, display: 'block', fontWeight: 600 }}>
                            Catatan Temuan Lapangan:
                          </span>
                          <div style={{ padding: '6px 10px', background: 'var(--muted)', borderRadius: 6, marginTop: 4 }}>
                            {row.catatan}
                          </div>
                        </div>
                      )}

                      {tab === 'menunggu_persetujuan' && canApprove && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                          <input
                            type="text"
                            placeholder="Catatan verifikasi (opsional untuk setuju, wajib bila ditolak)..."
                            value={catatan}
                            onChange={(e) => setCatatan(e.target.value)}
                            style={{
                              padding: '7px 12px',
                              borderRadius: 6,
                              border: '1px solid var(--border)',
                              background: 'var(--background)',
                              fontSize: 11.5,
                              color: 'var(--foreground)',
                            }}
                          />
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void actSingle(row, 'reject')}
                              style={{
                                padding: '6px 14px',
                                borderRadius: 6,
                                background: 'transparent',
                                border: '1px solid #FF2D2D',
                                color: '#FF2D2D',
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Tolak / Ulang
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void actSingle(row, 'approve')}
                              style={{
                                padding: '6px 16px',
                                borderRadius: 6,
                                background: '#00B894',
                                border: 'none',
                                color: '#fff',
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <Check size={14} />
                              {isBusy ? 'Menyimpan...' : 'Setujui Hasil Inspeksi'}
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
