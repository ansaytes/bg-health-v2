'use client';
// Dashboard > Persetujuan Ergonomi. Untuk role Manager (QSHE Manager / PJO) dan superuser.
// Nama & jabatan penyetuju diisi otomatis dari data employee akun yang login.
import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { KLAS_COLOR, type Klasifikasi } from '@/lib/hc-ergo';
import { interpretasiFor } from '@/lib/ergo-wizard';
import { Btn, BtnRow, Chip, Notice, fmtDate } from '@/components/administrator/hc-ergo-ui';

type Row = Record<string, any>;
const TABS = [
  { key: 'MENUNGGU_PERSETUJUAN', label: 'Menunggu Persetujuan' },
  { key: 'DISETUJUI', label: 'Sudah Disetujui' },
  { key: 'DITOLAK_ULANG', label: 'Ditolak / Ulang' },
] as const;

export default function ErgoApproval() {
  const { profile, role } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('MENUNGGU_PERSETUJUAN');
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [catatan, setCatatan] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const canApprove = role === 'manager' || role === 'superuser';

  const load = useCallback(async () => {
    try {
      const r = await authFetch(`/api/ergo?resource=survey&status=${tab}`);
      setRows(r.data || []); setMsg(null);
    } catch (e) { setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal memuat' }); }
    finally { setLoading(false); }
  }, [tab]);
  useEffect(() => { const id = setTimeout(load, 0); return () => clearTimeout(id); }, [load]);

  const act = async (s: Row, action: 'approve' | 'reject') => {
    if (action === 'reject' && !catatan.trim()) { setMsg({ kind: 'err', text: 'Isi alasan penolakan pada kolom catatan.' }); return; }
    try {
      const r = await authFetch('/api/ergo', { method: 'PATCH', body: JSON.stringify({ resource: 'survey', id: s.id, action, catatan }) });
      setMsg({ kind: 'ok', text: action === 'approve' ? `Disetujui oleh ${r.data.disetujui_oleh}${r.data.disetujui_jabatan ? ` — ${r.data.disetujui_jabatan}` : ''}.` : 'Survei ditolak dan dikembalikan untuk diulang.' });
      setCatatan(''); setOpen(null); load();
    } catch (e) { setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal' }); }
  };

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Persetujuan Survei Ergonomi</h1>
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '4px 0 0' }}>
          Hasil survei RULA, ROSA, dan WERA disetujui oleh QSHE Manager / PJO.
          {canApprove && <> Anda masuk sebagai <b>{profile?.full_name || profile?.username}</b>; nama dan jabatan Anda dicatat otomatis saat menyetujui.</>}
        </p>
      </div>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <BtnRow>{TABS.map((t) => <Btn key={t.key} kind={tab === t.key ? 'primary' : 'secondary'} onClick={() => { setTab(t.key); setOpen(null); }}>{t.label}</Btn>)}</BtnRow>

      {rows.map((s) => {
        const isOpen = open === s.id;
        const rk: Row[] = Array.isArray(s.hasil?.ringkasan) ? s.hasil.ringkasan : [];
        return (
          <div key={s.id} className="card" style={{ padding: 12, gap: 8 }}>
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
                      <Btn kind="primary" size="md" disabled={!s.sah} onClick={() => act(s, 'approve')} title={s.sah ? '' : 'Hasil tidak sah, tidak dapat disetujui'}>Setujui</Btn>
                      <Btn kind="danger" size="md" onClick={() => act(s, 'reject')}>Tolak / Minta Ulang</Btn>
                    </BtnRow>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {!rows.length && <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{loading ? 'Memuat…' : 'Tidak ada survei pada status ini.'}</div>}
    </div>
  );
}
