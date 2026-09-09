// The search data layer. The one seam between where searchable records come
// from and the component that draws the results.
//
//   today      backend where it exists, fixture where it does not
//   later      GET /search, or an index in front of it
//
// The component calls `loadCorpus` once and `runSearch` on every keystroke. To
// move matching to the server, `runSearch` becomes a fetch and the hit shape
// stays as it is: nothing in the UI knows the difference.
//
// Two rules this layer holds:
//
//   Nothing here leaves the region. Search reads held records only. It never
//   calls a reputation provider, because typing in a search box is not the
//   deliberate act that an egress query has to be.
//
//   Reports are assembled for the user before they are matched, so a role that
//   may not receive indicators cannot find one through a section body.

import { assembleAdvisories } from "../access";
import { getInvestigations, getPirs, getReports } from "../api";
import { ADVISORIES, INVESTIGATIONS, PIRS } from "../fixtures";
import { LOOKUPS } from "../lookup";
import { MOCK_DATASET } from "../dashboard/service";
import type { ConsoleUser } from "../types";
import type { SearchCorpus } from "./types";

export interface CorpusResult {
  corpus: SearchCorpus;
  /** True when any part of it came from the backend. */
  live: boolean;
}

/**
 * Load everything searchable for one user.
 *
 * Each source falls back on its own: a backend that is down for reports should
 * not take investigations and PIRs down with it, and a search that silently
 * returns fewer records is worse than one that returns what it could reach.
 */
export async function loadCorpus(user: ConsoleUser): Promise<CorpusResult> {
  const [advisories, investigations, pirs] = await Promise.all([
    getReports(user.id).catch(() => ADVISORIES),
    getInvestigations(user.id).catch(() => INVESTIGATIONS),
    getPirs(user.id).catch(() => PIRS),
  ]);

  return {
    // The role rules are applied here, once, rather than in the matcher: a
    // report the user cannot open must not be searchable either.
    corpus: {
      advisories: assembleAdvisories(advisories, user),
      investigations,
      pirs,
      // Held IOC records and the shared intelligence dataset have no endpoint
      // yet. They are the same fixtures the Lookup and the dashboards read.
      lookups: LOOKUPS,
      dataset: MOCK_DATASET,
    },
    live: advisories !== ADVISORIES,
  };
}

export { runSearch, countsFor, searchAccessFor, refang } from "./index";

// --- recent searches ---------------------------------------------------------
//
// Session storage, not local: a searched indicator is not something to leave on
// a shared machine after the tab closes.

const RECENT_KEY = "nestor-recent-searches";
const RECENT_MAX = 6;

export function readRecent(): string[] {
  try {
    const raw = sessionStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecent(query: string): string[] {
  const q = query.trim();
  if (q.length < 2) return readRecent();
  const next = [q, ...readRecent().filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(
    0,
    RECENT_MAX,
  );
  try {
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage refused. Recent searches are a convenience, never a record.
  }
  return next;
}

export function clearRecent(): string[] {
  try {
    sessionStorage.removeItem(RECENT_KEY);
  } catch {
    // As above.
  }
  return [];
}
