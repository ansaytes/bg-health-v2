'use client';
// Data Entry > Approval Survey Ergonomi. Untuk role Manager (QSHE Manager / PJO) dan superuser.
// Nama & jabatan penyetuju diisi otomatis dari data employee akun yang login.
//
// Tampilan sengaja dibuat kartu-ringkas agar tidak kaku: ringkasan di atas,
// tab status di tengah, lalu daftar kartu survei yang bisa dibuka satu per satu.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ClipboardCheck } from 'lucide-react';
import { authFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { KLAS_COLOR, type Klasifikasi } from '@/lib/hc-ergo';
import { interpretasiFor } from '@/lib/ergo-wizard';
import { Chip, Btn, BtnRow, Notice, fmtDate } from '@/components/administrator/hc-ergo-ui';
import CenteredTabs from '@/components/ui/centered-tabs';

type Row = Record<string, any>;
type TabKey = 'MENUNGGU_PERSETUJUAN' | 'DISETUJUI' | 'DITOLAK_ULANG';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'MENUNGGU_PERSETUJUAN', label: 'Menunggu Persetujuan' },
  { key: 'DISETUJUI', label: 'Sudah Disetujui' },
  { key: 'DITOLAK_ULANG', label: 'Ditolak / Ulang' },
];

// Warna lembut per status: kuning (menunggu), hijau (setuju), merah (tolak).
const STATUS_TONE: Record<TabKey, { bg: string; border: string; text: string }> = {
  MENUNGGU_PERSETUJUAN: { bg: 'rgba(255, 196, 0, 0.10)', border: 'rgba(255, 196, 0, 0.45)', text: '#9a6b00' },
  DISETUJUI: { bg: 'rgba(0, 184, 148, 0.10)', border: 'rgba(0, 184, 148, 0.42)', text: '#00795f' },
  DITOLAK_ULANG: { bg: 'rgba(255, 45, 45, 0.08)', border: 'rgba(255, 45, 45, 0.38)', text: '#b3261e' },
};

export default function ErgoApproval() {
  const { profile, role } = useAuth();
  const [tab, setTab] = useState<TabKey>('MENUNGGU_PERSETUJUAN');
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [catatan, setCatatan] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const canApprove = role === 'manager' || role === 'superuser';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await authFetch(`/api/ergo?resource=survey&status=${tab}`);
      setRows(r.data || []); setMsg(null);
    } catch (e) { setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal memuat' }); }
    finally { setLoading(false); }
  }, [tab]);
  useEffect(() => { const id = setTimeout(load, 0); return () => clearTimeout(id); }, [load]);

  const act = async (s: Row, action: 'approve' | 'reject') => {
    if (action === 'reject' && !catatan.trim()) { setMsg({ kind: 'err', text: 'Isi alasan penolakan pada kolom catatan.' }); return; }
    setBusy(s.id);
    try {
      const r = await authFetch('/api/ergo', { method: 'PATCH', body: JSON.stringify({ resource: 'survey', id: s.id, action, catatan }) });
      setMsg({ kind: 'ok', text: action === 'approve' ? `Disetujui oleh ${r.data.disetujui_oleh}${r.data.disetujui_jabatan ? ` — ${r.data.disetujui_jabatan}` : ''}.` : 'Survei ditolak dan dikembalikan untuk diulang.' });
      setCatatan(''); setOpen(null); await load();
    } catch (e) { setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal' }); }
    finally { setBusy(null); }
  };

  const tone = STATUS_TONE[tab];
  const waitCount = useMemo(() => rows.filter((r) => r.status === 'MENUNGGU_PERSETUJUAN').length, [rows]);
  const validCount = useMemo(() => rows.filter((r) => r.sah).length, [rows]);

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── Hero ringkas ─────────────────────────────────── */}
      <div
        className="card"
        style={{
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
          padding: '14px 18px',
          background: `linear-gradient(120deg, ${tone.bg}, transparent 70%)`,
          borderColor: tone.border,
        }}
      >
        <div
          style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center',
            background: tone.bg, border: `1px solid ${tone.border}`, color: tone.text,
          }}
        >
          <ClipboardCheck size={21} />
        </div>
        <div style={{ minWidth: 220, flex: 1 }}>
          <h1 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--foreground)' }}>Approval Survey Ergonomi</h1>
          <p style={{ fontSize: 11.5, color: 'var(--muted-foreground)', margin: '3px 0 0', lineHeight: 1.5 }}>
            Hasil survei RULA, ROSA, dan WERA disetujui oleh QSHE Manager / PJO.
            {canApprove && <> Anda masuk sebagai <b>{profile?.full_name || profile?.username}</b>; nama &amp; jabatan dicatat otomatis.</>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: 'Menunggu', value: waitCount, color: '#C99A00' },
            { label: 'Layak disetujui', value: validCount, color: '#00895f' },
            { label: 'Total halaman', value: rows.length, color: 'var(--foreground)' },
          ].map((k) => (
            <div key={k.label} style={{ minWidth: 78, padding: '6px 10px', borderRadius: 10, background: 'var(--background)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: k.color, lineHeight: 1.1 }}>{k.value}</div>
              <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)', fontWeight: 700 }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab status (kiri) ─────────────────────────── */}
      <div style={{ margin: '0 -20px' }}>
        <CenteredTabs
          tabs={TABS}
          active={tab}
          onChange={(key) => { setTab(key); setOpen(null); }}
          ariaLabel="Status Approval Survey Ergonomi"
        />
      </div>

      <AnimatePresence>
        {msg && (
          <motion.div key={msg.text} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <Notice kind={msg.kind}>{msg.text}</Notice>
          </motion.div>
        )}
      </AnimatePresence>

      {rows.map((s, index) => {
        const isOpen = open === s.id;
        const rk: Row[] = Array.isArray(s.hasil?.ringkasan) ? s.hasil.ringkasan : [];
        return (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.03, 0.2), duration: 0.22 }}
            className="card"
            style={{ padding: '12px 14px', gap: 10, borderLeft: `3px solid ${tone.text}` }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{s.metode} — {s.aktivitas}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{s.site} · {s.area_kerja} · {s.departemen} · {fmtDate(s.tanggal)}</div>
                <div style={{ fontSize: 11 }}>Pekerja: <b>{s.pekerja_diamati}</b> · Pengukur: {s.personil_pengukur} ({s.kualifikasi_pengukur})</div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 9, color: 'var(--muted-foreground)' }}>SKOR</div><div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{s.skor_akhir}</div></div>
                <Chip text={String(s.klasifikasi).replace('_', ' ')} color={KLAS_COLOR[s.klasifikasi as Klasifikasi]} />
                <Btn onClick={() => setOpen(isOpen ? null : s.id)}>{isOpen ? 'Tutup' : 'Periksa'}</Btn>
              </div>
            </div>
            {s.status === 'DISETUJUI' && <div style={{ fontSize: 11 }}>Disetujui oleh <b>{s.disetujui_oleh}</b>{s.disetujui_jabatan ? ` — ${s.disetujui_jabatan}` : ''} pada {fmtDate(s.tgl_disetujui)}{s.catatan_persetujuan ? ` · Catatan: ${s.catatan_persetujuan}` : ''}</div>}
            {s.status === 'DITOLAK_ULANG' && s.catatan_persetujuan && <div style={{ fontSize: 11, color: '#E63946' }}>{s.catatan_persetujuan}</div>}
            {isOpen && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <div style={{ fontSize: 12, marginBottom: 6 }}><b>Interpretasi:</b> {interpretasiFor(s.metode, s.skor_akhir)}{s.perlu_pica ? ' — wajib PICA.' : ''}{s.batas_tindak_hari_kerja ? ` Batas tindak lanjut ${s.batas_tindak_hari_kerja} hari kerja.` : ''}</div>
                <div style={{ fontSize: 11, marginBottom: 6 }}>Keabsahan: {s.sah ? 'semua syarat terpenuhi' : <b style={{ color: '#E63946' }}>ada syarat yang belum terpenuhi</b>}{s.foto_url && <> · <a href={s.foto_url} target="_blank" rel="noreferrer" style={{ color: '#ff4d00' }}>Foto / dokumentasi</a></>}</div>
                {rk.length > 0 && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, marginBottom: 10 }}>
                    <tbody>{rk.map((r) => (
                      <tr key={r.judul}><td style={{ padding: '3px 6px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{r.judul}</td>
                        <td style={{ padding: '3px 6px', borderBottom: '1px solid var(--border)' }}>{r.pilihan}{Array.isArray(r.tambahan) && r.tambahan.length > 0 && <div style={{ color: 'var(--muted-foreground)' }}>+ {r.tambahan.join('; ')}</div>}</td>
                        <td style={{ padding: '3px 6px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>{r.nilai}</td></tr>))}</tbody>
                  </table>
                )}
                {s.status === 'MENUNGGU_PERSETUJUAN' && canApprove && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan persetujuan (wajib diisi bila menolak)"
                      style={{ height: 36, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--background)', padding: '0 12px', fontSize: 12, color: 'var(--foreground)' }} />
                    <BtnRow>
                      <Btn kind="primary" size="md" disabled={!s.sah || busy === s.id} onClick={() => act(s, 'approve')} title={s.sah ? '' : 'Hasil tidak sah, tidak dapat disetujui'}>{busy === s.id ? 'Memproses…' : 'Setujui'}</Btn>
                      <Btn kind="danger" size="md" disabled={busy === s.id} onClick={() => act(s, 'reject')}>Tolak / Minta Ulang</Btn>
                    </BtnRow>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        );
      })}
      {!rows.length && <div style={{ fontSize: 12, color: 'var(--muted-foreground)', padding: '16px 0' }}>{loading ? 'Memuat…' : 'Tidak ada survei pada status ini.'}</div>}
    </div>
  );
}
