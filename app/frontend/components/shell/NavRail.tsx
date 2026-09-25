"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useConsoleUser } from "@/lib/role-context";
import { destinationsFor, type Destination } from "@/lib/access";
import {
  IconCase,
  IconClients,
  IconCollection,
  IconManage,
  IconDashboard,
  IconIntelligence,
  IconPanel,
  IconReports,
} from "@/components/icons";

const NAV: {
  key: Destination;
  label: string;
  href: string;
  icon: ReactNode;
}[] = [
  { key: "dashboard", label: "Dashboard", href: "/", icon: <IconDashboard /> },
  { key: "intelligence", label: "Intelligence", href: "/intelligence", icon: <IconIntelligence /> },
  { key: "investigations", label: "Investigations", href: "/investigations", icon: <IconCase /> },
  { key: "reports", label: "Reports", href: "/reports", icon: <IconReports /> },
  { key: "clients", label: "Clients", href: "/clients", icon: <IconClients /> },
  { key: "collection", label: "Collection", href: "/collection", icon: <IconCollection /> },
  { key: "manage", label: "Manage", href: "/manage", icon: <IconManage /> },
];

// Item geometry, shared by the list (h-8, gap-1) and the sliding marker.
// Change one, change the marker maths with it.
const ROW = 32;
const GAP = 4;

const STORE = "nestor:rail";

// White rail with a hairline, like the top bar. The active destination sits on
// a green wash with a 3px green bar; the bar is one element that slides to the
// new item on navigation (200ms), so the eye follows the move instead of
// finding the new position. Below the `rail` breakpoint (1280px) the rail is
// icons only; the analyst can pin it either way, remembered in this browser.
export function NavRail() {
  const { user } = useConsoleUser();
  const pathname = usePathname();
  const allowed = new Set(destinationsFor(user.role));
  const items = NAV.filter((n) => allowed.has(n.key));
  const activeIndex = items.findIndex((n) =>
    n.href === "/" ? pathname === "/" : pathname.startsWith(n.href),
  );

  // null follows the breakpoint; true or false is the analyst's pin.
  const [pinned, setPinned] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const v = localStorage.getItem(STORE);
      if (v === "open" || v === "closed") setPinned(v === "open");
    } catch {
      // Storage blocked (Teams private mode, policy): the breakpoint decides.
    }
  }, []);

  const toggle = () => {
    const open =
      pinned ?? window.matchMedia("(min-width: 1280px)").matches;
    const next = !open;
    setPinned(next);
    try {
      localStorage.setItem(STORE, next ? "open" : "closed");
    } catch {
      // Not remembered; still applied for this visit.
    }
  };

  const width = pinned === null ? "w-14 rail:w-44" : pinned ? "w-44" : "w-14";
  const label =
    pinned === null ? "sr-only rail:not-sr-only rail:label-in" : pinned ? "label-in" : "sr-only";
  const align =
    pinned === null
      ? "justify-center rail:justify-start rail:px-2.5"
      : pinned
        ? "justify-start px-2.5"
        : "justify-center";

  return (
    <nav
      aria-label="Primary"
      className={`flex shrink-0 flex-col overflow-y-auto border-r border-rule bg-surface ${width}`}
    >
      <ul className="relative flex flex-col gap-1 p-2">
        {activeIndex >= 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-2 top-2 h-5 w-[3px] rounded-r-sm bg-cpx-green transition-[translate] duration-200 ease-out-quart"
            style={{ translate: `0 ${activeIndex * (ROW + GAP) + (ROW - 20) / 2}px` }}
          />
        )}
        {items.map((n, i) => {
          const active = i === activeIndex;
          return (
            <li key={n.key}>
              <Link
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-8 items-center gap-2.5 rounded-sm text-sm transition-colors duration-150 ${align} ${
                  active
                    ? "bg-select font-semibold text-accent"
                    : "text-mute hover:bg-inset hover:text-accent"
                }`}
                title={n.label}
              >
                {n.icon}
                <span className={label}>{n.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto border-t border-rule p-2">
        <button
          type="button"
          onClick={toggle}
          aria-label="Toggle navigation labels"
          title="Toggle navigation labels"
          className={`flex h-8 w-full items-center gap-2.5 rounded-sm text-xs text-mute transition-colors duration-150 hover:bg-inset hover:text-accent ${align}`}
        >
          <IconPanel />
          <span className={label}>Collapse</span>
        </button>
      </div>
    </nav>
  );
}
