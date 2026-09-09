// Shapes per docs/02-data.md. Fixtures are the contract: no API exists.

export type Tlp = "CLEAR" | "GREEN" | "AMBER" | "AMBER+STRICT" | "RED";
export type RoleKey =
  | "analyst"
  | "lead-analyst"
  | "incident-responder"
  | "leadership"
  | "executive"
  | "sales";

export interface ConsoleUser {
  id: string;
  name: string;
  role: RoleKey;
  clientScope: "all" | string[]; // sales is scoped, everyone else is "all"
  seesRawIocs: boolean; // FALSE for leadership, executive, sales
  canApprove: boolean; // lead-analyst only
}

// PIRs

export type PirCategory =
  | "Enterprise"
  | "Industry Threat and Events"
  | "Vulnerabilities"
  | "Global Threat and Events"
  | "Geopolitical Threat and Events"
  | "Deep and Dark Web"
  | "Major Cyber Event";

export type ParameterKey = "client" | "industry" | "techStack";

export interface Pir {
  ref: string; // "PIR13"
  category: PirCategory;
  question: string; // verbatim, including CPX's own grammatical slips
  coverage: string;
  stixNative: boolean;
  parameters: ParameterKey[];
  parametersUnverified: boolean;
}

// Findings and clients

export interface PirHit {
  id: string;
  pirRef: string;
  category: PirCategory;
  title: string;
  firedAt: string; // ISO UTC, rendered GST
  confidence: number; // 0-100
  confidenceReason: string; // mandatory, one line, never a bare score
  sourceIds: string[];
  entityIds: string[];
  affectedClients: string[];
  tlp: Tlp;
  status: "new" | "triaged" | "dismissed" | "false-positive" | "escalated";
  assignedTo?: string;
}

export interface RelevanceMatch {
  hitId: string;
  clientId: string;
  score: number; // 0-1
  reasons: {
    dimension: "client" | "product" | "sector" | "region";
    matched: string;
    text: string;
  }[];
}

export interface Client {
  id: string; // "CLT-027"
  name: string;
  sector: string;
  region: string;
  products: string[]; // drives PIR13 to PIR16
  subscribedPirRefs: string[];
  profileComplete: boolean;
}

export interface Delivery {
  advisoryRef: string;
  advisoryVersion: number;
  clientId: string;
  sentAt: string;
  channel: string;
  format: "pdf" | "json";
}

export interface DrpItem {
  id: string;
  clientId: string;
  kind:
    | "leaked-credential"
    | "impersonating-domain"
    | "phishing-campaign"
    | "brand-abuse";
  subject: string; // NEVER a credential value, not even masked
  firstSeen: string;
  severity: string;
  status: "new" | "triaged" | "closed";
}

// Reports

export type SendBackReason =
  | "mitre-validation-failed"
  | "kql-validation-failed"
  | "cvss-conflict-unresolved"
  | "factual-correction"
  | "missing-citation"
  | "house-style";

export interface AdvisorySection {
  id: string;
  heading: string;
  body: string;
  generated: boolean;
  derivedFrom?: "citation" | "template" | "model-knowledge" | "validator";
  citations: Citation[];
}

// --- Diamond Model ----------------------------------------------------------
// Carried by a Threat Actor Profile only (FR-ADV-07). Structured rather than
// prose for the same reason techniques and CVSS are: the four vertices are a
// fixed schema, so they render as a diagram, export as a table, and cannot be
// half-filled without the gap being visible.

export type DiamondVertex =
  | "adversary"
  | "capability"
  | "infrastructure"
  | "victim";

export interface DiamondEdge {
  source: DiamondVertex;
  target: DiamondVertex;
  // What links the two, in the analyst's words.
  label: string;
}

export interface DiamondModel {
  adversary: string;
  capability: string;
  infrastructure: string;
  victim: string;
  // The model is the vertices AND the edges. Four filled boxes with no
  // relationships is not an analysis, and the panel says so rather than
  // implying the work is done.
  edges: DiamondEdge[];
}

export interface Advisory {
  ref: string; // "CPX-TIC-IA-2026-352"
  type: "IA" | "VA" | "DG" | "RFI" | "TAP";
  version: number;
  title: string;
  tlp: Tlp;
  status:
    | "draft"
    | "in-review"
    | "published"
    | "superseded"
    | "withdrawn"
    | "abandoned"
    | "retracted"
    | "did-not-run"
    // A shelf, not a bin. The artefact stays readable and stays in the ledger.
    | "archived";
  owner?: string;
  pirRefs: string[];
  clientIds: string[];
  sections: AdvisorySection[];
  techniques: {
    tacticId: string;
    techniqueId: string;
    techniqueName: string;
    resolved: boolean;
    observedActivity: string;
  }[];
  cvss: {
    cveId: string;
    value: number;
    vector?: string;
    source: string;
    authorityClass: "nvd" | "cna" | "adp" | "vendor";
    assessedAt: string;
  }[];
  // Set on a Threat Actor Profile only. Absent on every other report type.
  diamond?: DiamondModel;
  checks: {
    id: string;
    label: string;
    passed: boolean;
    blocking: boolean;
    anchorSectionId?: string;
  }[];
  sendBacks: { at: string; by: string; reason: SendBackReason }[];
  supersedes?: string;
  supersededBy?: string;
  // RFI work-order fields
  rfi?: {
    requester: string;
    question: string;
    clientId: string;
    dueAt: string;
    steps: { label: string; done: boolean; investigationId?: string }[];
  };
  // Which template the report was created from. Recorded once, at creation,
  // and shown in the editor so a reader knows which structure they are in.
  template?: { kind: "standard" | "custom"; name: string };
  createdAt: string;
  publishedAt?: string; // keep the timestamps even though no UI shows them
  approvedAt?: string;
  approvedBy?: string;
  withdrawnReason?: string;
}

export interface Citation {
  id: string;
  ref: number; // the [3] marker
  label: string;
  recordCount: number; // zero is a first-class value
  url?: string;
  urlSafe: boolean; // DEFAULT FALSE. Opt in, never out.
  snapshotAt?: string; // set when a live lookup is frozen at publish
}

// Intelligence

export interface Investigation {
  id: string;
  title: string; // agent-generated from turn 1
  createdAt: string;
  createdBy: string;
  turns: Turn[];
}

export interface Turn {
  id: string;
  question: string;
  status: "streaming" | "complete" | "stopped" | "failed" | "superseded";
  answer?: Answer;
  supersededBy?: string;
}

export interface Answer {
  title?: string; // only when the answer is document-shaped
  blocks: AnswerBlock[];
  entities: { id: string; name: string; type: string }[];
  citations: Citation[];
  negativeResults: { query: string; recordCount: number }[]; // always rendered
  sourcesUnavailable: string[]; // renders as one line if non-empty
  sourcesTotal?: number;
  tlp: Tlp;
  classificationSettled: boolean; // TLP renders only when true
  egress: boolean; // a query left the UAE region
  producedArtefact?: { ref: string; type: "IA" | "VA" };
}

export type AnswerBlock =
  | { kind: "prose"; text: string; attribution?: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; headers: string[]; rows: string[][] }
  | { kind: "indicators"; values: string[] }; // rendered defanged, inert

// Collection

export type CollectorClass = "feed" | "bulk" | "scrape" | "social" | "portal";
export type CaptureMode =
  | "hold-body"
  | "hold-plus-revalidate"
  | "snapshot-series"
  | "live-only"
  | "keyword-search";
export type Rhythm = "continuous" | "hourly" | "daily" | "weekly";

// What kind of source this is, in the analyst's language. CPX categorised the
// inventory this way in the 2 September mockup, and BRD 7.1 splits inputs the
// same way: internal CPX sources and external sources.
//
// This is a different axis from `sheet`. `sheet` is provenance - which tab of
// TI Sources and Feeds v0.1 a row came from. `category` is what the source is.
// Both are kept: the sheet counts are contractual under FR-ING-01.
export type SourceCategory =
  | "OSINT Feeds"
  | "IOC Feeds"
  | "Vulnerability Monitoring"
  | "Ransomware Monitoring"
  | "Geopolitical Intelligence"
  | "Telegram and Messaging";

export interface Source {
  id: string;
  name: string; // CPX column 1
  url: string; // CPX column 2. INERT TEXT. Never an anchor.
  sheet:
    | "Primary"
    | "Secondary"
    | "Vuln_Monitoring"
    | "Ransomware_Monitoring"
    | "Indicators";
  collectorClass: CollectorClass; // DERIVED from the URL pattern
  captureMode: CaptureMode; // DERIVED. Not a setting.
  category: SourceCategory; // DERIVED from the sheet, the name and the URL
  enabled: boolean; // editable
  expectedRhythm: Rhythm; // editable. Governs the ALARM, not the poll.
  pirRefs: string[]; // editable
  lastAttempt: string;
  lastSuccess: string;
  lastNewItemAt: string; // THE FIELD THAT MATTERS
  itemsLast30d: number;
  consecutiveFailures: number;
  state:
    | "healthy"
    | "silent-expected"
    | "silent-unexplained"
    | "failing"
    | "blocked-needs-credential"
    | "not-collected";
  residency: "in-region" | "egress"; // DERIVED from the host
  dailyItems: { date: string; attempted: number; items: number }[]; // 30 days
}

export interface Connector {
  id: string;
  name: string;
  captureMode: CaptureMode; // shown as Held / Live / Both
  connected: boolean;
  verified: boolean; // false for Anomali: tool surface published nowhere
  ourProposal: boolean; // true for NVD, CISA KEV, EPSS, MITRE
  noRouteYet: boolean; // true for SOC feeds, CTEM, spiderSilk
  lastNewItemAt?: string;
  residency: "in-region" | "egress";
}

export interface KeywordWatch {
  id: string;
  name: string;
  terms: string[];
  language: string;
  region: string;
  pirRefs: string[];
  cadence: Rhythm;
  lastRun?: { at: string; results: { sourceName: string; count: number }[] };
}

export interface SourceRequest {
  id: string;
  url: string;
  reason: string;
  pirRef: string;
  requestedBy: string;
  requestedAt: string;
  status:
    | "auto-approved"
    | "queued"
    | "approved"
    | "rejected"
    | "blocked-network";
  note?: string;
}


// --- Agents -----------------------------------------------------------------
// The agent specification view CPX asked for on 2 September 2026 (Praveen
// Singh, 13:45): purpose, instruction, skills, tools, scripts, sources,
// workflows, permissions, instruction version and update count. Read-only for
// every console user who can reach Manage; the administrator alone edits.

export type AgentKind = "supervisor" | "specialist";

export interface AgentTool {
  name: string;
  purpose: string;
  // True only for a tool that leaves the UAE region. The console says which
  // ones do, because NFR-SEC-04 confines everything else in-region.
  egress: boolean;
}

export interface AgentSkill {
  name: string;
  description: string;
}

export interface AgentInstruction {
  version: number;
  updatedAt: string;
  updatedBy: string;
  // The instruction text itself. Never a credential: NFR-SEC-02.
  text: string;
}

export interface Agent {
  id: string;
  name: string;
  kind: AgentKind;
  // One sentence. What this agent is for, in the analyst's language.
  purpose: string;
  // A supervisor lists the specialists it dispatches; a specialist lists none.
  dispatches: string[];
  skills: AgentSkill[];
  tools: AgentTool[];
  // Source ids this agent draws on, or "held-corpus" for the repository.
  sourceRefs: string[];
  workflowRefs: string[];
  // What the agent may do. Publishing is never one of them: FR-ADV-05.
  permissions: string[];
  instruction: AgentInstruction;
  // How many times the instruction has been changed. FR-WFL and the version
  // history CPX asked for (Praveen Singh, 51:28).
  updateCount: number;
  // "specified" is an honest state, not a failure: the BRD defines the agent
  // and it is not built yet. Saying so is better than an empty success rate.
  status: "active" | "idle" | "disabled" | "specified";
  lastRunAt: string | null;
  // Where the specification came from, so a reader can check it.
  basis: string;
}

// --- Workflows --------------------------------------------------------------
// The workflow library CPX asked for on 2 September 2026 (Praveen Singh, 29:21
// to 31:45) and FR-WFL-01: what runs, which agents it dispatches, which tools
// and sources it touches, who approves it, and which version is current.
//
// A workflow is a definition, not a run. Run counts live beside it and are
// honest: nothing has run, so nothing claims to have.

export type WorkflowStatus = "published" | "draft" | "disabled";

export type WorkflowTrigger =
  | "analyst-request"
  | "scheduled"
  | "on-collection"
  | "on-approval";

export interface WorkflowStep {
  label: string;
  // Which agent carries this step. Lets a reader cross from a workflow to the
  // agent that runs it rather than guessing.
  agentRef: string;
  detail: string;
}

export interface Workflow {
  ref: string; // "wf-query"
  name: string;
  purpose: string;
  status: WorkflowStatus;
  trigger: WorkflowTrigger;
  triggerDetail: string;
  agentRefs: string[];
  toolNames: string[];
  // Category labels, or "Held repository". Never a source URL: FR-SAF-01.
  sourceScope: string[];
  // Publishing is never automated: FR-ADV-05, FR-VUL-04.
  approval: "none" | "lead-analyst";
  version: string; // "v2.0"
  owner: string;
  updatedAt: string;
  updateCount: number;
  steps: WorkflowStep[];
  outputs: string[];
  lastRunAt: string | null;
  runsLast30d: number;
  basis: string;
  // What this workflow is waiting on, where it is waiting on something.
  gap?: string;
}

// --- IOC lookup and investigation -------------------------------------------
// Lookup is the quick check on one observable. Investigation is the picture
// around it: Observable > infrastructure > malware > actor > campaign > TTPs >
// detection content.
//
// Every value here is stored raw and rendered defanged (FR-SAF-03). The demo
// records use reserved documentation ranges only: TEST-NET-2 and TEST-NET-3
// addresses and .example domains, so nothing on this screen resolves.

export type ObservableKind = "ip" | "domain" | "hash";

export type LookupVerdict = "malicious" | "suspicious" | "benign" | "unknown";

export interface ProviderVerdict {
  provider: string;
  // Mirrors the backend reputation statuses so one card renders both sources.
  status: string;
  verdict: LookupVerdict | null;
  score: number | null;
  categories: string[];
  error: string | null;
  checkedAt?: string;
}

export interface DnsRecord {
  type: string;
  value: string;
  ttl: number;
}

export interface DetectionContent {
  kind: "yara" | "sigma" | "hunting";
  name: string;
  ref: string;
  note: string;
}

export interface InvestigationGraph {
  // Stage 2. Infrastructure seen with the observable.
  infrastructure: { value: string; kind: ObservableKind; note: string }[];
  // Stage 3.
  malware: { name: string; family: string; note: string }[];
  // Stage 4.
  actors: { name: string; aliases: string[]; note: string }[];
  // Stage 5.
  campaigns: { name: string; ref: string; note: string }[];
  // Stage 6. Ids only: the name derives from the held ATT&CK table.
  techniques: { id: string; observed: string }[];
  // Stage 7.
  detections: DetectionContent[];
}

interface LookupBase {
  observable: string;
  verdict: LookupVerdict;
  riskScore: number; // 0 to 100
  // Mandatory, one line. A score never renders on its own.
  verdictReason: string;
  firstSeen: string;
  lastSeen: string;
  threatCategories: string[];
  tlp: Tlp;
  providers: ProviderVerdict[];
  recordCount: number;
  investigation: InvestigationGraph;
}

export interface IpLookup extends LookupBase {
  kind: "ip";
  country: string;
  asn: string;
  asnOrg: string;
  organisation: string;
  associatedDomains: string[];
}

export interface DomainLookup extends LookupBase {
  kind: "domain";
  registrar: string;
  createdAt: string;
  classification: string;
  dnsRecords: DnsRecord[];
  associatedIps: string[];
  relatedDomains: string[];
}

export interface HashLookup extends LookupBase {
  kind: "hash";
  detectionRatio: { detected: number; total: number };
  fileName: string;
  fileType: string;
  fileSize: number; // bytes
  malwareFamily: string;
  behaviours: string[];
}

export type LookupRecord = IpLookup | DomainLookup | HashLookup;
