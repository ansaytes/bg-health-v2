'use client';
// Halaman Administrator > Hearing Conservation (panel "Evaluasi Audiometri & STS").
// Membaca audiometri dari Record MCU (acr_*/acl_*), menetapkan baseline, mendeteksi STS, dan mengelola tindak lanjut STS.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { authFetch } from '@/lib/api-client';
import { KELAS_LABEL, type KelasPendengaran } from '@/lib/hc-ergo';
import { Chip, Field, Notice, SITES, fmtDate, grid3, inputStyle, tableStyle, tdStyle, thStyle } from './hc-ergo-ui';

type Row = Record<string, any>;
const KELAS_COLOR: Record<string, string> = { NORMAL: '#00B894', RINGAN: '#F5C518', SEDANG: '#F5A623', BERAT: '#FF6B35', SANGAT_BERAT: '#E63946' };
const STATUS_LABEL: Record<string, string> = { SUSPEK: 'Suspek STS', RETEST_DIJADWALKAN: 'Retest dijadwalkan', TERKONFIRMASI: 'Terkonfirmasi', TIDAK_TERKONFIRMASI: 'Tidak terkonfirmasi' };
const kelasChip = (k: KelasPendengaran | null) => k ? <Chip text={KELAS_LABEL[k]} color={KELAS_COLOR[k]} /> : <span style={{ color: 'var(--muted-foreground)' }}>-</span>;

export default function HcAudiometriEval() {
  const [rows, setRows] = useState<Row[]>([]);
  const [cases, setCases] = useState<Row[]>([]);
  const [site, setSite] = useState(''); const [kat, setKat] = useState(''); const [only, setOnly] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, c] = await Promise.all([authFetch('/api/hc?resource=audiometri'), authFetch('/api/hc?resource=sts')]);
      setRows(a.data || []); setCases(c.data || []);
    } catch (e) { setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal memuat data' }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => rows.filter((r) =>
    (!site || r.site === site) && (!kat || r.kategori === kat) &&
    (only === '' || (only === 'sts' && r.sts?.sts) || (only === 'nobase' && !r.baseline && !r.isBaseline) || (only === 'belum' && !r.tahunIni))), [rows, site, kat, only]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    try { await fn(); setMsg({ kind: 'ok', text: ok }); await load(); }
    catch (e) { setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal' }); }
  };
  const setBaseline = (r: Row, id: string) => act(() => authFetch('/api/hc', { method: 'POST', body: JSON.stringify({ resource: 'baseline', nik_hash: r.nikHash, mcu_record_id: id }) }), `Baseline ${r.nama} ditetapkan.`);
  const buatKasus = (r: Row) => act(() => authFetch('/api/hc', { method: 'POST', body: JSON.stringify({ resource: 'sts', nik_hash: r.nikHash, mcu_record_id: r.latest.id }) }), `Kasus STS ${r.nama} dibuat. Retest maksimal 30 hari.`);
  const saveCase = async (e: React.FormEvent) => {
    e.preventDefault(); if (!edit) return;
    await act(() => authFetch('/api/hc', { method: 'PATCH', body: JSON.stringify({ resource: 'sts', ...edit }) }), 'Tindak lanjut tersimpan.');
    setEdit(null);
  };
  const t = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', width: '90%', margin: '0 auto' }}>
      <div className="admin-form-inner">
        <div style={{ marginBottom: 14 }}>
          <h1 className="admin-form-title">Evaluasi Audiometri & STS</h1>
          <p className="admin-form-subtitle">Karyawan Kategori A/B. Derajat gangguan = rata-rata 500/1000/2000/3000 Hz; STS = geser rata-rata 2000/3000/4000 Hz ≥ 10 dB terhadap baseline (STD/033 6.4).</p>
        </div>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <div className="kunjungan-filter-bar" style={{ marginBottom: 12 }}>
          <select className="admin-filter-select" value={site} onChange={(e) => setSite(e.target.value)}><option value="">Semua site</option>{SITES.map((s) => <option key={s}>{s}</option>)}</select>
          <select className="admin-filter-select" value={kat} onChange={(e) => setKat(e.target.value)}><option value="">Kategori A & B</option><option value="A">Kategori A</option><option value="B">Kategori B</option></select>
          <select className="admin-filter-select" value={only} onChange={(e) => setOnly(e.target.value)}>
            <option value="">Semua status</option><option value="sts">Hanya STS</option><option value="nobase">Belum ada baseline</option><option value="belum">Belum audiometri tahun ini</option></select>
          <span className="kunjungan-total-right">{shown.length} karyawan {loading && '· memuat…'}</span>
        </div>

        <div className="admin-form-card" style={{ overflow: 'auto', marginBottom: 20 }}>
          <table style={tableStyle}>
            <thead><tr>{['Nama', 'Site', 'Kat.', 'Audiometri terakhir', 'Kanan', 'Kiri', 'Baseline', 'Geser (dB) K / Ki', 'Status', 'Aksi'].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.exposureId}>
                  <td style={tdStyle}><b>{r.nama}</b><div style={{ color: 'var(--muted-foreground)', fontSize: 10 }}>{r.nik}</div></td>
                  <td style={tdStyle}>{r.site}</td><td style={tdStyle}>{r.kategori}</td>
                  <td style={tdStyle}>{r.latest ? fmtDate(r.latest.tanggal) : <Chip text="BELUM ADA" color="#778899" />}{r.latest && !r.tahunIni && <div><Chip text="BUKAN TAHUN INI" color="#F5A623" /></div>}</td>
                  <td style={tdStyle}>{kelasChip(r.kelasKanan)}<div style={{ fontSize: 10 }}>{r.avg4Kanan ?? '-'} dB</div></td>
                  <td style={tdStyle}>{kelasChip(r.kelasKiri)}<div style={{ fontSize: 10 }}>{r.avg4Kiri ?? '-'} dB</div></td>
                  <td style={tdStyle}>
                    {r.baseline ? fmtDate(r.baseline.tanggal) : r.saranBaseline
                      ? <button type="button" className="admin-form-btn-secondary compact-btn" onClick={() => setBaseline(r, r.saranBaseline.id)} title="Tetapkan audiometri tertua sebagai baseline">Tetapkan {fmtDate(r.saranBaseline.tanggal)}</button>
                      : '-'}
                  </td>
                  <td style={tdStyle}>{r.sts ? `${r.sts.geserKanan ?? '-'} / ${r.sts.geserKiri ?? '-'}` : r.isBaseline ? 'baseline' : '-'}{r.sts?.berbasisEstimasi && <div><Chip text="3000 Hz estimasi" color="#778899" /></div>}</td>
                  <td style={tdStyle}>{r.sts?.sts ? <Chip text="STS" color="#E63946" /> : r.sts ? <Chip text="Tidak STS" color="#00B894" /> : '-'}{r.stsCase && <div style={{ fontSize: 10 }}>{STATUS_LABEL[r.stsCase.status]}</div>}</td>
                  <td style={tdStyle}>{r.sts?.sts && !r.stsCase && <button type="button" className="admin-form-btn-primary compact-btn" onClick={() => buatKasus(r)}>Buat Kasus STS</button>}</td>
                </tr>
              ))}
              {!shown.length && <tr><td style={tdStyle} colSpan={10}>{loading ? 'Memuat…' : 'Belum ada karyawan Kategori A/B. Isi dulu di Form Input > Klasifikasi Karyawan.'}</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="admin-form-card">
          <div className="admin-section-header"><h3 className="admin-section-title">Tindak Lanjut Kasus STS (INK/015 6.4–6.5)</h3></div>
          <table style={tableStyle}>
            <thead><tr>{['Nama', 'Site', 'Terdeteksi', 'Telinga', 'Batas retest', 'Status', 'THT', 'PAK', ''].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {cases.map((c) => {
                const late = ['SUSPEK', 'RETEST_DIJADWALKAN'].includes(c.status) && c.retest_deadline < t;
                return (
                  <tr key={c.id}><td style={tdStyle}>{c.nama}</td><td style={tdStyle}>{c.site}</td><td style={tdStyle}>{fmtDate(c.tanggal_deteksi)}</td><td style={tdStyle}>{c.telinga}</td>
                    <td style={tdStyle}>{fmtDate(c.retest_deadline)} {late && <Chip text="TERLAMBAT" color="#E63946" />}</td>
                    <td style={tdStyle}>{STATUS_LABEL[c.status]}</td><td style={tdStyle}>{c.rujuk_tht ? 'Dirujuk' : '-'}</td><td style={tdStyle}>{c.kajian_pak}</td>
                    <td style={tdStyle}><button type="button" className="admin-form-btn-secondary compact-btn" onClick={() => setEdit(c)}>Kelola</button></td></tr>
                );
              })}
              {!cases.length && <tr><td style={tdStyle} colSpan={9}>Belum ada kasus STS.</td></tr>}
            </tbody>
          </table>

          {edit && (
            <form onSubmit={saveCase} style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Kelola: {edit.nama}</h4>
              <div style={grid3}>
                <Field label="Status"><select className="admin-input" style={inputStyle} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                <Field label="Dilaporkan ke QSHE Manager"><input type="date" className="admin-input" style={inputStyle} value={edit.dilaporkan_qshe_manager_tgl || ''} onChange={(e) => setEdit({ ...edit, dilaporkan_qshe_manager_tgl: e.target.value })} /></Field>
                <Field label="Rujuk Dokter THT"><select className="admin-input" style={inputStyle} value={edit.rujuk_tht ? '1' : '0'} onChange={(e) => setEdit({ ...edit, rujuk_tht: e.target.value === '1' })}><option value="0">Belum</option><option value="1">Sudah dirujuk</option></select></Field>
                {edit.rujuk_tht && <Field label="Tanggal Rujuk THT"><input type="date" className="admin-input" style={inputStyle} value={edit.rujuk_tht_tgl || ''} onChange={(e) => setEdit({ ...edit, rujuk_tht_tgl: e.target.value })} /></Field>}
                <Field label="Kajian PAK"><select className="admin-input" style={inputStyle} value={edit.kajian_pak} onChange={(e) => setEdit({ ...edit, kajian_pak: e.target.value })}><option value="BELUM">Belum</option><option value="DALAM_KAJIAN">Dalam kajian</option><option value="PAK">PAK</option><option value="BUKAN_PAK">Bukan PAK</option></select></Field>
                {edit.kajian_pak === 'PAK' && <Field label="Dilaporkan ke Disnaker"><input type="date" className="admin-input" style={inputStyle} value={edit.dilaporkan_disnaker_tgl || ''} onChange={(e) => setEdit({ ...edit, dilaporkan_disnaker_tgl: e.target.value })} /></Field>}
                <Field label="Riwayat bising non-okupasi" full><textarea className="admin-input" style={{ ...inputStyle, height: 60, padding: 8 }} value={edit.riwayat_non_okupasi || ''} onChange={(e) => setEdit({ ...edit, riwayat_non_okupasi: e.target.value })} /></Field>
                <Field label="Catatan" full><input className="admin-input" style={inputStyle} value={edit.catatan || ''} onChange={(e) => setEdit({ ...edit, catatan: e.target.value })} /></Field>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="submit" className="admin-form-btn-primary">Simpan</button>
                <button type="button" className="admin-form-btn-secondary" onClick={() => setEdit(null)}>Batal</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
