// The poll log, derived deterministically from a source's fixture data.
// The point of the log is the hidden failure mode: a silent-unexplained
// source logs clean 200s with zero new items while lastNewItemAt ages.

import type { Source } from "./types";

export interface PollLogRow {
  date: string;
  attempts: number;
  items: number;
  outcome: string;
  failed: boolean;
}

export function pollLog(source: Source): PollLogRow[] {
  const days = [...source.dailyItems].reverse(); // newest first
  return days.map((d, idx) => {
    if (d.attempted === 0) {
      return {
        date: d.date,
        attempts: 0,
        items: 0,
        outcome:
          source.state === "blocked-needs-credential"
            ? "Not attempted, blocked"
            : "Not collected",
        failed: false,
      };
    }
    // The failure window covers the most recent days of a failing source.
    if (source.state === "failing" && idx < 4) {
      return {
        date: d.date,
        attempts: d.attempted,
        items: d.items,
        outcome: "HTTP error on every attempt",
        failed: true,
      };
    }
    // Blocked: every attempt after the last success returns 403; days before
    // the block read as ordinary polling.
    if (source.state === "blocked-needs-credential") {
      const blockStart = source.lastSuccess.slice(0, 10);
      const inBlock = d.date > blockStart;
      return {
        date: d.date,
        attempts: d.attempted,
        items: d.items,
        outcome: inBlock
          ? "HTTP 403, credential required"
          : d.items > 0
            ? `200 OK, ${d.items} new item${d.items === 1 ? "" : "s"}`
            : "200 OK, 0 new items",
        failed: inBlock,
      };
    }
    return {
      date: d.date,
      attempts: d.attempted,
      items: d.items,
      outcome:
        d.items > 0
          ? `200 OK, ${d.items} new item${d.items === 1 ? "" : "s"}`
          : "200 OK, 0 new items",
      failed: false,
    };
  });
}
