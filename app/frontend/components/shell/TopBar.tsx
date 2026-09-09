"use client";

import Image from "next/image";
import { ROLE_LABELS, useConsoleUser } from "@/lib/role-context";
import type { RoleKey } from "@/lib/types";
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

// Light chrome, the same 60px white header as the other CPX consoles. The CPX
// wordmark reads as the parent, the Nestor mark (on its Dark Purple tile, because
// the green chevron is 1.5:1 on white) as the tool.
export function TopBar() {
  const { user, setRole } = useConsoleUser();
  const switcherOn = publicEnv().ROLE_SWITCHER === "true";
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-[60px] items-center gap-3 border-b border-cpx-grey-100 bg-white px-6 text-cpx-black">
      <Image
        src="/cpx-logo-primary.svg"
        alt="CPX"
        width={172}
        height={80}
        className="h-7 w-auto"
        priority
      />
      <span className="h-5 w-px bg-cpx-grey-100" aria-hidden />
      <span className="flex items-center gap-2">
        <Image src="/nestor-mark.svg" alt="" width={24} height={24} aria-hidden />
        <span className="font-display text-base font-bold uppercase tracking-tightish text-cpx-purple">
          Nestor
        </span>
      </span>
      <span className="ml-1 inline-flex h-8 items-center gap-2 rounded-sm border border-cpx-grey-100 bg-white px-2.5 text-xs font-medium text-cpx-grey-500">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-cpx-green" aria-hidden />
        Live
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
          className="h-8 rounded-sm border border-cpx-grey-100 bg-white px-2 text-xs text-cpx-grey-700 focus:border-cpx-green focus:outline-none"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      )}

      <span className="inline-flex h-8 items-center gap-2 rounded-sm border border-cpx-grey-100 bg-white px-2.5 text-xs font-medium">
        <span
          aria-hidden
          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-cpx-purple text-2xs font-medium text-white"
        >
          {initials}
        </span>
        <span className="hidden md:inline">{user.name}</span>
      </span>
    </header>
  );
}
