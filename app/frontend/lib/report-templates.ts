// The five report formats.
//
// IA and VA are taken verbatim from the three real CPX advisories the fixtures
// were built from, headings and order included. They are not ours to change:
// this file records the format, it does not decide it. DG carries the single
// digest section the published digests use. RFI is a work order and has no
// sections at all, which is why it opens as a row rather than a document.
// TAP is the threat-actor profile CPX added on 7 September 2026 (FR-ADV-07); it
// is structured on the Diamond Model and carries its analysis as data, not
// prose, so the four vertices cannot be silently half-filled.
//
// `guidance` is what belongs in a section. It fills the exported template and
// seeds a new draft, and it is never mistaken for content: a section holding
// only its guidance is marked as empty everywhere it is counted.

import type { Advisory, AdvisorySection, DiamondModel } from "./types";

export type ReportType = "IA" | "VA" | "DG" | "RFI" | "TAP";

export interface TemplateSection {
  heading: string;
  guidance: string;
}

export interface ReportTemplate {
  type: ReportType;
  name: string;
  // What the type is for, in one line, for the type picker.
  purpose: string;
  sections: TemplateSection[];
  // Set where the format is a work order rather than a document.
  workOrder?: boolean;
  basis: string;
}

const id = (heading: string) =>
  `sec-${heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

export const TEMPLATES: Record<ReportType, ReportTemplate> = {
  IA: {
    type: "IA",
    name: "Intelligence Advisory",
    purpose: "Campaign, actor or threat activity, written for a client.",
    basis: "FR-ADV-01 to FR-ADV-06. Structure taken from the published CPX advisories.",
    sections: [
      { heading: "Executive Summary", guidance: "What happened, who it affects and what to do, for a reader who will read nothing else." },
      { heading: "TIC Analysis", guidance: "The Threat Intelligence Center's assessment, with the confidence it is held at and why." },
      { heading: "Campaign Overview", guidance: "The campaign, its timeline, its targeting and the actor where attribution is held." },
      { heading: "Attack Chain Overview", guidance: "Initial access through to impact, in the order it occurred." },
      { heading: "TTPs Mapping", guidance: "Techniques by id. The name derives from the held ATT&CK table and an id that does not resolve blocks the draft." },
      { heading: "Indicators", guidance: "One indicator per line. Stored raw, rendered defanged everywhere." },
      { heading: "Recommendations", guidance: "What the client should do, in priority order, each one actionable on its own." },
    ],
  },
  VA: {
    type: "VA",
    name: "Vulnerability Advisory",
    purpose: "One vulnerability, its exposure and what mitigates it.",
    basis: "FR-VUL-01 to FR-VUL-04. Structure taken from the published CPX advisories.",
    sections: [
      { heading: "Executive Summary", guidance: "The vulnerability, its severity and the action required." },
      { heading: "Impact", guidance: "What an attacker gains, and the consequence to the client estate." },
      { heading: "CVSS v3 Base Score", guidance: "Each score with the authority that assigned it. Where authorities disagree, both are kept and the conflict is shown." },
      { heading: "Affected Products and Versions", guidance: "Product, version range and the fixed version, exactly as the vendor states them." },
      { heading: "Existence of Public Exploit", guidance: "Whether proof-of-concept or weaponised code is public, and where that is evidenced." },
      { heading: "Exploit Status", guidance: "Whether it is exploited in the wild, and by whom where that is held." },
      { heading: "TTPs Mapping", guidance: "Techniques by id, resolved against the held ATT&CK table." },
      { heading: "Indicators", guidance: "One indicator per line. Stored raw, rendered defanged everywhere." },
      { heading: "Detection and Hunting", guidance: "Detection logic and hunting queries. Each one parses and validates before it can be published." },
      { heading: "Mitigation and Recommendation", guidance: "The patch, the workaround where no patch exists, and the order to apply them in." },
    ],
  },
  DG: {
    type: "DG",
    name: "Daily Threat Digest",
    purpose: "The day's reportable findings, ranked by client relevance.",
    basis: "FR-DIG-01 to FR-DIG-03. Confidence gate outstanding at open item O1.",
    sections: [
      { heading: "Daily Threat Digest", guidance: "The day's reportable findings, each with its citation, ranked by how many clients it touches and how directly. A quiet day produces a digest that says so." },
    ],
  },
  TAP: {
    type: "TAP",
    name: "Threat Actor Profile",
    purpose: "One actor, profiled on the Diamond Model, written for a client.",
    basis:
      "FR-ADV-07, added in BRD v0.6 (7 September 2026). Diamond Model structure; " +
      "same lead-analyst approval gate as FR-ADV-05.",
    sections: [
      { heading: "Executive Summary", guidance: "Who the actor is, what it targets and what changed, for a reader who will read nothing else." },
      { heading: "Threat Actor Overview", guidance: "The name we track the actor under, its aliases with the vendor that assigned each, and the attribution with the confidence it is held at and why." },
      { heading: "Objectives", guidance: "What the actor appears to be trying to achieve, and the evidence for that reading. Where motivation is inferred rather than evidenced, say so." },
      { heading: "Modus Operandi", guidance: "How the actor operates, in the order it operates: access, escalation, movement, objective. Observed behaviour only." },
      { heading: "Capabilities", guidance: "Associated malware, tooling and techniques, each one tied to the activity it was seen in." },
      { heading: "Infrastructure", guidance: "Command-and-control, staging and delivery infrastructure. Stored raw, rendered defanged everywhere." },
      { heading: "Targeted Industries and Victims", guidance: "Sectors, regions and named victims where disclosure permits. A sector with no observed victim is still a targeting signal; say which it is." },
      { heading: "Diamond Model Analysis", guidance: "The four vertices and the relationships between them. Filled in the panel below rather than typed here." },
      { heading: "MITRE ATT&CK Mapping", guidance: "Techniques by id. The name derives from the held ATT&CK table and an id that does not resolve blocks the draft." },
      { heading: "Key Findings and Assessment", guidance: "What we now hold that we did not, and the assessment it supports, with confidence stated." },
      { heading: "Recommendations", guidance: "What the client should do, in priority order, each one actionable on its own." },
    ],
  },
  RFI: {
    type: "RFI",
    name: "Request for Information",
    purpose: "A client question, worked as a tracked work order.",
    workOrder: true,
    basis: "FR-RFI-01 to FR-RFI-04. A work order, not a client-facing artefact.",
    sections: [],
  },
};

// Order is the order the type picker shows. TAP sits with the other
// client-facing documents, ahead of the RFI work order.
export const REPORT_TYPES: ReportType[] = ["IA", "VA", "TAP", "DG", "RFI"];

export function templateFor(type: string): ReportTemplate | null {
  return TEMPLATES[type as ReportType] ?? null;
}

// A section holding nothing but its guidance is empty, and the editor says so
// rather than counting placeholder text as written content.
export function isPlaceholder(
  section: AdvisorySection,
  template: ReportTemplate | null,
): boolean {
  // A section still holding exactly its seeded guidance has not been written.
  // Checking the body against the standard guidance covers the standard case;
  // an uploaded template seeds its own text, and a section whose body is
  // unchanged since creation is caught the same way at the point of creation.
  if (!template) return false;
  const match = template.sections.find((s) => s.heading === section.heading);
  return !!match && section.body.trim() === match.guidance;
}

// The three blocking checks every artefact carries, unpassed on a new draft.
// A new report cannot skip review on its way to a client.
const NEW_CHECKS: Advisory["checks"] = [
  { id: "chk-links", label: "All links resolve", passed: false, blocking: true },
  { id: "chk-mitre", label: "MITRE techniques resolve", passed: false, blocking: true },
  {
    id: "chk-citations",
    label: "Every generated section cites or declares derivation",
    passed: false,
    blocking: true,
  },
];

/** An unwritten Diamond Model: four vertices, no relationships yet. */
export function emptyDiamond(): DiamondModel {
  return { adversary: "", capability: "", infrastructure: "", victim: "", edges: [] };
}

/** Section records from any template, standard or uploaded. */
export function sectionsFrom(sections: TemplateSection[]): Advisory["sections"] {
  return sections.map((s) => ({
    id: id(s.heading),
    heading: s.heading,
    // Guidance seeds the section and is marked as unwritten wherever it counts.
    body: s.guidance,
    // Nothing has been generated: a person is about to write it.
    generated: false,
    citations: [],
  }));
}

export function blankFromTemplate(
  type: ReportType,
  title: string,
  owner: string,
  ref: string,
  createdAt: string,
): Advisory {
  const template = TEMPLATES[type];
  return {
    ref,
    type,
    version: 1,
    title,
    tlp: "AMBER",
    status: "draft",
    owner,
    pirRefs: [],
    clientIds: [],
    sections: sectionsFrom(template.sections),
    techniques: [],
    cvss: [],
    // A profile opens with an empty diamond rather than no diamond, so the
    // panel renders its four vertices as unwritten instead of disappearing.
    ...(type === "TAP" ? { diamond: emptyDiamond() } : {}),
    checks: NEW_CHECKS.map((c) => ({ ...c })),
    sendBacks: [],
    createdAt,
  };
}
