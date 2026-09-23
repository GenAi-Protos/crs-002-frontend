"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ROLE_LABELS, useConsoleUser } from "@/lib/role-context";
import type { RoleKey } from "@/lib/types";
import { GlobalSearch } from "./GlobalSearch";
import { publicEnv } from "@/lib/runtime-env";
import { getHealth } from "@/lib/api";

const ROLES: RoleKey[] = [
  "analyst",
  "lead-analyst",
  "incident-responder",
  "leadership",
  "executive",
  "sales",
];

type Backend = "checking" | "live" | "unreachable";

// The chip says what the backend is doing, not what we hope it is doing: it
// used to read "Live" as decoration, on the same screen as the demonstration
// data notice. One check on mount and one each time the tab comes back into
// view, which is when a long-lived Teams tab is most likely to be stale.
function useBackend(): Backend {
  const [backend, setBackend] = useState<Backend>("checking");
  useEffect(() => {
    let live = true;
    const check = () =>
      getHealth()
        .then((h) => live && setBackend(h.status === "ok" ? "live" : "unreachable"))
        .catch(() => live && setBackend("unreachable"));
    check();
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return backend;
}

const BACKEND_LABEL: Record<Backend, string> = {
  checking: "Checking",
  live: "Live",
  unreachable: "Unreachable",
};

// Light chrome, the CPX white header at Teams-tab height: 48px, because the
// Teams app bar and tab strip already sit above it (docs/03, Shell). The CPX
// wordmark reads as the parent, the Nestor mark as the tool.
export function TopBar() {
  const { user, setRole } = useConsoleUser();
  const backend = useBackend();
  const switcherOn = publicEnv().ROLE_SWITCHER === "true";
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <header className="z-40 flex h-12 shrink-0 items-center gap-2 border-b border-cpx-grey-100 bg-white px-3 text-cpx-black sm:gap-2.5 sm:px-4">
      <Image
        src="/cpx-logo-primary.svg"
        alt="CPX"
        width={172}
        height={80}
        className="h-6 w-auto"
        priority
      />
      <span className="h-4 w-px bg-cpx-grey-200" aria-hidden />
      <span className="flex items-center gap-1.5">
        <Image src="/nestor-mark.svg" alt="" width={20} height={20} aria-hidden />
        <span className="hidden font-display text-sm font-bold uppercase tracking-tightish text-cpx-purple sm:inline">
          Nestor
        </span>
      </span>
      {/* Colour and word together: green only ever appears beside a label. */}
      <span
        role="status"
        title={backend === "live" ? "Backend reachable" : "Backend not reachable"}
        className={`ml-1 inline-flex h-6 items-center gap-1.5 rounded-sm border px-2 text-2xs font-medium transition-colors duration-200 ${
          backend === "unreachable"
            ? "border-cpx-red-200 bg-cpx-red-50 text-cpx-red-700"
            : "border-cpx-grey-100 bg-white text-cpx-grey-500"
        }`}
      >
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full transition-colors duration-200 ${
            backend === "live"
              ? "bg-cpx-green"
              : backend === "unreachable"
                ? "bg-cpx-red"
                : "bg-cpx-grey-400"
          }`}
          aria-hidden
        />
        {BACKEND_LABEL[backend]}
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
          className="h-7 rounded-sm border border-cpx-grey-100 bg-white px-1.5 text-xs text-cpx-grey-700 transition-colors duration-150 hover:border-cpx-grey-200 focus:border-cpx-green focus:outline-none"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      )}

      <span
        title={`${user.name} · ${ROLE_LABELS[user.role]}`}
        className="inline-flex h-7 items-center gap-2 rounded-sm px-1 text-xs font-medium xl:border xl:border-cpx-grey-100 xl:px-2"
      >
        <span
          aria-hidden
          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-cpx-purple text-2xs font-medium text-white"
        >
          {initials}
        </span>
        <span className="hidden xl:inline">{user.name}</span>
      </span>
    </header>
  );
}
