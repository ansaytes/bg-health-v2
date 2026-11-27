'use client';
// Komponen kecil bersama untuk modul Hearing Conservation & Ergonomi. Memakai kelas CSS template yang sudah ada
// (admin-input, admin-label, admin-form-card, admin-section-*, admin-form-btn-*).
import type { CSSProperties, ReactNode } from 'react';
import { JOBSITES } from '@/lib/lagging-data';

export const SITES = JOBSITES.filter((s) => s !== 'All Site');

export const inputStyle: CSSProperties = {
  width: '100%', height: 32, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--background)',
  padding: '0 10px', fontSize: 11.5, color: 'var(--foreground)', outline: 'none', fontFamily: 'inherit',
};
export const smallInput: CSSProperties = { ...inputStyle, height: 28, fontSize: 10.5, padding: '0 7px' };

export function Field({ label, hint, children, full, style }: { label: ReactNode; hint?: string; children: ReactNode; full?: boolean; style?: CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, gridColumn: full ? '1 / -1' : undefined, width: '100%', ...style }}>
      <label className="admin-label" style={{ marginBottom: 0, minHeight: 16, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 10.5 }}>
        <span>{label}</span>
        {hint && <span style={{ color: 'var(--muted-foreground)', fontWeight: 'normal', fontSize: 10, flexShrink: 0 }}> {hint}</span>}
      </label>
      {children}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="admin-form-card" style={{ marginBottom: 10 }}>
      <div className="admin-section-header" style={{ marginBottom: 8 }}><h3 className="admin-section-title">{title}</h3></div>
      {children}
    </div>
  );
}

export const grid2: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 10, alignItems: 'end', width: '100%', maxWidth: '100%' };
export const grid3: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 10, alignItems: 'end', width: '100%', maxWidth: '100%' };
export const grid4: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: 10, alignItems: 'end', width: '100%', maxWidth: '100%' };

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: string }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div style={{ display: 'flex', marginBottom: 12, overflowX: 'auto', scrollbarWidth: 'none' }}>
      <div className="centered-tabs-track">
        {tabs.map((t) => {
          const isActive = value === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(t.key)}
              className={`centered-tab${isActive ? ' is-active' : ''}`}
              style={{ height: 26, padding: '0 12px', fontSize: 11, minWidth: 90 }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Chip({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
      background: `${color}22`, color, border: `1px solid ${color}55`, whiteSpace: 'nowrap' }}>{text}</span>
  );
}

export function Notice({ kind, children }: { kind: 'ok' | 'err' | 'warn'; children: ReactNode }) {
  const c = kind === 'ok' ? '#00B894' : kind === 'warn' ? '#d97706' : '#E63946';
  return (
    <div style={{ background: `${c}18`, border: `1px solid ${c}`, color: c, borderRadius: 6, padding: '6px 10px',
      fontSize: 11, fontWeight: 600, marginBottom: 8 }}>{children}</div>
  );
}

export const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 11 };
export const thStyle: CSSProperties = { textAlign: 'left', padding: '5px 7px', borderBottom: '1px solid var(--border)',
  color: 'var(--muted-foreground)', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' };
export const tdStyle: CSSProperties = { padding: '5px 7px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' };

export const fmtDate = (d?: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

/** Menghitung kode titik ukur berikutnya berdasarkan kode sebelumnya (mis. WS-T1 -> WS-T2, OF-01 -> OF-02, T1 -> T2). */
export function getNextKodeTitik(lastKode?: string, fallbackIndex = 1): string {
  if (!lastKode || !lastKode.trim()) return `T${fallbackIndex}`;
  const match = lastKode.trim().match(/^(.*?)(\d+)$/);
  if (match) {
    const prefix = match[1];
    const digits = match[2];
    const num = parseInt(digits, 10) + 1;
    const padded = String(num).padStart(digits.length, '0');
    return `${prefix}${padded}`;
  }
  return `${lastKode.trim()}-T${fallbackIndex}`;
}

export function Stat({ label, value, color, sub }: { label: string; value: ReactNode; color?: string; sub?: string }) {
  return (
    <div className="card" style={{ padding: '8px 10px', gap: 2 }}>
      <span style={{ fontSize: 9.5, color: 'var(--muted-foreground)', textTransform: 'uppercase', fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 800, color: color || 'var(--foreground)', lineHeight: 1.1 }}>{value}</span>
      {sub && <span style={{ fontSize: 9.5, color: 'var(--muted-foreground)' }}>{sub}</span>}
    </div>
  );
}

/* ───────── Tombol seragam: tinggi tetap, teks tidak pernah keluar dari tombol ───────── */
type BtnKind = 'primary' | 'secondary' | 'danger';
export function Btn({ kind = 'secondary', size = 'sm', children, style, ...rest }:
  { kind?: BtnKind; size?: 'sm' | 'md' } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const h = size === 'md' ? 32 : 28;
  const base: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, boxSizing: 'border-box',
    height: h, minWidth: h, padding: size === 'md' ? '0 16px' : '0 10px', borderRadius: 6, fontSize: size === 'md' ? 12 : 11,
    fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap', cursor: rest.disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit', opacity: rest.disabled ? 0.55 : 1, flex: '0 0 auto', width: 'auto',
    ...(kind === 'primary' ? { background: '#ff4d00', color: '#fff', border: '1px solid #ff4d00' }
      : kind === 'danger' ? { background: 'transparent', color: '#E63946', border: '1px solid #E6394655' }
      : { background: 'transparent', color: 'var(--foreground)', border: '1px solid var(--border)' }),
  };
  return <button type="button" {...rest} style={{ ...base, ...style }}>{children}</button>;
}

/** Baris tombol: rata, jarak sama, boleh membungkus per tombol (bukan per teks). */
export function BtnRow({ children, justify = 'flex-start' }: { children: ReactNode; justify?: CSSProperties['justifyContent'] }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', justifyContent: justify }}>{children}</div>;
}
