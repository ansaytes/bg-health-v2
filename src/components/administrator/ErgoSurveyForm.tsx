'use client';
// Halaman Administrator > Ergonomi (panel "Input Survei"). Form RULA (FORM/116), ROSA (FORM/117), WERA (FORM/118).
// Skor dihitung ulang di server (api/ergo); preview di sini memakai fungsi yang sama (lib/hc-ergo.ts).
import { useMemo, useState } from 'react';
import { authFetch } from '@/lib/api-client';
import { FORM_NO, KLAS_COLOR, scoreErgo, type Metode } from '@/lib/hc-ergo';
import { Chip, Field, Notice, Section, SITES, Tabs, grid2, grid3, inputStyle } from './hc-ergo-ui';

const METHOD_IMAGES: Record<Metode, { title: string; url: string; desc: string }> = {
  RULA: {
    title: 'RULA Worksheet Reference (FORM/116 — STD/036)',
    url: 'https://ergo-plus.com/wp-content/uploads/RULA-Assessment-Tool.jpg',
    desc: 'Rujukan resmi RULA: Menilai Grup A (Lengan Atas, Lengan Bawah, Pergelangan Tangan) dan Grup B (Leher, Batang Tubuh, Kaki) beserta faktor beban dan otot.',
  },
  ROSA: {
    title: 'ROSA Worksheet Reference (FORM/117 — STD/036)',
    url: 'https://ergo-plus.com/wp-content/uploads/ROSA-Rapid-Office-Strain-Assessment.jpg',
    desc: 'Rujukan resmi ROSA: Menilai Stasiun Kerja Perkantoran (Kursi: Tinggi, Kedalaman, Sandaran Lengan, Punggung, Monitor, Telepon, Mouse, Keyboard).',
  },
  WERA: {
    title: 'WERA Worksheet Reference (FORM/118 — INK/013)',
    url: 'https://www.researchgate.net/profile/Shariat-A/publication/283296225/figure/fig1/AS:669044238510091@1538012644256/Workplace-Ergonomic-Risk-Assessment-WERA-method.png',
    desc: 'Rujukan resmi WERA: Penilaian 9 faktor risiko fisik (Sikap Bahu, Pergelangan, Punggung, Leher, Kaki, Kekuatan, Getaran, Tekanan Langsung, Durasi).',
  },
};

const RULA_A: Def[] = [
  { key: 'upper_arm', label: 'Upper arm', min: 1, max: 6 }, { key: 'lower_arm', label: 'Lower arm', min: 1, max: 3 },
  { key: 'wrist', label: 'Wrist', min: 1, max: 4 }, { key: 'wrist_twist', label: 'Wrist twist (1=T1, 2=T2)', min: 1, max: 2 },
  { key: 'muscle_a', label: 'Skor otot (grup A)', min: 0, max: 1 }, { key: 'force_a', label: 'Skor beban/tenaga (grup A)', min: 0, max: 3 },
];
const RULA_B: Def[] = [
  { key: 'neck', label: 'Neck', min: 1, max: 6 }, { key: 'trunk', label: 'Trunk', min: 1, max: 6 }, { key: 'legs', label: 'Legs', min: 1, max: 2 },
  { key: 'muscle_b', label: 'Skor otot (grup B)', min: 0, max: 1 }, { key: 'force_b', label: 'Skor beban/tenaga (grup B)', min: 0, max: 3 },
];
const ROSA_DEF: Def[] = [
  { key: 'chair_height', label: 'A. Tinggi kursi', min: 1, max: 5, hint: 'Lutut 90°=1; terlalu rendah/tinggi=2; kaki tak menapak=3; +1 ruang kolong kurang; +1 tak adjustable' },
  { key: 'pan_depth', label: 'B. Kedalaman dudukan', min: 1, max: 3, hint: 'Jarak ±8 cm dari lutut=1; terlalu panjang/pendek=2; +1 tak adjustable' },
  { key: 'armrest', label: 'C. Sandaran tangan', min: 1, max: 5, hint: 'Siku tersangga & bahu rileks=1; terlalu tinggi/rendah=2; +1 permukaan keras, +1 terlalu lebar, +1 tak adjustable' },
  { key: 'backrest', label: 'D. Sandaran punggung', min: 1, max: 4, hint: 'Lumbar baik, 95–110°=1; tanpa lumbar / sudut salah=2; +1 meja terlalu tinggi, +1 tak adjustable' },
  { key: 'monitor', label: 'Monitor', min: 0, max: 7, hint: 'Skor akhir monitor termasuk tambahan (silau, dokumen, leher terpuntir, jarak)' },
  { key: 'phone', label: 'Telepon', min: 0, max: 6, hint: 'Skor akhir telepon termasuk tambahan (tanpa hands-free)' },
  { key: 'mouse', label: 'Mouse', min: 0, max: 7, hint: 'Skor akhir mouse termasuk tambahan (pinch grip, palmrest, beda permukaan)' },
  { key: 'keyboard', label: 'Keyboard', min: 0, max: 7, hint: 'Skor akhir keyboard termasuk tambahan (deviasi, terlalu tinggi, jangkauan atas)' },
];
const WERA_DEF: Def[] = [
  { key: 'bahu_sikap', label: '1a. Bahu — sikap', min: 1, max: 3, lvl: true }, { key: 'bahu_ulang', label: '1b. Bahu — pengulangan', min: 1, max: 3, lvl: true },
  { key: 'tangan_sikap', label: '2a. Pergelangan tangan — sikap', min: 1, max: 3, lvl: true }, { key: 'tangan_ulang', label: '2b. Pergelangan tangan — pengulangan', min: 1, max: 3, lvl: true },
  { key: 'punggung_sikap', label: '3a. Punggung — sikap', min: 1, max: 3, lvl: true }, { key: 'punggung_ulang', label: '3b. Punggung — pengulangan', min: 1, max: 3, lvl: true },
  { key: 'leher_sikap', label: '4a. Leher — sikap', min: 1, max: 3, lvl: true }, { key: 'leher_ulang', label: '4b. Leher — pengulangan', min: 1, max: 3, lvl: true },
  { key: 'kaki_sikap', label: '5a. Kaki — sikap', min: 1, max: 3, lvl: true },
  { key: 'lvl_kuat', label: '6. Kuat (angkat beban: 0-5 / 5-10 / >10 kg)', min: 1, max: 3, lvl: true },
  { key: 'lvl_getaran', label: '7. Getaran (<1 / 1-4 / >4 jam per hari)', min: 1, max: 3, lvl: true },
  { key: 'lvl_tekanan', label: '8. Tekanan langsung (sarung tangan / keras / tanpa)', min: 1, max: 3, lvl: true },
  { key: 'lvl_durasi', label: '9. Durasi kerja (<2 / 2-4 / >4 jam per hari)', min: 1, max: 3, lvl: true },
];
const LVL = ['', 'LOW', 'MED', 'HIGH'];
const DEFS: Record<Metode, Def[]> = { RULA: [...RULA_A, ...RULA_B], ROSA: ROSA_DEF, WERA: WERA_DEF };
const blankInput = (m: Metode) => Object.fromEntries(DEFS[m].map((d) => [d.key, d.min]));

const CHECKS: { key: string; label: string }[] = [
  { key: 'ok_personil_kompeten', label: 'Personil pengukur kompeten (STD/036 pasal 6.8)' },
  { key: 'ok_metode_sesuai', label: 'Metode sesuai dengan jenis pekerjaan (pasal 6.6)' },
  { key: 'ok_kondisi_representatif', label: 'Kondisi kerja saat pengukuran representatif (pasal 6.7)' },
  { key: 'ok_dokumentasi_lengkap', label: 'Dokumentasi lengkap: foto & formulir (pasal 6.9)' },
];

export default function ErgoSurveyForm() {
  const today = new Date().toISOString().slice(0, 10);
  const blank = { sumber: 'INTERNAL', site: '', area_kerja: '', tanggal: today, departemen: '', aktivitas: '', personil_pengukur: '', kualifikasi_pengukur: '', pekerja_diamati: '', foto_url: '',
    ok_personil_kompeten: false, ok_metode_sesuai: false, ok_kondisi_representatif: false, ok_dokumentasi_lengkap: false };
  const [metode, setMetode] = useState<Metode>('RULA');
  const [f, setF] = useState<Record<string, any>>(blank);
  const [input, setInput] = useState<Record<string, number>>(blankInput('RULA'));
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'warn'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  const preview = useMemo(() => {
    try { return { ok: true as const, ...scoreErgo(metode, input) }; }
    catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : 'Input tidak valid' }; }
  }, [metode, input]);

  const changeMetode = (m: Metode) => { setMetode(m); setInput(blankInput(m)); setMsg(null); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null); setSaving(true);
    try {
      const res = await authFetch('/api/ergo', { method: 'POST', body: JSON.stringify({ resource: 'survey', metode, ...f, input }) });
      setMsg(res.sah ? { kind: 'ok', text: 'Survei tersimpan dan menunggu persetujuan.' } : { kind: 'warn', text: res.pesan });
      setF({ ...blank, site: f.site, departemen: f.departemen, personil_pengukur: f.personil_pengukur, kualifikasi_pengukur: f.kualifikasi_pengukur });
      setInput(blankInput(metode));
    } catch (err) { setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan' }); }
    finally { setSaving(false); }
  };

  const sel = (d: Def) => (
    <Field key={d.key} label={d.label} hint={d.hint ? `— ${d.hint}` : undefined}>
      <select className="admin-input" style={inputStyle} value={input[d.key]} onChange={(e) => setInput({ ...input, [d.key]: Number(e.target.value) })}>
        {Array.from({ length: d.max - d.min + 1 }, (_, i) => d.min + i).map((n) => <option key={n} value={n}>{d.lvl ? `${n} — ${LVL[n]}` : n}</option>)}
      </select>
    </Field>
  );

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', width: '90%', margin: '0 auto' }}>
      <div className="admin-form-inner">
        <div style={{ marginBottom: 14 }}>
          <h1 className="admin-form-title">Survei Ergonomi</h1>
          <p className="admin-form-subtitle">Pengukuran internal minimal 1× per bulan; survei pihak ketiga minimal 1× per tahun (STD/036). Isi skor segmen sesuai pedoman pada formulir.</p>
        </div>
        <Tabs tabs={[{ key: 'RULA', label: 'RULA (FORM/116)' }, { key: 'ROSA', label: 'ROSA (FORM/117)' }, { key: 'WERA', label: 'WERA (FORM/118)' }]} value={metode} onChange={changeMetode} />
        {/* Official Reference Diagram / Image Card */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ fontSize: 13, color: 'var(--brand-primary, #ff4d00)' }}>🖼️ Rujukan Visual / Gambar Resmi Asli — {METHOD_IMAGES[metode].title}</b>
            <span style={{ fontSize: 10, background: 'rgba(255,77,0,0.1)', color: '#ff4d00', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>STANDAR QSHE</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>{METHOD_IMAGES[metode].desc}</p>
          <div style={{ background: '#00000008', border: '1px solid var(--border)', borderRadius: 8, padding: 8, textAlign: 'center', overflow: 'hidden' }}>
            <img
              src={METHOD_IMAGES[metode].url}
              alt={METHOD_IMAGES[metode].title}
              style={{ maxWidth: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 6, display: 'block', margin: '0 auto' }}
              onError={(e) => {
                (e.currentTarget.parentElement as HTMLElement).innerHTML = '<div style="padding: 20px; font-size: 12px; color: var(--muted-foreground);">Gambar rujukan resmi ' + metode + ' termuat dari standar formulir ' + FORM_NO[metode] + '. Pastikan koneksi aktif untuk melihat diagram visual.</div>';
              }}
            />
          </div>
        </div>

        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <form onSubmit={submit}>
          <Section title={`Identitas Pengukuran — ${FORM_NO[metode]}`}>
            <div style={grid3}>
              <Field label="Sumber Survei"><select className="admin-input" style={inputStyle} value={f.sumber} onChange={(e) => set('sumber', e.target.value)}><option value="INTERNAL">Internal (Personil QSHE)</option><option value="PIHAK_KETIGA">Pihak ketiga</option></select></Field>
              <Field label="Site"><select className="admin-input" style={inputStyle} required value={f.site} onChange={(e) => set('site', e.target.value)}><option value="">Pilih…</option>{SITES.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Tanggal"><input type="date" className="admin-input" style={inputStyle} required value={f.tanggal} onChange={(e) => set('tanggal', e.target.value)} /></Field>
              <Field label="Area Kerja"><input className="admin-input" style={inputStyle} required value={f.area_kerja} onChange={(e) => set('area_kerja', e.target.value)} /></Field>
              <Field label="Departemen"><input className="admin-input" style={inputStyle} required value={f.departemen} onChange={(e) => set('departemen', e.target.value)} /></Field>
              <Field label={metode === 'ROSA' ? 'Pekerjaan / Jabatan yang Dinilai' : 'Aktivitas / Pekerjaan'}><input className="admin-input" style={inputStyle} required value={f.aktivitas} onChange={(e) => set('aktivitas', e.target.value)} /></Field>
              <Field label="Personil Pengukur"><input className="admin-input" style={inputStyle} required value={f.personil_pengukur} onChange={(e) => set('personil_pengukur', e.target.value)} /></Field>
              <Field label="Kualifikasi / Kompetensi Pengukur"><input className="admin-input" style={inputStyle} required value={f.kualifikasi_pengukur} onChange={(e) => set('kualifikasi_pengukur', e.target.value)} placeholder="mis. Sertifikat ergonomi / pelatihan internal" /></Field>
              <Field label="Pekerja yang Diamati"><input className="admin-input" style={inputStyle} required value={f.pekerja_diamati} onChange={(e) => set('pekerja_diamati', e.target.value)} /></Field>
              <Field label="Link Foto / Dokumentasi" hint="(Google Drive)" full><input className="admin-input" style={inputStyle} value={f.foto_url} onChange={(e) => set('foto_url', e.target.value)} /></Field>
            </div>
          </Section>

          {metode === 'RULA' && (<>
            <Section title="Grup A — Lengan & Pergelangan Tangan"><div style={grid3}>{RULA_A.map(sel)}</div></Section>
            <Section title="Grup B — Leher, Batang Tubuh & Kaki"><div style={grid3}>{RULA_B.map(sel)}</div></Section>
          </>)}
          {metode === 'ROSA' && <Section title="Komponen ROSA (kursi, monitor, telepon, mouse, keyboard)"><div style={grid2}>{ROSA_DEF.map(sel)}</div></Section>}
          {metode === 'WERA' && <Section title="9 Faktor Risiko Fisik (1=LOW, 2=MED, 3=HIGH)"><div style={grid2}>{WERA_DEF.map(sel)}</div></Section>}

          <Section title="Hasil, Keabsahan & Pengesahan QSHE Manager">
            <div style={{ marginBottom: 12, fontSize: 13, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {preview.ok ? (<>
                <span>Skor akhir:</span><b style={{ fontSize: 22 }}>{preview.skorAkhir}</b>
                <Chip text={preview.klasifikasi.replace('_', ' ')} color={KLAS_COLOR[preview.klasifikasi]} />
                {preview.perluPica && <Chip text="PERLU PICA" color="#E63946" />}
                {preview.batasHari && <span>Tindak lanjut maks. <b>{preview.batasHari} hari kerja</b></span>}
              </>) : <span style={{ color: '#E63946' }}>{preview.error}</span>}
            </div>
            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
              {CHECKS.map((c) => (
                <label key={c.key} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!f[c.key]} onChange={(e) => set(c.key, e.target.checked)} /> {c.label}
                </label>
              ))}
            </div>

            {/* QHSE Manager Signature Block */}
            <div style={{ background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginTop: 12 }}>
              <b style={{ fontSize: 12, display: 'block', marginBottom: 8, color: 'var(--foreground)' }}>✍️ Pengesahan & Tanda Tangan QSHE Manager (Wajib Sesuai Standar Form)</b>
              <div style={grid3}>
                <Field label="Nama QSHE Manager"><input className="admin-input" style={inputStyle} required value={f.qshe_manager_nama || ''} onChange={(e) => set('qshe_manager_nama', e.target.value)} placeholder="Nama lengkap & gelar" /></Field>
                <Field label="NIK QSHE Manager"><input className="admin-input" style={inputStyle} required value={f.qshe_manager_nik || ''} onChange={(e) => set('qshe_manager_nik', e.target.value)} placeholder="NIK Karyawan" /></Field>
                <Field label="Tanggal Pengesahan"><input type="date" className="admin-input" style={inputStyle} required value={f.qshe_manager_tgl || new Date().toISOString().slice(0, 10)} onChange={(e) => set('qshe_manager_tgl', e.target.value)} /></Field>
              </div>
            </div>

            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 8 }}>Jika salah satu syarat tidak terpenuhi atau pengesahan kosong, hasil dinyatakan tidak sah dan pengukuran wajib diulang (STD/036 pasal 6.10).</p>
          </Section>

          {/* Symmetrical Button Container */}
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button type="submit" disabled={saving || !preview.ok} className="admin-form-btn-primary" style={{ flex: 1, height: 42, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {saving ? 'Menyimpan…' : 'Simpan Survei & Ajukan Pengesahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
