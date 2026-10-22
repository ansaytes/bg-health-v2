'use client';

// Tab bar standar seluruh aplikasi.
//
// Posisi tab sengaja DITENGAH halaman (simetris) agar tidak menempel ke kiri dan
// terlihat seimbang pada semua lebar layar. Semua menu dengan beberapa tab
// memakai komponen ini supaya gaya & posisinya seragam.

export interface CenteredTabItem<K extends string> {
  key: K;
  label: string;
  /** Jumlah opsional yang ditampilkan sebagai badge kecil. */
  count?: number;
}

export default function CenteredTabs<K extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
  compact = false,
}: {
  tabs: CenteredTabItem<K>[];
  active: K;
  onChange: (key: K) => void;
  ariaLabel: string;
  compact?: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="centered-tabs"
      style={compact ? { padding: '6px 12px 0' } : undefined}
    >
      {tabs.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.key)}
            className={`centered-tab${isActive ? ' is-active' : ''}`}
            style={compact ? { height: 30, padding: '0 14px', fontSize: 11.5 } : undefined}
          >
            {t.label}
            {typeof t.count === 'number' && (
              <span className="centered-tab-count">{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
