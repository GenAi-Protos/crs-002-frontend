// The single access predicate. Role filtering happens in the payload, never the DOM.

import type { Advisory, ConsoleUser, RoleKey } from "./types";

export type Destination =
  | "dashboard"
  | "intelligence"
  | "investigations"
  | "reports"
  | "clients"
  | "collection"
  | "manage";

const DESTINATIONS: Record<RoleKey, Destination[]> = {
  analyst: ["dashboard", "intelligence", "investigations", "reports", "collection", "manage"],
  "lead-analyst": ["dashboard", "intelligence", "investigations", "reports", "clients", "collection", "manage"],
  "incident-responder": ["dashboard", "intelligence", "investigations", "reports", "manage"],
  leadership: ["dashboard", "reports"],
  executive: ["dashboard"],
  sales: ["dashboard", "reports"],
};

export function destinationsFor(role: RoleKey): Destination[] {
  return DESTINATIONS[role];
}

export function canSee(role: RoleKey, destination: Destination): boolean {
  return DESTINATIONS[role].includes(destination);
}

export function canWriteReports(role: RoleKey): boolean {
  return role === "analyst" || role === "lead-analyst";
}

export function canApprove(role: RoleKey): boolean {
  return role === "lead-analyst";
}

/** Who may change an agent's instruction, skills, tools or a PIR.
 *
 * Seeing what an agent is made of is not the same permission as changing it:
 * every console user with Manage reads, the administrator alone writes
 * (Praveen Singh, 2 September). Lead Analyst carries the administrator rights
 * until CPX confirms the user-type list at open item H1. */
export function canAdminister(role: RoleKey): boolean {
  return role === "lead-analyst";
}

export function seesRawIocs(role: RoleKey): boolean {
  return role === "analyst" || role === "lead-analyst" || role === "incident-responder";
}

export function publishedOnly(role: RoleKey): boolean {
  return role === "incident-responder" || role === "leadership" || role === "sales";
}

// Payload assembly for the reports list. Sales: published, own clients, IOCs stripped.
export function assembleAdvisories(
  advisories: Advisory[],
  user: ConsoleUser,
): Advisory[] {
  let rows = advisories;
  if (publishedOnly(user.role)) {
    rows = rows.filter((a) =>
      ["published", "superseded", "retracted", "did-not-run"].includes(a.status),
    );
  }
  if (user.clientScope !== "all") {
    const scope = new Set(user.clientScope);
    rows = rows.filter((a) => a.clientIds.some((c) => scope.has(c)));
  }
  if (!user.seesRawIocs) {
    rows = rows.map((a) => stripIndicators(a));
  }
  return rows;
}

export function assembleAdvisory(
  advisory: Advisory,
  user: ConsoleUser,
): Advisory | null {
  const [row] = assembleAdvisories([advisory], user);
  return row ?? null;
}

// Strip at assembly and keep the count. Never render then hide.
function stripIndicators(a: Advisory): Advisory {
  return {
    ...a,
    sections: a.sections.map((s) => {
      if (s.heading !== "Indicators") return s;
      const count = s.body
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean).length;
      return {
        ...s,
        body: `${count} indicators, withheld at this access level`,
        generated: s.generated,
        citations: [],
      };
    }),
  };
}
