import { publicEnv } from "./runtime-env";

import type { AskOptions } from "./ask-options";
import type { Advisory, Client, Connector, Delivery, DrpItem, Investigation, KeywordWatch, Pir, PirCategory, PirHit, RelevanceMatch, Rhythm, Source, SourceRequest, Turn } from "./types";

// Read at call time, never at module init: the value comes from the container env
// (server) or window.__ENV (browser) and must not be baked into the bundle.
const apiBase = () => publicEnv().API_BASE_URL;

// A read falls back to fixtures when the backend is down. A write cannot, so it
// has to be able to say what went wrong. Browsers surface an unreachable server
// as a bare "Failed to fetch" TypeError, which tells an analyst nothing and
// reads like a bug in the console rather than a server that is not running.
const unreachable = () =>
  "The backend is not reachable. Check that it is running on " +
  apiBase() +
  ", or set API_BASE_URL.";

// Thrown only when the backend cannot be reached at all. An HTTP error (403, 404,
// 500) is a response from a live backend and is never this.
export class BackendUnreachable extends Error {}

export const isUnreachable = (e: unknown): boolean => e instanceof BackendUnreachable;

// A read that never answers must end as "unreachable", with the fixture
// fallback and the offline chip, not as a skeleton that stays up all day.
// Writes and the ask keep their own timing: a draft being created or an
// answer being composed is allowed to take longer than a list.
const READ_TIMEOUT_MS = 15_000;

async function request(input: string, init?: RequestInit): Promise<Response> {
  const isRead = !init?.method || init.method === "GET";
  const signal = init?.signal ?? (isRead ? AbortSignal.timeout(READ_TIMEOUT_MS) : undefined);
  try {
    return await fetch(input, { ...init, signal });
  } catch {
    // Only a network-level failure lands here (a refused connection, a timeout,
    // a caller's abort). An HTTP error is a response and each caller reads the
    // backend's own reason from it.
    throw new BackendUnreachable(unreachable());
  }
}


async function send<T>(userId: string, path: string, method: "POST" | "PATCH", body: unknown): Promise<T> {
  const response = await request(`${apiBase()}${path}`, {
    method,
    headers: { "X-Nestor-User": userId, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    // The backend states its reason (409 duplicate name, 403 wrong role). Carry
    // it to the caller so the form can show it rather than failing silently.
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `Backend returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export type Health = {
  status: "ok" | string;
  // False means no sweep is scheduled, so the console must not promise one.
  scheduler: boolean;
  counts: { advisories: number };
};

export async function getHealth(): Promise<Health> {
  const response = await request(`${apiBase()}/health`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
  return response.json() as Promise<Health>;
}

export async function getReports(userId: string): Promise<Advisory[]> {
  const response = await request(`${apiBase()}/reports`, {
    cache: "no-store",
    headers: { "X-Nestor-User": userId },
  });
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
  const payload = (await response.json()) as { items: Advisory[] };
  return payload.items;
}

export type DashboardData = {
  clients: Client[];
  hits: PirHit[];
  sources: Source[];
  deliveries: Delivery[];
  relevance: RelevanceMatch[];
};

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const response = await request(`${apiBase()}/dashboard`, {
    cache: "no-store",
    headers: { "X-Nestor-User": userId },
  });
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
  const payload = (await response.json()) as { data: DashboardData };
  return payload.data;
}

// The endpoint returns the advisory and its delivery ledger together, already
// scoped to the caller's clients. Both are returned: the ledger is what makes
// the no-client-login decision auditable.
export async function getReport(
  userId: string,
  ref: string,
): Promise<{ advisory: Advisory; deliveries: Delivery[] }> {
  const response = await request(`${apiBase()}/reports/${encodeURIComponent(ref)}`, {
    cache: "no-store",
    headers: { "X-Nestor-User": userId },
  });
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
  const payload = (await response.json()) as { advisory: Advisory; deliveries?: Delivery[] };
  return { advisory: payload.advisory, deliveries: payload.deliveries ?? [] };
}

export async function changeReport(userId: string, ref: string, action: "submit" | "approve", reason?: string) {
  const response = await request(`${apiBase()}/reports/${encodeURIComponent(ref)}/${action}`, {
    method: "POST",
    headers: {
      "X-Nestor-User": userId,
      ...(reason ? { "Content-Type": "application/json" } : {}),
    },
    body: reason ? JSON.stringify({ reason }) : undefined,
  });
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
}

// Create a report from its template. The server owns the reference, the status
// and the blocking gate: an artefact cannot be created past review.
export async function createReport(
  userId: string,
  body: {
    type: "IA" | "VA" | "DG" | "TAP";
    title: string;
    sections: Advisory["sections"];
    template?: Advisory["template"];
  },
): Promise<Advisory> {
  const response = await request(`${apiBase()}/reports/draft`, {
    method: "POST",
    headers: { "X-Nestor-User": userId, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `Backend returned ${response.status}`);
  }
  return response.json() as Promise<Advisory>;
}

export async function archiveReport(userId: string, ref: string) {
  const response = await request(
    `${apiBase()}/reports/${encodeURIComponent(ref)}/archive`,
    { method: "POST", headers: { "X-Nestor-User": userId } },
  );
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `Backend returned ${response.status}`);
  }
}

export async function sendBackReport(userId: string, ref: string, reason: string) {
  const response = await request(`${apiBase()}/reports/${encodeURIComponent(ref)}/send-back`, {
    method: "POST",
    headers: { "X-Nestor-User": userId, "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
}

async function listApi<T>(userId: string, path: string, key: string): Promise<T[]> {
  const response = await request(`${apiBase()}${path}`, {
    cache: "no-store",
    headers: { "X-Nestor-User": userId },
  });
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
  const payload = await response.json() as Record<string, T[]>;
  return payload[key] ?? [];
}

export const getClients = (userId: string) => listApi<Client>(userId, "/clients", "items");
export const getSources = (userId: string) => listApi<Source>(userId, "/collection/sources", "items");
export const getConnectors = (userId: string) => listApi<Connector>(userId, "/collection/connectors", "items");
export const getWatches = (userId: string) => listApi<KeywordWatch>(userId, "/collection/watches", "items");
export const getRequests = (userId: string) => listApi<SourceRequest>(userId, "/collection/requests", "items");
export const getInvestigation = (userId: string, id: string) => listApi<Turn>(userId, `/intelligence/${id}`, "turns");
export async function getSource(userId: string, id: string): Promise<Source> {
  const response = await request(`${apiBase()}/collection/sources/${encodeURIComponent(id)}`, { cache: "no-store", headers: { "X-Nestor-User": userId } });
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
  return (await response.json() as { source: Source }).source;
}
export const getInvestigations = (userId: string) => listApi<Investigation>(userId, "/intelligence", "items");
export const getPirs = (userId: string) => listApi<Pir>(userId, "/pirs", "items");

// `signal` is the analyst's Stop: aborting it ends the request and the turn
// records itself as stopped, which is a state the model already carries.
export async function askIntelligence(userId: string, question: string, investigationId?: string, options?: AskOptions, signal?: AbortSignal): Promise<{ investigationId: string; turn: Turn }> {
  const response = await request(`${apiBase()}/intelligence/ask`, {
    method: "POST",
    headers: { "X-Nestor-User": userId, "Content-Type": "application/json" },
    body: JSON.stringify({ question, investigationId, options }),
    signal,
  });
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
  return response.json() as Promise<{ investigationId: string; turn: Turn }>;
}

export async function reputationLookup(userId: string, observable: string) {
  const response = await request(`${apiBase()}/intelligence/reputation`, {
    method: "POST",
    headers: { "X-Nestor-User": userId, "Content-Type": "application/json" },
    body: JSON.stringify({ observable }),
  });
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
  return response.json() as Promise<{ observable: string; mode: string; results: { provider: string; status: string; score: number | null; categories: string[]; error: string | null }[] }>;
}
// --- writes -----------------------------------------------------------------
// Everything below replaces a sessionStorage write. The three editable source
// facts are the only ones the backend accepts: class, capture mode and
// residency are derived there and must never be sent.

export type ClientDetail = {
  client: Client;
  advisories: { ref: string; title: string; status: string; type: string }[];
  deliveries: Delivery[];
  drpItems: DrpItem[];
  relevance: (RelevanceMatch & { hitTitle?: string })[];
};

export async function getClient(userId: string, id: string): Promise<ClientDetail> {
  const response = await request(`${apiBase()}/clients/${encodeURIComponent(id)}`, {
    cache: "no-store",
    headers: { "X-Nestor-User": userId },
  });
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
  return response.json() as Promise<ClientDetail>;
}

export type ClientPatch = Partial<Pick<Client, "name" | "sector" | "region" | "products" | "subscribedPirRefs">>;

export const patchClient = (userId: string, id: string, patch: ClientPatch) =>
  send<Client>(userId, `/clients/${encodeURIComponent(id)}`, "PATCH", patch);

// The server issues the id and derives profileComplete; neither is sent.
export type ClientCreate = { name: string; sector?: string; region?: string; products?: string[]; subscribedPirRefs?: string[] };

export const createClient = (userId: string, body: ClientCreate) =>
  send<Client>(userId, "/clients", "POST", body);

// PIRs. The ref and the parameter list are the server's: the ref because it is
// cited by clients, sources, watches and every hit already raised against it,
// and the parameters because they are derived from the placeholders in the
// question. Only the lead analyst is accepted, and the refusal is the
// backend's, not a hidden button.
export type PirCreate = {
  category: PirCategory;
  question: string;
  coverage: string;
  stixNative?: boolean;
};

export type PirPatch = Partial<PirCreate>;

export const createPir = (userId: string, body: PirCreate) =>
  send<Pir>(userId, "/pirs", "POST", body);

export const patchPir = (userId: string, ref: string, patch: PirPatch) =>
  send<Pir>(userId, `/pirs/${encodeURIComponent(ref)}`, "PATCH", patch);

export type SourcePatch = { enabled?: boolean; expectedRhythm?: Rhythm; pirRefs?: string[] };

export const patchSource = (userId: string, id: string, patch: SourcePatch) =>
  send<Source>(userId, `/collection/sources/${encodeURIComponent(id)}`, "PATCH", patch);

export const createRequest = (userId: string, body: { url: string; reason: string; pirRef: string }) =>
  send<SourceRequest>(userId, "/collection/requests", "POST", body);

export type WatchCreate = {
  name: string;
  terms: string[];
  language?: string;
  region?: string;
  pirRefs?: string[];
  cadence?: Rhythm;
};

export const createWatch = (userId: string, body: WatchCreate) =>
  send<KeywordWatch>(userId, "/collection/watches", "POST", body);

// lastRun belongs to the sweep, so it is never in the patch.
export const patchWatch = (userId: string, id: string, patch: Partial<WatchCreate>) =>
  send<KeywordWatch>(userId, `/collection/watches/${encodeURIComponent(id)}`, "PATCH", patch);

export async function deleteWatch(userId: string, id: string): Promise<void> {
  const response = await request(`${apiBase()}/collection/watches/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "X-Nestor-User": userId },
  });
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
}

// The server issues the ref, sets the status and attaches the blocking gate.
export type RfiCreate = {
  requester: string;
  question: string;
  clientId: string;
  dueAt: string;
  pirRefs?: string[];
};

export const createRfi = (userId: string, body: RfiCreate) =>
  send<Advisory>(userId, "/reports", "POST", body);
