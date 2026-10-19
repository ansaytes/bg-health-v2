'use client';
// Administrator > Ergonomi > Input Survei.
// Wizard bergambar per metode (RULA FORM/116, ROSA FORM/117, WERA FORM/118): satu pertanyaan per langkah,
// gambar resmi dari formulir, petunjuk pengisian, skor langkah & skor akhir otomatis.
import { useMemo, useState } from 'react';
import { authFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { KLAS_COLOR, scoreErgo, type Metode } from '@/lib/hc-ergo';
import { WIZARDS, interpretasiFor, questionValue, type Answers, type Question } from '@/lib/ergo-wizard';
import EmployeeLookupInput, { type EmployeeData } from './EmployeeLookupInput';
import { Btn, BtnRow, Chip, Field, Notice, SITES, Tabs, grid2, inputStyle } from './hc-ergo-ui';

const BRAND = '#ff4d00';
const todayStr = () => new Date().toISOString().slice(0, 10);
type Ident = Record<string, any>;

const CHECKS: { key: string; label: string }[] = [
  { key: 'ok_personil_kompeten', label: 'Personil pengukur kompeten' },
  { key: 'ok_metode_sesuai', label: 'Metode sesuai dengan jenis pekerjaan' },
  { key: 'ok_kondisi_representatif', label: 'Kondisi kerja saat pengukuran representatif' },
  { key: 'ok_dokumentasi_lengkap', label: 'Dokumentasi lengkap: foto & formulir' },
];

const card = (selected: boolean): React.CSSProperties => ({
  display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', width: '100%', boxSizing: 'border-box',
  padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, lineHeight: 1.35,
  border: `2px solid ${selected ? BRAND : 'var(--border)'}`, background: selected ? 'rgba(255,77,0,0.07)' : 'var(--background)',
  color: 'var(--foreground)',
});
const badge = (selected: boolean): React.CSSProperties => ({
  flex: '0 0 auto', minWidth: 22, height: 22, borderRadius: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 11, fontWeight: 800, background: selected ? BRAND : 'var(--muted)', color: selected ? '#fff' : 'var(--muted-foreground)', padding: '0 6px',
});

export default function ErgoSurveyForm() {
  const { profile } = useAuth();
  const [metode, setMetode] = useState<Metode>('RULA');
  const def = WIZARDS[metode];
  const [step, setStep] = useState(0);                       // 0 = identitas, 1..n = pertanyaan, n+1 = hasil
  const [answers, setAnswers] = useState<Answers>({});
  const [id, setId] = useState<Ident>({
    sumber: 'INTERNAL', site: '', area_kerja: '', tanggal: todayStr(), departemen: '', aktivitas: '',
    personil_pengukur: profile?.full_name || '', kualifikasi_pengukur: '', pekerja_diamati: '', nik_pekerja: '', foto_url: '',
    ok_personil_kompeten: false, ok_metode_sesuai: false, ok_kondisi_representatif: false, ok_dokumentasi_lengkap: false,
  });
  const [query, setQuery] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'warn'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const setI = (k: string, v: any) => setId((p) => ({ ...p, [k]: v }));

  const n = def.questions.length;
  const last = n + 1;
  const q: Question | null = step >= 1 && step <= n ? def.questions[step - 1] : null;
  const values = useMemo(() => Object.fromEntries(def.questions.map((x) => [x.key, questionValue(x, answers[x.key])])), [def, answers]);
  const unanswered = def.questions.filter((x) => values[x.key] === null);
  const result = useMemo(() => {
    if (unanswered.length) return null;
    try { return { ok: true as const, ...scoreErgo(metode, values as Record<string, number>) }; }
    catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : 'Kombinasi tidak valid' }; }
  }, [metode, values, unanswered.length]);

  const changeMetode = (m: Metode) => { setMetode(m); setStep(0); setAnswers({}); setMsg(null); };
  const identOk = id.site && id.area_kerja.trim() && id.tanggal && id.departemen.trim() && id.aktivitas.trim()
    && id.personil_pengukur.trim() && id.kualifikasi_pengukur.trim() && id.pekerja_diamati.trim();
  const canNext = step === 0 ? !!identOk : q ? values[q.key] !== null : false;

  const pickChoice = (qq: Question, cid: string) => setAnswers((p) => ({ ...p, [qq.key]: { choice: cid, mods: p[qq.key]?.mods || [] } }));
  const toggleMod = (qq: Question, mid: string) => setAnswers((p) => {
    const cur = p[qq.key] || { mods: [] };
    const mods = cur.mods.includes(mid) ? cur.mods.filter((x) => x !== mid) : [...cur.mods, mid];
    return { ...p, [qq.key]: { ...cur, mods } };
  });

  const found = (e: EmployeeData) => {
    setId((p) => ({ ...p, pekerja_diamati: e.nama || p.pekerja_diamati, nik_pekerja: e.nik ? String(e.nik) : p.nik_pekerja,
      departemen: p.departemen || e.department || '', site: p.site || e.site_name || '' }));
  };
  const clearWorker = () => { setId((p) => ({ ...p, pekerja_diamati: '', nik_pekerja: '' })); setQuery(''); };

  const ringkasan = () => def.questions.map((x) => {
    const a = answers[x.key]; const c = x.choices.find((y) => y.id === a?.choice);
    return { judul: x.title, pilihan: c?.label || '-', tambahan: (x.mods || []).filter((m) => a?.mods.includes(m.id)).map((m) => m.label), nilai: values[x.key] };
  });

  const submit = async () => {
    if (!result?.ok) return;
    setMsg(null); setSaving(true);
    try {
      const res = await authFetch('/api/ergo', { method: 'POST', body: JSON.stringify({
        resource: 'survey', metode, ...id, input: values, jawaban: answers, ringkasan: ringkasan() }) });
      setMsg(res.sah ? { kind: 'ok', text: 'Survei tersimpan dan menunggu persetujuan QSHE Manager.' } : { kind: 'warn', text: res.pesan });
      setAnswers({}); setStep(0);
      setId((p) => ({ ...p, area_kerja: '', aktivitas: '', pekerja_diamati: '', nik_pekerja: '', foto_url: '',
        ok_personil_kompeten: false, ok_metode_sesuai: false, ok_kondisi_representatif: false, ok_dokumentasi_lengkap: false }));
      setQuery('');
    } catch (err) { setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan' }); }
    finally { setSaving(false); }
  };

  const progress = Math.round((step / last) * 100);

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', width: '90%', margin: '0 auto' }}>
      <div className="admin-form-inner">
        <div style={{ marginBottom: 12 }}>
          <h1 className="admin-form-title">Survei Ergonomi</h1>
          <p className="admin-form-subtitle">Pengukuran internal minimal 1× per bulan; survei pihak ketiga minimal 1× per tahun. Jawab tiap langkah; skor dihitung otomatis.</p>
        </div>
        <Tabs tabs={[{ key: 'RULA', label: 'RULA' }, { key: 'ROSA', label: 'ROSA' }, { key: 'WERA', label: 'WERA' }]} value={metode} onChange={changeMetode} />
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

        <div className="admin-form-card">
          {/* Progres */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 6, gap: 8, flexWrap: 'wrap' }}>
            <b style={{ color: 'var(--foreground)' }}>{def.title}</b>
            <span>{step === 0 ? 'Identitas pengukuran' : step === last ? 'Hasil & keabsahan' : `Pertanyaan ${step} dari ${n} — ${q?.group}`}</span>
          </div>
          <div style={{ height: 6, background: 'var(--muted)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ width: `${progress}%`, height: '100%', background: BRAND, transition: 'width 0.25s' }} />
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
            {['Identitas', ...def.questions.map((_, i) => String(i + 1)), 'Hasil'].map((lbl, i) => {
              const done = i === 0 ? !!identOk : i === last ? !!result : values[def.questions[i - 1].key] !== null;
              const reachable = i === 0 || identOk;
              return (
                <button key={i} type="button" disabled={!reachable} onClick={() => setStep(i)}
                  style={{ height: 26, minWidth: 26, padding: '0 8px', borderRadius: 13, fontSize: 10.5, fontWeight: 700, cursor: reachable ? 'pointer' : 'not-allowed',
                    border: `1px solid ${i === step ? BRAND : 'var(--border)'}`, background: i === step ? BRAND : done ? 'rgba(0,184,148,0.15)' : 'transparent',
                    color: i === step ? '#fff' : done ? '#00a884' : 'var(--muted-foreground)', whiteSpace: 'nowrap', opacity: reachable ? 1 : 0.5 }}>{lbl}</button>
              );
            })}
          </div>

          {/* ─── Langkah 0: identitas ─── */}
          {step === 0 && (
            <>
              <div style={{ background: 'var(--muted)', borderRadius: 8, padding: '10px 14px', fontSize: 12, marginBottom: 14 }}>
                <b>Petunjuk umum ({def.formNo})</b>
                <ul style={{ margin: '6px 0 0 18px', padding: 0, lineHeight: 1.6 }}>{def.intro.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
              <div style={{ ...grid2, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                <Field label="Sumber Survei"><select className="admin-input" style={inputStyle} value={id.sumber} onChange={(e) => setI('sumber', e.target.value)}><option value="INTERNAL">Internal (Personil QSHE)</option><option value="PIHAK_KETIGA">Pihak ketiga</option></select></Field>
                <Field label="Tanggal Pengukuran"><input type="date" className="admin-input" style={inputStyle} value={id.tanggal} onChange={(e) => setI('tanggal', e.target.value)} /></Field>
                <Field label="Site"><select className="admin-input" style={inputStyle} value={id.site} onChange={(e) => setI('site', e.target.value)}><option value="">Pilih…</option>{SITES.map((s) => <option key={s}>{s}</option>)}</select></Field>
                <Field label="Lokasi / Area Kerja"><input className="admin-input" style={inputStyle} value={id.area_kerja} onChange={(e) => setI('area_kerja', e.target.value)} /></Field>
                <Field label="Departemen / Bagian"><input className="admin-input" style={inputStyle} value={id.departemen} onChange={(e) => setI('departemen', e.target.value)} /></Field>
                <Field label={metode === 'ROSA' ? 'Pekerjaan / Jabatan yang Dinilai' : 'Aktivitas / Tugas yang Dinilai'}><input className="admin-input" style={inputStyle} value={id.aktivitas} onChange={(e) => setI('aktivitas', e.target.value)} /></Field>
                <Field label="Nama Personil Pengukur"><input className="admin-input" style={inputStyle} value={id.personil_pengukur} onChange={(e) => setI('personil_pengukur', e.target.value)} /></Field>
                <Field label="Jabatan / Kualifikasi Pengukur"><input className="admin-input" style={inputStyle} value={id.kualifikasi_pengukur} onChange={(e) => setI('kualifikasi_pengukur', e.target.value)} placeholder="mis. Personil QSHE — sertifikat ergonomi" /></Field>
                <div style={{ gridColumn: '1 / -1' }}>
                  {id.pekerja_diamati ? (
                    <Field label="Nama Pekerja yang Diamati">
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', border: '2px solid #00B894', borderRadius: 8, padding: '8px 12px', background: 'rgba(0,184,148,0.07)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 13 }}>{id.pekerja_diamati}</b><div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>NIK {id.nik_pekerja || '-'}</div></div>
                        <Btn onClick={clearWorker}>Ganti</Btn>
                      </div>
                    </Field>
                  ) : (
                    <EmployeeLookupInput value={query} onChange={setQuery} onEmployeeFound={found}
                      placeholder="Ketik nama, NIK karyawan, atau NIK KTP pekerja yang diamati"
                      label={<span className="admin-label" style={{ marginBottom: 0 }}>Nama Pekerja yang Diamati (cari dari data employee)</span>}
                      inputStyle={{ ...inputStyle }} />
                  )}
                </div>
                <Field label="Link Foto / Video Postur Kerja" hint="(Google Drive, opsional)" full><input className="admin-input" style={inputStyle} value={id.foto_url} onChange={(e) => setI('foto_url', e.target.value)} /></Field>
              </div>
            </>
          )}

          {/* ─── Langkah pertanyaan ─── */}
          {q && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 8px' }}>{q.title}</h2>
              <div style={{ borderLeft: `4px solid ${BRAND}`, background: 'var(--muted)', borderRadius: 6, padding: '8px 12px', fontSize: 12, marginBottom: 14 }}>
                <b>Petunjuk pengisian</b>
                <ul style={{ margin: '4px 0 0 18px', padding: 0, lineHeight: 1.55 }}>{q.guide.map((g) => <li key={g}>{g}</li>)}</ul>
              </div>

              {q.choices.some((c) => c.img) ? (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: 6 }}>Pilih gambar yang paling sesuai</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
                    {q.choices.map((c) => {
                      const sel = answers[q.key]?.choice === c.id;
                      const lv = ['low', 'med', 'high'].includes(c.id);
                      return (
                        <button key={c.id} type="button" onClick={() => pickChoice(q, c.id)} style={{ ...card(sel), flexDirection: 'column', alignItems: 'stretch', padding: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 22 }}>
                            {lv ? <Chip text={c.id.toUpperCase()} color={c.id === 'low' ? '#00B894' : c.id === 'med' ? '#d4a000' : '#E63946'} /> : <span />}
                            <span style={badge(sel)}>{sel ? '✓' : c.score}</span>
                          </div>
                          {c.img ? (
                            <div style={{ background: '#fff', borderRadius: 6, margin: '8px 0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                              <img src={c.img} alt={c.label} style={{ width: '100%', height: 'auto', maxHeight: 230, objectFit: 'contain', display: 'block' }} />
                            </div>
                          ) : <div style={{ height: 8 }} />}
                          <span style={{ fontWeight: 600 }}>{c.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {q.mods && q.mods.length > 0 && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '16px 0 6px' }}>Penyesuaian (centang bila ada)</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
                        {q.mods.map((m) => {
                          const on = !!answers[q.key]?.mods.includes(m.id);
                          return (
                            <button key={m.id} type="button" onClick={() => toggleMod(q, m.id)} style={{ ...card(on), flexDirection: 'column', alignItems: 'stretch' }}>
                              {m.img && (
                                <div style={{ background: '#fff', borderRadius: 6, marginBottom: 6 }}>
                                  <img src={m.img} alt={m.label} style={{ width: '100%', height: 'auto', maxHeight: 130, objectFit: 'contain', display: 'block' }} />
                                </div>
                              )}
                              <span style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                <span style={{ ...badge(on), borderRadius: 5 }}>{on ? '✓' : (m.delta > 0 ? `+${m.delta}` : m.delta)}</span><span>{m.label}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {q.image && (
                    <details style={{ marginTop: 14, fontSize: 11 }}>
                      <summary style={{ cursor: 'pointer', color: BRAND, fontWeight: 600 }}>Lihat gambar referensi asli pada formulir ({def.formNo})</summary>
                      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 8, marginTop: 6 }}>
                        <img src={q.image} alt={q.imageCaption || q.title} style={{ width: '100%', height: 'auto', display: 'block' }} />
                        <div style={{ fontSize: 10, color: '#667', marginTop: 4 }}>{def.source}</div>
                      </div>
                    </details>
                  )}
                </>
              ) : (
                <div style={{ display: 'grid', gap: 8, maxWidth: 720 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Pilih kondisi yang sesuai</div>
                  {q.choices.map((c) => {
                    const sel = answers[q.key]?.choice === c.id;
                    return (
                      <button key={c.id} type="button" onClick={() => pickChoice(q, c.id)} style={card(sel)}>
                        <span style={badge(sel)}>{c.score}</span><span>{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div style={{ marginTop: 14, fontSize: 13 }}>
                Skor langkah ini: <b style={{ fontSize: 20, color: values[q.key] === null ? 'var(--muted-foreground)' : BRAND }}>{values[q.key] ?? '—'}</b>
                {q.mods && q.mods.length > 0 && values[q.key] !== null && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}> (dibatasi {q.min}–{q.max} sesuai tabel formulir)</span>}
              </div>
            </div>
          )}

          {/* ─── Langkah hasil ─── */}
          {step === last && (
            <div>
              {unanswered.length > 0 && (
                <Notice kind="warn">Masih ada {unanswered.length} pertanyaan belum dijawab: {unanswered.map((u) => u.title).join('; ')}.</Notice>
              )}
              {result && !result.ok && <Notice kind="err">{result.error}</Notice>}
              {result?.ok && (
                <>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                    <div style={{ textAlign: 'center', border: `3px solid ${KLAS_COLOR[result.klasifikasi]}`, borderRadius: 14, padding: '8px 22px' }}>
                      <div style={{ fontSize: 10, color: 'var(--muted-foreground)', fontWeight: 700 }}>SKOR AKHIR {metode}</div>
                      <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.1 }}>{result.skorAkhir}</div>
                    </div>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <Chip text={result.klasifikasi.replace('_', ' ')} color={KLAS_COLOR[result.klasifikasi]} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{interpretasiFor(metode, result.skorAkhir)}</span>
                      {result.perluPica && <span style={{ fontSize: 11 }}>Klasifikasi sedang ke atas: wajib ditindaklanjuti melalui PICA.{result.batasHari ? ` Batas tindak lanjut ${result.batasHari} hari kerja.` : ''}</span>}
                    </div>
                  </div>
                  <ScoreTable metode={metode} hasil={result.hasil as any} />
                </>
              )}
              <div style={{ fontSize: 12, fontWeight: 700, margin: '14px 0 6px' }}>Ringkasan jawaban</div>
              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                  <tbody>
                    {ringkasan().map((r, i) => (
                      <tr key={r.judul}>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                          <button type="button" onClick={() => setStep(i + 1)} style={{ background: 'none', border: 'none', color: BRAND, cursor: 'pointer', fontSize: 11.5, padding: 0, textAlign: 'left' }}>{r.judul}</button></td>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)' }}>{r.pilihan}{r.tambahan.length > 0 && <div style={{ color: 'var(--muted-foreground)' }}>+ {r.tambahan.join('; ')}</div>}</td>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>{r.nilai ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, margin: '14px 0 6px' }}>Keabsahan hasil</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {CHECKS.map((c) => (
                  <label key={c.key} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!id[c.key]} onChange={(e) => setI(c.key, e.target.checked)} /> {c.label}
                  </label>
                ))}
              </div>
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '8px 0 0' }}>Bila salah satu syarat tidak terpenuhi, hasil dinyatakan tidak sah dan pengukuran wajib diulang. Survei yang sah menunggu persetujuan QSHE Manager / PJO.</p>
            </div>
          )}

          {/* Navigasi */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <Btn size="md" disabled={step === 0} onClick={() => setStep(step - 1)}>← Sebelumnya</Btn>
            <BtnRow>
              {step < last && <Btn kind="primary" size="md" disabled={!canNext} onClick={() => setStep(step + 1)}>{step === n ? 'Lihat Hasil →' : 'Berikutnya →'}</Btn>}
              {step === last && <Btn kind="primary" size="md" disabled={saving || !result?.ok} onClick={submit}>{saving ? 'Menyimpan…' : 'Simpan Survei'}</Btn>}
            </BtnRow>
          </div>
          {step === 0 && !identOk && <p style={{ fontSize: 11, color: 'var(--muted-foreground)', textAlign: 'right', margin: '6px 0 0' }}>Lengkapi semua kolom identitas (termasuk pekerja yang diamati) untuk melanjutkan.</p>}
        </div>
      </div>
    </div>
  );
}

/** Tabel skor antara sesuai tabel pada formulir. */
function ScoreTable({ metode, hasil }: { metode: Metode; hasil: Record<string, any> }) {
  const rows: [string, string | number][] =
    metode === 'RULA' ? [['Posture Score A (Table A)', hasil.skorA], ['Posture Score B (Table B)', hasil.skorB], ['Wrist & Arm Score = A + otot + beban (baris Table C)', hasil.skorC], ['Neck, Trunk & Leg Score = B + otot + beban (kolom Table C)', hasil.skorD], ['Grand Score (Table C)', hasil.akhir]]
    : metode === 'ROSA' ? [['Section A — kursi', hasil.sectionA], ['Section B — phone × monitor', hasil.sectionB], ['Section C — mouse × keyboard', hasil.sectionC], ['Peripherals and Monitor Score', hasil.periph], ['ROSA Final Score', hasil.akhir]]
    : [['1. Bahu', hasil.faktor[0]], ['2. Pergelangan tangan', hasil.faktor[1]], ['3. Punggung', hasil.faktor[2]], ['4. Leher', hasil.faktor[3]], ['5. Kaki', hasil.faktor[4]], ['6. Kuat', hasil.faktor[5]], ['7. Getaran', hasil.faktor[6]], ['8. Menekan langsung', hasil.faktor[7]], ['9. Durasi kerja', hasil.faktor[8]], ['Final Score (jumlah 9 faktor)', hasil.akhir]];
  return (
    <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: 320 }}>
      <tbody>{rows.map(([k, v], i) => (
        <tr key={k} style={{ fontWeight: i === rows.length - 1 ? 800 : 400 }}>
          <td style={{ padding: '4px 10px 4px 0', borderBottom: '1px solid var(--border)' }}>{k}</td>
          <td style={{ padding: '4px 0', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>{v}</td>
        </tr>))}</tbody>
    </table>
  );
}
