'use client';

// Administrator > Higiene Industri > Form Input / Edit HRA
// Health Hazard Risk Assessment (FORM/069 Rev.001)
// P = Tingkat Paparan (Akumulasi jam paparan per minggu sesuai NAB Permenaker 5/2018)
// E = Efek Kesehatan (Tingkat keparahan dampak kesehatan)
// R = Skor Risiko (P × E): Low (1-4), Medium (5-12), High (15-25)

import React, { useState, useEffect } from 'react';
import {
  Save,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Info,
  CheckCircle2,
  Clock,
  BookOpen,
  ArrowRight,
  ChevronLeft,
  Activity,
  Sliders,
  FileText,
} from 'lucide-react';
import { authFetch } from '@/lib/api-client';
import {
  DEPARTEMEN_LIST,
  DepartemenItem,
  normalizeDepartment,
  HAZARD_TYPE_LIST,
  HraHazardEntry,
  PAPARAN_LABELS,
  EFEK_LABELS,
  HRA_RULES,
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

  const [departemen, setDepartemen] = useState(initialData?.departemen || 'OPERATION');
  const [deptOptions, setDeptOptions] = useState<DepartemenItem[]>(DEPARTEMEN_LIST);
  const [jenisPekerjaan, setJenisPekerjaan] = useState(initialData?.jenis_pekerjaan || '');
  const [jenisHazard, setJenisHazard] = useState(initialData?.jenis_hazard || 'Fisika');
  const [sumberHazard, setSumberHazard] = useState(initialData?.sumber_hazard || '');
  const [kelompokBeresiko, setKelompokBeresiko] = useState(initialData?.kelompok_beresiko || '');
  const [efekKesehatan, setEfekKesehatan] = useState(initialData?.efek_kesehatan || '');

  // P = Tingkat Paparan (Akumulasi jam paparan per minggu)
  const [initP, setInitP] = useState<number>(initialData?.init_p ?? 4);
  // E = Efek Kesehatan
  const [initE, setInitE] = useState<number>(initialData?.init_e ?? 4);

  // Kontrol & Pengendalian
  const [tindakanPencegahan, setTindakanPencegahan] = useState(initialData?.tindakan_pencegahan || '');
  const [kontrolTingkat, setKontrolTingkat] = useState(initialData?.kontrol_tingkat || 'APD');

  // Residual Risk setelah kontrol
  const [resP, setResP] = useState<number>(initialData?.res_p ?? 3);
  const [resE, setResE] = useState<number>(initialData?.res_e ?? 4); // Catatan 5: E residual = E initial

  // Regulasi
  const [regulasi, setRegulasi] = useState(
    initialData?.regulasi || 'Permenaker No.5/2018 K3 Lingkungan Kerja; UU No.17/2023 Kesehatan'
  );

  const [saving, setSaving] = useState(false);
  const { popup, popupState, closePopup } = usePopup();

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

  // Update form state saat initialData berubah
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
      setResE(initialData.res_e ?? 4);
      setRegulasi(initialData.regulasi || '');
    }
  }, [initialData]);

  // Otomatis sinkronkan E residual dengan E initial sesuai Catatan Penilaian (5)
  const handleInitEChange = (newE: number) => {
    setInitE(newE);
    setResE(newE); // E residual = E initial
  };

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
      setResE(initialData.res_e ?? 4);
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
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px', background: 'var(--background)' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* macOS Window Toolbar Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderRadius: 14,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, letterSpacing: '-0.01em', color: 'var(--foreground)' }}>
                  {isEdit ? 'Edit Entri Penilaian Risiko HRA' : 'Tambah Entri Identifikasi Risiko HRA'}
                </h2>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'rgba(255, 94, 0, 0.1)',
                    color: '#FF5E00',
                    border: '1px solid rgba(255, 94, 0, 0.25)',
                    letterSpacing: '0.02em',
                  }}
                >
                  FORM/069 Rev.001
                </span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
                P = Tingkat Paparan (Akumulasi Jam/Minggu) • E = Efek Kesehatan • R = Paparan × Efek
              </p>
            </div>
          </div>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 11.5,
                fontWeight: 600,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--foreground)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--muted)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--card)';
              }}
            >
              <ChevronLeft size={13} />
              Kembali ke Daftar
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Section 1: Identifikasi Aktivitas & Bahaya (macOS Inset Group) */}
          <div
            style={{
              padding: '16px 18px',
              background: 'var(--card)',
              borderRadius: 14,
              border: '1px solid var(--border)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: 'rgba(255, 94, 0, 0.12)',
                  color: '#FF5E00',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                1
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--foreground)' }}>
                  Identifikasi Pekerjaan, Bahaya Kesehatan & Kelompok Berisiko
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--muted-foreground)' }}>
                  Tentukan departemen, jenis bahaya higienis, deskripsi paparan kerja, dan jabatan terdampak
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              {/* Departemen */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 5 }}>
                  DEPARTEMEN *
                </label>
                <select
                  value={departemen}
                  onChange={(e) => setDepartemen(e.target.value as any)}
                  style={{
                    width: '100%',
                    height: 34,
                    fontSize: 11.5,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    color: 'var(--foreground)',
                    padding: '0 10px',
                    outline: 'none',
                  }}
                >
                  {deptOptions.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label} {d.desc ? `- ${d.desc}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Jenis Hazard */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 5 }}>
                  KATEGORI HEALTH HAZARD *
                </label>
                <select
                  value={jenisHazard}
                  onChange={(e) => setJenisHazard(e.target.value as any)}
                  style={{
                    width: '100%',
                    height: 34,
                    fontSize: 11.5,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    color: 'var(--foreground)',
                    padding: '0 10px',
                    outline: 'none',
                  }}
                >
                  {HAZARD_TYPE_LIST.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              {/* Jenis Pekerjaan */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 5 }}>
                  JENIS PEKERJAAN / AKTIVITAS SPESIFIK *
                </label>
                <input
                  type="text"
                  value={jenisPekerjaan}
                  onChange={(e) => setJenisPekerjaan(e.target.value)}
                  placeholder="Contoh: Mengemudikan Kendaraan Tambang (Hauling), Pengelasan (Welding), P2H Unit..."
                  style={{
                    width: '100%',
                    height: 34,
                    fontSize: 11.5,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    color: 'var(--foreground)',
                    padding: '0 12px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Sumber Health Hazard */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 5 }}>
                  SUMBER BAHAYA KESEHATAN (HEALTH HAZARD) *
                </label>
                <textarea
                  rows={2}
                  value={sumberHazard}
                  onChange={(e) => setSumberHazard(e.target.value)}
                  placeholder="Deskripsikan faktor penyebab: getaran whole body, debu respirabel silika, kebisingan mesin >85 dBA..."
                  style={{
                    width: '100%',
                    fontSize: 11.5,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    color: 'var(--foreground)',
                    padding: '8px 12px',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Kelompok Berisiko */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 5 }}>
                  KELOMPOK PEKERJA BERISIKO (JABATAN) *
                </label>
                <input
                  type="text"
                  value={kelompokBeresiko}
                  onChange={(e) => setKelompokBeresiko(e.target.value)}
                  placeholder="Contoh: Driver / Operator Hauling, Mekanik Plant, Paramedis Site..."
                  style={{
                    width: '100%',
                    height: 34,
                    fontSize: 11.5,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    color: 'var(--foreground)',
                    padding: '0 12px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Efek Kesehatan */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 5 }}>
                  EFEK KESEHATAN POTENSIAL *
                </label>
                <input
                  type="text"
                  value={efekKesehatan}
                  onChange={(e) => setEfekKesehatan(e.target.value)}
                  placeholder="Contoh: NIHL (Ketulian Bising), LBP Kronik, Silikosis, Heat stroke..."
                  style={{
                    width: '100%',
                    height: 34,
                    fontSize: 11.5,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    color: 'var(--foreground)',
                    padding: '0 12px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Penilaian Initial Risk: P (Tingkat Paparan) x E (Efek) = R */}
          <div
            style={{
              padding: '16px 18px',
              background: 'var(--card)',
              borderRadius: 14,
              border: '1px solid var(--border)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: 'rgba(255, 94, 0, 0.12)',
                    color: '#FF5E00',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  2
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--foreground)' }}>
                    Penilaian Risiko Awal : Initial Risk (P × E = R)
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--muted-foreground)' }}>
                    Tingkat Paparan (P) dihitung dari akumulasi jam paparan per minggu sesuai NAB Permenaker No.5/2018
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 220px', gap: 14, alignItems: 'start' }}>
              {/* Tingkat Paparan P (macOS Pill Stepper) */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                  <Clock size={12} style={{ color: '#FF5E00' }} />
                  TINGKAT PAPARAN (P) : SKOR {initP}
                </label>
                {/* Segmented Pill Selector 1 - 5 */}
                <div
                  style={{
                    display: 'flex',
                    padding: 3,
                    borderRadius: 10,
                    background: 'var(--muted)',
                    gap: 3,
                    marginBottom: 8,
                  }}
                >
                  {[1, 2, 3, 4, 5].map((val) => {
                    const isActive = initP === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setInitP(val)}
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: isActive ? 800 : 600,
                          border: 'none',
                          background: isActive ? 'linear-gradient(180deg, #FF6F1A 0%, #FF4D00 100%)' : 'transparent',
                          color: isActive ? '#fff' : 'var(--muted-foreground)',
                          cursor: 'pointer',
                          boxShadow: isActive ? '0 1px 4px rgba(255, 77, 0, 0.3)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
                {/* Descriptive Pill Badge */}
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    fontSize: 11,
                    lineHeight: 1.35,
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#FF5E00' }}>
                    {PAPARAN_LABELS[initP]?.title} ({PAPARAN_LABELS[initP]?.durasi})
                  </div>
                  <div style={{ color: 'var(--muted-foreground)', fontSize: 10.5, marginTop: 2 }}>
                    {PAPARAN_LABELS[initP]?.desc}
                  </div>
                </div>
              </div>

              {/* Efek Kesehatan E (macOS Pill Stepper) */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                  <ShieldAlert size={12} style={{ color: '#FF5E00' }} />
                  EFEK KESEHATAN / SEVERITY (E) : SKOR {initE}
                </label>
                {/* Segmented Pill Selector 1 - 5 */}
                <div
                  style={{
                    display: 'flex',
                    padding: 3,
                    borderRadius: 10,
                    background: 'var(--muted)',
                    gap: 3,
                    marginBottom: 8,
                  }}
                >
                  {[1, 2, 3, 4, 5].map((val) => {
                    const isActive = initE === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleInitEChange(val)}
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: isActive ? 800 : 600,
                          border: 'none',
                          background: isActive ? 'linear-gradient(180deg, #FF6F1A 0%, #FF4D00 100%)' : 'transparent',
                          color: isActive ? '#fff' : 'var(--muted-foreground)',
                          cursor: 'pointer',
                          boxShadow: isActive ? '0 1px 4px rgba(255, 77, 0, 0.3)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
                {/* Descriptive Pill Badge */}
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    fontSize: 11,
                    lineHeight: 1.35,
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#FF5E00' }}>
                    {EFEK_LABELS[initE]?.title}
                  </div>
                  <div style={{ color: 'var(--muted-foreground)', fontSize: 10.5, marginTop: 2 }}>
                    {EFEK_LABELS[initE]?.desc}
                  </div>
                </div>
              </div>

              {/* Apple Health Style Gauge Card */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: getRiskBg(initR),
                  border: `1px solid ${getRiskBorder(initR)}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  minHeight: 125,
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: getRiskColor(initR), textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  INITIAL RISK (P × E)
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: getRiskColor(initR), margin: '4px 0', letterSpacing: '-0.02em' }}>
                  R = {initR}
                </div>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 10px',
                    borderRadius: 6,
                    fontSize: 10.5,
                    fontWeight: 700,
                    background: 'var(--card)',
                    color: getRiskColor(initR),
                    border: `1px solid ${getRiskBorder(initR)}`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: getRiskColor(initR) }} />
                  {initKat}
                </span>
                <div style={{ fontSize: 9.5, color: 'var(--muted-foreground)', marginTop: 6 }}>
                  {initP} (Paparan) × {initE} (Efek)
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Tindakan Pengendalian & Hierarki Kontrol (macOS Inset Group) */}
          <div
            style={{
              padding: '16px 18px',
              background: 'var(--card)',
              borderRadius: 14,
              border: '1px solid var(--border)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: 'rgba(52, 199, 89, 0.12)',
                  color: '#34C759',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                3
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--foreground)' }}>
                  Tindakan Pencegahan & Hierarki Pengendalian
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--muted-foreground)' }}>
                  Pengendalian difokuskan untuk menurunkan tingkat akumulasi paparan (P)
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 5 }}>
                  TINDAKAN PENCEGAHAN / PENGENDALIAN YANG DITETAPKAN *
                </label>
                <textarea
                  rows={3}
                  value={tindakanPencegahan}
                  onChange={(e) => setTindakanPencegahan(e.target.value)}
                  placeholder="SOP, training, rotasi kerja berkala, pemasangan air filter kabin, ear plug SNR>=27, health campaign..."
                  style={{
                    width: '100%',
                    fontSize: 11.5,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    color: 'var(--foreground)',
                    padding: '8px 12px',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 5 }}>
                  TINGKAT KONTROL UTAMA (Catatan Penilaian 6)
                </label>
                <select
                  value={kontrolTingkat}
                  onChange={(e) => setKontrolTingkat(e.target.value)}
                  style={{
                    width: '100%',
                    height: 34,
                    fontSize: 11.5,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    color: 'var(--foreground)',
                    padding: '0 10px',
                    outline: 'none',
                  }}
                >
                  <option value="ELIMINASI">Eliminasi (Menghilangkan paparan secara tuntas)</option>
                  <option value="SUBSTITUSI">Substitusi (Menurunkan P 2 tingkat)</option>
                  <option value="ENGINEERING">Rekayasa Teknik / Enclosure (Menurunkan P 2 tingkat)</option>
                  <option value="ADMINISTRATIF">Pengendalian Administratif / Rotasi (Menurunkan P 1 tingkat)</option>
                  <option value="APD">Alat Pelindung Diri / APD / APT (Menurunkan P 1 tingkat)</option>
                  <option value="TIDAK_ADA">Belum Ada Pengendalian</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 5 }}>
                  REFERENSI REGULASI / STANDAR PERUNDANGAN
                </label>
                <input
                  type="text"
                  value={regulasi}
                  onChange={(e) => setRegulasi(e.target.value)}
                  placeholder="Contoh: Permenaker No.5/2018; Kepmen ESDM 1827 K; UU 17/2023..."
                  style={{
                    width: '100%',
                    height: 34,
                    fontSize: 11.5,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    color: 'var(--foreground)',
                    padding: '0 12px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Penilaian Residual Risk (Setelah Kontrol) */}
          <div
            style={{
              padding: '16px 18px',
              background: 'var(--card)',
              borderRadius: 14,
              border: '1px solid var(--border)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: 'rgba(255, 94, 0, 0.12)',
                    color: '#FF5E00',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  4
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--foreground)' }}>
                    Penilaian Residual Risk (Risiko Sisa Setelah Pengendalian)
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--muted-foreground)' }}>
                    Catatan Penilaian (5): Efek (E) tetap sama karena keparahan bahaya tidak berubah; Pengendalian menurunkan Tingkat Paparan (P)
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 220px', gap: 14, alignItems: 'start' }}>
              {/* Tingkat Paparan Sisa res_p (macOS Pill Stepper) */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                  <Clock size={12} style={{ color: '#FF5E00' }} />
                  TINGKAT PAPARAN SISA (P) : SKOR {resP}
                </label>
                <div
                  style={{
                    display: 'flex',
                    padding: 3,
                    borderRadius: 10,
                    background: 'var(--muted)',
                    gap: 3,
                    marginBottom: 8,
                  }}
                >
                  {[1, 2, 3, 4, 5].map((val) => {
                    const isActive = resP === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setResP(val)}
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: isActive ? 800 : 600,
                          border: 'none',
                          background: isActive ? 'linear-gradient(180deg, #FF6F1A 0%, #FF4D00 100%)' : 'transparent',
                          color: isActive ? '#fff' : 'var(--muted-foreground)',
                          cursor: 'pointer',
                          boxShadow: isActive ? '0 1px 4px rgba(255, 77, 0, 0.3)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    fontSize: 11,
                    lineHeight: 1.35,
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#FF5E00' }}>
                    {PAPARAN_LABELS[resP]?.title} ({PAPARAN_LABELS[resP]?.durasi})
                  </div>
                  <div style={{ color: 'var(--muted-foreground)', fontSize: 10.5, marginTop: 2 }}>
                    {PAPARAN_LABELS[resP]?.desc}
                  </div>
                </div>
              </div>

              {/* Efek Sisa res_e (Locked/Sync with initial E) */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                  <ShieldAlert size={12} style={{ color: '#FF5E00' }} />
                  EFEK KESEHATAN SISA (E) : SKOR {resE}
                </label>
                <div
                  style={{
                    display: 'flex',
                    padding: 3,
                    borderRadius: 10,
                    background: 'var(--muted)',
                    gap: 3,
                    marginBottom: 8,
                  }}
                >
                  {[1, 2, 3, 4, 5].map((val) => {
                    const isActive = resE === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setResE(val)}
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: isActive ? 800 : 600,
                          border: 'none',
                          background: isActive ? 'linear-gradient(180deg, #FF6F1A 0%, #FF4D00 100%)' : 'transparent',
                          color: isActive ? '#fff' : 'var(--muted-foreground)',
                          cursor: 'pointer',
                          boxShadow: isActive ? '0 1px 4px rgba(255, 77, 0, 0.3)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    fontSize: 11,
                    lineHeight: 1.35,
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#FF5E00' }}>
                    {EFEK_LABELS[resE]?.title} (Sesuai Catatan 5)
                  </div>
                  <div style={{ color: 'var(--muted-foreground)', fontSize: 10.5, marginTop: 2 }}>
                    {EFEK_LABELS[resE]?.desc}
                  </div>
                </div>
              </div>

              {/* Live Residual Risk Gauge Card */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: getRiskBg(resR),
                  border: `1px solid ${getRiskBorder(resR)}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  minHeight: 125,
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: getRiskColor(resR), textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  RESIDUAL RISK (P × E)
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: getRiskColor(resR), margin: '4px 0', letterSpacing: '-0.02em' }}>
                  R = {resR}
                </div>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 10px',
                    borderRadius: 6,
                    fontSize: 10.5,
                    fontWeight: 700,
                    background: 'var(--card)',
                    color: getRiskColor(resR),
                    border: `1px solid ${getRiskBorder(resR)}`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: getRiskColor(resR) }} />
                  {resKat}
                </span>
                <div style={{ fontSize: 9.5, color: 'var(--muted-foreground)', marginTop: 6 }}>
                  Penurunan: {initR} → {resR} ({initR - resR >= 0 ? `-${initR - resR} poin` : '+ poin'})
                </div>
              </div>
            </div>
          </div>

          {/* Kotak Petunjuk Penilaian HRA Baku (FORM/069 Rev.001) - macOS Inset Panel */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 12,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              fontSize: 11,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--foreground)', fontWeight: 700, fontSize: 11.5 }}>
              <BookOpen size={14} style={{ color: '#FF5E00' }} />
              Petunjuk & Catatan Penilaian HRA Baku (FORM/069 Rev.001)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10, marginTop: 4 }}>
              {HRA_RULES.map((r) => (
                <div
                  key={r.no}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    lineHeight: 1.4,
                  }}
                >
                  <b style={{ color: '#FF5E00' }}>({r.no}) {r.title}: </b>
                  <span style={{ color: 'var(--muted-foreground)' }}>{r.rule}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Form Action Buttons (Apple Pill Style) */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 4, paddingBottom: 20 }}>
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 18px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--foreground)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--muted)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--card)';
              }}
            >
              <RotateCcw size={13} />
              Reset Form
            </button>

            <button
              type="submit"
              disabled={saving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 24px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                background: 'linear-gradient(180deg, #FF6F1A 0%, #FF4D00 100%)',
                color: '#fff',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(255, 77, 0, 0.35)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.92';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'none';
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
