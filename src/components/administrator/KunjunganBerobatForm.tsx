'use client';

import { useState, useCallback } from 'react';
import EmployeeLookupInput, { type EmployeeData } from './EmployeeLookupInput';

const JOBSITES = [
  'Aceh','Angsana','Balikpapan','Banjarmasin','Banyuwangi',
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

const FORM_FIELDS = [
  { id: 'nik', label: 'NIK Karyawan', type: 'text', placeholder: 'Masukkan NIK karyawan', required: true },
  { id: 'nama', label: 'Nama Karyawan', type: 'text', placeholder: 'Nama lengkap karyawan', required: true },
  { id: 'departemen', label: 'Departemen', type: 'text', placeholder: 'Nama departemen', required: true },
  { id: 'site', label: 'Jobsite', type: 'jobsite', placeholder: 'Pilih lokasi site', required: true },
  { id: 'tanggalKunjungan', label: 'Tanggal Kunjungan', type: 'date', placeholder: '', required: true },
  { id: 'diagnosa', label: 'Diagnosa', type: 'text', placeholder: 'Diagnosa dokter' },
  { id: 'jenisObat', label: 'Jenis Obat', type: 'text', placeholder: 'Obat yang diberikan' },
  { id: 'rujukRS', label: 'Rujuk RS', type: 'select', options: ['Tidak', 'Ya'], required: true },
  { id: 'namaRS', label: 'Nama RS (jika dirujuk)', type: 'text', placeholder: 'Nama rumah sakit rujukan' },
  { id: 'catatan', label: 'Catatan', type: 'textarea', placeholder: 'Catatan tambahan...' },
];

export default function KunjunganBerobatForm() {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (id: string, value: string) => {
    setForm(prev => ({ ...prev, [id]: value }));
    setSaved(false);
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
      handleChange('site', matched || siteName);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSaving(true);
    try {
      const res = await fetch('/api/kunjungan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nik: form.nik, nama: form.nama, departemen: form.departemen,
          jobsite: form.site, tanggal: form.tanggalKunjungan,
          diagnosa: form.diagnosa, jenis_obat: form.jenisObat,
          rujuk_rs: form.rujukRS, nama_rs: form.namaRS,
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 38,
    borderRadius: 7,
    border: '1px solid var(--border)',
    background: 'var(--background)',
    padding: '0 12px',
    fontSize: 13,
    color: 'var(--foreground)',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border 0.18s, box-shadow 0.18s',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', width: '90%', margin: '0 auto' }}>
      <div className="admin-form-inner">
        {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <h1 className="admin-form-title">Kunjungan Berobat</h1>
          <p className="admin-form-subtitle">Tambahkan data kunjungan berobat karyawan. Data dari form ini akan ditampilkan di Dashboard.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="admin-form-card">
            <div className="admin-section-header">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--brand-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: -2 }}>
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
              </svg>
              <h3 className="admin-section-title">Detail Kunjungan</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {FORM_FIELDS.map((field) => {
                const isFullWidth = field.type === 'textarea';
                // Special rendering for NIK field with employee lookup
                if (field.id === 'nik') {
                  return (
                    <div key={field.id}>
                      <EmployeeLookupInput
                        value={form.nik || ''}
                        onChange={(v) => handleChange('nik', v)}
                        onEmployeeFound={handleEmployeeFound}
                        onAutoFill={(formFieldId, val) => handleChange(formFieldId, val)}
                        autoFill={{
                          nama: 'nama',
                          department: 'departemen',
                        }}
                        placeholder={field.placeholder}
                        label={
                          <span className="admin-label" style={{ marginBottom: 0 }}>
                            {field.label}
                            {field.required && <span style={{ color: 'var(--brand-primary)', marginLeft: 2 }}>*</span>}
                          </span>
                        }
                        required
                        inputStyle={inputStyle}
                      />
                    </div>
                  );
                }
                return (
                  <div key={field.id} style={isFullWidth ? { gridColumn: '1 / -1' } : undefined}>
                    <label className="admin-label">
                      {field.label}
                      {field.required && <span style={{ color: 'var(--brand-primary)', marginLeft: 2 }}>*</span>}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        value={form[field.id] || ''}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        rows={3}
                        className="admin-input"
                        style={{ height: 'auto', resize: 'vertical', padding: '10px 12px', lineHeight: 1.5 }}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        value={form[field.id] || ''}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        className="admin-input"
                      >
                        <option value="">Pilih...</option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'jobsite' ? (
                      <select
                        value={form[field.id] || ''}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        className="admin-input"
                      >
                        <option value="">Pilih Jobsite...</option>
                        {JOBSITES.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'date' ? (
                      <input type="date" value={form[field.id] || ''} onChange={(e) => handleChange(field.id, e.target.value)} className="admin-input" />
                    ) : (
                      <input
                        type="text"
                        value={form[field.id] || ''}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        className="admin-input"
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {errorMsg && <p className="login-error-msg" style={{ marginTop: 16 }}>{errorMsg}</p>}
            <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
              <button
                type="submit"
                disabled={saving}
                className={`admin-form-btn-primary${saved ? ' saved' : ''}`}
              >
                {saving ? 'Menyimpan...' : saved ? 'Tersimpan!' : 'Simpan Data'}
              </button>
              <button
                type="button"
                onClick={() => setForm({})}
                className="admin-form-btn-secondary"
              >
                Reset
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
