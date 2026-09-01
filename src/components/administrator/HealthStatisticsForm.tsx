'use client';

import { useState, useEffect, useCallback } from 'react';

const MONTHS = [
  { value: '1', label: 'Januari' },
  { value: '2', label: 'Februari' },
  { value: '3', label: 'Maret' },
  { value: '4', label: 'April' },
  { value: '5', label: 'Mei' },
  { value: '6', label: 'Juni' },
  { value: '7', label: 'Juli' },
  { value: '8', label: 'Agustus' },
  { value: '9', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' },
];

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

const LEADING_FIELDS = [
  { key: 'man_power', label: 'Man Power', step: '1' },
  { key: 'man_hours', label: 'Man Hours', step: '1' },
  { key: 'kunjungan_klinik', label: 'Kunjungan Klinik', step: '1' },
  { key: 'tk_sakit', label: 'Tenaga Kerja Sakit', step: '1' },
  { key: 'absensi_sakit', label: 'Total Absensi Sakit', step: '1' },
  { key: 'spell', label: 'Spell', step: '1' },
  { key: 'penyakit_akibat_kerja', label: 'Penyakit Akibat Kerja', step: '1' },
  { key: 'kejadian_penyakit_tk', label: 'Kejadian Penyakit TK', step: '1' },
  { key: 'layak_bekerja', label: 'Layak Bekerja', step: '1' },
];

const LAGGING_FIELDS = [
  { key: 'rkk', label: 'RKK', step: '0.0000000001', isPct: true },
  { key: 'cmr', label: 'CMR', step: '0.0000000001', isPct: true },
  { key: 'mfr', label: 'MFR', step: '0.0001', isPct: false },
  { key: 'ssr', label: 'SSR', step: '0.000000001', isPct: false },
  { key: 'asr', label: 'ASR', step: '0.0001', isPct: false },
  { key: 'fr_pak', label: 'FR PAK', step: '0.0000000001', isPct: true },
  { key: 'kaptk', label: 'KAPTK', step: '0.01', isPct: false },
];

const ALL_KEYS = [...LEADING_FIELDS, ...LAGGING_FIELDS].map(f => f.key);

interface FormData {
  man_power: string; man_hours: string; kunjungan_klinik: string;
  tk_sakit: string; absensi_sakit: string; spell: string;
  penyakit_akibat_kerja: string; kejadian_penyakit_tk: string; layak_bekerja: string;
  rkk: string; cmr: string; mfr: string; ssr: string;
  asr: string; fr_pak: string; kaptk: string;
}

function emptyForm(): FormData {
  const obj = {} as Record<string, string>;
  ALL_KEYS.forEach(k => { obj[k] = ''; });
  return obj as unknown as FormData;
}

export default function HealthStatisticsForm() {
  const [tahun, setTahun] = useState('2026');
  const [selectedSite, setSelectedSite] = useState('All Site');
  const [selectedBulan, setSelectedBulan] = useState('');
  const [form, setForm] = useState<FormData>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'leading' | 'lagging'>('leading');

  const loadData = useCallback(async () => {
    if (!selectedBulan) {
      setForm(emptyForm());
      setMessage(null);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/lagging-indicators?tahun=${tahun}&site=${encodeURIComponent(selectedSite)}&bulan=${selectedBulan}`);
      const json = await res.json();
      if (json.success && json.data?.row) {
        const r = json.data.row;
        const next = emptyForm();
        (ALL_KEYS as (keyof FormData)[]).forEach(k => {
          const val = r[k];
          next[k] = val !== null && val !== undefined && val !== 0 ? String(val) : '';
        });
        setForm(next);
      } else {
        setForm(emptyForm());
      }
    } catch {
      setMessage({ text: 'Gagal memuat data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [tahun, selectedSite, selectedBulan]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleChange = (key: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setMessage(null);
  };

  const handleSave = async () => {
    if (!selectedBulan) {
      setMessage({ text: 'Pilih bulan terlebih dahulu', type: 'error' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, unknown> = {
        tahun: Number(tahun),
        bulan: Number(selectedBulan),
        jobsite: selectedSite,
      };
      ALL_KEYS.forEach(k => {
        body[k] = form[k] || '0';
      });

      const res = await fetch('/api/lagging-indicators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ text: `Data ${selectedSite} - ${MONTHS[Number(selectedBulan) - 1].label} ${tahun} berhasil disimpan`, type: 'success' });
      } else {
        setMessage({ text: json.error || 'Gagal menyimpan', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Gagal menyimpan', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const calcRKK = () => {
    const mp = parseFloat(form.man_power) || 0;
    const lb = parseFloat(form.layak_bekerja) || 0;
    if (mp <= 0) return '-';
    return (lb / mp).toFixed(10);
  };

  const calcASR = () => {
    const as = parseFloat(form.absensi_sakit) || 0;
    const mp = parseFloat(form.man_power) || 0;
    if (mp <= 0) return '-';
    return ((as * 1000000) / mp).toFixed(4);
  };

  const calcSSR = () => {
    const sp = parseFloat(form.spell) || 0;
    const mp = parseFloat(form.man_power) || 0;
    if (mp <= 0) return '-';
    return ((sp * 1000000) / mp).toFixed(9);
  };

  const renderField = (key: keyof FormData, label: string, step: string, isPct?: boolean, hint?: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label className="admin-label">{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="text"
          inputMode="decimal"
          value={form[key] || ''}
          onChange={e => handleChange(key, e.target.value)}
          className="admin-input"
          style={{ flex: 1, textAlign: 'right', fontFamily: 'monospace, monospace' }}
          placeholder="0"
        />
        {isPct && <span style={{ fontSize: 10, color: 'var(--muted-foreground)', minWidth: 16 }}>x</span>}
      </div>
      {hint && <p style={{ fontSize: 9, color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.3 }}>{hint}</p>}
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', width: '90%', margin: '0 auto' }}>
      <div className="admin-form-inner">
        <div style={{ marginBottom: 20 }}>
          <h1 className="admin-form-title">Input Lagging Indicator</h1>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="admin-label">Tahun</label>
            <select className="admin-input" value={tahun} onChange={e => setTahun(e.target.value)} style={{ width: 110, appearance: 'none', cursor: 'pointer' }}>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="admin-label">Site</label>
            <select className="admin-input" value={selectedSite} onChange={e => setSelectedSite(e.target.value)} style={{ width: 200, appearance: 'none', cursor: 'pointer' }}>
              {JOBSITES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="admin-label">Bulan</label>
            <select className="admin-input" value={selectedBulan} onChange={e => setSelectedBulan(e.target.value)} style={{ width: 150, appearance: 'none', cursor: 'pointer' }}>
              <option value="">Pilih Bulan...</option>
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>

        {message && (
          <div style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 16,
            background: message.type === 'success' ? 'rgba(0,184,148,0.1)' : 'rgba(255,68,68,0.1)',
            color: message.type === 'success' ? '#00B894' : '#FF4444',
            border: '1px solid ' + (message.type === 'success' ? 'rgba(0,184,148,0.2)' : 'rgba(255,68,68,0.2)'),
          }}>
            {message.text}
          </div>
        )}

        {loading && <div className="spinner" style={{ margin: '20px auto' }} />}

        {!loading && (
          <>
            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
              <button
                className="admin-btn"
                onClick={() => setActiveTab('leading')}
                style={{
                  background: activeTab === 'leading' ? 'linear-gradient(135deg,#ff4d00,#e04000)' : 'var(--muted)',
                  color: activeTab === 'leading' ? '#fff' : 'var(--foreground)',
                  borderRadius: '8px 8px 0 0',
                }}
              >
                Leading Indicator
              </button>
              <button
                className="admin-btn"
                onClick={() => setActiveTab('lagging')}
                style={{
                  background: activeTab === 'lagging' ? 'linear-gradient(135deg,#ff4d00,#e04000)' : 'var(--muted)',
                  color: activeTab === 'lagging' ? '#fff' : 'var(--foreground)',
                  borderRadius: '8px 8px 0 0',
                }}
              >
                Lagging Indicator
              </button>
            </div>

            <div className="admin-form-card">
              {activeTab === 'leading' ? (
                <div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: '#ff4d00',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Data Leading Indicator
                    {selectedBulan && (
                      <span style={{ color: 'var(--muted-foreground)', fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>
                        - {MONTHS[Number(selectedBulan) - 1].label} {tahun}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    {LEADING_FIELDS.map(f => renderField(f.key as keyof FormData, f.label, f.step))}
                  </div>
                  <div style={{ height: 1, background: 'var(--border)', margin: '18px 0' }} />\n                  <div style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)',
                    marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                    Kalkulasi Otomatis (referensi)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div style={{ background: 'var(--muted)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 9, color: 'var(--muted-foreground)', marginBottom: 4 }}>RKK (layak_bekerja / man_power)</div>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace, monospace', color: 'var(--foreground)' }}>{calcRKK()}</div>
                    </div>
                    <div style={{ background: 'var(--muted)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 9, color: 'var(--muted-foreground)', marginBottom: 4 }}>ASR (absensi_sakit x 1M / man_power)</div>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace, monospace', color: 'var(--foreground)' }}>{calcASR()}</div>
                    </div>
                    <div style={{ background: 'var(--muted)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 9, color: 'var(--muted-foreground)', marginBottom: 4 }}>SSR (spell x 1M / man_power)</div>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace, monospace', color: 'var(--foreground)' }}>{calcSSR()}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: '#ff4d00',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                    Data Lagging Indicator
                    {selectedBulan && (
                      <span style={{ color: 'var(--muted-foreground)', fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>
                        - {MONTHS[Number(selectedBulan) - 1].label} {tahun}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    {LAGGING_FIELDS.map(f => renderField(f.key as keyof FormData, f.label, f.step, f.isPct))}
                  </div>
                  <div style={{ height: 1, background: 'var(--border)', margin: '18px 0' }} />
                  <div style={{
                    background: 'rgba(255,77,0,0.06)', borderRadius: 8, padding: '10px 14px',
                    border: '1px solid rgba(255,77,0,0.12)', display: 'flex', gap: 10, alignItems: 'flex-start',
                  }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ff4d00" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <p style={{ fontSize: 11, color: 'var(--foreground)', margin: 0, lineHeight: 1.5 }}>
                      Nilai lagging indicator bisa diisi manual atau menggunakan hasil kalkulasi otomatis dari tab Leading Indicator sebagai referensi.
                    </p>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 20, display: 'flex', gap: 10, maxWidth: '100%' }}>
                <button
                  className="admin-form-btn-primary"
                  onClick={handleSave}
                  disabled={saving || !selectedBulan}
                  style={message?.type === 'success' ? { background: 'linear-gradient(135deg, #00B894, #00D2A0)' } : undefined}
                >
                  {saving ? 'Menyimpan...' : message?.type === 'success' ? 'Tersimpan!' : 'Simpan Data'}
                </button>
                <button
                  className="admin-form-btn-secondary"
                  onClick={() => { setForm(emptyForm()); setMessage(null); }}
                >
                  Reset
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
