'use client';

import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';

/**
 * usePopup — pengganti window.alert() & window.confirm() dengan dialog
 * branded ala aplikasi (framer-motion), konsisten dengan style lainnya.
 *
 * Pemakaian:
 *   const { popup, popupState, closePopup } = usePopup();
 *   ...
 *   popup({ type: 'error', title: 'Gagal', message: 'Tulisan' });
 *
 * Untuk alur confirm-asynchronous:
 *   popup({
 *     type: 'confirm',
 *     title: 'Hapus item?',
 *     message: 'Tulisan detail',
 *     onOk: async () => { await fetchDelete(); popup({ type: 'success', ... }); },
 *   });
 *
 * `type`:
 *   • 'success' | 'error' | 'info' → satu tombol "OK"
 *   • 'confirm' → dua tombol "Batal" / "OK" (onOk dijalankan saat OK)
 */
export type PopupType = 'success' | 'error' | 'info' | 'confirm';
export interface PopupOptions {
  type?: PopupType;
  title?: string;
  message: string;
  /** Hanya untuk type='confirm' — dijalankan saat tombol OK ditekan. */
  onOk?: () => void | Promise<void>;
  /** Label tombol OK default 'OK'; override bila diperlukan. */
  confirmLabel?: string;
}
export type PopupState = PopupOptions & { open: boolean };

export function usePopup() {
  const [state, setState] = useState<PopupState | null>(null);

  const popup = useCallback((opts: PopupOptions) => {
    setState({ ...opts, open: true });
  }, []);

  const closePopup = useCallback(() => setState(null), []);

  return { popup, popupState: state, closePopup };
}

const STYLE: Record<PopupType, { color: string; bg: string; icon: React.ReactNode }> = {
  success: { color: '#00B894', bg: 'rgba(0,184,148,0.12)', icon: <CheckCircle2 size={22} /> },
  error:   { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', icon: <AlertTriangle size={22} /> },
  info:    { color: '#3498DB', bg: 'rgba(52,152,219,0.12)', icon: <Info size={22} /> },
  confirm: { color: '#F5A623', bg: 'rgba(245,166,35,0.12)', icon: <AlertTriangle size={22} /> },
};

/**
 * Render di paling bawah tree aplikasi (portal framer-motion / fixed,
 * jadi posisi di JSX tidak masalah).
 */
export function Popup({ state, closePopup }: {
  state: PopupState | null;
  closePopup: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const handleOk = async () => {
    if (state?.onOk) {
      setBusy(true);
      try { await state.onOk(); } finally { setBusy(false); }
    }
    closePopup();
  };

  if (!state) return null;
  const s = STYLE[state.type ?? 'info'];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.45)', padding: 16,
        }}
        onClick={(e) => { if (e.target === e.currentTarget && state.type !== 'confirm') closePopup(); }}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          style={{
            width: '100%', maxWidth: 440,
            background: 'var(--card, #fff)',
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: 12,
            padding: 20,
            boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
            display: 'flex', flexDirection: 'column', gap: 12,
            fontFamily: 'inherit', color: 'var(--foreground, #111)',
          }}
          role="dialog" aria-modal="true"
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: s.color, background: s.bg,
            }}>{s.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>
                {state.title || (state.type === 'confirm' ? 'Konfirmasi' : 'Informasi')}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--muted-foreground, #6b7280)', whiteSpace: 'pre-line' }}>
                {state.message}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {(state.type === 'confirm') && (
              <button
                type="button" onClick={closePopup} disabled={busy}
                style={{
                  height: 34, padding: '0 16px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--foreground)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >Batal</button>
            )}
            <button
              type="button" onClick={() => void handleOk()} disabled={busy}
              style={{
                height: 34, padding: '0 18px', borderRadius: 8,
                border: 'none', background: s.color,
                color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit',
                opacity: busy ? 0.6 : 1,
              }}
            >{busy ? 'Menyimpan…' : (state.confirmLabel || 'OK')}</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
