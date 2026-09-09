// Typed access to the fixture set. Derived fields are computed here, at load,
// so no component ever derives or stores collector class, capture mode or residency.

import pirsJson from "@/fixtures/pirs.json";
import usersJson from "@/fixtures/users.json";
import clientsJson from "@/fixtures/clients.json";
import hitsJson from "@/fixtures/pir-hits.json";
import relevanceJson from "@/fixtures/relevance-matches.json";
import advisoriesJson from "@/fixtures/advisories.json";
import draftsJson from "@/fixtures/advisory-draft.json";
import investigationsJson from "@/fixtures/investigations.json";
import sourcesJson from "@/fixtures/sources.json";
import connectorsJson from "@/fixtures/connectors.json";
import watchesJson from "@/fixtures/keyword-watches.json";
import requestsJson from "@/fixtures/source-requests.json";
import deliveriesJson from "@/fixtures/deliveries.json";
import drpJson from "@/fixtures/drp-items.json";
import agentsJson from "@/fixtures/agents.json";
import workflowsJson from "@/fixtures/workflows.json";

import type {
  Advisory,
  Agent,
  Client,
  Connector,
  ConsoleUser,
  Delivery,
  DrpItem,
  Investigation,
  KeywordWatch,
  Pir,
  PirHit,
  RelevanceMatch,
  Source,
  SourceRequest,
  Workflow,
} from "./types";
import { deriveCaptureMode, deriveCategory, deriveClass, deriveResidency } from "./derive";

export const PIRS = pirsJson as Pir[];
export const USERS = usersJson as ConsoleUser[];
export const CLIENTS = clientsJson as Client[];
export const HITS = hitsJson as PirHit[];
export const ADVISORIES = [...(advisoriesJson as unknown as Advisory[]), ...(draftsJson as unknown as Advisory[])];
export const INVESTIGATIONS = investigationsJson as unknown as Investigation[];
export const CONNECTORS = connectorsJson as Connector[];
export const WATCHES = watchesJson as KeywordWatch[];
export const REQUESTS = requestsJson as SourceRequest[];
export const DELIVERIES = deliveriesJson as Delivery[];
export const DRP_ITEMS = drpJson as DrpItem[];
// The agent roster. Offline fallback only: Manage reads the backend first.
export const AGENTS = agentsJson as Agent[];
// The workflow library. Same rule: the backend wins once /workflows exists.
export const WORKFLOWS = workflowsJson as Workflow[];

type StoredSource = Omit<Source, "collectorClass" | "captureMode" | "residency" | "category">;

export const SOURCES: Source[] = (sourcesJson as StoredSource[]).map((s) => {
  const collectorClass = deriveClass(s.url);
  return {
    ...s,
    collectorClass,
    captureMode: deriveCaptureMode(collectorClass),
    category: deriveCategory(s),
    residency: deriveResidency(s.url),
  };
});

const RELEVANCE = relevanceJson as RelevanceMatch[];

// Always scoped to one client. Never assemble across clients and filter in a component.
export function relevanceForClient(clientId: string): RelevanceMatch[] {
  return RELEVANCE.filter((r) => r.clientId === clientId).sort(
    (a, b) => b.score - a.score,
  );
}

export function pirByRef(ref: string): Pir | undefined {
  return PIRS.find((p) => p.ref === ref);
}

export function clientById(id: string): Client | undefined {
  return CLIENTS.find((c) => c.id === id);
}

export function advisoryByRef(ref: string): Advisory | undefined {
  return ADVISORIES.find((a) => a.ref === ref);
}

export function investigationById(id: string): Investigation | undefined {
  return INVESTIGATIONS.find((i) => i.id === id);
}

export function deliveriesForClient(clientId: string): Delivery[] {
  return DELIVERIES.filter((d) => d.clientId === clientId).sort(
    (a, b) => +new Date(b.sentAt) - +new Date(a.sentAt),
  );
}

export function deliveriesForAdvisory(ref: string): Delivery[] {
  return DELIVERIES.filter((d) => d.advisoryRef === ref);
}

export function drpForClient(clientId: string): DrpItem[] {
  return DRP_ITEMS.filter((d) => d.clientId === clientId).sort(
    (a, b) => +new Date(b.firstSeen) - +new Date(a.firstSeen),
  );
}

export function userForRole(role: ConsoleUser["role"]): ConsoleUser {
  const u = USERS.find((x) => x.role === role);
  if (!u) throw new Error(`No fixture user for role ${role}`);
  return u;
}
