// Dashboard payloads, as the backend sends them.
//
// Two feeds, two scopes, and the screen says which is which:
//
//   GET /dashboard/views/{role}   the role's own work. Honours the period and
//                                 client filters.
//   GET /dashboard/intelligence   the held threat picture, role-scoped on the
//                                 server. Ignores both filters; only `trend`
//                                 is windowed (30 days).
//
// Every figure carries what it is a figure of. A dashboard that shows "42" and
// leaves the reader to guess the period is how an analyst reaches a wrong
// conclusion quickly.

import type { RoleKey } from "../types";

export type Severity = "critical" | "high" | "medium" | "low";

export interface TimeWindow {
  days: number;
  from: string; // ISO UTC
  to: string; // ISO UTC
}

// --- /dashboard/views/{role} --------------------------------------------------

export interface ViewQueueItem {
  id: string;
  title: string;
  status?: string;
  href?: string;
  updatedAt?: string;
  createdAt?: string;
  /** A user id; the screen maps it to a name. */
  assignedTo?: string;
  owner?: string;
}

export interface ViewInsightItem extends Partial<ViewQueueItem> {
  label?: string;
  value?: string | number | null;
  summaryEndpoint?: string;
  briefings?: { title: string; publishedAt: string; summaryEndpoint?: string }[];
}

export interface DashboardView {
  role: RoleKey;
  generatedAt: string;
  clientId?: string | null;
  window: TimeWindow;
  kpis: { key: string; label: string; value: number | string | null; unit: string; href: string | null }[];
  queues: { key: string; title: string; total: number; items: ViewQueueItem[] }[];
  insights: { key: string; title: string; description: string; items: ViewInsightItem[] }[];
}

// --- /dashboard/intelligence -------------------------------------------------

export interface Bar {
  label: string;
  value: number;
}

export interface TrendPoint {
  date: string; // ISO date
  /** PIR hits fired that day. */
  detections: number;
  /** Indicators added that day. */
  indicators: number;
}

export interface SourceHealth {
  total: number;
  enabled: number;
  failing: number;
  silentUnexplained: number;
  lastCollection: string | null;
}

export type SectorName = string;

export interface Finding {
  /** The PIR hit id: `/intelligence?draft={id}` seeds an advisory from it. */
  id: string;
  title: string;
  /** Banded from match confidence on the server (85/70/50), not assessed. */
  severity: Severity;
  category: string;
  sectors: SectorName[];
  regions: string[];
  clientCount: number;
  firstSeen: string;
  campaignId?: string;
  actorId?: string;
  techniqueIds: string[];
  status: "new" | "triaged" | "investigating" | "reported" | "closed";
  businessImpact: string;
}

export interface Campaign {
  id: string;
  name: string;
  actorId?: string;
  status: "active" | "monitoring" | "concluded";
  /** Mapped from TLP on the server; not shown as severity. */
  severity: Severity;
  firstSeen: string;
  lastActivity: string;
  sectors: SectorName[];
  regions: string[];
  clientCount: number;
  attackChain: string[];
  techniqueIds: string[];
  summary: string;
  advisoryRef?: string;
}

export interface Actor {
  id: string;
  name: string;
  aliases: string[];
  records: number;
  clientsAffected: number;
  lastSeen?: string;
  topTechniqueId: string;
  motivation: string;
}

export interface Indicator {
  value: string;
  type: "ipv4" | "domain" | "url" | "sha256" | "email";
  firstSeen?: string;
  confidence: number;
  campaignId?: string;
  note: string;
}

export interface MalwareRow {
  name: string;
  family: string;
  firstSeen?: string;
  campaignId?: string;
  behaviour: string;
}

export interface DetectionRow {
  kind: "sigma" | "yara" | "hunting";
  name: string;
  ref: string;
  coverage: string;
  techniqueIds: string[];
}

export interface AdvisoryRow {
  ref: string;
  title: string;
  type: "IA" | "VA" | "DG" | "RFI" | "TAP";
  status: string;
  /** Mapped from TLP on the server; not shown as severity. */
  severity: Severity;
  /** A name, an id, or empty. */
  owner: string;
  updatedAt: string;
  clientCount: number;
  sectors: SectorName[];
}

export interface InvestigationRow {
  id: string;
  title: string;
  status: "open" | "in-progress" | "awaiting-review" | "closed";
  owner: string;
  openedAt?: string;
  findingId?: string;
}

export interface SectorImpact {
  sector: SectorName;
  findings: number;
  clients: number;
  criticalFindings: number;
}

export interface ActivityRow {
  /** May be empty on old audit rows. */
  at: string;
  /** A user id. */
  actor: string;
  action: string;
  ref?: string | null;
}

export interface IntelligenceDataset {
  generatedAt: string;
  window: TimeWindow;
  threatLevel: { level: "low" | "moderate" | "elevated" | "high" | "severe"; reason: string; changedAt: string };
  findings: Finding[];
  campaigns: Campaign[];
  actors: Actor[];
  indicators: Indicator[];
  malware: MalwareRow[];
  detections: DetectionRow[];
  advisories: AdvisoryRow[];
  investigations: InvestigationRow[];
  sectors: SectorImpact[];
  regions: Bar[];
  /** The only windowed series: 30 zero-filled days. */
  trend: TrendPoint[];
  /** Hits under 72 hours old. No id: listed, never linked. */
  emergingThreats: { title: string; note: string; severity: Severity; firstSeen: string }[];
  activity: ActivityRow[];
  sourceHealth: SourceHealth;
}

/** What a role may not receive, and how much of it there was. */
export interface Withheld {
  label: string;
  count: number;
}

export interface IntelligenceResponse {
  data: IntelligenceDataset;
  withheld: Withheld[];
}
