// Dashboard derivations. Every one counts or orders what the backend sent:
// no ratio, score or trend is made up here (CLAUDE.md rule 8). The one
// runnable check is scripts/check-dashboard.mjs; change both together.

import type { AdvisoryRow, Campaign, DashboardView, Finding, IntelligenceDataset, Severity } from "./types";

export const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

const RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function severityCounts(findings: Finding[]): Record<Severity, number> {
  const out: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) out[f.severity] += 1;
  return out;
}

/** Critical and high findings, worst first, then newest first. */
export function urgentFindings(findings: Finding[]): Finding[] {
  return findings
    .filter((f) => f.severity === "critical" || f.severity === "high")
    .sort((a, b) => RANK[a.severity] - RANK[b.severity] || Date.parse(b.firstSeen) - Date.parse(a.firstSeen));
}

/** Findings per PIR category, largest first; ties by name. */
export function byCategory(findings: Finding[]): { label: string; value: number }[] {
  const m = new Map<string, number>();
  for (const f of findings) m.set(f.category, (m.get(f.category) ?? 0) + 1);
  return [...m]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

/** Active campaigns first, then by last activity, newest first. */
export function orderedCampaigns(campaigns: Campaign[]): Campaign[] {
  return [...campaigns].sort(
    (a, b) =>
      Number(b.status === "active") - Number(a.status === "active") ||
      Date.parse(b.lastActivity) - Date.parse(a.lastActivity),
  );
}

/** The backend sends advisories unordered. */
export function recentAdvisories(advisories: AdvisoryRow[]): AdvisoryRow[] {
  return [...advisories].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export interface Posture {
  critical: number;
  high: number;
  activeCampaigns: number;
  emerging: number;
}

export function posture(d: IntelligenceDataset): Posture {
  const sev = severityCounts(d.findings);
  return {
    critical: sev.critical,
    high: sev.high,
    activeCampaigns: d.campaigns.filter((c) => c.status === "active").length,
    emerging: d.emergingThreats.length,
  };
}

type Insight = DashboardView["insights"][number];

/** An insight whose every item is a labelled number draws as bars. */
export function isNumericInsight(i: Insight): boolean {
  return (
    i.items.length > 0 &&
    i.items.every((x) => typeof x.value === "number" && !!x.label && !x.href && !x.summaryEndpoint)
  );
}

/**
 * The publication trend arrives as only the days that had a release. A day
 * absent from it had none, so the window is filled with zeros (a count of
 * nothing, not an estimate) and drawn as evenly spaced days.
 */
export function fillDays(
  items: { label?: string; value?: string | number | null }[],
  to: string,
  days: number,
): { date: string; value: number }[] {
  const byDay = new Map<string, number>();
  for (const i of items) {
    if (i.label && typeof i.value === "number") byDay.set(i.label.slice(0, 10), i.value);
  }
  const end = new Date(to);
  const out: { date: string; value: number }[] = [];
  for (let n = days - 1; n >= 0; n -= 1) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - n));
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, value: byDay.get(key) ?? 0 });
  }
  return out;
}
