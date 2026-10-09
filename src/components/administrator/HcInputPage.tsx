'use client';
// Halaman Administrator > Hearing Conservation (panel "Form Input").
// Tab: Noise Mapping (INK/015) | Klasifikasi Karyawan (STD/033 6.3) | Master Area.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { authFetch } from '@/lib/api-client';
import { aptRequirement, jatuhTempoUkur, zonaFromLeq, ZONA_COLOR, type Zona } from '@/lib/hc-ergo';
import EmployeeLookupInput, { type EmployeeData } from './EmployeeLookupInput';
import {
  Chip, Field, Notice, Section, SITES, Tabs, fmtDate, grid2, grid3, inputStyle, smallInput, tableStyle, tdStyle, thStyle,
} from './hc-ergo-ui';

type Row = Record<string, any>;
interface Pt { kode_titik: string; deskripsi: string; leq_dba: string; durasi_menit: string; }
const newPt = (n: number): Pt => ({ kode_titik: `T${n}`, deskripsi: '', leq_dba: '', durasi_menit: '10' });
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function HcInputPage() {
  const [tab, setTab] = useState<'noise' | 'exposure' | 'area'>('noise');
  const [areas, setAreas] = useState<Row[]>([]);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const loadAreas = useCallback(async () => {
    try { setAreas((await authFetch('/api/hc?resource=area')).data || []); }
    catch (e) { setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal memuat area' }); }
  }, []);
  useEffect(() => { const id = setTimeout(loadAreas, 0); return () => clearTimeout(id); }, [loadAreas]);

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', width: '90%', margin: '0 auto' }}>
      <div className="admin-form-inner">
        <div style={{ marginBottom: 14 }}>
          <h1 className="admin-form-title">Hearing Conservation</h1>
          <p className="admin-form-subtitle">Noise mapping, klasifikasi karyawan terpajan, dan master area (STD/033, INK/015). Data audiometri dibaca dari Record MCU.</p>
        </div>
        <Tabs tabs={[{ key: 'noise', label: 'Noise Mapping' }, { key: 'exposure', label: 'Klasifikasi Karyawan' }, { key: 'area', label: 'Master Area' }]} value={tab} onChange={setTab} />
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        {tab === 'noise' && <NoiseTab areas={areas} onMsg={setMsg} onSaved={loadAreas} />}
        {tab === 'exposure' && <ExposureTab areas={areas} onMsg={setMsg} />}
        {tab === 'area' && <AreaTab areas={areas} onMsg={setMsg} onChanged={loadAreas} />}
      </div>
    </div>
  );
}

/* ───────────── NOISE MAPPING ───────────── */
function NoiseTab({ areas, onMsg, onSaved }: { areas: Row[]; onMsg: (m: any) => void; onSaved: () => void }) {
  const [site, setSite] = useState('');
  const [f, setF] = useState<Row>({
    area_id: '', tanggal: todayStr(), tipe: 'BERKALA', petugas: '', slm_merk_tipe: '', slm_serial: '', slm_kelas: '2',
    sertifikat_kalibrasi_sd: '', kalibrasi_sebelum_db: '', kalibrasi_sesudah_db: '', rambu_terpasang: false,
    apt_tersedia: false, apt_nrr_tersedia: '', catatan: '',
  });
  const [pts, setPts] = useState<Pt[]>([newPt(1)]);
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState<Row[]>([]);
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  const loadList = useCallback(async () => {
    try { setList((await authFetch('/api/hc?resource=noise')).data || []); } catch { /* abaikan */ }
  }, []);
  useEffect(() => { loadList(); }, [loadList]);

  const areaOptions = useMemo(() => areas.filter((a) => !site || a.site === site), [areas, site]);
  const leqs = pts.map((p) => parseFloat(p.leq_dba)).filter((n) => Number.isFinite(n));
  const leqMax = leqs.length ? Math.max(...leqs) : null;
  const zona: Zona | null = leqMax === null ? null : zonaFromLeq(leqMax);
  const apt = zona && leqMax !== null ? aptRequirement(zona, leqMax) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); onMsg(null); setSaving(true);
    try {
      await authFetch('/api/hc', { method: 'POST', body: JSON.stringify({ resource: 'noise', ...f, points: pts }) });
      onMsg({ kind: 'ok', text: 'Noise mapping tersimpan.' });
      setPts([newPt(1)]); setF((p) => ({ ...p, catatan: '' }));
      loadList(); onSaved();
    } catch (err) { onMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan' }); }
    finally { setSaving(false); }
  };
  const del = async (id: string) => {
    if (!confirm('Hapus survei noise mapping ini beserta titik ukurnya?')) return;
    try { await authFetch(`/api/hc?resource=noise&id=${id}`, { method: 'DELETE' }); loadList(); onSaved(); }
    catch (err) { onMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Gagal menghapus' }); }
  };

  return (
    <>
      <form onSubmit={submit}>
        <Section title="Pengukuran Area (INK/015 langkah 6.1-6.2)">
          <div style={grid3}>
            <Field label="Site"><select className="admin-input" style={inputStyle} value={site} onChange={(e) => { setSite(e.target.value); set('area_id', ''); }}>
              <option value="">Semua site</option>{SITES.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Area Kerja" hint="(daftarkan dulu di tab Master Area)"><select className="admin-input" style={inputStyle} required value={f.area_id} onChange={(e) => set('area_id', e.target.value)}>
              <option value="">Pilih area…</option>{areaOptions.map((a) => <option key={a.area_id} value={a.area_id}>{a.site} — {a.nama_area}</option>)}</select></Field>
            <Field label="Tanggal Pengukuran"><input type="date" className="admin-input" style={inputStyle} required value={f.tanggal} onChange={(e) => set('tanggal', e.target.value)} /></Field>
            <Field label="Jenis"><select className="admin-input" style={inputStyle} value={f.tipe} onChange={(e) => set('tipe', e.target.value)}>
              <option value="BERKALA">Berkala</option><option value="PERUBAHAN_PROSES">Perubahan mesin / proses</option></select></Field>
            <Field label="Petugas Pengukur"><input className="admin-input" style={inputStyle} required value={f.petugas} onChange={(e) => set('petugas', e.target.value)} /></Field>
          </div>
        </Section>

        <Section title="Sound Level Meter & Kalibrasi">
          <div style={grid3}>
            <Field label="Merk / Tipe SLM"><input className="admin-input" style={inputStyle} value={f.slm_merk_tipe} onChange={(e) => set('slm_merk_tipe', e.target.value)} /></Field>
            <Field label="No. Seri"><input className="admin-input" style={inputStyle} value={f.slm_serial} onChange={(e) => set('slm_serial', e.target.value)} /></Field>
            <Field label="Kelas SLM"><select className="admin-input" style={inputStyle} value={f.slm_kelas} onChange={(e) => set('slm_kelas', e.target.value)}><option value="1">Kelas 1</option><option value="2">Kelas 2</option></select></Field>
            <Field label="Sertifikat Kalibrasi Berlaku s/d"><input type="date" className="admin-input" style={inputStyle} value={f.sertifikat_kalibrasi_sd} onChange={(e) => set('sertifikat_kalibrasi_sd', e.target.value)} /></Field>
            <Field label="Kalibrasi Sebelum (dB)"><input type="number" step="0.1" className="admin-input" style={inputStyle} value={f.kalibrasi_sebelum_db} onChange={(e) => set('kalibrasi_sebelum_db', e.target.value)} /></Field>
            <Field label="Kalibrasi Sesudah (dB)"><input type="number" step="0.1" className="admin-input" style={inputStyle} value={f.kalibrasi_sesudah_db} onChange={(e) => set('kalibrasi_sesudah_db', e.target.value)} /></Field>
          </div>
        </Section>

        <Section title="Titik Ukur (Leq dB(A), minimal 5 menit per titik)">
          {pts.map((p, i) => {
            const leq = parseFloat(p.leq_dba); const z = Number.isFinite(leq) ? zonaFromLeq(leq) : null;
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 110px 90px 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input style={smallInput} placeholder="Kode" value={p.kode_titik} onChange={(e) => setPts(pts.map((x, j) => j === i ? { ...x, kode_titik: e.target.value } : x))} />
                <input style={smallInput} placeholder="Deskripsi lokasi titik" value={p.deskripsi} onChange={(e) => setPts(pts.map((x, j) => j === i ? { ...x, deskripsi: e.target.value } : x))} />
                <input style={smallInput} type="number" step="0.1" placeholder="Leq dB(A)" value={p.leq_dba} onChange={(e) => setPts(pts.map((x, j) => j === i ? { ...x, leq_dba: e.target.value } : x))} />
                <input style={smallInput} type="number" placeholder="Menit" value={p.durasi_menit} onChange={(e) => setPts(pts.map((x, j) => j === i ? { ...x, durasi_menit: e.target.value } : x))} />
                <div>{z ? <Chip text={z} color={ZONA_COLOR[z]} /> : <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>-</span>}</div>
                <button type="button" disabled={pts.length === 1} onClick={() => setPts(pts.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E63946' }}><Trash2 size={14} /></button>
              </div>
            );
          })}
          <button type="button" className="admin-form-btn-secondary compact-btn" onClick={() => setPts([...pts, newPt(pts.length + 1)])}><Plus size={13} /> Tambah Titik</button>
          {zona && leqMax !== null && apt && (
            <div style={{ marginTop: 12, fontSize: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>Zona area (titik tertinggi {leqMax} dB(A)):</span><Chip text={zona} color={ZONA_COLOR[zona]} />
              <span>Ukur ulang paling lambat <b>{fmtDate(jatuhTempoUkur(f.tanggal, zona))}</b></span>
              <span>{apt.nrrMin ? `APT: NRR ≥ ${apt.nrrMin}${apt.kombinasi ? ' + kombinasi ear plug & ear muff (>100 dB(A))' : ''}` : 'APT tidak wajib'}</span>
            </div>
          )}
        </Section>

        <Section title="Pengendalian di Area">
          <div style={grid3}>
            <Field label="Rambu peringatan"><select className="admin-input" style={inputStyle} value={f.rambu_terpasang ? '1' : '0'} onChange={(e) => set('rambu_terpasang', e.target.value === '1')}><option value="0">Belum terpasang</option><option value="1">Terpasang</option></select></Field>
            <Field label="APT tersedia"><select className="admin-input" style={inputStyle} value={f.apt_tersedia ? '1' : '0'} onChange={(e) => set('apt_tersedia', e.target.value === '1')}><option value="0">Belum tersedia</option><option value="1">Tersedia</option></select></Field>
            <Field label="NRR APT yang tersedia"><input type="number" className="admin-input" style={inputStyle} value={f.apt_nrr_tersedia} onChange={(e) => set('apt_nrr_tersedia', e.target.value)} /></Field>
            <Field label="Catatan" full><textarea className="admin-input" style={{ ...inputStyle, height: 60, padding: 8 }} value={f.catatan} onChange={(e) => set('catatan', e.target.value)} /></Field>
          </div>
        </Section>
        <button type="submit" disabled={saving} className="admin-form-btn-primary">{saving ? 'Menyimpan…' : 'Simpan Noise Mapping'}</button>
      </form>

      <div className="admin-form-card" style={{ marginTop: 20 }}>
        <div className="admin-section-header"><h3 className="admin-section-title">Riwayat Noise Mapping</h3></div>
        <div style={{ overflow: 'auto' }}>
          <table style={tableStyle}>
            <thead><tr>{['Tanggal', 'Site / Area', 'Jenis', 'Titik', 'Leq maks', 'Zona', ''].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {list.map((s) => {
                const lq = (s.hc_noise_point || []).map((p: Row) => Number(p.leq_dba)); const mx = lq.length ? Math.max(...lq) : null;
                const z = mx === null ? null : zonaFromLeq(mx);
                return (
                  <tr key={s.id}>
                    <td style={tdStyle}>{fmtDate(s.tanggal)}</td><td style={tdStyle}>{s.hc_area?.site} — {s.hc_area?.nama_area}</td>
                    <td style={tdStyle}>{s.tipe === 'BERKALA' ? 'Berkala' : 'Perubahan proses'}</td><td style={tdStyle}>{lq.length}</td>
                    <td style={tdStyle}>{mx ?? '-'}</td><td style={tdStyle}>{z && <Chip text={z} color={ZONA_COLOR[z]} />}</td>
                    <td style={tdStyle}><button type="button" onClick={() => del(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E63946' }}><Trash2 size={13} /></button></td>
                  </tr>
                );
              })}
              {!list.length && <tr><td style={tdStyle} colSpan={7}>Belum ada data.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ───────────── KLASIFIKASI KARYAWAN ───────────── */
function ExposureTab({ areas, onMsg }: { areas: Row[]; onMsg: (m: any) => void }) {
  const blank = { nik: '', nama: '', national_id: '', departemen: '', jabatan: '', site: '', area_id: '', kategori: 'A', jam_per_hari_zona: '', tanggal_penetapan: todayStr(), catatan: '' };
  const [f, setF] = useState<Row>(blank);
  const [list, setList] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const load = useCallback(async () => { try { setList((await authFetch('/api/hc?resource=exposure')).data || []); } catch { /* abaikan */ } }, []);
  useEffect(() => { load(); }, [load]);

  const found = (e: EmployeeData) => setF((p) => ({
    ...p, nama: e.nama || p.nama, national_id: e.national_id || p.national_id, departemen: e.department || p.departemen,
    jabatan: e.job_position || p.jabatan, site: e.site_name || p.site,
  }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); onMsg(null); setSaving(true);
    try {
      await authFetch('/api/hc', { method: 'POST', body: JSON.stringify({ resource: 'exposure', ...f }) });
      onMsg({ kind: 'ok', text: 'Klasifikasi tersimpan.' }); setF(blank); load();
    } catch (err) { onMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan' }); }
    finally { setSaving(false); }
  };
  const del = async (id: string) => {
    if (!confirm('Hapus klasifikasi ini?')) return;
    try { await authFetch(`/api/hc?resource=exposure&id=${id}`, { method: 'DELETE' }); load(); }
    catch (err) { onMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Gagal menghapus' }); }
  };
  const siteAreas = areas.filter((a) => !f.site || a.site === f.site);
  const KET: Record<string, string> = { A: 'A — rutin ≥ 4 jam/hari di zona Kuning/Merah', B: 'B — insidental / intermiten', C: 'C — tidak terpajan' };

  return (
    <>
      <form onSubmit={submit}>
        <Section title="Klasifikasi Karyawan Terpajan Bising (STD/033 pasal 6.3)">
          <div style={grid2}>
            <EmployeeLookupInput value={f.nik} onChange={(v) => set('nik', v)} onEmployeeFound={found}
              placeholder="NIK Karyawan / NIK KTP / Nama" label={<span className="admin-label" style={{ marginBottom: 0 }}>Karyawan</span>} />
            <Field label="Nama"><input className="admin-input" style={inputStyle} required value={f.nama} onChange={(e) => set('nama', e.target.value)} /></Field>
            <Field label="Site"><select className="admin-input" style={inputStyle} value={f.site} onChange={(e) => set('site', e.target.value)}><option value="">-</option>{SITES.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Departemen"><input className="admin-input" style={inputStyle} value={f.departemen} onChange={(e) => set('departemen', e.target.value)} /></Field>
            <Field label="Jabatan"><input className="admin-input" style={inputStyle} value={f.jabatan} onChange={(e) => set('jabatan', e.target.value)} /></Field>
            <Field label="Area Kerja Utama"><select className="admin-input" style={inputStyle} value={f.area_id} onChange={(e) => set('area_id', e.target.value)}><option value="">-</option>{siteAreas.map((a) => <option key={a.area_id} value={a.area_id}>{a.site} — {a.nama_area}</option>)}</select></Field>
            <Field label="Kategori"><select className="admin-input" style={inputStyle} value={f.kategori} onChange={(e) => set('kategori', e.target.value)}>{Object.entries(KET).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Jam/hari di zona Kuning/Merah" hint={f.kategori === 'A' ? '(wajib ≥ 4)' : '(opsional)'}><input type="number" step="0.5" className="admin-input" style={inputStyle} value={f.jam_per_hari_zona} onChange={(e) => set('jam_per_hari_zona', e.target.value)} /></Field>
            <Field label="Tanggal Penetapan"><input type="date" className="admin-input" style={inputStyle} value={f.tanggal_penetapan} onChange={(e) => set('tanggal_penetapan', e.target.value)} /></Field>
            <Field label="Catatan"><input className="admin-input" style={inputStyle} value={f.catatan} onChange={(e) => set('catatan', e.target.value)} /></Field>
          </div>
        </Section>
        <button type="submit" disabled={saving} className="admin-form-btn-primary">{saving ? 'Menyimpan…' : 'Simpan Klasifikasi'}</button>
      </form>
      <div className="admin-form-card" style={{ marginTop: 20 }}>
        <div className="admin-section-header"><h3 className="admin-section-title">Klasifikasi Terkini ({list.length} karyawan)</h3></div>
        <div style={{ overflow: 'auto', maxHeight: 360 }}>
          <table style={tableStyle}>
            <thead><tr>{['Nama', 'NIK', 'Site', 'Jabatan', 'Kat.', 'Jam/hari', 'Ditetapkan', ''].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}><td style={tdStyle}>{r.nama}</td><td style={tdStyle}>{r.nik}</td><td style={tdStyle}>{r.site}</td><td style={tdStyle}>{r.jabatan}</td>
                  <td style={tdStyle}><Chip text={r.kategori} color={r.kategori === 'A' ? '#E63946' : r.kategori === 'B' ? '#F5A623' : '#00B894'} /></td>
                  <td style={tdStyle}>{r.jam_per_hari_zona ?? '-'}</td><td style={tdStyle}>{fmtDate(r.tanggal_penetapan)}</td>
                  <td style={tdStyle}><button type="button" onClick={() => del(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E63946' }}><Trash2 size={13} /></button></td></tr>
              ))}
              {!list.length && <tr><td style={tdStyle} colSpan={8}>Belum ada data.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ───────────── MASTER AREA ───────────── */
function AreaTab({ areas, onMsg, onChanged }: { areas: Row[]; onMsg: (m: any) => void; onChanged: () => void }) {
  const [site, setSite] = useState(''); const [nama, setNama] = useState(''); const [sumber, setSumber] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); onMsg(null);
    try {
      await authFetch('/api/hc', { method: 'POST', body: JSON.stringify({ resource: 'area', site, nama_area: nama, sumber_bising: sumber }) });
      setNama(''); setSumber(''); onChanged(); onMsg({ kind: 'ok', text: 'Area tersimpan.' });
    } catch (err) { onMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan' }); }
  };
  const off = async (id: string) => {
    if (!confirm('Nonaktifkan area ini? Riwayat ukur tetap tersimpan.')) return;
    try { await authFetch(`/api/hc?resource=area&id=${id}`, { method: 'DELETE' }); onChanged(); }
    catch (err) { onMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Gagal' }); }
  };
  return (
    <>
      <form onSubmit={submit}>
        <Section title="Tambah Area Kerja">
          <div style={grid3}>
            <Field label="Site"><select className="admin-input" style={inputStyle} required value={site} onChange={(e) => setSite(e.target.value)}><option value="">Pilih…</option>{SITES.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Nama Area"><input className="admin-input" style={inputStyle} required value={nama} onChange={(e) => setNama(e.target.value)} placeholder="mis. Workshop, Crusher, Genset" /></Field>
            <Field label="Sumber Bising"><input className="admin-input" style={inputStyle} value={sumber} onChange={(e) => setSumber(e.target.value)} /></Field>
          </div>
        </Section>
        <button type="submit" className="admin-form-btn-primary">Simpan Area</button>
      </form>
      <div className="admin-form-card" style={{ marginTop: 20 }}>
        <div className="admin-section-header"><h3 className="admin-section-title">Area Terdaftar</h3></div>
        <table style={tableStyle}>
          <thead><tr>{['Site', 'Area', 'Zona terkini', 'Ukur terakhir', 'Jatuh tempo', ''].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>
            {areas.map((a) => (
              <tr key={a.area_id}><td style={tdStyle}>{a.site}</td><td style={tdStyle}>{a.nama_area}</td>
                <td style={tdStyle}>{a.zona ? <Chip text={a.zona} color={ZONA_COLOR[a.zona as Zona]} /> : <Chip text="BELUM DIUKUR" color="#778899" />}</td>
                <td style={tdStyle}>{fmtDate(a.tanggal_ukur)}</td>
                <td style={tdStyle}>{a.jatuh_tempo ? fmtDate(a.jatuh_tempo) : '-'} {a.terlambat && a.zona && <Chip text="TERLAMBAT" color="#E63946" />}</td>
                <td style={tdStyle}><button type="button" onClick={() => off(a.area_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E63946' }}><Trash2 size={13} /></button></td></tr>
            ))}
            {!areas.length && <tr><td style={tdStyle} colSpan={6}>Belum ada area.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
