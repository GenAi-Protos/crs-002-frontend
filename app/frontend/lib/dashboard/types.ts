// The TI Analyst dashboard payload.
//
// This is the contract, and it is written as the shape a backend endpoint will
// return rather than as the shape today's mock happens to have. When
// GET /dashboard/analyst exists it returns this and nothing downstream changes.
//
// Two rules the shape enforces on whoever fills it.
//
// Every figure carries what it is a figure of: a window, a unit, or a
// denominator. A dashboard that shows "42" and leaves the reader to guess the
// period is how an analyst reaches a wrong conclusion quickly.
//
// Nothing is a bare percentage. Proportions carry their counts, so a slice
// reading 40% of five is not mistaken for 40% of five thousand.

/** Where a block's numbers came from. Rendered, never assumed. */
export type DataSource = "live" | "mock";

export type Severity = "critical" | "high" | "medium" | "low";

export interface TimeWindow {
  days: number;
  from: string; // ISO UTC
  to: string; // ISO UTC
}

export interface Kpi {
  key: string;
  label: string;
  value: number;
  /** What the number counts, in the analyst's words. Always rendered. */
  unit: string;
  /** The period the number covers, where it has one. */
  window?: string;
  /** Prior-period value, so a change can be shown rather than implied. */
  previous?: number;
  /** True where an increase is bad. Drives the direction marker, not colour alone. */
  higherIsWorse?: boolean;
  /** Where the analyst goes to act on it. */
  href?: string;
}

export interface Slice {
  label: string;
  value: number;
}

export interface Bar {
  label: string;
  value: number;
}

export interface TrendPoint {
  date: string; // ISO date
  detections: number;
  indicators: number;
}

export interface QueueItem {
  id: string;
  ref: string;
  title: string;
  severity: Severity;
  /** What kind of work this is: a hit to triage, a report to review, an RFI. */
  kind: "pir-hit" | "report-review" | "rfi" | "source-issue";
  /** Set where a clock applies. Rendered as time remaining. */
  dueAt?: string;
  clientCount: number;
  href: string;
}

export interface ActorRow {
  name: string;
  aliases: string[];
  /** Held records mentioning the actor in the window. */
  records: number;
  clientsAffected: number;
  lastSeen: string;
  topTechnique: string;
}

export interface SourceHealth {
  total: number;
  enabled: number;
  failing: number;
  silentUnexplained: number;
  lastCollection: string | null;
}

export interface AnalystDashboard {
  generatedAt: string;
  window: TimeWindow;
  kpis: Kpi[];
  /** Proportions of one whole: a pie is honest here and nowhere else. */
  severityDistribution: Slice[];
  /** Category comparisons: bars, because the eye compares lengths well. */
  threatsByCategory: Bar[];
  iocTypes: Bar[];
  /** Movement over time: a line, and only where the points are evenly spaced. */
  detectionTrend: TrendPoint[];
  priorityQueue: QueueItem[];
  topActors: ActorRow[];
  sourceHealth: SourceHealth;
}

/**
 * What the service hands a component.
 *
 * The state is explicit rather than inferred from a null, so a component can
 * tell "still loading" from "loaded and there is nothing" from "we could not
 * reach the source". Those are three different sentences on screen and only one
 * of them is a problem.
 */
export type DashboardState = "loading" | "ok" | "empty" | "unavailable";

export interface DashboardResult {
  state: DashboardState;
  source: DataSource;
  data: AnalystDashboard | null;
  /** Why, when the state is not ok. Shown to the analyst verbatim. */
  note?: string;
}

// --- the shared intelligence dataset ----------------------------------------
//
// One dataset, six audiences. Every role dashboard is a projection of this, so
// the lead analyst and the CEO are looking at the same findings counted the
// same way. Separate per-role payloads would let two dashboards disagree about
// how many critical threats there are, which is how a leadership meeting ends
// in an argument about the tool.
//
// This is also where role access is enforced in the payload rather than the
// DOM: the projector drops what a role may not receive and reports the count it
// dropped. The backend must do the same when it owns this shape - a hidden
// widget is not access control.

export type SectorName = string;

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  category: string;
  /** Client sectors this finding touches. */
  sectors: SectorName[];
  regions: string[];
  clientCount: number;
  firstSeen: string;
  campaignId?: string;
  actorId?: string;
  /** Techniques by id only; names derive from the held ATT&CK table. */
  techniqueIds: string[];
  status: "new" | "triaged" | "investigating" | "reported" | "closed";
  /** One line, for a non-technical reader. Never generated from the title. */
  businessImpact: string;
}

export interface Campaign {
  id: string;
  name: string;
  actorId?: string;
  status: "active" | "monitoring" | "concluded";
  severity: Severity;
  firstSeen: string;
  lastActivity: string;
  sectors: SectorName[];
  regions: string[];
  clientCount: number;
  /** For technical readers. */
  attackChain: string[];
  techniqueIds: string[];
  /** For non-technical readers. Plain English, no indicators. */
  summary: string;
  advisoryRef?: string;
}

export interface Actor {
  id: string;
  name: string;
  aliases: string[];
  records: number;
  clientsAffected: number;
  lastSeen: string;
  topTechniqueId: string;
  motivation: string;
}

export interface Indicator {
  value: string;
  type: "ipv4" | "domain" | "url" | "sha256" | "email";
  firstSeen: string;
  confidence: number;
  campaignId?: string;
  note: string;
}

export interface MalwareRow {
  name: string;
  family: string;
  firstSeen: string;
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
  severity: Severity;
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
  openedAt: string;
  findingId?: string;
}

export interface SectorImpact {
  sector: SectorName;
  findings: number;
  clients: number;
  criticalFindings: number;
}

export interface ActivityRow {
  at: string;
  actor: string;
  action: string;
  ref?: string;
}

/** The whole picture. Roles receive projections of it, never all of it. */
export interface IntelligenceDataset {
  generatedAt: string;
  window: TimeWindow;
  /** The one number leadership reads first. Stated with its reason. */
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
  trend: TrendPoint[];
  emergingThreats: { title: string; note: string; severity: Severity; firstSeen: string }[];
  activity: ActivityRow[];
  sourceHealth: SourceHealth;
}

// --- widgets -----------------------------------------------------------------
//
// A role dashboard is a list of widgets. One renderer draws any of them, so
// every role gets the same spacing, the same type scale and the same empty
// states, and a new role is a configuration rather than a screen.

export interface Cell {
  text: string;
  mono?: boolean;
  href?: string;
  tone?: "critical" | "warn" | "muted";
  /** A colour chip before the text, for severity and status columns. */
  swatch?: string;
  /** Hover text where the cell is abbreviated. */
  title?: string;
  /** Render as a compact badge: indicator type, rule kind, report type. */
  badge?: boolean;
  /** Offer a copy control. Copies exactly what is displayed, defanged. */
  copy?: boolean;
  /** 0-100. Draws the figure with a compact bar beside it. */
  percent?: number;
  /** Hold on one line. For dates and short codes only. */
  nowrap?: boolean;
}

export interface Column {
  label: string;
  /**
   * Narrow columns keep numbers from drifting away from their heading. The
   * width is applied to a <colgroup>, never to the heading alone, so heading
   * and cells cannot end up on different column edges.
   */
  width?: string;
  /** Numeric columns align right, heading included. */
  align?: "left" | "right";
  /**
   * What this column measures, for a heading whose values are abbreviated.
   * Rendered behind a small control beside the heading, with the exact value
   * of every row, rather than as a paragraph on the screen.
   */
  info?: string;
}

export type Widget =
  | { kind: "kpis"; id: string; items: Kpi[] }
  | {
      kind: "callout";
      id: string;
      title: string;
      body: string;
      tone: "neutral" | "warn" | "critical";
      points?: string[];
    }
  | {
      kind: "donut";
      id: string;
      title: string;
      note?: string;
      slices: Slice[];
      colors: string[];
      totalLabel: string;
    }
  | {
      kind: "bars";
      id: string;
      title: string;
      note?: string;
      items: Bar[];
      color?: string;
      labelClass?: string;
    }
  | {
      kind: "line";
      id: string;
      title: string;
      note?: string;
      labels: string[];
      series: { label: string; color: string; values: number[] }[];
      /** Axis titles. A chart that does not say what it counts says nothing. */
      xLabel?: string;
      yLabel?: string;
      /** One line under the chart, saying what the trend represents. */
      explanation?: string;
    }
  | {
      kind: "table";
      id: string;
      title: string;
      note?: string;
      columns: Column[];
      rows: Cell[][];
      empty: string;
    }
  | {
      kind: "list";
      id: string;
      title: string;
      note?: string;
      items: { primary: string; secondary?: string; meta?: string; href?: string }[];
      empty: string;
    }
  | {
      kind: "stats";
      id: string;
      title: string;
      note?: string;
      stats: { label: string; value: string | number; warn?: boolean }[];
    };

/** What a role may not receive, and how much of it there was. */
export interface Withheld {
  label: string;
  count: number;
}

export interface RoleDashboard {
  role: string;
  /** Two or three words. The dashboard's own title stays "Dashboard". */
  audience: string;
  window: TimeWindow;
  generatedAt: string;
  /** Laid out top to bottom, most important first. */
  widgets: Widget[];
  /** Rendered as one line. Silence about withheld data would be a lie. */
  withheld: Withheld[];
}

export interface RoleDashboardResult {
  state: DashboardState;
  source: DataSource;
  data: RoleDashboard | null;
  note?: string;
}
