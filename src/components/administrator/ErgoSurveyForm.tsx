'use client';
// Halaman Administrator > Ergonomi (panel "Input Survei").
// Form RULA / ROSA / WERA bergaya soal bergambar — deskripsi sikap mengikuti worksheet resmi
// (McAtamney & Corlett 1993, Sonne et al. 2012, Rahman et al. 2011). Skor dihitung di lib/hc-ergo.ts.
import { useMemo, useState } from 'react';
import { authFetch } from '@/lib/api-client';
import { FORM_NO, KLAS_COLOR, scoreErgo, type Metode } from '@/lib/hc-ergo';
import {
  Chip, Field, Notice, Section, SITES, Tabs, ScoreOptionCard,
  btnPrimaryStyle, grid2, grid3, inputStyle,
} from './hc-ergo-ui';
import EmployeeLookupInput, { type EmployeeData } from './EmployeeLookupInput';

type Opt = { score: number; label: string };
type Q = { key: string; title: string; guide?: string; options: Opt[] };

const RULA_GROUP_A: Q[] = [
  {
    key: 'upper_arm',
    title: '1. Upper Arm (Lengan Atas)',
    guide: 'Lihat sudut lengan atas terhadap batang tubuh. Tambahan +1 jika bahu terangkat / lengan abduksi / lengan ditopang.',
    options: [
      { score: 1, label: '20° ekstensi s/d 20° fleksi' },
      { score: 2, label: '>20° ekstensi ATAU 20°–45° fleksi' },
      { score: 3, label: '45°–90° fleksi' },
      { score: 4, label: '>90° fleksi' },
      { score: 5, label: 'Skor dasar +1 (bahu terangkat / abduksi / ditopang)' },
      { score: 6, label: 'Skor dasar +2 (kombinasi penyesuaian)' },
    ],
  },
  {
    key: 'lower_arm',
    title: '2. Lower Arm (Lengan Bawah)',
    guide: 'Sudut siku. +1 jika bekerja di garis tengah tubuh atau keluar dari sisi tubuh.',
    options: [
      { score: 1, label: '60°–100° fleksi' },
      { score: 2, label: '<60° atau >100° fleksi' },
      { score: 3, label: 'Skor dasar +1 (melintasi garis tengah / keluar sisi tubuh)' },
    ],
  },
  {
    key: 'wrist',
    title: '3. Wrist (Pergelangan Tangan)',
    guide: 'Sudut pergelangan terhadap posisi netral.',
    options: [
      { score: 1, label: 'Posisi netral' },
      { score: 2, label: '0°–15° fleksi / ekstensi' },
      { score: 3, label: '>15° fleksi / ekstensi' },
      { score: 4, label: 'Skor dasar +1 (deviasi radial/ulnar)' },
    ],
  },
  {
    key: 'wrist_twist',
    title: '4. Wrist Twist (Putaran Pergelangan)',
    options: [
      { score: 1, label: 'T1 — Putaran di rentang tengah' },
      { score: 2, label: 'T2 — Putaran di ujung rentang' },
    ],
  },
  {
    key: 'muscle_a',
    title: '5. Skor Otot — Grup A',
    guide: '+1 jika postur statis >1 menit ATAU gerakan berulang >4× per menit.',
    options: [
      { score: 0, label: 'Tidak ada (postur dinamis / tidak berulang)' },
      { score: 1, label: 'Ya — statis >1 menit atau berulang >4×/menit' },
    ],
  },
  {
    key: 'force_a',
    title: '6. Skor Beban / Tenaga — Grup A',
    options: [
      { score: 0, label: 'Beban <2 kg (intermiten)' },
      { score: 1, label: '2–10 kg intermiten' },
      { score: 2, label: '2–10 kg statis / berulang, atau ≥10 kg intermiten' },
      { score: 3, label: '≥10 kg statis / berulang, atau benturan / gaya mendadak' },
    ],
  },
];

const RULA_GROUP_B: Q[] = [
  {
    key: 'neck',
    title: '7. Neck (Leher)',
    guide: '+1 jika leher terpuntir atau miring ke samping.',
    options: [
      { score: 1, label: '0°–10° fleksi' },
      { score: 2, label: '10°–20° fleksi' },
      { score: 3, label: '>20° fleksi' },
      { score: 4, label: 'Ekstensi' },
      { score: 5, label: 'Skor dasar +1 (puntir / miring)' },
      { score: 6, label: 'Skor dasar +2 (kombinasi penyesuaian)' },
    ],
  },
  {
    key: 'trunk',
    title: '8. Trunk (Batang Tubuh)',
    guide: '+1 jika batang tubuh terpuntir atau miring ke samping.',
    options: [
      { score: 1, label: 'Duduk / berdiri tegak' },
      { score: 2, label: '0°–20° fleksi' },
      { score: 3, label: '20°–60° fleksi' },
      { score: 4, label: '>60° fleksi' },
      { score: 5, label: 'Skor dasar +1 (puntir / miring)' },
      { score: 6, label: 'Skor dasar +2 (kombinasi penyesuaian)' },
    ],
  },
  {
    key: 'legs',
    title: '9. Legs (Kaki)',
    options: [
      { score: 1, label: 'Kaki & tumit tertopang, beban seimbang' },
      { score: 2, label: 'Kaki tidak tertopang / beban tidak seimbang' },
    ],
  },
  {
    key: 'muscle_b',
    title: '10. Skor Otot — Grup B',
    guide: '+1 jika postur statis >1 menit ATAU gerakan berulang >4× per menit.',
    options: [
      { score: 0, label: 'Tidak ada' },
      { score: 1, label: 'Ya — statis >1 menit atau berulang >4×/menit' },
    ],
  },
  {
    key: 'force_b',
    title: '11. Skor Beban / Tenaga — Grup B',
    options: [
      { score: 0, label: 'Beban <2 kg (intermiten)' },
      { score: 1, label: '2–10 kg intermiten' },
      { score: 2, label: '2–10 kg statis / berulang, atau ≥10 kg intermiten' },
      { score: 3, label: '≥10 kg statis / berulang, atau benturan / gaya mendadak' },
    ],
  },
];

const ROSA_CHAIR: Q[] = [
  {
    key: 'chair_height',
    title: 'A. Tinggi Kursi',
    guide: 'Mulai dari skor dasar, lalu tambahkan penalti sesuai worksheet resmi.',
    options: [
      { score: 1, label: 'Lutut 90°, kaki menapak rata' },
      { score: 2, label: 'Terlalu tinggi ATAU terlalu rendah' },
      { score: 3, label: 'Kaki tidak menapak / bergelantungan' },
      { score: 4, label: 'Skor dasar +1 (ruang kolong kurang)' },
      { score: 5, label: 'Skor dasar +1 lagi (kursi tidak adjustable)' },
    ],
  },
  {
    key: 'pan_depth',
    title: 'B. Kedalaman Dudukan',
    options: [
      { score: 1, label: 'Jarak ~8 cm antara tepi dudukan dan lutut' },
      { score: 2, label: 'Terlalu panjang ATAU terlalu pendek' },
      { score: 3, label: 'Skor dasar +1 (tidak adjustable)' },
    ],
  },
  {
    key: 'armrest',
    title: 'C. Sandaran Tangan (Armrest)',
    options: [
      { score: 1, label: 'Siku tersangga, bahu rileks' },
      { score: 2, label: 'Terlalu tinggi ATAU terlalu rendah' },
      { score: 3, label: 'Skor dasar +1 (permukaan keras / tajam)' },
      { score: 4, label: 'Skor dasar +1 (terlalu lebar)' },
      { score: 5, label: 'Skor dasar +1 (tidak adjustable)' },
    ],
  },
  {
    key: 'backrest',
    title: 'D. Sandaran Punggung',
    options: [
      { score: 1, label: 'Dukungan lumbar baik, sudut 95°–110°' },
      { score: 2, label: 'Tanpa lumbar / sudut salah' },
      { score: 3, label: 'Skor dasar +1 (meja terlalu tinggi)' },
      { score: 4, label: 'Skor dasar +1 (tidak adjustable)' },
    ],
  },
];

const ROSA_PERIPH: Q[] = [
  {
    key: 'monitor',
    title: 'Monitor',
    guide: 'Skor akhir monitor termasuk penalti silau, dokumen, leher terpuntir, jarak.',
    options: [
      { score: 0, label: '0 — posisi ideal' },
      { score: 1, label: '1' }, { score: 2, label: '2' }, { score: 3, label: '3' },
      { score: 4, label: '4' }, { score: 5, label: '5' }, { score: 6, label: '6' },
      { score: 7, label: '7 — skor maksimum (banyak penalti)' },
    ],
  },
  {
    key: 'phone',
    title: 'Telepon',
    guide: 'Termasuk penalti jika tanpa hands-free / menjepit telepon di bahu.',
    options: [
      { score: 0, label: '0 — tidak dipakai / hands-free ideal' },
      { score: 1, label: '1' }, { score: 2, label: '2' }, { score: 3, label: '3' },
      { score: 4, label: '4' }, { score: 5, label: '5' },
      { score: 6, label: '6 — skor maksimum' },
    ],
  },
  {
    key: 'mouse',
    title: 'Mouse',
    guide: 'Termasuk penalti pinch grip, palm rest, permukaan berbeda dari keyboard.',
    options: [
      { score: 0, label: '0 — posisi ideal' },
      { score: 1, label: '1' }, { score: 2, label: '2' }, { score: 3, label: '3' },
      { score: 4, label: '4' }, { score: 5, label: '5' }, { score: 6, label: '6' },
      { score: 7, label: '7 — skor maksimum' },
    ],
  },
  {
    key: 'keyboard',
    title: 'Keyboard',
    guide: 'Termasuk penalti deviasi pergelangan, terlalu tinggi, jangkauan ke atas.',
    options: [
      { score: 0, label: '0 — posisi ideal' },
      { score: 1, label: '1' }, { score: 2, label: '2' }, { score: 3, label: '3' },
      { score: 4, label: '4' }, { score: 5, label: '5' }, { score: 6, label: '6' },
      { score: 7, label: '7 — skor maksimum' },
    ],
  },
];

const WERA_QS: Q[] = [
  { key: 'bahu_sikap', title: '1a. Bahu — Sikap', options: [
    { score: 1, label: 'LOW — lengan di bawah bahu' },
    { score: 2, label: 'MED — lengan setinggi bahu' },
    { score: 3, label: 'HIGH — lengan di atas bahu' },
  ]},
  { key: 'bahu_ulang', title: '1b. Bahu — Pengulangan', options: [
    { score: 1, label: 'LOW — <10× per menit' },
    { score: 2, label: 'MED — 10–20× per menit' },
    { score: 3, label: 'HIGH — >20× per menit' },
  ]},
  { key: 'tangan_sikap', title: '2a. Pergelangan Tangan — Sikap', options: [
    { score: 1, label: 'LOW — netral' },
    { score: 2, label: 'MED — fleksi/ekstensi sedang' },
    { score: 3, label: 'HIGH — fleksi/ekstensi ekstrem' },
  ]},
  { key: 'tangan_ulang', title: '2b. Pergelangan Tangan — Pengulangan', options: [
    { score: 1, label: 'LOW — <10× per menit' },
    { score: 2, label: 'MED — 10–20× per menit' },
    { score: 3, label: 'HIGH — >20× per menit' },
  ]},
  { key: 'punggung_sikap', title: '3a. Punggung — Sikap', options: [
    { score: 1, label: 'LOW — tegak / fleksi <20°' },
    { score: 2, label: 'MED — fleksi 20°–60°' },
    { score: 3, label: 'HIGH — fleksi >60° / putaran' },
  ]},
  { key: 'punggung_ulang', title: '3b. Punggung — Pengulangan', options: [
    { score: 1, label: 'LOW — <10× per menit' },
    { score: 2, label: 'MED — 10–20× per menit' },
    { score: 3, label: 'HIGH — >20× per menit' },
  ]},
  { key: 'leher_sikap', title: '4a. Leher — Sikap', options: [
    { score: 1, label: 'LOW — netral / fleksi ringan' },
    { score: 2, label: 'MED — fleksi / putaran sedang' },
    { score: 3, label: 'HIGH — fleksi ekstrem / putaran' },
  ]},
  { key: 'leher_ulang', title: '4b. Leher — Pengulangan', options: [
    { score: 1, label: 'LOW — <10× per menit' },
    { score: 2, label: 'MED — 10–20× per menit' },
    { score: 3, label: 'HIGH — >20× per menit' },
  ]},
  { key: 'kaki_sikap', title: '5a. Kaki — Sikap', options: [
    { score: 1, label: 'LOW — kaki tertopang seimbang' },
    { score: 2, label: 'MED — berdiri lama / posisi kurang ideal' },
    { score: 3, label: 'HIGH — jongkok / tidak seimbang' },
  ]},
  { key: 'lvl_kuat', title: '6. Kekuatan (Angkat Beban)', options: [
    { score: 1, label: 'LOW — 0–5 kg' },
    { score: 2, label: 'MED — 5–10 kg' },
    { score: 3, label: 'HIGH — >10 kg' },
  ]},
  { key: 'lvl_getaran', title: '7. Getaran', options: [
    { score: 1, label: 'LOW — <1 jam/hari' },
    { score: 2, label: 'MED — 1–4 jam/hari' },
    { score: 3, label: 'HIGH — >4 jam/hari' },
  ]},
  { key: 'lvl_tekanan', title: '8. Tekanan Langsung', options: [
    { score: 1, label: 'LOW — memakai sarung tangan pelindung' },
    { score: 2, label: 'MED — permukaan keras' },
    { score: 3, label: 'HIGH — tanpa pelindung / tepi tajam' },
  ]},
  { key: 'lvl_durasi', title: '9. Durasi Kerja', options: [
    { score: 1, label: 'LOW — <2 jam/hari' },
    { score: 2, label: 'MED — 2–4 jam/hari' },
    { score: 3, label: 'HIGH — >4 jam/hari' },
  ]},
];

const ALL_KEYS: Record<Metode, string[]> = {
  RULA: [...RULA_GROUP_A, ...RULA_GROUP_B].map((q) => q.key),
  ROSA: [...ROSA_CHAIR, ...ROSA_PERIPH].map((q) => q.key),
  WERA: WERA_QS.map((q) => q.key),
};

const blankInput = (m: Metode) => {
  const defaults: Record<string, number> = {};
  for (const k of ALL_KEYS[m]) defaults[k] = m === 'ROSA' && ['monitor', 'phone', 'mouse', 'keyboard'].includes(k) ? 0 : 1;
  if (m === 'RULA') { defaults.muscle_a = 0; defaults.force_a = 0; defaults.muscle_b = 0; defaults.force_b = 0; }
  return defaults;
};

const CHECKS = [
  { key: 'ok_personil_kompeten', label: 'Personil pengukur kompeten (STD/036 pasal 6.8)' },
  { key: 'ok_metode_sesuai', label: 'Metode sesuai dengan jenis pekerjaan (pasal 6.6)' },
  { key: 'ok_kondisi_representatif', label: 'Kondisi kerja saat pengukuran representatif (pasal 6.7)' },
  { key: 'ok_dokumentasi_lengkap', label: 'Dokumentasi lengkap: foto & formulir (pasal 6.9)' },
];

const METHOD_META: Record<Metode, { form: string; source: string; how: string }> = {
  RULA: {
    form: 'FORM/116',
    source: 'McAtamney & Corlett, Applied Ergonomics 1993',
    how: 'Pilih skor yang paling sesuai dengan postur yang diamati pada setiap segmen. Skor Grup A dan B digabung dengan faktor otot & beban menjadi skor akhir RULA (1–7).',
  },
  ROSA: {
    form: 'FORM/117',
    source: 'Sonne, Villalta & Andrews, Applied Ergonomics 2012 (Cornell worksheet)',
    how: 'Isi skor kursi (tinggi, kedalaman, armrest, backrest) lalu perifer (monitor, telepon, mouse, keyboard). Skor Section A digabung dengan perifer menjadi skor akhir ROSA.',
  },
  WERA: {
    form: 'FORM/118',
    source: 'Rahman et al., Journal of Human Ergology 2011',
    how: 'Nilai 9 faktor (sikap & pengulangan tubuh, kekuatan, getaran, tekanan, durasi) dengan level LOW/MED/HIGH. Total skor menentukan klasifikasi risiko.',
  },
};

function QuestionBlock({ q, value, onChange }: { q: Q; value: number; onChange: (n: number) => void }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ marginBottom: 8 }}>
        <b style={{ fontSize: 13, color: 'var(--foreground)' }}>{q.title}</b>
        {q.guide && (
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '4px 0 0', lineHeight: 1.4 }}>
            {q.guide}
          </p>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
        {q.options.map((o) => (
          <ScoreOptionCard
            key={o.score}
            score={o.score}
            label={o.label}
            selected={value === o.score}
            onSelect={() => onChange(o.score)}
          />
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
    setF((p) => ({
      ...p,
      pekerja_diamati: emp.nama || p.pekerja_diamati,
      pekerja_nik: emp.nik || p.pekerja_nik,
      departemen: emp.department || p.departemen,
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
            Pengukuran internal minimal 1× per bulan; survei pihak ketiga minimal 1× per tahun (STD/036).
            Isi seperti soal bergambar — pilih skor sesuai postur yang diamati.
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
          background: 'rgba(255,77,0,0.06)', border: '1px solid rgba(255,77,0,0.2)',
          borderRadius: 10, padding: 14, marginBottom: 16,
        }}>
          <b style={{ fontSize: 12, color: 'var(--brand-primary, #ff4d00)' }}>
            Petunjuk pengisian — {meta.form}
          </b>
          <p style={{ fontSize: 12, margin: '6px 0 0', lineHeight: 1.5, color: 'var(--foreground)' }}>
            {meta.how}
          </p>
          <p style={{ fontSize: 11, margin: '6px 0 0', color: 'var(--muted-foreground)' }}>
            Sumber: {meta.source}
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
                <input className="admin-input" style={inputStyle} required value={f.aktivitas} onChange={(e) => set('aktivitas', e.target.value)} />
              </Field>
              <Field label="Personil Pengukur">
                <input className="admin-input" style={inputStyle} required value={f.personil_pengukur} onChange={(e) => set('personil_pengukur', e.target.value)} />
              </Field>
              <Field label="Kualifikasi / Kompetensi Pengukur">
                <input className="admin-input" style={inputStyle} required value={f.kualifikasi_pengukur}
                  onChange={(e) => set('kualifikasi_pengukur', e.target.value)}
                  placeholder="mis. Sertifikat ergonomi / pelatihan internal" />
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
            <Section title="9 Faktor Risiko Fisik (WERA) — 1=LOW, 2=MED, 3=HIGH">
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
                  {preview.batasHari && (
                    <span>Tindak lanjut maks. <b>{preview.batasHari} hari kerja</b></span>
                  )}
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

            <div style={{ background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginTop: 12 }}>
              <b style={{ fontSize: 12, display: 'block', marginBottom: 8, color: 'var(--foreground)' }}>
                Pengesahan QSHE Manager (wajib sesuai standar form)
              </b>
              <div style={grid3}>
                <Field label="Nama QSHE Manager">
                  <input className="admin-input" style={inputStyle} required value={f.qshe_manager_nama || ''}
                    onChange={(e) => set('qshe_manager_nama', e.target.value)} placeholder="Nama lengkap & gelar" />
                </Field>
                <Field label="NIK QSHE Manager">
                  <input className="admin-input" style={inputStyle} required value={f.qshe_manager_nik || ''}
                    onChange={(e) => set('qshe_manager_nik', e.target.value)} placeholder="NIK Karyawan" />
                </Field>
                <Field label="Tanggal Pengesahan">
                  <input type="date" className="admin-input" style={inputStyle} required
                    value={f.qshe_manager_tgl || today} onChange={(e) => set('qshe_manager_tgl', e.target.value)} />
                </Field>
              </div>
            </div>

            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 8 }}>
              Jika salah satu syarat tidak terpenuhi, hasil dinyatakan tidak sah dan pengukuran wajib diulang (STD/036 pasal 6.10).
            </p>
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
