'use client';

import { useState, useCallback, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

const DEPARTMENTS = [
  'Plant',
  'Quality, Safety, Health, & Environment',
  'Finance, Account, & Tax',
  'Human Capital & General Services',
  'Supply Chain Management',
  'Operation',
  'Training & Development Center',
  'Management',
];

const DEFAULT_DIAGNOSA = [
  'Commond Cold', 'Faringitis', 'Vertigo', 'Strain', 'Chepalgia',
  'Unspesified Disorder', 'Gastritis', 'Unspesified Allergy', 'Hipertermia',
  'Odontalgia', 'Hipertensi', 'Myalgia', 'Diarhea', 'Gerd', 'Contusion',
  'Hiperuricemia', 'Disminorhea', 'Unspesified Infection', 'Pulpitis',
  'Vomiting', 'Vulnus Laceratum', 'Hiperlipidemia', 'Hordeulum', 'Stomatitis',
  'Artritis', 'Diabetes Mellitus', 'Dermatitis', 'Tinea', 'Konjungtivitis',
  'Toothache', 'Trauma Okuli', 'Vulnus Contussum', 'Hipotension', 'Migrain',
  'Hipoxia', 'Combustio', 'Keratitis', 'Gingivitis', 'Herpes Zoster',
  'Leukositosis', 'Osteoarthitis', 'Pra-Hipertensi', 'Tachicardia',
];

const DEFAULT_DOSIS = [
  '3DD1',
  '2DD1',
  '1DD1',
  '4DD1',
  '2TAB/BAB',
  'K/P',
  'Q4H',
  '4QH',
  '1x1 Sesudah Makan',
  '2x1 Sesudah Makan',
  '3x1 Sesudah Makan',
];

interface InventoryItem {
  id: string;
  name: string;
  category?: string;
  unit: string;
  stock?: number;
}

const FORM_FIELDS = [
  { id: 'nik', label: 'Cari Data Karyawan', type: 'text', placeholder: 'Ketik NIK atau Nama (opsional jika Magang / Baru)', required: false },
  { id: 'nama', label: 'Nama Pasien / Karyawan', type: 'text', placeholder: 'Nama lengkap pasien (karyawan atau anak magang)', required: true },
  { id: 'jk', label: 'Jenis Kelamin', type: 'select', options: ['Laki - Laki', 'Perempuan'], placeholder: 'Pilih jenis kelamin' },
  { id: 'usia', label: 'Usia (Tahun)', type: 'number', placeholder: 'Contoh: 28' },
  { id: 'departemen', label: 'Departemen', type: 'datalist', listId: 'dept-datalist', options: DEPARTMENTS, placeholder: 'Pilih atau ketik departemen', required: true },
  { id: 'site', label: 'Jobsite', type: 'jobsite', placeholder: 'Pilih lokasi site', required: true },
  { id: 'tanggalKunjungan', label: 'Tanggal Kunjungan', type: 'date', placeholder: '', required: true },
  { id: 'kategori', label: 'Kategori Kunjungan', type: 'select', options: ['Umum', 'Kecelakaan Kerja', 'Penyakit Akibat Kerja'], defaultValue: 'Umum' },
  { id: 'absen', label: 'Surat Izin / Absen', type: 'select', options: ['Tidak', 'Ya'], defaultValue: 'Tidak' },
  { id: 'rujukRS', label: 'Rujuk RS', type: 'select', options: ['Tidak', 'Ya'], required: true, defaultValue: 'Tidak' },
  { id: 'namaRS', label: 'Nama RS (jika dirujuk)', type: 'text', placeholder: 'Nama rumah sakit rujukan' },
  { id: 'catatan', label: 'Keluhan & Hasil Pemeriksaan', type: 'textarea', placeholder: 'Keluhan pasien, hasil tensi (TD, HR, T, dll), atau catatan pemeriksaan...' },
];

export default function KunjunganBerobatForm() {
  const [form, setForm] = useState<Record<string, string>>({
    tanggalKunjungan: new Date().toISOString().split('T')[0],
    kategori: 'Umum',
    absen: 'Tidak',
    rujukRS: 'Tidak',
  });
  const [isManualIdentity, setIsManualIdentity] = useState(false);
  const [diagnoses, setDiagnoses] = useState([{ id: Date.now().toString(), text: '' }]);
  const [medications, setMedications] = useState([{ id: Date.now().toString(), nama: '', aturan: '3DD1', jumlah: '10', satuan: 'Tablet' }]);
  
  // Master database states
  const [masterDiagnosa, setMasterDiagnosa] = useState<string[]>(DEFAULT_DIAGNOSA);
  const [masterDosis, setMasterDosis] = useState<string[]>(DEFAULT_DOSIS);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [savingMasterNotice, setSavingMasterNotice] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Fetch master Diagnosa, Dosis, and Inventory items from DB
  useEffect(() => {
    // Diagnosa master table
    fetch('/api/diagnosa')
      .then(res => res.json())
      .then(json => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setMasterDiagnosa(json.data);
        }
      })
      .catch(() => {});

    // Dosis master table
    fetch('/api/dosis')
      .then(res => res.json())
      .then(json => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setMasterDosis(json.data);
        }
      })
      .catch(() => {});

    // Inventory items (Obat & BHP)
    fetch('/api/inventory')
      .then(res => res.json())
      .then(json => {
        if (json.success && Array.isArray(json.data)) {
          setInventoryList(json.data);
        }
      })
      .catch(() => {});
  }, []);

  const handleChange = (id: string, value: string) => {
    setForm(prev => ({ ...prev, [id]: value }));
    setSaved(false);
  };

  const handleNewIdentity = () => {
    setIsManualIdentity(true);
    const searchVal = (form.nik || '').trim();
    if (/^[a-zA-Z\s]+$/.test(searchVal) && searchVal.length > 2) {
      setForm(prev => ({ ...prev, nama: searchVal, nik: '' }));
    }
  };

  const handleResetToLookup = () => {
    setIsManualIdentity(false);
  };

  // 2. Autofill Employee: Jobsite, Jenis Kelamin, Departemen, Usia, Nama
  const handleEmployeeFound = useCallback((data: EmployeeData) => {
    // Nama
    if (data.nama) handleChange('nama', data.nama);

    // Departemen
    if (data.department) handleChange('departemen', data.department);

    // Usia / Age
    if (data.age || data.usia) {
      handleChange('usia', String(data.age || data.usia));
    }

    // Smart-fill site
    const siteName = (data.site_name || '').trim();
    if (siteName) {
      const matched = JOBSITES.find(j =>
        j.toLowerCase() === siteName.toLowerCase() ||
        siteName.toLowerCase().includes(j.toLowerCase()) ||
        j.toLowerCase().includes(siteName.toLowerCase())
      );
      handleChange('site', matched || siteName);
    }

    // Smart-fill gender / jk (Laki - Laki / Perempuan)
    if (data.gender) {
      const g = data.gender.toLowerCase();
      if (g.includes('l') || g.includes('pria') || g.includes('laki')) {
        handleChange('jk', 'Laki - Laki');
      } else if (g.includes('p') || g.includes('wanita') || g.includes('perempuan')) {
        handleChange('jk', 'Perempuan');
      }
    }
  }, []);

  // Diagnosa handlers
  const handleAddDiagnosis = () => setDiagnoses(prev => [...prev, { id: Date.now().toString(), text: '' }]);
  const handleRemoveDiagnosis = (id: string) => setDiagnoses(prev => prev.filter(d => d.id !== id));
  const handleDiagnosisChange = (id: string, text: string) => setDiagnoses(prev => prev.map(d => d.id === id ? { ...d, text } : d));

  // Save new diagnosa directly to 'diagnosa' master database table
  const handleSaveNewDiagnosaToMaster = async (diagText: string) => {
    const trimmed = diagText.trim();
    if (!trimmed) return;
    try {
      const res = await fetch('/api/diagnosa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama: trimmed }),
      });
      const json = await res.json();
      if (json.success) {
        setMasterDiagnosa(prev => prev.includes(trimmed) ? prev : [...prev, trimmed].sort((a,b)=>a.localeCompare(b)));
        setSavingMasterNotice(`Diagnosa "${trimmed}" berhasil disimpan ke tabel master diagnosa!`);
        setTimeout(() => setSavingMasterNotice(''), 3000);
      }
    } catch {
      // fallback
    }
  };

  // Medication handlers
  const handleAddMedication = () => setMedications(prev => [...prev, { id: Date.now().toString(), nama: '', aturan: '3DD1', jumlah: '10', satuan: 'Tablet' }]);
  const handleRemoveMedication = (id: string) => setMedications(prev => prev.filter(m => m.id !== id));
  
  // When medicine name changes, auto-link to inventory and auto-fill satuan!
  const handleMedicationNameChange = (id: string, name: string) => {
    const matchingInv = inventoryList.find(inv => inv.name.toLowerCase() === name.trim().toLowerCase());
    setMedications(prev => prev.map(m => {
      if (m.id === id) {
        return {
          ...m,
          nama: name,
          satuan: matchingInv?.unit || m.satuan || 'Tablet',
        };
      }
      return m;
    }));
  };

  const handleMedicationFieldChange = (id: string, field: 'aturan'|'jumlah'|'satuan', value: string) => {
    setMedications(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  // Save new dosis directly to 'dosis_obat' master database table
  const handleSaveNewDosisToMaster = async (dosisText: string) => {
    const trimmed = dosisText.trim();
    if (!trimmed) return;
    try {
      const res = await fetch('/api/dosis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kode: trimmed }),
      });
      const json = await res.json();
      if (json.success) {
        setMasterDosis(prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
        setSavingMasterNotice(`Aturan pakai "${trimmed}" berhasil disimpan ke tabel master dosis!`);
        setTimeout(() => setSavingMasterNotice(''), 3000);
      }
    } catch {
      // fallback
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!form.nama || !form.nama.trim()) {
      setErrorMsg('Nama Pasien / Karyawan wajib diisi');
      return;
    }
    if (!form.site) {
      setErrorMsg('Jobsite wajib dipilih');
      return;
    }
    if (!form.tanggalKunjungan) {
      setErrorMsg('Tanggal Kunjungan wajib diisi');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/kunjungan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nik: form.nik && form.nik.trim() ? form.nik.trim() : null,
          nama: form.nama.trim(),
          departemen: form.departemen?.trim() || null,
          jobsite: form.site,
          tanggal: form.tanggalKunjungan,
          usia: form.usia ? parseInt(form.usia, 10) || null : null,
          jk: form.jk || null,
          diagnosa: JSON.stringify(diagnoses.map(d => d.text).filter(Boolean)), 
          jenis_obat: JSON.stringify(medications.filter(m => m.nama).map(({ nama, aturan, jumlah, satuan }) => ({ nama, aturan, jumlah, satuan }))),
          rujuk_rs: form.rujukRS === 'Ya',
          nama_rs: form.namaRS || null,
          keluhan: form.catatan || null,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal menyimpan');
      setSaved(true);
      setForm({
        tanggalKunjungan: new Date().toISOString().split('T')[0],
        kategori: 'Umum',
        absen: 'Tidak',
        rujukRS: 'Tidak',
      });
      setDiagnoses([{ id: Date.now().toString(), text: '' }]);
      setMedications([{ id: Date.now().toString(), nama: '', aturan: '3DD1', jumlah: '10', satuan: 'Tablet' }]);
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
      {/* ─── Datalists terhubung ke Database ─── */}
      <datalist id="dept-datalist">
        {DEPARTMENTS.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>

      {/* Datalist Master Diagnosa (Tabel diagnosa) */}
      <datalist id="master-diagnosa-list">
        {masterDiagnosa.map((diag) => (
          <option key={diag} value={diag} />
        ))}
      </datalist>

      {/* Datalist Master Dosis / Aturan Pakai (Tabel dosis_obat) */}
      <datalist id="master-dosis-list">
        {masterDosis.map((dosis) => (
          <option key={dosis} value={dosis} />
        ))}
      </datalist>

      {/* Datalist Inventory (Tabel inventory_items / v_inventory_summary) */}
      <datalist id="inventory-obat-list">
        {inventoryList.map((item) => (
          <option key={item.id} value={item.name}>
            {item.name} | Satuan: {item.unit} {item.stock !== undefined ? `| Stok: ${item.stock}` : ''}
          </option>
        ))}
      </datalist>

      <datalist id="master-satuan-list">
        {['Tablet', 'Pcs', 'Btl/Flash', 'Ampul', 'Tube', 'Kapsul', 'Sachet'].map((sat) => (
          <option key={sat} value={sat} />
        ))}
      </datalist>

      <div className="admin-form-inner">
        {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <h1 className="admin-form-title">Kunjungan Berobat</h1>
          <p className="admin-form-subtitle">Formulir kunjungan berobat dengan integrasi tabel master diagnosa, dosis obat, dan inventory klinik.</p>
        </div>

        {savingMasterNotice && (
          <div style={{
            background: 'rgba(0,184,148,0.12)',
            border: '1px solid #00B894',
            color: '#00B894',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <CheckCircle2 size={16} />
            {savingMasterNotice}
          </div>
        )}

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

                // NIK field with employee lookup and manual toggle
                if (field.id === 'nik') {
                  if (isManualIdentity) {
                    return (
                      <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <label className="admin-label" style={{ marginBottom: 0 }}>
                            NIK Pasien <span style={{ color: 'var(--muted-foreground)', fontWeight: 'normal', fontSize: 11 }}>(Opsional jika Magang)</span>
                          </label>
                          <button
                            type="button"
                            onClick={handleResetToLookup}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--brand-primary, #ff4d00)',
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            🔍 Cari di Master Karyawan
                          </button>
                        </div>
                        <input
                          type="text"
                          value={form.nik || ''}
                          onChange={(e) => handleChange('nik', e.target.value)}
                          placeholder="Kosongkan jika anak magang tanpa NIK"
                          className="admin-input"
                          style={inputStyle}
                        />
                        <div style={{
                          fontSize: 11,
                          color: '#d97706',
                          background: 'rgba(245,158,11,0.08)',
                          border: '1px solid rgba(245,158,11,0.25)',
                          padding: '6px 10px',
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}>
                          <span>Mode Identitas Baru / Magang aktif (tanpa validasi employee).</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={field.id}>
                      <EmployeeLookupInput
                        value={form.nik || ''}
                        onChange={(v) => handleChange('nik', v)}
                        onEmployeeFound={handleEmployeeFound}
                        onAutoFill={(formFieldId, val) => handleChange(formFieldId, val)}
                        onNewIdentity={handleNewIdentity}
                        autoFill={{
                          nama: 'nama',
                          department: 'departemen',
                          gender: 'jk',
                        }}
                        placeholder={field.placeholder}
                        label={
                          <span className="admin-label" style={{ marginBottom: 0 }}>
                            {field.label} <span style={{ color: 'var(--muted-foreground)', fontWeight: 'normal', fontSize: 11 }}>(Opsional)</span>
                          </span>
                        }
                        required={false}
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
                        value={form[field.id] ?? field.defaultValue ?? ''}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        className="admin-input"
                      >
                        {field.placeholder && <option value="">{field.placeholder}</option>}
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'datalist' ? (
                      <input
                        type="text"
                        list={field.listId}
                        value={form[field.id] || ''}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        className="admin-input"
                      />
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
                      <input
                        type="date"
                        value={form[field.id] || ''}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        className="admin-input"
                      />
                    ) : field.type === 'number' ? (
                      <input
                        type="number"
                        value={form[field.id] || ''}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        className="admin-input"
                      />
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

            {/* ─── DAFTAR DIAGNOSA DENGAN MASTER TABLE 'diagnosa' ─── */}
            <div style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <h4 style={{ fontWeight: 600, fontSize: 14 }}>Daftar Diagnosa (Tabel diagnosa)</h4>
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
                    Pilih diagnosa dari master dropdown atau ketik diagnosa baru dan simpan langsung ke database master diagnosa.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleAddDiagnosis}>
                  <Plus size={14} className="mr-2" /> Tambah Diagnosa
                </Button>
              </div>

              {diagnoses.map((diag, index) => {
                const isNew = diag.text.trim() && !masterDiagnosa.some(d => d.toLowerCase() === diag.text.trim().toLowerCase());
                return (
                  <div key={diag.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: 'var(--muted-foreground)', width: 20 }}>{index + 1}.</span>
                      <input
                        type="text"
                        list="master-diagnosa-list"
                        value={diag.text}
                        onChange={e => handleDiagnosisChange(diag.id, e.target.value)}
                        placeholder="Pilih atau ketik diagnosa (cth: Commond Cold, Faringitis...)"
                        className="admin-input"
                        style={{ flex: 1 }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveDiagnosis(diag.id)}
                        className="text-red-500 hover:text-red-600"
                        disabled={diagnoses.length === 1 && index === 0 && !diag.text}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>

                    {/* Tombol Simpan ke Master Diagnosa jika diagnosa belum ada di tabel */}
                    {isNew && (
                      <div style={{ marginLeft: 28, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => handleSaveNewDiagnosaToMaster(diag.text)}
                          style={{
                            background: 'rgba(255,77,0,0.09)',
                            border: '1px solid rgba(255,77,0,0.3)',
                            borderRadius: 5,
                            padding: '3px 8px',
                            color: 'var(--brand-primary, #ff4d00)',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          ➕ Simpan &quot;{diag.text}&quot; ke Master Diagnosa (Database)
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ─── RESEP & OBAT TERHUBUNG KE INVENTORY & DOSIS MASTER ─── */}
            <div style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <h4 style={{ fontWeight: 600, fontSize: 14 }}>Resep & Obat / BHP (Terhubung ke Inventory)</h4>
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
                    Nama obat dan satuan terhubung otomatis ke database tabel inventory. Dosis terhubung ke master dosis.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleAddMedication}>
                  <Plus size={14} className="mr-2" /> Tambah Obat
                </Button>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, width: 20 }}></span>
                <span style={{ fontSize: 11, fontWeight: 600, flex: 2 }}>Nama Obat / BHP (Tabel Inventory)</span>
                <span style={{ fontSize: 11, fontWeight: 600, flex: 1.2 }}>Dosis / Aturan Pakai</span>
                <span style={{ fontSize: 11, fontWeight: 600, width: 70 }}>Jumlah</span>
                <span style={{ fontSize: 11, fontWeight: 600, width: 90 }}>Satuan (Auto)</span>
                <span style={{ width: 36 }}></span>
              </div>

              {medications.map((med, index) => {
                const isNewDosis = med.aturan.trim() && !masterDosis.some(d => d.toLowerCase() === med.aturan.trim().toLowerCase());
                return (
                  <div key={med.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: 'var(--muted-foreground)', width: 20 }}>{index + 1}.</span>
                      <input
                        type="text"
                        list="inventory-obat-list"
                        value={med.nama}
                        onChange={e => handleMedicationNameChange(med.id, e.target.value)}
                        placeholder="Pilih obat dari inventory..."
                        className="admin-input"
                        style={{ flex: 2 }}
                      />
                      <input
                        type="text"
                        list="master-dosis-list"
                        value={med.aturan}
                        onChange={e => handleMedicationFieldChange(med.id, 'aturan', e.target.value)}
                        placeholder="Dosis (cth: 3DD1)"
                        className="admin-input"
                        style={{ flex: 1.2 }}
                      />
                      <input
                        type="number"
                        value={med.jumlah}
                        onChange={e => handleMedicationFieldChange(med.id, 'jumlah', e.target.value)}
                        placeholder="Jml"
                        className="admin-input"
                        style={{ width: 70 }}
                      />
                      <input
                        type="text"
                        list="master-satuan-list"
                        value={med.satuan || 'Tablet'}
                        onChange={e => handleMedicationFieldChange(med.id, 'satuan', e.target.value)}
                        placeholder="Satuan"
                        className="admin-input"
                        style={{ width: 90 }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMedication(med.id)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>

                    {/* Tombol Simpan ke Master Dosis jika dosis belum ada di database */}
                    {isNewDosis && (
                      <div style={{ marginLeft: 28, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => handleSaveNewDosisToMaster(med.aturan)}
                          style={{
                            background: 'rgba(0,184,148,0.08)',
                            border: '1px solid rgba(0,184,148,0.25)',
                            borderRadius: 5,
                            padding: '3px 8px',
                            color: '#00B894',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          ➕ Simpan &quot;{med.aturan}&quot; ke Master Dosis (Database)
                        </button>
                      </div>
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
                onClick={() => {
                  setForm({
                    tanggalKunjungan: new Date().toISOString().split('T')[0],
                    kategori: 'Umum',
                    absen: 'Tidak',
                    rujukRS: 'Tidak',
                  });
                  setIsManualIdentity(false);
                }}
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
