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
          initial={{ scale: 0.94, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 8 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: '100%', maxWidth: 440,
            background: 'var(--card, #fff)',
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: 16,
            padding: '22px 24px',
            boxShadow: '0 20px 48px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.06)',
            display: 'flex', flexDirection: 'column', gap: 16,
            fontFamily: 'inherit', color: 'var(--foreground, #111)',
            backdropFilter: 'blur(20px)',
          }}
          role="dialog" aria-modal="true"
        >
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: s.color, background: s.bg,
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            }}>{s.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'linear-gradient(180deg, #FF6F1A 0%, #FF4D00 100%)',
                    display: 'inline-block',
                    boxShadow: '0 0 6px rgba(255, 94, 0, 0.45)',
                  }}
                />
                <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>
                  {state.title || (state.type === 'confirm' ? 'Konfirmasi' : 'Informasi')}
                </p>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.55, color: 'var(--muted-foreground, #6b7280)', whiteSpace: 'pre-line' }}>
                {state.message}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            {(state.type === 'confirm') && (
              <button
                type="button" onClick={closePopup} disabled={busy}
                style={{
                  height: 34, padding: '0 18px', borderRadius: 999,
                  border: '1px solid var(--border)', background: 'var(--card)',
                  color: 'var(--foreground)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >Batal</button>
            )}
            <button
              type="button" onClick={() => void handleOk()} disabled={busy}
              style={{
                height: 34, padding: '0 20px', borderRadius: 999,
                border: 'none',
                background: state.type === 'confirm' ? 'linear-gradient(180deg, #FF6F1A 0%, #FF4D00 100%)' : s.color,
                color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit',
                opacity: busy ? 0.6 : 1,
                boxShadow: state.type === 'confirm' ? '0 2px 8px rgba(255, 77, 0, 0.35)' : '0 2px 8px rgba(0,0,0,0.15)',
                transition: 'all 0.15s ease',
              }}
            >{busy ? 'Menyimpan…' : (state.confirmLabel || 'OK')}</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
