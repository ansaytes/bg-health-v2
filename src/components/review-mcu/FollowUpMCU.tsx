'use client';

// ============================================================
// Follow Up MCU — tab di kanan Review MCU
// ============================================================
//
// Alur: cari karyawan (sama seperti Review MCU) → ambil MCU terakhir dari
// database → tampilkan HANYA field yang nilainya tidak normal → isi hasil
// pemeriksaan ulang → simpan ke tabel mcu_followups.
//
// Zonasi dan Framingham dihitung ulang dari "dataset efektif" (MCU terakhir
// ditimpa hasil pemeriksaan ulang) — live, tanpa mengubah data historis.

import { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Loader2, User, ArrowLeft, Save, RotateCcw, History,
  TrendingDown, TrendingUp, Minus, Trash2, FileText,
} from 'lucide-react';
import EmployeeLookupInput, { type EmployeeData as LookupEmployeeData } from '@/components/administrator/EmployeeLookupInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useMCUStore, type EmployeeData as MCUEmployeeData } from '@/lib/store';
import { getEmployeeLookupAccessToken } from '@/lib/employee-lookup-client';
import { MCU_FIELDS, getFieldsBySection, type MCUFieldDef } from '@/lib/mcu-fields';
import { buildDatasetEfektif, type MCUFollowUp } from '@/lib/mcu-followup';
import { supabase } from '@/lib/supabase';

type SearchBy = 'nik' | 'national_id' | 'nama';

// Section klinis yang relevan untuk follow up (bukan identitas/assessment/kalkulasi).
const FU_SECTIONS = [
  'vital', 'hematology', 'chemistry', 'serology', 'drug', 'imaging',
  'anamnesis', 'spirometry', 'audiometry', 'neuro', 'physical', 'vision', 'fitness',
] as const;

const SECTION_LABEL: Record<string, string> = {
  vital: 'Tanda Vital', hematology: 'Hematologi', chemistry: 'Kimia Darah',
  serology: 'Serologi', drug: 'NAPZA', imaging: 'Radiologi & USG',
  anamnesis: 'Riwayat & Skrining', spirometry: 'Spirometri', audiometry: 'Audiometri',
  neuro: 'Neurologi', physical: 'Fisik', vision: 'Mata', fitness: 'Kebugaran',
};

/** Nilai-nilai yang dianggap normal untuk field non-numerik. */
const NORMAL_WORDS = /^(normal|negatif|non[- ]?reaktif|nonreaktif|dbn|n\/a|tidak|tidak ada|belum|not performed)$/i;

function isAbnormalRecord(field: MCUFieldDef, rawValue: unknown, gender?: string): boolean {
  if (rawValue == null) return false;
  const value = String(rawValue).trim();
  if (!value || value.toUpperCase() === 'N/A' || value.toUpperCase() === 'DBN') return false;

  if (field.type === 'number') {
    const num = parseFloat(value.replace(',', '.'));
    if (Number.isNaN(num)) return false;
    const isMale = gender?.toLowerCase().includes('laki');
    const isFemale = gender?.toLowerCase().includes('perem');
    if (isMale && field.lowMale !== undefined && field.highMale !== undefined) {
      return num < field.lowMale || num > field.highMale;
    }
    if (isFemale && field.lowFemale !== undefined && field.highFemale !== undefined) {
      return num < field.lowFemale || num > field.highFemale;
    }
    if (field.low !== undefined && field.high !== undefined) return num < field.low || num > field.high;
    if (field.high !== undefined && field.low === undefined) return num > field.high;
    if (field.low !== undefined && field.high === undefined) return num < field.low;
    return false;
  }

  // Non-numerik: abnormal jika nilainya bukan kata yang dianggap normal.
  if (field.type === 'select' || field.type === 'textarea' || field.type === 'text') {
    return !NORMAL_WORDS.test(value) && !/^(fit|fit to work)$/i.test(value);
  }
  return false;
}

function normalRangeText(field: MCUFieldDef, gender?: string): string {
  if (gender?.toLowerCase().includes('laki') && field.normalMale) return field.normalMale;
  if (gender?.toLowerCase().includes('perem') && field.normalFemale) return field.normalFemale;
  return field.normalRange || '';
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
    gender: emp.gender || '',
    jabatan: emp.job_position || '',
    site: emp.site_name || '',
    usia: emp.age || '',
  };
}

const KESIMPULAN_OPTIONS = [
  'Normal / Teratasi',
  'Membaik / Terkontrol',
  'Belum Terkontrol',
  'Perlu Rujukan Lanjutan',
  'Fit With Restriction',
  'Currently Unfit',
];

interface FuRecord {
  id: string;
  /** formData bergaya camelCase hasil /api/mcu/records */
  data: Record<string, string>;
  nama: string;
  nikKaryawan: string;
  tglMcu: string;
}

export default function FollowUpMCU() {
  const store = useMCUStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [record, setRecord] = useState<FuRecord | null>(null);
  const [followups, setFollowups] = useState<MCUFollowUp[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [tglFu, setTglFu] = useState(() => new Date().toISOString().slice(0, 10));
  const [lokasiFu, setLokasiFu] = useState('');
  const [kesimpulan, setKesimpulan] = useState(KESIMPULAN_OPTIONS[1]);
  const [catatan, setCatatan] = useState('');
  const [rekomendasi, setRekomendasi] = useState('');
  const [linkDokumen, setLinkDokumen] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ── Cari karyawan ─────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    const searchBy = detectSearchBy(searchQuery);
    setSearching(true);
    try {
      const accessToken = await getEmployeeLookupAccessToken();
      const res = await fetch('/api/employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ query: searchQuery.trim(), searchBy }),
      });
      const json = await res.json();
      if (!json.success || !json.data) {
        store.showToast(json.error || 'Karyawan tidak ditemukan', 'error');
        return;
      }
      const emp = Array.isArray(json.data) ? json.data[0] : json.data;
      const mapped = mapEmployee(emp, searchQuery, searchBy);

      // Ambil MCU terakhir karyawan tersebut.
      const { data: { session } } = await supabase.auth.getSession();
      const params = new URLSearchParams();
      if (mapped.nikKaryawan) params.set('nik', mapped.nikKaryawan);
      else if (mapped.nationalId) params.set('national_id', mapped.nationalId);
      const recRes = await fetch(`/api/mcu/records?${params.toString()}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const recJson = await recRes.json();
      if (!recRes.ok) throw new Error(recJson.error || 'Gagal mengambil data MCU');
      if (!recJson.record) {
        store.showToast('Belum ada data MCU tersimpan untuk karyawan ini', 'info');
        return;
      }

      const data = recJson.record as Record<string, string>;
      setRecord({
        id: data.id || '',
        data,
        nama: data.nama || mapped.nama,
        nikKaryawan: data.nikKaryawan || mapped.nikKaryawan,
        tglMcu: data.tglMCU || '',
      });
      setValues({});
      setKesimpulan(KESIMPULAN_OPTIONS[1]);
      setCatatan('');
      setRekomendasi('');
      setLinkDokumen('');
      setLokasiFu('');
      void loadHistory(data.id || '');
      store.showToast('Data MCU terakhir ditemukan', 'success');
    } catch (error) {
      store.showToast(error instanceof Error ? error.message : 'Gagal menghubungi server', 'error');
    } finally {
      setSearching(false);
    }
  }, [searchQuery, store]);

  // ── Riwayat follow up ─────────────────────────────────────
  const loadHistory = useCallback(async (recordId: string) => {
    if (!recordId) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/mcu-followup?mcu_record_id=${encodeURIComponent(recordId)}`);
      const json = await res.json();
      if (res.ok) setFollowups(Array.isArray(json.followups) ? json.followups : []);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // ── Field yang tidak normal pada MCU terakhir ─────────────
  const abnormalBySection = useMemo(() => {
    if (!record) return [];
    const gender = record.data.jenisKelamin;
    return FU_SECTIONS
      .map((sectionId) => ({
        sectionId,
        label: SECTION_LABEL[sectionId],
        fields: getFieldsBySection(sectionId).filter(
          (field) => isAbnormalRecord(field, record.data[field.id], gender),
        ),
      }))
      .filter((group) => group.fields.length > 0);
  }, [record]);

  const abnormalCount = abnormalBySection.reduce((sum, g) => sum + g.fields.length, 0);

  // ── Dataset efektif (zonasi live) ─────────────────────────
  const dataset = useMemo(() => {
    if (!record) return null;
    const baseline = { ...record.data };
    const fused: MCUFollowUp[] = followups.map((f, i) => ({
      ...f,
      kunjungan_ke: f.kunjungan_ke ?? i + 1,
      hasil_parameters: f.hasil_parameters || {},
    }));
    // Gabungkan juga nilai yang sedang diketik di form (belum disimpan).
    const draft: MCUFollowUp = {
      mcu_record_id: record.id,
      nik_karyawan: record.nikKaryawan,
      kunjungan_ke: followups.length + 1,
      hasil_parameters: Object.fromEntries(
        Object.entries(values).filter(([, v]) => v !== '' && v != null),
      ),
    };
    try {
      return buildDatasetEfektif(baseline, [...fused, draft]);
    } catch {
      return null;
    }
  }, [record, followups, values]);

  // ── Simpan ────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!record) return;
    const filled = Object.entries(values).filter(([, v]) => v !== '' && v != null);
    if (filled.length === 0 && !catatan.trim()) {
      store.showToast('Isi minimal satu hasil pemeriksaan ulang atau catatan.', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/mcu-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mcu_record_id: record.id,
          nik_karyawan: record.nikKaryawan,
          kunjungan_ke: followups.length + 1,
          tgl_fu: tglFu,
          lokasi_fu: lokasiFu || null,
          hasil_parameters: Object.fromEntries(filled),
          kesimpulan,
          catatan: catatan || null,
          rekomendasi_berikutnya: rekomendasi || null,
          link_dokumen: linkDokumen || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan follow up');
      store.showToast('Hasil follow up berhasil disimpan', 'success');
      setValues({});
      setCatatan('');
      setRekomendasi('');
      setLinkDokumen('');
      await loadHistory(record.id);
    } catch (error) {
      store.showToast(error instanceof Error ? error.message : 'Gagal menyimpan', 'error');
    } finally {
      setSaving(false);
    }
  }, [record, values, followups.length, tglFu, lokasiFu, kesimpulan, catatan, rekomendasi, linkDokumen, store, loadHistory]);

  const handleDelete = useCallback(async (id?: string) => {
    if (!id || !confirm('Hapus catatan kunjungan follow up ini?')) return;
    try {
      const res = await fetch(`/api/mcu-followup?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok && record) await loadHistory(record.id);
    } catch {
      store.showToast('Gagal menghapus', 'error');
    }
  }, [record, loadHistory, store]);

  const resetAll = useCallback(() => {
    setRecord(null);
    setFollowups([]);
    setValues({});
    setSearchQuery('');
  }, []);

  return (
    <div className="relative review-mcu-page" style={{ overflowY: 'auto', maxHeight: '100%' }}>
      <AnimatePresence mode="wait">
        {record === null ? (
          <motion.div
            key="fu-search"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 12 }}
          >
            <div style={{
              background: 'var(--card)', borderRadius: 12, padding: '14px 16px',
              border: '1px solid var(--border)', boxShadow: 'var(--shadow)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,77,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Search style={{ width: 16, height: 16, color: '#ff4d00' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.2 }}>Follow Up MCU</h2>
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Cari karyawan untuk memuat MCU terakhir dan parameter yang perlu ditindaklanjuti</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <EmployeeLookupInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onEmployeeFound={() => { /* pencarian MCU dilakukan di handleSearch */ }}
                    inputStyle={{
                      height: 40, borderRadius: 10, border: '1px solid var(--border)',
                      background: 'var(--background)', padding: '0 12px', fontSize: 13,
                      color: 'var(--foreground)', fontFamily: 'inherit',
                    }}
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={searching || !searchQuery.trim()}
                  style={{
                    height: 40, width: 44, borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg, #ff4d00, #ff6b2b)',
                    color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: (!searchQuery.trim() || searching) ? 0.5 : 1,
                  }}
                >
                  {searching ? <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" /> : <Search style={{ width: 18, height: 18 }} />}
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="fu-form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="space-y-4 pb-4"
          >
            {/* Identitas + perbandingan zonasi */}
            <div style={{
              background: 'var(--card)', borderRadius: 12, padding: '14px 16px',
              border: '1px solid var(--border)', boxShadow: 'var(--shadow)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,77,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <User style={{ width: 16, height: 16, color: '#ff4d00' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>{record.nama}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                      NIK {record.nikKaryawan} · MCU {record.tglMcu || '—'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {dataset && (
                    <>
                      <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600 }}>
                        Zona MCU: {dataset.baselineZonasi.zona}
                      </span>
                      <span style={{ color: 'var(--muted-foreground)' }}>→</span>
                      <span style={{
                        fontSize: 11, padding: '4px 10px', borderRadius: 999, fontWeight: 700,
                        background: dataset.effectiveZonasi.zona === 'Merah' ? 'rgba(255,45,45,0.12)'
                          : dataset.effectiveZonasi.zona === 'Kuning' ? 'rgba(255,212,0,0.18)'
                          : dataset.effectiveZonasi.zona === 'Hijau' ? 'rgba(0,184,148,0.12)'
                          : 'var(--muted)',
                        color: dataset.effectiveZonasi.zona === 'Merah' ? '#FF2D2D'
                          : dataset.effectiveZonasi.zona === 'Kuning' ? '#9a6b00'
                          : dataset.effectiveZonasi.zona === 'Hijau' ? '#00895f'
                          : 'var(--muted-foreground)',
                      }}>
                        Zona Efektif: {dataset.effectiveZonasi.zona}
                      </span>
                      {dataset.perbaikanZonasi ? (
                        <span style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, color: '#00895f', fontWeight: 600 }}>
                          <TrendingDown size={13} /> Membaik
                        </span>
                      ) : dataset.effectiveZonasi.zona === dataset.baselineZonasi.zona ? (
                        <span style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--muted-foreground)', fontWeight: 600 }}>
                          <Minus size={13} /> Stabil
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, color: '#FF2D2D', fontWeight: 600 }}>
                          <TrendingUp size={13} /> Perlu perhatian
                        </span>
                      )}
                    </>
                  )}
                  <button
                    onClick={resetAll}
                    style={{
                      height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'transparent', color: 'var(--foreground)', fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <RotateCcw size={12} /> Ganti Karyawan
                  </button>
                </div>
              </div>
            </div>

            {/* Form parameter tidak normal */}
            <div style={{
              background: 'var(--card)', borderRadius: 12, padding: '14px 16px',
              border: '1px solid var(--border)', boxShadow: 'var(--shadow)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,45,45,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText style={{ width: 14, height: 14, color: '#FF2D2D' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>Parameter Tidak Normal ({abnormalCount})</h3>
                  <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)' }}>Isi hasil pemeriksaan ulang. Kosongkan bila tidak diperiksa.</p>
                </div>
              </div>

              {abnormalCount === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
                  Semua parameter pada MCU terakhir berada dalam rentang normal. Isi catatan bila ada temuan baru.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {abnormalBySection.map((group) => (
                    <div key={group.sectionId}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: 8 }}>
                        {group.label}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                        {group.fields.map((field) => (
                          <FuField
                            key={field.id}
                            field={field}
                            baseline={String(record.data[field.id] ?? '')}
                            gender={record.data.jenisKelamin}
                            value={values[field.id] ?? ''}
                            onChange={(val) => setValues((prev) => ({ ...prev, [field.id]: val }))}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Metadata kunjungan + kesimpulan */}
            <div style={{
              background: 'var(--card)', borderRadius: 12, padding: '14px 16px',
              border: '1px solid var(--border)', boxShadow: 'var(--shadow)',
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10,
            }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted-foreground)' }}>Tanggal Follow Up</span>
                <Input type="date" value={tglFu} onChange={(e) => setTglFu(e.target.value)} className="h-9 text-sm rounded-lg bg-background" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted-foreground)' }}>Lokasi Pemeriksaan</span>
                <Input value={lokasiFu} onChange={(e) => setLokasiFu(e.target.value)} placeholder="Klinik site / RS rujukan" className="h-9 text-sm rounded-lg bg-background" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted-foreground)' }}>Kesimpulan</span>
                <select
                  value={kesimpulan}
                  onChange={(e) => setKesimpulan(e.target.value)}
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                >
                  {KESIMPULAN_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted-foreground)' }}>Link Bukti / Surat Kontrol</span>
                <Input value={linkDokumen} onChange={(e) => setLinkDokumen(e.target.value)} placeholder="https://..." className="h-9 text-sm rounded-lg bg-background" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted-foreground)' }}>Catatan Klinis</span>
                <Textarea rows={2} value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Perkembangan medis, respons terapi..." className="text-sm rounded-lg bg-background" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted-foreground)' }}>Rekomendasi Berikutnya</span>
                <Textarea rows={2} value={rekomendasi} onChange={(e) => setRekomendasi(e.target.value)} placeholder="Jadwal kontrol ulang, kepatuhan obat..." className="text-sm rounded-lg bg-background" />
              </label>
            </div>

            {/* Riwayat kunjungan */}
            <div style={{
              background: 'var(--card)', borderRadius: 12, padding: '14px 16px',
              border: '1px solid var(--border)', boxShadow: 'var(--shadow)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <History style={{ width: 14, height: 14, color: '#ff4d00' }} />
                <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>Riwayat Kunjungan ({followups.length})</h3>
              </div>
              {loadingHistory ? (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>Memuat riwayat…</div>
              ) : followups.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>Belum ada kunjungan follow up.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {followups.map((fu, i) => (
                    <div key={fu.id || i} style={{
                      padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--background)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,77,0,0.1)', color: '#ff4d00' }}>
                            Kunjungan {fu.kunjungan_ke}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--foreground)' }}>{fu.tgl_fu || '—'}</span>
                          {fu.lokasi_fu && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>· {fu.lokasi_fu}</span>}
                          {fu.kesimpulan && (
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'var(--muted)', color: 'var(--foreground)', fontWeight: 600 }}>
                              {fu.kesimpulan}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(fu.id)}
                          title="Hapus kunjungan"
                          style={{ background: 'none', border: 'none', color: '#FF2D2D', cursor: 'pointer', padding: 4, display: 'flex' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      {fu.hasil_parameters && Object.keys(fu.hasil_parameters).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                          {Object.entries(fu.hasil_parameters).map(([key, val]) => {
                            const def = MCU_FIELDS.find((f) => f.id === key);
                            return (
                              <span key={key} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'var(--muted)', color: 'var(--foreground)' }}>
                                {def?.label || key}: <b>{String(val)}</b> {def?.unit || ''}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {fu.catatan && <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 6 }}><b>Catatan:</b> {fu.catatan}</p>}
                      {fu.rekomendasi_berikutnya && <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}><b>Rekomendasi:</b> {fu.rekomendasi_berikutnya}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Simpan */}
            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 h-12 rounded-xl border-2 border-primary text-base font-semibold"
                size="lg"
              >
                {saving ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
                Simpan Hasil Follow Up
              </Button>
              <Button
                variant="ghost"
                onClick={() => setValues({})}
                className="h-12 rounded-xl"
              >
                <ArrowLeft className="size-4" /> Reset Nilai
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Field tunggal pada form follow up ─────────────────────
function FuField({
  field,
  baseline,
  gender,
  value,
  onChange,
}: {
  field: MCUFieldDef;
  baseline: string;
  gender?: string;
  value: string;
  onChange: (val: string) => void;
}) {
  const range = normalRangeText(field, gender);
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--background)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)' }}>
          {field.label}
        </span>
        {baseline && (
          <span style={{ fontSize: 10, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>
            MCU: <b style={{ color: '#FF2D2D' }}>{baseline}</b> {field.unit || ''}
          </span>
        )}
      </div>

      {field.type === 'select' && field.options ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
        >
          <option value="">Pilih hasil baru…</option>
          {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : field.type === 'textarea' ? (
        <Textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} className="text-sm rounded-lg bg-background" />
      ) : (
        <Input
          type={field.type === 'number' ? 'number' : 'text'}
          step={field.type === 'number' ? 'any' : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nilai baru"
          className="h-9 text-sm rounded-lg bg-background"
        />
      )}

      {range && (
        <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 3 }}>
          Normal: {range} {field.unit || ''}
        </p>
      )}
    </div>
  );
}
