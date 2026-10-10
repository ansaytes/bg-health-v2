'use client';
// Komponen kecil bersama untuk modul Hearing Conservation & Ergonomi. Memakai kelas CSS template yang sudah ada
// (admin-input, admin-label, admin-form-card, admin-section-*, admin-form-btn-*).
import type { CSSProperties, ReactNode } from 'react';
import { JOBSITES } from '@/lib/lagging-data';

export const SITES = JOBSITES.filter((s) => s !== 'All Site');

export const inputStyle: CSSProperties = {
  width: '100%', height: 38, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--background)',
  padding: '0 12px', fontSize: 13, color: 'var(--foreground)', outline: 'none', fontFamily: 'inherit',
};
export const smallInput: CSSProperties = { ...inputStyle, height: 32, fontSize: 12, padding: '0 8px' };

/** Primary action button — fixed height, no text overflow, full-width friendly */
export const btnPrimaryStyle: CSSProperties = {
  height: 44,
  minHeight: 44,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  padding: '0 20px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 8,
  width: '100%',
};

export function Field({ label, hint, children, full }: { label: ReactNode; hint?: string; children: ReactNode; full?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: full ? '1 / -1' : undefined }}>
      <label className="admin-label" style={{ marginBottom: 0 }}>
        {label}
        {hint && <span style={{ color: 'var(--muted-foreground)', fontWeight: 'normal', fontSize: 11 }}> {hint}</span>}
      </label>
      {children}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="admin-form-card" style={{ marginBottom: 14 }}>
      <div className="admin-section-header"><h3 className="admin-section-title">{title}</h3></div>
      {children}
    </div>
  );
}

export const grid2: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };
export const grid3: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 };

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: string }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
      {tabs.map((t) => (
        <button key={t.key} type="button" onClick={() => onChange(t.key)}
          style={{
            padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: '1px solid var(--border)',
            background: value === t.key ? 'var(--brand-primary, #ff4d00)' : 'var(--background)',
            color: value === t.key ? '#fff' : 'var(--foreground)',
          }}>{t.label}</button>
      ))}
    </div>
  );
}

export function Chip({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
      background: `${color}22`, color, border: `1px solid ${color}55`, whiteSpace: 'nowrap' }}>{text}</span>
  );
}

export function Notice({ kind, children }: { kind: 'ok' | 'err' | 'warn'; children: ReactNode }) {
  const c = kind === 'ok' ? '#00B894' : kind === 'warn' ? '#d97706' : '#E63946';
  return (
    <div style={{ background: `${c}18`, border: `1px solid ${c}`, color: c, borderRadius: 8, padding: '8px 12px',
      fontSize: 12, fontWeight: 600, marginBottom: 12 }}>{children}</div>
  );
}

export const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12 };
export const thStyle: CSSProperties = { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)',
  color: 'var(--muted-foreground)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' };
export const tdStyle: CSSProperties = { padding: '6px 8px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' };

export const fmtDate = (d?: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

export function Stat({ label, value, color, sub }: { label: string; value: ReactNode; color?: string; sub?: string }) {
  return (
    <div className="card" style={{ padding: '10px 12px', gap: 2 }}>
      <span style={{ fontSize: 10, color: 'var(--muted-foreground)', textTransform: 'uppercase', fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 24, fontWeight: 800, color: color || 'var(--foreground)', lineHeight: 1.1 }}>{value}</span>
      {sub && <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{sub}</span>}
    </div>
  );
}

export function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, marginBottom: 4 }}>
      <span style={{ width: 110, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, background: 'var(--muted)', borderRadius: 4, height: 14, overflow: 'hidden' }}>
        <div style={{ width: `${max ? (value / max) * 100 : 0}%`, background: color, height: '100%', minWidth: value ? 2 : 0 }} />
      </div>
      <b style={{ width: 28, textAlign: 'right' }}>{value}</b>
    </div>
  );
}

/**
 * ScoreOptionCard — pilihan skor bergaya "soal bergambar".
 * Dipakai di form RULA / ROSA / WERA agar mirip worksheet resmi.
 */
export function ScoreOptionCard({
  score,
  label,
  selected,
  onSelect,
}: {
  score: number;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        textAlign: 'left',
        padding: '10px 12px',
        borderRadius: 10,
        border: selected ? '2px solid var(--brand-primary, #ff4d00)' : '1px solid var(--border)',
        background: selected ? 'rgba(255,77,0,0.08)' : 'var(--background)',
        cursor: 'pointer',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        transition: 'border-color 0.15s, background 0.15s',
        width: '100%',
        fontFamily: 'inherit',
      }}
    >
      <span style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: 13,
        background: selected ? 'var(--brand-primary, #ff4d00)' : 'var(--muted)',
        color: selected ? '#fff' : 'var(--foreground)',
      }}>
        {score}
      </span>
      <span style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--foreground)', paddingTop: 4 }}>
        {label}
      </span>
    </button>
  );
}
