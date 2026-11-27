'use client';

import { useState, useCallback, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import EmployeeLookupInput, { type EmployeeData } from './EmployeeLookupInput';
import { authFetch } from '@/lib/api-client';
import { invalidateKunjunganDashboardData } from '@/lib/dashboard-data';
import { JOBSITES } from '@/lib/lagging-data';

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
  { id: 'departemen', label: 'Departemen', type: 'datalist', listId: 'dept-datalist', placeholder: 'Pilih atau ketik departemen', required: true },
  { id: 'site', label: 'Jobsite', type: 'jobsite', placeholder: 'Pilih lokasi site', required: true },
  { id: 'tanggalKunjungan', label: 'Tanggal Kunjungan', type: 'date', placeholder: '', required: true },
  { id: 'kategori', label: 'Kategori Kunjungan', type: 'select', options: ['Umum', 'Kecelakaan Kerja', 'Penyakit Akibat Kerja'], defaultValue: 'Umum' },
  { id: 'absen', label: 'Surat Izin / Absen', type: 'select', options: ['Tidak', 'Ya'], defaultValue: 'Tidak' },
  { id: 'rujukRS', label: 'Rujuk RS', type: 'select', options: ['Tidak', 'Ya'], required: true, defaultValue: 'Tidak' },
  { id: 'namaRS', label: 'Nama RS (jika dirujuk)', type: 'text', placeholder: 'Nama rumah sakit rujukan' },
  { id: 'catatan', label: 'Keluhan Klinis & Anamnesis', type: 'textarea', placeholder: 'Keluhan utama pasien, riwayat penyakit sekarang, atau anamnesis lainnya...' },
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
  const [vital, setVital] = useState({
    sistolik: '',
    diastolik: '',
    nadi: '',
    suhu: '',
    rr: '',
    spo2: '',
  });
  
  // Master database states
  const [masterDiagnosa, setMasterDiagnosa] = useState<string[]>([]);
  const [masterDosis, setMasterDosis] = useState<string[]>([]);
  const [departmentList, setDepartmentList] = useState<string[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [savingMasterNotice, setSavingMasterNotice] = useState<string>('');
  const [customDiagIds, setCustomDiagIds] = useState<Record<string, boolean>>({});
  const [openMedDropdownId, setOpenMedDropdownId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  // Hasil tindak lanjut otomatis (episode karyawan sakit / kasus PAK).
  const [infoMsg, setInfoMsg] = useState('');

  // Riwayat Pasien & Alergi
  const [patientHistory, setPatientHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showRiwayatModal, setShowRiwayatModal] = useState(false);
  const [detectedAllergy, setDetectedAllergy] = useState<string>('');

  const fetchPatientHistory = useCallback(async (nik?: string, nama?: string) => {
    const cleanNik = (nik || '').trim();
    const cleanNama = (nama || '').trim();
    if (!cleanNik && !cleanNama) {
      setPatientHistory([]);
      setDetectedAllergy('');
      return;
    }
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams();
      if (cleanNik) params.set('nik', cleanNik);
      if (cleanNama) params.set('nama', cleanNama);
      const json = await authFetch<{ success: boolean; data?: any[] }>(`/api/kunjungan?${params.toString()}`);
      if (json.success && Array.isArray(json.data)) {
        setPatientHistory(json.data);
        let foundAllergy = '';
        for (const item of json.data) {
          const m = String(item.keluhan || '').match(/\[Alergi\]\s*([^\[\n]+)/i);
          if (m && m[1].trim() && !/tidak\s*ada/i.test(m[1])) {
            foundAllergy = m[1].trim();
            break;
          }
        }
        if (foundAllergy) {
          setDetectedAllergy(foundAllergy);
          setForm(prev => prev.alergi ? prev : ({ ...prev, alergi: foundAllergy }));
        } else {
          setDetectedAllergy('');
        }
      } else {
        setPatientHistory([]);
      }
    } catch {
      setPatientHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // 1. Fetch master Diagnosa, Dosis, Departemen, and Inventory items from DB via authFetch
  useEffect(() => {
    // Diagnosa master table
    authFetch<{ success: boolean; data: string[] }>('/api/diagnosa')
      .then(json => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setMasterDiagnosa(json.data);
        }
      })
      .catch(() => {});

    // Dosis master table
    authFetch<{ success: boolean; data: string[] }>('/api/dosis')
      .then(json => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setMasterDosis(json.data);
        }
      })
      .catch(() => {});

    // Departemen dinamis dari database
    authFetch<{ success: boolean; departments: string[] }>('/api/departments')
      .then(json => {
        if (json.success && Array.isArray(json.departments) && json.departments.length > 0) {
          setDepartmentList(json.departments);
        }
      })
      .catch(() => {});

    // Inventory items (Obat & BHP)
    authFetch<{ success: boolean; data: InventoryItem[] }>('/api/inventory')
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
    setPatientHistory([]);
    setDetectedAllergy('');
    const searchVal = (form.nik || '').trim();
    if (/^[a-zA-Z\s]+$/.test(searchVal) && searchVal.length > 2) {
      setForm(prev => ({ ...prev, nama: searchVal, nik: '' }));
    }
  };

  const handleResetToLookup = () => {
    setIsManualIdentity(false);
    setPatientHistory([]);
    setDetectedAllergy('');
  };

  // 2. Autofill Employee: Jobsite, Jenis Kelamin, Departemen, Usia, Nama
  const handleEmployeeFound = useCallback((data: EmployeeData) => {
    // NIK, Nama & Riwayat
    if (data.nik || data.nama) {
      fetchPatientHistory(data.nik, data.nama);
    }

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
      const json = await authFetch<{ success: boolean }>('/api/diagnosa', {
        method: 'POST',
        body: JSON.stringify({ nama: trimmed }),
      });
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
      const json = await authFetch<{ success: boolean }>('/api/dosis', {
        method: 'POST',
        body: JSON.stringify({ kode: trimmed }),
      });
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
    setInfoMsg('');

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
      const tandaVitalParts: string[] = [];
      if (vital.sistolik && vital.diastolik) tandaVitalParts.push(`TD: ${vital.sistolik}/${vital.diastolik} mmHg`);
      else if (vital.sistolik) tandaVitalParts.push(`TD: ${vital.sistolik} mmHg`);
      if (vital.nadi) tandaVitalParts.push(`HR: ${vital.nadi} x/m`);
      if (vital.suhu) tandaVitalParts.push(`Suhu: ${vital.suhu}°C`);
      if (vital.rr) tandaVitalParts.push(`RR: ${vital.rr} x/m`);
      if (vital.spo2) tandaVitalParts.push(`SpO2: ${vital.spo2}%`);

      const finalKeluhan = [
        tandaVitalParts.length ? `[Tanda Vital] ${tandaVitalParts.join(' | ')}` : '',
        form.alergi?.trim() ? `[Alergi] ${form.alergi.trim()}` : '',
        form.catatan?.trim() ? `[Keluhan] ${form.catatan.trim()}` : '',
      ].filter(Boolean).join('\n');

      const json = await authFetch<{
        success: true;
        data?: Array<{ id?: string }>;
        dispense?: {
          berhasil: boolean;
          itemDipotong: Array<{ nama: string; jumlahDipotong: number }>;
          catatan: string[];
        };
      }>('/api/kunjungan', {
        method: 'POST',
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
          absen: form.absen === 'Ya',
          rujuk_rs: form.rujukRS === 'Ya',
          kategori: form.kategori,
          nama_rs: form.namaRS || null,
          keluhan: finalKeluhan || null,
        }),
      });
      invalidateKunjunganDashboardData();

      const infoList: string[] = [];
      if (json.dispense?.itemDipotong?.length) {
        infoList.push(
          `Stok terpotong: ${json.dispense.itemDipotong.map(d => `${d.nama} (${d.jumlahDipotong})`).join(', ')}.`
        );
      }
      if (json.dispense?.catatan?.length) {
        infoList.push(...json.dispense.catatan);
      }

//  TINDAK LANJUT OTOMATIS
      // Surat izin/absen atau rujukan → episode Monitoring Karyawan Sakit.
      // Kategori Penyakit Akibat Kerja → kasus baru di Register PAK.
      // Kegagalan integrasi TIDAK menggagalkan penyimpanan kunjungan; hasilnya
      // dilaporkan di pesan sukses agar terlihat jelas.
      try {
        const ik = await authFetch<{ catatan?: string[] }>('/api/kunjungan/integrasi', {
          method: 'POST',
          body: JSON.stringify({
            kunjunganId: json.data?.[0]?.id,
          }),
        });
        if (Array.isArray(ik.catatan) && ik.catatan.length) {
          infoList.push(...ik.catatan);
        }
      } catch {
        infoList.push('Kunjungan tersimpan, tetapi tautan ke pemantauan karyawan sakit gagal dibuat.');
      }

      if (infoList.length) {
        setInfoMsg(infoList.join(' '));
      }

      setSaved(true);
      setForm({
        tanggalKunjungan: new Date().toISOString().split('T')[0],
        kategori: 'Umum',
        absen: 'Tidak',
        rujukRS: 'Tidak',
        alergi: '',
      });
      setPatientHistory([]);
      setDetectedAllergy('');
      setDiagnoses([{ id: Date.now().toString(), text: '' }]);
      setMedications([{ id: Date.now().toString(), nama: '', aturan: '3DD1', jumlah: '10', satuan: 'Tablet' }]);
      setVital({
        sistolik: '',
        diastolik: '',
        nadi: '',
        suhu: '',
        rr: '',
        spo2: '',
      });
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', width: '94%', margin: '0 auto' }}>
      {/* Datalist Master Dosis / Aturan Pakai (Tabel dosis_obat) */}
      <datalist id="master-dosis-list">
        {masterDosis.map((dosis) => (
          <option key={dosis} value={dosis} />
        ))}
      </datalist>

      <div className="admin-form-inner">
        {/* Header */}
        <div style={{ marginBottom: 8 }}>
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
            <div className="kunjungan-form-grid">
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {form.nama && (
                              <button
                                type="button"
                                className="download-btn-trigger"
                                onClick={() => setShowRiwayatModal(true)}
                                style={{
                                  height: 24,
                                  padding: '0 10px',
                                  fontSize: 11,
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  background: 'linear-gradient(135deg, #ff4d00 0%, #ff6b2b 100%)',
                                  color: '#fff',
                                  fontWeight: 600,
                                  border: 'none',
                                }}
                              >
                                Riwayat {patientHistory.length > 0 ? `(${patientHistory.length})` : ''}
                              </button>
                            )}
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
                              }}
                            >
                              Cari di Master Karyawan
                            </button>
                          </div>
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
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 3 }}>
                            <span className="admin-label" style={{ marginBottom: 0 }}>
                              {field.label} <span style={{ color: 'var(--muted-foreground)', fontWeight: 'normal', fontSize: 11 }}>(Opsional)</span>
                            </span>
                            {(form.nik || form.nama) && (
                              <button
                                type="button"
                                className="download-btn-trigger"
                                onClick={() => {
                                  if ((form.nik || form.nama) && patientHistory.length === 0) {
                                    fetchPatientHistory(form.nik, form.nama);
                                  }
                                  setShowRiwayatModal(true);
                                }}
                                style={{
                                  height: 24,
                                  padding: '0 10px',
                                  fontSize: 11,
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  background: 'linear-gradient(135deg, #ff4d00 0%, #ff6b2b 100%)',
                                  color: '#fff',
                                  fontWeight: 600,
                                  border: 'none',
                                }}
                              >
                                Riwayat {patientHistory.length > 0 ? `(${patientHistory.length})` : ''}
                              </button>
                            )}
                          </div>
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
                      <select
                        value={form[field.id] || ''}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        className="admin-input"
                      >
                        <option value="">{field.placeholder || 'Pilih...'}</option>
                        {(() => {
                          const cur = (form[field.id] || '').trim();
                          const opts = cur && !departmentList.includes(cur)
                            ? [cur, ...departmentList]
                            : departmentList;
                          return opts.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ));
                        })()}
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

            {/* ─── TANDA VITAL & PEMERIKSAAN FISIK ─── */}
            <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--muted)', border: '1px solid var(--border)' }}>
              <div style={{ marginBottom: 8 }}>
                <h4 style={{ fontWeight: 700, fontSize: 12, margin: 0, color: 'var(--foreground)' }}>Tanda Vital &amp; Pemeriksaan Fisik</h4>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                {/* Tekanan Darah */}
                <div>
                  <label className="admin-label" style={{ fontSize: 10, marginBottom: 2 }}>
                    Tekanan Darah <span style={{ color: 'var(--muted-foreground)' }}>(mmHg)</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="number"
                      placeholder="Sistolik (120)"
                      value={vital.sistolik}
                      onChange={(e) => setVital((v) => ({ ...v, sistolik: e.target.value }))}
                      className="admin-input"
                      style={{ ...inputStyle, height: 28, fontSize: 11, padding: '0 6px', textAlign: 'center' }}
                    />
                    <span>/</span>
                    <input
                      type="number"
                      placeholder="Diastolik (80)"
                      value={vital.diastolik}
                      onChange={(e) => setVital((v) => ({ ...v, diastolik: e.target.value }))}
                      className="admin-input"
                      style={{ ...inputStyle, height: 28, fontSize: 11, padding: '0 6px', textAlign: 'center' }}
                    />
                  </div>
                </div>

                {/* Denyut Nadi */}
                <div>
                  <label className="admin-label" style={{ fontSize: 10, marginBottom: 2 }}>
                    Denyut Nadi <span style={{ color: 'var(--muted-foreground)' }}>(x/mnt)</span>
                  </label>
                  <input
                    type="number"
                    placeholder="mis. 80"
                    value={vital.nadi}
                    onChange={(e) => setVital((v) => ({ ...v, nadi: e.target.value }))}
                    className="admin-input"
                    style={{ ...inputStyle, height: 28, fontSize: 11 }}
                  />
                </div>

                {/* Suhu Tubuh */}
                <div>
                  <label className="admin-label" style={{ fontSize: 10, marginBottom: 2 }}>
                    Suhu Tubuh <span style={{ color: 'var(--muted-foreground)' }}>(°C)</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="mis. 36.5"
                    value={vital.suhu}
                    onChange={(e) => setVital((v) => ({ ...v, suhu: e.target.value }))}
                    className="admin-input"
                    style={{ ...inputStyle, height: 28, fontSize: 11 }}
                  />
                </div>

                {/* Pernapasan */}
                <div>
                  <label className="admin-label" style={{ fontSize: 10, marginBottom: 2 }}>
                    Laju Napas <span style={{ color: 'var(--muted-foreground)' }}>(RR x/mnt)</span>
                  </label>
                  <input
                    type="number"
                    placeholder="mis. 18"
                    value={vital.rr}
                    onChange={(e) => setVital((v) => ({ ...v, rr: e.target.value }))}
                    className="admin-input"
                    style={{ ...inputStyle, height: 28, fontSize: 11 }}
                  />
                </div>

                {/* SpO2 */}
                <div>
                  <label className="admin-label" style={{ fontSize: 10, marginBottom: 2 }}>
                    Saturasi O2 <span style={{ color: 'var(--muted-foreground)' }}>(SpO2 %)</span>
                  </label>
                  <input
                    type="number"
                    placeholder="mis. 98"
                    value={vital.spo2}
                    onChange={(e) => setVital((v) => ({ ...v, spo2: e.target.value }))}
                    className="admin-input"
                    style={{ ...inputStyle, height: 28, fontSize: 11 }}
                  />
                </div>
              </div>

              {/* Riwayat Alergi */}
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <label className="admin-label" style={{ fontSize: 10, marginBottom: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Riwayat Alergi <span style={{ color: 'var(--muted-foreground)', fontWeight: 'normal' }}>(Obat / Makanan / Zat Lain)</span></span>
                  {detectedAllergy && (
                    <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 10 }}>
                      ⚠️ Terdeteksi di riwayat: {detectedAllergy}
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  placeholder="mis. Alergi Penisilin/Amoxicillin, Sulfa, Seafood (kosongkan atau isi 'Tidak Ada' bila tidak ada)"
                  value={form.alergi || ''}
                  onChange={(e) => handleChange('alergi', e.target.value)}
                  className="admin-input"
                  style={{ ...inputStyle, height: 28, fontSize: 11 }}
                />
              </div>
            </div>

            {/* ─── DAFTAR DIAGNOSA DENGAN MASTER TABLE 'diagnosa' ─── */}
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <h4 style={{ fontWeight: 600, fontSize: 12.5 }}>Daftar Diagnosa (Tabel diagnosa)</h4>
                  <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', marginTop: 2 }}>
                    Pilih diagnosa dari master dropdown atau ketik diagnosa baru dan simpan langsung ke database master diagnosa.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleAddDiagnosis} style={{ height: 28, fontSize: 11 }}>
                  <Plus size={13} className="mr-1" /> Tambah Diagnosa
                </Button>
              </div>

              {diagnoses.map((diag, index) => {
                const inMaster = masterDiagnosa.some(d => d.toLowerCase() === diag.text.trim().toLowerCase());
                const isCustomMode = !!customDiagIds[diag.id] || (!!diag.text.trim() && !inMaster);
                const isNew = diag.text.trim() && !inMaster;
                return (
                  <div key={diag.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--muted-foreground)', width: 20 }}>{index + 1}.</span>
                      {isCustomMode ? (
                        <div style={{ display: 'flex', gap: 6, flex: 1, alignItems: 'center' }}>
                          <input
                            type="text"
                            value={diag.text}
                            onChange={e => handleDiagnosisChange(diag.id, e.target.value)}
                            placeholder="Ketik diagnosa baru (cth: Common Cold, Faringitis...)"
                            className="admin-input"
                            style={{ flex: 1 }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setCustomDiagIds(prev => ({ ...prev, [diag.id]: false }));
                              if (!inMaster) handleDiagnosisChange(diag.id, '');
                            }}
                            style={{
                              height: 34,
                              padding: '0 10px',
                              borderRadius: 8,
                              border: '1px solid var(--border)',
                              background: 'var(--muted)',
                              color: 'var(--foreground)',
                              fontSize: 10.5,
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Pilih dari Daftar
                          </button>
                        </div>
                      ) : (
                        <select
                          value={diag.text}
                          onChange={e => {
                            if (e.target.value === '__custom__') {
                              setCustomDiagIds(prev => ({ ...prev, [diag.id]: true }));
                              handleDiagnosisChange(diag.id, '');
                            } else {
                              handleDiagnosisChange(diag.id, e.target.value);
                            }
                          }}
                          className="admin-input"
                          style={{ flex: 1 }}
                        >
                          <option value="">Pilih diagnosa...</option>
                          {masterDiagnosa.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                          <option value="__custom__">+ Ketik Diagnosa Baru...</option>
                        </select>
                      )}
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
                          ➕ Simpan "{diag.text}" ke Master Diagnosa (Database)
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ─── RESEP & OBAT TERHUBUNG KE INVENTORY & DOSIS MASTER ─── */}
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <h4 style={{ fontWeight: 600, fontSize: 12.5 }}>Resep & Obat / BHP (Terhubung ke Inventory)</h4>
                  <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', marginTop: 2 }}>
                    Nama obat dan satuan terhubung otomatis ke database tabel inventory. Dosis terhubung ke master dosis.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleAddMedication} style={{ height: 28, fontSize: 11 }}>
                  <Plus size={13} className="mr-1" /> Tambah Obat
                </Button>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, width: 20 }}></span>
                <span style={{ fontSize: 10.5, fontWeight: 600, flex: 2 }}>Nama Obat / BHP (Tabel Inventory)</span>
                <span style={{ fontSize: 10.5, fontWeight: 600, flex: 1.2 }}>Dosis / Aturan Pakai</span>
                <span style={{ fontSize: 10.5, fontWeight: 600, width: 70 }}>Jumlah</span>
                <span style={{ fontSize: 10.5, fontWeight: 600, width: 90 }}>Satuan (Auto)</span>
                <span style={{ width: 36 }}></span>
              </div>

              {medications.map((med, index) => {
                const isNewDosis = med.aturan.trim() && !masterDosis.some(d => d.toLowerCase() === med.aturan.trim().toLowerCase());
                const medQuery = med.nama.trim().toLowerCase();
                const filteredInventory = inventoryList
                  .filter((item) => !medQuery || item.name.toLowerCase().includes(medQuery))
                  .slice(0, 30);
                const satuanOpts = ['Tablet', 'Pcs', 'Btl/Flash', 'Ampul', 'Tube', 'Kapsul', 'Sachet'];
                const curSatuan = med.satuan || 'Tablet';
                const allSatuanOpts = satuanOpts.includes(curSatuan) ? satuanOpts : [curSatuan, ...satuanOpts];
                return (
                  <div key={med.id} style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--muted-foreground)', width: 20 }}>{index + 1}.</span>
                      <div style={{ flex: 2, position: 'relative' }}>
                        <input
                          type="text"
                          value={med.nama}
                          onFocus={() => setOpenMedDropdownId(med.id)}
                          onBlur={() => setTimeout(() => setOpenMedDropdownId((cur) => (cur === med.id ? null : cur)), 150)}
                          onChange={e => {
                            handleMedicationNameChange(med.id, e.target.value);
                            setOpenMedDropdownId(med.id);
                          }}
                          placeholder="Pilih obat dari inventory..."
                          className="admin-input"
                        />
                        {openMedDropdownId === med.id && filteredInventory.length > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 'calc(100% + 4px)',
                              left: 0,
                              right: 0,
                              maxHeight: 220,
                              overflowY: 'auto',
                              background: 'var(--card)',
                              border: '1px solid var(--border)',
                              borderRadius: 8,
                              boxShadow: '0 10px 24px rgba(0,0,0,0.14)',
                              zIndex: 60,
                              padding: 4,
                            }}
                          >
                            {filteredInventory.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleMedicationNameChange(med.id, item.name);
                                  setOpenMedDropdownId(null);
                                }}
                                style={{
                                  width: '100%',
                                  textAlign: 'left',
                                  border: 'none',
                                  background: 'transparent',
                                  padding: '5px 8px',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 1,
                                }}
                                className="hover:bg-black/5 dark:hover:bg-white/5"
                              >
                                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.25 }}>
                                  {item.name}
                                </span>
                                <span style={{ fontSize: 9.5, color: 'var(--muted-foreground)', lineHeight: 1.2 }}>
                                  Satuan: {item.unit}{item.stock !== undefined ? ` · Stok: ${item.stock}` : ''}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
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
                      <select
                        value={curSatuan}
                        onChange={e => handleMedicationFieldChange(med.id, 'satuan', e.target.value)}
                        className="admin-input"
                        style={{ width: 90 }}
                      >
                        {allSatuanOpts.map((sat) => (
                          <option key={sat} value={sat}>{sat}</option>
                        ))}
                      </select>
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
                          ➕ Simpan "{med.aturan}" ke master dosis
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {errorMsg && <p className="login-error-msg" style={{ marginTop: 16 }}>{errorMsg}</p>}
            {infoMsg && (
              <p style={{ marginTop: 12, fontSize: 11.5, color: '#00806a', lineHeight: 1.5 }}>
                {infoMsg}
              </p>
            )}
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
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
                    alergi: '',
                  });
                  setIsManualIdentity(false);
                  setPatientHistory([]);
                  setDetectedAllergy('');
                }}
                className="admin-form-btn-secondary"
              >
                Reset
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ─── POP-UP RIWAYAT KUNJUNGAN PASIEN ─── */}
      <Dialog open={showRiwayatModal} onOpenChange={setShowRiwayatModal}>
        <DialogContent className="sm:max-w-3xl" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
          <DialogHeader>
            <DialogTitle style={{ fontSize: 16 }}>Riwayat Kunjungan Pasien</DialogTitle>
            <DialogDescription asChild>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4, fontSize: 11, alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>{form.nama || 'Pasien'}</span>
                <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(0,0,0,0.04)', color: 'var(--foreground)' }}>
                  NIK: <b>{form.nik || 'Non-NIK'}</b>
                </span>
                <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(155,89,182,0.08)', color: '#8e44ad', border: '1px solid rgba(155,89,182,0.2)' }}>
                  Departemen: <b>{form.departemen || '-'}</b>
                </span>
                <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(46,204,113,0.08)', color: '#27ae60', border: '1px solid rgba(46,204,113,0.2)' }}>
                  Site: <b>{form.site || '-'}</b>
                </span>
              </div>
            </DialogDescription>
          </DialogHeader>

          {detectedAllergy && (
            <div style={{
              padding: '8px 12px',
              borderRadius: 6,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #ef4444',
              color: '#ef4444',
              fontSize: 12,
              fontWeight: 600,
            }}>
              ⚠️ PERINGATAN ALERGI PASIEN: {detectedAllergy}
            </div>
          )}

          {loadingHistory ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>
              Memuat riwayat kunjungan...
            </div>
          ) : patientHistory.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>
              Belum ada riwayat kunjungan sebelumnya untuk pasien ini.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
              {patientHistory.map((item, idx) => {
                let diagStr = '-';
                try {
                  const p = JSON.parse(item.diagnosa);
                  diagStr = Array.isArray(p) ? p.join(', ') : String(item.diagnosa || '-');
                } catch {
                  diagStr = String(item.diagnosa || '-');
                }

                let obatStr = '-';
                try {
                  const p = JSON.parse(item.jenis_obat);
                  if (Array.isArray(p)) {
                    obatStr = p.map((m: any) => m.nama ? `${m.nama} (${m.aturan || ''})` : m).join(', ');
                  } else {
                    obatStr = String(item.jenis_obat || '-');
                  }
                } catch {
                  obatStr = String(item.jenis_obat || '-');
                }

                return (
                  <div key={item.id || idx} style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    fontSize: 12,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                      <strong style={{ color: 'var(--brand-primary, #ff4d00)' }}>{item.tanggal}</strong>
                      <span style={{ color: 'var(--muted-foreground)' }}>{item.jobsite || '-'} · Kategori: {item.kategori || 'Umum'}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <span style={{ color: 'var(--muted-foreground)', display: 'block', fontSize: 11, fontWeight: 600 }}>Anamnesis / Keluhan:</span>
                        <p style={{ margin: '3px 0', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{item.keluhan || '-'}</p>
                      </div>
                      <div>
                        <span style={{ color: 'var(--muted-foreground)', display: 'block', fontSize: 11, fontWeight: 600 }}>Diagnosa Klinis:</span>
                        <p style={{ margin: '3px 0', fontWeight: 600 }}>{diagStr}</p>
                        <span style={{ color: 'var(--muted-foreground)', display: 'block', fontSize: 11, fontWeight: 600, marginTop: 6 }}>Terapi / Obat:</span>
                        <p style={{ margin: '3px 0' }}>{obatStr}</p>
                        {item.rujuk_rs && (
                          <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 6px', borderRadius: 4, background: '#fee2e2', color: '#dc2626', fontSize: 10, fontWeight: 600 }}>
                            Rujuk ke: {item.nama_rs || 'RS Rujukan'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRiwayatModal(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
