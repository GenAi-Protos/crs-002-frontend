// Projecting the shared dataset into one role's dashboard.
//
// Every role counts the same findings from the same dataset, so a lead analyst
// and a chief executive cannot be shown different numbers of critical threats.
// What changes is which widgets are built, how much detail each carries, and
// what is removed before the payload is handed to a component.
//
// Removal happens here, not in the renderer. A widget that is not drawn was
// still sent, and the count of what was withheld is returned alongside so the
// screen can say so rather than quietly showing less.

import type { RoleKey } from "../types";
import { resolveTechnique, TACTICS } from "../mitre";
import { defang } from "../defang";
import { agoFromNow, gstDate, gstDateTime } from "../format";
import { configFor, type RoleAccess } from "./roles";
import type {
  Cell,
  Column,
  IntelligenceDataset,
  RoleDashboard,
  Severity,
  Widget,
  Withheld,
} from "./types";

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "var(--color-cpx-red)",
  high: "var(--color-cat-5)",
  medium: "var(--color-cat-1)",
  low: "var(--color-seq-3)",
};

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];
const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const CAT_COLORS = [
  "var(--color-cpx-red)",
  "var(--color-cat-5)",
  "var(--color-cat-1)",
  "var(--color-seq-3)",
];

const INDICATOR_LABEL = {
  ipv4: "IP address",
  domain: "Domain",
  url: "URL",
  sha256: "File hash",
  email: "Email address",
} as const;

const sevCell = (s: Severity): Cell => ({
  text: SEVERITY_LABEL[s],
  swatch: SEVERITY_COLOR[s],
});

/** A relative date with the exact one on hover. Held on a single line. */
const agoCell = (iso: string): Cell => ({
  text: agoFromNow(iso),
  title: gstDateTime(iso),
  nowrap: true,
});

const trendLabels = (d: IntelligenceDataset) =>
  d.trend.map((p) => gstDate(p.date).slice(0, 6));

/** Severity counts across all findings. The same numbers for every role. */
function severitySlices(d: IntelligenceDataset) {
  return SEVERITY_ORDER.map((s) => ({
    label: SEVERITY_LABEL[s],
    value: d.findings.filter((f) => f.severity === s).length,
  }));
}

// --- widget builders ---------------------------------------------------------
// Each one answers a question the role actually has. A builder that could not
// name that question was not written.

function buildWidget(
  id: string,
  d: IntelligenceDataset,
  role: RoleKey,
  access: RoleAccess,
): Widget | null {
  const critical = d.findings.filter((f) => f.severity === "critical");
  const high = d.findings.filter((f) => f.severity === "high");
  const activeCampaigns = d.campaigns.filter((c) => c.status === "active");
  const openInvestigations = d.investigations.filter((i) => i.status !== "closed");
  const inReview = d.advisories.filter((a) => a.status === "in-review");
  const clientsTouched = new Set(
    d.findings.flatMap((f) => f.sectors.map((s) => s)),
  ).size;

  switch (id) {
    // --- shared -------------------------------------------------------------

    case "kpis": {
      const common = {
        critical: {
          key: "critical",
          label: "Critical threats",
          value: critical.length,
          unit: "open, needing a decision",
          window: `last ${d.window.days} days`,
        },
        campaigns: {
          key: "campaigns",
          label: "Active campaigns",
          value: activeCampaigns.length,
          unit: "currently tracked",
        },
        clients: {
          key: "clients",
          label: "Clients affected",
          value: Math.max(...d.findings.map((f) => f.clientCount), 0),
          unit: "by the largest finding",
        },
        sectors: {
          key: "sectors",
          label: "Sectors affected",
          value: d.sectors.filter((s) => s.findings > 0).length,
          unit: `of ${d.sectors.length} tracked`,
        },
      };

      if (role === "lead-analyst") {
        return {
          kind: "kpis",
          id,
          items: [
            { ...common.critical, href: "/reports" },
            {
              key: "review",
              label: "Awaiting review",
              value: inReview.length,
              unit: "advisories needing approval",
              higherIsWorse: true,
              href: "/reports",
            },
            {
              key: "investigations",
              label: "Open investigations",
              value: openInvestigations.length,
              unit: `of ${d.investigations.length} this period`,
              href: "/intelligence",
            },
            {
              key: "sources",
              label: "Sources with issues",
              value: d.sourceHealth.failing + d.sourceHealth.silentUnexplained,
              unit: `of ${d.sourceHealth.total} not reporting`,
              higherIsWorse: true,
              href: "/collection",
            },
          ],
        };
      }

      if (role === "incident-responder") {
        return {
          kind: "kpis",
          id,
          items: [
            { ...common.critical, href: "/reports" },
            { ...common.campaigns },
            {
              key: "indicators",
              label: "Indicators held",
              value: d.indicators.length,
              unit: "on active campaigns",
              href: "/intelligence",
            },
            {
              key: "detections",
              label: "Detection content",
              value: d.detections.length,
              unit: "rules and hunting queries",
            },
          ],
        };
      }

      if (role === "sales") {
        return {
          kind: "kpis",
          id,
          items: [
            {
              key: "trending",
              label: "Trending threats",
              value: critical.length + high.length,
              unit: "worth raising with a client",
              window: `last ${d.window.days} days`,
            },
            { ...common.sectors },
            {
              key: "advisories",
              label: "Published advisories",
              value: d.advisories.filter((a) => a.status === "published").length,
              unit: "you can share",
              href: "/reports",
            },
            {
              key: "regions",
              label: "Regions affected",
              value: d.regions.length,
              unit: "with activity this period",
            },
          ],
        };
      }

      // Leadership and executive: the business shape of the same findings.
      return {
        kind: "kpis",
        id,
        items: [
          { ...common.critical },
          { ...common.campaigns },
          { ...common.sectors },
          ...(access.clientDetail
            ? [
                {
                  key: "clients",
                  label: "Clients in scope",
                  value: Math.max(...d.findings.map((f) => f.clientCount), 0),
                  unit: "of the largest finding",
                },
              ]
            : [common.clients]),
        ],
      };
    }

    case "threat-level":
      return {
        kind: "callout",
        id,
        title: `Threat level: ${d.threatLevel.level}`,
        // The level never appears without the sentence that earned it.
        body: d.threatLevel.reason,
        tone:
          d.threatLevel.level === "severe" || d.threatLevel.level === "high"
            ? "critical"
            : d.threatLevel.level === "elevated"
              ? "warn"
              : "neutral",
        points: [
          `Set ${agoFromNow(d.threatLevel.changedAt)}, on ${gstDate(d.threatLevel.changedAt)}`,
          `${critical.length} critical and ${high.length} high findings in the last ${d.window.days} days`,
        ],
      };

    case "severity":
      return {
        kind: "donut",
        id,
        title: "Severity distribution",
        note: `All findings, last ${d.window.days} days`,
        slices: severitySlices(d),
        colors: CAT_COLORS,
        totalLabel: "findings",
      };

    case "trend":
      return {
        kind: "line",
        id,
        title:
          role === "executive" || role === "leadership"
            ? "Threat activity over time"
            : "Collection and detection over time",
        note: `${d.window.days} days to ${gstDate(d.window.to)}`,
        xLabel: "Date recorded",
        yLabel: access.indicators
          ? "Items recorded on that date"
          : "Findings raised on that date",
        explanation: access.indicators
          ? "Shows the number of intelligence items collected and threats detected over time. Each point is the count recorded on that date."
          : "Shows the number of threats detected over time. Each point is the count recorded on that date.",
        labels: trendLabels(d),
        series:
          access.indicators
            ? [
                {
                  label: "Collected: indicators added",
                  color: "var(--color-cat-2)",
                  values: d.trend.map((p) => p.indicators),
                },
                {
                  label: "Detected: findings raised",
                  color: "var(--color-cat-1)",
                  values: d.trend.map((p) => p.detections),
                },
              ]
            : [
                // Without indicator access the second series is meaningless, so
                // it is dropped rather than shown as an unexplained line.
                {
                  label: "Findings raised",
                  color: "var(--color-cat-1)",
                  values: d.trend.map((p) => p.detections),
                },
              ],
      };

    case "sectors":
      return {
        kind: "bars",
        id,
        title: "Findings by client sector",
        note: `Last ${d.window.days} days`,
        items: d.sectors.map((s) => ({ label: s.sector, value: s.findings })),
        labelClass: "w-44",
      };

    case "regions":
      return {
        kind: "bars",
        id,
        title: "Findings by region",
        note: `Last ${d.window.days} days`,
        items: d.regions,
        color: "var(--color-cat-4)",
        labelClass: "w-24",
      };

    case "emerging":
      return {
        kind: "list",
        id,
        title: "Emerging threats",
        note: "Developments worth watching",
        empty: "0 emerging threats this period.",
        items: d.emergingThreats.map((e) => ({
          primary: e.title,
          secondary: e.note,
          meta: `${SEVERITY_LABEL[e.severity]} · first seen ${gstDate(e.firstSeen)}`,
        })),
      };

    case "campaigns":
      return {
        kind: "table",
        id,
        title: "Active campaigns",
        note: `${activeCampaigns.length} active, ${d.campaigns.length} tracked`,
        empty: "0 campaigns tracked.",
        columns: access.techniques
          ? [
              { label: "Severity", width: "w-24" },
              { label: "Campaign" },
              { label: "Sectors" },
              { label: "Clients", width: "w-20", align: "right" },
              { label: "Last activity", width: "w-28" },
            ]
          : [
              { label: "Severity", width: "w-24" },
              { label: "Campaign" },
              { label: "What it means" },
              { label: "Sectors" },
              { label: "Last activity", width: "w-28" },
            ],
        rows: d.campaigns.map((c) =>
          access.techniques
            ? [
                sevCell(c.severity),
                {
                  text: c.name,
                  href: c.advisoryRef ? `/reports/${c.advisoryRef}` : undefined,
                },
                { text: c.sectors.join(", "), tone: "muted" },
                { text: String(c.clientCount) },
                agoCell(c.lastActivity),
              ]
            : [
                sevCell(c.severity),
                { text: c.name },
                { text: c.summary, tone: "muted" },
                { text: c.sectors.join(", "), tone: "muted" },
                agoCell(c.lastActivity),
              ],
        ),
      };

    case "advisories":
      return {
        kind: "table",
        id,
        title: role === "sales" ? "Advisories you can share" : "Key advisories",
        note:
          role === "sales"
            ? "Published only"
            : `${inReview.length} awaiting approval`,
        empty: "0 advisories this period.",
        columns: [
          { label: "Severity", width: "w-24" },
          { label: "Reference", width: "w-52" },
          { label: "Title" },
          // How many clients an advisory concerns is client detail, and Sales
          // is scoped to its own accounts rather than the whole book.
          ...(access.clientDetail
            ? [{ label: "Clients", width: "w-20", align: "right" } as Column]
            : []),
          { label: "Status", width: "w-28" },
        ],
        rows: (role === "sales"
          ? d.advisories.filter((a) => a.status === "published")
          : d.advisories
        ).map((a) => [
          sevCell(a.severity),
          { text: a.ref, mono: true, href: `/reports/${a.ref}` },
          { text: a.title },
          ...(access.clientDetail ? [{ text: String(a.clientCount) }] : []),
          { text: a.status, tone: a.status === "in-review" ? "warn" : "muted" },
        ]),
      };

    // --- lead analyst -------------------------------------------------------

    case "priority-threats":
      return {
        kind: "table",
        id,
        title: "Critical and high priority",
        note: `${critical.length} critical, ${high.length} high`,
        empty: "0 critical or high findings.",
        columns: [
          { label: "Severity", width: "w-24" },
          { label: "Finding" },
          { label: "Category", width: "w-48" },
          { label: "Clients", width: "w-20", align: "right" },
          { label: "Status", width: "w-28" },
        ],
        rows: [...critical, ...high].map((f) => [
          sevCell(f.severity),
          { text: f.title },
          { text: f.category, tone: "muted" },
          { text: String(f.clientCount) },
          { text: f.status, tone: f.status === "new" ? "warn" : "muted" },
        ]),
      };

    case "awaiting-review":
      return {
        kind: "table",
        id,
        title: "Reports awaiting your review",
        note: "You are the only approver",
        empty: "0 reports awaiting review.",
        columns: [
          { label: "Reference", width: "w-52" },
          { label: "Title" },
          { label: "Owner", width: "w-28" },
          { label: "Updated", width: "w-28" },
        ],
        rows: inReview.map((a) => [
          { text: a.ref, mono: true, href: `/reports/${a.ref}` },
          { text: a.title },
          { text: a.owner, tone: "muted" },
          agoCell(a.updatedAt),
        ]),
      };

    case "investigations":
      return {
        kind: "table",
        id,
        title: "Investigation status",
        note: `${openInvestigations.length} open of ${d.investigations.length}`,
        empty: "0 investigations this period.",
        columns: [
          { label: "Investigation" },
          { label: "Owner", width: "w-28" },
          { label: "Status", width: "w-36" },
          { label: "Open for", width: "w-28" },
        ],
        rows: d.investigations.map((i) => [
          { text: i.title },
          { text: i.owner, tone: "muted" },
          {
            text: i.status.replace("-", " "),
            tone: i.status === "awaiting-review" ? "warn" : "muted",
          },
          agoCell(i.openedAt),
        ]),
      };

    case "indicators-summary":
      // A summary, not the values: a lead analyst is triaging, not hunting.
      return {
        kind: "bars",
        id,
        title: "Indicators by type",
        note: `${d.indicators.length} held on active campaigns`,
        items: Object.entries(
          d.indicators.reduce<Record<string, number>>((acc, i) => {
            const label = INDICATOR_LABEL[i.type];
            acc[label] = (acc[label] ?? 0) + 1;
            return acc;
          }, {}),
        )
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value),
        color: "var(--color-cat-2)",
        labelClass: "w-32",
      };

    case "activity":
      return {
        kind: "list",
        id,
        title: "Team activity",
        note: "Most recent first",
        empty: "0 actions this period.",
        items: d.activity.map((a) => ({
          primary: `${a.actor} · ${a.action}`,
          secondary: a.ref,
          meta: agoFromNow(a.at),
        })),
      };

    case "collection":
      return {
        kind: "stats",
        id,
        title: "Collection",
        note: "Feeding everything above",
        stats: [
          { label: "Sources", value: d.sourceHealth.total },
          {
            label: "Enabled",
            value: `${d.sourceHealth.enabled} of ${d.sourceHealth.total}`,
          },
          {
            label: "Failing",
            value: d.sourceHealth.failing,
            warn: d.sourceHealth.failing > 0,
          },
          {
            label: "Silent, unexplained",
            value: d.sourceHealth.silentUnexplained,
            warn: d.sourceHealth.silentUnexplained > 0,
          },
          {
            label: "Last collection",
            value: d.sourceHealth.lastCollection
              ? agoFromNow(d.sourceHealth.lastCollection)
              : "never",
          },
        ],
      };

    // --- leadership and executive -------------------------------------------

    case "critical-threats":
      return {
        kind: "table",
        id,
        title: "Critical threats",
        note: "What the business is exposed to now",
        empty: "0 critical threats. That is a real result, not a gap.",
        columns: [
          { label: "Severity", width: "w-24" },
          { label: "Threat" },
          { label: "Business impact" },
          { label: "Sectors", width: "w-48" },
        ],
        rows: critical.map((f) => [
          sevCell(f.severity),
          { text: f.title },
          { text: f.businessImpact, tone: "muted" },
          { text: f.sectors.join(", "), tone: "muted" },
        ]),
      };

    // --- incident responder -------------------------------------------------

    case "active-threats":
      return {
        kind: "table",
        id,
        title: "Active and critical threats",
        note: "Ordered by severity",
        empty: "0 active threats.",
        columns: [
          { label: "Severity", width: "w-24" },
          { label: "Threat" },
          { label: "Techniques", width: "w-56" },
          { label: "Status", width: "w-28" },
        ],
        rows: [...critical, ...high].map((f) => [
          sevCell(f.severity),
          { text: f.title },
          {
            text: f.techniqueIds.join(", ") || "none held",
            mono: f.techniqueIds.length > 0,
            tone: f.techniqueIds.length ? undefined : "muted",
          },
          { text: f.status, tone: f.status === "new" ? "warn" : "muted" },
        ]),
      };

    case "attack-chain": {
      const c = activeCampaigns[0];
      if (!c) return null;
      return {
        kind: "list",
        id,
        title: `Attack chain: ${c.name}`,
        note: "Initial access through to impact",
        empty: "No attack chain held.",
        items: c.attackChain.map((step, i) => ({
          primary: `${i + 1}. ${step}`,
        })),
      };
    }

    case "indicators-table":
      return {
        kind: "table",
        id,
        title: "Indicators",
        note: "Stored raw, rendered defanged. Inert on this page.",
        empty: "0 indicators held.",
        columns: [
          { label: "Type", width: "w-28" },
          { label: "Indicator", width: "w-[22rem]" },
          { label: "Confidence", width: "w-32" },
          { label: "Context" },
        ],
        rows: d.indicators.map((i) => [
          { text: INDICATOR_LABEL[i.type], badge: true },
          // Defanged at the point of rendering, as everywhere else. Copying
          // takes what is shown: defanged, so the clipboard is not a way round
          // the rule.
          {
            text: defang(i.value),
            mono: true,
            copy: true,
            title: "Inert text, never a link",
          },
          { text: `${i.confidence}%`, percent: i.confidence },
          { text: i.note, tone: "muted" },
        ]),
      };

    case "malware":
      return {
        kind: "table",
        id,
        title: "Malware",
        note: "Observed on active campaigns",
        empty: "0 malware families held.",
        columns: [
          { label: "Name", width: "w-44" },
          { label: "Family", width: "w-32" },
          { label: "Behaviour" },
        ],
        rows: d.malware.map((m) => [
          { text: m.name },
          { text: m.family, tone: "muted" },
          { text: m.behaviour, tone: "muted" },
        ]),
      };

    case "techniques": {
      const counts = new Map<string, number>();
      for (const f of d.findings)
        for (const t of f.techniqueIds) counts.set(t, (counts.get(t) ?? 0) + 1);
      for (const c of d.campaigns)
        for (const t of c.techniqueIds) counts.set(t, (counts.get(t) ?? 0) + 1);

      return {
        kind: "table",
        id,
        title: "MITRE ATT&CK techniques",
        note: "Ids resolve against the held table; one that does not is marked",
        empty: "0 techniques observed.",
        columns: [
          { label: "Technique", width: "w-28" },
          { label: "Name" },
          { label: "Tactic", width: "w-48" },
          { label: "Seen in", width: "w-20", align: "right" },
        ],
        rows: [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([id_, n]) => {
            const r = resolveTechnique(id_);
            return [
              { text: id_, mono: true, copy: true },
              r
                ? { text: r.name }
                : { text: "Does not resolve", tone: "warn" as const },
              {
                text: r ? r.tactics.map((t) => TACTICS[t] ?? t).join(", ") : "-",
                tone: "muted" as const,
              },
              { text: String(n) },
            ];
          }),
      };
    }

    case "detections":
      return {
        kind: "table",
        id,
        title: "Detection and hunting content",
        note: "What already covers this activity",
        empty: "0 detection rules held.",
        columns: [
          { label: "Kind", width: "w-28" },
          { label: "Name" },
          { label: "Reference", width: "w-36" },
          { label: "Covers" },
        ],
        rows: d.detections.map((x) => [
          { text: x.kind === "hunting" ? "Hunting" : x.kind.toUpperCase(), badge: true },
          { text: x.name },
          { text: x.ref, mono: true, copy: true },
          { text: x.coverage, tone: "muted" },
        ]),
      };

    case "actors":
      return {
        kind: "table",
        id,
        title: "Threat actors",
        note: "Context for the activity above",
        empty: "0 actors held.",
        columns: [
          { label: "Actor", width: "w-44" },
          { label: "Motivation" },
          { label: "Records", width: "w-20", align: "right" },
          {
            label: "Last seen",
            width: "w-28",
            info: "The most recent date a held record mentions this actor. It is when we last saw them in collected intelligence, not when they were last active: an actor with nothing collected this week may still be working. Times are GST.",
          },
        ],
        rows: d.actors.map((a) => [
          {
            text: a.name,
            title: a.aliases.length ? `Also: ${a.aliases.join(", ")}` : undefined,
          },
          { text: a.motivation, tone: "muted" },
          { text: String(a.records) },
          agoCell(a.lastSeen),
        ]),
      };

    // --- sales --------------------------------------------------------------

    case "trending":
      return {
        kind: "table",
        id,
        title: "Trending threats",
        note: "In language a client will understand",
        empty: "0 trending threats this period.",
        columns: [
          { label: "Severity", width: "w-24" },
          { label: "Threat" },
          { label: "Why it matters" },
          { label: "Sectors", width: "w-48" },
        ],
        rows: [...critical, ...high].map((f) => [
          sevCell(f.severity),
          { text: f.title },
          { text: f.businessImpact, tone: "muted" },
          { text: f.sectors.join(", "), tone: "muted" },
        ]),
      };

    case "client-summary":
      return {
        kind: "stats",
        id,
        title: "This period at a glance",
        note: "Figures you can quote",
        stats: [
          { label: "Sectors with activity", value: clientsTouched },
          { label: "Active campaigns", value: activeCampaigns.length },
          {
            label: "Advisories published",
            value: d.advisories.filter((a) => a.status === "published").length,
          },
          { label: "Window", value: `${d.window.days} days` },
        ],
      };

    default:
      return null;
  }
}

// --- projection --------------------------------------------------------------

export function projectDashboard(
  dataset: IntelligenceDataset,
  role: RoleKey,
): RoleDashboard {
  const config = configFor(role);
  const { access } = config;

  const widgets = config.widgets
    .map((id) => buildWidget(id, dataset, role, access))
    .filter((w): w is Widget => w !== null);

  // What this role did not receive, and how much of it there was. Counted from
  // the dataset, so the number is real rather than a placeholder.
  const withheld: Withheld[] = [];
  if (!access.indicators)
    withheld.push({ label: "indicators", count: dataset.indicators.length });
  if (!access.techniques) {
    const ids = new Set(
      dataset.findings
        .flatMap((f) => f.techniqueIds)
        .concat(dataset.campaigns.flatMap((c) => c.techniqueIds)),
    );
    withheld.push({ label: "ATT&CK techniques", count: ids.size });
  }
  if (!access.detections)
    withheld.push({ label: "detection rules", count: dataset.detections.length });
  if (!access.malware)
    withheld.push({ label: "malware records", count: dataset.malware.length });

  return {
    role,
    audience: config.audience,
    window: dataset.window,
    generatedAt: dataset.generatedAt,
    widgets,
    withheld: withheld.filter((w) => w.count > 0),
  };
}
