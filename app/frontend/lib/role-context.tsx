"use client";

// Dev-only role switching. It changes the view, never the data contract:
// every screen assembles its payload through lib/access.ts from the resolved user.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { ConsoleUser, RoleKey } from "./types";
import { userForRole } from "./fixtures";

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

  const setRole = (r: RoleKey) => {
    sessionStorage.setItem(ROLE_KEY, r);
    setRoleState(r);
  };

  return (
    <RoleContext.Provider value={{ user: userForRole(role), setRole }}>
      {children}
    </RoleContext.Provider>
  );
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
