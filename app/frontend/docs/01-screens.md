# Screens

## Current implementation: September 2026

The following behaviors supersede the historical layout notes below where they
conflict. The agreed first delivery focuses on the requested features; editable
generated charts and diagrams remain follow-on work.

- **Investigations** is the seventh destination, at `/investigations` and
  `/investigations/[id]`. Shared cases have a title, objective, entities, global or
  single-client scope, priority, assignee, selected specialists and selected
  sources. The four detail areas are Overview, Agents and evidence, Findings and
  pivots, and Report. Evidence excerpts, provenance, negative results, errors,
  contradictions and coverage remain inspectable. Exclusion and rerun require a
  reason. Review and completion states follow report actions.
- **Intelligence** retains Ask and IOC Lookup as quick tools. Its uploads support
  PDF, DOC/DOCX, XLS/XLSX, CSV, JPG/JPEG and PNG: at most 10 files, 25 MiB per file
  and 100 MiB combined. Processing, partial extraction and failure are visible.
  Conversation memory and files remain owner-private. Add to investigation
  explicitly promotes a selected answer/lookup and selected files. Unavailable
  workflows cannot be selected; deep investigation belongs in the case section.
- **Dashboard** uses six distinct server payloads at `/dashboard/views/{role}`.
  Analyst: own cases/drafts and PIR triage. Lead: approval/change queues, team
  workload and failures. IR: observable cases, detection guidance and source
  limitations. Leadership: releases and delivery coverage. Executive: published
  themes and sector/region exposure. Sales: own clients and published briefings.
  Period and client filters preserve server scope. Missing measurements show
  Not recorded. Executive/Sales drilldowns fetch reduced published summaries.
- **Collection / Sources** combines connectors and analyst submissions. Add
  Source collects Intelligence Title, Description, Source Name, editable Source
  Category (Analyst Provided by default), Collection/Observation Date, TLP,
  Confidence, Client Scope, Tags and Evidence File. Description or a file is
  required. Submission is idempotent; indexing, partial and failed states expose
  retry. Request connector stays separate.
- **Reports** persist edits with revision-checked Save before workflow actions.
  Section-based case RFI drafts use the editor too. Submit, approve, send back
  and issue update use server endpoints and timestamps. Updated evidence requires
  report regeneration before approval. Conflicts preserve local edits until the
  analyst explicitly reloads. Checks are recalculated from saved content.

New operational flows never silently substitute fixture results. Browser
acceptance instructions are in [06-workspace-verification.md](06-workspace-verification.md).

Seven destinations: Dashboard, Intelligence, Investigations, Reports, Clients, Collection and Manage. Read the layouts, not the prose.

**Shell:** white 60px top bar and white 176px left rail, both with a hairline (64px icons below 1100px); the active destination sits on a green wash with a 3px green bar. The CSD-007 style guide is the visual reference.

The console runs inside a Microsoft Teams tab, so the shell is the same fixed-height box the other CPX Teams tab uses (CSD-007 style guide §5): the body never scrolls, `<main>` is the one scroll region and is keyboard-scrollable (`tabIndex=0`), sticky bars and the composer measure against the tab rather than the window, and the scrollbar gutter is always reserved so a long table never looks like it ends. Nothing on a screen may assume it owns the browser viewport: no `fixed` chrome inside a page, no `100vh` page roots; a page that wants the full height takes `flex-1` of the template wrapper.
Top bar: CPX primary logo · Nestor mark and wordmark · Live chip · search · role switcher (dev only) · user chip.

**Every list:** search box · stated default sort · cursor pagination with an honest total (`Showing 50 of 431`) · CSV export.

**Every screen's states:**

| State | Rule |
|---|---|
| Loading | Skeleton at final geometry. No layout shift. Never a bare spinner. |
| Empty | Distinguish three: nothing matched · not connected · not permitted. Different copy, different action. |
| Partial | A source was down. Say so in one line. Never fail the whole thing. |
| Zero | Render the count. `0 records` in bold. Never silence, never an illustration. |
| Error | One sentence naming the thing and the fix. |

---

## 1 · Dashboard `/`

Everyone lands here. Content resolves from the role. **Maximum four blocks per role.** Each block is a number with a trend, or one chart, or one short list. Not a gallery.

Every view carries an `as of HH:MM GST` stamp so it is an addressable, refreshable object rather than a frozen snapshot. Leadership and Sales views carry `Export this view`.

```
┌──────┬────────────────────────────────────────────────────┐
│ Dash◄│  Dashboard                        as of 08:15 GST  │
│ Int  │  ┌──────────────────┐ ┌───────────────────────────┐│
│ Rep  │  │ Waiting on you   │ │ Fired today by PIR        ││
│ Cli  │  │        7         │ │ Enterprise         12     ││
│ Col  │  │   → Reports      │ │ Vulnerabilities     8     ││
│      │  └──────────────────┘ │ Deep and Dark Web   3     ││
│      │                       └───────────────────────────┘│
│      │  ┌────────────────────────────────────────────────┐│
│      │  │ Relevant today                                 ││
│      │  │  wp2shell RCE          CLT-027  PIR13  92%  →  ││
│      │  │  DPRK supply chain     CLT-014  PIR08  87%  →  ││
│      │  └────────────────────────────────────────────────┘│
│      │  ⚠ 4 sources silent                   → Collection │
└──────┴────────────────────────────────────────────────────┘
```

| Role | Blocks |
|---|---|
| Analyst, Lead | Waiting on you · Fired today by PIR · Relevant today · Collection health **only when something is silent** |
| Leadership | Published this period · Client coverage · Time to publish · Export |
| CEO | Posture in one sentence · Regional versus global · Sector exposure |
| Sales | Delivered to my clients · Cadence by month · Sector benchmark · Export |

The current dashboard uses `/dashboard/views/{role}`. Each role has a distinct payload. The period selector supports 7/30/90 days; client filtering preserves backend scope. Absent measurements are labelled Not recorded. Summary drilldowns fetch published, reduced content; raw analyst payloads are not supplied to Sales or Executive.

**Row action on Relevant today:** `Draft advisory` pre-fills the Intelligence composer. Without it the analyst reads a hit then retypes its subject, which is the dead end that made the last design unusable.

**Empty:** `Nothing waiting.` Nothing else.

---

## 2 · Intelligence `/intelligence`

The composer and the scrollback. **This layout is copied from the Anomali Copilot screenshots CPX sent us as the benchmark.** No tabs, no session list, no filter chips, no facets.

```
┌──────┬────────────────────────────────────────────────────┐
│ Dash │           centred column, max 880px                │
│ Int◄ │  ┌──────────────────────────────────────────────┐  │
│ Rep  │  │ ◉  your question                             │  │
│ Cli  │  └──────────────────────────────────────────────┘  │
│ Col  │  ┌──────────────────────────────────────────────┐  │
│      │  │ ◈  Title, only if the answer is document-    │  │
│      │  │    shaped                                 ⧉  │  │
│      │  │                                              │  │
│      │  │    Prose, H2 sections, lists, tables.        │  │
│      │  │    Entity links blue underlined.             │  │
│      │  │    Indicators as grey monospace chips.       │  │
│      │  │    secur32 strings: 0 records                │  │
│      │  │                                              │  │
│      │  │    Source: CrowdStrike Falcon X, Actors      │  │
│      │  │ ──────────────────────────────────────────── │  │
│      │  │  Sources                                  ⌄  │  │
│      │  └──────────────────────────────────────────────┘  │
│      │  ┌──────────────────────────────────────────────┐  │
│      │  │ Ask a question                           [→] │  │
│      │  └──────────────────────────────────────────────┘  │
└──────┴────────────────────────────────────────────────────┘
      entity click → 480px right drawer, page does not change
```

**Two text treatments carry all the semantics.** Blue underline is a navigable entity. Grey monospace chip is a defanged observable: inert, never an anchor, never prefetched. TLP and severity are bullets in the answer body, not chrome.

**Multi-turn context is real and invisible.** "What about secur32.dll?" resolves against the previous turns. There is no thread UI, no branch switcher, no regenerate-mode selector.

**The user never chooses where the answer comes from, and the routing is never named.** Held corpus, live lookup and public keyword search are the system's decision. Attribution is per fact, in the prose. The whole provenance apparatus is one collapsed `Sources` row.

**One exception:** a query that left the UAE region carries a small egress marker in the `Sources` row. Residency is a written compliance requirement, not a curiosity.

**When sources were down:** one line, same weight as a zero count. `Produced with 4 of 13 sources unavailable.`

**Chrome on an answer:** copy, and export JSON. Nothing else.
**"Create an intelligence advisory for X"** is a prompt, not a destination. It returns the draft in the same card with one `Open in Reports` link.

**Empty:** a row of starter prompts above the composer. Nothing else. **Not** a six-section board - that is the Dashboard's job.

`/intelligence/[id]` exists so a conversation can be linked from an RFI row. It is never navigated to and there is no list of them.

---

## 3 · Reports `/reports`

```
┌──────┬────────────────────────────────────────────────────┐
│ Dash │  Reports                            [+ New report] │
│ Int  │  ┌ Needs review │ Drafts │ Published │ All ──────┐ │
│ Rep◄ │  │ Search ▢                    2026 ▾  IA VA DG │ │
│ Cli  │  ├──────────────────────────────────────────────┤ │
│ Col  │  │ Ref          Type Title        Owner   State │ │
│      │  │ IA-2026-352  IA   DPRK supp…   Rajesh  Review│ │
│      │  │ VA-2026-102  VA   wp2shell     Praveen Publ. │ │
│      │  │ DG-2026-0802 DG   Daily digest  -      Publ. │ │
│      │  │ rfi-001      RFI  In progress, 2 of 3 done   │ │
│      │  └──────────────────────────────────────────────┘ │
└──────┴────────────────────────────────────────────────────┘
```

Default tab **Needs review**. Search and a year selector are not optional: the digest alone is 365 rows a year.

**Owner column and an `Assign to me` control on the draft.** Praveen does dark and deep web, Rajesh does actors and vulnerabilities. Without an owner two analysts draft the same advisory.

**A digest row is created by the schedule, not by success**, so a failed run renders as `Did not run` rather than being invisible by absence.

**RFI is a work order, not a fourth document type.** One row reading `In progress, 2 of 3 done`, expanding to three lines, terminating in an ordinary Intelligence Advisory. `+ New report` for an RFI is a dialog: requester, question, client, due date.

### `/reports/[ref]`

```
┌──────────────────────────────────────────────────────────┐
│ IA-2026-352 · TLP:AMBER · v1 · PIR13 · Rajesh   [Assign] │ 56px sticky
├──────────────────────────────────────────────────────────┤
│ All checks passed.                                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│        the document, single editable column, 720px       │
│        fixed heading list per type, bodies free          │
│        MITRE row: enter the technique ID, name derives   │
│        CVSS row: score + authority, both required        │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  [Approve & publish]  [Send back]  [Override]            │
└──────────────────────────────────────────────────────────┘
```

**The document is the page.** No side panels, no agent narration, no validation panel.

**Checks are one line, not a panel.** Clean: `All checks passed.` Defective: `3 links have no target.` and `CVSS: prose follows WPScan; CISA-ADP ranks these CVEs in the opposite order.` Each is an anchor into the offending block. Blocking checks disable Approve and name themselves. The CVSS conflict **warns, never blocks** - that is an analyst's decision.

**Structure the MITRE and CVSS fields rather than accepting prose.** Three of the four defects in CPX's own published advisories become unrepresentable if you do: an invented technique name, a technique with no ID, and a tactic filed under the wrong heading.

**Published state** adds: the version banner, one line if superseded (`Superseded by CPX-TIC-IA-2027-118.`), the delivery record, and `Issue an update`. **A published document is immutable**; a correction is a new version.

**Send back requires a reason** from a fixed list. **Approve requires that every live citation is snapshotted** - if a source purges after publication the citation must still resolve.

**The Daily Threat Digest has no approval control anywhere.** CPX contracted it as fully agentic with a target of 100% automation and a machine-generated disclaimer. A review gate would fail the metric.

---

## 4 · Clients `/clients`

```
┌──────┬─────────────┬────────────────────────────────────┐
│ Dash │ Clients   + │ CLT-027                     [Edit] │
│ Int  │ ┌─────────┐ │ Energy · UAE · 6 products · 4 PIRs │
│ Rep  │ │ CLT-003 │ ├────────────────────────────────────┤
│ Cli◄ │ │ CLT-014 │ │ Open against this client           │
│ Col  │ │ CLT-027◄│ │  Impersonating domain      triaged │
│      │ │ CLT-041 │ │  Leaked credential         new     │
│      │ └─────────┘ ├────────────────────────────────────┤
│      │   320px     │ [ Profile ]  [ Sent ]              │
│      │             │                                    │
│      │             │ Sector    Energy               ▾   │
│      │             │ Region    UAE                  ▾   │
│      │             │ Products  WordPress, Exchange  +   │
│      │             │ PIRs      ☑1 ☐3 ☑13 ☑14 ☑16 …    │
└──────┴─────────────┴────────────────────────────────────┘
```

Two tabs only. **Profile** is the per-client facts that decide relevance: sector, region, products, and the PIR tick list. **Sent** is the delivery ledger, each row naming the exact advisory version that went out. That ledger is what makes the no-client-login decision auditable.

**No create-client wizard, no PIR editor, no subscription builder.** CPX excluded client onboarding and PIR definition in writing.

**No Requirements tab.** The 24 PIRs read-only on every client record is the old `/pirs` screen wearing a tab. The client-specific part is the tick list, already on Profile. A PIR chip anywhere expands to its verbatim question.

The **Open against this client** block is digital risk protection: leaked credentials, impersonating domains, phishing. **Never render a credential value**, not even masked. A hash and a discovery reference only.

**Empty:** `No clients yet.` Nothing about procurement.

---

## 5 · Collection `/collection`

Four tabs. Default **Connectors**.

```
┌──────┬────────────────────────────────────────────────────┐
│ Dash │  Collection                                        │
│ Int  │  [Connectors] [Sources 185] [Watches 7] [Requests 2]│
│ Rep  │  ┌──────────┐┌──────────┐┌──────────┐┌──────────┐ │
│ Cli  │  │CrowdStrike││ Anomali  ││Google TI ││ Sekoia   │ │
│ Col◄ │  │Held       ││Live · ⚠  ││Both      ││Held      │ │
│      │  │Not conn.  ││Not conn. ││Not conn. ││Not conn. │ │
│      │  │Egress     ││Egress    ││Egress    ││Egress    │ │
│      │  └──────────┘└──────────┘└──────────┘└──────────┘ │
│      │  … VirusTotal · Shodan · AbuseIPDB                 │
│      │  … NVD · CISA KEV · EPSS · MITRE  (our proposal)   │
│      │  … SOC feeds · CTEM · spiderSilk  (no route yet)   │
└──────┴────────────────────────────────────────────────────┘
```

**Connector card, four facts, nothing more:**

1. Name
2. **Held / Live / Both** - derived, read-only. It is what breaks when the connector goes down: Held means no new data but old answers still work, Live means questions using it fail now.
3. Connection state, or last new item if connected
4. In region or egress

**Draw every commercial connector as `Not connected`.** None has a key. Mohanasundaram, 31 July, verbatim: *"we can provide the API keys at a later stage during development."* Anomali additionally carries `UNVERIFIED` because its tool inventory and rate limits are published nowhere and there is no tenant.

**No transport label.** MCP versus REST changes nothing a human sets. **No credential field.** **No cron field.**

### Tab · Sources

The 185-row table plus the health heatmap. Columns: `Source | Sheet | Class | Rhythm | Last item | State`.

**Four states, not three:** healthy · silent but expected · **silent unexplained** · failing. The third is the dangerous one and auto-escalates.

**`Last item` is `lastNewItemAt`, not `lastSuccess`.** A source returning HTTP 200 with no new items for nine days has a fresh `lastSuccess` and looks perfectly healthy on any other field. That is the failure mode that hides.

**One editable field: `Expected rhythm`**, four values (Continuous, Hourly, Daily, Weekly). **It does not control polling.** It tells the alarm what normal quiet looks like: a weekly CERT blog silent for nine days is fine, an IOC blocklist silent for six hours is broken. Seeded from the class, replaced by measured behaviour once there is history.

**Collection health, revised 9 September 2026.** This section previously read: *"Keep the heatmap: 185 sources by day over 30, grouped by class, virtualised ... 185 collectors cannot be supervised as a list, and the state column is a filter, not a replacement."* The grid was never virtualised, so it painted about 5,550 cells on arrival, grouped by collector class while every other control on the tab groups by category, and its legend named three states while eight fills rendered.

What replaces it keeps the requirement and drops the wall:

1. **Needs attention**, at the top, above the category filter and unfiltered by it. Every source that is failing, silent-unexplained or blocked, each with the reason in words and a link to its detail page. A silent failure is now named, not left as a stripe to be spotted.
2. **Thirty days by category**, one row each. The colour is the **share of that category's sources that returned items that day**, in quartiles, not the volume: on a median day IOC Feeds collects 3,442 items and Ransomware Monitoring 443, so a shared absolute ramp needs decade-wide steps and hides a 60% collapse. The share means the same thing on every row and its denominator is printed beside it. Volume is in the tooltip, exactly.
3. **The per-source grid survives**, one category at a time, behind that row's expand, quietest first and paged. All 185 stay reachable.

The legend renders from the same map as the cells, so the two cannot drift. `lib/collection-health.ts` holds the derivation; `scripts/check-collection-health.mjs` checks the ladder.

**URLs render as inert plain text.** Never anchors. One row carries an embedded API key.

### Tab · Keyword watches

Full create, edit, delete. This is where real per-row analyst judgement lives, and it deserves more UI than all 185 sources combined.

Fields: name · terms · language · region · PIRs served · cadence. Detail shows the last run with counts per source, **including zero**.

Seed from PIR17, PIR18 and PIR19 - the three requirements with no feed behind them.

### Tab · Requests

**One path for adding a source, not two.** Everything files a request: URL, why, which PIR it serves. A request for a source with a feed in its URL auto-approves and goes live within the poll cycle, and the row says so. Everything else queues.

This is deliberate. A button that instantly builds a collector is a connector builder, which is the thing we are not building. And on MKT-001 the instant-add button existed, the source still could not be added because it needed CPX network approval, and it cost a UAT sign-off. A visible queue is honest about that.

**A source that starts returning 401 or 403** moves to `blocked, needs credential` and routes into the same queue.
