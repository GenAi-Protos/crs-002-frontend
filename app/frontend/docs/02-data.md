# Data and fixtures

Frontend only. These are the shapes the UI renders. There is no API.

Put types in `lib/types.ts`, fixtures in `fixtures/`, access logic in `lib/access.ts`, defanging in `lib/defang.ts`.

---

## Shared

```ts
export type Tlp = "CLEAR" | "GREEN" | "AMBER" | "AMBER+STRICT" | "RED";
export type RoleKey = "analyst" | "lead-analyst" | "incident-responder"
                    | "leadership" | "executive" | "sales";

export interface ConsoleUser {
  id: string;
  name: string;
  role: RoleKey;
  clientScope: "all" | string[];   // sales is scoped, everyone else is "all"
  seesRawIocs: boolean;            // FALSE for leadership, executive, sales
  canApprove: boolean;             // lead-analyst only
}
```

**`seesRawIocs: false` is enforced at payload assembly.** Strip the indicator objects and render the count: `14 indicators, withheld at this access level`. Never render then hide.

---

## PIRs

**`fixtures/pirs.json` is supplied and correct.** It is derived verbatim from `data/pirs-source.md`, which is a straight extraction of CPX's `PIRs.xlsx`. **Do not regenerate it. Never invent a category.** A previous build invented five categories and reassigned PIRs wholesale, which made the primary screen wrong at the root.

```ts
export type PirCategory =
  | "Enterprise" | "Industry Threat and Events" | "Vulnerabilities"
  | "Global Threat and Events" | "Geopolitical Threat and Events"
  | "Deep and Dark Web" | "Major Cyber Event";

export type ParameterKey = "client" | "industry" | "techStack";

export interface Pir {
  ref: string;                     // "PIR13"
  category: PirCategory;
  question: string;                // verbatim, including CPX's own grammatical slips
  coverage: string;                // one of ten values
  stixNative: boolean;             // four coverage values have no STIX 2.1 equivalent
  parameters: ParameterKey[];
  parametersUnverified: boolean;   // true on all 23 non-PIR24 rows
}
```

Nine PIRs carry a `[Client]` placeholder: **PIR1, 3, 6, 8, 13, 14, 15, 16, 19.** PIR24 is the only fully parameter-free one.

The four sheets that would resolve the parameters (Tech Stack, Industry, Threat Groups, Malware) shipped **hidden, dimensioned A1:A1, empty, with no data validations**. Render `Parameters pending` naming the pending key. **Never invent the values.**

---

## Findings and clients

```ts
export interface PirHit {
  id: string;
  pirRef: string;
  category: PirCategory;
  title: string;
  firedAt: string;                 // ISO UTC, rendered GST
  confidence: number;              // 0-100
  confidenceReason: string;        // mandatory, one line, never a bare score
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
  score: number;                   // 0-1
  reasons: { dimension: "client" | "product" | "sector" | "region";
             matched: string;      // "Fortinet FortiOS 7.4"
             text: string }[];     // the plain-language line the UI renders
}

export interface Client {
  id: string;                      // "CLT-027"
  name: string;
  sector: string;
  region: string;
  products: string[];              // drives PIR13 to PIR16
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
  kind: "leaked-credential" | "impersonating-domain" | "phishing-campaign" | "brand-abuse";
  subject: string;                 // NEVER a credential value, not even masked
  firstSeen: string;
  severity: string;
  status: "new" | "triaged" | "closed";
}
```

**A relevance score with no reason is not shippable**, same rule as confidence. `RelevanceMatch` is always fetched scoped to one `clientId`. Never assemble across clients and filter in the component.

---

## Reports

```ts
export type SendBackReason =
  | "mitre-validation-failed" | "kql-validation-failed"
  | "cvss-conflict-unresolved" | "factual-correction"
  | "missing-citation" | "house-style";

export interface Advisory {
  ref: string;                     // "CPX-TIC-IA-2026-352"
  type: "IA" | "VA" | "DG" | "RFI";
  version: number;
  title: string;
  tlp: Tlp;
  status: "draft" | "in-review" | "published"
        | "superseded" | "withdrawn" | "abandoned" | "retracted" | "did-not-run";
  owner?: string;
  pirRefs: string[];
  clientIds: string[];
  sections: { id: string; heading: string; body: string;
              generated: boolean;
              derivedFrom?: "citation" | "template" | "model-knowledge" | "validator";
              citations: Citation[] }[];
  techniques: { tacticId: string; techniqueId: string; techniqueName: string;
                resolved: boolean; observedActivity: string }[];
  cvss: { cveId: string; value: number; vector?: string;
          source: string; authorityClass: "nvd" | "cna" | "adp" | "vendor";
          assessedAt: string }[];
  checks: { id: string; label: string; passed: boolean;
            blocking: boolean; anchorSectionId?: string }[];
  sendBacks: { at: string; by: string; reason: SendBackReason }[];
  supersedes?: string;
  supersededBy?: string;
  createdAt: string;
  publishedAt?: string;            // keep the timestamps even though no UI shows them
  approvedAt?: string;
  approvedBy?: string;
}

export interface Citation {
  id: string;
  ref: number;                     // the [3] marker
  label: string;
  recordCount: number;             // zero is a first-class value
  url?: string;
  urlSafe: boolean;                // DEFAULT FALSE. Opt in, never out.
  snapshotAt?: string;             // set when a live lookup is frozen at publish
}
```

**Ref format:** `CPX-TIC-{IA|VA}-{year}-{seq}`. Parse it, never treat it as a string. The sequence resets each January, so two objects can be `-352` in different years.

**Refs are reserved at draft creation**, so `withdrawn` and `abandoned` leave gaps. Render them greyed with a reason so a gap never reads as a missing advisory.

**Keep `createdAt`, `approvedAt` and `publishedAt` even though nothing renders them.** CPX measures time-to-publish against those.

**Section heading lists are fixed per type** and come from CPX's three real advisories:
- **IA:** Executive Summary · TIC Analysis · Campaign Overview · Attack Chain Overview · TTPs Mapping · Indicators · Recommendations
- **VA:** adds Impact · CVSS v3 Base Score · Affected Products and Versions · Existence of Public Exploit · Exploit Status · Detection and Hunting · Mitigation and Recommendation

The **TTPs Mapping** section is mandatory. Mohanasundaram, 31 July: *"this is something every client is expecting right now."*

---

## Intelligence

**Flat, not a tree.** A previous design specified branching turns with fork switchers and three regenerate modes. CPX's own reference product shows no thread UI at all. Regeneration supersedes the previous turn in place.

```ts
export interface Investigation {
  id: string;
  title: string;                   // agent-generated from turn 1
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
  title?: string;                  // only when the answer is document-shaped
  blocks: AnswerBlock[];
  entities: { id: string; name: string; type: string }[];
  citations: Citation[];
  negativeResults: { query: string; recordCount: number }[];   // always rendered
  sourcesUnavailable: string[];    // renders as one line if non-empty
  tlp: Tlp;
  classificationSettled: boolean;  // TLP renders only when true
  egress: boolean;                 // a query left the UAE region
  producedArtefact?: { ref: string; type: "IA" | "VA" };
}

export type AnswerBlock =
  | { kind: "prose"; text: string; attribution?: string }   // "Source: CrowdStrike Falcon X"
  | { kind: "list"; items: string[] }
  | { kind: "table"; headers: string[]; rows: string[][] }
  | { kind: "indicators"; values: string[] };                // rendered defanged, inert
```

**`classificationSettled` matters.** TLP is the most restrictive marking across matched records, so it is only correct once every record is in. Rendering a provisional marking that later escalates is a disclosure event, not a cosmetic bug. Show `Classification pending` until it settles.

**`negativeResults` always renders**, with the count in bold: `secur32 strings: 0 records`. A negative gets the same typographic weight as a positive so the analyst can tell the search actually ran.

---

## Collection

```ts
export type CollectorClass = "feed" | "bulk" | "scrape" | "social" | "portal";
export type CaptureMode = "hold-body" | "hold-plus-revalidate"
                        | "snapshot-series" | "live-only" | "keyword-search";
export type Rhythm = "continuous" | "hourly" | "daily" | "weekly";

export interface Source {
  id: string;
  name: string;                    // CPX column 1
  url: string;                     // CPX column 2. INERT TEXT. Never an anchor.
  sheet: "Primary" | "Secondary" | "Vuln_Monitoring" | "Ransomware_Monitoring" | "Indicators";
  collectorClass: CollectorClass;  // DERIVED from the URL pattern
  captureMode: CaptureMode;        // DERIVED. Not a setting.
  enabled: boolean;                // editable
  expectedRhythm: Rhythm;          // editable. Governs the ALARM, not the poll.
  pirRefs: string[];               // editable
  lastAttempt: string;
  lastSuccess: string;
  lastNewItemAt: string;           // THE FIELD THAT MATTERS
  itemsLast30d: number;
  consecutiveFailures: number;
  state: "healthy" | "silent-expected" | "silent-unexplained" | "failing"
       | "blocked-needs-credential" | "not-collected";
  residency: "in-region" | "egress";   // DERIVED from the host
  dailyItems: { date: string; attempted: number; items: number }[];  // 30 days, for the heatmap
}

export interface Connector {
  id: string;
  name: string;
  captureMode: CaptureMode;        // shown as Held / Live / Both
  connected: boolean;
  verified: boolean;               // false for Anomali: tool surface published nowhere
  ourProposal: boolean;            // true for NVD, CISA KEV, EPSS, MITRE
  noRouteYet: boolean;             // true for SOC feeds, CTEM, spiderSilk
  lastNewItemAt?: string;
  residency: "in-region" | "egress";
}

export interface KeywordWatch {
  id: string; name: string; terms: string[];
  language: string; region: string;
  pirRefs: string[]; cadence: Rhythm;
  lastRun?: { at: string; results: { sourceName: string; count: number }[] };
}

export interface SourceRequest {
  id: string; url: string; reason: string; pirRef: string;
  requestedBy: string; requestedAt: string;
  status: "auto-approved" | "queued" | "approved" | "rejected" | "blocked-network";
  note?: string;
}
```

### The three timestamps are not interchangeable

`lastAttempt` · `lastSuccess` · `lastNewItemAt` are **three separate fields**. A source returning HTTP 200 with no new items sets the first two and not the third. That is precisely how the failure hides, and it is the one thing the whole Collection screen exists to catch.

**`lastNewItemAt` can never be later than `lastSuccess`.** You cannot receive an item without a successful fetch. Assert it when generating fixtures.

### Fixture rules for sources

- **185 rows exactly**, split `Primary 87 · Secondary 19 · Vuln_Monitoring 40 · Ransomware_Monitoring 6 · Indicators 33`.
- CPX's file has **two columns only**, `Source` and `Link`. Everything else in `Source` is ours, derived.
- **No `authType`.** Exactly one row in the real inventory carries any credential.
- **Derive `residency` from the host at render time.** Do not store a fabricated split.
- Class distribution is roughly `feed 121-123 · bulk 30-32 · scrape 28 · social 2 · portal 2`. These are **estimates with contested boundaries**. Derive at render; never print a hard-coded breakdown.
- Include the silent-failure case: a source with a fresh `lastSuccess`, a `lastNewItemAt` nine days old, and `consecutiveFailures: 0`.

---

## Fixture set

| File | Rows | Must contain |
|---|---|---|
| `pirs.json` | 24 | **Supplied. Do not regenerate.** |
| `users.json` | 6 | One per role. `seesRawIocs: false` on leadership, executive, sales. Sales `clientScope` is a list. |
| `clients.json` | 4 | One with `profileComplete: false` |
| `pir-hits.json` | 30 | Spread over 14 days. Every category represented. Categories must match `pirs.json`. |
| `advisories.json` | 40 | Across 2024-2026. One superseded pair, one withdrawn leaving a gap, one `did-not-run` digest, one RFI in progress. |
| `advisory-draft.json` | 1 IA, 1 VA | The VA carries the CVSS conflict: two authorities ranking the same CVEs in opposite order. Every `generated: true` section has a citation **or** a `derivedFrom`. |
| `investigations.json` | 3 | One with a `negativeResults` block, one with `sourcesUnavailable`, one that produced an advisory. |
| `sources.json` | 185 | Per the rules above. |
| `connectors.json` | 13 | **All `connected: false`.** Anomali `verified: false`. Four `ourProposal: true`. Three `noRouteYet: true`. |
| `keyword-watches.json` | 3 | Seeded from PIR17, PIR18, PIR19. One with a zero-result run. |
| `source-requests.json` | 3 | One auto-approved, one queued, one `blocked-network`. |
| `deliveries.json` | 20 | Referencing real advisory refs and versions. |
| `drp-items.json` | 5 | No credential values. |

**One fixture file per concept.** A previous build shipped two contradictory source-health fixtures with different vocabularies. Do not do that.
