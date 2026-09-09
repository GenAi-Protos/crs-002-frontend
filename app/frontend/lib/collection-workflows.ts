// The collection-category registry.
//
// A category is a registry entry, not a screen. Adding one means adding an
// object here: its label, where its units come from, and the stages its
// pipeline actually runs. The dashboard renders whatever this file contains,
// so a new category never needs the page redesigned.
//
// Two rules hold across every category. Stages are configuration - they
// describe what the pipeline does, and they differ per category because the
// pipelines differ. Status is derived from real collection state on the units
// themselves (lastSuccess, itemsLast30d, consecutiveFailures, state); nothing
// on this screen is invented run data.

import type { Connector, Source, SourceCategory } from "./types";

export type CategoryKey =
  | "osint"
  | "ioc"
  | "vuln"
  | "ransomware"
  | "geopolitical"
  | "messaging"
  | "commercial"
  | "soc"
  | "ctem"
  | "spidersilk"
  | "mitre"
  | "analyst";

/** Where a category's collection units come from.
 *
 * inventory - rows of TI Sources and Feeds v0.1, the 185.
 * connector - a named integration, one per system (BRD 7.1, internal sources).
 * analyst   - intelligence a CPX analyst wrote by hand (FR-REP-03).
 */
export type CategoryOrigin = "inventory" | "connector" | "analyst";

export interface WorkflowStage {
  label: string;
  /** One line, for the analyst who has not seen this pipeline before. */
  detail: string;
}

export interface CategoryDefinition {
  key: CategoryKey;
  label: string;
  origin: CategoryOrigin;
  /** Inventory categories map onto Source.category. */
  sourceCategory?: SourceCategory;
  /** Connector categories match by connector name. */
  connectorNames?: string[];
  stages: WorkflowStage[];
  /** Why this category holds nothing, where we know. */
  gap?: string;
}

const SEND_TO_REPOSITORY: WorkflowStage = {
  label: "Send to Repository",
  detail: "Writes the normalised record and keeps the raw payload unmodified.",
};

const ANALYST_REVIEW: WorkflowStage = {
  label: "Analyst Review",
  detail: "Held for a person before anything reaches the repository as reviewed.",
};

export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    key: "osint",
    label: "OSINT Feeds",
    origin: "inventory",
    sourceCategory: "OSINT Feeds",
    stages: [
      { label: "Discover Sources", detail: "Resolves the collector class for each row from its URL." },
      { label: "Collect Content", detail: "Polls each source and stores the exact response it received." },
      { label: "Extract Entities", detail: "Pulls actors, campaigns, malware, products and CVEs from the text." },
      { label: "Identify Threat Intelligence", detail: "Separates a reportable finding from routine news." },
      { label: "Validate Findings", detail: "Applies the benign list, private-range filter and context check before anything becomes a candidate." },
      { label: "Preserve Evidence", detail: "Writes the raw payload once, addressed by its SHA-256, and never overwrites it." },
      SEND_TO_REPOSITORY,
    ],
  },
  {
    key: "ioc",
    label: "IOC Feeds",
    origin: "inventory",
    sourceCategory: "IOC Feeds",
    stages: [
      { label: "Connect to Sources", detail: "Opens each indicator feed with its configured auth pattern." },
      { label: "Fetch Indicators", detail: "Retrieves the current list; an unchanged feed returns 304 and writes nothing." },
      { label: "Normalize IOCs", detail: "Maps every indicator to the canonical type vocabulary." },
      { label: "Deduplicate", detail: "Collapses the same indicator from several feeds into one record, keeping every contributing source." },
      { label: "Validate and Score", detail: "Refuses an indicator below the confidence threshold. valid_until is set only where the provider states an expiry." },
      { label: "Enrich Indicators", detail: "Attaches first seen, last seen and the threat activity already linked to it." },
      SEND_TO_REPOSITORY,
    ],
  },
  {
    key: "vuln",
    label: "Vulnerability Monitoring",
    origin: "inventory",
    sourceCategory: "Vulnerability Monitoring",
    stages: [
      { label: "Collect Advisories", detail: "Polls vendor and national vulnerability sources." },
      { label: "Extract CVEs", detail: "Pulls CVE identifiers and affected products and versions." },
      { label: "Resolve CVSS and Source", detail: "Records each score with its scoring authority. Where authorities disagree, both are kept." },
      { label: "Check Exploitation Status", detail: "Determines whether a public exploit exists and whether it is exploited in the wild." },
      { label: "Match Client Technology", detail: "Tests the affected product against each client's recorded technology stack." },
      SEND_TO_REPOSITORY,
    ],
  },
  {
    key: "ransomware",
    label: "Ransomware Monitoring",
    origin: "inventory",
    sourceCategory: "Ransomware Monitoring",
    stages: [
      { label: "Monitor Leak Sites", detail: "Watches the tracked leak-site index for new postings." },
      { label: "Collect Victim Postings", detail: "Captures the posting and the claim made in it." },
      { label: "Extract Victim and Sector", detail: "Resolves the named organisation, its sector and its region." },
      { label: "Assess Client Relevance", detail: "Tests the victim sector and region against client profiles." },
      ANALYST_REVIEW,
      SEND_TO_REPOSITORY,
    ],
  },
  {
    key: "geopolitical",
    label: "Geopolitical Intelligence",
    origin: "inventory",
    sourceCategory: "Geopolitical Intelligence",
    gap: "CPX tagged five sources geopolitical in the delivered inventory. None are in the set loaded here. Collection also runs on the keyword and topic set CPX provides.",
    stages: [
      { label: "Monitor Sources", detail: "Watches the tagged feeds and runs the keyword and topic set." },
      { label: "Collect Reports", detail: "Retrieves the reporting and stores the response it received." },
      { label: "Extract Events and Entities", detail: "Pulls the event, the actors and the locations involved." },
      { label: "Assess Security Relevance", detail: "Separates a geopolitical event with a cyber consequence from general news." },
      { label: "Correlate Threat Activity", detail: "Links the event to actors and campaigns already held." },
      ANALYST_REVIEW,
      SEND_TO_REPOSITORY,
    ],
  },
  {
    key: "messaging",
    label: "Telegram and Messaging",
    origin: "inventory",
    sourceCategory: "Telegram and Messaging",
    gap: "Not committed to a release until the collection route is decided at open item E1. The monitored channel list is outstanding at E2.",
    stages: [
      { label: "Connect to Approved Channels", detail: "Reads only the channels on the approved list." },
      { label: "Collect Messages", detail: "Retrieves message metadata and content from those channels." },
      { label: "Extract Signals", detail: "Pulls claims, named victims and indicators out of the traffic." },
      { label: "Translate and Summarise", detail: "Produces an English summary alongside the original language." },
      ANALYST_REVIEW,
      SEND_TO_REPOSITORY,
    ],
  },
  {
    key: "commercial",
    label: "Commercial Feeds",
    origin: "connector",
    connectorNames: [
      "CrowdStrike Falcon X",
      "Anomali ThreatStream",
      "Google Threat Intelligence",
      "Sekoia",
    ],
    gap: "Commercial-feed API keys are supplied by CPX during development. A committed date is requested at open item A3.",
    stages: [
      { label: "Authenticate", detail: "Presents the credential held in Key Vault. The console never sees the value." },
      { label: "Validate Access", detail: "Confirms the subscription and the entitlements it carries." },
      { label: "Collect Intelligence", detail: "Retrieves reporting, indicators and actor profiles. MCP is preferred over API where the vendor offers it." },
      { label: "Extract Entities", detail: "Pulls actors, campaigns, malware and infrastructure." },
      { label: "Normalize Data", detail: "Maps STIX and TAXII by field; parses bespoke formats per source." },
      { label: "Correlate Intelligence", detail: "Links the vendor's view to what is already held and deduplicates the overlap." },
      SEND_TO_REPOSITORY,
    ],
  },
  {
    key: "soc",
    label: "SOC Feeds",
    origin: "connector",
    connectorNames: ["CPX SOC Feeds"],
    gap: "Read access across the managed-client base is outstanding at open item M1.",
    stages: [
      { label: "Collect Intelligence", detail: "Reads indicators, incidents and alerts across the managed estate, tenant by tenant." },
      { label: "Extract TTPs", detail: "Pulls the techniques and tooling observed in the incident." },
      { label: "Map to MITRE ATT&CK", detail: "Resolves each technique against the held table. An id that does not resolve is not used." },
      { label: "Extract Detection Content", detail: "Separates detection logic from narrative." },
      { label: "Process Sigma, YARA and Hunting Queries", detail: "Validates each rule and query before it can be published." },
      ANALYST_REVIEW,
      SEND_TO_REPOSITORY,
    ],
  },
  {
    key: "ctem",
    label: "CTEM",
    origin: "connector",
    connectorNames: ["CPX CTEM"],
    gap: "No integration route agreed yet.",
    stages: [
      { label: "Connect to CTEM", detail: "Opens the exposure-management integration." },
      { label: "Collect Exposure Findings", detail: "Retrieves current exposure findings across the estate." },
      { label: "Map to Client Assets", detail: "Resolves each finding to the client and asset it concerns." },
      { label: "Score Exposure", detail: "Records severity with the source that assigned it." },
      { label: "Correlate with Advisories", detail: "Links an exposure to any advisory already covering it." },
      SEND_TO_REPOSITORY,
    ],
  },
  {
    key: "spidersilk",
    label: "SpiderSilk",
    origin: "connector",
    connectorNames: ["spiderSilk"],
    gap: "Whether the agent is granted SpiderSilk access, and whether it consumes reviewed findings or the raw stream, are outstanding at open items F1 and F2.",
    stages: [
      { label: "Connect to SpiderSilk", detail: "Opens the attack-surface and exposure integration." },
      { label: "Collect Attack Surface", detail: "Retrieves external attack-surface mapping for the client estate." },
      { label: "Collect Leaked Credentials", detail: "Retrieves leaked-credential findings." },
      { label: "Redact Credential Values", detail: "Keeps the subject and drops the value. A credential value is never stored, not even masked." },
      { label: "Map to Client", detail: "Resolves each finding to the client whose estate it concerns." },
      ANALYST_REVIEW,
      SEND_TO_REPOSITORY,
    ],
  },
  {
    key: "mitre",
    label: "MITRE ATT&CK",
    origin: "connector",
    connectorNames: ["MITRE ATT&CK"],
    stages: [
      { label: "Fetch Framework Bundle", detail: "Retrieves the current ATT&CK release." },
      { label: "Parse Techniques and Tactics", detail: "Reads techniques, sub-techniques and their tactics." },
      { label: "Update Local Mapping", detail: "Refreshes the held table the drafting agent validates against." },
      { label: "Validate Existing References", detail: "Re-checks every technique already cited in a held advisory and flags any that no longer resolves." },
    ],
  },
  {
    key: "analyst",
    label: "Analyst Provided",
    origin: "analyst",
    gap: "Intelligence a CPX analyst writes by hand. It is treated equally with vendor intelligence once submitted.",
    stages: [
      { label: "Analyst Submits", detail: "An analyst records intelligence the feeds did not carry." },
      { label: "Attach Evidence", detail: "Evidence files are stored against the record." },
      { label: "Validate Fields", detail: "Checks the required fields are present before the record is accepted." },
      { label: "Assign TLP and Scope", detail: "Records the marking and whether the record is global or client-scoped." },
      SEND_TO_REPOSITORY,
    ],
  },
];

export function definitionFor(key: CategoryKey): CategoryDefinition {
  const d = CATEGORY_DEFINITIONS.find((c) => c.key === key);
  if (!d) throw new Error(`No category definition for ${key}`);
  return d;
}

// --- collection units -------------------------------------------------------
// A category counts sources, connectors or neither. One shape lets the card
// treat all three the same.

export interface CollectionUnit {
  id: string;
  name: string;
  enabled: boolean;
  itemsLast30d: number;
  lastSuccess: string | null;
  failing: boolean;
  blocked: boolean;
  neverCollected: boolean;
}

export function unitsFor(
  def: CategoryDefinition,
  sources: Source[],
  connectors: Connector[],
): CollectionUnit[] {
  if (def.origin === "inventory" && def.sourceCategory) {
    return sources
      .filter((s) => s.category === def.sourceCategory)
      .map((s) => ({
        id: s.id,
        name: s.name,
        enabled: s.enabled,
        itemsLast30d: s.itemsLast30d,
        lastSuccess: s.lastSuccess || null,
        failing: s.state === "failing",
        blocked: s.state === "blocked-needs-credential",
        neverCollected: s.state === "not-collected",
      }));
  }
  if (def.origin === "connector" && def.connectorNames) {
    const names = new Set(def.connectorNames.map((n) => n.toLowerCase()));
    return connectors
      .filter((c) => names.has(c.name.toLowerCase()))
      .map((c) => ({
        id: c.id,
        name: c.name,
        // A connector with no agreed route is not an enabled collector.
        enabled: c.connected && !c.noRouteYet,
        itemsLast30d: 0,
        lastSuccess: c.lastNewItemAt ?? null,
        failing: false,
        blocked: !c.connected && !c.noRouteYet,
        neverCollected: c.noRouteYet || !c.lastNewItemAt,
      }));
  }
  return [];
}


// --- derived status ---------------------------------------------------------
// Every value below comes from collection state already held on the units.
// Nothing here is fixture run data, which is why a category that has never
// collected reports "Pending" rather than a fabricated success rate.

export type RunState =
  | "pending"
  | "running"
  | "completed"
  | "partial"
  | "failed"
  | "awaiting-review";

export const RUN_STATE_LABEL: Record<RunState, string> = {
  pending: "Pending",
  running: "Running",
  completed: "Completed",
  partial: "Partial completion",
  failed: "Failed",
  "awaiting-review": "Awaiting analyst review",
};

export interface CategoryStatus {
  state: RunState;
  units: number;
  enabled: number;
  items: number;
  failing: number;
  blocked: number;
  neverCollected: number;
  lastCollection: string | null;
  /** One line naming what went wrong, or null when nothing did. */
  problem: string | null;
}

export function statusFor(
  def: CategoryDefinition,
  units: CollectionUnit[],
): CategoryStatus {
  const enabled = units.filter((u) => u.enabled).length;
  const failing = units.filter((u) => u.failing).length;
  const blocked = units.filter((u) => u.blocked).length;
  const neverCollected = units.filter((u) => u.neverCollected).length;
  const items = units.reduce((n, u) => n + u.itemsLast30d, 0);
  const lastCollection =
    units
      .map((u) => u.lastSuccess)
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1) ?? null;

  const state: RunState = (() => {
    // Nothing to run is pending, not completed. An empty category has not
    // succeeded at anything.
    if (units.length === 0 || enabled === 0) return "pending";
    if (lastCollection === null) return "pending";
    if (failing + blocked === units.length) return "failed";
    if (failing > 0 || blocked > 0) return "partial";
    // A pipeline whose last stage is a person is never "completed" by the
    // collector alone: the work waits on review.
    if (def.stages.some((s) => s.label === "Analyst Review")) return "awaiting-review";
    return "completed";
  })();

  const problem =
    blocked > 0 && failing > 0
      ? `${failing} failing, ${blocked} blocked and needing a credential`
      : blocked > 0
        ? `${blocked} blocked, needing a credential`
        : failing > 0
          ? `${failing} failing`
          : units.length > 0 && enabled === 0
            ? "Every unit in this category is disabled"
            : null;

  return {
    state,
    units: units.length,
    enabled,
    items,
    failing,
    blocked,
    neverCollected,
    lastCollection,
    problem,
  };
}

/** Which stages have run, given the category status.
 *
 * Stage-level state is inferred from the category, not stored per stage: the
 * backend does not yet emit per-stage progress, and inventing it would put a
 * fake progress bar in front of an analyst. When the collector reports stages,
 * this is the one function that changes.
 */
export function stageStates(status: CategoryStatus, stages: WorkflowStage[]): RunState[] {
  if (status.state === "pending") return stages.map(() => "pending");
  if (status.state === "failed") {
    // A failed run got as far as trying to collect, and no further.
    return stages.map((_, i) => (i === 0 ? "completed" : i === 1 ? "failed" : "pending"));
  }
  return stages.map((s) => {
    if (s.label === "Analyst Review") {
      return status.state === "awaiting-review" ? "awaiting-review" : "completed";
    }
    if (s.label === "Send to Repository") {
      return status.state === "awaiting-review" ? "pending" : "completed";
    }
    return status.state === "partial" ? "partial" : "completed";
  });
}

/** Next scheduled collection, stated honestly.
 *
 * The scheduler ships off by default, so the truthful answer is usually that
 * nothing is scheduled rather than a time that will not arrive.
 */
export function nextCollectionLabel(schedulerOn: boolean, rhythm?: string): string {
  if (!schedulerOn) return "Not scheduled, scheduler is off";
  return rhythm ? `Next ${rhythm} sweep` : "On the next sweep";
}
