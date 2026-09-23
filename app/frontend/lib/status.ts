// One home for how a state reads: its words and its tone. Screens used to
// carry private copies of these maps and they drifted (a case read "warn" in
// the list and "idle" on its own page). Import from here instead.

import type { StatusTone } from "@/components/ui";
import type { Advisory, Source } from "./types";
import type { CaseStatus } from "./workspace-types";

type Meta = { tone: StatusTone; label: string };

export const ADVISORY_STATE: Record<Advisory["status"], Meta> = {
  draft: { tone: "idle", label: "Draft" },
  "in-review": { tone: "warn", label: "In review" },
  published: { tone: "good", label: "Published" },
  superseded: { tone: "idle", label: "Superseded" },
  withdrawn: { tone: "idle", label: "Withdrawn" },
  abandoned: { tone: "idle", label: "Abandoned" },
  retracted: { tone: "critical", label: "Retracted" },
  "did-not-run": { tone: "critical", label: "Did not run" },
  archived: { tone: "idle", label: "Archived" },
};

export const SOURCE_STATE: Record<Source["state"], Meta> = {
  healthy: { tone: "good", label: "Healthy" },
  "silent-expected": { tone: "idle", label: "Silent, expected" },
  "silent-unexplained": { tone: "warn", label: "Silent, unexplained" },
  failing: { tone: "critical", label: "Failing" },
  "blocked-needs-credential": { tone: "warn", label: "Blocked, needs credential" },
  "not-collected": { tone: "idle", label: "Not collected" },
};

export const CASE_STATE: Record<CaseStatus, Meta> = {
  draft: { tone: "idle", label: "Draft" },
  active: { tone: "warn", label: "Active" },
  "awaiting-review": { tone: "warn", label: "Awaiting review" },
  "changes-requested": { tone: "warn", label: "Changes requested" },
  completed: { tone: "good", label: "Completed" },
  archived: { tone: "idle", label: "Archived" },
};

/** Evidence and submission processing states. */
export const FILE_STATE: Record<string, Meta> = {
  processing: { tone: "warn", label: "Processing" },
  indexing: { tone: "warn", label: "Indexing" },
  ready: { tone: "good", label: "Ready" },
  partial: { tone: "warn", label: "Partial" },
  failed: { tone: "critical", label: "Failed" },
};

const GOOD = new Set(["published", "completed", "done", "ready", "healthy", "live", "resolved"]);
const WARN = new Set([
  "in-review",
  "awaiting-review",
  "changes-requested",
  "active",
  "new",
  "running",
  "processing",
  "indexing",
  "partial",
  "triaged",
  "escalated",
  "investigating",
]);
const CRITICAL = new Set(["failed", "failing", "retracted", "did-not-run", "error"]);

/** A tone for a status string from a payload that carries no type of its own. */
export function statusTone(status: string): StatusTone {
  if (GOOD.has(status)) return "good";
  if (CRITICAL.has(status)) return "critical";
  if (WARN.has(status)) return "warn";
  return "idle";
}

// Acronyms keep their capitals inside a label: "edit-pir" reads "Edit PIR".
const ACRONYM = /(pir|rfi|ioc|tlp|cve|ttp|stix)(s?)/gi;

/** "in-review" reads "In review". */
export function statusLabel(status: string): string {
  const words = status.replaceAll("-", " ").replaceAll("_", " ").trim();
  if (!words) return "-";
  return (words[0].toUpperCase() + words.slice(1)).replace(ACRONYM, (_, a: string, s: string) => a.toUpperCase() + s);
}
