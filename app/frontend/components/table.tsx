"use client";

// Table primitives. One definition of what a table looks like in this console,
// so a table in Reports and a table on a dashboard cannot drift apart.
//
// Three things are fixed here and nowhere else:
//
//   Alignment.  Header and body cells carry the same horizontal padding and the
//               same alignment, and every table that sets column widths sets
//               them on a <colgroup>. A width on a <th> alone is a hint the
//               browser may ignore, which is how a heading ends up sitting over
//               the wrong column.
//   Spacing.    One header band, one row rhythm, one hover state.
//   Overflow.   Long values wrap or scroll. Nothing is cut off silently: where
//               a cell is clipped on purpose it carries its full text in a
//               tooltip.

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconCopy, IconHistory } from "./icons";

// --- shared classes ----------------------------------------------------------
//
// Header and body padding are the same string on purpose. Changing one without
// the other is the alignment bug this module exists to prevent.

const PAD = "px-3";

/** The scroll container. A table narrower than its content scrolls, never clips. */
export const T_SCROLL = "overflow-x-auto";

export const T_TABLE = "w-full border-collapse";

/** The header row: one rule under it. */
export const T_HEAD = "border-b border-cpx-grey-100 text-left";

/**
 * The header band sits on the cell rather than the row, so a sticky header
 * stays opaque as rows scroll under it. CSD-007 head: grey-50 band, 12px
 * uppercase, semibold, secondary grey.
 */
export const T_TH = `${PAD} bg-cpx-grey-50 py-2 text-xs font-semibold uppercase tracking-wide whitespace-nowrap text-cpx-grey-500`;

/** Row hover is a 40% green-50 wash, the same as every other CPX console. */
export const T_ROW =
  "border-b border-cpx-grey-100 align-top transition-colors hover:bg-cpx-green-50/40";

export const T_TD = `${PAD} py-2 align-top`;

/**
 * Pulls the outer edges flush with the panel that contains it. Panel tables use
 * it; tables inside their own bordered box do not.
 */
export const T_FLUSH = "first:pl-0 last:pr-0";

/** Numeric columns. Applied to the heading and its cells together. */
export const T_NUM = "text-right tabular-nums";

// --- cell contents -----------------------------------------------------------

/**
 * A compact badge for a categorical value: indicator type, report type, rule
 * kind. Short, neutral, and never the only thing carrying meaning.
 */
export function TypeBadge({
  label,
  title,
  tone = "neutral",
}: {
  label: string;
  title?: string;
  tone?: "neutral" | "warn";
}) {
  return (
    <span
      title={title}
      className={`inline-flex h-[18px] max-w-full items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-sm px-1.5 text-2xs font-medium ${
        tone === "warn"
          ? "bg-status-warn-fill text-status-warn-ink"
          : "bg-cpx-grey-100 text-cpx-grey-700"
      }`}
    >
      {label}
    </span>
  );
}

/**
 * Copies exactly what is on screen. Indicators render defanged, so a defanged
 * value is what reaches the clipboard: the clipboard is one more place a live
 * indicator should not arrive by accident.
 */
export function CopyButton({
  value,
  what = "value",
  className = "",
}: {
  value: string;
  what?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = async (e: React.MouseEvent) => {
    // Rows are often clickable. Copying is not navigating.
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard permission refused. The value is still on screen and
      // selectable, so there is nothing worth interrupting the analyst for.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Copied" : `Copy ${what} as shown`}
      aria-label={copied ? "Copied" : `Copy ${what} as shown`}
      className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center text-cpx-grey-500 opacity-45 transition-opacity hover:opacity-100 focus-visible:opacity-100 ${className}`}
    >
      {copied ? (
        <IconCheck className="text-green-contrast" />
      ) : (
        <IconCopy className="scale-90" />
      )}
    </button>
  );
}

/**
 * An indicator, reference or identifier. Monospace, breakable at any character
 * so a 64 character hash wraps inside its column instead of widening the table
 * past the screen.
 */
export function MonoValue({
  value,
  copy = false,
  title,
  what = "value",
  className = "",
}: {
  value: string;
  copy?: boolean;
  title?: string;
  what?: string;
  className?: string;
}) {
  return (
    <span className="flex items-start gap-1.5">
      <span
        title={title}
        className={`min-w-0 break-all font-mono text-2xs leading-[1.5] ${className}`}
      >
        {value}
      </span>
      {copy && <CopyButton value={value} what={what} className="mt-px" />}
    </span>
  );
}

/**
 * A confidence figure. The number is the value; the bar is there to make a
 * column of them comparable at a glance. Fixed width, so every figure in the
 * column starts at the same place as its heading.
 */
export function ConfidenceValue({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  // CSD-007 thresholds: 85 and over green, 70 to 84 blue, under 70 red.
  const fill =
    pct >= 85 ? "bg-cpx-green-500" : pct >= 70 ? "bg-cpx-blue-500" : "bg-cpx-red-500";
  return (
    <span
      className="inline-flex items-center gap-2 whitespace-nowrap"
      title={`Confidence ${pct}%`}
    >
      <span className="w-9 shrink-0 text-right text-xs tabular-nums">
        {pct}%
      </span>
      <span
        aria-hidden
        className="h-1.5 w-10 shrink-0 overflow-hidden rounded-sm bg-cpx-grey-100"
      >
        <span
          className={`block h-full rounded-sm ${fill}`}
          style={{ width: `${pct}%` }}
        />
      </span>
    </span>
  );
}

/**
 * An explanation attached to a column heading, opened from a small icon beside
 * it.
 *
 * It exists for columns whose values are abbreviated on purpose. "Last seen"
 * reads "3 days ago", which is the right thing on the row and the wrong thing
 * when someone needs the timestamp: the popover carries the exact values and
 * says what the column actually measures, without a paragraph on the screen
 * for everyone who already knew.
 */
export function ColumnInfo({
  heading,
  body,
  rows = [],
}: {
  heading: string;
  body: string;
  /** The exact values behind the abbreviated ones. */
  rows?: { label: string; value: string }[];
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={box} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`What ${heading} means`}
        title={`What ${heading} means`}
        className={`ml-1 inline-flex h-[18px] w-[18px] items-center justify-center rounded-sm transition-opacity ${
          open ? "bg-cpx-grey-100 opacity-100" : "opacity-50 hover:opacity-100"
        }`}
      >
        <IconHistory />
      </button>

      {open && (
        <span
          role="dialog"
          aria-label={heading}
          className="absolute left-0 top-6 z-30 block w-[22rem] border border-cpx-grey-100 bg-white p-3 text-left shadow-pop"
        >
          <span className="block text-xs font-medium tracking-tightish">
            {heading}
          </span>
          <span className="mt-1 block text-2xs leading-relaxed text-cpx-grey-500">
            {body}
          </span>
          {rows.length > 0 && (
            <span className="mt-2 block border-t border-cpx-grey-100 pt-2">
              {rows.map((r) => (
                <span
                  key={r.label + r.value}
                  className="flex items-baseline justify-between gap-3 py-0.5 text-2xs"
                >
                  <span className="min-w-0 truncate" title={r.label}>
                    {r.label}
                  </span>
                  <span className="shrink-0 whitespace-nowrap tabular-nums">
                    {r.value}
                  </span>
                </span>
              ))}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

/**
 * A cell that is clipped to one line on purpose. The full text is always in the
 * tooltip, so nothing is lost, only folded.
 */
export function Clipped({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return (
    <span className={`block truncate ${className}`} title={text}>
      {text}
    </span>
  );
}
