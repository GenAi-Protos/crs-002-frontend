# Nestor · CPX Threat Intelligence Console

Frontend. Next.js App Router + TypeScript + Tailwind v4; no component library, the primitives live in `components/ui.tsx`. Screens read from the backend through `lib/api.ts` (base URL from the runtime env var `API_BASE_URL`, see `lib/runtime-env.ts`); `fixtures/` remains the offline fallback.

Read `docs/01-screens.md` before writing a screen. Read `docs/03-brand-and-copy.md` before writing any copy.

**Basis: BRD v0.9 and the CRS-002 BRD walkthrough of 2 September 2026, with the requested-features-first implementation approved on 23 September 2026.** Where this file and the BRD disagree, the BRD wins and this file is wrong. The rules below that carry an FR reference are contractual.

---

## What this is

The internal console for **AGT-CRS-002**, CPX's threat intelligence agent. Product name **Nestor**, sitting under CPX Threat Intelligence Center.

Roughly a dozen CPX TI analysts live in it daily, plus a lead analyst who approves, plus leadership and sales who look at a dashboard. **Clients never log in.** They receive PDFs through an existing CPX channel.

**It is not a threat intelligence platform and it is not a chatbot.** Ricardo Sarmiento, the CRS business owner, said both on 31 July 2026. Every time a feature feels like "let the user configure any source" or "let the user browse the object model", it fails that test.

---

## Seven destinations

```
Dashboard  ·  Intelligence  ·  Investigations  ·  Reports  ·  Clients  ·  Collection  ·  Manage
```

| Destination | Route | Who | The one job |
|---|---|---|---|
| **Dashboard** | `/` | Everyone, resolved per role | Where do I start today |
| **Intelligence** | `/intelligence` | Analysts, SOC, IR | Ask a question, get a cited answer, turn it into a draft |
| **Investigations** | `/investigations` | Analysts, lead analyst, IR | Manage shared cases, evidence, specialist runs and report drafts |
| **Reports** | `/reports` | Analysts write, lead approves | Judge a client-facing artefact and release it |
| **Clients** | `/clients` | Lead analyst | Keep the facts current that decide what each client receives |
| **Collection** | `/collection` | Technical roles; lead manages connectors | Submit intelligence, inspect sources and collection health |
| **Manage** | `/manage` | Analysts read, lead analyst edits | See what an agent is made of, and keep PIRs and workflows current |

Detail routes include `/reports/[ref]`, `/clients/[id]`, `/collection/sources/[id]` and `/investigations/[id]`.
One addressable-but-never-navigated route: `/intelligence/[id]`, so a conversation can be linked from an RFI row. **No thread list, no session sidebar, no history rail.**

**Manage is one destination with tabs**, not four: Agents, Workflows, PIRs, Audit. CPX grouped them the same way in the 2 September mockup.

Superseded, 2 September 2026: earlier versions of this file said "do not add a sixth destination". CPX asked for an agent-specification view, PIR management and an audit trail in the same session, so Manage is the sixth. The user approved Investigations as the seventh destination on 23 September 2026. Private Intelligence conversations remain separate from shared cases.

---

## Hard rules

**1. The backend is the contract.** New dashboard, investigation, upload, source-submission and IOC lookup flows have explicit loading/error/empty states and never fall back to demo results. Legacy screens may use a clearly labelled offline fallback. Screens read through `lib/api.ts`. A screen must still render honestly when the backend is down: show what it has, say what it could not reach, never present demo data as live. See `docs/02-data.md`.

**2. Never fetch a URL from the source inventory.** It contains live malware repositories, IOC blocklists, dark-web indexes and TOR node lists, and at least one URL carries an embedded API key in its path. Render them as **inert plain text**: no `<a href>`, no `next/link`, no prefetch, nothing that triggers a favicon fetch, and never write one to a log or an export unredacted. Indicators render defanged at every rendering site.

**3. Text is the enemy.** Page headers are one to three words. There are **no page descriptions and no explanatory paragraphs anywhere in the UI**. If a screen needs explaining, it is the wrong screen. Full rules in `docs/03`.

**4. The analyst's content comes first, and the work is inspectable.** The agent is a worker inside the product, not the subject of it: no first-person agent copy, no pulse animation, no narration that reads like a monologue. Provenance still attaches to a claim - one collapsed **Sources** row per answer, inline per-fact attribution in the prose.

But the run itself must be openable. CPX asked for this three times on 2 September and it is AC-13: from any answer or report the analyst can see **which workflow ran, which specialist agents were invoked, what evidence each returned, and each agent's status and errors**. That is a panel the analyst opens, not a feed that plays at them. Where a specialist had no source for its area, name the area as omitted coverage rather than staying silent (FR-RFI-04).

**5. Role filtering happens in the payload, never the DOM.** One predicate in `lib/access.ts`. **Sales must never receive raw IOC or analyst-level data** - that is a written CPX requirement with its own success indicator. Withhold at assembly and render the count: `14 indicators, withheld at this access level`.

**6. Brand is CPX 2026, styled like the other CPX consoles.** Dark Purple `#1E1847`, CPX Green `#4CEE76`, Near Black `#040405`, plus the shared 50 to 900 tint scales. **Zero occurrences of `#FDB913`, `#EA661F`, `#FFC72C` or `#F59E0B`.** That last one is a Tailwind default amber sitting under 5 degrees of hue from the retired CPX yellow. Tokens in `docs/03`; the visual reference is the CSD-007 style guide (`CSD-007/csd-007-frontend/docs/FRONTEND-STYLE-GUIDE.md`): white shell, green for the active and selected state, 4px corners, soft tinted status pills, no `black/N` opacity greys. Type is CPX Unbounded for `h1`, `h2`, the wordmark and KPI numbers, Inter for everything else, self-hosted from `app/fonts/`; sizes come from the eight-step scale only, never `text-[Npx]`.

**7. UK English. No em dashes.** Use a spaced hyphen, a comma or a colon. All times GST. No `AI-XX` identifiers, no "TBC", no hedging on any screen.

**8. Never invent a metric, and never invent a fact.** No percentage reduction, speed multiple or SLA figure CPX has not stated. Render counts including zero; never "no data available".

The agent must not generate facts, indicators, attribution, identities, commands or conclusions that were not retrieved. Where nothing was found, show a clear negative result with its count and the searches that ran, not a generic answer (FR-QRY-03, Praveen Singh, 2 September). **A zero count means "we hold nothing", never "it is clean".**

**9. The role switcher is dev only.** Guard on the runtime env var `ROLE_SWITCHER` (read through `lib/runtime-env.ts`, never `NEXT_PUBLIC_*`), default false. It changes the view, never the data contract.

---

## Roles

Six console roles. **Client is not one of them** - no login, no route, no role.

| | Dashboard | Intelligence | Reports | Clients | Collection | Manage |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| TI Analyst | ✓ | ✓ | write | - | ✓ | read |
| Lead Analyst | ✓ | ✓ | approve | ✓ | ✓ | edit |
| Incident Responder | ✓ | ✓ | read published | - | - | read |
| CRS Leadership | ✓ | - | read published | - | - | - |
| CEO / Executive | ✓ | - | - | - | - | - |
| Sales | ✓ | - | read published, own clients only, IOCs stripped | - | - | - |

**Read means read.** Every console user who can reach Manage sees what an agent is made of; only the administrator changes it (Praveen Singh 15:17). Lead Analyst carries the administrator rights until CPX confirms the definitive user-type list at **open item H1** - if H1 names a separate TI Administrator, that is a role addition, not a rewrite.

Everyone lands on `/`. The Dashboard resolves its content from the role.

---

## Build order

**Fix the data first.** `fixtures/pirs.json` is supplied and correct - it is derived verbatim from `data/pirs-source.md`. Do not regenerate it from anything else, and never invent a PIR category. Everything else you build as you go, to the shapes in `docs/02`.

1. **Intelligence.** The only surface CPX specified by example - they sent screenshots of a working product with a two-word caption. Widest audience. It absorbs report creation, so building it de-risks Reports.
2. **Reports.** The lead analyst's job and the only client-facing output. Three real CPX advisories give the exact section list, so nothing is guessed.
3. **Dashboard, analyst view only.** Counts and lists, no chart library needed.
4. **Clients.** Small, and it is what makes per-client relevance work at all.
5. **Collection.** One card shape repeated, one table, two forms.

**Deferred deliberately:** every chart on the leadership, CEO and sales dashboards. CPX's own integrations table names **Power BI** as the dashboard rendering layer, owner IT/CRS. Until that is settled we may owe them a JSON contract rather than 25 charts. Ship those three views with their number tiles and an "as of" stamp.

---

## Definition of done for a screen

- Reads through `lib/api.ts`, and degrades honestly when the backend is down
- Page header is one to three words and there is no description under it
- Every list has a search, a stated default sort, and a visible honest total
- Every count renders, including zero
- Respects the role in the payload, not the DOM
- No inventory URL is an anchor, a fetch or a prefetch
- No `#FDB913`, `#EA661F`, `#FFC72C`, `#F59E0B`. UK English. No em dashes.
- Where the screen shows agent output, the run behind it is openable: workflow, agents invoked, evidence, status
- No credential value is displayed or accepted anywhere on it
- Text sizes from the eight-step scale only; buttons via `Button` or `buttonClass`; overlays via `Dialog` or `Drawer`
- Colours from the `cpx-*` tokens and scales only: no `black/N` greys, no hex in a component
- While a fetch is in flight `SkeletonRows` holds the geometry; when it fell back to fixtures `OfflineNote` is visible
- Motion only through the tokens and utilities in `app/globals.css` (`reveal`, `ease-out-quart`, the chart draw-ins); nothing pulses or loops, and reduced motion is honoured (docs/03 §6)
- Nothing on the screen assumes it owns the browser viewport: `<main>` is the only scroll region (docs/01, Shell)

---

## Out of scope, and the reason

Do not build these. `docs/04` carries the sentence to say if asked.

- A parser or scraper builder. Parsers are code with tests, not fields.
- A per-source cron editor. Polling is uniform and derived. A source's **expected rhythm** is editable; a cron expression is not.
- **Any credential entry field.** Keys live in Key Vault behind a managed identity (NFR-SEC-02, 8.1). The console shows whether a credential is present and which auth pattern a source uses. It never shows or accepts the value. This one did not move and will not.
- A RAG, schema, normalisation or enrichment screen. That is backend architecture and it belongs in the architecture pack, not in an analyst's tool.
- Generated imagery. Infographics populate a fixed CPX-designed template from structured content; the TTP heat map is a text table, not a picture (FR-ADV-04, FR-OUT-05).
- Any automated release path for an Intelligence or Vulnerability Advisory. A lead analyst approves, always (FR-ADV-05, FR-VUL-04, BRD 4.2).

### Reversed on 2 September 2026

These were out of scope under the 31 July position and CPX asked for them in the BRD walkthrough. They are in scope now.

| Was ruled out | Who asked, and where |
|---|---|
| **Adding and removing sources** | Praveen Singh 16:12 and 18:49, Abhinav Singh 19:01: *"that should be there"*. Analyst or admin adds a source; the console records the request and the method (API, MCP, RSS, dark-web collection). It still files a request rather than building a connector - a parser is code. |
| **A PIR editor** | Abhinav Singh 24:54 and 25:39: *"the authorized analyst should be able to add or edit... we'll follow the same CTI lifecycle"*. PIRs carry a client or industry scope. |
| **An agent specification view** | Praveen Singh 13:45: purpose, instruction, skills, tools, scripts, sources, workflows, permissions, instruction version and update count. Read-only for every console user, editable by the administrator only (15:17). |
| **A workflow and run inspector** | Praveen Singh 29:21 to 31:45, AC-13. See hard rule 4. |
| **An audit trail view** | Praveen Singh, 2 September: which agent ran what, which sources it triggered, which reports were generated, edited or modified (FR-AUD-01 to FR-AUD-03). |

**MCP first.** When a source can be reached by MCP, MCP is the preferred integration and the console says so. Praveen Singh 33:54; Mohanasundaram Adaikkappan 34:37: Anomali provides an MCP server, *"that is going to be your first preference instead of API based"*.
