'use client';
// Illustrated Ergo survey — SVG posture diagrams per option + detailed text instructions
import { useMemo, useState } from 'react';
import { authFetch } from '@/lib/api-client';
import { FORM_NO, KLAS_COLOR, scoreErgo, type Metode } from '@/lib/hc-ergo';
import {
  Chip, Field, Notice, Section, SITES, Tabs,
  btnPrimaryStyle, grid3, inputStyle,
} from './hc-ergo-ui';
import EmployeeLookupInput, { type EmployeeData } from './EmployeeLookupInput';
import { RULA_GROUP_A, RULA_GROUP_B, ROSA_CHAIR, ROSA_PERIPH, WERA_QS, blankInput, type Q } from './ergo-questions';
import { PostureDiagram } from './PostureDiagram';

const CHECKS = [
  { key: 'ok_personil_kompeten', label: 'Personil pengukur kompeten (STD/036 pasal 6.8)' },
  { key: 'ok_metode_sesuai', label: 'Metode sesuai dengan jenis pekerjaan (pasal 6.6)' },
  { key: 'ok_kondisi_representatif', label: 'Kondisi kerja saat pengukuran representatif (pasal 6.7)' },
  { key: 'ok_dokumentasi_lengkap', label: 'Dokumentasi lengkap: foto & formulir (pasal 6.9)' },
];

const METHOD_META: Record<Metode, { form: string; source: string; steps: string[] }> = {
  RULA: {
    form: 'FORM/116',
    source: 'McAtamney & Corlett, Applied Ergonomics 1993 (worksheet resmi)',
    steps: [
      'Amati postur pekerja pada saat pekerjaan paling berat / paling sering dilakukan. Nilai sisi tubuh yang paling terpapar.',
      'Grup A (lengan & pergelangan): pilih skor sudut lengan atas, lengan bawah, pergelangan, dan putaran pergelangan. Tambahkan penyesuaian (+1 bahu terangkat/abduksi/ditopang; +1 lengan melintasi garis tengah; +1 deviasi radial/ulnar).',
      'Skor otot A: +1 jika postur statis >1 menit ATAU gerakan berulang ≥4× per menit. Skor beban A: 0 (<2 kg intermiten), 1 (2–10 kg intermiten), 2 (2–10 kg statis/berulang atau ≥10 kg intermiten), 3 (≥10 kg statis/berulang atau benturan).',
      'Grup B (leher, batang tubuh, kaki): pilih skor leher & batang tubuh (tambah +1 jika terpuntir/miring). Kaki: 1 jika tertopang seimbang, 2 jika tidak.',
      'Skor otot B & beban B memakai aturan yang sama dengan Grup A.',
      'Sistem menghitung skor akhir RULA 1–7: 1–2 dapat diterima; 3–4 investigasi lebih lanjut; 5–6 investigasi & ubah segera; 7 investigasi & ubah sekarang.',
    ],
  },
  ROSA: {
    form: 'FORM/117',
    source: 'Sonne, Villalta & Andrews, Applied Ergonomics 2012 (worksheet resmi)',
    steps: [
      'ROSA khusus stasiun kerja kantor (kursi + monitor/telepon + mouse/keyboard). Amati postur yang paling sering / paling buruk selama penggunaan komputer.',
      'Section A — Kursi: nilai tinggi kursi, kedalaman dudukan (pan), sandaran lengan, dan sandaran punggung sesuai deskripsi di setiap pilihan. Skor kursi digabung di matriks Section A.',
      'Perifer: nilai monitor (tinggi & jarak), telepon (headset vs dijepit bahu), mouse, dan keyboard. Setiap item punya skor dasar sesuai kondisi aktual.',
      'Durasi: jika posisi digunakan lama (mis. >4 jam/hari) pilih skor yang paling mewakili paparan aktual, bukan hanya postur sesaat.',
      'Skor akhir ROSA ≥5 = risiko tinggi — stasiun kerja perlu ditinjau dan diperbaiki. Skor lebih rendah tetap dicatat untuk baseline.',
    ],
  },
  WERA: {
    form: 'FORM/118',
    source: 'Rahman et al., Journal of Human Ergology 2011 (worksheet resmi)',
    steps: [
      'WERA menilai 9 faktor risiko fisik: bahu, pergelangan, punggung, leher, kaki (sikap & pengulangan), kekuatan, getaran, tekanan kontak, dan durasi tugas.',
      'Untuk setiap faktor, pilih LOW / MED / HIGH sesuai deskripsi di pilihan. Amati tugas nyata (boleh dibantu foto/video) tanpa mengganggu pekerjaan.',
      'Skor dijumlahkan otomatis. Interpretasi total: 18–27 risiko rendah (diterima); 28–44 risiko sedang (perlu perbaikan); 45–54 risiko tinggi (tindak lanjut segera).',
      'Fokus pada postur ekstrem, pengulangan tinggi, beban berat, getaran lama, kontak tepi tajam, dan kerja >4 jam/hari.',
    ],
  },
};

function QuestionBlock({ q, value, onChange }: { q: Q; value: number; onChange: (n: number) => void }) {
  return (
    <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
        {q.diagramKey && <PostureDiagram id={q.diagramKey} size={56} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontSize: 13, color: 'var(--foreground)' }}>{q.title}</b>
          {q.guide && (
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '4px 0 0', lineHeight: 1.4 }}>{q.guide}</p>
          )}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
        {q.options.map((o) => (
          <button
            key={o.score}
            type="button"
            onClick={() => onChange(o.score)}
            style={{
              textAlign: 'left',
              padding: '10px 12px',
              borderRadius: 10,
              border: value === o.score ? '2px solid var(--brand-primary, #ff4d00)' : '1px solid var(--border)',
              background: value === o.score ? 'rgba(255,77,0,0.08)' : 'var(--background)',
              cursor: 'pointer',
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              transition: 'border-color 0.15s, background 0.15s',
              width: '100%',
              fontFamily: 'inherit',
            }}
          >
            {o.diagram ? (
              <PostureDiagram id={o.diagram} size={48} />
            ) : (
              <span style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 13,
                background: value === o.score ? 'var(--brand-primary, #ff4d00)' : 'var(--muted)',
                color: value === o.score ? '#fff' : 'var(--foreground)',
              }}>
                {o.score}
              </span>
            )}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{
                display: 'inline-block', fontSize: 11, fontWeight: 800, marginBottom: 2,
                color: value === o.score ? 'var(--brand-primary, #ff4d00)' : 'var(--muted-foreground)',
              }}>
                Skor {o.score}
              </span>
              <span style={{ display: 'block', fontSize: 12, lineHeight: 1.35, color: 'var(--foreground)' }}>
                {o.label}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ErgoSurveyForm() {
  const today = new Date().toISOString().slice(0, 10);
  const blank = {
    sumber: 'INTERNAL', site: '', area_kerja: '', tanggal: today, departemen: '', aktivitas: '',
    personil_pengukur: '', kualifikasi_pengukur: '', pekerja_diamati: '', pekerja_nik: '', foto_url: '',
    ok_personil_kompeten: false, ok_metode_sesuai: false, ok_kondisi_representatif: false, ok_dokumentasi_lengkap: false,
  };
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

  const onPekerjaFound = (emp: EmployeeData) => {
    const jabatan = (emp.job_position || '').trim();
    setF((p) => ({
      ...p,
      pekerja_diamati: emp.nama || p.pekerja_diamati,
      pekerja_nik: emp.nik || p.pekerja_nik,
      departemen: emp.department || p.departemen,
      aktivitas: jabatan || p.aktivitas,
    }));
  };

  const setScore = (key: string, n: number) => setInput((p) => ({ ...p, [key]: n }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null); setSaving(true);
    try {
      const res = await authFetch('/api/ergo', {
        method: 'POST',
        body: JSON.stringify({ resource: 'survey', metode, ...f, input }),
      });
      setMsg(res.sah ? { kind: 'ok', text: 'Survei tersimpan dan menunggu persetujuan.' } : { kind: 'warn', text: res.pesan });
      setF({ ...blank, site: f.site, departemen: f.departemen, personil_pengukur: f.personil_pengukur, kualifikasi_pengukur: f.kualifikasi_pengukur });
      setInput(blankInput(metode));
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan' });
    } finally {
      setSaving(false);
    }
  };

  const meta = METHOD_META[metode];

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', width: '90%', margin: '0 auto' }}>
      <div className="admin-form-inner">
        <div style={{ marginBottom: 14 }}>
          <h1 className="admin-form-title">Survei Ergonomi</h1>
          <p className="admin-form-subtitle">
            Pengukuran internal minimal 1× per bulan (STD/036). Pilih skor sesuai postur yang diamati; ikuti petunjuk di bawah.
          </p>
        </div>

        <Tabs
          tabs={[
            { key: 'RULA', label: 'RULA (FORM/116)' },
            { key: 'ROSA', label: 'ROSA (FORM/117)' },
            { key: 'WERA', label: 'WERA (FORM/118)' },
          ]}
          value={metode}
          onChange={changeMetode}
        />

        <div style={{
          background: 'rgba(255,77,0,0.05)',
          border: '1px solid rgba(255,77,0,0.18)',
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 14,
        }}>
          <b style={{ fontSize: 12, color: 'var(--brand-primary, #ff4d00)', display: 'block', marginBottom: 6 }}>
            Petunjuk pengisian — {meta.form}
          </b>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 11, lineHeight: 1.55, color: 'var(--foreground)' }}>
            {meta.steps.map((s, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{s}</li>
            ))}
          </ol>
          <p style={{ fontSize: 10, margin: '8px 0 0', color: 'var(--muted-foreground)' }}>
            Sumber resmi: {meta.source}. Ilustrasi di setiap pilihan skor membantu membandingkan postur; prioritaskan deskripsi teks resmi.
          </p>
        </div>

        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

        <form onSubmit={submit}>
          <Section title={`Identitas Pengukuran — ${FORM_NO[metode]}`}>
            <div style={grid3}>
              <Field label="Sumber Survei">
                <select className="admin-input" style={inputStyle} value={f.sumber} onChange={(e) => set('sumber', e.target.value)}>
                  <option value="INTERNAL">Internal (Personil QSHE)</option>
                  <option value="PIHAK_KETIGA">Pihak ketiga</option>
                </select>
              </Field>
              <Field label="Site">
                <select className="admin-input" style={inputStyle} required value={f.site} onChange={(e) => set('site', e.target.value)}>
                  <option value="">Pilih…</option>
                  {SITES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Tanggal">
                <input type="date" className="admin-input" style={inputStyle} required value={f.tanggal} onChange={(e) => set('tanggal', e.target.value)} />
              </Field>
              <Field label="Area Kerja">
                <input className="admin-input" style={inputStyle} required value={f.area_kerja} onChange={(e) => set('area_kerja', e.target.value)} />
              </Field>
              <Field label="Departemen">
                <input className="admin-input" style={inputStyle} required value={f.departemen} onChange={(e) => set('departemen', e.target.value)} />
              </Field>
              <Field label={metode === 'ROSA' ? 'Pekerjaan / Jabatan yang Dinilai' : 'Aktivitas / Pekerjaan'}>
                <input className="admin-input" style={inputStyle} required value={f.aktivitas} onChange={(e) => set('aktivitas', e.target.value)} placeholder="Otomatis dari jabatan karyawan" />
              </Field>
              <Field label="Personil Pengukur">
                <input className="admin-input" style={inputStyle} required value={f.personil_pengukur} onChange={(e) => set('personil_pengukur', e.target.value)} />
              </Field>
              <Field label="Kualifikasi / Kompetensi Pengukur">
                <input className="admin-input" style={inputStyle} required value={f.kualifikasi_pengukur}
                  onChange={(e) => set('kualifikasi_pengukur', e.target.value)} placeholder="mis. Sertifikat ergonomi" />
              </Field>
              <div style={{ gridColumn: '1 / -1' }}>
                <EmployeeLookupInput
                  value={f.pekerja_nik || ''}
                  onChange={(v) => set('pekerja_nik', v)}
                  onEmployeeFound={onPekerjaFound}
                  label={<>Pekerja yang Diamati <span style={{ color: '#ff4d00' }}>*</span></>}
                  placeholder="Cari NIK / Nama karyawan yang dinilai"
                  required
                />
                {f.pekerja_diamati && (
                  <p style={{ fontSize: 12, marginTop: 6, color: 'var(--muted-foreground)' }}>
                    Terpilih: <b style={{ color: 'var(--foreground)' }}>{f.pekerja_diamati}</b>
                    {f.pekerja_nik && <> · NIK {f.pekerja_nik}</>}
                    {f.aktivitas && <> · Jabatan: <b style={{ color: 'var(--foreground)' }}>{f.aktivitas}</b></>}
                    {f.departemen && <> · Dept: {f.departemen}</>}
                  </p>
                )}
              </div>
              <Field label="Link Foto / Dokumentasi" hint="(Google Drive)" full>
                <input className="admin-input" style={inputStyle} value={f.foto_url} onChange={(e) => set('foto_url', e.target.value)} />
              </Field>
            </div>
          </Section>

          {metode === 'RULA' && (
            <>
              <Section title="Grup A — Lengan & Pergelangan Tangan (RULA)">
                {RULA_GROUP_A.map((q) => (
                  <QuestionBlock key={q.key} q={q} value={input[q.key] ?? q.options[0].score} onChange={(n) => setScore(q.key, n)} />
                ))}
              </Section>
              <Section title="Grup B — Leher, Batang Tubuh & Kaki (RULA)">
                {RULA_GROUP_B.map((q) => (
                  <QuestionBlock key={q.key} q={q} value={input[q.key] ?? q.options[0].score} onChange={(n) => setScore(q.key, n)} />
                ))}
              </Section>
            </>
          )}

          {metode === 'ROSA' && (
            <>
              <Section title="Section A — Kursi (ROSA)">
                {ROSA_CHAIR.map((q) => (
                  <QuestionBlock key={q.key} q={q} value={input[q.key] ?? q.options[0].score} onChange={(n) => setScore(q.key, n)} />
                ))}
              </Section>
              <Section title="Perifer — Monitor, Telepon, Mouse, Keyboard (ROSA)">
                {ROSA_PERIPH.map((q) => (
                  <QuestionBlock key={q.key} q={q} value={input[q.key] ?? 0} onChange={(n) => setScore(q.key, n)} />
                ))}
              </Section>
            </>
          )}

          {metode === 'WERA' && (
            <Section title="9 Faktor Risiko Fisik (WERA)">
              {WERA_QS.map((q) => (
                <QuestionBlock key={q.key} q={q} value={input[q.key] ?? 1} onChange={(n) => setScore(q.key, n)} />
              ))}
            </Section>
          )}

          <Section title="Hasil, Keabsahan & Pengesahan QSHE Manager">
            <div style={{ marginBottom: 12, fontSize: 13, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {preview.ok ? (
                <>
                  <span>Skor akhir:</span>
                  <b style={{ fontSize: 22 }}>{preview.skorAkhir}</b>
                  <Chip text={preview.klasifikasi.replace('_', ' ')} color={KLAS_COLOR[preview.klasifikasi]} />
                  {preview.perluPica && <Chip text="PERLU PICA" color="#E63946" />}
                  {preview.batasHari && <span>Tindak lanjut maks. <b>{preview.batasHari} hari kerja</b></span>}
                </>
              ) : (
                <span style={{ color: '#E63946' }}>{preview.error}</span>
              )}
            </div>
            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
              {CHECKS.map((c) => (
                <label key={c.key} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!f[c.key]} onChange={(e) => set(c.key, e.target.checked)} />
                  {c.label}
                </label>
              ))}
            </div>
            <div style={{ background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
              <b style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>Pengesahan QSHE Manager</b>
              <div style={grid3}>
                <Field label="Nama QSHE Manager">
                  <input className="admin-input" style={inputStyle} required value={f.qshe_manager_nama || ''} onChange={(e) => set('qshe_manager_nama', e.target.value)} />
                </Field>
                <Field label="NIK QSHE Manager">
                  <input className="admin-input" style={inputStyle} required value={f.qshe_manager_nik || ''} onChange={(e) => set('qshe_manager_nik', e.target.value)} />
                </Field>
                <Field label="Tanggal Pengesahan">
                  <input type="date" className="admin-input" style={inputStyle} required value={f.qshe_manager_tgl || today} onChange={(e) => set('qshe_manager_tgl', e.target.value)} />
                </Field>
              </div>
            </div>
          </Section>

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button type="submit" disabled={saving || !preview.ok} className="admin-form-btn-primary" style={btnPrimaryStyle}>
              {saving ? 'Menyimpan…' : 'Simpan Survei & Ajukan Pengesahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
