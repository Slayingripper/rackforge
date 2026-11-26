import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { Severity } from '../types';

export function StatusBadge({ severity, label }: { severity: Severity; label?: string }) {
  const styles: Record<Severity, string> = {
    ok: 'border-success/25 bg-success/10 text-success',
    warning: 'border-warning/30 bg-warning/10 text-warning',
    critical: 'border-danger/30 bg-danger/10 text-danger',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${styles[severity]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label ?? severity}
    </span>
  );
}

export function IconButton({
  children,
  label,
  onClick,
  active = false,
  disabled = false,
  className = '',
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all disabled:cursor-not-allowed disabled:opacity-30 ${
        active
          ? 'border-accent/40 bg-accent/15 text-accent shadow-glow'
          : 'border-line bg-panel2 text-muted hover:border-line hover:bg-white/[0.04] hover:text-white'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full border transition-colors ${checked ? 'border-accent/40 bg-accent/25' : 'border-line bg-panel2'}`}
    >
      <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all ${checked ? 'left-[18px] bg-accent' : 'left-0.5 bg-muted'}`} />
    </button>
  );
}

export function Modal({
  title,
  eyebrow,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    previouslyFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timeout = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])');
      (first ?? panelRef.current)?.focus();
    }, 0);
    return () => {
      window.clearTimeout(timeout);
      previouslyFocused.current?.focus();
    };
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'))
      .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
    if (focusable.length === 0) { event.preventDefault(); panelRef.current.focus(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panelRef.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-label="Close dialog" />
      <div ref={panelRef} tabIndex={-1} onKeyDown={handleKeyDown} className={`relative max-h-[92vh] w-full overflow-hidden rounded-2xl border border-line bg-panel shadow-panel ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}>
        <div className="flex items-start justify-between border-b border-line bg-panel2/70 px-5 py-4">
          <div>
            {eyebrow && <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">{eyebrow}</p>}
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-white">{title}</h2>
          </div>
          <IconButton label="Close" onClick={onClose}><X size={16} /></IconButton>
        </div>
        <div className="max-h-[calc(92vh-73px)] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-muted">
        {label}
        {hint && <span className="font-normal text-muted/60">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export const inputClass = 'h-9 w-full rounded-lg border border-line bg-ink px-3 text-sm text-white outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/10';

export function EmptyState({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-panel2 text-muted">{icon}</div>
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="mt-1 max-w-[230px] text-xs leading-relaxed text-muted">{detail}</p>
    </div>
  );
}
