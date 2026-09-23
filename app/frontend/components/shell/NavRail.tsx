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
  IconSearch,
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
  { key: "investigations", label: "Investigation", href: "/investigations", icon: <IconSearch /> },
  { key: "reports", label: "Reports", href: "/reports", icon: <IconReports /> },
  { key: "clients", label: "Clients", href: "/clients", icon: <IconClients /> },
  { key: "collection", label: "Collection", href: "/collection", icon: <IconCollection /> },
  { key: "manage", label: "Manage", href: "/manage", icon: <IconManage /> },
];

// White rail with a hairline, like the top bar and the other CPX consoles. The
// active destination carries a green wash and a 3px green bar. The rail collapses
// to icons below the `rail` breakpoint (docs/01); the label survives as a title.
export function NavRail() {
  const { user } = useConsoleUser();
  const pathname = usePathname();
  const allowed = new Set(destinationsFor(user.role));
  const items = NAV.filter((n) => allowed.has(n.key));

  return (
    <nav
      aria-label="Primary"
      className="w-16 shrink-0 overflow-y-auto border-r border-cpx-grey-100 bg-white rail:w-44"
    >
      <ul className="flex flex-col gap-1 p-2 rail:p-3">
        {items.map((n) => {
          const active =
            n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          return (
            <li key={n.key}>
              <Link
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-9 items-center justify-center gap-2.5 rounded-sm px-0 text-base transition-colors duration-150 rail:justify-start rail:px-3 ${
                  active
                    ? "bg-cpx-green-50 font-semibold text-cpx-purple"
                    : "text-cpx-grey-500 hover:bg-cpx-grey-50 hover:text-cpx-purple"
                }`}
                title={n.label}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-r-sm bg-cpx-green"
                  />
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
