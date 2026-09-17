"use client";

// Dev-only role switching. It changes the view, never the data contract:
// every screen assembles its payload through lib/access.ts from the resolved user.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ConsoleUser, RoleKey } from "./types";
// lib/users.ts, not lib/fixtures.ts: this provider wraps every route, and the
// fixture module would drag the whole fixture set into the shared chunk.
import { userForRole } from "./users";

const ROLE_KEY = "nestor-role";

const RoleContext = createContext<{
  user: ConsoleUser;
  setRole: (r: RoleKey) => void;
}>({ user: userForRole("analyst"), setRole: () => {} });

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<RoleKey>("analyst");

  useEffect(() => {
    const stored = sessionStorage.getItem(ROLE_KEY) as RoleKey | null;
    if (stored) setRoleState(stored);
  }, []);

  const setRole = useCallback((r: RoleKey) => {
    sessionStorage.setItem(ROLE_KEY, r);
    setRoleState(r);
  }, []);

  // A stable value, so consumers only re-render when the role actually changes
  // and setRole is safe in a dependency list.
  const value = useMemo(() => ({ user: userForRole(role), setRole }), [role, setRole]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useConsoleUser() {
  return useContext(RoleContext);
}

export const ROLE_LABELS: Record<RoleKey, string> = {
  analyst: "TI Analyst",
  "lead-analyst": "Lead Analyst",
  "incident-responder": "Incident Responder",
  leadership: "CRS Leadership",
  executive: "CEO",
  sales: "Sales",
};
