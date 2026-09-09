"use client";

import Image from "next/image";
import { ROLE_LABELS, useConsoleUser } from "@/lib/role-context";
import type { RoleKey } from "@/lib/types";
import { NestorMarkReverse } from "./NestorMark";
import { GlobalSearch } from "./GlobalSearch";
import { publicEnv } from "@/lib/runtime-env";

const ROLES: RoleKey[] = [
  "analyst",
  "lead-analyst",
  "incident-responder",
  "leadership",
  "executive",
  "sales",
];

export function TopBar() {
  const { user, setRole } = useConsoleUser();
  const switcherOn = publicEnv().ROLE_SWITCHER === "true";

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-4 bg-cpx-purple px-4 text-white">
      <Image
        src="/cpx-logo-reverse.svg"
        alt="CPX"
        width={172}
        height={80}
        className="h-7 w-auto"
        priority
      />
      <span className="h-6 w-px bg-white/20" aria-hidden />
      <span className="flex items-center gap-2">
        <NestorMarkReverse size={24} />
        <span className="font-display text-md font-bold uppercase tracking-tightish">
          Nestor
        </span>
        <span className="ml-1 flex items-center gap-1.5 text-2xs text-white/70">
          <span className="inline-block h-2 w-2 bg-cpx-green ring-1 ring-cpx-purple" aria-hidden />
          Live
        </span>
      </span>

      <div className="flex-1" />

      {/* Global search. Every role gets it: what comes back is filtered in the
          payload, so the box does not need a role check of its own. */}
      <GlobalSearch />

      {switcherOn && (
        <select
          value={user.role}
          onChange={(e) => setRole(e.target.value as RoleKey)}
          aria-label="Role"
          className="h-8 border border-white/20 bg-cpx-purple px-2 text-xs text-white focus:border-cpx-green focus:outline-none focus-visible:outline-cpx-green"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      )}

      <span className="flex h-8 w-8 items-center justify-center bg-cpx-bright text-xs font-medium">
        {user.name
          .split(" ")
          .map((p) => p[0])
          .slice(0, 2)
          .join("")}
      </span>
    </header>
  );
}
