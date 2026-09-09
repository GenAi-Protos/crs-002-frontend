// What each role receives, declared rather than coded.
//
// A role is a configuration: an audience line, an ordered list of widget ids,
// and a data-access level. Adding a role is an entry here plus whatever new
// widget it needs, not a new screen.
//
// `access` is the part that matters. It is read by the projector, which drops
// what the level does not permit and reports the count it dropped. The console
// enforcing this is not security - the backend must apply the same rule when it
// owns the dataset, because a widget that is not rendered was still sent.

import type { RoleKey } from "../types";

export type DetailLevel = "technical" | "operational" | "strategic" | "commercial";

export interface RoleAccess {
  /** Raw indicator values: addresses, domains, hashes. */
  indicators: boolean;
  /** MITRE technique ids and attack chains. */
  techniques: boolean;
  /** Sigma, YARA and hunting content. */
  detections: boolean;
  /** Malware family detail. */
  malware: boolean;
  /** Named client counts per finding. Sales sees only its own clients. */
  clientDetail: boolean;
}

export interface RoleConfig {
  /** Two or three words naming who this is for. */
  audience: string;
  level: DetailLevel;
  /** Widget ids, in the order they appear. */
  widgets: string[];
  access: RoleAccess;
}

const NO_TECHNICAL: RoleAccess = {
  indicators: false,
  techniques: false,
  detections: false,
  malware: false,
  clientDetail: true,
};

export const ROLE_CONFIG: Record<RoleKey, RoleConfig> = {
  // Built separately: the TI Analyst dashboard is its own component.
  analyst: {
    audience: "TI Analyst",
    level: "technical",
    widgets: [],
    access: {
      indicators: true,
      techniques: true,
      detections: true,
      malware: true,
      clientDetail: true,
    },
  },

  // Prioritisation and oversight. Everything an analyst sees, plus the queue of
  // work waiting on a decision that only this role can take.
  "lead-analyst": {
    audience: "Lead Analyst",
    level: "operational",
    widgets: [
      "kpis",
      "priority-threats",
      "awaiting-review",
      "severity",
      "trend",
      "campaigns",
      "investigations",
      "emerging",
      "indicators-summary",
      "activity",
      "collection",
    ],
    access: {
      indicators: true,
      techniques: true,
      detections: true,
      malware: true,
      clientDetail: true,
    },
  },

  // The threat landscape and what it means for the business. No indicators, no
  // techniques: a director asked to read a hash has been handed the wrong page.
  leadership: {
    audience: "CRS Leadership",
    level: "strategic",
    widgets: [
      "kpis",
      "threat-level",
      "critical-threats",
      "campaigns",
      "sectors",
      "severity",
      "trend",
      "advisories",
      "emerging",
    ],
    access: NO_TECHNICAL,
  },

  // Investigate, contain, remediate. The most technical view in the console.
  "incident-responder": {
    audience: "Incident Responder",
    level: "technical",
    widgets: [
      "kpis",
      "active-threats",
      "attack-chain",
      "indicators-table",
      "malware",
      "techniques",
      "detections",
      "actors",
    ],
    access: {
      indicators: true,
      techniques: true,
      detections: true,
      malware: true,
      clientDetail: true,
    },
  },

  // What a client would want to hear, in words a client would use. This is the
  // strictest withholding in the console and it is a written CPX requirement.
  sales: {
    audience: "Sales",
    level: "commercial",
    widgets: [
      "kpis",
      "trending",
      "sectors",
      "regions",
      "advisories",
      "client-summary",
    ],
    access: { ...NO_TECHNICAL, clientDetail: false },
  },

  // The shortest dashboard in the product. If it needs a second screen to
  // explain it, it is the wrong dashboard.
  executive: {
    audience: "Chief Executive",
    level: "strategic",
    widgets: [
      "threat-level",
      "kpis",
      "critical-threats",
      "sectors",
      "trend",
      "emerging",
    ],
    access: NO_TECHNICAL,
  },
};

export function configFor(role: RoleKey): RoleConfig {
  return ROLE_CONFIG[role];
}
