# Open items, attribution and safety

Nothing here changes what you build. It exists so nobody asserts our own inference to CPX as if it were theirs, and so the safety rule is written down once, properly.

---

## 1 · Safety

> The CPX source inventory contains **live malware repositories, IOC blocklists, dark-web indexes and TOR node lists** (URLhaus payload URLs, MalwareBazaar, vxvault, ThreatFox, PhishTank).
>
> **Never fetch, curl, open, prefetch, resolve or link any URL from it.** Not to check reachability. Not to see if an RSS feed exists. Treat every one as inert data.

In code:

- Source URLs and unsafe citations render as **plain text**. No `<a href>`, no `next/link`, no `<link rel="prefetch">`, nothing that triggers a favicon fetch.
- `Citation.urlSafe` **defaults to `false`**. Opt in, never out.
- **At least one inventory URL carries a 64-character API key in its path.** Inventory URLs must never reach logs, error messages, analytics or exports unredacted.
- Indicators render defanged through `lib/defang.ts` at every rendering site. Store raw, defang at render.

---

## 2 · What is CPX's, and what is ours

Check this before asserting anything in a review. The recurring failure mode is our own inference coming back at CPX in their own name.

### CPX-stated, quotable

| Fact | Where |
|---|---|
| 185 open sources across five sheets, two columns each | `TI Sources and Feeds_v0.1.xlsx`, 31 July pack |
| Four commercial feeds: CrowdStrike, Anomali, Google Threat Intelligence, Sekoia | 31 July email, verbatim |
| *"We can provide the API keys at a later stage during development"* | 31 July email, verbatim |
| 24 PIRs, seven categories, ten coverage values, four hidden empty tabs | `PIRs.xlsx`, extracted verbatim to `data/pirs-source.md` |
| IA and VA section structures, CVSS with attributed sources, the mandatory MITRE section | The three `CPX-TIC-*.pdf` samples |
| Explicit negative results with counts, TLP on answers, entity linking | The Anomali Copilot screenshots in the same email |
| VirusTotal, Shodan, AbuseIPDB, named for live query of non-stored data | 19 June MoM |
| *"PIR: the trigger/filter, relevance per client. Don't release everything; curate."* | 19 June MoM |
| UAE residency, in-region hosting, tenant isolation, the Sales and Leadership access rules, PIR definition out of scope, Power BI as the rendering layer, CREST and SOC-CMM alignment | 10 June requirements template |
| The orchestrator / normalisation / enrichment decomposition | Ricardo Sarmiento, 31 July, unprompted |
| *"Not a threat intelligence platform. It's not a TIP."* | Ricardo Sarmiento, 31 July |
| Feeds have purging lifecycles, so data must be held | Abhinav Singh, 31 July |
| The CEO regional-versus-global framing, and the MITRE coverage view by name | Mohanasundaram Adaikkappan, 31 July, **verbal** |

### Ours, and must be labelled as ours

| Claim | Status |
|---|---|
| **Anomali MCP endpoint, transport, auth header** | **UNVERIFIED.** Vendor-adjacent reading. The tool inventory and rate limits are published nowhere and we have no tenant. Saying "the MCP exposes X" in front of Ricardo invites the one challenge we cannot answer. |
| NVD, CISA KEV, EPSS, MITRE ATT&CK bundle | Our recommendation. A regex across all 185 rows returns zero matches for any of them. |
| The retention model, storage tiering, the canonical schema proposal | Ours, drafted for CPX to correct |
| Collector class counts | **Estimates with contested boundaries.** Two independent passes gave 121/32/28/2/2 and 123/30/28/2/2. Derive at render; never print a hard-coded breakdown. |
| The product name and the mark | Ours |
| Roughly 600 IAs and 175 VAs a year | **Our extrapolation from two published sequence numbers.** An upper bound, because refs are reserved at draft creation. Never present it as CPX's number. |
| *"Hold what expires, query what persists"* | **Our phrasing.** Abhinav asked the question and then withdrew it. Do not attribute it to him. |
| **"Clients never log in"** | **Ours.** CPX's own outputs table gives the destination channel as *"Email / Client Portal"*. Client Portal is their word. It is our proposed scope reduction, not their statement. |

### Corrections owed to the vault

- **"Six X/Twitter sources" is two.** `bishopfox.com`, `infoblox.com` and `trellix.com` all contain the substring `x.com`.
- **"~55 sources carry no RSS pattern" is 32.** The old figure overstates the parser bill by about 40%.
- The 31 July transcript renders **"Jayesh is our lead threat intel analyst"**. The only Jayesh in the vault is the CPX CIO, who was not on that call, and the same transcript renders Abhinav as "Bhivina" and Ricardo as "Rafael". **Do not write that into any artefact until confirmed.**

---

## 3 · What we are not building, and the sentence to say

| Not building | What to say |
|---|---|
| Parser or scraper builder | *"Parsers are code in our repository with tests, not fields in your console. A configurable parser surface is build-any-connector functionality, and you told us this is not a TIP."* |
| Add-any-connector screen | *"Eleven named connectors in a status list is what every product has under Settings. A surface that builds arbitrary connectors is literally what a TIP is."* |
| Per-source cron editor | *"One uniform poll, and a rhythm setting that tells the alarm what normal looks like. 185 hand-tuned cron expressions is a maintenance liability, not a feature."* |
| Per-source staleness threshold | *"A number typed on day one is wrong on day one and never revisited. The system learns each source's rhythm and alarms on deviation."* |
| Any credential entry field | *"Keys go to Key Vault behind a managed identity, per the security design agreed on 12 June. The console shows whether a credential is present. It never shows or accepts the value."* |
| PIR editor | *"Your own scope says the agent consumes PIRs but does not manage or define them."* |
| RAG, schema, normalisation or enrichment screens | *"That is backend architecture and it belongs in the architecture pack. An analyst does not need to look at a schema to do their job."* |
| An add-source button that instantly builds a collector | *"It files a request. On MKT-001 the button existed, the source still could not be added because it needed network approval, and it cost a UAT sign-off. We would rather show you the queue."* |

---

## 4 · Confirm list

Genuinely open. **None of it is a CPX position. Do not assert any of it.**

| # | Question | To whom | Blocking |
|---|---|---|---|
| **1** | *"Today, who edits the sources file - the analysts directly, or does it come through you? When a source is added or a dead one dropped, roughly how often? Would you expect to do that yourselves in the tool, or send it to us?"* Their own template still lists the TI Team Lead as "(to confirm)". | **Mohanasundaram, cc Ricardo** | Yes |
| **2** | **Up to 39 sources may be unreachable on day one.** The approved URL-category list has no category covering malware repositories, IOC blocklists, TOR node lists or dark-web indexes, which is the entire Indicators sheet plus Ransomware. Standard filtering blocks those by default. | Abdul, routing to network | Yes |
| 3 | UAE residency versus outbound queries. Live lookups leave the region and cache responses. Where the cache lives is a decision nobody has taken. | Ricardo | Yes |
| 4 | The four PIR parameter tabs shipped hidden and empty. Were they redacted before sending, or never filled in? Nine PIRs depend on them. | Mohanasundaram | Yes |
| 5 | The manual advisory production time baseline. It exists nowhere, and CPX's own SI-1 measures against it. | Mohanasundaram | Yes |
| 6 | Is Power BI the dashboard renderer, or a reader of our datasets? Their integrations table names it as the rendering layer, owner IT/CRS. This also decides who owns the dashboard-adoption telemetry. | Ricardo + Abhinav | Yes |
| 7 | Anomali overlap against the 185. No coverage claim until a tenant exists. | Mohanasundaram | Yes |
| 8 | Do the four commercial licences permit bulk retention, or lookup only? One fact that moves four connectors between held and live. | Mohanasundaram | No |
| 9 | When we query an external platform, what may go out? Hashes and public URLs yes. A client name, a client IP range, an internal hostname? | Ricardo + CPX security | No |
| 10 | The UAE critical-infrastructure sector taxonomy. PIR12 is written against it and it appears nowhere. | Mohanasundaram | No |
| 11 | The CEO dashboard is a verbal ask. The written contract names three views. | Ricardo | No |
| 12 | Model-agnostic or Copilot and Microsoft only? Ricardo asked, unanswered. | Ricardo | No |
| 13 | Five Secondary rows are tagged `Geopol` and all five carry feeds, yet CPX said geopolitical has no feed. Both, or one? | Abhinav | No |
| 14 | Client Portal handoff: file drop, API or email? Their table names it; our design assumes we hand off rather than authenticate. | Ricardo | No |

**Privately and in writing, not in a room:**

- **The PhishTank URL carries a 64-character API key in its path** and the workbook has reached at least six external recipients. Recommend rotation.
- **CPX's own published advisories carry defects** we found while building the validators: an invented MITRE technique name, a technique with no ID, a tactic filed under the wrong heading, and two CVSS authorities ranking the same CVEs in opposite order with the prose silently following one of them. These go to Mohanasundaram directly, framed as findings from building against them. Never raised in the room.
