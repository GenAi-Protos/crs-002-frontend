// What a global search returns. One shape, whatever the records came from.
//
// The UI never sees an Advisory, a LookupRecord or a Pir: it sees hits. That is
// what lets a backend search endpoint replace the client-side matcher later
// without touching a single component.

import type { Advisory, Investigation, LookupRecord, Pir } from "../types";
import type { IntelligenceDataset } from "../dashboard/types";

export type SearchCategory =
  | "intelligence"
  | "reports"
  | "investigations"
  | "campaigns"
  | "pirs";

export const CATEGORY_LABEL: Record<SearchCategory, string> = {
  intelligence: "Intelligence / IOC",
  reports: "Reports",
  investigations: "Investigations",
  campaigns: "Campaigns",
  pirs: "PIRs",
};

/** Filter chips, in the order they appear. "all" is not a category. */
export const FILTERS = [
  "all",
  "intelligence",
  "reports",
  "investigations",
  "campaigns",
  "pirs",
] as const;

export type SearchFilter = (typeof FILTERS)[number];

export interface SearchHit {
  /** Unique across the whole result set. */
  id: string;
  category: SearchCategory;
  /** The record's name. Indicators arrive here already defanged. */
  title: string;
  /** A short kind: "IP address", "IA", "PIR12". */
  badge?: string;
  /** Why this matched, in one line. Never a bare score. */
  context: string;
  href: string;
  /** Identifiers render monospace. */
  mono?: boolean;
  /**
   * Direct hits matched the query itself; related hits matched something the
   * query is connected to, and say so.
   */
  related?: boolean;
  /** Ranking only. Never rendered. */
  score: number;
}

export interface SearchGroup {
  category: SearchCategory;
  label: string;
  hits: SearchHit[];
  /** Hits found beyond the ones listed. */
  more: number;
}

export interface SearchResult {
  query: string;
  groups: SearchGroup[];
  total: number;
  /**
   * Records that matched and were removed because of the role. Counted, not
   * described: withhold at assembly and render the count.
   */
  withheld: number;
  /** True while the corpus is still loading. */
  loading?: boolean;
}

/**
 * Everything searchable, already assembled for one user. Whoever loads this is
 * responsible for having applied the role rules to `advisories` first.
 */
export interface SearchCorpus {
  advisories: Advisory[];
  investigations: Investigation[];
  pirs: Pir[];
  lookups: LookupRecord[];
  dataset: IntelligenceDataset;
}
