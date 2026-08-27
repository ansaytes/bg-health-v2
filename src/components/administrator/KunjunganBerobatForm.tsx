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

  const handleEmployeeFound = useCallback((_data: EmployeeData) => {
    // The autoFill prop on EmployeeLookupInput handles the actual field population.
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
    height: 36,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--background)',
    padding: '0 12px',
    fontSize: 12,
    color: 'var(--foreground)',
    outline: 'none',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', width: '90%', margin: '0 auto' }}>
      <div style={{ padding: '16px 0', overflowY: 'auto', flex: 1, minHeight: 0 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>Input Kunjungan Berobat</h2>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Tambahkan data kunjungan berobat karyawan. Data dari form ini akan ditampilkan di Dashboard.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, boxShadow: 'var(--shadow)' }}>
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
                          site_name: 'site',
                        }}
                        placeholder={field.placeholder}
                        label={
                          <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--foreground)' }}>
                            {field.label}
                            {field.required && <span style={{ color: '#ff4d00', marginLeft: 2 }}>*</span>}
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
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--foreground)', marginBottom: 6 }}>
                      {field.label}
                      {field.required && <span style={{ color: '#ff4d00', marginLeft: 2 }}>*</span>}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        value={form[field.id] || ''}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        rows={3}
                        style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', padding: '8px 12px' }}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        value={form[field.id] || ''}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
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
                        style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
                      >
                        <option value="">Pilih Jobsite...</option>
                        {JOBSITES.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'date' ? (
                      <input type="date" value={form[field.id] || ''} onChange={(e) => handleChange(field.id, e.target.value)} style={inputStyle} />
                    ) : (
                      <input
                        type="text"
                        value={form[field.id] || ''}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        style={inputStyle}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {errorMsg && <p style={{ fontSize: 11, color: '#FF4444', marginBottom: 8 }}>{errorMsg}</p>}
            <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  flex: 1, height: 40, borderRadius: 10, border: 'none',
                  background: saved ? 'linear-gradient(135deg, #00B894, #00D2A0)' : 'linear-gradient(135deg, #ff4d00, #ff6b2b)',
                  color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Menyimpan...' : saved ? 'Tersimpan!' : 'Simpan Data'}
              </button>
              <button
                type="button"
                onClick={() => setForm({})}
                style={{
                  height: 40, padding: '0 16px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--foreground)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
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
