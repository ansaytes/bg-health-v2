'use client';

import { useCallback, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, AlertCircle } from 'lucide-react';

/**
 * usePopup — pengganti window.alert(), window.confirm(), & window.prompt()
 * dengan dialog branded ala macOS sheet (framer-motion), konsisten di seluruh aplikasi.
 *
 * Pemakaian:
 *   const { popup, popupState, closePopup } = usePopup();
 *   ...
 *   popup({ type: 'error', title: 'Gagal', message: 'Tulisan' });
 *
 * Konfirmasi:
 *   popup({
 *     type: 'confirm',
 *     title: 'Hapus item?',
 *     message: 'Tulisan detail',
 *     onOk: async () => { await fetchDelete(); popup({ type: 'success', ... }); },
 *   });
 *
 * Prompt Input (pengganti window.prompt):
 *   popup({
 *     type: 'prompt',
 *     title: 'Input No. PICA',
 *     message: 'Masukkan nomor PICA:',
 *     defaultValue: 'PICA-001',
 *     onPromptOk: async (val) => { await save(val); },
 *   });
 */
export type PopupType = 'success' | 'error' | 'info' | 'confirm' | 'warn' | 'prompt';
export interface PopupOptions {
  type?: PopupType;
  title?: string;
  message: string;
  /** Hanya untuk type='confirm' atau fallback — dijalankan saat tombol OK ditekan. */
  onOk?: () => void | Promise<void>;
  /** Khusus type='prompt' — menerima nilai string dari input teks. */
  onPromptOk?: (value: string) => void | Promise<void>;
  /** Nilai awal untuk type='prompt' */
  defaultValue?: string;
  /** Placeholder input untuk type='prompt' */
  placeholder?: string;
  /** Label tombol OK default 'OK' atau 'Simpan'; override bila diperlukan. */
  confirmLabel?: string;
  /** Label tombol Batal default 'Batal'. */
  cancelLabel?: string;
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
  error:   { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', icon: <AlertCircle size={22} /> },
  warn:    { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', icon: <AlertTriangle size={22} /> },
  info:    { color: '#3498DB', bg: 'rgba(52,152,219,0.12)', icon: <Info size={22} /> },
  confirm: { color: '#FF5E00', bg: 'rgba(255,94,0,0.12)', icon: <AlertTriangle size={22} /> },
  prompt:  { color: '#FF5E00', bg: 'rgba(255,94,0,0.12)', icon: <Info size={22} /> },
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
  const [promptVal, setPromptVal] = useState('');

  useEffect(() => {
    if (state?.type === 'prompt') {
      setPromptVal(state.defaultValue || '');
    }
  }, [state]);

  const handleOk = async () => {
    if (state?.type === 'prompt' && state.onPromptOk) {
      setBusy(true);
      try { await state.onPromptOk(promptVal); } finally { setBusy(false); }
    } else if (state?.onOk) {
      setBusy(true);
      try { await state.onOk(); } finally { setBusy(false); }
    }
    closePopup();
  };

  if (!state) return null;
  const s = STYLE[state.type ?? 'info'];
  const isActionDialog = state.type === 'confirm' || state.type === 'prompt';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.45)', padding: 16,
          backdropFilter: 'blur(8px)',
        }}
        onClick={(e) => { if (e.target === e.currentTarget && !isActionDialog) closePopup(); }}
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
            borderRadius: 14,
            padding: '22px 24px',
            boxShadow: '0 20px 48px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.06)',
            display: 'flex', flexDirection: 'column', gap: 16,
            fontFamily: 'inherit', color: 'var(--foreground, #111)',
          }}
          role="dialog" aria-modal="true"
        >
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10, flexShrink: 0,
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
                    background: '#FF4D00',
                    display: 'inline-block',
                  }}
                />
                <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>
                  {state.title || (state.type === 'confirm' ? 'Konfirmasi' : state.type === 'prompt' ? 'Input Data' : state.type === 'warn' ? 'Perhatian' : 'Informasi')}
                </p>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.55, color: 'var(--muted-foreground, #6b7280)', whiteSpace: 'pre-line' }}>
                {state.message}
              </p>

              {state.type === 'prompt' && (
                <div style={{ marginTop: 12 }}>
                  <input
                    type="text"
                    autoFocus
                    value={promptVal}
                    placeholder={state.placeholder || ''}
                    onChange={(e) => setPromptVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleOk();
                      }
                    }}
                    style={{
                      width: '100%',
                      height: 38,
                      padding: '0 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--background)',
                      color: 'var(--foreground)',
                      fontSize: 12.5,
                      outline: 'none',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)',
                    }}
                  />
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            {isActionDialog && (
              <button
                type="button" onClick={closePopup} disabled={busy}
                style={{
                  height: 34, padding: '0 18px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--card)',
                  color: 'var(--foreground)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >{state.cancelLabel || 'Batal'}</button>
            )}
            <button
              type="button" onClick={() => void handleOk()} disabled={busy}
              style={{
                height: 34, padding: '0 20px', borderRadius: 8,
                border: 'none',
                background: isActionDialog ? 'linear-gradient(180deg, #FF6F1A 0%, #FF4D00 100%)' : s.color,
                color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit',
                opacity: busy ? 0.6 : 1,
                boxShadow: isActionDialog ? '0 2px 8px rgba(255, 77, 0, 0.35)' : '0 2px 8px rgba(0,0,0,0.15)',
                transition: 'all 0.15s ease',
              }}
            >{busy ? 'Menyimpan…' : (state.confirmLabel || (state.type === 'prompt' ? 'Simpan' : 'OK'))}</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
