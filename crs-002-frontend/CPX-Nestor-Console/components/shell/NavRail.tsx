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

export function NavRail() {
  const { user } = useConsoleUser();
  const pathname = usePathname();
  const allowed = new Set(destinationsFor(user.role));
  const items = NAV.filter((n) => allowed.has(n.key));

  return (
    <nav className="fixed bottom-0 left-0 top-14 z-30 w-16 border-r border-black/10 bg-white min-[1100px]:w-60">
      <ul className="flex flex-col gap-1 p-2">
        {items.map((n) => {
          const active =
            n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          return (
            <li key={n.key}>
              <Link
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 items-center justify-center gap-3 px-0 text-[14px] min-[1100px]:justify-start min-[1100px]:px-3 ${
                  active
                    ? "bg-cpx-purple font-medium text-white"
                    : "font-light text-cpx-grey hover:bg-black/5"
                }`}
                title={n.label}
              >
                {n.icon}
                <span className="hidden min-[1100px]:inline">{n.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
