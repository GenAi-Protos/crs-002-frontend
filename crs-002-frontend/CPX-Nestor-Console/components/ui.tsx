"use client";

// Shared primitives. PageHeader deliberately has no description prop:
// if a screen needs explaining, it is the wrong screen.

import { defang } from "@/lib/defang";
import type { Tlp } from "@/lib/types";
import {
  IconCheck,
  IconCritical,
  IconDash,
  IconSearch,
  IconWarn,
  IconExport,
} from "./icons";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <h1 className="text-[22px] font-medium tracking-tightish">{title}</h1>
      {action}
    </div>
  );
}

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
    idle: { box: "bg-black/5 text-cpx-grey", icon: <IconDash /> },
  };
  const m = map[tone];
  return (
    <span
      className={`inline-flex h-5 items-center gap-1 rounded-[2px] px-1.5 text-[11px] font-normal ${m.box}`}
    >
      {m.icon}
      {label}
    </span>
  );
}

export function TlpBadge({ tlp }: { tlp: Tlp }) {
  const dark = tlp === "RED" || tlp === "AMBER+STRICT";
  return (
    <span
      className={`inline-flex h-5 items-center rounded-[2px] px-1.5 font-mono text-[11px] ${
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
    <span className="inline-flex max-w-full items-center rounded-[2px] bg-black/5 px-1.5 py-0.5 font-mono text-[12px] text-cpx-grey break-all">
      {defang(value)}
    </span>
  );
}

// Inert URL rendering for the source inventory. Plain text, always defanged.
export function InertUrl({ url }: { url: string }) {
  return (
    <span className="font-mono text-[11px] text-cpx-grey/80 break-all">
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-full border border-black/15 bg-white pl-8 pr-3 text-[13px] font-light focus:border-cpx-purple focus:outline-none"
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
}: {
  shown: number;
  total: number;
  sort: string;
  onExport?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 text-[12px] font-light text-cpx-grey">
      <span>
        Showing <span className="font-normal">{shown}</span> of{" "}
        <span className="font-normal">{total}</span>
      </span>
      <span className="text-black/30">·</span>
      <span>{sort}</span>
      {onExport && (
        <button
          onClick={onExport}
          className="ml-1 inline-flex items-center gap-1 border border-black/15 px-2 py-0.5 hover:bg-black/5"
        >
          <IconExport />
          CSV
        </button>
      )}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string; count?: number }[];
  value: T;
  onChange: (t: T) => void;
}) {
  return (
    <div className="flex items-end gap-1 border-b border-black/10">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] ${
            value === t.key
              ? "border-cpx-purple font-medium text-cpx-purple"
              : "border-transparent font-light text-cpx-grey hover:text-cpx-black"
          }`}
        >
          {t.label}
          {t.count !== undefined && (
            <span className="bg-black/5 px-1 text-[11px]">{t.count}</span>
          )}
        </button>
      ))}
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
      <span className="text-[12px] font-light text-cpx-grey">{label}</span>
      <span className="mt-2 text-[30px] font-medium leading-none tracking-tightish">
        {value}
      </span>
      {hint && (
        <span className="mt-2 text-[11px] font-light text-cpx-grey">{hint}</span>
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
