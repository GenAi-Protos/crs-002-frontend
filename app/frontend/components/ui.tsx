"use client";

// Shared primitives. PageHeader deliberately has no description prop:
// if a screen needs explaining, it is the wrong screen.

import Link from "next/link";
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
        <h1 className="text-xl font-semibold tracking-tightish">{title}</h1>
        {meta}
      </div>
      {action}
    </div>
  );
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
    "border border-cpx-grey-100 bg-white font-medium hover:bg-cpx-grey-50 disabled:opacity-50 disabled:hover:bg-white",
  ghost:
    "text-cpx-grey-500 hover:bg-cpx-grey-50 hover:text-cpx-purple disabled:opacity-50 disabled:hover:bg-transparent",
  // Accent Red text is 3.2:1 on white, so destructive actions carry red-700.
  danger:
    "border border-cpx-red-200 bg-white font-medium text-cpx-red-700 hover:bg-cpx-red-50 disabled:opacity-50 disabled:hover:bg-white",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  md: "h-8 px-3 text-base",
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
      className={`m-auto w-full max-w-md border border-cpx-grey-100 bg-white p-0 text-cpx-black shadow-pop ${className}`}
    >
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={id} className="text-md font-semibold tracking-tightish">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center text-cpx-grey-400 hover:bg-cpx-grey-50 hover:text-cpx-black"
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
      className={`fixed bottom-0 left-auto right-0 top-[60px] m-0 h-auto max-h-none w-[480px] max-w-full overflow-y-auto border-l border-cpx-grey-100 bg-white p-0 text-cpx-black shadow-xl ${className}`}
    >
      <div className="flex items-center justify-between gap-4 border-b border-cpx-grey-100 px-5 py-3">
        <div id={id} className="min-w-0">
          {title}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-7 w-7 shrink-0 items-center justify-center text-cpx-grey-400 hover:bg-cpx-grey-50 hover:text-cpx-black"
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
// Soft tinted pills, the CSD-007 ladder: green good, bright purple needs
// attention, red critical, grey nothing yet.
export function StatusPill({ tone, label }: { tone: StatusTone; label: string }) {
  const map: Record<StatusTone, { box: string; icon: ReactNode }> = {
    good: {
      box: "border-cpx-green-200 bg-cpx-green-50 text-cpx-green-800",
      icon: <IconCheck />,
    },
    warn: {
      box: "border-cpx-bright-200 bg-cpx-bright-50 text-cpx-bright-700",
      icon: <IconWarn />,
    },
    critical: {
      box: "border-cpx-red-200 bg-cpx-red-100 text-cpx-red-700",
      icon: <IconCritical />,
    },
    idle: {
      box: "border-cpx-grey-300 bg-cpx-grey-200 text-cpx-grey-700",
      icon: <IconDash />,
    },
  };
  const m = map[tone];
  return (
    <span
      className={`inline-flex h-5 items-center gap-1 rounded-sm border px-1.5 text-2xs font-medium ${m.box}`}
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
    <span className="inline-flex h-5 items-center gap-1 rounded-sm border border-cpx-blue-100 bg-cpx-blue-50 px-1.5 text-2xs font-medium text-cpx-blue-700">
      <IconWarn />
      Demonstration data. Backend unreachable.
    </span>
  );
}

// Loading at final geometry, no motion: hard rule 4 bans the pulse.
export function SkeletonRows({ rows = 6, className = "" }: { rows?: number; className?: string }) {
  return (
    <div aria-busy="true" aria-label="Loading" className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-8 bg-cpx-grey-100" style={{ width: `${100 - (i % 3) * 8}%` }} />
      ))}
    </div>
  );
}

export function TlpBadge({ tlp }: { tlp: Tlp }) {
  const dark = tlp === "RED" || tlp === "AMBER+STRICT";
  return (
    <span
      className={`inline-flex h-5 items-center rounded-sm px-1.5 font-mono text-2xs ${
        dark
          ? "bg-cpx-red text-white"
          : tlp === "AMBER"
            ? "bg-status-warn-fill text-status-warn-ink"
            : tlp === "GREEN"
              ? "bg-green-contrast text-white"
              : "bg-cpx-grey-100 text-cpx-grey-500"
      }`}
    >
      TLP:{tlp}
    </span>
  );
}

// A defanged observable: inert, never an anchor, never prefetched.
export function IndicatorChip({ value }: { value: string }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-sm bg-cpx-grey-50 px-1.5 py-0.5 font-mono text-xs text-cpx-grey-500 break-all">
      {defang(value)}
    </span>
  );
}

// Inert URL rendering for the source inventory. Plain text, always defanged.
export function InertUrl({ url }: { url: string }) {
  return (
    <span className="font-mono text-2xs text-cpx-grey-500 break-all">
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
      <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cpx-grey-500" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 w-full rounded-sm border border-cpx-grey-100 bg-white pl-8 pr-3 text-sm focus:border-cpx-green focus:outline-none"
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
    <div className="flex flex-wrap items-center gap-3 text-xs text-cpx-grey-500">
      <span>
        Showing <span className="font-medium text-cpx-black">{shown}</span> of{" "}
        <span className="font-medium text-cpx-black">{total}</span>
      </span>
      <span className="text-cpx-grey-400">·</span>
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
    <div role="tablist" aria-label={label} className="flex items-end gap-1 border-b border-cpx-grey-100">
      {tabs.map((t) => {
        const selected = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(t.key)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-base ${
              selected
                ? "border-cpx-green font-semibold text-cpx-purple"
                : "border-transparent text-cpx-grey-500 hover:text-cpx-purple"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="rounded-sm bg-cpx-grey-100 px-1 text-2xs text-cpx-grey-700">{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The KPI card. One definition for every dashboard: both of them used to carry
// a byte-identical private copy.
//
// The card answers three questions in reading order: what is counted, how many,
// and whether that is going the wrong way. The change is a chip rather than a
// sentence, because a sentence in colour reads as a link, and it carries an
// arrow and a word as well as a colour: colour never says anything on its own.

export interface KpiCardProps {
  label: string;
  value: number;
  /** What the number counts, in the analyst's words. */
  unit: string;
  /** The period the number covers, where it has one. */
  window?: string;
  /** Prior-period value. No previous, no chip: a change is never inferred. */
  previous?: number;
  /** True where an increase is bad. Decides which direction reads as worse. */
  higherIsWorse?: boolean;
  href?: string;
}

export function KpiCard({
  label,
  value,
  unit,
  window,
  previous,
  higherIsWorse,
  href,
}: KpiCardProps) {
  const delta = previous === undefined ? null : value - previous;
  const worse =
    delta === null || delta === 0 ? false : higherIsWorse ? delta > 0 : delta < 0;
  const better = delta !== null && delta !== 0 && !worse;

  // The accent carries the same judgement as the chip, so the card can be read
  // from the edge of the eye. Flat, or no prior period, stays neutral.
  const accent = worse
    ? "border-l-cpx-red-400"
    : better
      ? "border-l-cpx-green"
      : "border-l-cpx-grey-300";

  const chipTone = worse
    ? "bg-cpx-red-50 text-cpx-red-700"
    : better
      ? "bg-cpx-green-50 text-cpx-green-800"
      : "bg-cpx-grey-50 text-cpx-grey-700";

  const sentence =
    delta === null
      ? undefined
      : delta === 0
        ? "unchanged on the previous period"
        : `${delta > 0 ? "up" : "down"} ${Math.abs(delta).toLocaleString(
            "en-GB",
          )} on the previous period`;

  const body = (
    <div
      className={`flex h-full min-h-[100px] flex-col justify-between border border-l-4 border-cpx-grey-100 bg-white p-4 transition-colors ${accent} ${
        href ? "hover:border-cpx-green-200 hover:bg-cpx-green-50/40" : ""
      }`}
    >
      <span className="text-2xs font-medium uppercase tracking-wide text-cpx-grey-500">
        {label}
      </span>
      <span className="mt-2 flex flex-wrap items-baseline gap-2">
        <span className="font-display text-2xl font-semibold leading-none tracking-tightish tabular-nums">
          {value.toLocaleString("en-GB")}
        </span>
        {delta !== null && (
          <span
            title={sentence}
            className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-2xs font-medium tabular-nums ${chipTone}`}
          >
            {delta === 0 ? (
              "no change"
            ) : (
              <>
                <span aria-hidden>{delta > 0 ? "↑" : "↓"}</span>
                {Math.abs(delta).toLocaleString("en-GB")}{" "}
                {delta > 0 ? "more" : "fewer"}
              </>
            )}
          </span>
        )}
      </span>
      <span className="mt-2 text-xs text-cpx-grey-500">
        {unit}
        {window && <> · {window}</>}
      </span>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
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
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-7 items-center gap-1.5 border px-2.5 text-xs ${
        active
          ? "border-cpx-green bg-cpx-green-50 font-medium text-cpx-black"
          : `border-cpx-grey-100 hover:bg-cpx-grey-50 ${count === 0 ? "text-cpx-grey-500" : ""}`
      }`}
    >
      {label}
      {count !== undefined && (
        <span
          className={`px-1 text-2xs ${active ? "bg-cpx-green-100" : "bg-cpx-grey-50"}`}
        >
          {count}
        </span>
      )}
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
      <dt className="text-2xs text-cpx-grey-500">{label}</dt>
      <dd className={`font-medium ${truncate ? "truncate" : ""}`}>{value}</dd>
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
    <div className="mt-5 border-t border-cpx-grey-100 pt-4">
      <span className="flex items-baseline gap-2 text-xs text-cpx-grey-500">
        {label}
        {count !== undefined && (
          <span className="bg-cpx-grey-50 px-1 text-2xs text-cpx-black">{count}</span>
        )}
      </span>
      <div className="mt-2">{children}</div>
    </div>
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
