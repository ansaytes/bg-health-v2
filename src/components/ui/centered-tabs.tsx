'use client';

// Tab bar standar seluruh aplikasi bergaya macOS Segmented Control dengan dominasi oranye.

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
      style={compact ? { padding: '4px 12px' } : undefined}
    >
      <div className="centered-tabs-track">
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
              style={compact ? { height: 28, padding: '0 12px', fontSize: 11, minWidth: 110 } : undefined}
            >
              {t.label}
              {typeof t.count === 'number' && (
                <span className="centered-tab-count">{t.count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
