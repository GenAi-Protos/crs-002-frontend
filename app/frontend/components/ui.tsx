"use client";

// Shared primitives. PageHeader deliberately has no description prop:
// if a screen needs explaining, it is the wrong screen.

import { defang } from "@/lib/defang";
import type { Tlp } from "@/lib/types";
import {
  IconCheck,
  IconClose,
  IconCritical,
  IconDash,
  IconSearch,
  IconWarn,
  IconExport,
} from "./icons";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";

export function PageHeader({
  title,
  meta,
  action,
  className = "",
}: {
  title: string;
  // Inline after the title: a status pill, a count. Never a sentence.
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-5 flex items-center justify-between gap-4 ${className}`}>
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="text-xl font-medium tracking-tightish">{title}</h1>
        {meta}
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Buttons. One primary (CPX Green, near-black text), one secondary, one ghost,
// one danger. Every button in the console goes through here so hover, disabled
// and size are spelled once.

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-cpx-green font-medium text-cpx-black hover:brightness-95 disabled:bg-black/10 disabled:text-black/40 disabled:hover:brightness-100",
  secondary:
    "border border-black/15 hover:bg-black/5 disabled:border-black/10 disabled:text-black/30 disabled:hover:bg-transparent",
  ghost:
    "text-cpx-grey hover:bg-black/5 hover:text-cpx-black disabled:text-black/25 disabled:hover:bg-transparent",
  // Accent Red text is 3.2:1 on white, so destructive actions carry the warn ink.
  danger:
    "border border-status-warn-ink text-status-warn-ink hover:bg-status-warn-fill disabled:border-black/10 disabled:text-black/30 disabled:hover:bg-transparent",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  md: "h-8 px-3 text-sm",
  sm: "h-7 px-2.5 text-xs",
};

// For a <Link> or <label> that must look like a button.
export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className = "",
) {
  return `inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap disabled:cursor-not-allowed ${BUTTON_SIZE[size]} ${BUTTON_VARIANT[variant]} ${className}`;
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "secondary",
  size = "md",
  type = "button",
  className = "",
  ...rest
}: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}

// ---------------------------------------------------------------------------
// Modal surfaces on the native <dialog>: focus trap, Escape, inert background
// and focus return come from the platform, not from a library.

export function useModal(onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const silent = useRef(false);
  // Layout effect so the cleanup runs before React detaches the node: close()
  // then still hands focus back to the element that opened the dialog.
  useLayoutEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    return () => {
      // The close event this fires must not reach onClose: in dev, StrictMode
      // remounts straight away and would otherwise shut the dialog on open.
      if (d.open) {
        silent.current = true;
        d.close();
      }
    };
  }, []);
  // Native close (Escape, or the browser forcing a close) reports up once.
  const handleClose = () => {
    if (silent.current) {
      silent.current = false;
      return;
    }
    onClose();
  };
  return { ref, handleClose };
}

export function closeOnBackdrop(onClose: () => void) {
  // Content sits in a padded child, so a click that lands on the dialog element
  // itself can only be the backdrop.
  return (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) onClose();
  };
}

// Mounted means open. Parents keep their `{show && <Dialog …/>}` pattern.
export function Dialog({
  title,
  onClose,
  children,
  className = "",
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const { ref, handleClose } = useModal(onClose);
  const id = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onClose={handleClose}
      onClick={closeOnBackdrop(onClose)}
      className={`m-auto w-full max-w-md border border-black/10 bg-white p-0 text-cpx-black shadow-pop ${className}`}
    >
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={id} className="text-md font-medium tracking-tightish">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center text-black/40 hover:bg-black/5 hover:text-cpx-black"
          >
            <IconClose />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

// Right-hand panel under the top bar. The page does not change behind it.
export function Drawer({
  title,
  onClose,
  children,
  className = "",
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const { ref, handleClose } = useModal(onClose);
  const id = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onClose={handleClose}
      onClick={closeOnBackdrop(onClose)}
      className={`fixed bottom-0 left-auto right-0 top-14 m-0 h-auto max-h-none w-[480px] max-w-full overflow-y-auto border-l border-black/10 bg-white p-0 text-cpx-black ${className}`}
    >
      <div className="flex items-center justify-between gap-4 border-b border-black/10 px-5 py-3">
        <div id={id} className="min-w-0">
          {title}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-7 w-7 shrink-0 items-center justify-center text-black/40 hover:bg-black/5 hover:text-cpx-black"
        >
          <IconClose />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}

// Non-modal popovers and menus: close on Escape or on a click outside `ref`.
export function useDismiss<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onDismiss: () => void,
  active = true,
) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    const onDown = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [ref, onDismiss, active]);
}

// ---------------------------------------------------------------------------
// Status and data chips.

export type StatusTone = "good" | "warn" | "critical" | "idle";

// Colour never carries meaning alone: every status ships an icon and a label.
export function StatusPill({ tone, label }: { tone: StatusTone; label: string }) {
  const map: Record<StatusTone, { box: string; icon: ReactNode }> = {
    good: {
      box: "bg-cpx-green text-cpx-black ring-1 ring-cpx-purple",
      icon: <IconCheck />,
    },
    warn: {
      box: "bg-status-warn-fill text-status-warn-ink",
      icon: <IconWarn className="text-status-warn-ink" />,
    },
    critical: { box: "bg-cpx-red text-white", icon: <IconCritical className="text-white" /> },
    idle: { box: "bg-status-idle text-cpx-black", icon: <IconDash /> },
  };
  const m = map[tone];
  return (
    <span
      className={`inline-flex h-5 items-center gap-1 rounded-[2px] px-1.5 text-2xs ${m.box}`}
    >
      {m.icon}
      {label}
    </span>
  );
}

// Hard rule 1: demonstration data is never presented as live. One chip, one
// wording, on every screen that fell back to fixtures.
export function OfflineNote() {
  return (
    <span className="inline-flex h-5 items-center gap-1 bg-status-warn-fill px-1.5 text-2xs text-status-warn-ink">
      <IconWarn className="text-status-warn-ink" />
      Demonstration data. Backend unreachable.
    </span>
  );
}

// Loading at final geometry, no motion: hard rule 4 bans the pulse.
export function SkeletonRows({ rows = 6, className = "" }: { rows?: number; className?: string }) {
  return (
    <div aria-busy="true" aria-label="Loading" className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-8 bg-black/5" style={{ width: `${100 - (i % 3) * 8}%` }} />
      ))}
    </div>
  );
}

export function TlpBadge({ tlp }: { tlp: Tlp }) {
  const dark = tlp === "RED" || tlp === "AMBER+STRICT";
  return (
    <span
      className={`inline-flex h-5 items-center rounded-[2px] px-1.5 font-mono text-2xs ${
        dark
          ? "bg-cpx-red text-white"
          : tlp === "AMBER"
            ? "bg-status-warn-fill text-status-warn-ink"
            : tlp === "GREEN"
              ? "bg-green-contrast text-white"
              : "bg-black/10 text-cpx-grey"
      }`}
    >
      TLP:{tlp}
    </span>
  );
}

// A defanged observable: inert, never an anchor, never prefetched.
export function IndicatorChip({ value }: { value: string }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-[2px] bg-black/5 px-1.5 py-0.5 font-mono text-xs text-cpx-grey break-all">
      {defang(value)}
    </span>
  );
}

// Inert URL rendering for the source inventory. Plain text, always defanged.
export function InertUrl({ url }: { url: string }) {
  return (
    <span className="font-mono text-2xs text-cpx-grey/80 break-all">
      {defang(url)}
    </span>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder = "Search",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black/40" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 w-full border border-black/15 bg-white pl-8 pr-3 text-sm focus:border-cpx-purple focus:outline-none"
      />
    </div>
  );
}

// Honest total plus stated default sort, on every list.
export function ListMeta({
  shown,
  total,
  sort,
  onExport,
  note,
}: {
  shown: number;
  total: number;
  sort: string;
  onExport?: () => void;
  note?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-cpx-grey">
      <span>
        Showing <span className="font-medium text-cpx-black">{shown}</span> of{" "}
        <span className="font-medium text-cpx-black">{total}</span>
      </span>
      <span className="text-black/30">·</span>
      <span>{sort}</span>
      {onExport && (
        <Button variant="secondary" size="sm" onClick={onExport} className="ml-1">
          <IconExport />
          CSV
        </Button>
      )}
      {note}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { key: T; label: string; count?: number }[];
  value: T;
  onChange: (t: T) => void;
  label?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex items-end gap-1 border-b border-black/10">
      {tabs.map((t) => {
        const selected = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(t.key)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${
              selected
                ? "border-cpx-purple font-medium text-cpx-purple"
                : "border-transparent text-cpx-grey hover:text-cpx-black"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="bg-black/5 px-1 text-2xs">{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function CountTile({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  href?: string;
}) {
  const body = (
    <div className="flex h-full flex-col justify-between border border-black/10 bg-white p-4">
      <span className="text-xs text-cpx-grey">{label}</span>
      <span className="mt-2 font-display text-2xl font-medium leading-none tracking-tightish">
        {value}
      </span>
      {hint && (
        <span className="mt-2 text-2xs text-cpx-grey">{hint}</span>
      )}
    </div>
  );
  return href ? (
    <a href={href} className="block hover:bg-black/[0.02]">
      {body}
    </a>
  ) : (
    body
  );
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const text = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([text], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
