'use client';

import { useState, useMemo, useCallback } from 'react';
import EmployeeLookupInput, { type EmployeeData } from './EmployeeLookupInput';

/* Jobsite list from Lagging Indicator spreadsheet */
const JOBSITES = [
  'All Site','Aceh','Angsana','Balikpapan','Banjarmasin','Banyuwangi',
  'Batu Kajang','Bengalon','Binuang','Binungan','Bontang','Bukit Pinang',
  'Bunyu','Gorontalo','Gunung Bintang Awai','Gunung Mas','Gunung Sari',
  'Halmahera Timur','Head Office','Kaliorang','Kapuas Tengah','Kaubun',
  'Kayong Utara','Kelubir','Ketapang','Konawe','Kota Baru','Kotamobagu',
  'Labanan','Lahat','Luwu','Malinau','Melak','Morowali','Muara Bungo',
  'Muara Enim','Muara Teweh','Murung Raya','Palu','Rantau','Samarinda',
  'Sangatta','Satui','Sebakis','Senakin','Soroako','Tabang',
  'Tanjung Redeb','Tanjung Tabalong','Tenggarong','Tri Yoga Morowali',
  'Tuhup','Wetar',
];

const MONTHS = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember',
];

/* Period sub-component — includes diagnosis per period for spell calculation */
function PeriodBlock({ label, prefix, form, onChange }: {
  label: string;
  prefix: string;
  form: Record<string, string>;
  onChange: (id: string, value: string) => void;
}) {
  const startKey = `${prefix}Start`;
  const endKey = `${prefix}End`;
  const daysKey = `${prefix}Days`;
  const diagKey = `${prefix}Diag`;

  const autoDays = useMemo(() => {
    if (form[startKey] && form[endKey]) {
      const s = new Date(form[startKey]);
      const e = new Date(form[endKey]);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e >= s) {
        const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
        return diff > 0 ? diff : 0;
      }
    }
    return 0;
  }, [form[startKey], form[endKey]]);

  return (
    <div style={{
      background: 'var(--muted)',
      borderRadius: 10,
      padding: '14px 16px',
      border: '1px solid var(--border)',
    }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: 'var(--foreground)',
        marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{
          width: 22, height: 22, borderRadius: 6,
          background: 'rgba(255,77,0,0.1)', color: '#ff4d00',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800,
        }}>{label}</span>
        Periode {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 10 }}>
        <div>
          <label className="admin-label">Tanggal Mulai</label>
          <input
            type="date"
            value={form[startKey] || ''}
            onChange={(e) => {
              onChange(startKey, e.target.value);
              if (autoDays > 0) onChange(daysKey, String(autoDays));
            }}
            className="admin-input"
          />
        </div>
        <div>
          <label className="admin-label">Tanggal Selesai</label>
          <input
            type="date"
            value={form[endKey] || ''}
            onChange={(e) => {
              onChange(endKey, e.target.value);
              if (autoDays > 0) onChange(daysKey, String(autoDays));
            }}
            className="admin-input"
          />
        </div>
        <div>
          <label className="admin-label">Hari Sakit</label>
          <input
            type="number"
            min="0"
            value={form[daysKey] || ''}
            onChange={(e) => onChange(daysKey, e.target.value)}
            className="admin-input"
            placeholder="0"
          />
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <label className="admin-label">Diagnosa Periode {label}</label>
        <input
          type="text"
          value={form[diagKey] || ''}
          onChange={(e) => onChange(diagKey, e.target.value)}
          className="admin-input"
          placeholder={label === 'A' ? 'Contoh: Typus, ISPA, Demam Berdarah' : 'Kosongkan jika sama dengan periode sebelumnya'}
        />
      </div>
    </div>
  );
}

/* Main Component */
export default function InputLaggingIndicator() {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [customSite, setCustomSite] = useState('');

  /* Auto-calculate Spell based on diagnosis continuity across periods */
  const calcSpell = () => {
    const diagA = (form.aDiag || '').trim().toLowerCase();
    const diagB = (form.bDiag || '').trim().toLowerCase();
    const diagC = (form.cDiag || '').trim().toLowerCase();
    const hasA = diagA && (form.aStart || form.aDays);
    const hasB = diagB && (form.bStart || form.bDays);
    const hasC = diagC && (form.cStart || form.cDays);
    if (!hasA && !hasB && !hasC) return 0;
    // Collect spell diagnoses in order
    const spells: string[] = [];
    if (hasA) spells.push(diagA);
    if (hasB) {
      if (spells.length > 0 && diagB === spells[spells.length - 1]) {
        // Same as previous — still 1 spell
      } else {
        spells.push(diagB);
      }
    }
    if (hasC) {
      if (spells.length > 0 && diagC === spells[spells.length - 1]) {
        // Same as previous — still 1 spell
      } else {
        spells.push(diagC);
      }
    }
    return spells.length;
  };

  /* Man Power state */
  const [mpForm, setMpForm] = useState<Record<string, string>>({});
  const [mpSaving, setMpSaving] = useState(false);
  const [mpSaved, setMpSaved] = useState(false);

  const handleChange = (id: string, value: string) => {
    setForm(prev => ({ ...prev, [id]: value }));
    setSaved(false);
  };

  const handleMpChange = (id: string, value: string) => {
    setMpForm(prev => ({ ...prev, [id]: value }));
    setMpSaved(false);
  };

  const handleEmployeeFound = useCallback((data: EmployeeData) => {
    // Smart-fill: match site_name against JOBSITES (case-insensitive)
    const siteName = (data.site_name || '').trim();
    if (siteName) {
      const matched = JOBSITES.find(j =>
        j.toLowerCase() === siteName.toLowerCase() ||
        siteName.toLowerCase().includes(j.toLowerCase()) ||
        j.toLowerCase().includes(siteName.toLowerCase())
      );
      if (matched) {
        handleChange('jobsite', matched);
        setCustomSite('');
      } else {
        // No match — use custom input
        handleChange('jobsite', '__custom__');
        setCustomSite(siteName);
      }
    }
  }, []);

  const handleSickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSaving(true);
    try {
      const siteVal = form.jobsite === '__custom__' ? customSite : form.jobsite;
      const monthMap: Record<string, string> = {
        'Januari':'1','Februari':'2','Maret':'3','April':'4','Mei':'5','Juni':'6',
        'Juli':'7','Agustus':'8','September':'9','Oktober':'10','November':'11','Desember':'12',
      };
      const bulanVal = form.bulan || '';
      const res = await fetch('/api/absensi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nik: form.nik, nama: form.nama, jobsite: siteVal,
          jabatan: form.jabatan, bulan: bulanVal, tahun: form.tahun || '2026',
          tgl_mulai_a: form.aStart || null, tgl_selesai_a: form.aEnd || null,
          hari_a: form.aDays || '0', diag_a: form.aDiag || null,
          tgl_mulai_b: form.bStart || null, tgl_selesai_b: form.bEnd || null,
          hari_b: form.bDays || '0', diag_b: form.bDiag || null,
          tgl_mulai_c: form.cStart || null, tgl_selesai_c: form.cEnd || null,
          hari_c: form.cDays || '0', diag_c: form.cDiag || null,
          spell: String(calcSpell()), is_pak: form.isPAK || 'Tidak',
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal menyimpan');
      setSaved(true);
      setForm({});
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const handleMpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMpSaving(true);
    setErrorMsg('');
    try {
      const siteVal = mpForm.mpSite === '__custom__' ? customMpSite : mpForm.mpSite;
      const monthNum = MONTHS.indexOf(mpForm.mpBulan || '') + 1;
      const res = await fetch('/api/manpower', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobsite: siteVal, bulan: String(monthNum), tahun: mpForm.mpTahun || '2026',
          man_power: mpForm.mpManPower, kunjungan_klinik: mpForm.mpKunjungan || '0',
          hari_kerja: mpForm.mpHariKerja || '0',
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal menyimpan');
      setMpSaved(true);
      setMpForm({});
      setTimeout(() => setMpSaved(false), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan data');
    } finally {
      setMpSaving(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', width: '90%', margin: '0 auto' }}>
      <div className="admin-form-inner">
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 className="admin-form-title">Input Data Kesehatan Kerja</h1>
        </div>

        {/* Form: Data Karyawan Sakit */}
        <form onSubmit={handleSickSubmit}>
            <div className="admin-form-card">
              {/* Section: Identitas Karyawan */}
              <div style={{
                fontSize: 11, fontWeight: 700, color: '#ff4d00',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
                Identitas Karyawan
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <EmployeeLookupInput
                    value={form.nik || ''}
                    onChange={(v) => handleChange('nik', v)}
                    onEmployeeFound={handleEmployeeFound}
                    onAutoFill={(formFieldId, val) => handleChange(formFieldId, val)}
                    autoFill={{
                      nama: 'nama',
                      job_position: 'jabatan',
                    }}
                    placeholder="Contoh: 230802778"
                    label={<>NIK Karyawan <span style={{ color: '#ff4d00' }}>*</span></>}
                    required
                  />
                </div>
                <div>
                  <label className="admin-label">
                    Nama Karyawan <span style={{ color: '#ff4d00' }}>*</span>
                  </label>
                  <input type="text" value={form.nama || ''} onChange={(e) => handleChange('nama', e.target.value)} placeholder="Nama lengkap karyawan" className="admin-input" />
                </div>
                <div>
                  <label className="admin-label">
                    Jobsite <span style={{ color: '#ff4d00' }}>*</span>
                  </label>
                  <select value={form.jobsite === '__custom__' ? '__custom__' : (form.jobsite || '')} onChange={(e) => { handleChange('jobsite', e.target.value); if (e.target.value !== '__custom__') setCustomSite(''); }} className="admin-input" style={{ appearance: 'none', cursor: 'pointer' }}>
                    <option value="">Pilih Jobsite...</option>
                    {JOBSITES.filter(s => s !== 'All Site').map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                    <option value="__custom__">+ Lainnya (input manual)</option>
                  </select>
                  {form.jobsite === '__custom__' && (
                    <input type="text" value={customSite} onChange={(e) => { setCustomSite(e.target.value); handleChange('jobsite', '__custom__'); }} placeholder="Ketik nama jobsite..." className="admin-input" style={{ marginTop: 6 }} />
                  )}
                </div>
                <div>
                  <label className="admin-label">Jabatan</label>
                  <input type="text" value={form.jabatan || ''} onChange={(e) => handleChange('jabatan', e.target.value)} placeholder="Contoh: Driver - Operation" className="admin-input" />
                </div>
                <div>
                  <label className="admin-label">
                    Bulan <span style={{ color: '#ff4d00' }}>*</span>
                  </label>
                  <select value={form.bulan || ''} onChange={(e) => handleChange('bulan', e.target.value)} className="admin-input" style={{ appearance: 'none', cursor: 'pointer' }}>
                    <option value="">Pilih Bulan...</option>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={String(i + 1)}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="admin-label">
                    Tahun <span style={{ color: '#ff4d00' }}>*</span>
                  </label>
                  <input type="number" min="2020" max="2099" value={form.tahun || '2026'} onChange={(e) => handleChange('tahun', e.target.value)} className="admin-input" />
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--border)', margin: '18px 0' }} />

              {/* Section: Data Sakit */}
              <div style={{
                fontSize: 11, fontWeight: 700, color: '#ff4d00',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
                Data Ketidakhadiran (Maks. 3 Periode)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <PeriodBlock label="A" prefix="a" form={form} onChange={handleChange} />
                <PeriodBlock label="B" prefix="b" form={form} onChange={handleChange} />
                <PeriodBlock label="C" prefix="c" form={form} onChange={handleChange} />
              </div>

              <div style={{ height: 1, background: 'var(--border)', margin: '18px 0' }} />

              {/* Section: Klasifikasi Penyakit */}
              <div style={{
                fontSize: 11, fontWeight: 700, color: '#ff4d00',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
                Klasifikasi Penyakit
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label className="admin-label">Jumlah Spell (Otomatis)</label>
                  <input
                    type="number"
                    min="0"
                    value={calcSpell()}
                    readOnly
                    className="admin-input"
                    style={{ background: 'var(--muted)', color: 'var(--foreground)', cursor: 'default' }}
                  />
                  <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: '4px 0 0', lineHeight: 1.4 }}>
                    Diagnosa sama antar periode berkelanjutan = 1 Spell.
                    Diagnosa berbeda = dihitung Spell terpisah.
                  </p>
                </div>
                <div>
                  <label className="admin-label">Penyakit Akibat Kerja (PAK)?</label>
                  <select value={form.isPAK || ''} onChange={(e) => handleChange('isPAK', e.target.value)} className="admin-input" style={{ appearance: 'none', cursor: 'pointer' }}>
                    <option value="Tidak">Tidak</option>
                    <option value="Ya">Ya</option>
                  </select>
                </div>
              </div>

              {/* Buttons - constrained to body width */}
              <div style={{ marginTop: 20, display: 'flex', gap: 10, maxWidth: '100%' }}>
                {errorMsg && <p style={{ fontSize: 11, color: '#FF4444', margin: '0 0 8px' }}>{errorMsg}</p>}
                <button
                  type="submit"
                  className="admin-form-btn-primary"
                  disabled={saving}
                  style={saved ? { background: 'linear-gradient(135deg, #00B894, #00D2A0)' } : undefined}
                >
                  {saving ? 'Menyimpan...' : saved ? 'Tersimpan!' : 'Simpan Data Sakit'}
                </button>
                <button
                  type="button"
                  className="admin-form-btn-secondary"
                  onClick={() => setForm({})}
                >
                  Reset
                </button>
              </div>
            </div>
          </form>

        {/* Spell Info Reference */}
        <div style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '14px 16px', marginTop: 16,
          boxShadow: 'var(--shadow)',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--foreground)',
            marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            Referensi Spell (Kepdirjen 185/2019)
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.6 }}>
            Satu orang sakit tidak terputus selama 10 hari = <strong>1 Spell</strong>.<br />
            Satu orang sakit 5 hari, masuk 2 hari, lalu sakit lagi 3 hari dengan diagnosa <em>berbeda</em> = <strong>2 Spell</strong>.<br />
            Namun apabila ketidakhadirannya dikarenakan masih berhubungan dengan penyakit yang <em>sama</em> sebelumnya, maka hanya dihitung <strong>1 Spell</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
