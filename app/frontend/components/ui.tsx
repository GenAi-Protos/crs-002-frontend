"use client";

// Shared primitives. PageHeader deliberately has no description prop:
// if a screen needs explaining, it is the wrong screen.
//
// Density is set for a Teams tab viewed at about 90% zoom: 32px controls,
// 32px table rows, 36px panel headers, 13px body. Motion comes from the
// utilities in app/globals.css (enter, pop, row-link, tip, changed); nothing
// here loops or pulses, and reduced motion collapses all of it.

import Link from "next/link";
import { defang } from "@/lib/defang";
import type { Tlp } from "@/lib/types";
import type { Severity } from "@/lib/dashboard/types";
import {
  IconCheck,
  IconChevronRight,
  IconClose,
  IconCritical,
  IconDash,
  IconInfo,
  IconSearch,
  IconWarn,
  IconExport,
} from "./icons";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

// ---------------------------------------------------------------------------
// Page structure.

/**
 * A page's content column. `@container/page` lets every grid inside respond to
 * the width it actually has (the tab minus the rail), not to the viewport.
 * `band` puts the page on the grey canvas, for pages built from white Panels.
 * Full-bleed layouts (the Intelligence composer, the report editor, Clients)
 * do not use it.
 */
export function Page({
  children,
  narrow = false,
  band = false,
  className = "",
}: {
  children: ReactNode;
  narrow?: boolean;
  band?: boolean;
  className?: string;
}) {
  const inner = (
    <div
      className={`@container/page mx-auto w-full ${narrow ? "max-w-[880px]" : "max-w-[1600px]"} px-4 py-4 ${className}`}
    >
      {children}
    </div>
  );
  return band ? <div className="flex-1 bg-band">{inner}</div> : inner;
}

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
    <div
      className={`mb-3 flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-2 ${className}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <h1 className="truncate text-lg font-semibold tracking-tightish">{title}</h1>
        {meta}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

/**
 * The console's one surface: white, a hairline, 4px corners, no shadow. A
 * 36px header carries the title (Inter, not the display face: panel titles
 * are eyebrows, not headings to read first), an optional count, a caption
 * that states the figures' scope, and one action.
 *
 * `enter` is the panel's place in the page's arrival order; it staggers the
 * first-mount rise and is never replayed by a data refresh.
 */
export function Panel({
  title,
  count,
  aside,
  action,
  children,
  flush = false,
  enter,
  className = "",
  bodyClassName = "",
  ariaLabel,
}: {
  title?: ReactNode;
  count?: number;
  aside?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  enter?: number;
  className?: string;
  bodyClassName?: string;
  ariaLabel?: string;
}) {
  const id = useId();
  const style = enter === undefined ? undefined : ({ "--i": enter } as CSSProperties);
  return (
    <section
      aria-labelledby={title ? id : undefined}
      aria-label={title ? undefined : ariaLabel}
      style={style}
      className={`flex min-w-0 flex-col border border-rule bg-surface ${enter === undefined ? "" : "enter"} ${className}`}
    >
      {(title || aside || action) && (
        <header className="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-rule px-3 py-1.5">
          {title && (
            <h2 id={id} className="min-w-0 truncate font-sans text-sm font-semibold tracking-tightish">
              {title}
            </h2>
          )}
          {count !== undefined && <CountBadge n={count} />}
          <span className="ml-auto flex shrink-0 items-center gap-3">
            {aside && <span className="whitespace-nowrap text-2xs text-mute">{aside}</span>}
            {action}
          </span>
        </header>
      )}
      <div className={`min-h-0 flex-1 ${flush ? "" : "p-3"} ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** "View all ›": the panel header's one way out. The chevron leans on hover. */
export function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group/pl inline-flex items-center gap-0.5 text-xs font-medium text-link transition-colors duration-150 hover:text-accent"
    >
      {children}
      <IconChevronRight className="transition-transform duration-150 ease-out-quart group-hover/pl:translate-x-0.5" />
    </Link>
  );
}

/** Search, filters and the list's honest total, on one row that wraps. */
export function Toolbar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mb-3 flex flex-wrap items-center gap-2 ${className}`}>{children}</div>;
}

// ---------------------------------------------------------------------------
// Buttons, the CSD-007 recipes (style guide 7.1). One primary (CPX Green, Dark
// Purple text), one secondary, one ghost, one danger. Every button in the console
// goes through here so hover, disabled and size are spelled once. Green is for
// the one hero action per view; everything else is the white outline button.

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-cpx-green font-medium text-cpx-purple hover:bg-cpx-green-600 disabled:opacity-50 disabled:hover:bg-cpx-green",
  secondary:
    "border border-rule bg-surface font-medium hover:border-rule-strong hover:bg-inset disabled:opacity-50 disabled:hover:border-rule disabled:hover:bg-surface",
  ghost:
    "text-mute hover:bg-inset hover:text-accent disabled:opacity-50 disabled:hover:bg-transparent",
  // Accent Red text is 3.2:1 on white, so destructive actions carry red-700.
  danger:
    "border border-danger-edge bg-surface font-medium text-danger hover:bg-danger-tint disabled:opacity-50 disabled:hover:bg-surface",
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
  // 150ms on colour, and a 3% press so a click reads as a click. The press
  // needs :enabled, so a disabled button stays still.
  return `inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm transition duration-150 ease-out-quart enabled:active:scale-[0.97] disabled:cursor-not-allowed ${BUTTON_SIZE[size]} ${BUTTON_VARIANT[variant]} ${className}`;
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

/** A square icon-only button. The label is its accessible name and tooltip. */
export function IconButton({
  label,
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex ${size === "sm" ? "h-6 w-6" : "h-7 w-7"} shrink-0 items-center justify-center rounded-sm text-mute transition duration-150 ease-out-quart hover:bg-fill hover:text-ink enabled:active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Form fields. One recipe for every input, select and textarea: 32px, the
// hairline, a darker hairline on hover, green on focus.

// Height is set apart so a compact (28px) control in a toolbar or panel header
// does not fight the default.
const FIELD =
  "rounded-sm border border-rule bg-surface px-2.5 text-sm text-ink transition-colors duration-150 placeholder:text-mute hover:border-rule-strong focus:border-cpx-green focus:outline-none disabled:cursor-not-allowed disabled:bg-inset disabled:text-mute";

export const inputClass = `h-8 w-full ${FIELD}`;

/** A field under its own label (`mt-1`), for forms whose inputs, selects and
 *  textareas share one recipe and size to their content. */
export const fieldClass = `mt-1 w-full ${FIELD} py-1.5`;

type FieldSize = "sm" | "md";
const fieldSize = (size: FieldSize) => (size === "sm" ? "h-7 text-xs" : "h-8");

export function Input({
  className = "",
  fieldSize: size = "md",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { fieldSize?: FieldSize }) {
  return <input className={`${fieldSize(size)} w-full ${FIELD} ${className}`} {...rest} />;
}

export function Select({
  className = "",
  fieldSize: size = "md",
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { fieldSize?: FieldSize }) {
  return <select className={`${fieldSize(size)} ${FIELD} pl-2 pr-1 ${className}`} {...rest} />;
}

export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full ${FIELD} min-h-20 py-2 leading-relaxed ${className}`}
      {...rest}
    />
  );
}

/** A visible label over its control, with an optional one-line hint. */
export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 block text-xs font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-2xs text-mute">{hint}</span>}
    </label>
  );
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
      className={`m-auto w-full ${className.includes("max-w-") ? "" : "max-w-md"} border border-rule bg-overlay p-0 text-ink shadow-pop ${className}`}
    >
      <div className="p-4">
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 id={id} className="font-sans text-md font-semibold tracking-tightish">
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose} className="-mr-1 -mt-0.5">
            <IconClose />
          </IconButton>
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
      className={`drawer fixed bottom-0 left-auto right-0 top-12 m-0 h-auto max-h-none w-[480px] max-w-full overflow-y-auto border-l border-rule bg-overlay p-0 text-ink shadow-xl ${className}`}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-rule bg-overlay px-4 py-2.5">
        <div id={id} className="min-w-0">
          {title}
        </div>
        <IconButton label="Close" onClick={onClose}>
          <IconClose />
        </IconButton>
      </div>
      <div className="p-4">{children}</div>
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
// Soft tinted pills, the CSD-007 ladder: green good, bright purple needs
// attention, red critical, grey nothing yet.
export function StatusPill({ tone, label }: { tone: StatusTone; label: string }) {
  const map: Record<StatusTone, { box: string; icon: ReactNode }> = {
    good: {
      box: "border-good-edge bg-good-tint text-green-contrast",
      icon: <IconCheck />,
    },
    warn: {
      box: "border-status-warn-edge bg-status-warn-fill text-status-warn-ink",
      icon: <IconWarn />,
    },
    critical: {
      box: "border-danger-edge bg-danger-tint-2 text-danger",
      icon: <IconCritical />,
    },
    idle: {
      box: "border-rule-strong bg-fill text-ink-2",
      icon: <IconDash />,
    },
  };
  const m = map[tone];
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 text-2xs font-medium ${m.box}`}
    >
      {m.icon}
      {label}
    </span>
  );
}

const SEVERITY: Record<Severity, { box: string; label: string }> = {
  critical: { box: "border-danger-edge bg-danger-tint-2 text-danger", label: "Critical" },
  high: { box: "border-danger-tint-2 bg-danger-tint text-danger", label: "High" },
  medium: { box: "border-info-edge bg-info-tint text-info", label: "Medium" },
  low: { box: "border-rule-strong bg-fill text-ink-2", label: "Low" },
};

/** The square pip is the CPX building block, in the severity scale's ink. */
export function SeverityPip({ level, className = "" }: { level: Severity; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2 w-2 shrink-0 ${className}`}
      style={{ background: `var(--color-sev-${level})` }}
    />
  );
}

/** Severity: a word, a pip, a tint. Never colour alone. */
export function SeverityBadge({ level }: { level: Severity }) {
  const s = SEVERITY[level];
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-1.5 text-2xs font-medium ${s.box}`}
    >
      <SeverityPip level={level} />
      {s.label}
    </span>
  );
}

/** Case priority: the same ordinal ladder as severity, drawn as an outline so
 *  a priority (someone's call) never reads as a severity (the record's). */
export function PriorityBadge({ level }: { level: Severity }) {
  return (
    <span className="inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border border-rule-strong bg-surface px-1.5 text-2xs font-medium text-ink-2">
      <SeverityPip level={level} />
      {SEVERITY[level].label}
    </span>
  );
}

/** A small count beside a title, tab or chip. One style everywhere. */
export function CountBadge({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span
      className={`inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-sm bg-fill px-1 text-2xs font-medium tabular-nums text-ink-2 ${className}`}
    >
      {n.toLocaleString("en-GB")}
    </span>
  );
}

// Hard rule 1: demonstration data is never presented as live. One chip, one
// wording, on every screen that fell back to fixtures. A status region, so a
// screen reader hears the fallback happen rather than reading fixture rows as
// live ones.
export function OfflineNote() {
  return (
    <span
      role="status"
      className="reveal inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-sm border border-info-edge bg-info-tint px-1.5 text-2xs font-medium text-info"
    >
      <IconWarn />
      Demonstration data. Backend unreachable.
    </span>
  );
}

// Loading at final geometry, no motion: hard rule 4 bans the pulse.
export function SkeletonRows({
  rows = 6,
  height = "h-8",
  className = "",
}: {
  rows?: number;
  height?: string;
  className?: string;
}) {
  return (
    <div aria-busy="true" aria-label="Loading" className={`space-y-1.5 ${className}`}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`${height} bg-fill`} style={{ width: `${100 - (i % 3) * 8}%` }} />
      ))}
    </div>
  );
}

/** A Panel-shaped placeholder: the header band and a few rows, still. */
export function SkeletonPanel({ rows = 4, className = "" }: { rows?: number; className?: string }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className={`flex flex-col border border-rule bg-surface ${className}`}
    >
      <div className="flex h-9 items-center border-b border-rule px-3">
        <div className="h-3 w-32 bg-fill" />
      </div>
      <div className="space-y-2 p-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-5 bg-inset" style={{ width: `${100 - (i % 3) * 12}%` }} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// States. Error, warning, note and info each have one look; an error names the
// thing and the fix, and the fix is usually a Retry beside it.

type BannerTone = "error" | "warn" | "note" | "info";

const BANNER: Record<BannerTone, { box: string; icon: ReactNode }> = {
  error: { box: "border-danger-edge bg-danger-tint text-danger", icon: <IconCritical /> },
  warn: { box: "border-status-warn-edge bg-status-warn-fill text-status-warn-ink", icon: <IconWarn /> },
  note: { box: "border-rule bg-inset text-ink-2", icon: <IconInfo /> },
  info: { box: "border-info-edge bg-info-tint text-info", icon: <IconInfo /> },
};

export function Banner({
  tone = "error",
  children,
  action,
  className = "",
}: {
  tone?: BannerTone;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const b = BANNER[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`reveal flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-sm border px-3 py-2 text-sm ${b.box} ${className}`}
    >
      <span className="shrink-0">{b.icon}</span>
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

/** The centred one-line state for a whole page: not permitted, not found,
 *  unreachable. One sentence and one way out. */
export function CenterMessage({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-base">{children}</p>
      {action ?? (
        <Link href="/" className="link-quiet text-sm">
          Dashboard
        </Link>
      )}
    </div>
  );
}

export function NotPermitted() {
  return <CenterMessage>Not permitted at this access level.</CenterMessage>;
}

/** An empty list or panel: the fact, in eight words or fewer, and an action. */
export function EmptyState({
  children,
  action,
  className = "",
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-2 px-3 py-6 text-center ${className}`}>
      <p className="text-sm text-mute">{children}</p>
      {action}
    </div>
  );
}

export function TlpBadge({ tlp }: { tlp: Tlp }) {
  const dark = tlp === "RED" || tlp === "AMBER+STRICT";
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-sm px-1.5 font-mono text-2xs ${
        dark
          ? "bg-cpx-red text-white"
          : tlp === "AMBER"
            ? "bg-status-warn-fill text-status-warn-ink"
            : tlp === "GREEN"
              ? "bg-cpx-green-800 text-white"
              : "bg-fill text-mute"
      }`}
    >
      TLP:{tlp}
    </span>
  );
}

// A defanged observable: inert, never an anchor, never prefetched.
export function IndicatorChip({ value }: { value: string }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-sm bg-inset px-1.5 py-0.5 font-mono text-xs text-mute break-all">
      {defang(value)}
    </span>
  );
}

// Inert URL rendering for the source inventory. Plain text, always defanged.
export function InertUrl({ url }: { url: string }) {
  return (
    <span className="font-mono text-2xs text-mute break-all">
      {defang(url)}
    </span>
  );
}

/**
 * A tooltip on hover or keyboard focus, after 300ms so sweeping across a
 * table does not flicker them open. The trigger keeps its own accessible
 * name; this adds the detail sighted pointer users would otherwise miss.
 */
export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  className = "",
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  align?: "center" | "start" | "end";
  className?: string;
}) {
  const pos =
    align === "start"
      ? "left-0"
      : align === "end"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";
  return (
    <span className={`group relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`tip absolute z-40 ${pos} ${
          side === "top" ? "bottom-full mb-1.5 origin-bottom" : "top-full mt-1.5 origin-top"
        } w-max max-w-64 rounded-sm bg-brand px-2 py-1 text-left font-sans text-2xs font-medium normal-case leading-4 tracking-normal whitespace-normal text-white shadow-pop`}
      >
        {content}
      </span>
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
      <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-mute" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`${inputClass} pl-8 pr-2.5`}
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
    <div className="flex flex-wrap items-center gap-2 text-xs text-mute">
      <span className="whitespace-nowrap">
        Showing <span className="font-medium text-ink tabular-nums">{shown}</span> of{" "}
        <span className="font-medium text-ink tabular-nums">{total}</span>
      </span>
      <span className="text-ghost" aria-hidden>
        ·
      </span>
      <span className="whitespace-nowrap">{sort}</span>
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

// ---------------------------------------------------------------------------
// Selection indicators. One element slides to the selected option instead of
// each option drawing its own, so the eye follows the change (180ms). The
// measurement re-runs when the selection or the container's size changes.

function useIndicator<T extends HTMLElement>(selected: string) {
  const ref = useRef<T>(null);
  const [box, setBox] = useState<{ x: number; w: number; cw: number } | null>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measure = () => {
      const el = root.querySelector<HTMLElement>('[data-selected="true"]');
      setBox(el ? { x: el.offsetLeft, w: el.offsetWidth, cw: root.scrollWidth } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [selected]);
  return [ref, box] as const;
}

// Tab ids are derived from one base so a tab and its panel can name each
// other from two different components: `<Tabs id="collection" …>` and
// `<div {...tabPanelProps("collection", tab)}>`.
export const tabId = (base: string, key: string) => `${base}-tab-${key}`;
export function tabPanelProps(base: string, key: string) {
  return {
    role: "tabpanel" as const,
    id: `${base}-panel-${key}`,
    "aria-labelledby": tabId(base, key),
  };
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  id,
  className = "",
}: {
  tabs: { key: T; label: string; count?: number }[];
  value: T;
  onChange: (t: T) => void;
  label?: string;
  /** Base for the tab and panel ids. Pass one when the panels use tabPanelProps. */
  id?: string;
  className?: string;
}) {
  const auto = useId();
  const base = id ?? auto;
  const [ref, box] = useIndicator<HTMLDivElement>(value);

  // Roving focus: one tab stop for the list, arrows move between tabs and
  // select as they go, Home and End jump. Standard tablist keyboard model.
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const keys = tabs.map((t) => t.key);
    const i = keys.indexOf(value);
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (i + 1) % keys.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + keys.length) % keys.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = keys.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(keys[next]);
    document.getElementById(tabId(base, keys[next]))?.focus();
  };

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`relative flex items-end gap-0.5 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-rule)] ${className}`}
    >
      {tabs.map((t) => {
        const selected = value === t.key;
        return (
          <button
            key={t.key}
            id={tabId(base, t.key)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${base}-panel-${t.key}`}
            data-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.key)}
            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-t-sm px-2.5 text-sm font-medium transition-colors duration-150 ${
              selected
                ? "text-accent"
                : "text-mute hover:bg-inset hover:text-accent"
            }`}
          >
            {t.label}
            {t.count !== undefined && <CountBadge n={t.count} />}
          </button>
        );
      })}
      {box && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-px origin-left bg-cpx-green transition-[translate,scale] duration-200 ease-out-quart"
          style={{ translate: `${box.x}px 0`, scale: `${box.w} 1` }}
        />
      )}
    </div>
  );
}

/**
 * A small set of mutually exclusive options (a period, a mode). The selected
 * segment is a Dark Purple block revealed by clip-path, so the text colour
 * crosses over with the block instead of snapping (Emil's clip-path tabs).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const [ref, box] = useIndicator<HTMLDivElement>(value);
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const keys = options.map((o) => o.key);
    const i = keys.indexOf(value);
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % keys.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + keys.length) % keys.length;
    if (next === null) return;
    e.preventDefault();
    onChange(keys[next]);
    (ref.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next])?.focus();
  };
  const segment = "flex h-full items-center px-2.5 text-xs font-medium whitespace-nowrap";
  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="relative inline-flex h-7 shrink-0 items-stretch rounded-sm border border-rule bg-surface p-0.5"
    >
      {options.map((o) => {
        const selected = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={selected}
            data-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.key)}
            className={`${segment} rounded-sm text-mute transition-colors duration-150 hover:text-accent`}
          >
            {o.label}
          </button>
        );
      })}
      {box && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0.5 flex items-stretch overflow-hidden rounded-sm bg-brand transition-[clip-path] duration-200 ease-out-quart"
          style={{
            clipPath: `inset(0 ${Math.max(0, box.cw - box.x - box.w - 2)}px 0 ${Math.max(0, box.x - 2)}px round 3px)`,
          }}
        >
          {options.map((o) => (
            <span key={o.key} className={`${segment} text-white`}>
              {o.label}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The KPI cell. The dashboard lays several in one StatStrip rather than as a
// row of separate cards: one bordered bar, hairline dividers, 64px tall.
//
// A value that changed since the previous refresh washes green once
// (`changed`): the figure says what moved without a delta the backend does
// not send. Null is a measurement nobody recorded, and says so.

export type StatTone = "neutral" | "critical" | "high" | "warn" | "good";

const STAT_INK: Record<StatTone, string> = {
  neutral: "text-ink",
  critical: "text-danger",
  high: "text-danger",
  warn: "text-status-warn-ink",
  good: "text-green-contrast",
};

const STAT_PIP: Record<StatTone, string | null> = {
  neutral: null,
  critical: "var(--color-sev-critical)",
  high: "var(--color-sev-high)",
  warn: "var(--color-cpx-bright)",
  good: "var(--color-green-contrast)",
};

export function Stat({
  label,
  value,
  caption,
  href,
  tone = "neutral",
  size = "md",
}: {
  label: string;
  value: number | string | null;
  caption?: ReactNode;
  href?: string;
  tone?: StatTone;
  /** "sm" for figures that sit under a headline strip, so they never compete with it. */
  size?: "sm" | "md";
}) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setFlash((n) => n + 1);
    }
  }, [value]);

  const pip = STAT_PIP[tone];
  const shown =
    value === null ? null : typeof value === "number" ? value.toLocaleString("en-GB") : value;
  const body = (
    <>
      <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-ink-3">
        {pip && <span aria-hidden className="inline-block h-2 w-2 shrink-0" style={{ background: pip }} />}
        <span className="truncate" title={label}>
          {label}
        </span>
      </span>
      {shown === null ? (
        <span
          className={`mt-1 block text-sm font-medium text-mute ${size === "sm" ? "leading-6" : "leading-7"}`}
        >
          Not recorded
        </span>
      ) : (
        <span
          className={`mt-1 block truncate font-display font-semibold tracking-tightish tabular-nums ${size === "sm" ? "text-lg leading-6" : "text-xl leading-7"} ${STAT_INK[tone]}`}
        >
          {shown}
        </span>
      )}
      {caption && <span className="mt-0.5 block truncate text-2xs text-mute">{caption}</span>}
    </>
  );
  const cell = `relative block min-w-0 bg-surface px-3 ${size === "sm" ? "py-2" : "py-2.5"} ${flash ? "changed" : ""}`;
  return href ? (
    <Link key={flash} href={href} className={`${cell} row-link group/stat`}>
      {body}
      <IconChevronRight className="lean absolute bottom-2.5 right-2 text-ghost opacity-0 transition-opacity duration-150 group-hover/stat:opacity-100 group-focus-visible/stat:opacity-100" />
    </Link>
  ) : (
    <div key={flash} className={cell}>
      {body}
    </div>
  );
}

/** Stats in one bordered bar. Dividers are the 1px gap over the hairline
 *  colour, so they stay right however the grid wraps. Pass the column
 *  classes: `grid-cols-2 @3xl/page:grid-cols-4`, and so on. */
export function StatStrip({
  children,
  className = "",
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <section
      aria-label={label}
      className={`grid gap-px overflow-hidden border border-rule bg-fill ${className}`}
    >
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Small shared pieces. Each of these replaced three or more identical private
// copies; keep them here so a restyle lands once.

/** A selectable filter chip. Selected is green, the console's selection colour. */
export function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-sm border px-2.5 text-xs transition-colors duration-150 enabled:active:scale-[0.97] ${
        active
          ? "border-cpx-green bg-select font-medium text-ink"
          : `border-rule bg-surface hover:border-rule-strong hover:bg-inset ${count === 0 ? "text-mute" : ""}`
      }`}
    >
      {label}
      {count !== undefined && <CountBadge n={count} />}
    </button>
  );
}

/** A label over its value. The console's one label-value pair. */
export function Fact({
  label,
  value,
  title,
  truncate = true,
}: {
  label: string;
  value: ReactNode;
  title?: string;
  truncate?: boolean;
}) {
  return (
    <div className="min-w-0" title={title}>
      <dt className="text-2xs text-mute">{label}</dt>
      <dd className={`text-sm font-medium ${truncate ? "truncate" : ""}`}>{value}</dd>
    </div>
  );
}

/** A labelled section inside a detail pane, with an optional count. */
export function DetailRow({
  label,
  count,
  children,
}: {
  label: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <div className="mt-4 border-t border-rule pt-3">
      <span className="flex items-center gap-2 text-2xs font-medium uppercase tracking-wide text-mute">
        {label}
        {count !== undefined && <CountBadge n={count} />}
      </span>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/** One item in a master list: a 2px green edge and a wash when selected. */
export function MasterListItem({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected || undefined}
      className={`block w-full border-l-2 px-3 py-2 text-left transition-colors duration-150 ${
        selected
          ? "border-cpx-green bg-wash"
          : "border-transparent hover:border-rule-strong hover:bg-inset"
      }`}
    >
      {children}
    </button>
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

// ---------------------------------------------------------------------------
// Menus. A popover with role="menu" promises the menu keyboard model, so this
// is where that model lives: focus moves into the first item on open, the
// arrows walk the items, Home and End jump, Escape or a click outside closes,
// and focus returns to whatever opened it. `ref` goes on the box that holds
// both the trigger and the popover, so a click on the trigger is "inside".

export function useMenu(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useDismiss(ref, onClose, open);
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    const items = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [],
      );
    items()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      const list = items();
      if (list.length === 0) return;
      const i = list.indexOf(document.activeElement as HTMLElement);
      let next: number | null = null;
      if (e.key === "ArrowDown") next = (i + 1) % list.length;
      else if (e.key === "ArrowUp") next = (i - 1 + list.length) % list.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = list.length - 1;
      if (next === null) return;
      e.preventDefault();
      list[next].focus();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener.current?.focus();
    };
  }, [open, onClose]);
  return ref;
}

// ---------------------------------------------------------------------------
// The step rail: a marker per step joined by a line, so a sequence reads as a
// sequence. One drawing for the collection pipeline, the workflow definition
// and any run record, so an analyst learns the grammar once.
//
// Every state is a fact the data already carries. A definition that has not
// run shows every marker pending; nothing here invents progress.

export type StepState =
  | "pending"
  | "running"
  | "completed"
  | "partial"
  | "failed"
  | "awaiting-review";

export interface Step {
  key: string;
  title: ReactNode;
  /** Sits beside the title: an agent chip, a count. */
  aside?: ReactNode;
  /** The state, in words. Colour never carries it alone. */
  stateLabel?: string;
  detail?: ReactNode;
  state: StepState;
}

const MARKER: Record<StepState, string> = {
  pending: "bg-surface ring-rule-strong",
  // In progress is Bright Purple, the CPX "waiting" colour, and it is still,
  // not pulsing (hard rule 4).
  running: "bg-cpx-bright-100 ring-cpx-bright",
  completed: "bg-cpx-green ring-accent",
  partial: "bg-status-warn-fill ring-status-warn-ink",
  failed: "bg-cpx-red ring-cpx-red",
  "awaiting-review": "bg-status-warn-fill ring-status-warn-ink",
};

const STATE_INK: Record<StepState, string> = {
  pending: "text-mute",
  running: "text-status-warn-ink",
  completed: "text-green-contrast",
  partial: "text-status-warn-ink",
  failed: "text-status-warn-ink",
  "awaiting-review": "text-status-warn-ink",
};

export function StepMarker({ state }: { state: StepState }) {
  return (
    <span
      aria-hidden
      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-1 transition-colors duration-200 ${MARKER[state]}`}
    />
  );
}

export function StepRail({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s.key} className="flex gap-3">
            <span className="flex flex-col items-center">
              <StepMarker state={s.state} />
              {!last && <span className="w-px flex-1 bg-fill" />}
            </span>
            <span className={`min-w-0 flex-1 ${last ? "" : "pb-3"}`}>
              <span className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-medium">
                  {i + 1}. {s.title}
                </span>
                {s.aside}
                {s.stateLabel && (
                  <span className={`text-2xs ${STATE_INK[s.state]}`}>{s.stateLabel}</span>
                )}
              </span>
              {s.detail && (
                <span className="mt-0.5 block text-xs text-mute">{s.detail}</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
