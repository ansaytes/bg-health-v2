'use client';
// Halaman Administrator > Ergonomi (panel "Data Survei & PICA"): persetujuan, rekomendasi/PICA, verifikasi efektivitas.
import { Fragment, useCallback, useEffect, useState } from 'react';
import { authFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { FORM_NO, KLAS_COLOR, type Klasifikasi, type Metode } from '@/lib/hc-ergo';
import { Chip, Field, Notice, SITES, fmtDate, grid3, inputStyle, smallInput, tableStyle, tdStyle, thStyle } from './hc-ergo-ui';

type Row = Record<string, any>;
const STATUS: Record<string, { t: string; c: string }> = {
  DRAFT: { t: 'Draft', c: '#778899' },
  MENUNGGU_PERSETUJUAN: { t: 'Menunggu persetujuan', c: '#F5A623' },
  DISETUJUI: { t: 'Disetujui', c: '#00B894' },
  DITOLAK_ULANG: { t: 'Tidak sah / ulang', c: '#E63946' },
};

export default function ErgoSurveyTable() {
  const { canApproveErgo } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [site, setSite] = useState('');
  const [metode, setMetode] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [recs, setRecs] = useState<Row[]>([]);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [nr, setNr] = useState<Row>({ problem: '', tindakan: '', pic: '', due_date: '', pica_no: '' });

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams({ resource: 'survey', site: site || 'all', metode: metode || 'all', status: status || 'all' });
      setRows((await authFetch(`/api/ergo?${q}`)).data || []);
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal memuat' });
    }
  }, [site, metode, status]);

  useEffect(() => {
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [load]);

  const loadRecs = useCallback(async (sid: string) => {
    try {
      setRecs((await authFetch(`/api/ergo?resource=recommendation&survey_id=${sid}`)).data || []);
    } catch {
      setRecs([]);
    }
  }, []);

  const toggle = (id: string) => {
    if (open === id) {
      setOpen(null);
      return;
    }
    setOpen(id);
    loadRecs(id);
  };

  const act = async (fn: () => Promise<unknown>, okMsg: string, then?: () => void) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ kind: 'ok', text: okMsg });
      await load();
      then?.();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal' });
    }
  };

  const approve = (s: Row) => {
    const pica = s.perlu_pica
      ? (prompt('No. PICA (FORM/039) untuk tindak lanjut — kosongkan bila belum ada:', s.pica_no || '') ?? '')
      : '';
    return act(
      () => authFetch('/api/ergo', {
        method: 'PATCH',
        body: JSON.stringify({ resource: 'survey', id: s.id, action: 'approve', pica_no: pica }),
      }),
      'Survei disetujui.',
    );
  };

  const reject = (s: Row) =>
    act(
      () => authFetch('/api/ergo', {
        method: 'PATCH',
        body: JSON.stringify({ resource: 'survey', id: s.id, action: 'reject' }),
      }),
      'Survei ditandai perlu diulang.',
    );

  const del = (s: Row) =>
    confirm('Hapus survei ini beserta rekomendasinya?') &&
    act(
      () => authFetch(`/api/ergo?resource=survey&id=${s.id}`, { method: 'DELETE' }),
      'Survei dihapus.',
    );

  const addRec = (sid: string) =>
    act(
      () => authFetch('/api/ergo', {
        method: 'POST',
        body: JSON.stringify({ resource: 'recommendation', survey_id: sid, ...nr }),
      }),
      'Rekomendasi ditambahkan.',
      () => {
        setNr({ problem: '', tindakan: '', pic: '', due_date: '', pica_no: '' });
        loadRecs(sid);
      },
    );

  const patchRec = (r: Row, patch: Row) =>
    act(
      () => authFetch('/api/ergo', {
        method: 'PATCH',
        body: JSON.stringify({ resource: 'recommendation', id: r.id, ...patch }),
      }),
      'Rekomendasi diperbarui.',
      () => loadRecs(r.survey_id),
    );

  const t = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', width: '90%', margin: '0 auto' }}>
      <div className="admin-form-inner">
        <div style={{ marginBottom: 14 }}>
          <h1 className="admin-form-title">Data Survei Ergonomi & PICA</h1>
          <p className="admin-form-subtitle">
            Hasil tidak sah tidak dapat disetujui. Klasifikasi sedang ke atas wajib ditindaklanjuti lewat PICA;
            verifikasi efektivitas maksimal 30 hari kerja sejak laporan disetujui.
            {canApproveErgo
              ? ' Anda dapat menyetujui / menolak survei.'
              : ' Persetujuan hanya oleh QSHE Manager / Administrator / Superuser.'}
          </p>
        </div>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <div className="kunjungan-filter-bar" style={{ marginBottom: 12 }}>
          <select className="admin-filter-select" value={site} onChange={(e) => setSite(e.target.value)}>
            <option value="">Semua site</option>
            {SITES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="admin-filter-select" value={metode} onChange={(e) => setMetode(e.target.value)}>
            <option value="">Semua metode</option>
            <option>RULA</option>
            <option>ROSA</option>
            <option>WERA</option>
          </select>
          <select className="admin-filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Semua status</option>
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.t}</option>
            ))}
          </select>
          <span className="kunjungan-total-right">{rows.length} survei</span>
        </div>
        <div className="admin-form-card" style={{ overflow: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {['Tanggal', 'Metode', 'Site / Area', 'Aktivitas', 'Skor', 'Klasifikasi', 'Sah', 'Status', 'PICA', 'Aksi'].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <Fragment key={s.id}>
                  <tr>
                    <td style={tdStyle}>{fmtDate(s.tanggal)}</td>
                    <td style={tdStyle}>
                      {s.metode}
                      <div style={{ fontSize: 9, color: 'var(--muted-foreground)' }}>
                        {FORM_NO[s.metode as Metode].slice(-8)}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      {s.site}
                      <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{s.area_kerja}</div>
                    </td>
                    <td style={tdStyle}>
                      {s.aktivitas}
                      <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{s.pekerja_diamati}</div>
                    </td>
                    <td style={tdStyle}><b>{s.skor_akhir}</b></td>
                    <td style={tdStyle}>
                      <Chip text={String(s.klasifikasi).replace('_', ' ')} color={KLAS_COLOR[s.klasifikasi as Klasifikasi]} />
                      {s.batas_tindak_hari_kerja && (
                        <div style={{ fontSize: 10 }}>≤ {s.batas_tindak_hari_kerja} hari kerja</div>
                      )}
                    </td>
                    <td style={tdStyle}>{s.sah ? 'Ya' : <Chip text="TIDAK" color="#E63946" />}</td>
                    <td style={tdStyle}>
                      <Chip text={STATUS[s.status]?.t || s.status} color={STATUS[s.status]?.c || '#778899'} />
                      {s.tgl_disetujui && <div style={{ fontSize: 10 }}>{fmtDate(s.tgl_disetujui)}</div>}
                      {s.disetujui_oleh && <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>oleh {s.disetujui_oleh}</div>}
                    </td>
                    <td style={tdStyle}>
                      {s.perlu_pica ? (s.pica_no || <Chip text="BELUM ADA" color="#F5A623" />) : '-'}
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                      {canApproveErgo && s.status === 'MENUNGGU_PERSETUJUAN' && s.sah && (
                        <button type="button" className="admin-form-btn-primary compact-btn" onClick={() => approve(s)}>
                          Setujui
                        </button>
                      )}{' '}
                      {canApproveErgo && s.status !== 'DITOLAK_ULANG' && s.status !== 'DISETUJUI' && (
                        <button type="button" className="admin-form-btn-secondary compact-btn" onClick={() => reject(s)}>
                          Ulang
                        </button>
                      )}{' '}
                      {s.perlu_pica && (
                        <button type="button" className="admin-form-btn-secondary compact-btn" onClick={() => toggle(s.id)}>
                          {open === s.id ? 'Tutup' : 'Rekomendasi'}
                        </button>
                      )}{' '}
                      <button type="button" className="admin-form-btn-secondary compact-btn" onClick={() => del(s)}>
                        Hapus
                      </button>
                    </td>
                  </tr>
                  {open === s.id && (
                    <tr>
                      <td colSpan={10} style={{ ...tdStyle, background: 'var(--muted)' }}>
                        <b style={{ fontSize: 12 }}>Rekomendasi & tindak lanjut</b>
                        <table style={{ ...tableStyle, marginTop: 6 }}>
                          <thead>
                            <tr>
                              {['Permasalahan', 'Tindakan', 'PIC', 'Jatuh tempo', 'Verifikasi s/d', 'Status', ''].map((h) => (
                                <th key={h} style={thStyle}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {recs.map((r) => (
                              <tr key={r.id}>
                                <td style={tdStyle}>{r.problem}</td>
                                <td style={tdStyle}>{r.tindakan}</td>
                                <td style={tdStyle}>{r.pic}</td>
                                <td style={tdStyle}>
                                  {fmtDate(r.due_date)}{' '}
                                  {r.status !== 'CLOSED' && r.due_date < t && <Chip text="LEWAT" color="#E63946" />}
                                </td>
                                <td style={tdStyle}>{fmtDate(r.batas_verifikasi)}</td>
                                <td style={tdStyle}>
                                  <select
                                    style={smallInput}
                                    value={r.status}
                                    onChange={(e) => patchRec(r, { status: e.target.value })}
                                  >
                                    <option value="OPEN">Open</option>
                                    <option value="PROGRESS">Progress</option>
                                    <option value="CLOSED">Closed</option>
                                  </select>
                                </td>
                                <td style={tdStyle}>
                                  {r.status === 'CLOSED' && !r.verifikasi_tgl && (
                                    <button
                                      type="button"
                                      className="admin-form-btn-secondary compact-btn"
                                      onClick={() => {
                                        const k = prompt('Hasil verifikasi efektivitas tindakan:');
                                        if (k) patchRec(r, { verifikasi_tgl: t, verifikasi_ket: k });
                                      }}
                                    >
                                      Verifikasi
                                    </button>
                                  )}
                                  {r.verifikasi_tgl && (
                                    <span style={{ fontSize: 10 }}>Terverifikasi {fmtDate(r.verifikasi_tgl)}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                            {!recs.length && (
                              <tr><td style={tdStyle} colSpan={7}>Belum ada rekomendasi.</td></tr>
                            )}
                          </tbody>
                        </table>
                        <div style={{ ...grid3, marginTop: 10 }}>
                          <Field label="Permasalahan">
                            <input className="admin-input" style={inputStyle} value={nr.problem} onChange={(e) => setNr({ ...nr, problem: e.target.value })} />
                          </Field>
                          <Field label="Tindakan perbaikan">
                            <input className="admin-input" style={inputStyle} value={nr.tindakan} onChange={(e) => setNr({ ...nr, tindakan: e.target.value })} />
                          </Field>
                          <Field label="PIC">
                            <input className="admin-input" style={inputStyle} value={nr.pic} onChange={(e) => setNr({ ...nr, pic: e.target.value })} />
                          </Field>
                          <Field label="Jatuh tempo">
                            <input type="date" className="admin-input" style={inputStyle} value={nr.due_date} onChange={(e) => setNr({ ...nr, due_date: e.target.value })} />
                          </Field>
                          <Field label="No. PICA">
                            <input className="admin-input" style={inputStyle} value={nr.pica_no} onChange={(e) => setNr({ ...nr, pica_no: e.target.value })} />
                          </Field>
                        </div>
                        <button type="button" className="admin-form-btn-primary compact-btn" style={{ marginTop: 8 }} onClick={() => addRec(s.id)}>
                          Tambah Rekomendasi
                        </button>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {!rows.length && (
                <tr><td style={tdStyle} colSpan={10}>Belum ada survei.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
