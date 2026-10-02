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
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  searching: boolean;
  identity: EmployeeIdentityView | null;
  /** Baris detail tambahan, mis. lokasi dan petugas. */
  children?: React.ReactNode;
}

/**
 * Kolom pencarian karyawan. Setelah karyawan ditemukan, identitasnya
 * ditampilkan sebagai kartu baca-saja: nama, NIK, jabatan, dan unit kerja
 * berasal dari data MCU dan tidak boleh diketik ulang, supaya tidak mungkin
 * salah simpan ke karyawan yang lain.
 *
 * NIK KTP ditampilkan kembali meskipun tidak menjadi kata kunci yang
 * mengandungnya, karena orang yang mencari dengan NIK Karyawan biasanya ingin
 * memastikan NIK KTP-nya cocok — itulah yang mereka ketik pertama kali.
 */
export function IdentityPanel({
  query,
  onQueryChange,
  onSearch,
  searching,
  identity,
  children,
}: IdentityPanelProps) {
  return (
    <div className="qh-card">
      <h3 className="qh-card-title">Identitas Karyawan</h3>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 320px' }}>
          <label className="qh-label" htmlFor="qh-identity-search">
            NIK Karyawan atau NIK KTP
          </label>
          <input
            id="qh-identity-search"
            className="qh-input"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearch();
            }}
            placeholder="NIK KTP"
          />
          <p className="qh-hint">
            Bisa diisi NIK KTP, NIK Karyawan, atau sebagian nama. Identitas lain terisi otomatis.
          </p>
        </div>
        <button type="button" className="qh-btn qh-btn-primary" onClick={onSearch} disabled={searching}>
          {searching ? 'Mencari…' : 'Cari'}
        </button>
      </div>

      {identity && (
        <div className="qh-identity">
          <div className="qh-identity-row">
            <span>Nama</span>
            <strong>{identity.nama || '—'}</strong>
          </div>
          <div className="qh-identity-row">
            <span>NIK KTP</span>
            <strong>{identity.nationalId || '—'}</strong>
          </div>
          <div className="qh-identity-row">
            <span>NIK Karyawan</span>
            <strong>{identity.nikKaryawan || '—'}</strong>
          </div>
          <div className="qh-identity-row">
            <span>Jabatan</span>
            <strong>{identity.jabatan || '—'}</strong>
          </div>
          <div className="qh-identity-row">
            <span>Unit Kerja</span>
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
      )}

      {children}
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
  columns?: 1 | 2 | 3 | 4 | 5;
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

      <div className="qh-options-header" style={{ gridTemplateColumns: `minmax(0,1fr) ${gridTemplate(columns)}` }}>
        <span>Pernyataan</span>
        {(optionLabels ?? resolvedOptions.map((o) => o.label)).map((label, i) => (
          <span key={`${title}-opt-${i}`} className="qh-options-header-cell">
            {label}
          </span>
        ))}
      </div>

      <ul className="qh-items">
        {items.map((item, index) => {
          const current = values[item.id] ?? '';
          return (
            <li key={item.id} className="qh-item" style={{ gridTemplateColumns: `minmax(0,1fr) ${gridTemplate(columns)}` }}>
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
  return `repeat(${columns}, minmax(72px, 1fr))`;
}

/* ------------------------------------------------------------------ */
/*  Panel hasil                                                         */
/* ------------------------------------------------------------------ */

export interface ScoreLine {
  label: string;
  value: string;
  tone?: 'good' | 'warn' | 'bad' | 'neutral';
}

export function ResultPanel({
  title,
  lines,
  zonasi,
  footer,
}: {
  title: string;
  lines: ScoreLine[];
  zonasi?: string | null;
  footer?: string;
}) {
  return (
    <div className="qh-card">
      <h3 className="qh-card-title">{title}</h3>
      <table className="qh-result-table">
        <tbody>
          {lines.map((line) => (
            <tr key={line.label}>
              <td>{line.label}</td>
              <td>
                <strong className={`qh-tone-${line.tone ?? 'neutral'}`}>{line.value}</strong>
              </td>
            </tr>
          ))}
          {zonasi !== undefined && (
            <tr>
              <td>Zona MCU terbaru</td>
              <td>
                <strong>{zonasi || 'Belum dihitung'}</strong>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {footer && <p className="qh-description">{footer}</p>}
    </div>
  );
}

/**
 * Tabel riwayat hasil kuesioner untuk satu karyawan.
 *
 * Ini yang menjawab pertanyaan "bagaimana kita melihat riwayatnya?". Satu baris
 * per tanggal pengukuran, jadi kuesioner yang diisi setiap 3 atau 6 bulan
 * semuanya tersimpan dan dapat dibandingkan antar waktu. Baris yang dipakai
 * MCU tertentu ditandai supaya assessor tahu skor mana yang mengunci zona.
 */
export interface HistoryRow {
  tanggal: string;
  ringkasan: string;
  detail?: string | null;
  dipakaiMCU?: boolean;
}

export function HistoryTable({ rows, empty }: { rows: HistoryRow[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="qh-description">{empty}</p>;
  }
  return (
    <div className="qh-history">
      <table className="qh-result-table">
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Hasil</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.tanggal} className={row.dipakaiMCU ? 'qh-history-active' : undefined}>
              <td>
                {row.tanggal}
                {row.dipakaiMCU && <span className="qh-tag">dipakai MCU</span>}
              </td>
              <td>
                <strong>{row.ringkasan}</strong>
                {row.detail && <div className="qh-history-detail">{row.detail}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
  hint: string;
}) {
  return (
    <div className="qh-submitbar">
      <p className="qh-hint">{hint}</p>
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
 * Kuesioner ini diisi karyawan sendiri tanpa login, jadi hasil dan
 * kesimpulannya harus langsung terlihat di layar — bukan berupa pesan kecil
 * yang hilang sendiri di bagian atas formulir. Assessor pun memakai halaman
 * yang sama, sehingga isi jendela ini cukup untuk keduanya: angka skornya,
 * kesimpulan bahasa sehari-hari, dan efeknya terhadap zona MCU.
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
          <h3 id="qh-modal-title">Hasil Kuesioner</h3>
          <button type="button" className="qh-modal-close" onClick={onClose} aria-label="Tutup">
            ×
          </button>
        </header>

        <div className="qh-modal-body">
          <p className="qh-modal-subject">
            <strong>{data.nama || '—'}</strong>
            <span>{data.tanggal}</span>
          </p>

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

          <div
            className="qh-modal-kesimpulan"
            style={{ background: warna.bg, borderColor: warna.border, color: warna.text }}
          >
            <strong>Kesimpulan</strong>
            <p>{data.kesimpulan}</p>
          </div>

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

          <p className="qh-modal-warning">
            Kuesioner ini merupakan <strong>skrining</strong>, bukan diagnosis. Diagnosis hanya
            dapat ditegakkan setelah pemeriksaan dan konfirmasi tenaga kesehatan.
          </p>
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
 * Pencarian karyawan untuk halaman kuesioner. Mengembalikan identitas
 * yang sudah terisi otomatis, atau null bila pencarian gagal.
 */
export function useEmployeeLookup(endpoint: string) {
  const [query, setQuery] = useState('');
  const [identity, setIdentity] = useState<EmployeeIdentityView | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  async function search(value?: string): Promise<EmployeeIdentityView | null> {
    const term = (value ?? query).trim();
    if (!term) {
      setError('Isi NIK KTP, NIK Karyawan, atau nama terlebih dahulu.');
      return null;
    }

    setSearching(true);
    setError('');
    try {
      const res = await fetch(`${endpoint}?query=${encodeURIComponent(term)}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Karyawan tidak ditemukan.');
        setIdentity(null);
        setHistory([]);
        return null;
      }
      setIdentity(body.identity as EmployeeIdentityView);
      setHistory(Array.isArray(body.history) ? body.history : []);
      setQuery(term);
      return body.identity as EmployeeIdentityView;
    } catch {
      setError('Gagal menghubungi server. Coba lagi.');
      setIdentity(null);
      setHistory([]);
      return null;
    } finally {
      setSearching(false);
    }
  }

  function reset() {
    setQuery('');
    setIdentity(null);
    setHistory([]);
    setError('');
  }

  return { query, setQuery, identity, history, setHistory, searching, error, search, reset };
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