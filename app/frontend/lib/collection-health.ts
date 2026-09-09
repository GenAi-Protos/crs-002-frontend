// Collection health, derived. Pure functions: no React, no fetching.
//
// The old view drew one row per source, 185 rows by 30 days, about 5,500 cells
// on arrival. It answered "how did every source do on every day", which is not
// a question anyone opens this tab with. The two questions that are asked are
// "what needs me today" and "is collection holding up", so this file derives
// exactly those two, and nothing else.

import { CATEGORY_DEFINITIONS } from "./collection-workflows";
import { agoFromNow, gstDate } from "./format";
import type { Source } from "./types";

/** States that mean a person has to do something. Silent-expected is not one. */
export const ATTENTION_STATES: Source["state"][] = [
  "failing",
  "blocked-needs-credential",
  "silent-unexplained",
];

/**
 * The sources someone has to act on, worst first. A source that is quiet
 * because it is meant to be quiet is not here: that is why `silent-expected`
 * exists as a state of its own.
 */
export function needsAttention(sources: Source[]): Source[] {
  return sources
    .filter((s) => ATTENTION_STATES.includes(s.state))
    .sort(
      (a, b) =>
        ATTENTION_STATES.indexOf(a.state) - ATTENTION_STATES.indexOf(b.state) ||
        +new Date(a.lastNewItemAt) - +new Date(b.lastNewItemAt),
    );
}

/** What is wrong, in words, from fields only. The pill already names the state. */
export function attentionReason(s: Source): string {
  switch (s.state) {
    case "failing":
      return `${s.consecutiveFailures} consecutive failures, last item ${agoFromNow(s.lastNewItemAt)}`;
    case "blocked-needs-credential":
      return `No access since ${gstDate(s.lastSuccess)}`;
    case "silent-unexplained":
      return `Last item ${agoFromNow(s.lastNewItemAt)}, ${s.expectedRhythm} expected`;
    default:
      return `Last item ${agoFromNow(s.lastNewItemAt)}`;
  }
}

// --- the 30 day strip --------------------------------------------------------

export interface CategoryDay {
  date: string;
  /** Sources in the category. Constant across days: the denominator. */
  sources: number;
  /** Sources that were polled at all that day. */
  attempted: number;
  /** Sources that returned at least one item that day. */
  producing: number;
  items: number;
}

export type DayLevel =
  | "no-attempt"
  | "nothing-held"
  | "q1"
  | "q2"
  | "q3"
  | "q4";

/**
 * A day's colour is the share of the category's sources that returned
 * something, not its volume.
 *
 * Volume cannot be coloured across these categories: on a median day IOC Feeds
 * collects 3,442 items and Ransomware Monitoring collects 443, so a shared
 * absolute ramp needs decade-wide steps and IOC Feeds could lose 60% of its
 * collection without changing colour. Colouring each category against its own
 * busiest day is worse still: the denominator is one observation inside a
 * sliding window, so a cell would change colour tomorrow with nothing having
 * happened, and one bulk dump would render the other 29 days pale.
 *
 * The share has the same meaning on every row, and its denominator is printed
 * beside the strip, so a cell can be read back as a count. Volume is not lost:
 * it is in the tooltip, exactly, and on the category card as a total.
 */
export function dayLevel(d: CategoryDay): DayLevel {
  if (d.attempted === 0) return "no-attempt";
  if (d.producing === 0) return "nothing-held";
  const share = d.sources === 0 ? 0 : d.producing / d.sources;
  if (share <= 0.25) return "q1";
  if (share <= 0.5) return "q2";
  if (share <= 0.75) return "q3";
  return "q4";
}

/** Every level, labelled. The legend renders from this, so it cannot drift. */
export const DAY_LEVEL_LABEL: Record<DayLevel, string> = {
  "no-attempt": "not attempted",
  "nothing-held": "none",
  q1: "to 25%",
  q2: "to 50%",
  q3: "to 75%",
  q4: "to 100%",
};

export function dayTooltip(d: CategoryDay): string {
  const on = gstDate(`${d.date}T12:00:00Z`);
  if (d.attempted === 0) return `${on}: no source attempted`;
  const missed = d.sources - d.attempted;
  return (
    `${on}: ${d.producing} of ${d.sources} sources returned items, ` +
    `${d.items.toLocaleString("en-GB")} items` +
    (missed > 0 ? `, ${missed} not attempted` : "")
  );
}

/** The worst day, in words, so the row still reads with colour removed. */
export function daysSummary(days: CategoryDay[]): string {
  if (days.length === 0) return "No daily record";
  const low = days.reduce((a, b) => (b.producing <= a.producing ? b : a));
  return `Lowest day ${low.producing} of ${low.sources}, ${gstDate(`${low.date}T12:00:00Z`)}`;
}

export interface CategoryStrip {
  key: string;
  label: string;
  /** The Source.category this row covers, so a caller can scope to its rows. */
  sourceCategory: string;
  units: number;
  days: CategoryDay[];
  total: number;
}

/**
 * One 30-day strip per inventory category. Categories are the grouping the rest
 * of this tab already uses, so the page stops carrying two different groupings
 * of the same rows. Connector and analyst categories hold no per-day record, so
 * they get no strip rather than 30 cells implying we polled and got nothing.
 */
export function categoryStrips(sources: Source[]): CategoryStrip[] {
  return CATEGORY_DEFINITIONS.filter(
    (def) => def.origin === "inventory" && def.sourceCategory,
  )
    .map((def) => {
      const rows = sources.filter((s) => s.category === def.sourceCategory);
      const dates = rows[0]?.dailyItems.map((d) => d.date) ?? [];

      const days: CategoryDay[] = dates.map((date, i) => {
        let items = 0;
        let attempted = 0;
        let producing = 0;
        for (const s of rows) {
          const d = s.dailyItems[i];
          if (!d || d.date !== date) continue;
          items += d.items;
          if (d.attempted > 0) attempted += 1;
          if (d.items > 0) producing += 1;
        }
        return { date, sources: rows.length, attempted, producing, items };
      });

      return {
        key: def.key,
        label: def.label,
        sourceCategory: def.sourceCategory as string,
        units: rows.length,
        days,
        total: days.reduce((n, d) => n + d.items, 0),
      };
    })
    .sort((a, b) => b.units - a.units);
}

// --- one source's own 30 days ------------------------------------------------

export type SourceDayState = "held" | "nothing-held" | "no-attempt";

/**
 * Three flat states, no ramp. A share means nothing for a single source, and
 * these are the same three states `components/chart/DailyBars.tsx` already uses
 * on the source detail page, so a row here and that chart speak one language.
 */
export function sourceDayState(d: {
  attempted: number;
  items: number;
}): SourceDayState {
  if (d.attempted === 0) return "no-attempt";
  return d.items === 0 ? "nothing-held" : "held";
}
