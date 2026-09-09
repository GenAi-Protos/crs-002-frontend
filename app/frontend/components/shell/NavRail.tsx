"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useConsoleUser } from "@/lib/role-context";
import { destinationsFor, type Destination } from "@/lib/access";
import {
  IconClients,
  IconCollection,
  IconManage,
  IconDashboard,
  IconIntelligence,
  IconReports,
} from "@/components/icons";
import type { ReactNode } from "react";

const NAV: {
  key: Destination;
  label: string;
  href: string;
  icon: ReactNode;
}[] = [
  { key: "dashboard", label: "Dashboard", href: "/", icon: <IconDashboard /> },
  { key: "intelligence", label: "Intelligence", href: "/intelligence", icon: <IconIntelligence /> },
  { key: "reports", label: "Reports", href: "/reports", icon: <IconReports /> },
  { key: "clients", label: "Clients", href: "/clients", icon: <IconClients /> },
  { key: "collection", label: "Collection", href: "/collection", icon: <IconCollection /> },
  { key: "manage", label: "Manage", href: "/manage", icon: <IconManage /> },
];

// Dark Purple chrome, like the top bar. The rail collapses to icons below the
// `rail` breakpoint (docs/01); the label survives as a title for the tooltip.
export function NavRail() {
  const { user } = useConsoleUser();
  const pathname = usePathname();
  const allowed = new Set(destinationsFor(user.role));
  const items = NAV.filter((n) => allowed.has(n.key));

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 top-14 z-30 w-16 bg-cpx-purple rail:w-60"
    >
      <ul className="flex flex-col gap-1 p-2">
        {items.map((n) => {
          const active =
            n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          return (
            <li key={n.key}>
              <Link
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-10 items-center justify-center gap-3 px-0 text-base focus-visible:outline-cpx-green rail:justify-start rail:px-3 ${
                  active
                    ? "bg-white/10 font-medium text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
                title={n.label}
              >
                {active && (
                  <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-cpx-green" />
                )}
                {n.icon}
                <span className="hidden rail:inline">{n.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
