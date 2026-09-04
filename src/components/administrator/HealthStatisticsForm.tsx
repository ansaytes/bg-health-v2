'use client';

import { useState, useEffect, useCallback } from 'react';
import { MONTHS } from '@/lib/lagging-data';

const FIELDS = [
  { key: 'man_power', label: 'Man Power', type: 'number' },
  { key: 'man_hours', label: 'Man Hours', type: 'number' },
  { key: 'tk_sakit', label: 'TK Sakit', type: 'number' },
  { key: 'absensi_sakit', label: 'Hari Absensi Sakit', type: 'number' },
  { key: 'spell', label: 'Spell', type: 'number' },
  { key: 'rkk', label: 'RKK', type: 'number', step: '0.0001' },
  { key: 'cmr', label: 'CMR', type: 'number', step: '0.0001' },
  { key: 'mfr', label: 'MFR', type: 'number', step: '0.01' },
  { key: 'ssr', label: 'SSR (Spell)', type: 'number', step: '0.001' },
  { key: 'asr', label: 'ASR', type: 'number', step: '0.01' },
  { key: 'fr_pak', label: 'FR PAK', type: 'number', step: '0.0001' },
  { key: 'kaptk', label: 'KAPTK', type: 'number', step: '0.01' },
] as const;

const DEFAULT_SITE_LIST = [
  'Banyuwangi', 'Balikpapan', 'Banjarmasin', 'Head Office', 'Bengalon',
  'Tanjung Redeb', 'Aceh', 'Bontang', 'Tanjung Tabalong', 'Binuang',
  'Kaliorang', 'Kotamobagu', 'Morowali', 'Batu Kajang', 'Angsana', 'Tuhup',
  'Sangatta', 'Samarinda',
];

interface SiteRow {
  jobsite: string;
  man_power: string;
  asr: string;
}

export default function HealthStatisticsForm() {
  const [tahun, setTahun] = useState('2026');
  const [bulan, setBulan] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [formData, setFormData] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map(f => [f.key, '']))
  );

  const [siteRows, setSiteRows] = useState<SiteRow[]>(
    DEFAULT_SITE_LIST.map(s => ({ jobsite: s, man_power: '', asr: '' }))
  );

  const [loadedMonths, setLoadedMonths] = useState<number[]>([]);

  const fetchMonths = useCallback(async () => {
    try {
      const res = await fetch(`/api/health-statistics?tahun=${tahun}`);
      const json = await res.json();
      if (json.success) {
        setLoadedMonths(json.data.map((r: Record<string, number>) => r.bulan));
      }
    } catch {}
  }, [tahun]);

  useEffect(() => { fetchMonths(); }, [fetchMonths]);

  const handleLoadMonth = async () => {
    if (!bulan) return;
    setMessage(null);
    try {
      const res = await fetch(`/api/health-statistics?tahun=${tahun}&bulan=${bulan}`);
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        const row = json.data[0];
        const newData: Record<string, string> = {};
        FIELDS.forEach(f => {
          newData[f.key] = row[f.key] != null ? String(row[f.key]) : '';
        });
        setFormData(newData);
      } else {
        setFormData(Object.fromEntries(FIELDS.map(f => [f.key, ''])));
      }

      const siteRes = await fetch(`/api/health-statistics-sites?tahun=${tahun}&bulan=${bulan}`);
      const siteJson = await siteRes.json();
      if (siteJson.success && siteJson.data.length > 0) {
        const siteMap: Record<string, { man_power: number; asr: number }> = {};
        siteJson.data.forEach((s: Record<string, unknown>) => {
          siteMap[String(s.jobsite)] = { man_power: Number(s.man_power), asr: Number(s.asr) };
        });
        setSiteRows(prev => prev.map(r => ({
          ...r,
          man_power: siteMap[r.jobsite] ? String(siteMap[r.jobsite].man_power) : '',
          asr: siteMap[r.jobsite] ? String(siteMap[r.jobsite].asr) : '',
        })));
      } else {
        setSiteRows(prev => prev.map(r => ({ ...r, man_power: '', asr: '' })));
      }
    } catch {
      setMessage({ text: 'Gagal memuat data', type: 'error' });
    }
  };

  const handleSave = async () => {
    if (!bulan) {
      setMessage({ text: 'Pilih bulan terlebih dahulu', type: 'error' });
      return;
    }
    setSaving(true);
    setMessage(null);

    try {
      const payload: Record<string, unknown> = { tahun, bulan };
      FIELDS.forEach(f => {
        if (formData[f.key] !== '') payload[f.key] = parseFloat(formData[f.key]);
      });

      const res = await fetch('/api/health-statistics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      const sitesPayload = siteRows
        .filter(r => r.man_power !== '' || r.asr !== '')
        .map(r => ({
          tahun: parseInt(tahun),
          bulan: parseInt(bulan),
          jobsite: r.jobsite,
          man_power: parseInt(r.man_power) || 0,
          asr: parseFloat(r.asr) || 0,
        }));

      if (sitesPayload.length > 0) {
        const siteRes = await fetch('/api/health-statistics-sites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sites: sitesPayload }),
        });
        const siteJson = await siteRes.json();
        if (!siteJson.success) throw new Error(siteJson.error);
      }

      setMessage({ text: `Data ${MONTHS[parseInt(bulan) - 1]} ${tahun} berhasil disimpan!`, type: 'success' });
      fetchMonths();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Gagal menyimpan', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSiteChange = (idx: number, field: 'man_power' | 'asr', value: string) => {
    setSiteRows(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 36,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--card)',
    padding: '0 10px',
    fontSize: 13,
    color: 'var(--foreground)',
    outline: 'none',
    fontFamily: 'inherit',
  };

  return (
    <div className="admin-form-container">
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px 20px',
        width: '90%', maxWidth: 800, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: 0, flexShrink: 0 }}>
            Input Statistik Kesehatan
          </h2>

          <select value={tahun} onChange={e => setTahun(e.target.value)} style={{ ...inputStyle, width: 90 }}>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>

          <select value={bulan} onChange={e => setBulan(e.target.value)} style={{ ...inputStyle, width: 100 }}>
            <option value="">-- Pilih Bulan --</option>
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>

          <button
            onClick={handleLoadMonth}
            disabled={!bulan}
            style={{
              height: 36, padding: '0 14px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--card)', color: 'var(--foreground)', fontSize: 12,
              fontWeight: 600, cursor: bulan ? 'pointer' : 'not-allowed',
              opacity: bulan ? 1 : 0.5, fontFamily: 'inherit',
            }}
          >
            Muat Data
          </button>
        </div>

        {message && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 500,
            background: message.type === 'success' ? 'rgba(0,184,148,0.08)' : 'rgba(255,59,48,0.08)',
            color: message.type === 'success' ? '#00B894' : '#FF3B30',
            textAlign: 'center',
          }}>
            {message.text}
          </div>
        )}

        {loadedMonths.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)', lineHeight: '24px' }}>Tersedia:</span>
            {loadedMonths.map(b => (
              <span key={b} style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 6,
                background: 'var(--accent)', color: 'var(--accent-foreground)', fontWeight: 600,
              }}>{MONTHS[b - 1]}</span>
            ))}
          </div>
        )}

        <div style={{
          background: 'var(--card)', borderRadius: 12, padding: 16, marginBottom: 16,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', marginBottom: 12 }}>
            Data Aggregate Seluruh Site
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {FIELDS.map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 4, letterSpacing: '0.3px', textTransform: 'uppercase' }}>{f.label}</label>
                <input
                  type={f.type}
                  step={'step' in f ? f.step : 'any'}
                  style={inputStyle}
                  value={formData[f.key]}
                  onChange={e => handleFieldChange(f.key, e.target.value)}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

        <div style={{
          background: 'var(--card)', borderRadius: 12, padding: 16, marginBottom: 16,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', marginBottom: 12 }}>
            Data ASR per Jobsite
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Jobsite</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--border)', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.3px', width: 100 }}>Man Power</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--border)', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.3px', width: 120 }}>ASR</th>
                </tr>
              </thead>
              <tbody>
                {siteRows.map((row, i) => (
                  <tr key={row.jobsite}>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', color: 'var(--foreground)', fontWeight: 500 }}>{row.jobsite}</td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
                      <input
                        type="number"
                        style={{ ...inputStyle, height: 30, fontSize: 12, textAlign: 'right' }}
                        value={row.man_power}
                        onChange={e => handleSiteChange(i, 'man_power', e.target.value)}
                        placeholder="0"
                      />
                    </td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
                      <input
                        type="number"
                        step="0.01"
                        style={{ ...inputStyle, height: 30, fontSize: 12, textAlign: 'right' }}
                        value={row.asr}
                        onChange={e => handleSiteChange(i, 'asr', e.target.value)}
                        placeholder="0"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !bulan}
          style={{
            width: '100%', height: 44, borderRadius: 10, border: 'none',
            background: 'linear-gradient(180deg, #ff6b2b, #ff4d00)',
            color: 'white', fontSize: 15, fontWeight: 600, cursor: (saving || !bulan) ? 'not-allowed' : 'pointer',
            opacity: (saving || !bulan) ? 0.5 : 1, fontFamily: 'inherit', letterSpacing: '-0.2px',
          }}
        >
          {saving ? 'Menyimpan...' : 'Simpan Data' }
        </button>
      </div>
    </div>
  );
}
