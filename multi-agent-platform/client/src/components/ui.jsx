import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useToast } from '../store/useToast';

export const Spinner = ({ size = 16, className = '' }) => <Loader2 size={size} className={`animate-spin ${className}`} aria-hidden />;

export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div role="dialog" aria-modal="true" aria-label={title} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
            className={`panel flex max-h-[92vh] w-full flex-col rounded-b-none sm:rounded-b-2xl ${wide ? 'max-w-6xl' : 'max-w-xl'}`}>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="font-display text-base font-semibold text-white">{title}</h2>
              <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ToastHost() {
  const { items, dismiss } = useToast();
  const icons = { success: <CheckCircle2 size={16} className="text-emerald-400" />, error: <AlertTriangle size={16} className="text-red-400" />, info: <Info size={16} className="text-cyan-soft" /> };
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-2" role="status" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div key={t.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }} className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-line bg-raised px-3.5 py-3 text-sm shadow-xl">
            <span className="mt-0.5">{icons[t.type]}</span>
            <span className="flex-1 text-zinc-200">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="text-zinc-500 hover:text-white" aria-label="Dismiss"><X size={14} /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export const Empty = ({ icon: Icon, title, children }) => (
  <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
    {Icon && <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-card text-zinc-400"><Icon size={22} /></div>}
    <h3 className="font-display text-base font-semibold text-white">{title}</h3>
    <div className="max-w-sm text-sm text-zinc-400">{children}</div>
  </div>
);

export const Toggle = ({ checked, onChange, label, disabled }) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 shrink-0 rounded-full border transition disabled:opacity-40 ${checked ? 'border-violet bg-violet/80' : 'border-line bg-ink'}`}>
    <span className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} style={{ height: 18, width: 18 }} />
  </button>
);

export const PageShell = ({ title, subtitle, actions, children }) => (
  <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {actions}
    </div>
    {children}
  </div>
);
