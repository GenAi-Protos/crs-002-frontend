// Regenerates every fixture except pirs.json, which is supplied and correct.
// Deterministic: seeded PRNG, fixed demo clock. Run: npm run fixtures

import { writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "fixtures");
const NOW = new Date("2026-08-02T04:15:00Z"); // 08:15 GST

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260802);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
const daysAgo = (n, hourUtc = 6, min = 0) => {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hourUtc, min, 0, 0);
  return d;
};
const dateStr = (d) => d.toISOString().slice(0, 10);

function write(name, data) {
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2) + "\n");
  console.log(`${name}: ${Array.isArray(data) ? data.length : 1}`);
}

// ---------------------------------------------------------------- users (6)

const users = [
  { id: "u-analyst", name: "Rajesh Menon", role: "analyst", clientScope: "all", seesRawIocs: true, canApprove: false },
  { id: "u-lead", name: "Sara Haddad", role: "lead-analyst", clientScope: "all", seesRawIocs: true, canApprove: true },
  { id: "u-ir", name: "Omar Khalid", role: "incident-responder", clientScope: "all", seesRawIocs: true, canApprove: false },
  { id: "u-leadership", name: "Helena Marques", role: "leadership", clientScope: "all", seesRawIocs: false, canApprove: false },
  { id: "u-exec", name: "Amina Rashid", role: "executive", clientScope: "all", seesRawIocs: false, canApprove: false },
  { id: "u-sales", name: "Daniel Okafor", role: "sales", clientScope: ["CLT-003", "CLT-027"], seesRawIocs: false, canApprove: false },
];
write("users.json", users);

// -------------------------------------------------------------- clients (4)

const clients = [
  {
    id: "CLT-003", name: "Gulf Capital Bank", sector: "Banking", region: "UAE",
    products: ["Microsoft Exchange", "Fortinet FortiOS 7.4", "Oracle FLEXCUBE", "VMware ESXi"],
    subscribedPirRefs: ["PIR1", "PIR6", "PIR13", "PIR14", "PIR20", "PIR22"],
    profileComplete: true,
  },
  {
    id: "CLT-014", name: "Al Dhafra Logistics", sector: "Transport", region: "UAE",
    products: ["SAP S/4HANA", "Cisco IOS XE", "WordPress"],
    subscribedPirRefs: ["PIR3", "PIR8", "PIR13", "PIR16", "PIR22"],
    profileComplete: true,
  },
  {
    id: "CLT-027", name: "Meridian Energy Group", sector: "Energy", region: "UAE",
    products: ["WordPress", "Microsoft Exchange", "Fortinet FortiOS 7.4", "Schneider EcoStruxure", "VMware ESXi", "Palo Alto PAN-OS"],
    subscribedPirRefs: ["PIR1", "PIR13", "PIR14", "PIR16"],
    profileComplete: true,
  },
  {
    id: "CLT-041", name: "Falcon Aviation Services", sector: "Aviation", region: "GCC",
    products: [],
    subscribedPirRefs: ["PIR1", "PIR22"],
    profileComplete: false,
  },
];
write("clients.json", clients);

// ------------------------------------------------------------ pir-hits (30)

const pirs = JSON.parse(readFileSync(join(OUT, "pirs.json"), "utf8"));
const catOf = Object.fromEntries(pirs.map((p) => [p.ref, p.category]));

const hitDefs = [
  // today, before 08:15 GST
  ["hit-001", "PIR13", "wp2shell mass exploitation of WordPress themes", 0.2, 92, "Vendor advisory corroborated by exploited-in-wild telemetry from two independent feeds", ["CLT-027", "CLT-014"], "AMBER", "new"],
  ["hit-002", "PIR8", "DPRK supply chain campaign against logistics software", 0.3, 87, "Overlap with tracked Lazarus tooling across three reports", ["CLT-014"], "AMBER", "new"],
  ["hit-003", "PIR22", "Ransomware listing names a GCC industrial group", 0.15, 95, "Victim named on the leak site itself", ["CLT-027"], "RED", "escalated"],
  ["hit-004", "PIR24", "Exchange zero-day gets emergency out-of-band patch", 0.25, 90, "Vendor bulletin plus proof-of-concept circulating", ["CLT-003", "CLT-027"], "GREEN", "new"],
  ["hit-005", "PIR7", "Infostealer wave seeded through UAE job portals", 0.28, 74, "Two sightings, sample not yet analysed", [], "AMBER", "new"],
  ["hit-006", "PIR20", "Credential set for regional banks offered on forum", 0.3, 81, "Seller history checks out, sample headers match", ["CLT-003"], "AMBER+STRICT", "triaged"],
  ["hit-007", "PIR17", "Undersea cable fault disrupts Gulf transit routes", 0.26, 68, "Single press report, telecom confirmation pending", [], "CLEAR", "new"],
  ["hit-008", "PIR14", "PAN-OS public exploit released for July advisory", 0.1, 88, "Exploit code published and verified against the vendor advisory", ["CLT-027"], "GREEN", "new"],
  // this week
  ["hit-009", "PIR1", "Actor profile: Moonlit Sirocco targeting Gulf energy", 1.2, 78, "Consistent victimology across four incident writeups", ["CLT-027"], "AMBER", "triaged"],
  ["hit-010", "PIR22", "Hospital group in EU confirms encryption event", 1.4, 91, "Operator statement and ransom note both public", [], "CLEAR", "triaged"],
  ["hit-011", "PIR13", "FortiOS SSL-VPN flaw exploited, CVSS 8.6", 1.6, 89, "Vendor PSIRT confirms exploitation of the July CVE", ["CLT-003", "CLT-027"], "GREEN", "escalated"],
  ["hit-012", "PIR21", "Marketing database of UAE retailer published", 2.2, 85, "Dataset sampled and matches the retailer's schema", [], "AMBER", "triaged"],
  ["hit-013", "PIR9", "Phishing campaign spoofs a federal service portal", 2.5, 83, "Kit fingerprint matches an active tracked cluster", ["CLT-003"], "AMBER", "new"],
  ["hit-014", "PIR18", "Sanctions update touches regional shipping insurers", 3.1, 70, "Legal analysis only, no operational reporting yet", ["CLT-014"], "CLEAR", "dismissed"],
  ["hit-015", "PIR6", "RAT campaign delivered through trojanised invoices", 3.4, 76, "Sandbox detonation confirms family, targets unverified", ["CLT-014"], "AMBER", "triaged"],
  ["hit-016", "PIR15", "Unauthenticated RCE chain reported in ESXi, no exploit", 3.8, 79, "Researcher writeup, vendor acknowledgement received", ["CLT-003", "CLT-027"], "GREEN", "new"],
  ["hit-017", "PIR23", "SOC-flagged campaign matches regional watering hole", 4.2, 82, "Two SOC escalations correlate with held infrastructure", [], "AMBER+STRICT", "escalated"],
  ["hit-018", "PIR2", "Two actors resume activity after Eid pause", 4.6, 66, "Cadence inference from feed volume, low direct evidence", [], "CLEAR", "dismissed"],
  ["hit-019", "PIR10", "Parcel-fee smishing surge across UAE numbers", 5.3, 84, "Carrier abuse desk confirms volume spike", [], "CLEAR", "triaged"],
  ["hit-020", "PIR16", "Zero-day rumoured in a building management suite", 5.8, 58, "Single dark-web claim, no sample, treat as unconfirmed", ["CLT-027"], "AMBER", "new"],
  // last week and older
  ["hit-021", "PIR22", "Logistics operator listed then delisted within hours", 6.4, 73, "Listing captured before removal, negotiation likely", ["CLT-014"], "AMBER", "triaged"],
  ["hit-022", "PIR4", "New lateral movement pattern in GCC intrusions", 7.2, 77, "Repeated across two unrelated incident responses", [], "AMBER", "triaged"],
  ["hit-023", "PIR12", "Water utility sector probed by known scanning cluster", 8.1, 71, "Honeypot telemetry, no follow-on activity observed", [], "GREEN", "dismissed"],
  ["hit-024", "PIR19", "Hacktivist op announced over regional court ruling", 8.9, 69, "Telegram announcement, capability historically low", [], "CLEAR", "triaged"],
  ["hit-025", "PIR13", "Exchange ProxyNotShell variant back in scanning data", 9.6, 80, "Scanning volume tripled against held baseline", ["CLT-003"], "GREEN", "triaged"],
  ["hit-026", "PIR5", "Tracked actor adopts EDR-killer tooling", 10.4, 75, "Tool overlap confirmed in one incident, second unverified", [], "AMBER", "triaged"],
  ["hit-027", "PIR11", "Campaign infrastructure re-registered after takedown", 11.2, 72, "Registrant pattern matches the prior wave", [], "GREEN", "false-positive"],
  ["hit-028", "PIR17", "Global outage traced to CDN configuration error", 12.1, 86, "Provider postmortem published, no threat actor involved", [], "CLEAR", "dismissed"],
  ["hit-029", "PIR20", "Contractor badge data surfaced in combolist", 12.8, 67, "Partial match against known historic breach corpus", ["CLT-041"], "AMBER", "triaged"],
  ["hit-030", "PIR14", "Public exploit for SAP NetWeaver flaw weaponised", 13.5, 88, "Exploit merged into a commodity framework", ["CLT-014"], "GREEN", "escalated"],
];

const hits = hitDefs.map(([id, pirRef, title, dAgo, confidence, reason, affected, tlp, status]) => {
  const fired = new Date(NOW.getTime() - dAgo * 86400000);
  return {
    id, pirRef, category: catOf[pirRef], title,
    firedAt: iso(fired), confidence, confidenceReason: reason,
    sourceIds: [pick(["src-004", "src-011", "src-023", "src-045", "src-101", "src-152", "src-160"]), pick(["src-007", "src-033", "src-088", "src-140", "src-171"])],
    entityIds: [],
    affectedClients: affected, tlp, status,
    ...(status === "triaged" || status === "escalated" ? { assignedTo: pick(["Rajesh Menon", "Praveen Kumar"]) } : {}),
  };
});
write("pir-hits.json", hits);

// ---------------------------------------------------- relevance matches

const relevance = [
  { hitId: "hit-001", clientId: "CLT-027", score: 0.92, reasons: [
    { dimension: "product", matched: "WordPress", text: "Runs WordPress across its public web estate" },
    { dimension: "sector", matched: "Energy", text: "Campaign has already hit two regional energy operators" },
  ]},
  { hitId: "hit-001", clientId: "CLT-014", score: 0.78, reasons: [
    { dimension: "product", matched: "WordPress", text: "WordPress listed in the technology profile" },
  ]},
  { hitId: "hit-002", clientId: "CLT-014", score: 0.87, reasons: [
    { dimension: "sector", matched: "Transport", text: "Targets logistics software used in the sector" },
    { dimension: "region", matched: "UAE", text: "Campaign staging observed on regional infrastructure" },
  ]},
  { hitId: "hit-003", clientId: "CLT-027", score: 0.81, reasons: [
    { dimension: "sector", matched: "Energy", text: "Victim is an industrial group in the same sector" },
    { dimension: "region", matched: "UAE", text: "Listing names a GCC-headquartered group" },
  ]},
  { hitId: "hit-004", clientId: "CLT-003", score: 0.85, reasons: [
    { dimension: "product", matched: "Microsoft Exchange", text: "Exchange in the technology profile, patch is out-of-band" },
  ]},
  { hitId: "hit-004", clientId: "CLT-027", score: 0.83, reasons: [
    { dimension: "product", matched: "Microsoft Exchange", text: "Exchange in the technology profile, patch is out-of-band" },
  ]},
  { hitId: "hit-006", clientId: "CLT-003", score: 0.74, reasons: [
    { dimension: "sector", matched: "Banking", text: "Credential set is advertised as regional bank accounts" },
  ]},
  { hitId: "hit-008", clientId: "CLT-027", score: 0.88, reasons: [
    { dimension: "product", matched: "Palo Alto PAN-OS", text: "PAN-OS at the perimeter, exploit is now public" },
  ]},
  { hitId: "hit-011", clientId: "CLT-003", score: 0.9, reasons: [
    { dimension: "product", matched: "Fortinet FortiOS 7.4", text: "FortiOS SSL-VPN exposed and version in the affected range" },
  ]},
  { hitId: "hit-011", clientId: "CLT-027", score: 0.86, reasons: [
    { dimension: "product", matched: "Fortinet FortiOS 7.4", text: "FortiOS in the technology profile" },
  ]},
];
write("relevance-matches.json", relevance);

// ------------------------------------------------------------ advisories (40)

const IA_HEADINGS = ["Executive Summary", "TIC Analysis", "Campaign Overview", "Attack Chain Overview", "TTPs Mapping", "Indicators", "Recommendations"];
const VA_HEADINGS = ["Executive Summary", "Impact", "CVSS v3 Base Score", "Affected Products and Versions", "Existence of Public Exploit", "Exploit Status", "TTPs Mapping", "Indicators", "Detection and Hunting", "Mitigation and Recommendation"];

let citeSeq = 0;
function cite(label, recordCount, opts = {}) {
  citeSeq += 1;
  return { id: `cit-${citeSeq}`, ref: opts.ref ?? 1, label, recordCount, urlSafe: false, ...(opts.snapshotAt ? { snapshotAt: opts.snapshotAt } : {}) };
}

function sectionsFor(type, title, iocLines, publishedAt) {
  const headings = type === "IA" ? IA_HEADINGS : VA_HEADINGS;
  return headings.map((heading, i) => {
    const id = `sec-${heading.toLowerCase().replace(/[^a-z]+/g, "-")}`;
    let body;
    let citations = [];
    let derivedFrom;
    if (heading === "Indicators") {
      body = iocLines.join("\n");
      citations = [cite("Held corpus, indicator extraction", iocLines.length, { ref: i + 1, snapshotAt: publishedAt })];
    } else if (heading === "Executive Summary") {
      body = `${title}. This advisory summarises the activity, the affected technology, and the actions CPX recommends.`;
      citations = [cite("CrowdStrike Falcon X, Reports", 3, { ref: i + 1, snapshotAt: publishedAt })];
    } else if (heading === "TTPs Mapping") {
      body = "Techniques observed in this activity are mapped in the table below.";
      derivedFrom = "validator";
    } else if (heading === "CVSS v3 Base Score") {
      body = "Scores and their authorities are recorded in the score table.";
      derivedFrom = "validator";
    } else if (heading === "Recommendations" || heading === "Mitigation and Recommendation") {
      body = "Apply the vendor fix, hunt for the listed indicators, and review perimeter exposure for the affected products.";
      derivedFrom = "template";
    } else {
      body = `${heading} for this advisory, drawn from held reporting and the triggering findings.`;
      citations = [cite("Held corpus", between(1, 9), { ref: i + 1, snapshotAt: publishedAt })];
    }
    return { id, heading, body, generated: true, ...(derivedFrom ? { derivedFrom } : {}), citations };
  });
}

const TECHNIQUES = [
  { tacticId: "TA0001", techniqueId: "T1190", techniqueName: "Exploit Public-Facing Application", resolved: true },
  { tacticId: "TA0001", techniqueId: "T1566", techniqueName: "Phishing", resolved: true },
  { tacticId: "TA0002", techniqueId: "T1059", techniqueName: "Command and Scripting Interpreter", resolved: true },
  { tacticId: "TA0003", techniqueId: "T1505.003", techniqueName: "Web Shell", resolved: true },
  { tacticId: "TA0005", techniqueId: "T1562.001", techniqueName: "Disable or Modify Tools", resolved: true },
  { tacticId: "TA0008", techniqueId: "T1021.001", techniqueName: "Remote Desktop Protocol", resolved: true },
  { tacticId: "TA0010", techniqueId: "T1567.002", techniqueName: "Exfiltration to Cloud Storage", resolved: true },
  { tacticId: "TA0040", techniqueId: "T1486", techniqueName: "Data Encrypted for Impact", resolved: true },
];

const IOC_HOSTS = [
  "update.wp2shell-cdn.com", "checkout-meridian.support", "cdn.invoice-relay.net",
  "mail.gulfcap-secure.com", "portal-update.ae-gov-services.com", "vpn-fortigate-patch.com",
  "telemetry.fleetsync-cdn.com", "docs-share.gulfcap-verify.net", "assets.dhafra-tracking.com",
];
const iocSet = (n) => {
  const out = new Set();
  while (out.size < n) {
    const kind = rand();
    if (kind < 0.35) out.add(`${between(45, 195)}.${between(10, 220)}.${between(1, 250)}.${between(2, 250)}`);
    else if (kind < 0.7) out.add(pick(IOC_HOSTS));
    else out.add(Array.from({ length: 32 }, () => "0123456789abcdef"[between(0, 15)]).join(""));
  }
  return [...out];
};

const advisories = [];

function makeAdvisory({ ref, type, title, status, version = 1, owner, pirRefs, clientIds, createdDaysAgo, publishedDaysAgo, supersedes, supersededBy, withdrawnReason, techniques = 2, cvss = [], sendBacks = [], rfi }) {
  const createdAt = iso(daysAgo(createdDaysAgo, 5));
  const publishedAt = publishedDaysAgo != null ? iso(daysAgo(publishedDaysAgo, 9)) : undefined;
  const approvedAt = publishedDaysAgo != null ? iso(daysAgo(publishedDaysAgo, 8, 30)) : undefined;
  const iocLines = type === "DG" || type === "RFI" ? [] : iocSet(between(3, 14));
  advisories.push({
    ref, type, version, title, tlp: type === "DG" ? "GREEN" : pick(["AMBER", "GREEN", "AMBER", "RED"]),
    status, ...(owner ? { owner } : {}), pirRefs, clientIds,
    sections:
      type === "DG"
        ? [{ id: "sec-digest", heading: "Daily Threat Digest", body: "Machine-generated digest of the last 24 hours of held reporting, grouped by PIR category. This document is produced without analyst review.", generated: true, derivedFrom: "template", citations: [cite("Held corpus, last 24 hours", between(14, 60), { snapshotAt: publishedAt })] }]
        : type === "RFI"
          ? []
          : sectionsFor(type, title, iocLines, publishedAt),
    techniques: type === "IA" || type === "VA" ? TECHNIQUES.slice(0, techniques).map((t) => ({ ...t, observedActivity: "Observed in the reported activity window" })) : [],
    cvss,
    checks: [
      { id: "chk-links", label: "All links resolve", passed: true, blocking: true },
      { id: "chk-mitre", label: "MITRE techniques resolve", passed: true, blocking: true },
      { id: "chk-citations", label: "Every generated section cites or declares derivation", passed: true, blocking: true },
    ],
    sendBacks,
    ...(supersedes ? { supersedes } : {}),
    ...(supersededBy ? { supersededBy } : {}),
    ...(rfi ? { rfi } : {}),
    createdAt,
    ...(publishedAt ? { publishedAt, approvedAt, approvedBy: "Sara Haddad" } : {}),
    ...(withdrawnReason ? { withdrawnReason } : {}),
  });
}

// Daily digests: created by the schedule, one row per day, including the failure.
for (let d = 0; d <= 7; d++) {
  const dt = daysAgo(d, 3);
  const mmdd = `${String(dt.getUTCMonth() + 1).padStart(2, "0")}${String(dt.getUTCDate()).padStart(2, "0")}`;
  const didNotRun = d === 4; // 29 July
  makeAdvisory({
    ref: `CPX-TIC-DG-2026-${mmdd}`,
    type: "DG",
    title: `Daily Threat Digest, ${dt.getUTCDate()} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][dt.getUTCMonth()]} 2026`,
    status: didNotRun ? "did-not-run" : "published",
    pirRefs: ["PIR17", "PIR22", "PIR24"],
    clientIds: ["CLT-003", "CLT-014", "CLT-027", "CLT-041"],
    createdDaysAgo: d,
    publishedDaysAgo: didNotRun ? undefined : d,
  });
}

// 2026 Intelligence Advisories
makeAdvisory({ ref: "CPX-TIC-IA-2026-322", type: "IA", title: "Moonlit Sirocco intrusions against Gulf energy operators", status: "published", owner: "Rajesh Menon", pirRefs: ["PIR1", "PIR9"], clientIds: ["CLT-027"], createdDaysAgo: 155, publishedDaysAgo: 152, techniques: 4 });
makeAdvisory({ ref: "CPX-TIC-IA-2026-330", type: "IA", title: "Trojanised invoice campaign delivering AsyncRAT", status: "published", owner: "Praveen Kumar", pirRefs: ["PIR6"], clientIds: ["CLT-014"], createdDaysAgo: 130, publishedDaysAgo: 127, techniques: 3 });
makeAdvisory({ ref: "CPX-TIC-IA-2026-336", type: "IA", title: "Credential marketplace activity naming regional banks", status: "published", owner: "Praveen Kumar", pirRefs: ["PIR20", "PIR21"], clientIds: ["CLT-003"], createdDaysAgo: 105, publishedDaysAgo: 102 });
makeAdvisory({ ref: "CPX-TIC-IA-2026-340", type: "IA", title: "Watering hole cluster on regional news portals", status: "published", owner: "Rajesh Menon", pirRefs: ["PIR23"], clientIds: ["CLT-003", "CLT-014", "CLT-027"], createdDaysAgo: 80, publishedDaysAgo: 77, techniques: 3 });
makeAdvisory({ ref: "CPX-TIC-IA-2026-344", type: "IA", title: "Hacktivist DDoS wave announced against Gulf targets", status: "published", owner: "Rajesh Menon", pirRefs: ["PIR19"], clientIds: ["CLT-003", "CLT-027"], createdDaysAgo: 55, publishedDaysAgo: 52 });
makeAdvisory({ ref: "CPX-TIC-IA-2026-347", type: "IA", title: "Ransomware listing of a GCC industrial group", status: "published", owner: "Praveen Kumar", pirRefs: ["PIR22"], clientIds: ["CLT-027"], createdDaysAgo: 9, publishedDaysAgo: 7, techniques: 5 });
makeAdvisory({ ref: "CPX-TIC-IA-2026-348", type: "IA", title: "Smishing surge impersonating parcel carriers", status: "in-review", owner: "Praveen Kumar", pirRefs: ["PIR10"], clientIds: ["CLT-003"], createdDaysAgo: 6 });
makeAdvisory({ ref: "CPX-TIC-IA-2026-349", type: "IA", title: "Duplicate: ransomware listing of a GCC industrial group", status: "withdrawn", owner: "Rajesh Menon", pirRefs: ["PIR22"], clientIds: ["CLT-027"], createdDaysAgo: 8, withdrawnReason: "Duplicate of CPX-TIC-IA-2026-347" });
makeAdvisory({ ref: "CPX-TIC-IA-2026-350", type: "IA", title: "EDR-killer tooling adopted by tracked regional actor", status: "in-review", owner: "Rajesh Menon", pirRefs: ["PIR5"], clientIds: ["CLT-014", "CLT-027"], createdDaysAgo: 4, sendBacks: [{ at: iso(daysAgo(2, 11)), by: "Sara Haddad", reason: "missing-citation" }] });
makeAdvisory({ ref: "CPX-TIC-IA-2026-351", type: "IA", title: "Infostealer wave seeded through UAE job portals", status: "draft", owner: "Praveen Kumar", pirRefs: ["PIR7"], clientIds: [], createdDaysAgo: 1 });

// 2026 Vulnerability Advisories
makeAdvisory({ ref: "CPX-TIC-VA-2026-095", type: "VA", title: "FortiOS SSL-VPN heap overflow exploited in the wild", status: "published", owner: "Rajesh Menon", pirRefs: ["PIR13"], clientIds: ["CLT-003", "CLT-027"], createdDaysAgo: 140, publishedDaysAgo: 139, cvss: [{ cveId: "CVE-2026-24771", value: 8.6, vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:L", source: "Fortinet PSIRT", authorityClass: "cna", assessedAt: iso(daysAgo(30, 7)) }] });
makeAdvisory({ ref: "CPX-TIC-VA-2026-102", type: "VA", title: "wp2shell remote code execution in WordPress themes", status: "published", owner: "Praveen Kumar", pirRefs: ["PIR13", "PIR14"], clientIds: ["CLT-014", "CLT-027"], createdDaysAgo: 65, publishedDaysAgo: 64, cvss: [{ cveId: "CVE-2026-30991", value: 9.8, vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", source: "WPScan", authorityClass: "vendor", assessedAt: iso(daysAgo(20, 7)) }] });
makeAdvisory({ ref: "CPX-TIC-VA-2026-106", type: "VA", title: "Exchange out-of-band patch for actively exploited flaw", status: "published", owner: "Rajesh Menon", pirRefs: ["PIR24"], clientIds: ["CLT-003", "CLT-027"], createdDaysAgo: 40, publishedDaysAgo: 39, cvss: [{ cveId: "CVE-2026-31414", value: 9.1, source: "MSRC", authorityClass: "cna", assessedAt: iso(daysAgo(15, 7)) }] });
makeAdvisory({ ref: "CPX-TIC-VA-2026-110", type: "VA", title: "PAN-OS management interface authentication bypass", status: "published", owner: "Rajesh Menon", pirRefs: ["PIR14"], clientIds: ["CLT-027"], createdDaysAgo: 2, publishedDaysAgo: 1, cvss: [{ cveId: "CVE-2026-32155", value: 8.8, source: "Palo Alto PSIRT", authorityClass: "cna", assessedAt: iso(daysAgo(11, 7)) }] });
makeAdvisory({ ref: "CPX-TIC-VA-2026-114", type: "VA", title: "SAP NetWeaver deserialisation flaw weaponised", status: "in-review", owner: "Praveen Kumar", pirRefs: ["PIR14"], clientIds: ["CLT-014"], createdDaysAgo: 3, cvss: [{ cveId: "CVE-2026-33021", value: 9.4, source: "SAP Security Notes", authorityClass: "cna", assessedAt: iso(daysAgo(3, 7)) }] });
makeAdvisory({ ref: "CPX-TIC-VA-2026-117", type: "VA", title: "ESXi unauthenticated RCE chain, no public exploit", status: "in-review", owner: "Rajesh Menon", pirRefs: ["PIR15"], clientIds: ["CLT-003", "CLT-027"], createdDaysAgo: 2, cvss: [{ cveId: "CVE-2026-33307", value: 9.3, source: "Broadcom", authorityClass: "vendor", assessedAt: iso(daysAgo(2, 7)) }] });

// 2025, including the superseded pair
makeAdvisory({ ref: "CPX-TIC-IA-2025-201", type: "IA", title: "Initial analysis: GCC bank credential phishing wave", status: "superseded", version: 1, owner: "Rajesh Menon", pirRefs: ["PIR9"], clientIds: ["CLT-003"], createdDaysAgo: 400, publishedDaysAgo: 398, supersededBy: "CPX-TIC-IA-2025-233" });
makeAdvisory({ ref: "CPX-TIC-IA-2025-233", type: "IA", title: "GCC bank credential phishing wave, revised attribution", status: "published", version: 2, owner: "Rajesh Menon", pirRefs: ["PIR9"], clientIds: ["CLT-003"], createdDaysAgo: 380, publishedDaysAgo: 378, supersedes: "CPX-TIC-IA-2025-201", techniques: 3 });
makeAdvisory({ ref: "CPX-TIC-IA-2025-187", type: "IA", title: "Seasonal scam campaigns around UAE public holidays", status: "published", owner: "Praveen Kumar", pirRefs: ["PIR10"], clientIds: [], createdDaysAgo: 420, publishedDaysAgo: 418 });
makeAdvisory({ ref: "CPX-TIC-IA-2025-259", type: "IA", title: "Botnet resurgence across Gulf hosting providers", status: "published", owner: "Praveen Kumar", pirRefs: ["PIR7"], clientIds: ["CLT-014"], createdDaysAgo: 350, publishedDaysAgo: 349 });
makeAdvisory({ ref: "CPX-TIC-IA-2025-278", type: "IA", title: "Deep web chatter on regional aviation targets", status: "published", owner: "Rajesh Menon", pirRefs: ["PIR20"], clientIds: ["CLT-041"], createdDaysAgo: 330, publishedDaysAgo: 328 });
makeAdvisory({ ref: "CPX-TIC-VA-2025-141", type: "VA", title: "Citrix session hijack flaw under active exploitation", status: "published", owner: "Rajesh Menon", pirRefs: ["PIR13"], clientIds: ["CLT-003"], createdDaysAgo: 390, publishedDaysAgo: 389, cvss: [{ cveId: "CVE-2025-25931", value: 9.4, source: "Citrix", authorityClass: "vendor", assessedAt: iso(daysAgo(390, 7)) }] });
makeAdvisory({ ref: "CPX-TIC-VA-2025-166", type: "VA", title: "Ivanti EPMM chained zero-days", status: "published", owner: "Praveen Kumar", pirRefs: ["PIR16"], clientIds: ["CLT-027"], createdDaysAgo: 360, publishedDaysAgo: 358, cvss: [{ cveId: "CVE-2025-27812", value: 9.8, source: "Ivanti", authorityClass: "cna", assessedAt: iso(daysAgo(360, 7)) }] });
makeAdvisory({ ref: "CPX-TIC-VA-2025-190", type: "VA", title: "Oracle FLEXCUBE July critical patch analysis", status: "published", owner: "Rajesh Menon", pirRefs: ["PIR13"], clientIds: ["CLT-003"], createdDaysAgo: 340, publishedDaysAgo: 338, cvss: [{ cveId: "CVE-2025-28455", value: 8.1, source: "Oracle", authorityClass: "vendor", assessedAt: iso(daysAgo(340, 7)) }] });
makeAdvisory({ ref: "CPX-TIC-IA-2025-301", type: "IA", title: "Retrospective: a year of ransomware listings in the Gulf", status: "published", owner: "Praveen Kumar", pirRefs: ["PIR22"], clientIds: [], createdDaysAgo: 310, publishedDaysAgo: 305, techniques: 6 });

// 2024
makeAdvisory({ ref: "CPX-TIC-IA-2024-098", type: "IA", title: "Exchange mass exploitation, regional exposure review", status: "published", owner: "Rajesh Menon", pirRefs: ["PIR13"], clientIds: ["CLT-003", "CLT-027"], createdDaysAgo: 760, publishedDaysAgo: 758 });
makeAdvisory({ ref: "CPX-TIC-IA-2024-145", type: "IA", title: "Regional DDoS-for-hire ecosystem assessment", status: "published", owner: "Praveen Kumar", pirRefs: ["PIR2"], clientIds: [], createdDaysAgo: 700, publishedDaysAgo: 697 });
makeAdvisory({ ref: "CPX-TIC-IA-2024-203", type: "IA", title: "Supply chain compromise of a regional software vendor", status: "published", owner: "Rajesh Menon", pirRefs: ["PIR8"], clientIds: ["CLT-014"], createdDaysAgo: 650, publishedDaysAgo: 648, techniques: 4 });
makeAdvisory({ ref: "CPX-TIC-VA-2024-077", type: "VA", title: "MOVEit transfer exploitation retrospective", status: "published", owner: "Praveen Kumar", pirRefs: ["PIR14"], clientIds: ["CLT-014"], createdDaysAgo: 780, publishedDaysAgo: 778, cvss: [{ cveId: "CVE-2024-21899", value: 9.8, source: "Progress", authorityClass: "vendor", assessedAt: iso(daysAgo(780, 7)) }] });
makeAdvisory({ ref: "CPX-TIC-VA-2024-112", type: "VA", title: "FortiOS pre-auth RCE, regional exposure high", status: "published", owner: "Rajesh Menon", pirRefs: ["PIR13"], clientIds: ["CLT-003", "CLT-027"], createdDaysAgo: 720, publishedDaysAgo: 718, cvss: [{ cveId: "CVE-2024-23110", value: 9.6, source: "Fortinet PSIRT", authorityClass: "cna", assessedAt: iso(daysAgo(720, 7)) }] });

// RFIs: a work order, not a fourth document type
makeAdvisory({
  ref: "CPX-RFI-2026-014", type: "RFI", title: "Exposure to the wp2shell campaign across the estate",
  status: "draft", owner: "Rajesh Menon", pirRefs: ["PIR13"], clientIds: ["CLT-027"], createdDaysAgo: 1,
  rfi: {
    requester: "SOC Shift Lead", question: "Does the wp2shell campaign expose Meridian Energy Group, and what should the SOC hunt for?",
    clientId: "CLT-027", dueAt: iso(daysAgo(-1, 12)),
    steps: [
      { label: "Scope the question against held reporting", done: true, investigationId: "inv-wp2shell" },
      { label: "Confirm affected technology with the client profile", done: true },
      { label: "Draft the intelligence advisory", done: false },
    ],
  },
});
makeAdvisory({
  ref: "CPX-RFI-2026-011", type: "RFI", title: "Actor background for board risk briefing",
  status: "published", owner: "Praveen Kumar", pirRefs: ["PIR1"], clientIds: ["CLT-003"], createdDaysAgo: 18, publishedDaysAgo: 12,
  rfi: {
    requester: "Gulf Capital Bank CISO office", question: "Which actors have targeted Gulf banking in the last six months and with what tradecraft?",
    clientId: "CLT-003", dueAt: iso(daysAgo(11, 12)),
    steps: [
      { label: "Scope the question against held reporting", done: true },
      { label: "Compile actor profiles", done: true },
      { label: "Deliver as intelligence advisory CPX-TIC-IA-2026-336", done: true },
    ],
  },
});

write("advisories.json", advisories);

// --------------------------------------------------- advisory drafts (IA + VA)

const drafts = [];

drafts.push({
  ref: "CPX-TIC-IA-2026-352", type: "IA", version: 1,
  title: "DPRK supply chain campaign against logistics software",
  tlp: "AMBER", status: "in-review", owner: "Rajesh Menon",
  pirRefs: ["PIR8"], clientIds: ["CLT-014"],
  sections: [
    { id: "sec-exec", heading: "Executive Summary", body: "A DPRK-attributed cluster is compromising logistics software vendors to reach downstream operators. One UAE logistics operator is a confirmed downstream consumer of the trojanised update channel. CPX assesses follow-on intrusion attempts within the next two weeks as likely.", generated: true, citations: [{ id: "cit-d1", ref: 1, label: "CrowdStrike Falcon X, Reports", recordCount: 3, urlSafe: false }] },
    { id: "sec-tic", heading: "TIC Analysis", body: "Overlaps with tracked Lazarus subgroup tooling: matching loader export hashes, shared C2 certificate issuer, and a packing routine seen in two prior campaigns. Victimology is consistent with revenue generation rather than espionage. Source: CrowdStrike Falcon X, Actors.", generated: true, citations: [{ id: "cit-d2", ref: 2, label: "CrowdStrike Falcon X, Actors", recordCount: 5, urlSafe: false }, { id: "cit-d3", ref: 3, label: "Held corpus, campaign records", recordCount: 8, urlSafe: false }] },
    { id: "sec-campaign", heading: "Campaign Overview", body: "The campaign trojanises a fleet management suite's update package. Installations fetch the package over plain HTTP, and the actor substitutes a signed but stale certificate. Three vendors are confirmed affected; one supplies two GCC logistics groups.", generated: true, citations: [{ id: "cit-d4", ref: 4, label: "Sekoia, Campaign notes", recordCount: 2, urlSafe: false }] },
    { id: "sec-chain", heading: "Attack Chain Overview", body: "Initial access through the poisoned update, a staged loader with a five day sleep, then credential theft from the fleet telemetry database and lateral movement over RDP toward finance systems.", generated: true, citations: [{ id: "cit-d5", ref: 5, label: "Held corpus, incident writeups", recordCount: 4, urlSafe: false }] },
    { id: "sec-ttps", heading: "TTPs Mapping", body: "Techniques observed in this campaign are mapped in the table below.", generated: true, derivedFrom: "validator", citations: [] },
    { id: "sec-indicators", heading: "Indicators", body: "update.fleetsync-cdn.com\n45.148.10.77\nd41d8cd98f00b204e9800998ecf8427e\ninvoice-relay.net\n185.220.101.34\ntelemetry.fleetsync-cdn.com", generated: true, citations: [{ id: "cit-d6", ref: 6, label: "Held corpus, indicator extraction", recordCount: 6, urlSafe: false }] },
    { id: "sec-reco", heading: "Recommendations", body: "Block the listed infrastructure, verify the integrity of fleet management software updates against vendor checksums, and hunt for the loader's scheduled task names across the estate.", generated: true, derivedFrom: "template", citations: [] },
  ],
  techniques: [
    { tacticId: "TA0001", techniqueId: "T1195.002", techniqueName: "Compromise Software Supply Chain", resolved: true, observedActivity: "Trojanised fleet management update package" },
    { tacticId: "TA0006", techniqueId: "T1555", techniqueName: "Credentials from Password Stores", resolved: true, observedActivity: "Telemetry database credential theft" },
    { tacticId: "TA0008", techniqueId: "T1021.001", techniqueName: "Remote Desktop Protocol", resolved: true, observedActivity: "Lateral movement toward finance systems" },
  ],
  cvss: [],
  checks: [
    { id: "chk-links", label: "All links resolve", passed: true, blocking: true },
    { id: "chk-mitre", label: "MITRE techniques resolve", passed: true, blocking: true },
    { id: "chk-citations", label: "Every generated section cites or declares derivation", passed: true, blocking: true },
    { id: "chk-snapshot", label: "Live citations snapshotted", passed: true, blocking: true },
  ],
  sendBacks: [],
  createdAt: iso(daysAgo(0, 2, 40)),
});

drafts.push({
  ref: "CPX-TIC-VA-2026-118", type: "VA", version: 1,
  title: "wp2shell follow-on: two further WordPress theme flaws",
  tlp: "GREEN", status: "in-review", owner: "Praveen Kumar",
  pirRefs: ["PIR13", "PIR14"], clientIds: ["CLT-014", "CLT-027"],
  sections: [
    { id: "sec-exec", heading: "Executive Summary", body: "Two further vulnerabilities in the theme framework abused by the wp2shell campaign are now public. One is exploited in the wild; the second has proof-of-concept code circulating. Prose in this advisory follows the WPScan severity ordering.", generated: true, citations: [{ id: "cit-v1", ref: 1, label: "WPScan advisory pair", recordCount: 2, urlSafe: false }] },
    { id: "sec-impact", heading: "Impact", body: "Successful exploitation yields unauthenticated remote code execution in the web server context on the higher ranked flaw, and authenticated arbitrary file read on the second.", generated: true, citations: [{ id: "cit-v2", ref: 2, label: "Held corpus, exploitation notes", recordCount: 3, urlSafe: false }] },
    { id: "sec-cvss", heading: "CVSS v3 Base Score", body: "Scores and their authorities are recorded in the score table. The two authorities rank these CVEs in the opposite order.", generated: true, derivedFrom: "validator", citations: [] },
    { id: "sec-affected", heading: "Affected Products and Versions", body: "Theme framework versions 4.2.0 through 4.6.1 across all bundled themes. Version 4.6.2 fixes both flaws.", generated: true, citations: [{ id: "cit-v3", ref: 3, label: "Vendor release notes", recordCount: 1, urlSafe: false }] },
    { id: "sec-exploit-exist", heading: "Existence of Public Exploit", body: "Public exploit code exists for CVE-2026-31042. Proof-of-concept only for CVE-2026-31055.", generated: true, citations: [{ id: "cit-v4", ref: 4, label: "Exploit repository observation", recordCount: 2, urlSafe: false }] },
    { id: "sec-exploit-status", heading: "Exploit Status", body: "CVE-2026-31042 is exploited in the wild against unpatched sites. No in-the-wild exploitation observed for CVE-2026-31055.", generated: true, citations: [{ id: "cit-v5", ref: 5, label: "Held corpus, sensor reports", recordCount: 4, urlSafe: false }] },
    { id: "sec-ttps", heading: "TTPs Mapping", body: "Techniques observed in exploitation of these flaws are mapped in the table below.", generated: true, derivedFrom: "validator", citations: [] },
    { id: "sec-indicators", heading: "Indicators", body: "wp2shell-stage2.com\n91.92.240.11\n5e884898da28047151d0e56f8dc62927\nthemes-update-cdn.net", generated: true, citations: [{ id: "cit-v6", ref: 6, label: "Held corpus, indicator extraction", recordCount: 4, urlSafe: false }] },
    { id: "sec-detect", heading: "Detection and Hunting", body: "Hunt for POST requests to theme preview endpoints followed by PHP file writes under wp-content/uploads. Detection logic for the loader is referenced in the campaign advisory.", generated: true, citations: [{ id: "cit-v7", ref: 7, label: "Campaign advisory detection pack", recordCount: 1, urlSafe: false }] },
    { id: "sec-mitigation", heading: "Mitigation and Recommendation", body: "Update the theme framework to 4.6.2, restrict write access to wp-content, and review upload directories for recently created PHP files.", generated: true, derivedFrom: "template", citations: [] },
  ],
  techniques: [
    { tacticId: "TA0001", techniqueId: "T1190", techniqueName: "Exploit Public-Facing Application", resolved: true, observedActivity: "Unauthenticated RCE against theme preview endpoint" },
    { tacticId: "TA0003", techniqueId: "T1505.003", techniqueName: "Web Shell", resolved: true, observedActivity: "PHP web shell written under wp-content/uploads" },
  ],
  cvss: [
    { cveId: "CVE-2026-31042", value: 9.8, vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", source: "WPScan", authorityClass: "vendor", assessedAt: iso(daysAgo(2, 9)) },
    { cveId: "CVE-2026-31042", value: 7.5, source: "CISA-ADP", authorityClass: "adp", assessedAt: iso(daysAgo(1, 9)) },
    { cveId: "CVE-2026-31055", value: 7.2, source: "WPScan", authorityClass: "vendor", assessedAt: iso(daysAgo(2, 9)) },
    { cveId: "CVE-2026-31055", value: 9.1, source: "CISA-ADP", authorityClass: "adp", assessedAt: iso(daysAgo(1, 9)) },
  ],
  checks: [
    { id: "chk-links", label: "3 links have no target", passed: false, blocking: true, anchorSectionId: "sec-detect" },
    { id: "chk-mitre", label: "MITRE techniques resolve", passed: true, blocking: true },
    { id: "chk-citations", label: "Every generated section cites or declares derivation", passed: true, blocking: true },
    { id: "chk-cvss", label: "CVSS: prose follows WPScan; CISA-ADP ranks these CVEs in the opposite order", passed: false, blocking: false, anchorSectionId: "sec-cvss" },
  ],
  sendBacks: [],
  createdAt: iso(daysAgo(0, 1, 55)),
});

write("advisory-draft.json", drafts);

// -------------------------------------------------------- investigations (3)

const investigations = [
  {
    id: "inv-wp2shell",
    title: "wp2shell exploitation and estate exposure",
    createdAt: iso(daysAgo(0, 2, 5)),
    createdBy: "Rajesh Menon",
    turns: [
      {
        id: "t-1",
        question: "What do we know about the wp2shell campaign and which clients are exposed?",
        status: "complete",
        answer: {
          title: "wp2shell: active exploitation of WordPress theme frameworks",
          blocks: [
            { kind: "prose", text: "wp2shell is a mass exploitation campaign against a widely deployed WordPress theme framework, active since late July. Exploitation is unauthenticated and drops a PHP web shell, with follow-on deployment of a credential harvester on roughly one in five compromised sites. Source: Held corpus, campaign records.", attribution: "Held corpus, campaign records" },
            { kind: "prose", text: "Exploitation volume tripled in the last 72 hours and two regional hosting providers appear in victim telemetry. Source: CrowdStrike Falcon X, Reports.", attribution: "CrowdStrike Falcon X, Reports" },
            { kind: "table", headers: ["Client", "Exposure", "Basis"], rows: [
              ["CLT-027", "Exposed", "WordPress across the public web estate"],
              ["CLT-014", "Exposed", "WordPress in the technology profile"],
              ["CLT-003", "Not exposed", "No WordPress in the technology profile"],
            ]},
            { kind: "indicators", values: ["update.wp2shell-cdn.com", "185.220.101.34", "wp2shell-stage2.com", "91.92.240.11"] },
            { kind: "prose", text: "Recommended next step: a vulnerability advisory for the exposed clients referencing the published fix.", attribution: "Held corpus" },
          ],
          entities: [
            { id: "ent-wp2shell", name: "wp2shell", type: "campaign" },
            { id: "ent-clt027", name: "Meridian Energy Group", type: "client" },
            { id: "ent-clt014", name: "Al Dhafra Logistics", type: "client" },
          ],
          citations: [
            { id: "c-1", ref: 1, label: "Held corpus, campaign records", recordCount: 11, urlSafe: false },
            { id: "c-2", ref: 2, label: "CrowdStrike Falcon X, Reports", recordCount: 3, urlSafe: false },
          ],
          negativeResults: [],
          sourcesUnavailable: [],
          tlp: "AMBER",
          classificationSettled: true,
          egress: false,
        },
      },
      {
        id: "t-2",
        question: "What about secur32.dll? Is the sideloading variant part of this campaign?",
        status: "complete",
        answer: {
          blocks: [
            { kind: "prose", text: "No. The secur32.dll sideloading activity reported elsewhere is not linked to wp2shell in any held record. The loader chains differ and no shared infrastructure appears in either campaign's indicator set. Source: Held corpus.", attribution: "Held corpus" },
          ],
          entities: [],
          citations: [{ id: "c-3", ref: 1, label: "Held corpus, full text search", recordCount: 0, urlSafe: false }],
          negativeResults: [{ query: "secur32 strings", recordCount: 0 }, { query: "wp2shell AND sideloading", recordCount: 0 }],
          sourcesUnavailable: [],
          tlp: "GREEN",
          classificationSettled: true,
          egress: false,
        },
      },
    ],
  },
  {
    id: "inv-dprk",
    title: "DPRK supply chain reach into GCC logistics",
    createdAt: iso(daysAgo(0, 1, 20)),
    createdBy: "Rajesh Menon",
    turns: [
      {
        id: "t-1",
        question: "Trace the DPRK fleet software supply chain campaign and its reach into GCC logistics operators.",
        status: "complete",
        answer: {
          title: "DPRK supply chain campaign: GCC logistics exposure",
          blocks: [
            { kind: "prose", text: "A DPRK-attributed cluster has trojanised the update channel of a fleet management suite. Three software vendors are confirmed affected. One supplies two GCC logistics groups, of which one is a subscribed client. Source: CrowdStrike Falcon X, Actors.", attribution: "CrowdStrike Falcon X, Actors" },
            { kind: "list", items: [
              "Initial access: poisoned update package, staged loader, five day sleep",
              "Objective assessed as revenue generation, consistent with prior tracked activity",
              "Follow-on intrusion attempts assessed likely within two weeks",
            ]},
            { kind: "indicators", values: ["update.fleetsync-cdn.com", "45.148.10.77", "telemetry.fleetsync-cdn.com"] },
          ],
          entities: [
            { id: "ent-lazarus", name: "Lazarus subgroup", type: "actor" },
            { id: "ent-clt014", name: "Al Dhafra Logistics", type: "client" },
          ],
          citations: [
            { id: "c-4", ref: 1, label: "CrowdStrike Falcon X, Actors", recordCount: 5, urlSafe: false },
            { id: "c-5", ref: 2, label: "Live lookup, VirusTotal", recordCount: 2, urlSafe: false },
          ],
          negativeResults: [],
          sourcesUnavailable: ["Sekoia", "Anomali ThreatStream", "Group-IB Blog", "Flashpoint Blog"],
          sourcesTotal: 13,
          tlp: "AMBER",
          classificationSettled: true,
          egress: true,
        },
      },
    ],
  },
  {
    id: "inv-fortinet",
    title: "FortiOS SSL-VPN exploitation, advisory produced",
    createdAt: iso(daysAgo(1, 6, 40)),
    createdBy: "Praveen Kumar",
    turns: [
      {
        id: "t-1",
        question: "Create an intelligence advisory for the DPRK fleet software supply chain campaign.",
        status: "complete",
        answer: {
          title: "Draft created: DPRK supply chain campaign against logistics software",
          blocks: [
            { kind: "prose", text: "Draft CPX-TIC-IA-2026-352 has been created from the held campaign records and the two supporting actor reports. The draft carries all seven IA sections, three mapped techniques and six indicators, and is assigned for review.", attribution: "Held corpus" },
          ],
          entities: [],
          citations: [{ id: "c-6", ref: 1, label: "Held corpus, campaign records", recordCount: 8, urlSafe: false }],
          negativeResults: [],
          sourcesUnavailable: [],
          tlp: "AMBER",
          classificationSettled: true,
          egress: false,
          producedArtefact: { ref: "CPX-TIC-IA-2026-352", type: "IA" },
        },
      },
    ],
  },
];
write("investigations.json", investigations);

// ------------------------------------------------------------- sources (185)

// Sheet split: Primary 87, Secondary 19, Vuln_Monitoring 40, Ransomware_Monitoring 6, Indicators 33.
// Class lands via URL shape: feed 122, bulk 31, scrape 28, social 2, portal 2.

const PRIMARY_FEEDS = [
  ["Krebs on Security", "https://krebsonsecurity.com/feed/"],
  ["BleepingComputer", "https://www.bleepingcomputer.com/feed/"],
  ["The Hacker News", "https://feeds.feedburner.com/TheHackersNews.xml"],
  ["Dark Reading", "https://www.darkreading.com/rss.xml"],
  ["SecurityWeek", "https://www.securityweek.com/feed/"],
  ["The Record", "https://therecord.media/feed/"],
  ["CyberScoop", "https://cyberscoop.com/feed/"],
  ["Unit 42, Palo Alto", "https://unit42.paloaltonetworks.com/feed/"],
  ["Cisco Talos Intelligence", "https://blog.talosintelligence.com/rss/"],
  ["Mandiant Threat Research", "https://cloud.google.com/blog/topics/threat-intelligence/rss/"],
  ["CrowdStrike Blog", "https://www.crowdstrike.com/blog/feed/"],
  ["SentinelOne Labs", "https://www.sentinelone.com/labs/feed/"],
  ["ESET WeLiveSecurity", "https://www.welivesecurity.com/en/rss/feed/"],
  ["Kaspersky Securelist", "https://securelist.com/feed/"],
  ["Trend Micro Research", "https://www.trendmicro.com/en_us/research.rss.xml"],
  ["Sophos News", "https://news.sophos.com/en-us/feed/"],
  ["Fortinet Threat Research", "https://www.fortinet.com/blog/threat-research/rss.xml"],
  ["Check Point Research", "https://research.checkpoint.com/feed/"],
  ["Proofpoint Threat Insight", "https://www.proofpoint.com/us/rss.xml"],
  ["Recorded Future Blog", "https://www.recordedfuture.com/feed/"],
  ["Microsoft Security Blog", "https://www.microsoft.com/en-us/security/blog/feed/"],
  ["Google Threat Analysis Group", "https://blog.google/threat-analysis-group/rss/"],
  ["Cloudflare Security Blog", "https://blog.cloudflare.com/tag/security/rss/"],
  ["Akamai Security Research", "https://www.akamai.com/blog/security-research/rss.xml"],
  ["Rapid7 Blog", "https://blog.rapid7.com/rss/"],
  ["Tenable Research", "https://www.tenable.com/blog/feed"],
  ["Qualys Security Blog", "https://blog.qualys.com/feed/"],
  ["Malwarebytes Labs", "https://www.malwarebytes.com/blog/feed/index.xml"],
  ["Bitdefender Labs", "https://www.bitdefender.com/blog/api/rss/labs/"],
  ["Avast Threat Labs", "https://decoded.avast.io/feed/"],
  ["Zscaler ThreatLabz", "https://www.zscaler.com/blogs/security-research/feed"],
  ["Netskope Threat Labs", "https://www.netskope.com/blog/category/threat-labs/feed"],
  ["Huntress Blog", "https://www.huntress.com/blog/rss.xml"],
  ["Red Canary Blog", "https://redcanary.com/blog/feed/"],
  ["The DFIR Report", "https://thedfirreport.com/feed/"],
  ["SANS Internet Storm Center", "https://isc.sans.edu/rssfeed.xml"],
  ["NCSC UK Reports", "https://www.ncsc.gov.uk/api/1/services/v1/report-rss-feed.xml"],
  ["ENISA Publications", "https://www.enisa.europa.eu/rss.xml"],
  ["JPCERT/CC English Blog", "https://blogs.jpcert.or.jp/en/atom.xml"],
  ["CERT-In Advisories", "https://www.cert-in.org.in/rss/advisories.xml"],
  ["aeCERT Advisories", "https://www.tdra.gov.ae/aecert/advisories/feed/"],
  ["Group-IB Blog", "https://www.group-ib.com/blog/rss/"],
  ["Positive Technologies Research", "https://www.ptsecurity.com/ww-en/analytics/rss/"],
  ["Secureworks CTU Research", "https://www.secureworks.com/rss?feed=research"],
  ["IBM X-Force Blog", "https://securityintelligence.com/feed/"],
  ["Elastic Security Labs", "https://www.elastic.co/security-labs/rss/feed.xml"],
  ["Sekoia Blog", "https://blog.sekoia.io/feed/"],
  ["CERT-FR Alerts", "https://www.cert.ssi.gouv.fr/alerte/feed/"],
  ["AhnLab ASEC", "https://asec.ahnlab.com/en/feed/"],
  ["Intel471 Blog", "https://intel471.com/blog/feed/"],
  ["Flashpoint Blog", "https://flashpoint.io/blog/feed/"],
  ["ReliaQuest Threat Research", "https://www.reliaquest.com/blog/feed/"],
  ["Cybereason Blog", "https://www.cybereason.com/blog/rss.xml"],
  ["Deep Instinct Blog", "https://www.deepinstinct.com/blog/feed"],
  ["WithSecure Labs", "https://labs.withsecure.com/rss/all.xml"],
  ["Trellix Insights", "https://www.trellix.com/blogs/research/feed/"],
  ["Arctic Wolf Labs", "https://arcticwolf.com/resources/blog/rss/"],
  ["Dragos Blog", "https://www.dragos.com/blog/feed/"],
  ["Claroty Team82", "https://claroty.com/team82/rss.xml"],
  ["Nozomi Networks Labs", "https://www.nozominetworks.com/blog/rss.xml"],
  ["Volexity Blog", "https://www.volexity.com/blog/feed/"],
  ["Binary Defense Blog", "https://www.binarydefense.com/resources/blog/feed/"],
  ["Sucuri Blog", "https://blog.sucuri.net/feed/"],
  ["Wordfence Blog", "https://www.wordfence.com/blog/feed/"],
  ["GreyNoise Labs", "https://www.greynoise.io/blog/rss.xml"],
  ["Censys Research", "https://censys.com/blog/rss.xml"],
];
const PRIMARY_SCRAPES = [
  ["VX-Underground", "https://vx-underground.org/archive"],
  ["Hudson Rock Research", "https://www.hudsonrock.com/blog"],
  ["DarkOwl Insights", "https://www.darkowl.com/blog"],
  ["KELA Cyber Intelligence", "https://www.kelacyber.com/resources/research"],
  ["SOCRadar Research", "https://socradar.io/resources/blog"],
  ["CloudSEK Research", "https://www.cloudsek.com/threatintelligence"],
  ["CYFIRMA Research", "https://www.cyfirma.com/research"],
  ["Resecurity Research", "https://www.resecurity.com/blog"],
  ["Halcyon Research", "https://www.halcyon.ai/research"],
  ["Analyst1 Research", "https://analyst1.com/category/blog"],
  ["Team Cymru Research", "https://www.team-cymru.com/research"],
  ["Silent Push Research", "https://www.silentpush.com/research"],
  ["Validin Discoveries", "https://www.validin.com/discoveries"],
  ["Sublime Security Research", "https://sublime.security/research"],
  ["Permiso Research", "https://permiso.io/research"],
  ["Wiz Threat Research", "https://www.wiz.io/threat-research"],
  ["Sysdig Threat Research", "https://sysdig.com/threat-research"],
  ["Lab539 Notes", "https://lab539.com/notes"],
];
const PRIMARY_SOCIAL = [
  ["X, @DarkWebInformer", "https://x.com/DarkWebInformer"],
  ["X, @vxunderground", "https://x.com/vxunderground"],
];
const PRIMARY_PORTAL = [["Intel471 Titan Portal", "https://titan.intel471.com/portal/reports"]];

const SECONDARY_FEEDS = [
  ["Reuters World News", "https://www.reutersagency.com/feed/?best-topics=world"],
  ["AP Top News", "https://apnews.com/hub/ap-top-news/rss"],
  ["BBC Middle East", "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml"],
  ["Al Jazeera English", "https://www.aljazeera.com/xml/rss/all.xml"],
  ["The National", "https://www.thenationalnews.com/rss/"],
  ["Gulf News", "https://gulfnews.com/rss/uae"],
  ["Khaleej Times", "https://www.khaleejtimes.com/rss"],
  ["Arab News", "https://www.arabnews.com/rss.xml"],
  ["Middle East Eye", "https://www.middleeasteye.net/rss"],
  ["Foreign Policy", "https://foreignpolicy.com/feed/"],
  ["War on the Rocks", "https://warontherocks.com/feed/"],
  ["Carnegie Middle East Center", "https://carnegie-mec.org/rss/pubs.xml"],
  ["Chatham House MENA", "https://www.chathamhouse.org/rss/publications.xml"],
  ["Atlantic Council MENASource", "https://www.atlanticcouncil.org/blogs/menasource/feed/"],
  ["Council on Foreign Relations", "https://www.cfr.org/rss/feeds/publications.xml"],
];
const SECONDARY_SCRAPES = [
  ["UAE Government Media Office", "https://www.mediaoffice.ae/en/news"],
  ["GCC Secretariat Statements", "https://www.gcc-sg.org/en-us/MediaCenter"],
  ["US Treasury OFAC Press", "https://home.treasury.gov/news/press-releases"],
  ["EU Council Sanctions Register", "https://www.consilium.europa.eu/en/policies/sanctions"],
];

const VULN_FEEDS = [
  ["Microsoft MSRC Updates", "https://api.msrc.microsoft.com/update-guide/rss"],
  ["Adobe Security Bulletins", "https://helpx.adobe.com/security/security-bulletin.rss.xml"],
  ["Oracle Security Alerts", "https://www.oracle.com/security-alerts/rss.xml"],
  ["SAP Security Notes", "https://support.sap.com/securitynotes/feed/"],
  ["VMware Security Advisories", "https://www.broadcom.com/support/vmware-security-advisories/feed/"],
  ["Citrix Security Bulletins", "https://support.citrix.com/feed/products/security"],
  ["Fortinet PSIRT", "https://www.fortiguard.com/psirt/rss"],
  ["Palo Alto Security Advisories", "https://security.paloaltonetworks.com/rss.xml"],
  ["Cisco Security Advisories", "https://sec.cloudapps.cisco.com/security/center/psirtrss20/CiscoSecurityAdvisory.xml"],
  ["Juniper Security Advisories", "https://supportportal.juniper.net/sirt/feed/"],
  ["F5 Security Advisories", "https://my.f5.com/manage/s/security-advisories/rss"],
  ["Ivanti Security Advisories", "https://www.ivanti.com/blog/topics/security-advisory/feed"],
  ["SonicWall PSIRT", "https://psirt.global.sonicwall.com/feed/"],
  ["Sophos Security Advisories", "https://www.sophos.com/en-us/security-advisories/feed"],
  ["Trend Micro Security Bulletins", "https://success.trendmicro.com/security-bulletins/feed/"],
  ["Atlassian Security Advisories", "https://www.atlassian.com/security/advisories/rss"],
  ["GitLab Security Releases", "https://about.gitlab.com/security-releases.xml"],
  ["Drupal Security Advisories", "https://www.drupal.org/security/rss.xml"],
  ["WPScan Vulnerability Feed", "https://wpscan.com/feed/"],
  ["Joomla Security Centre", "https://developer.joomla.org/security-centre/feed/"],
  ["Apache Security Announcements", "https://lists.apache.org/security-announce/feed/"],
  ["OpenSSL Security Advisories", "https://openssl-library.org/news/vulnerabilities/feed/"],
  ["Kernel CVE Announcements", "https://lore.kernel.org/linux-cve-announce/feed/"],
  ["Ubuntu Security Notices", "https://ubuntu.com/security/notices/rss.xml"],
  ["Red Hat Security Advisories", "https://access.redhat.com/security/data/rss/"],
  ["SUSE Security Updates", "https://www.suse.com/support/update/rss/"],
  ["Debian Security Advisories", "https://www.debian.org/security/dsa.rss.xml"],
  ["Android Security Bulletins", "https://source.android.com/docs/security/bulletin/feed/"],
  ["Apple Security Releases", "https://support.apple.com/en-us/HT201222/feed/"],
  ["Chrome Releases", "https://chromereleases.googleblog.com/feeds/posts/default.xml"],
];
const VULN_SCRAPES = [
  ["Zero Day Initiative Advisories", "https://www.zerodayinitiative.com/advisories/published"],
  ["Project Zero Issue Tracker", "https://bugs.chromium.org/p/project-zero/issues"],
  ["Exploit-DB Recent", "https://www.exploit-db.com/recent"],
  ["Packet Storm Advisories", "https://packetstorm.news/advisories"],
  ["Full Disclosure Archive", "https://seclists.org/fulldisclosure/2026"],
  ["GitHub Security Advisories", "https://github.com/advisories"],
];
const VULN_BULK = [
  ["WPScan Vulnerability Export", "https://wpscan.com/api/v3/vulnerabilities/export.json"],
  ["OSV Data Snapshot", "https://storage.googleapis.com/osv-vulnerabilities/all.zip"],
  ["VulnCheck Community Snapshot", "https://api.vulncheck.com/v3/backup/community.json"],
];
const VULN_PORTAL = [["Qualys Threat Protect Portal", "https://threatprotect.qualys.com/portal/"]];

const RANSOM_FEEDS = [
  ["Ransomware.live Updates", "https://www.ransomware.live/rss.xml"],
  ["RansomLook Updates", "https://www.ransomlook.io/feed/"],
  ["DataBreaches.net", "https://databreaches.net/feed/"],
  ["SuspectFile", "https://www.suspectfile.com/feed/"],
];
const RANSOM_BULK = [
  ["Ransomwhere Payment Dataset", "https://api.ransomwhe.re/export"],
  ["ecrime.ch Ransomware Export", "https://ecrime.ch/api/groups/export.json"],
];

const INDICATOR_FEEDS = [
  ["Malware Traffic Analysis", "https://www.malware-traffic-analysis.net/blog-entries.xml"],
  ["Cryptolaemus Updates", "https://cryptolaemus.com/feed.xml"],
  ["abuse.ch Status Blog", "https://abuse.ch/blog/feed/"],
  ["Hybrid Analysis Public Feed", "https://www.hybrid-analysis.com/feed"],
  ["ANY.RUN Malware Trends", "https://any.run/malware-trends/feed/"],
  ["PolySwarm Community Feed", "https://polyswarm.network/community/feed/"],
  ["Triage Recent Submissions", "https://tria.ge/reports/public/feed/"],
];
const INDICATOR_BULK = [
  ["URLhaus Payload URLs", "https://urlhaus.abuse.ch/downloads/payloads.txt"],
  ["URLhaus Recent Additions", "https://urlhaus.abuse.ch/downloads/csv_recent.txt"],
  ["MalwareBazaar Daily Dump", "https://bazaar.abuse.ch/export/txt/sha256/recent.txt"],
  ["ThreatFox IOC Export", "https://threatfox.abuse.ch/export/json/recent.json"],
  ["Feodo Tracker Botnet C2", "https://feodotracker.abuse.ch/downloads/ipblocklist.txt"],
  ["SSLBL SSL Blacklist", "https://sslbl.abuse.ch/blacklist/sslblacklist.csv"],
  ["VXVault URL List", "http://vxvault.net/URL_List.txt"],
  ["PhishTank Verified Online", "https://data.phishtank.com/data/9c1f2ab4677e0d3c4b1a9928f3661c0de5b7a41288cc90f13da2277e19f04c55/online-valid.csv"],
  ["OpenPhish Blocklist", "https://openphish.com/feed.txt"],
  ["CyberCrime Tracker", "https://cybercrime-tracker.net/all.php?export=csv"],
  ["Botvrij IOC Set", "https://www.botvrij.eu/data/ioclist.domain.txt"],
  ["FireHOL Level 1", "https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/firehol_level1.netset.txt"],
  ["FireHOL Level 3", "https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/firehol_level3.netset.txt"],
  ["Spamhaus DROP", "https://www.spamhaus.org/drop/drop.txt"],
  ["Spamhaus EDROP", "https://www.spamhaus.org/drop/edrop.txt"],
  ["DShield Top Attackers", "https://www.dshield.org/block.txt"],
  ["ET Compromised IPs", "https://rules.emergingthreats.net/blockrules/compromised-ips.txt"],
  ["Blocklist.de All", "https://lists.blocklist.de/lists/all.txt"],
  ["CINSscore Bad Guys", "https://cinsscore.com/list/ci-badguys.txt"],
  ["Tor Exit Node List", "https://check.torproject.org/torbulkexitlist.txt"],
  ["Tor Relay Directory Dump", "https://onionoo.torproject.org/details/export.json"],
  ["GreenSnow Blocklist", "https://blocklist.greensnow.co/greensnow.txt"],
  ["Binary Defense Ban List", "https://www.binarydefense.com/banlist.txt"],
  ["C2IntelFeeds Domains", "https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/domainC2s.csv"],
  ["Maltrail Blacklist", "https://raw.githubusercontent.com/stamparm/maltrail/master/trails/static/malware.txt"],
  ["ViriBack C2 Tracker", "https://tracker.viriback.com/dump.php?export=csv"],
];

const sheetRows = [
  ["Primary", [...PRIMARY_FEEDS, ...PRIMARY_SCRAPES, ...PRIMARY_SOCIAL, ...PRIMARY_PORTAL]],
  ["Secondary", [...SECONDARY_FEEDS, ...SECONDARY_SCRAPES]],
  ["Vuln_Monitoring", [...VULN_FEEDS, ...VULN_SCRAPES, ...VULN_BULK, ...VULN_PORTAL]],
  ["Ransomware_Monitoring", [...RANSOM_FEEDS, ...RANSOM_BULK]],
  ["Indicators", [...INDICATOR_FEEDS, ...INDICATOR_BULK]],
];

function classOf(url) {
  const u = url.toLowerCase();
  const host = u.replace(/^[a-z]+:\/\//, "").split(/[/?#]/)[0];
  if (host === "x.com" || host === "twitter.com") return "social";
  if (u.includes("/portal")) return "portal";
  if (/\.(txt|csv|json|zip)(\?|$)/.test(u) || u.includes("export") || u.includes("dump") || u.includes("blocklist") || u.includes("/list/")) return "bulk";
  if (/(\/feed|\/rss|\/atom|\.xml)/.test(u)) return "feed";
  return "scrape";
}

const PIRS_BY_SHEET = {
  Primary: ["PIR1", "PIR2", "PIR3", "PIR4", "PIR5", "PIR6", "PIR7", "PIR8", "PIR9", "PIR10", "PIR11"],
  Secondary: ["PIR17", "PIR18"],
  Vuln_Monitoring: ["PIR13", "PIR14", "PIR15", "PIR16", "PIR24"],
  Ransomware_Monitoring: ["PIR22"],
  Indicators: ["PIR6", "PIR7", "PIR22"],
};

const sources = [];
let srcSeq = 0;

for (const [sheet, rows] of sheetRows) {
  for (const [name, url] of rows) {
    srcSeq += 1;
    const id = `src-${String(srcSeq).padStart(3, "0")}`;
    const cls = classOf(url);
    const rhythm = cls === "bulk" ? "continuous" : cls === "feed" ? (rand() < 0.35 ? "hourly" : "daily") : cls === "social" ? "continuous" : cls === "portal" ? "daily" : rand() < 0.5 ? "daily" : "weekly";
    const pirPool = PIRS_BY_SHEET[sheet];
    const pirRefs = sheet === "Secondary" && ["UAE Government Media Office", "GCC Secretariat Statements", "US Treasury OFAC Press", "EU Council Sanctions Register", "Foreign Policy", "War on the Rocks", "Carnegie Middle East Center", "Chatham House MENA", "Atlantic Council MENASource"].includes(name)
      ? ["PIR19"]
      : [pick(pirPool), pick(pirPool)].filter((v, i, a) => a.indexOf(v) === i);

    // baseline daily volume by rhythm
    const base = rhythm === "continuous" ? between(40, 260) : rhythm === "hourly" ? between(8, 40) : rhythm === "daily" ? between(1, 6) : 0;

    // state assignment: specific rows get the special cases
    let state = "healthy";
    if (["The DFIR Report", "Volexity Blog", "ViriBack C2 Tracker", "SonicWall PSIRT"].includes(name)) state = "silent-unexplained";
    else if (["Full Disclosure Archive", "CyberCrime Tracker", "SuspectFile"].includes(name)) state = "failing";
    else if (name === "Intel471 Titan Portal") state = "blocked-needs-credential";
    else if (["Qualys Threat Protect Portal", "Lab539 Notes", "Validin Discoveries"].includes(name)) state = "not-collected";
    else if (rhythm === "weekly" || (rhythm === "daily" && rand() < 0.1)) state = rand() < 0.6 ? "healthy" : "silent-expected";

    const silentDays = state === "silent-unexplained" ? (name === "The DFIR Report" ? 9 : between(4, 8)) : state === "silent-expected" ? between(2, 5) : 0;
    const failing = state === "failing";
    const blocked = state === "blocked-needs-credential";
    const notCollected = state === "not-collected";
    // The blocked story: polling continues on the daily cycle, every attempt
    // since the block began returns 403. Counters derive from that window so
    // the detail screen's log, stamps and failure count agree.
    const BLOCK_DAYS = 12;
    const failPerDay = rhythm === "continuous" ? 96 : 24;

    const dailyItems = [];
    let lastItemDay = null;
    for (let d = 29; d >= 0; d--) {
      const day = daysAgo(d, 0);
      let attempted = notCollected ? 0 : blocked ? 4 : rhythm === "continuous" ? 96 : rhythm === "hourly" ? 24 : rhythm === "daily" ? 4 : 4;
      let items = 0;
      if (blocked) {
        items = d < BLOCK_DAYS ? 0 : between(0, 3);
      } else if (!notCollected) {
        if (failing && d < 4) { attempted = failPerDay; items = 0; }
        else if (d < silentDays) { items = 0; }
        else if (rhythm === "weekly") { items = day.getUTCDay() === 2 ? between(1, 3) : 0; }
        else { items = Math.max(0, Math.round(base * (0.5 + rand()))); if (rand() < 0.06) items = 0; }
      }
      if (items > 0) lastItemDay = d;
      dailyItems.push({ date: dateStr(day), attempted, items });
    }

    const itemsLast30d = dailyItems.reduce((s, x) => s + x.items, 0);
    const lastAttempt = notCollected ? iso(daysAgo(between(35, 60), 8)) : iso(new Date(NOW.getTime() - between(2, 55) * 60000));
    const lastSuccess = failing ? iso(daysAgo(4, 7, 20)) : blocked ? iso(daysAgo(BLOCK_DAYS, 8)) : lastAttempt;
    let lastNewItemAt = lastItemDay == null ? iso(daysAgo(between(61, 90), 9)) : iso(daysAgo(lastItemDay, between(1, 21)));
    if (new Date(lastNewItemAt) > new Date(lastSuccess)) lastNewItemAt = lastSuccess;

    sources.push({
      id, name, url, sheet,
      enabled: !notCollected,
      expectedRhythm: rhythm,
      pirRefs,
      lastAttempt, lastSuccess, lastNewItemAt,
      itemsLast30d,
      // Counters equal the attempts implied by the timestamps, so the detail
      // screen never shows two numbers that cannot both be true.
      consecutiveFailures: failing ? 4 * failPerDay : blocked ? BLOCK_DAYS * 4 : 0,
      state,
      dailyItems,
    });
  }
}

const counts = {};
for (const s of sources) counts[s.sheet] = (counts[s.sheet] || 0) + 1;
const clsCounts = {};
for (const s of sources) { const c = classOf(s.url); clsCounts[c] = (clsCounts[c] || 0) + 1; }
console.log("sheet split:", counts, "class split:", clsCounts, "total:", sources.length);
if (sources.length !== 185) throw new Error(`Expected 185 sources, got ${sources.length}`);
for (const s of sources) {
  if (new Date(s.lastNewItemAt) > new Date(s.lastSuccess)) throw new Error(`Invariant broken on ${s.id}: lastNewItemAt > lastSuccess`);
}
write("sources.json", sources);

// ----------------------------------------------------------- connectors (13)

const connectors = [
  { id: "con-crowdstrike", name: "CrowdStrike Falcon X", captureMode: "hold-body", connected: false, verified: true, ourProposal: false, noRouteYet: false, residency: "egress" },
  { id: "con-anomali", name: "Anomali ThreatStream", captureMode: "live-only", connected: false, verified: false, ourProposal: false, noRouteYet: false, residency: "egress" },
  { id: "con-gti", name: "Google Threat Intelligence", captureMode: "hold-plus-revalidate", connected: false, verified: true, ourProposal: false, noRouteYet: false, residency: "egress" },
  { id: "con-sekoia", name: "Sekoia", captureMode: "hold-body", connected: false, verified: true, ourProposal: false, noRouteYet: false, residency: "egress" },
  { id: "con-virustotal", name: "VirusTotal", captureMode: "live-only", connected: false, verified: true, ourProposal: false, noRouteYet: false, residency: "egress" },
  { id: "con-shodan", name: "Shodan", captureMode: "live-only", connected: false, verified: true, ourProposal: false, noRouteYet: false, residency: "egress" },
  { id: "con-nvd", name: "NVD", captureMode: "hold-body", connected: false, verified: true, ourProposal: true, noRouteYet: false, residency: "egress" },
  { id: "con-kev", name: "CISA KEV", captureMode: "hold-body", connected: false, verified: true, ourProposal: true, noRouteYet: false, residency: "egress" },
  { id: "con-epss", name: "EPSS", captureMode: "hold-body", connected: false, verified: true, ourProposal: true, noRouteYet: false, residency: "egress" },
  { id: "con-mitre", name: "MITRE ATT&CK", captureMode: "hold-body", connected: false, verified: true, ourProposal: true, noRouteYet: false, residency: "egress" },
  { id: "con-soc", name: "CPX SOC Feeds", captureMode: "hold-body", connected: false, verified: true, ourProposal: false, noRouteYet: true, residency: "in-region" },
  { id: "con-ctem", name: "CPX CTEM", captureMode: "hold-body", connected: false, verified: true, ourProposal: false, noRouteYet: true, residency: "in-region" },
  { id: "con-spidersilk", name: "spiderSilk", captureMode: "live-only", connected: false, verified: true, ourProposal: false, noRouteYet: true, residency: "in-region" },
];
write("connectors.json", connectors);

// ------------------------------------------------------- keyword watches (3)

const watches = [
  {
    id: "kw-01", name: "Major global cyber events",
    terms: ["ransomware", "zero-day", "data breach", "supply chain attack"],
    language: "English", region: "Global", pirRefs: ["PIR17"], cadence: "hourly",
    lastRun: { at: iso(new Date(NOW.getTime() - 42 * 60000)), results: [
      { sourceName: "Reuters World News", count: 3 },
      { sourceName: "AP Top News", count: 2 },
      { sourceName: "BBC Middle East", count: 0 },
      { sourceName: "The Record", count: 5 },
    ]},
  },
  {
    id: "kw-02", name: "Middle East impact monitor",
    terms: ["UAE", "GCC", "Gulf", "critical infrastructure"],
    language: "English and Arabic", region: "Middle East", pirRefs: ["PIR18"], cadence: "hourly",
    lastRun: { at: iso(new Date(NOW.getTime() - 55 * 60000)), results: [
      { sourceName: "Al Jazeera English", count: 2 },
      { sourceName: "The National", count: 1 },
      { sourceName: "Gulf News", count: 0 },
      { sourceName: "Khaleej Times", count: 0 },
    ]},
  },
  {
    id: "kw-03", name: "Geopolitical cyber nexus",
    terms: ["hacktivist", "sanctions", "state-sponsored", "retaliation"],
    language: "English", region: "Middle East", pirRefs: ["PIR19"], cadence: "daily",
    lastRun: { at: iso(daysAgo(0, 1)), results: [
      { sourceName: "Foreign Policy", count: 0 },
      { sourceName: "War on the Rocks", count: 0 },
      { sourceName: "Carnegie Middle East Center", count: 0 },
    ]},
  },
];
write("keyword-watches.json", watches);

// ------------------------------------------------------- source requests (3)

const requests = [
  { id: "req-001", url: "https://blog.eclecticiq.com/rss.xml", reason: "Actor reporting with consistent GCC coverage", pirRef: "PIR1", requestedBy: "Rajesh Menon", requestedAt: iso(daysAgo(1, 10)), status: "auto-approved", note: "Feed detected. Live within the poll cycle." },
  { id: "req-002", url: "https://darkforums-index.example.onion/board/leaks", reason: "Leak board referenced in two recent credential listings", pirRef: "PIR20", requestedBy: "Praveen Kumar", requestedAt: iso(daysAgo(2, 8)), status: "queued", note: "No feed pattern. Needs a collector decision." },
  { id: "req-003", url: "https://api.darktracer.live/v1/export.json", reason: "Ransomware victim tracker with GCC tagging", pirRef: "PIR22", requestedBy: "Rajesh Menon", requestedAt: iso(daysAgo(4, 9)), status: "blocked-network", note: "Blocked by the approved URL-category list. Routed to CPX network approval." },
];
write("source-requests.json", requests);

// ----------------------------------------------------------- deliveries (20)

const published = advisories.filter((a) => a.status === "published" && a.type !== "DG");
const deliveries = [];
let dSeq = 0;
for (const a of published) {
  for (const c of a.clientIds) {
    if (deliveries.length >= 18) break;
    dSeq += 1;
    deliveries.push({
      advisoryRef: a.ref, advisoryVersion: a.version, clientId: c,
      sentAt: iso(new Date(new Date(a.publishedAt).getTime() + between(20, 160) * 60000)),
      channel: "CPX secure mail", format: "pdf",
    });
  }
}
deliveries.push({ advisoryRef: "CPX-TIC-DG-2026-0801", advisoryVersion: 1, clientId: "CLT-003", sentAt: iso(daysAgo(1, 3, 30)), channel: "CPX secure mail", format: "pdf" });
deliveries.push({ advisoryRef: "CPX-TIC-DG-2026-0801", advisoryVersion: 1, clientId: "CLT-027", sentAt: iso(daysAgo(1, 3, 30)), channel: "CPX secure mail", format: "json" });
write("deliveries.json", deliveries);

// ------------------------------------------------------------ drp items (5)

const drp = [
  { id: "drp-001", clientId: "CLT-027", kind: "impersonating-domain", subject: "meridian-energy-support.com", firstSeen: iso(daysAgo(3, 7)), severity: "High", status: "triaged" },
  { id: "drp-002", clientId: "CLT-027", kind: "leaked-credential", subject: "3 corporate accounts in an infostealer log, discovery DRP-2214, hash 9f2c44a1", firstSeen: iso(daysAgo(1, 5)), severity: "Critical", status: "new" },
  { id: "drp-003", clientId: "CLT-003", kind: "phishing-campaign", subject: "SMS campaign imitating card services", firstSeen: iso(daysAgo(2, 9)), severity: "High", status: "triaged" },
  { id: "drp-004", clientId: "CLT-003", kind: "leaked-credential", subject: "1 employee account in a combolist, discovery DRP-2199, hash c41ab220", firstSeen: iso(daysAgo(6, 11)), severity: "Medium", status: "closed" },
  { id: "drp-005", clientId: "CLT-014", kind: "brand-abuse", subject: "Counterfeit mobile app on a third-party store", firstSeen: iso(daysAgo(4, 13)), severity: "Medium", status: "new" },
];
write("drp-items.json", drp);

console.log("done");
