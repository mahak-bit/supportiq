"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Inbox, Loader2, RotateCw, X } from "lucide-react";
import Link from "next/link";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

/* ---------------------------------------------------------------- wordmark */

export function OrbitMark({ className, size = 22 }: { className?: string; size?: number }) {
  // The brand mark: a question (bright core) held in orbit by evidence (blue ring + cyan bead).
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={className}>
      <defs>
        <radialGradient id={`${id}-c`} cx="38%" cy="34%" r="70%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#9db8ff" />
        </radialGradient>
      </defs>
      <ellipse cx="12" cy="12" rx="10.5" ry="5.2" transform="rotate(-28 12 12)" fill="none" stroke="var(--color-accent)" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4.2" fill={`url(#${id}-c)`} />
      <circle cx="20.6" cy="7.6" r="1.9" fill="var(--color-cyan)" />
    </svg>
  );
}

export function Wordmark({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={clsx("inline-flex items-center gap-2 text-fg", className)} aria-label="SupportIQ home">
      <OrbitMark />
      <span className="font-display text-[1.2rem] leading-none font-semibold tracking-[-0.03em]">
        Support<span className="text-accent">IQ</span>
      </span>
    </Link>
  );
}

/* ---------------------------------------------------------------- buttons */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-accent-fill text-on-accent hover:bg-[#3a70f6] hover:shadow-[var(--shadow-glow)] active:translate-y-px active:scale-[0.99] shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_6px_20px_-10px_rgb(42_98_236/0.8)]",
  secondary: "bg-raised text-fg border border-line-strong hover:border-fg-faint hover:bg-[#18223a] active:translate-y-px",
  ghost: "text-fg-soft hover:text-fg hover:bg-well",
  danger: "bg-surface text-brick border border-brick/30 hover:bg-brick-wash",
  quiet: "text-accent hover:text-accent-bright underline-offset-4 hover:underline px-0!",
};
const sizes: Record<Size, string> = { sm: "h-8 px-3 text-[13px] gap-1.5", md: "h-9.5 px-4 text-sm gap-2", lg: "h-12 px-6 text-[15px] gap-2" };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-[var(--radius-control)] font-medium whitespace-nowrap transition-[background,color,border,transform] duration-150 select-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function ButtonLink({ href, variant = "primary", size = "md", className, children }: {
  href: string; variant?: Variant; size?: Size; className?: string; children: ReactNode;
}) {
  return (
    <Link href={href} className={clsx("inline-flex items-center justify-center rounded-[var(--radius-control)] font-medium whitespace-nowrap transition-[background,color,border,box-shadow,transform] duration-200", variants[variant], sizes[size], className)}>
      {children}
    </Link>
  );
}

/* ---------------------------------------------------------------- badges */

const tones = {
  neutral: "bg-well text-fg-soft",
  cobalt: "bg-accent-wash text-accent-bright",
  moss: "bg-moss-wash text-moss",
  amber: "bg-amber-wash text-amber",
  brick: "bg-brick-wash text-brick",
  ink: "bg-fg text-surface",
} as const;
export type BadgeTone = keyof typeof tones;

export function Badge({ tone = "neutral", children, className, title }: { tone?: BadgeTone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] leading-5 font-medium whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

export const STATUS_TONE: Record<string, BadgeTone> = { open: "cobalt", pending: "neutral", escalated: "brick", resolved: "moss" };
export const STATUS_LABEL: Record<string, string> = { open: "Open", pending: "Awaiting customer", escalated: "Escalated", resolved: "Resolved" };

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? status}</Badge>;
}

/** Priority is encoded as a filled bar count, so it reads at a glance without colour alone. */
export function PriorityMark({ priority, withLabel = false }: { priority: string; withLabel?: boolean }) {
  const level = { low: 1, normal: 2, high: 3, urgent: 4 }[priority] ?? 2;
  const color = level === 4 ? "bg-brick" : level === 3 ? "bg-amber" : "bg-fg-faint";
  return (
    <span className="inline-flex items-center gap-1.5" title={`${priority} priority`}>
      <span className="inline-flex items-end gap-[2px]" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={clsx("w-[3px] rounded-[1px]", i <= level ? color : "bg-line")} style={{ height: 4 + i * 2 }} />
        ))}
      </span>
      <span className={clsx(withLabel ? "text-[13px] text-fg-soft capitalize" : "sr-only")}>{priority} priority</span>
    </span>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  // Geometric monogram instead of generated faces: hue derived from the name.
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
  return (
    <span
      aria-hidden
      className={clsx("inline-grid size-9 shrink-0 place-items-center rounded-full font-display text-[13px] font-semibold text-fg", className)}
      style={{ background: `oklch(0.33 0.07 ${h})`, boxShadow: `inset 0 0 0 1px oklch(0.46 0.09 ${h})` }}
    >
      {letters}
    </span>
  );
}

/* ---------------------------------------------------------------- form */

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-fg">{label}</label>
      {children}
      {error ? <p className="text-[13px] text-brick" role="alert">{error}</p> : hint ? <p className="text-[12.5px] text-fg-faint">{hint}</p> : null}
    </div>
  );
}

const inputBase = "w-full rounded-[var(--radius-control)] border border-line-strong bg-well px-3 text-[14px] text-fg placeholder:text-fg-faint transition-[border,box-shadow] hover:border-fg-faint focus:border-accent focus:shadow-[0_0_0_3px_rgb(91_140_255/0.18)] focus:outline-none";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={clsx(inputBase, "h-9.5", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={clsx(inputBase, "py-2.5 leading-relaxed", className)} {...rest} />;
});

export function Segmented<T extends string>({ value, options, onChange, label, size = "md" }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[var(--radius-control)] border border-line bg-well/70 p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={clsx(
              "relative rounded-[5px] font-medium transition-colors",
              size === "sm" ? "h-7 px-2.5 text-[12.5px]" : "h-8 px-3 text-[13px]",
              active ? "text-fg" : "text-fg-soft hover:text-fg",
            )}
          >
            {active && <motion.span layoutId={`seg-${label}`} className="absolute inset-0 rounded-[5px] bg-raised shadow-[var(--shadow-lift)] ring-1 ring-line-strong" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- states */

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-fg-soft">
      <Loader2 className="size-4 animate-spin" aria-hidden /> {label}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={clsx("shimmer block rounded-md", className)} />;
}

export function EmptyState({ title, body, action, icon }: { title: string; body?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-full border border-line-strong bg-raised text-accent shadow-[0_0_30px_-8px_rgb(91_140_255/0.5)]">{icon ?? <Inbox className="size-5" aria-hidden />}</div>
      <p className="font-display text-lg text-fg">{title}</p>
      {body && <div className="mt-1.5 max-w-sm text-sm text-fg-soft">{body}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry, compact }: { message: string; onRetry?: () => void; compact?: boolean }) {
  return (
    <div role="alert" className={clsx("flex items-start gap-3 rounded-[var(--radius-panel)] border border-brick/25 bg-brick-wash/60 text-sm text-fg", compact ? "p-3" : "p-4")}>
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-brick" aria-hidden />
      <div className="flex-1">
        <p>{message}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-2 inline-flex items-center gap-1.5 font-medium text-brick hover:underline">
            <RotateCw className="size-3.5" aria-hidden /> Try again
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- dialog */

export function Dialog({ open, onClose, title, description, children, footer }: {
  open: boolean; onClose: () => void; title: string; description?: string; children?: ReactNode; footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>("button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])") ?? []).filter((n) => !n.hasAttribute("disabled"));
    window.setTimeout(() => (el?.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0])?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const f = focusables();
        if (!f.length) return;
        const first = f[0]!, last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus(); };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center sm:p-6">
          <motion.div className="absolute inset-0 bg-scrim/70 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-t`}
            aria-describedby={description ? `${id}-d` : undefined}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-lg rounded-t-[16px] border border-line-strong bg-raised p-6 shadow-[var(--shadow-float)] sm:rounded-[var(--radius-panel)]"
          >
            <button type="button" onClick={onClose} aria-label="Close dialog" className="absolute top-4 right-4 rounded-md p-1 text-fg-faint hover:bg-well hover:text-fg">
              <X className="size-4" />
            </button>
            <h2 id={`${id}-t`} className="font-display pr-8 text-xl text-fg">{title}</h2>
            {description && <p id={`${id}-d`} className="mt-1.5 text-sm text-fg-soft">{description}</p>}
            {children && <div className="mt-5">{children}</div>}
            {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ---------------------------------------------------------------- toasts */

type Toast = { id: number; text: string; tone: "ok" | "error" | "info" };
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-2), { id, text, tone }]);
    window.setTimeout(() => setItems((xs) => xs.filter((t) => t.id !== id)), tone === "error" ? 7000 : 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 left-4 z-[60] flex flex-col items-center gap-2 sm:left-auto sm:items-end">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 24 }}
              className={clsx(
                "pointer-events-auto max-w-sm rounded-[10px] px-4 py-3 text-sm shadow-[var(--shadow-float)]",
                t.tone === "error" ? "border border-brick/35 bg-brick-wash text-brick" : "glass border border-line-strong text-fg",
              )}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/* ---------------------------------------------------------------- misc */

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-grid h-5 min-w-5 place-items-center rounded border border-line-strong bg-surface px-1 font-sans text-[11px] text-fg-soft shadow-[0_1px_0_var(--color-line-strong)]">{children}</kbd>;
}

export function SectionTitle({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="text-[13px] font-semibold text-fg">{children}</h2>
      {action}
    </div>
  );
}

export function SampleDataNote({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-dashed border-line-strong bg-surface/70 px-3 py-1 text-[12.5px] text-fg-soft">
      <span className="size-1.5 rounded-full bg-amber" aria-hidden /> {children}
    </p>
  );
}
