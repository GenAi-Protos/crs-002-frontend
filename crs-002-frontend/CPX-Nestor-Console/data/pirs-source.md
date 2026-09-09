# PIR source data, verbatim

Extracted 2 August 2026 from `PIRs.xlsx`, attached to Mohanasundaram Adaikkappan's 31 July 2026 email `RE: CPX AI Agent Programme - AGT CRS-002`.

**This file is the only permitted source for `fixtures/pirs.json`.** Do not invent categories, questions or coverage values. If a value is not below, it is not known.

---

## The 24 PIRs

Four columns in the workbook: Category, Ref#, PIRs (Priority Intelligence Requirements), Coverage.

| Category | Ref | Question (verbatim) | Coverage |
|---|---|---|---|
| Enterprise | PIR1 | What threat actors are previously [6 months] or actively targeting [Client]'s industry? | Threat Actors |
| Enterprise | PIR2 | What threat actors are previously [6 months] or active in the UAE or GCC region? | Threat Actors |
| Enterprise | PIR3 | What tools, technology, and processes are malicious actors using (or intend or likely to use) to maliciously affect [Client]'s assets or systems? | TTPs |
| Enterprise | PIR4 | What tactics, techniques, and procedures are emerging for use against GCC region or UAE-based targets? | TTPs |
| Enterprise | PIR5 | What tactics, techniques, and procedures are emerging for threat actors known to previously target the Middle East? | TTPs |
| Enterprise | PIR6 | What malware/ransomware/RAT/Botnet/Infostealer is actively being used to target the [Client]'s industry? | Malware/Ransomware |
| Enterprise | PIR7 | Which malware family has impacted or is emerging in the GCC region or in the UAE? | Malware/Ransomware |
| Enterprise | PIR8 | Which malicious campaigns are active against [Client]'s industry? | Campaigns |
| Enterprise | PIR9 | Which campaigns have directly targeted the GCC region or UAE-based organisations/individuals? | Campaigns |
| Enterprise | PIR10 | What are the scam campaigns happening in the UAE? | Campaigns |
| Enterprise | PIR11 | What are emerging campaigns of threat actors known to previously target the Middle East? | Campaigns |
| Industry Threat and Events | PIR12 | Which industry sectors categorised by the UAE as critical infrastructure have been targeted or are being targeted by a specific campaign? | Campaigns |
| Vulnerabilities | PIR13 | What are the new vulnerabilities in widely-used technologies of [Client]'s with a CVSS score of 7.0 & above and being exploited in the wild | Technology Stack |
| Vulnerabilities | PIR14 | What are the new vulnerabilities in widely-used technologies of [Client]'s with a CVSS score of 7.0 & above with public exploit(s) | Technology Stack |
| Vulnerabilities | PIR15 | What are the new vulnerabilities in widely-used technologies of [Client]'s with a CVSS score of 9.0 & above not exploited in the wild, with no public exploit, but leading to RCE | Technology Stack |
| Vulnerabilities | PIR16 | What zero-day vulnerabilities could affect systems or applications in use by [Client]? | Technology Stack |
| Global Threat and Events | PIR17 | What are the major cyber events that have occurred across the global? (Major = Extensive media coverage, new type of attack, significant victim, etc.) | Global Events |
| Global Threat and Events | PIR18 | What are the most recent global issues that concerns or may impact the Middle East, GCC, or the UAE? | Global Events |
| Geopolitical Threat and Events | PIR19 | Which geopolitical or other significant events pose a cyber-security interest or threat to [Client] (e.g., hacktivist campaign emerging from an insider trading corruption scandal)? | Geopolitical |
| Deep and Dark Web | PIR20 | What data, regardless of the volume, that would be sensitive to UAE-based organisations or group of individuals have been exposed unintentionally to the public? | Data Leaks |
| Deep and Dark Web | PIR21 | What sensitive data, acquired from exposed databases related to UAE organisations or individuals, have been published for public consumption? | Data Leaks |
| Major Cyber Event | PIR22 | Ransomware attack or listing, or critical cyber attacks that has came out in wild | Cyber Security Event |
| Major Cyber Event | PIR23 | Threat campaign discovered by our SOC and has regional presence | Cyber Security Event |
| Vulnerabilities | PIR24 | HIGH or CRITICAL newly discovered vulnerabilities including zero days which has got media attention or is every where on internet | Vulnerabilities |

**Transcription notes, so nobody thinks these are our edits:**
- The workbook spells the first category `Entreprise`. Render it `Enterprise` in the UI and keep this note.
- The workbook writes `Deep & Dark Web`. Render it `Deep and Dark Web` (house style, no ampersand in labels).
- Question text is verbatim, including the grammatical slips in PIR22 and PIR24. **Do not correct CPX's requirement text.** It is a contract artefact.

---

## The seven categories and their PIR ranges

| Category | PIRs | Coverage values used |
|---|---|---|
| Enterprise | PIR1 to PIR11 | Threat Actors, TTPs, Malware/Ransomware, Campaigns |
| Industry Threat and Events | PIR12 | Campaigns |
| Vulnerabilities | PIR13, PIR14, PIR15, PIR16, PIR24 | Technology Stack, Vulnerabilities |
| Global Threat and Events | PIR17, PIR18 | Global Events |
| Geopolitical Threat and Events | PIR19 | Geopolitical |
| Deep and Dark Web | PIR20, PIR21 | Data Leaks |
| Major Cyber Event | PIR22, PIR23 | Cyber Security Event |

## The ten Coverage values

`Threat Actors` · `TTPs` · `Malware/Ransomware` · `Campaigns` · `Technology Stack` · `Vulnerabilities` · `Global Events` · `Geopolitical` · `Data Leaks` · `Cyber Security Event`

**STIX 2.1 mapping.** Six map to native SDOs (`threat-actor`, `attack-pattern`, `malware`, `campaign`, `infrastructure` / `software`, `vulnerability`). **Four have no STIX 2.1 equivalent:** Data Leaks, Global Events, Geopolitical, Cyber Security Event. These need custom SDOs or `report` / `note` wrappers. Model them explicitly; do not force them into a native type.

---

## The `[Client]` placeholder: exactly nine PIRs

**PIR1, PIR3, PIR6, PIR8, PIR13, PIR14, PIR15, PIR16, PIR19.** Verified against the table above by string match on `[Client]`. Every one of these carries `parameters: ["client"]`.

PIR13 to PIR16 also depend on a technology-stack list, so they carry `["client", "techStack"]`. PIR12 depends on the UAE critical-infrastructure sector taxonomy, so it carries `["industry"]`.

**PIR24 is the only PIR with no parameter of any kind.** That is what makes it the Phase 1 slice.

---

## The four hidden tabs: a stalled design, not a form awaiting completion

The workbook has four further sheets: `Tech Stack`, `Industry`, `Threat Groups`, `Malware`. All four are:

- `sheet_state = hidden`
- dimensioned `A1:A1`, one cell, empty
- carrying **no data validations** and **no defined names**

So nothing in the visible PIR sheet references them, and they hold no values. **Never invent the contents.** Every PIR other than PIR24 gets `parametersUnverified: true` and renders a grey `Parameters pending` pill naming which parameter keys are pending. That includes the nine `[Client]` PIRs: we know the parameter key, we do not know the permitted values.

This is confirm-list item 4. Ask for the four lists, or ask whether parameterisation was abandoned.

---

## Fixture corrections this file forces

`fixtures/pirs.json` as shipped invents five categories and reassigns PIRs wholesale. Rewrite it from the table above. Two hits in `fixtures/pir-hits.json` are also mis-slotted under the real taxonomy:

- the **PIR9** hit is filed under Deep and Dark Web. PIR9 is **Enterprise**.
- the **PIR17** hit is filed under Geopolitical. PIR17 is **Global Threat and Events**.

The Today screen and three dashboard charts group by category. Wrong categories mean the primary screen is wrong at the root, so do this before any UI work.
