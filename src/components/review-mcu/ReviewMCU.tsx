'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import EmployeeLookupInput, { type EmployeeData as LookupEmployeeData } from '@/components/administrator/EmployeeLookupInput';
import {
  Search, ClipboardPaste, Sparkles, ArrowRight, ArrowLeft,
  User, Activity, Eye, HeartPulse, Droplets, FlaskConical,
  Shield, Pill, ScanLine, Wind, Ear, Brain, Dumbbell,
  ClipboardCheck, Calculator, Zap, Save, RotateCcw,
  ChevronRight, Loader2, AlertCircle, CheckCircle2, FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { useMCUStore, type EmployeeData as MCUEmployeeData } from '@/lib/store';
import { MCU_FIELDS, MCU_SECTIONS, getFieldsBySection, type MCUFieldDef } from '@/lib/mcu-fields';
import {
  DEFAULT_GEMINI_OCR_MODEL,
  GEMINI_OCR_MODELS,
  getGeminiOcrModel,
} from '@/lib/gemini-ocr-models';
import { calcEgfrCkdEpi2021, getMissingZonasiInputs } from '@/lib/zonasi-engine';

type SearchBy = 'nik' | 'national_id' | 'nama';

function calculateAge(birthDate?: string | null) {
  if (!birthDate) return '';
  const birth = new Date(`${birthDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday = now.getMonth() < birth.getMonth()
    || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 130 ? String(age) : '';
}

function normalizeGender(value?: string | null) {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('perem') || normalized.includes('female') || normalized.includes('wanita')) return 'Perempuan';
  if (normalized.includes('laki') || normalized.includes('male') || normalized.includes('pria')) return 'Laki - Laki';
  return value || '';
}

function detectSearchBy(query: string): SearchBy {
  const trimmed = query.trim();
  if (/[a-zA-Z]/.test(trimmed)) return 'nama';
  if (/^\d{16}$/.test(trimmed)) return 'national_id';
  if (/^\d+$/.test(trimmed)) return 'nik';
  return 'nama';
}

function mapEmployee(emp: LookupEmployeeData, query: string, searchBy: SearchBy): MCUEmployeeData {
  return {
    nikKaryawan: emp.nik || '',
    nationalId: emp.national_id || (searchBy === 'national_id' ? query.trim() : ''),
    nama: emp.nama || '',
    gender: normalizeGender(emp.gender),
    jabatan: emp.job_position || '',
    site: emp.site_name || '',
    usia: calculateAge(emp.birth_date) || emp.age || '',
  };
}

function employeeFormData(employee: MCUEmployeeData): Record<string, string> {
  return {
    nationalId: employee.nationalId || '',
    nikKaryawan: employee.nikKaryawan,
    nama: employee.nama,
    jenisKelamin: employee.gender,
    jabatan: employee.jabatan,
    site: employee.site,
    usia: employee.usia,
  };
}
import { supabase } from '@/lib/supabase';

// Icon map for section icons
const SECTION_ICONS: Record<string, React.ReactNode> = {
  User: <User className="size-4" />,
  Activity: <Activity className="size-4" />,
  Eye: <Eye className="size-4" />,
  HeartPulse: <HeartPulse className="size-4" />,
  Droplets: <Droplets className="size-4" />,
  FlaskConical: <FlaskConical className="size-4" />,
  Shield: <Shield className="size-4" />,
  Pill: <Pill className="size-4" />,
  Scan: <ScanLine className="size-4" />,
  Wind: <Wind className="size-4" />,
  Ear: <Ear className="size-4" />,
  Brain: <Brain className="size-4" />,
  Dumbbell: <Dumbbell className="size-4" />,
  ClipboardCheck: <ClipboardCheck className="size-4" />,
  Calculator: <Calculator className="size-4" />,
};

// Slide variants for step transitions
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

// Card reveal animation
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: 'easeOut' as const },
  }),
};

// Button press animation
const buttonTap = {
  whileTap: { scale: 0.97 },
  transition: { type: 'spring' as const, stiffness: 400, damping: 17 },
};

// Check if a value is abnormal based on gender
function isAbnormal(field: MCUFieldDef, value: string, gender?: string): boolean {
  if (!value || value === 'N/A' || value === 'DBN') return false;
  if (field.type !== 'number') return false;
  const num = parseFloat(value);
  if (isNaN(num)) return false;
  const isMale = gender?.toLowerCase().includes('laki');
  const isFemale = gender?.toLowerCase().includes('perem');

  if (isMale && field.lowMale !== undefined && field.highMale !== undefined) {
    return num < field.lowMale || num > field.highMale;
  }
  if (isFemale && field.lowFemale !== undefined && field.highFemale !== undefined) {
    return num < field.lowFemale || num > field.highFemale;
  }
  if (field.low !== undefined && field.high !== undefined) {
    return num < field.low || num > field.high;
  }
  if (field.high !== undefined && field.low === undefined) {
    return num > field.high;
  }
  if (field.low !== undefined && field.high === undefined) {
    return num < field.low;
  }
  return false;
}

function getNormalRangeText(field: MCUFieldDef, gender?: string): string {
  if (gender?.toLowerCase().includes('laki') && field.normalMale) return field.normalMale;
  if (gender?.toLowerCase().includes('perem') && field.normalFemale) return field.normalFemale;
  return field.normalRange || '';
}

export default function ReviewMCU() {
  const store = useMCUStore();
  const [nikInput, setNikInput] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [direction, setDirection] = useState(1);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [extractionCooldown, setExtractionCooldown] = useState(0);
  const [ocrModelId, setOcrModelId] = useState(DEFAULT_GEMINI_OCR_MODEL);
  useEffect(() => {
    if (extractionCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setExtractionCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [extractionCooldown]);

  const stepIndex = useMemo(() => {
    return store.reviewStep === 'search' ? 0 : store.reviewStep === 'ocr' ? 1 : 2;
  }, [store.reviewStep]);

  const goStep = useCallback(
    (step: 'search' | 'ocr' | 'form', dir?: number) => {
      setDirection(dir ?? (store.reviewStep === 'search' && step === 'ocr' ? 1
        : store.reviewStep === 'ocr' && step === 'search' ? -1
        : store.reviewStep === 'ocr' && step === 'form' ? 1
        : store.reviewStep === 'form' && step === 'ocr' ? -1 : 1));
      store.setReviewStep(step);
    },
    [store]
  );

  // Step 1: Search employee
  const handleSearch = useCallback(async () => {
    if (!nikInput.trim()) return;
    const searchBy = detectSearchBy(nikInput);
    store.setSearchingEmployee(true);
    try {
      const res = await fetch('/api/employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: nikInput.trim(), searchBy }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        // API returns array of raw records; take first and map fields
        const emp = Array.isArray(json.data) ? json.data[0] : json.data;
        const mapped = mapEmployee(emp, nikInput, searchBy);
        store.setEmployee(mapped);
        store.setFormBatch(employeeFormData(mapped));
        store.showToast('Data karyawan ditemukan', 'success');
      } else {
        store.showToast(json.error || 'Karyawan tidak ditemukan', 'error');
      }
    } catch {
      store.showToast('Gagal menghubungi server', 'error');
    } finally {
      store.setSearchingEmployee(false);
    }
  }, [nikInput, store]);

  // Recall the latest persisted MCU record for the selected employee.
  const handleRecall = useCallback(async () => {
    if (!store.employee?.nikKaryawan && !store.formData.nationalId) {
      store.showToast('NIK Karyawan atau NIK KTP belum tersedia', 'error');
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const params = new URLSearchParams();
      if (store.employee?.nikKaryawan) params.set('nik', store.employee.nikKaryawan);
      else if (store.formData.nationalId) params.set('national_id', store.formData.nationalId);
      const response = await fetch(`/api/mcu/records?${params.toString()}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Gagal mengambil data MCU');
      if (!json.record) {
        store.showToast('Belum ada data MCU tersimpan untuk karyawan ini', 'info');
        return;
      }
      store.setFormBatch(json.record);
      store.showToast('Data MCU terakhir berhasil dipanggil dari database', 'success');
      goStep('form', 1);
    } catch (error) {
      store.showToast(error instanceof Error ? error.message : 'Gagal mengambil data MCU', 'error');
    }
  }, [store, goStep]);

  // Step 2: OCR extraction
  const handleExtract = useCallback(async () => {
    if (!ocrText.trim()) return;
    store.setExtractingOCR(true);
    setOcrProgress(0);

    // Simulate progress
    const interval = setInterval(() => {
      setOcrProgress((p) => Math.min(p + Math.random() * 15, 90));
    }, 300);

    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ocrText.trim(), modelId: ocrModelId }),
      });
      clearInterval(interval);
      setOcrProgress(100);
      const json = await res.json();
      if (json.success && json.data) {
        const extractedData = { ...json.data };
        delete extractedData.rekFU;
        store.setFormBatch({
          ...extractedData,
          ...(store.employee ? employeeFormData(store.employee) : {}),
        });
        store.showToast('Data berhasil diekstrak', 'success');
        setTimeout(() => goStep('form', 1), 500);
      } else {
        const retrySeconds = Number(json.retryAfterSeconds || res.headers.get('Retry-After') || 0);
        if (retrySeconds > 0) setExtractionCooldown(retrySeconds);
        const message = retrySeconds > 0
          ? `${json.error || 'Batas penggunaan sementara tercapai.'} Jangan menekan tombol selama penghitung berjalan. Setelah selesai, coba satu kali. Jika masih ditolak, quota proyek masih penuh dan perlu menunggu window berikutnya.`
          : (json.error || 'Gagal mengekstrak data');
        store.showToast(message, 'error');
      }
    } catch (error) {
      clearInterval(interval);
      store.showToast(
        error instanceof Error
          ? `Koneksi ke layanan ekstraksi gagal: ${error.message}`
          : 'Koneksi ke layanan ekstraksi gagal. Periksa koneksi internet dan server.',
        'error',
      );
    } finally {
      store.setExtractingOCR(false);
      setTimeout(() => setOcrProgress(0), 600);
    }
  }, [ocrText, ocrModelId, store, goStep]);

  // Save to Supabase
  const handleSave = useCallback(async () => {
    store.setSaving(true);
    try {
      const formData = store.formData;
      if (!formData.nikKaryawan && !formData.nationalId) {
        store.showToast('NIK Karyawan tidak boleh kosong', 'error');
        store.setSaving(false);
        return;
      }
      const res = await fetch('/api/mcu/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData }),
      });
      const json = await res.json();
      if (json.success) {
        store.showToast(`Data MCU berhasil disimpan ke database (${json.action})`, 'success');
        setNikInput('');
        setOcrText('');
        store.resetForm();
      } else {
        store.showToast(json.error || 'Gagal menyimpan', 'error');
      }
    } catch {
      store.showToast('Gagal menghubungi server', 'error');
    } finally {
      store.setSaving(false);
    }
  }, [store]);

  // Count abnormal per section
  const sectionAbnormalCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const section of MCU_SECTIONS) {
      const fields = getFieldsBySection(section.id);
      let count = 0;
      for (const field of fields) {
        if (isAbnormal(field, store.formData[field.id] || '', store.formData.jenisKelamin)) {
          count++;
        }
      }
      counts[section.id] = count;
    }
    return counts;
  }, [store.formData]);

  // Zonasi result
  const zonasi = useMemo(() => {
    const z = store.formData.zonasi;
    return z || 'Belum Lengkap';
  }, [store.formData.zonasi]);

  const triggers = useMemo(() => {
    const t = store.formData.triggerZona;
    return t ? t.split(' | ').filter(Boolean) : [];
  }, [store.formData.triggerZona]);

  const pengendalian = store.formData.pengendalian || '';
  const missingZonasiInputs = useMemo(
    () => getMissingZonasiInputs(store.formData),
    [store.formData],
  );
  const zonasiEgfrEstimate = useMemo(() => {
    if (store.formData.egfr && store.formData.egfr.toLowerCase() !== 'n/a') return null;
    return calcEgfrCkdEpi2021(store.formData.kreatinin, store.formData.usia, store.formData.jenisKelamin);
  }, [store.formData.egfr, store.formData.kreatinin, store.formData.usia, store.formData.jenisKelamin]);

  return (
    <div className="relative review-mcu-page" style={{ overflowY: "auto", maxHeight: "100%" }}>
      <AnimatePresence mode="wait" custom={direction}>
        {/* ─── STEP 1: SEARCH ─── */}
        {store.reviewStep === 'search' && (
          <motion.div
            key="search"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 12 }}
          >
            {/* NIK Search */}
            <div
              style={{
                background: 'var(--card)',
                borderRadius: 12,
                padding: '14px 16px',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,77,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Search style={{ width: 16, height: 16, color: '#ff4d00' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.2 }}>Cari Karyawan</h2>
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Cari dengan NIK KTP, NIK Karyawan, atau nama</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <EmployeeLookupInput
                    value={nikInput}
                    onChange={setNikInput}
                    onEmployeeFound={(emp) => {
                      const mapped = mapEmployee(emp, nikInput, detectSearchBy(nikInput));
                      store.setEmployee(mapped);
                      store.setFormBatch(employeeFormData(mapped));
                      store.showToast('Data karyawan ditemukan', 'success');
                    }}
                    inputStyle={{
                      height: 40, borderRadius: 10,
                      border: '1px solid var(--border)', background: 'var(--background)',
                      padding: '0 12px', fontSize: 13, color: 'var(--foreground)',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
                <motion.div {...buttonTap} style={{ marginTop: 24 }}>
                  <button
                    onClick={handleSearch}
                    disabled={store.searchingEmployee || !nikInput.trim()}
                    style={{
                      height: 40, width: 44, borderRadius: 10, border: 'none',
                      background: 'linear-gradient(135deg, #ff4d00, #ff6b2b)',
                      color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: (!nikInput.trim() || store.searchingEmployee) ? 0.5 : 1,
                    }}
                  >
                    {store.searchingEmployee
                      ? <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" />
                      : <Search style={{ width: 18, height: 18 }} />
                    }
                  </button>
                </motion.div>
              </div>
            </div>

            {/* Loading skeleton */}
            {store.searchingEmployee && (
              <div style={{ background: 'var(--card)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} style={{ height: 36, borderRadius: 8, background: 'var(--muted)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  ))}
                </div>
              </div>
            )}

            {/* Identity Card — always visible */}
            {!store.searchingEmployee && (
              <div style={{
                background: 'var(--card)',
                borderRadius: 12,
                padding: '14px 16px',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,77,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <User style={{ width: 14, height: 14, color: '#ff4d00' }} />
                  </div>
                  <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>Identitas Karyawan</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'NIK KTP', value: store.employee?.nationalId, desc: 'Nomor Induk Kependudukan' },
                    { label: 'NIK Karyawan', value: store.employee?.nikKaryawan, desc: 'Nomor Induk Karyawan' },
                    { label: 'Nama Lengkap', value: store.employee?.nama, desc: 'Nama sesuai data karyawan' },
                    { label: 'Jenis Kelamin', value: store.employee?.gender, desc: 'Laki-laki / Perempuan' },
                    { label: 'Usia', value: store.employee?.usia ? `${store.employee.usia} tahun` : undefined, desc: 'Usia karyawan saat ini' },
                    { label: 'Jabatan', value: store.employee?.jabatan, desc: 'Jabatan / posisi kerja' },
                    { label: 'Site', value: store.employee?.site, desc: 'Lokasi penempatan' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        background: item.value ? 'var(--background)' : 'transparent',
                        borderRadius: 8,
                        padding: '6px 10px',
                        border: item.value ? 'none' : '1px dashed var(--border)',
                      }}
                    >
                      <p style={{ fontSize: 9, color: 'var(--muted-foreground)', marginBottom: 1, fontWeight: 500 }}>{item.label}</p>
                      <p style={{ fontSize: 11, fontWeight: 600, color: item.value ? 'var(--foreground)' : 'var(--fg-dim)' }}>
                        {item.value || item.desc}
                      </p>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <motion.div {...buttonTap} style={{ flex: 1 }}>
                    <button
                      onClick={() => goStep('ocr')}
                      style={{
                        width: '100%', height: 38, borderRadius: 10, border: 'none',
                        background: store.employee ? 'linear-gradient(135deg, #ff4d00, #ff6b2b)' : 'var(--muted)',
                        color: store.employee ? '#fff' : 'var(--foreground)', 
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        fontFamily: 'inherit',
                      }}
                    >
                      {store.employee ? 'Lanjut' : 'Lanjut Input Manual'}
                      <ArrowRight style={{ width: 14, height: 14 }} />
                    </button>
                  </motion.div>
                  {store.employee && (
                    <motion.div {...buttonTap}>
                      <button
                        onClick={handleRecall}
                        style={{
                          height: 38, padding: '0 14px', borderRadius: 10,
                          border: '1px solid var(--border)', background: 'transparent',
                          color: 'var(--foreground)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
                        }}
                      >
                        <RotateCcw style={{ width: 12, height: 12 }} />
                        Recall MCU
                      </button>
                    </motion.div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ─── STEP 2: OCR ─── */}
        {store.reviewStep === 'ocr' && (
          <motion.div
            key="ocr"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="space-y-6 pb-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card rounded-2xl p-5"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <ClipboardPaste className="size-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Ekstrak Data OCR</h2>
                  <p className="text-sm text-muted-foreground">Tempel teks scan MCU atau Link Google Drive (PDF)</p>
                </div>
              </div>

              <Textarea
                placeholder="Tempel teks hasil OCR atau Link Google Drive (PDF) di sini..."
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
                className="min-h-[200px] text-sm rounded-xl bg-background resize-none"
              />

              <div className="mt-3 flex flex-col gap-1.5">
                <label htmlFor="ocr-model-mode" className="text-xs font-medium text-muted-foreground">
                  Mode Ekstraksi Data
                </label>
                <select
                  id="ocr-model-mode"
                  value={ocrModelId}
                  onChange={(e) => setOcrModelId(e.target.value)}
                  disabled={store.extractingOCR || extractionCooldown > 0}
                  className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
                >
                  {GEMINI_OCR_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>{model.label}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {getGeminiOcrModel(ocrModelId)?.description}
                </p>
              </div>

              {store.extractingOCR && (
                <div className="mt-3 space-y-2">
                  <Progress value={ocrProgress} className="h-2 rounded-full" />
                  <p className="text-xs text-muted-foreground text-center">
                    {ocrProgress < 30
                      ? 'Menganalisis teks...'
                      : ocrProgress < 70
                        ? 'Mengekstrak data medis...'
                        : 'Menyusun hasil...'}
                  </p>
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <motion.div {...buttonTap} className="flex-1">
                  <Button
                    onClick={handleExtract}
                    disabled={store.extractingOCR || !ocrText.trim() || extractionCooldown > 0}
                    className="w-full h-11 rounded-xl"
                  >
                    {store.extractingOCR ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    {extractionCooldown > 0 ? `Tunggu ${extractionCooldown} detik` : 'Ekstrak Data'}
                  </Button>
                </motion.div>
                <motion.div {...buttonTap}>
                  <Button
                    variant="outline"
                    onClick={() => goStep('form')}
                    className="h-11 rounded-xl"
                  >
                    Lewati
                    <ChevronRight className="size-4" />
                  </Button>
                </motion.div>
              </div>
            </motion.div>

            <motion.div {...buttonTap}>
              <Button
                variant="ghost"
                onClick={() => goStep('search', -1)}
                className="w-full h-11 rounded-xl gap-2 text-muted-foreground"
              >
                <ArrowLeft className="size-4" />
                Kembali
              </Button>
            </motion.div>
          </motion.div>
        )}

        {/* ─── STEP 3: FORM ─── */}
        {store.reviewStep === 'form' && (
          <motion.div
            key="form"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="space-y-4 pb-4"
          >
            {/* Back button */}
            <motion.div {...buttonTap}>
              <Button
                variant="ghost"
                onClick={() => goStep('ocr', -1)}
                className="h-9 rounded-xl gap-2 text-muted-foreground px-3"
              >
                <ArrowLeft className="size-4" />
                <span className="text-sm">OCR</span>
              </Button>
            </motion.div>

            {/* Form sections as accordion */}
            <Accordion type="multiple" defaultValue={['identity', 'vital', 'hematology', 'chemistry']} className="space-y-3">
              {MCU_SECTIONS.map((section, sIdx) => {
                const fields = getFieldsBySection(section.id);
                const abnormalCount = sectionAbnormalCounts[section.id] || 0;
                return (
                  <motion.div
                    key={section.id}
                    custom={sIdx}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    className="bg-card rounded-2xl overflow-visible"
                  >
                    <AccordionItem value={section.id} className="border-none">
                      <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-accent/50 transition-colors rounded-t-2xl">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            {SECTION_ICONS[section.icon] || <FileText className="size-4" />}
                          </div>
                          <div className="text-left">
                            <span className="text-sm font-semibold">{section.label}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              ({fields.length})
                            </span>
                          </div>
                          {abnormalCount > 0 && (
                            <Badge
                              variant="destructive"
                              className="ml-auto mr-2 text-[10px] px-1.5"
                            >
                              {abnormalCount}
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 pt-0">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {fields.map((field) => (
                            <FieldRenderer
                              key={field.id}
                              field={field}
                              value={store.formData[field.id] || ''}
                              gender={store.formData.jenisKelamin}
                              age={store.formData.usia}
                              creatinine={store.formData.kreatinin}
                              onChange={(val) => store.setFieldValue(field.id, val)}
                              isSingleCol={field.type === 'textarea' || field.id === 'rekFU'}
                            />
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </motion.div>
                );
              })}
            </Accordion>

            {/* Zonasi card - sticky */}
            <div className="review-mcu-bottom-panel pt-4 pb-2">
              <ZonasiCard
                zona={zonasi}
                triggers={triggers}
                pengendalian={pengendalian}
                missingInputs={missingZonasiInputs}
                egfrEstimate={zonasiEgfrEstimate}
              />

              <motion.div {...buttonTap} className="mt-3">
                <Button
                  onClick={handleSave}
                  disabled={store.saving}
                  className="review-mcu-save-button w-full h-12 rounded-xl border-2 border-primary text-base font-semibold shadow-md transition-shadow hover:shadow-lg"
                  size="lg"
                >
                  {store.saving ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Save className="size-5" />
                  )}
                  Simpan Data
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Field Renderer Component ───
function FieldRenderer({
  field,
  value,
  gender,
  age,
  creatinine,
  onChange,
  isSingleCol,
}: {
  field: MCUFieldDef;
  value: string;
  gender: string;
  age: string;
  creatinine: string;
  onChange: (val: string) => void;
  isSingleCol: boolean;
}) {
  const abnormal = isAbnormal(field, value, gender);
  const normalRange = getNormalRangeText(field, gender);
  const selectedValues = field.multiple ? value.split(' | ').filter(Boolean) : [];
  const egfrEstimate = field.id === 'egfr' && (!value || value.toLowerCase() === 'n/a')
    ? calcEgfrCkdEpi2021(creatinine, age, gender)
    : null;
  const inputClass = isSingleCol
    ? 'sm:col-span-2'
    : '';

  return (
    <div className={inputClass}>
      <div className={`mb-1.5 ${field.id === 'rekFU' ? 'flex min-h-9 flex-col items-start gap-0' : 'flex items-center gap-1.5'}`}>
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {field.label}
          </label>
          {field.autoCalc && (
            <Zap className="size-3 text-amber-500" />
          )}
          {field.unit && (
            <span className="text-[10px] text-muted-foreground">({field.unit})</span>
          )}
        </div>
        {field.id === 'rekFU' && (
          <span className="text-[10px] leading-4 text-muted-foreground">Konsultasi dan Terapi ke :</span>
        )}
      </div>

      {field.type === 'textarea' ? (
        <Textarea
          placeholder={field.placeholder || ''}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[60px] text-sm rounded-xl bg-background"
        />
      ) : field.type === 'select' ? (
        field.multiple ? (
          <details className="relative text-sm">
            <summary className={`flex min-h-9 cursor-pointer list-none flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground ${abnormal ? 'border-red-500/60 dark:border-red-500/50' : ''}`}>
              {selectedValues.length
                ? selectedValues.map((selected) => (
                    <span key={selected} className="rounded-md bg-primary/10 px-2 py-1 text-primary">{selected}</span>
                  ))
                : 'Pilih satu atau lebih...'}
            </summary>
            <div className="absolute left-0 right-0 z-20 mt-1 max-h-52 space-y-1 overflow-y-auto rounded-lg border border-input bg-background p-2 shadow-lg">
              {field.options?.map((opt) => (
                <label key={opt} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(opt)}
                    onChange={(event) => onChange(event.target.checked
                      ? [...selectedValues, opt].join(' | ')
                      : selectedValues.filter((selected) => selected !== opt).join(' | '))}
                    className="mt-0.5 accent-primary"
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </details>
        ) : (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`iOS-select h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground ${abnormal ? 'border-red-500/60 dark:border-red-500/50' : ''}`}
          >
            <option value="">Pilih...</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )
      ) : field.type === 'date' ? (
        <Input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={
            'h-9 text-sm rounded-xl bg-background ' +
            (abnormal ? 'border-red-500/60 dark:border-red-500/50' : '')
          }
        />
      ) : (
        <Input
          type={field.type === 'number' ? 'number' : 'text'}
          step={field.type === 'number' ? 'any' : undefined}
          placeholder={field.placeholder || ''}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={
            'h-9 text-sm rounded-xl bg-background ' +
            (abnormal ? 'border-red-500/60 dark:border-red-500/50' : '')
          }
        />
      )}

      {normalRange && field.type === 'number' && (
        <p className={`text-[10px] mt-1 ${abnormal ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
          Normal: {normalRange} {field.unit || ''}
        </p>
      )}
      {egfrEstimate !== null && (
        <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-400">
          Estimasi CKD-EPI 2021: {egfrEstimate} mL/menit/1,73 m². Nilai lab tetap kosong; estimasi ini digunakan untuk zonasi.
        </p>
      )}
    </div>
  );
}

// ─── Zonasi Card Component ───
function ZonasiCard({
  zona,
  triggers,
  pengendalian,
  missingInputs,
  egfrEstimate,
}: {
  zona: string;
  triggers: string[];
  pengendalian: string;
  missingInputs: string[];
  egfrEstimate: number | null;
}) {
  const bgColor =
    zona === 'Hijau'
      ? 'bg-zona-hijau'
      : zona === 'Kuning'
        ? 'bg-zona-kuning'
        : zona === 'Merah'
          ? 'bg-zona-merah'
          : 'bg-muted';

  const textColor =
    zona === 'Hijau'
      ? 'text-white'
      : zona === 'Kuning'
        ? 'text-amber-950 dark:text-amber-100'
        : zona === 'Merah'
          ? 'text-white'
          : 'text-muted-foreground';

  const ZonaIcon =
    zona === 'Hijau'
      ? CheckCircle2
      : zona === 'Merah'
        ? AlertCircle
        : AlertCircle;

  return (
    <AnimatePresence>
      {(
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8, transition: { duration: 0.8, ease: 'easeOut' } }}
          className={`${bgColor} review-mcu-zonasi-popover rounded-2xl shadow-lg`}
        >
      <div className="flex items-center gap-2 mb-2">
        <ZonaIcon className={`size-5 ${textColor}`} />
        <span className={`text-base font-bold ${textColor}`}>
          Zona {zona}
        </span>
      </div>

      {triggers.length > 0 && (
        <div className="mb-2">
          <p className={`text-xs font-medium ${textColor} opacity-80 mb-1`}>
            Trigger:
          </p>
          <div className="max-h-24 overflow-y-auto space-y-0.5">
            {triggers.map((t, i) => (
              <p key={i} className={`text-[11px] ${textColor} opacity-90 leading-tight`}>
                • {t.replace(/ \(Merah\)| \(Kuning\)/, '')}
              </p>
            ))}
          </div>
        </div>
      )}

      {missingInputs.length > 0 && (
        <div className="mb-2">
          <p className={`text-xs font-semibold ${textColor} mb-1`}>
            Data wajib zonasi yang belum diisi:
          </p>
          <ul className={`list-inside list-disc space-y-0.5 text-[11px] ${textColor}`}>
            {missingInputs.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      )}

      {egfrEstimate !== null && missingInputs.length === 0 && (
        <p className={`mb-2 text-[11px] ${textColor}`}>
          Zonasi menggunakan eGFR estimasi CKD-EPI 2021: {egfrEstimate} mL/menit/1,73 m²
          {' '}(hasil lab eGFR tidak tersedia).
        </p>
      )}

      {pengendalian && (
        <div className="max-h-32 overflow-y-auto">
          <p className={`text-[11px] ${textColor} opacity-80 whitespace-pre-line leading-relaxed`}>
            {pengendalian}
          </p>
        </div>
      )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
