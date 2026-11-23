'use client';

// ============================================================
// Komponen bersama untuk halaman kuesioner STD-006
// ============================================================
//
// ESS dan Kesehatan Mental memakai potongan-potongan yang sama: pencarian
// karyawan dengan autofill identitas, kartu identitas yang terkunci setelah
// karyawan ditemukan, kelompok item dengan skala pilihan, dan panel hasil.
// Komponen ini dipisah supaya keduanya tidak mengulang markup yang sama.
// ============================================================

import { useEffect, useState } from 'react';

import type { QuestionnaireItem, ScaleOption } from '@/lib/questionnaire-items';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

export async function questionnaireAuthHeaders(): Promise<Record<string, string>> {
  // 1. One-Time Token kuesioner (maksimal 30 menit) di sessionStorage
  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem('bg_health_qtoken');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.token && typeof parsed.expiresAt === 'number' && parsed.expiresAt > Date.now()) {
          return { Authorization: `Bearer ${parsed.token}` };
        }
      }
    } catch {}
  }

  // 2. Fallback sesi Supabase jika tersedia
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }

  throw new Error('Sesi kuesioner Anda telah berakhir atau belum terverifikasi. Silakan masukkan NIK dan PIN Anda.');
}

/* ------------------------------------------------------------------ */
/*  Panel status                                                       */
/* ------------------------------------------------------------------ */

type Status = 'idle' | 'saving' | 'success' | 'error';

export function StatusBanner({ status, message }: { status: Status; message: string }) {
  if (status === 'idle' || !message) return null;

  const tone =
    status === 'success'
      ? 'background: rgba(0,184,148,0.12); border-color: rgba(0,184,148,0.4); color: #00806a;'
      : status === 'error'
        ? 'background: rgba(255,68,68,0.12); border-color: rgba(255,68,68,0.4); color: #c62828;'
        : 'background: rgba(255,77,0,0.10); border-color: rgba(255,77,0,0.35); color: #b34700;';

  const dark = status === 'success' ? '#00c9a7' : status === 'error' ? '#ff6b6b' : '#ff6b2c';

  return (
    <div
      role="status"
      style={{
        padding: '10px 14px',
        borderRadius: 8,
        border: '1px solid',
        borderColor: tone.split('border-color: ')[1]?.split(';')[0] ?? 'transparent',
        background: tone.split('background: ')[1]?.split(';')[0] ?? 'transparent',
        color: dark,
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      {message}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Panel identitas                                                     */
/* ------------------------------------------------------------------ */

export interface EmployeeIdentityView {
  nikKaryawan: string;
  nationalId: string;
  nama: string;
  jabatan: string;
  site: string;
  usia: string;
  jenisKelamin: string;
  tglMCU: string;
}

interface IdentityPanelProps {
  query?: string;
  onQueryChange?: (value: string) => void;
  onSearch?: () => void;
  searching: boolean;
  identity: EmployeeIdentityView | null;
  /** Baris detail tambahan, mis. lokasi dan petugas. */
  children?: React.ReactNode;
  /** Apakah akun login merupakan employee (identitas dikunci otomatis) */
  isEmployee?: boolean;
}

/**
 * Panel identitas responden kuesioner.
 * Seluruh kuesioner (ESS, SRQ-20, DASS-21, SDS-30) WAJIB diisi masing-masing
 * secara mandiri untuk atas nama akun yang sedang aktif login, sehingga
 * identitas dan data profil otomatis terkunci untuk semua role pengguna.
 */
export function IdentityPanel({
  searching,
  identity,
  children,
}: IdentityPanelProps) {
  return (
    <div className="qh-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 className="qh-card-title" style={{ margin: 0 }}>Identitas Lengkap Karyawan</h3>
        {searching && (
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Memuat data profil…</span>
        )}
      </div>

      {identity ? (
        <div className="qh-identity">
          <div className="qh-identity-row">
            <span>Nama Karyawan</span>
            <strong>{identity.nama || '—'}</strong>
          </div>
          <div className="qh-identity-row">
            <span>NIK Karyawan</span>
            <strong>{identity.nikKaryawan || '—'}</strong>
          </div>
          <div className="qh-identity-row">
            <span>NIK KTP (Nasional)</span>
            <strong>{identity.nationalId || '—'}</strong>
          </div>
          <div className="qh-identity-row">
            <span>Jabatan / Posisi</span>
            <strong>{identity.jabatan || '—'}</strong>
          </div>
          <div className="qh-identity-row">
            <span>Departemen / Unit Kerja</span>
            <strong>{identity.site || '—'}</strong>
          </div>
          <div className="qh-identity-row">
            <span>Jenis Kelamin / Usia</span>
            <strong>{identity.jenisKelamin || '—'} · {identity.usia || '—'}</strong>
          </div>
          <div className="qh-identity-row">
            <span>MCU Terakhir</span>
            <strong>{identity.tglMCU || '—'}</strong>
          </div>
        </div>
      ) : !searching ? (
        <div style={{ padding: '12px', borderRadius: 8, background: 'rgba(255, 59, 48, 0.08)', color: '#d32f2f', fontSize: 12 }}>
          Profil karyawan tidak ditemukan. Hubungi HR/Admin.
        </div>
      ) : null}

      {children && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Kelompok item                                                      */
/* ------------------------------------------------------------------ */

interface ItemGroupProps {
  title: string;
  subtitle?: string;
  description?: string;
  items: QuestionnaireItem[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  options?: ScaleOption[];
  /** Ganti label kolom pilihan, mis. "Ya / Tidak" untuk SRQ-20. */
  optionLabels?: string[];
  columns?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

/**
 * Satu blok pertanyaan. Setiap item diberi nomor urut agar assessor mudah
 * menemukan kembali pernyataan yang sedang dirujuk.
 */
export function ItemGroup({
  title,
  subtitle,
  description,
  items,
  values,
  onChange,
  options,
  optionLabels,
  columns = 3,
}: ItemGroupProps) {
  const resolvedOptions = options ?? items[0]?.options ?? [];

  return (
    <section className="qh-card">
      <div className="qh-card-head">
        <div>
          <h3 className="qh-card-title">{title}</h3>
          {subtitle && <p className="qh-card-subtitle">{subtitle}</p>}
        </div>
        <span className="qh-progress">
          {items.filter((item) => values[item.id] !== undefined && values[item.id] !== '').length} / {items.length}
        </span>
      </div>

      {description && <p className="qh-description">{description}</p>}

      <ul className="qh-items">
        {items.map((item, index) => {
          const current = values[item.id] ?? '';
          return (
            <li key={item.id} className="qh-item">
              <label className="qh-item-text" htmlFor={`${item.id}-${current}`}>
                <span className="qh-item-number">{index + 1}</span>
                <span>{item.text}</span>
              </label>
              <div className="qh-item-options">
                {resolvedOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`qh-radio${current === String(option.value) ? ' qh-radio-active' : ''}`}
                  >
                    <input
                      type="radio"
                      name={item.id}
                      id={`${item.id}-${option.value}`}
                      value={option.value}
                      checked={current === String(option.value)}
                      onChange={() => onChange(item.id, String(option.value))}
                    />
                    <span className="qh-radio-dot" aria-hidden="true" />
                    <span className="qh-radio-label">{option.label}</span>
                  </label>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export type Tone = 'good' | 'warn' | 'bad' | 'neutral';

/**
 * Memetakan kategori hasil ke warna tampilan.
 *
 * Modul questionnaire-scores sengaja tidak tahu apa pun soal warna: itu
 * urusan presentasi, dan warna di sini hanya untuk dibaca assessor.
 */
export function toneFor(category: string): Tone {
  if (category === 'tidak-lengkap' || category === 'normal') return category === 'normal' ? 'good' : 'neutral';
  if (category === 'ringan' || category === 'mild' || category === 'ringan-sedang' || category === 'perlu-tindak-lanjut') return 'warn';
  if (category === 'sedang' || category === 'moderate') return 'warn';
  return 'bad';
}

function gridTemplate(columns: number): string {
  // Skala 7 (SDS-30) butuh sel lebih rapat; skala lain tetap lega.
  const min = columns >= 7 ? 34 : columns >= 5 ? 56 : 72;
  return `repeat(${columns}, minmax(${min}px, 1fr))`;
}

/* ------------------------------------------------------------------ */
/*  Panel hasil                                                         */
/* ------------------------------------------------------------------ */

export interface ScoreLine {
  label: string;
  value: string;
  tone?: 'good' | 'warn' | 'bad' | 'neutral';
}

/* ------------------------------------------------------------------ */
/*  Tombol aksi                                                         */
/* ------------------------------------------------------------------ */

export function SubmitBar({
  disabled,
  saving,
  onSubmit,
  onReset,
  hint,
}: {
  disabled: boolean;
  saving: boolean;
  onSubmit: () => void;
  onReset: () => void;
  hint?: string;
}) {
  return (
    <div className="qh-submitbar">
      {hint && <p className="qh-hint">{hint}</p>}
      <div className="qh-submitbar-actions">
        <button type="button" className="qh-btn" onClick={onReset} disabled={saving}>
          Reset
        </button>
        <button type="button" className="qh-btn qh-btn-primary" onClick={onSubmit} disabled={disabled || saving}>
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Popup hasil                                                        */
/* ------------------------------------------------------------------ */

/**
 * Jendela hasil yang muncul tepat setelah kuesioner tersimpan.
 *
 * Hasil ditampilkan dalam dialog setelah penyimpanan berhasil, bukan sebagai
 * pratinjau saat pengisian. Dialog ini memuat skor, kesimpulan, dan efeknya
 * terhadap zona MCU untuk karyawan maupun petugas QSHE.
 *
 * Peringatan "bukan diagnosis" disertakan karena ESS, SRQ-20, DASS-21, dan
 * SDS adalah instrumen skrining. Menuduh seseorang memiliki gangguan mental
 * hanya dari skor kuesioner tidak dapat dibenarkan.
 */
export interface ResultDialogData {
  nama: string;
  tanggal: string;
  /** Baris angka hasil, mis. "Skor ESS: 17". */
  lines: ScoreLine[];
  /** Kesimpulan bahasa sehari-hari dari server. */
  kesimpulan: string;
  /** Zona MCU terbaru, atau null bila belum ada MCU. */
  zonaMCU: string | null;
  /** Berapa record MCU yang salinannya ikut diperbarui. */
  mcuUpdated: number;
}

export function ResultDialog({
  data,
  onClose,
}: {
  data: ResultDialogData | null;
  onClose: () => void;
}) {
  if (!data) return null;

  const tone: Tone = data.lines.find((line) => line.tone === 'bad')?.tone
    ?? (data.lines.find((line) => line.tone === 'warn') ? 'warn' : 'good');

  const PALET: Record<Tone, { bg: string; border: string; text: string }> = {
    good: { bg: 'rgba(0,184,148,0.10)', border: 'rgba(0,184,148,0.45)', text: '#00806a' },
    warn: { bg: 'rgba(255,140,0,0.10)', border: 'rgba(255,140,0,0.45)', text: '#a35a00' },
    bad: { bg: 'rgba(220,50,50,0.10)', border: 'rgba(220,50,50,0.45)', text: '#b3261e' },
    neutral: { bg: 'rgba(120,120,128,0.10)', border: 'rgba(120,120,128,0.4)', text: '#4a4a52' },
  };
  const warna = PALET[tone];

  return (
    <div
      className="qh-modal-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="qh-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qh-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="qh-modal-head">
          <h3 id="qh-modal-title">{data.lines.length > 0 ? 'Hasil Kuesioner' : 'Terima Kasih'}</h3>
          <button type="button" className="qh-modal-close" onClick={onClose} aria-label="Tutup">
            ×
          </button>
        </header>

        <div className="qh-modal-body">
          <p className="qh-modal-subject">
            <strong>{data.nama || '—'}</strong>
            <span>{data.tanggal}</span>
          </p>

          {data.lines.length > 0 && (
            <table className="qh-result-table">
              <tbody>
                {data.lines.map((line) => (
                  <tr key={line.label}>
                    <td>{line.label}</td>
                    <td>
                      <strong className={`qh-tone-${line.tone ?? 'neutral'}`}>{line.value}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div
            className="qh-modal-kesimpulan"
            style={{ background: warna.bg, borderColor: warna.border, color: warna.text }}
          >
            <strong>{data.lines.length > 0 ? 'Kesimpulan' : 'Pesan'}</strong>
            <p>{data.kesimpulan}</p>
          </div>

          {/* Informasi MCU hanya relevan untuk instrumen klinis per individu.
              Untuk instrumen yang menilai lingkungan kerja (SDS-30), baris ini
              tidak ditampilkan karena tidak ada nilai individual yang dibaca. */}
          {data.lines.length > 0 && (
            <dl className="qh-modal-meta">
              <div>
                <dt>Zona MCU terbaru</dt>
                <dd>{data.zonaMCU || 'Belum ada MCU yang memakai hasil ini'}</dd>
              </div>
              <div>
                <dt>MCU yang ikut diperbarui</dt>
                <dd>
                  {data.mcuUpdated} record
                  {data.mcuUpdated === 0 && ' — tidak ada MCU pada atau setelah tanggal ini'}
                </dd>
              </div>
            </dl>
          )}

          {data.lines.length > 0 && (
            <p className="qh-modal-warning">
              Kuesioner ini merupakan <strong>skrining</strong>, bukan diagnosis. Diagnosis hanya
              dapat ditegakkan setelah pemeriksaan dan konfirmasi tenaga kesehatan.
            </p>
          )}
        </div>

        <footer className="qh-modal-foot">
          <button type="button" className="qh-btn qh-btn-primary" onClick={onClose}>
            Saya mengerti
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hook lookup                                                         */
/* ------------------------------------------------------------------ */

/**
 * Pengambilan identitas responden kuesioner.
 * Seluruh role (superuser, administrator, manager, pic, employee) otomatis
 * mengambil dan mengunci data atas nama akun yang sedang aktif login.
 */
export function useEmployeeLookup(endpoint: string) {
  const { loading: authLoading } = useAuth();

  const [query, setQuery] = useState('self');
  const [identity, setIdentity] = useState<EmployeeIdentityView | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem('bg_health_qtoken');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.identity && parsed.expiresAt > Date.now()) {
            return parsed.identity;
          }
        }
      } catch {}
    }
    return null;
  });
  const [history, setHistory] = useState<any[]>([]);
  const [historyAvailable, setHistoryAvailable] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [canSeeResult, setCanSeeResult] = useState(true);

  async function search(value?: string): Promise<EmployeeIdentityView | null> {
    setSearching(true);
    setError('');
    try {
      const headers = await questionnaireAuthHeaders();
      const res = await fetch(`${endpoint}?query=self`, { headers });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Data profil akun tidak ditemukan.');
        setIdentity(null);
        setHistory([]);
        setHistoryAvailable(false);
        return null;
      }
      setIdentity(body.identity as EmployeeIdentityView);
      setHistory(Array.isArray(body.history) ? body.history : []);
      setHistoryAvailable(body.historyAvailable !== false);
      setCanSeeResult(body.canSeeResult !== false);
      setQuery(body.identity?.nikKaryawan || 'self');
      return body.identity as EmployeeIdentityView;
    } catch {
      setError('Gagal menghubungi server. Coba lagi.');
      setIdentity(null);
      setHistory([]);
      setHistoryAvailable(false);
      return null;
    } finally {
      setSearching(false);
    }
  }

  // Auto-lookup untuk semua role akun saat inisialisasi sesi login
  useEffect(() => {
    if (!authLoading && !identity && !searching) {
      void search('self');
    }
  }, [authLoading]);

  function reset() {
    // Identitas terkunci secara otomatis pada akun yang aktif login
  }

  return {
    query,
    setQuery,
    identity,
    history,
    historyAvailable,
    setHistory,
    searching,
    error,
    search,
    reset,
    canSeeResult,
    isEmployee: true,
  };
}

/** Pesan sukses atau galat yang otomatis hilang setelah beberapa detik. */
export function useSubmitStatus() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (status !== 'success') return;
    const timer = setTimeout(() => {
      setStatus('idle');
      setMessage('');
    }, 8000);
    return () => clearTimeout(timer);
  }, [status, message]);

  return {
    status,
    message,
    setStatus,
    setMessage,
    success: (text: string) => {
      setStatus('success');
      setMessage(text);
    },
    failure: (text: string) => {
      setStatus('error');
      setMessage(text);
    },
  };
}