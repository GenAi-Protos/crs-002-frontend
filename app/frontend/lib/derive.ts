// Collector class, capture mode and residency are DERIVED, never stored.
// CPX's inventory has two columns: Source and Link. Everything else is ours.

import type { CaptureMode, CollectorClass, Source, SourceCategory } from "./types";

export function deriveClass(url: string): CollectorClass {
  const u = url.toLowerCase();
  const host = hostOf(u);
  if (host === "x.com" || host === "twitter.com") return "social";
  if (u.includes("/portal")) return "portal";
  if (
    /\.(txt|csv|json|zip)(\?|$)/.test(u) ||
    u.includes("export") ||
    u.includes("dump") ||
    u.includes("blocklist") ||
    u.includes("/list/")
  )
    return "bulk";
  if (/(\/feed|\/rss|\/atom|\.xml)(\/)?(\?|$)?/.test(u)) return "feed";
  return "scrape";
}

export function deriveCaptureMode(cls: CollectorClass): CaptureMode {
  switch (cls) {
    case "feed":
      return "hold-body";
    case "bulk":
      return "hold-plus-revalidate";
    case "scrape":
      return "snapshot-series";
    case "portal":
      return "live-only";
    case "social":
      return "keyword-search";
  }
}

// The five sources CPX tagged geopolitical in the delivered inventory
// (FR-ING-04). Matched by name so the category resolves the moment the real
// inventory lands, whatever the URLs turn out to be.
const GEOPOLITICAL = [
  "accessnow",
  "bellingcat",
  "cybershafarat",
  "itnewsafrica",
  "itsecurityguru",
];

const MESSAGING = ["telegram", "t.me", "discord"];

function squash(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** What kind of source this is, for the analyst-facing category filter.
 *
 * Derived, never stored, for the same reason collector class is: CPX's
 * inventory has two columns and everything else is ours to work out. The
 * sheet still decides the contractual counts under FR-ING-01; this only
 * decides which tab a row appears under. */
export function deriveCategory(s: Pick<Source, "name" | "url" | "sheet">): SourceCategory {
  const hay = `${s.name} ${s.url}`.toLowerCase();

  // Named carve-outs win over the sheet, for the two categories that are not
  // a sheet: a Telegram channel is a messaging source wherever it was filed.
  if (GEOPOLITICAL.includes(squash(s.name))) return "Geopolitical Intelligence";
  if (MESSAGING.some((k) => hay.includes(k))) return "Telegram and Messaging";

  switch (s.sheet) {
    case "Indicators":
      return "IOC Feeds";
    case "Vuln_Monitoring":
      return "Vulnerability Monitoring";
    case "Ransomware_Monitoring":
      return "Ransomware Monitoring";
    default:
      return "OSINT Feeds";
  }
}

/** Every category the console shows, in the order CPX listed them.
 *
 * Fixed, not derived from the data: a category with no sources is a coverage
 * gap worth seeing, not a tab to hide. SI-5 is measured on exactly this. */
export const SOURCE_CATEGORIES: SourceCategory[] = [
  "OSINT Feeds",
  "IOC Feeds",
  "Vulnerability Monitoring",
  "Ransomware Monitoring",
  "Geopolitical Intelligence",
  "Telegram and Messaging",
];

export function deriveResidency(url: string): "in-region" | "egress" {
  const host = hostOf(url.toLowerCase());
  return host.endsWith(".ae") ? "in-region" : "egress";
}

export function hostOf(url: string): string {
  return url.replace(/^[a-z]+:\/\//i, "").split(/[/?#]/)[0];
}

export const captureModeLabel: Record<CaptureMode, string> = {
  "hold-body": "Held",
  "hold-plus-revalidate": "Both",
  "snapshot-series": "Held",
  "live-only": "Live",
  "keyword-search": "Both",
};
