'use client';

// ============================================================
// Administrator > Higiene Industri > Form Input / Edit HRA
// Health Hazard Risk Assessment (FORM/069 Rev.001)
// Dilengkapi Kalkulator Matriks Risiko Interaktif P × E = R
// (P = Probability / Peluang, E = Effect / Keparahan, R = Risk)
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  Save,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Info,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { authFetch } from '@/lib/api-client';
import {
  DEPARTEMEN_LIST,
  DepartemenItem,
  normalizeDepartment,
  HAZARD_TYPE_LIST,
  HraHazardEntry,
  PROBABILITY_LABELS,
  EFFECT_LABELS,
  hitungSkorRisiko,
  getKategoriRisiko,
  getRiskColor,
  getRiskBg,
  getRiskBorder,
} from '@/lib/hra';
import { usePopup, Popup } from '@/lib/popup';

interface HraFormProps {
  initialData?: HraHazardEntry | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function HraForm({ initialData, onSuccess, onCancel }: HraFormProps) {
  const isEdit = Boolean(initialData && initialData.id);

  // Form State
  const [departemen, setDepartemen] = useState(initialData?.departemen || 'OPERATION');
  const [deptOptions, setDeptOptions] = useState<DepartemenItem[]>(DEPARTEMEN_LIST);
  const [jenisPekerjaan, setJenisPekerjaan] = useState(initialData?.jenis_pekerjaan || '');

  // Sinkronisasi daftar departemen dari tabel employees via /api/departments
  useEffect(() => {
    authFetch<{ success: boolean; departments: string[] }>('/api/departments')
      .then((res) => {
        if (res && res.departments && res.departments.length > 0) {
          const existingKeys = new Set(DEPARTEMEN_LIST.map((d) => d.key.toUpperCase()));
          const additions: DepartemenItem[] = res.departments
            .filter((d) => !existingKeys.has(d.trim().toUpperCase()))
            .map((d) => ({ key: d.trim().toUpperCase(), label: d.trim(), desc: 'Tabel Employees' }));
          setDeptOptions([...DEPARTEMEN_LIST, ...additions]);
        }
      })
      .catch(() => {});
  }, []);
  const [jenisHazard, setJenisHazard] = useState(initialData?.jenis_hazard || 'Fisika');
  const [sumberHazard, setSumberHazard] = useState(initialData?.sumber_hazard || '');
  const [kelompokBeresiko, setKelompokBeresiko] = useState(initialData?.kelompok_beresiko || '');
  const [efekKesehatan, setEfekKesehatan] = useState(initialData?.efek_kesehatan || '');

  // Initial Risk
  const [initP, setInitP] = useState<number>(initialData?.init_p ?? 4);
  const [initE, setInitE] = useState<number>(initialData?.init_e ?? 4);

  // Kontrol & Pengendalian
  const [tindakanPencegahan, setTindakanPencegahan] = useState(initialData?.tindakan_pencegahan || '');
  const [kontrolTingkat, setKontrolTingkat] = useState(initialData?.kontrol_tingkat || 'APD');

  // Residual Risk
  const [resP, setResP] = useState<number>(initialData?.res_p ?? 3);
  const [resE, setResE] = useState<number>(initialData?.res_e ?? 3);

  // Regulasi
  const [regulasi, setRegulasi] = useState(
    initialData?.regulasi || 'Permenaker No.5/2018 K3 Lingkungan Kerja; UU No.17/2023 Kesehatan'
  );

  const [saving, setSaving] = useState(false);
  const { popup, popupState, closePopup } = usePopup();

  // Reset form when initialData changes
  useEffect(() => {
    if (initialData) {
      setDepartemen(initialData.departemen || 'OPERATION');
      setJenisPekerjaan(initialData.jenis_pekerjaan || '');
      setJenisHazard(initialData.jenis_hazard || 'Fisika');
      setSumberHazard(initialData.sumber_hazard || '');
      setKelompokBeresiko(initialData.kelompok_beresiko || '');
      setEfekKesehatan(initialData.efek_kesehatan || '');
      setInitP(initialData.init_p ?? 4);
      setInitE(initialData.init_e ?? 4);
      setTindakanPencegahan(initialData.tindakan_pencegahan || '');
      setKontrolTingkat(initialData.kontrol_tingkat || 'APD');
      setResP(initialData.res_p ?? 3);
      setResE(initialData.res_e ?? 3);
      setRegulasi(initialData.regulasi || '');
    }
  }, [initialData]);

  // Kalkulasi Skor Real-Time
  const initR = hitungSkorRisiko(initP, initE);
  const initKat = getKategoriRisiko(initR);

  const resR = hitungSkorRisiko(resP, resE);
  const resKat = getKategoriRisiko(resR);

  const handleReset = () => {
    if (initialData) {
      setDepartemen(initialData.departemen || 'OPERATION');
      setJenisPekerjaan(initialData.jenis_pekerjaan || '');
      setJenisHazard(initialData.jenis_hazard || 'Fisika');
      setSumberHazard(initialData.sumber_hazard || '');
      setKelompokBeresiko(initialData.kelompok_beresiko || '');
      setEfekKesehatan(initialData.efek_kesehatan || '');
      setInitP(initialData.init_p ?? 4);
      setInitE(initialData.init_e ?? 4);
      setTindakanPencegahan(initialData.tindakan_pencegahan || '');
      setKontrolTingkat(initialData.kontrol_tingkat || 'APD');
      setResP(initialData.res_p ?? 3);
      setResE(initialData.res_e ?? 3);
      setRegulasi(initialData.regulasi || '');
    } else {
      setJenisPekerjaan('');
      setSumberHazard('');
      setKelompokBeresiko('');
      setEfekKesehatan('');
      setTindakanPencegahan('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jenisPekerjaan.trim() || !sumberHazard.trim() || !kelompokBeresiko.trim() || !efekKesehatan.trim()) {
      popup({
        type: 'info',
        title: 'Form Belum Lengkap',
        message: 'Mohon lengkapi jenis pekerjaan, sumber hazard, kelompok berisiko, dan efek kesehatan.',
      });
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<HraHazardEntry> = {
        departemen,
        jenis_pekerjaan: jenisPekerjaan.trim(),
        jenis_hazard: jenisHazard,
        sumber_hazard: sumberHazard.trim(),
        kelompok_beresiko: kelompokBeresiko.trim(),
        efek_kesehatan: efekKesehatan.trim(),
        init_p: initP,
        init_e: initE,
        init_r: initR,
        tindakan_pencegahan: tindakanPencegahan.trim(),
        kontrol_tingkat: kontrolTingkat,
        res_p: resP,
        res_e: resE,
        res_r: resR,
        regulasi: regulasi.trim(),
      };

      if (isEdit && initialData?.id) {
        payload.id = initialData.id;
        await authFetch('/api/hra', {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        popup({
          type: 'success',
          title: 'Berhasil Diperbarui',
          message: 'Entri penilaian risiko HRA berhasil disimpan.',
        });
      } else {
        await authFetch('/api/hra', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        popup({
          type: 'success',
          title: 'Berhasil Disimpan',
          message: 'Entri identifikasi bahaya HRA baru berhasil ditambahkan.',
        });
      }

      if (onSuccess) onSuccess();
    } catch (err) {
      popup({
        type: 'error',
        title: 'Gagal Menyimpan',
        message: err instanceof Error ? err.message : 'Terjadi kendala saat menyimpan data.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Header Form */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
              {isEdit ? 'Edit Entri Penilaian Risiko (HRA)' : 'Tambah Entri Identifikasi Risiko Baru (HRA)'}
            </h2>
            <p style={{ fontSize: 11.5, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
              Dokumen Acuan: BG/QSHE/FORM/069 Rev.001 (Health Hazard Risk Assessment)
            </p>
          </div>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 11.5,
                fontWeight: 600,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--foreground)',
                cursor: 'pointer',
              }}
            >
              Kembali ke Daftar
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Section 1: Identifikasi Aktivitas & Bahaya */}
          <div className="admin-form-card" style={{ padding: '14px 16px', background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 4, height: 16, borderRadius: 2, background: 'var(--brand-primary, #ff4d00)' }} />
              1. Identifikasi Pekerjaan, Bahaya Kesehatan & Kelompok Berisiko
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              {/* Departemen */}
              <div>
                <label className="admin-label" style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Departemen *
                </label>
                <select
                  className="admin-input"
                  value={departemen}
                  onChange={(e) => setDepartemen(e.target.value as any)}
                  style={{ width: '100%', height: 32, fontSize: 11.5, borderRadius: 6 }}
                >
                  {deptOptions.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label} {d.desc ? `— ${d.desc}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Jenis Hazard */}
              <div>
                <label className="admin-label" style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Jenis Health Hazard *
                </label>
                <select
                  className="admin-input"
                  value={jenisHazard}
                  onChange={(e) => setJenisHazard(e.target.value as any)}
                  style={{ width: '100%', height: 32, fontSize: 11.5, borderRadius: 6 }}
                >
                  {HAZARD_TYPE_LIST.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              {/* Jenis Pekerjaan */}
              <div style={{ gridColumn: 'span 2' }}>
                <label className="admin-label" style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Jenis Pekerjaan / Aktivitas *
                </label>
                <input
                  type="text"
                  className="admin-input"
                  value={jenisPekerjaan}
                  onChange={(e) => setJenisPekerjaan(e.target.value)}
                  placeholder="Contoh: Mengemudikan Kendaraan Tambang (Hauling), Pengelasan (Welding), P2H Unit..."
                  style={{ width: '100%', height: 32, fontSize: 11.5, borderRadius: 6 }}
                />
              </div>

              {/* Sumber Health Hazard */}
              <div style={{ gridColumn: 'span 2' }}>
                <label className="admin-label" style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Sumber Bahaya Kesehatan (Health Hazard) *
                </label>
                <textarea
                  className="admin-input"
                  rows={2}
                  value={sumberHazard}
                  onChange={(e) => setSumberHazard(e.target.value)}
                  placeholder="Deskripsikan faktor penyebab: getaran whole body, debu respirabel silika, kebisingan mesin >85 dBA..."
                  style={{ width: '100%', fontSize: 11.5, padding: '6px 8px', borderRadius: 6 }}
                />
              </div>

              {/* Kelompok Berisiko */}
              <div>
                <label className="admin-label" style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Kelompok Pekerja Berisiko (Jabatan) *
                </label>
                <input
                  type="text"
                  className="admin-input"
                  value={kelompokBeresiko}
                  onChange={(e) => setKelompokBeresiko(e.target.value)}
                  placeholder="Contoh: Driver / Operator, Mekanik Plant, Paramedis..."
                  style={{ width: '100%', height: 32, fontSize: 11.5, borderRadius: 6 }}
                />
              </div>

              {/* Efek Kesehatan */}
              <div>
                <label className="admin-label" style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Efek Kesehatan Potensial *
                </label>
                <input
                  type="text"
                  className="admin-input"
                  value={efekKesehatan}
                  onChange={(e) => setEfekKesehatan(e.target.value)}
                  placeholder="Contoh: NIHL, LBP / HNP kronik, Silikosis, Heat stroke..."
                  style={{ width: '100%', height: 32, fontSize: 11.5, borderRadius: 6 }}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Penilaian Risiko Awal (Initial Risk Matrix: P x E = R) */}
          <div className="admin-form-card" style={{ padding: '14px 16px', background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 4, height: 16, borderRadius: 2, background: getRiskColor(initR) }} />
              2. Penilaian Risiko Awal — Initial Risk (P × E = R)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 180px', gap: 12, alignItems: 'center' }}>
              {/* Peluang / Probability P */}
              <div>
                <label className="admin-label" style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Peluang / Probability (P) : {initP}
                </label>
                <select
                  className="admin-input"
                  value={initP}
                  onChange={(e) => setInitP(Number(e.target.value))}
                  style={{ width: '100%', height: 32, fontSize: 11, borderRadius: 6 }}
                >
                  {[1, 2, 3, 4, 5].map((val) => (
                    <option key={val} value={val}>
                      {val} - {PROBABILITY_LABELS[val]?.title}: {PROBABILITY_LABELS[val]?.desc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Efek / Effect E */}
              <div>
                <label className="admin-label" style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Efek Keparahan / Effect (E) : {initE}
                </label>
                <select
                  className="admin-input"
                  value={initE}
                  onChange={(e) => setInitE(Number(e.target.value))}
                  style={{ width: '100%', height: 32, fontSize: 11, borderRadius: 6 }}
                >
                  {[1, 2, 3, 4, 5].map((val) => (
                    <option key={val} value={val}>
                      {val} - {EFFECT_LABELS[val]?.title}: {EFFECT_LABELS[val]?.desc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Score Display Card */}
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: getRiskBg(initR),
                  border: `1px solid ${getRiskBorder(initR)}`,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 9.5, fontWeight: 800, color: getRiskColor(initR), textTransform: 'uppercase' }}>
                  Initial Risk (P × E)
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: getRiskColor(initR), margin: '2px 0' }}>
                  R = {initR}
                </div>
                <div style={{ fontSize: 10, fontWeight: 800, color: getRiskColor(initR) }}>
                  Kategori: {initKat.toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Tindakan Pengendalian & Hierarki Kontrol */}
          <div className="admin-form-card" style={{ padding: '14px 16px', background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 4, height: 16, borderRadius: 2, background: '#3498DB' }} />
              3. Tindakan Pencegahan & Hierarki Pengendalian (Control Hierarchy)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label className="admin-label" style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Tindakan Pencegahan / Pengendalian yang Ditetapkan *
                </label>
                <textarea
                  className="admin-input"
                  rows={3}
                  value={tindakanPencegahan}
                  onChange={(e) => setTindakanPencegahan(e.target.value)}
                  placeholder="SOP, training, rotasi kerja, pemasangan filter kabin, ear plug SNR>=27, health campaign..."
                  style={{ width: '100%', fontSize: 11.5, padding: '6px 8px', borderRadius: 6 }}
                />
              </div>

              <div>
                <label className="admin-label" style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Tingkat Kontrol Utama
                </label>
                <select
                  className="admin-input"
                  value={kontrolTingkat}
                  onChange={(e) => setKontrolTingkat(e.target.value)}
                  style={{ width: '100%', height: 32, fontSize: 11.5, borderRadius: 6 }}
                >
                  <option value="ELIMINASI">Eliminasi (Menghilangkan bahaya)</option>
                  <option value="SUBSTITUSI">Substitusi (Mengganti bahan/alat lebih aman)</option>
                  <option value="ENGINEERING">Rekayasa Teknik / Engineering Control</option>
                  <option value="ADMINISTRATIF">Pengendalian Administratif (SOP, Rotasi)</option>
                  <option value="APD">Alat Pelindung Diri (APD/APT)</option>
                  <option value="TIDAK_ADA">Belum Ada Pengendalian</option>
                </select>
              </div>

              <div>
                <label className="admin-label" style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Referensi Regulasi / Standar Perundangan
                </label>
                <input
                  type="text"
                  className="admin-input"
                  value={regulasi}
                  onChange={(e) => setRegulasi(e.target.value)}
                  placeholder="Contoh: Permenaker No.5/2018; Kepmen ESDM 1827 K; UU 17/2023..."
                  style={{ width: '100%', height: 32, fontSize: 11.5, borderRadius: 6 }}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Penilaian Residual Risk (Setelah Kontrol: P x E = R) */}
          <div className="admin-form-card" style={{ padding: '14px 16px', background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 4, height: 16, borderRadius: 2, background: getRiskColor(resR) }} />
              4. Penilaian Residual Risk — Risiko Sisa (P × E = R)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 180px', gap: 12, alignItems: 'center' }}>
              {/* Peluang Sisa res_p */}
              <div>
                <label className="admin-label" style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Peluang Sisa / Probability (P) : {resP}
                </label>
                <select
                  className="admin-input"
                  value={resP}
                  onChange={(e) => setResP(Number(e.target.value))}
                  style={{ width: '100%', height: 32, fontSize: 11, borderRadius: 6 }}
                >
                  {[1, 2, 3, 4, 5].map((val) => (
                    <option key={val} value={val}>
                      {val} - {PROBABILITY_LABELS[val]?.title}: {PROBABILITY_LABELS[val]?.desc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Efek Sisa res_e */}
              <div>
                <label className="admin-label" style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Efek Keparahan Sisa / Effect (E) : {resE}
                </label>
                <select
                  className="admin-input"
                  value={resE}
                  onChange={(e) => setResE(Number(e.target.value))}
                  style={{ width: '100%', height: 32, fontSize: 11, borderRadius: 6 }}
                >
                  {[1, 2, 3, 4, 5].map((val) => (
                    <option key={val} value={val}>
                      {val} - {EFFECT_LABELS[val]?.title}: {EFFECT_LABELS[val]?.desc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Residual Score Display Card */}
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: getRiskBg(resR),
                  border: `1px solid ${getRiskBorder(resR)}`,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 9.5, fontWeight: 800, color: getRiskColor(resR), textTransform: 'uppercase' }}>
                  Residual Risk (P × E)
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: getRiskColor(resR), margin: '2px 0' }}>
                  R = {resR}
                </div>
                <div style={{ fontSize: 10, fontWeight: 800, color: getRiskColor(resR) }}>
                  Kategori: {resKat.toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          {/* Form Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 11.5,
                fontWeight: 600,
                border: '1px solid var(--border)',
                background: 'var(--background)',
                color: 'var(--foreground)',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={13} /> Reset Form
            </button>

            <button
              type="submit"
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 24px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 800,
                border: 'none',
                background: 'var(--brand-primary, #ff4d00)',
                color: '#fff',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(255, 77, 0, 0.25)',
              }}
            >
              <Save size={14} />
              {saving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan Entri HRA'}
            </button>
          </div>
        </form>
      </div>
      <Popup state={popupState} closePopup={closePopup} />
    </div>
  );
}
