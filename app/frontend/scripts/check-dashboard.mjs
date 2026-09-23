// One runnable check for the dashboard derivations (lib/dashboard/intel.ts).
//
// The ordering is the logic worth guarding: a critical finding must never sit
// below a high one, a newer finding must lead within a band, and a filled
// publication window must keep the counts it was given and add only zeros.
// Run: node scripts/check-dashboard.mjs
//
// It re-implements the functions rather than importing them, because the
// module is TypeScript and this repo has no test runner (the precedent is
// scripts/check-collection-health.mjs). If you change one, change both.

import assert from "node:assert/strict";

const RANK = { critical: 0, high: 1, medium: 2, low: 3 };

function urgentFindings(findings) {
  return findings
    .filter((f) => f.severity === "critical" || f.severity === "high")
    .sort(
      (a, b) =>
        RANK[a.severity] - RANK[b.severity] || Date.parse(b.firstSeen) - Date.parse(a.firstSeen),
    );
}

function severityCounts(findings) {
  const out = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) out[f.severity] += 1;
  return out;
}

function fillDays(items, to, days) {
  const byDay = new Map();
  for (const i of items) if (i.label && typeof i.value === "number") byDay.set(i.label.slice(0, 10), i.value);
  const end = new Date(to);
  const out = [];
  for (let n = days - 1; n >= 0; n -= 1) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - n));
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, value: byDay.get(key) ?? 0 });
  }
  return out;
}

const f = (id, severity, firstSeen) => ({ id, severity, firstSeen });
const findings = [
  f("a", "high", "2026-08-02T00:00:00Z"),
  f("b", "critical", "2026-07-01T00:00:00Z"),
  f("c", "low", "2026-08-03T00:00:00Z"),
  f("d", "critical", "2026-08-01T00:00:00Z"),
  f("e", "medium", "2026-08-01T00:00:00Z"),
];

// Worst band first, newest first within a band; medium and low never appear.
assert.deepEqual(urgentFindings(findings).map((x) => x.id), ["d", "b", "a"]);

// Counts are counts: every finding lands in exactly one band.
const counts = severityCounts(findings);
assert.deepEqual(counts, { critical: 2, high: 1, medium: 1, low: 1 });
assert.equal(Object.values(counts).reduce((s, n) => s + n, 0), findings.length);

// The window keeps the given days, fills the rest with zero, and ends on `to`.
const filled = fillDays(
  [
    { label: "2026-09-21", value: 2 },
    { label: "2026-09-23", value: 1 },
  ],
  "2026-09-23T13:00:00Z",
  7,
);
assert.equal(filled.length, 7);
assert.equal(filled.at(-1).date, "2026-09-23");
assert.equal(filled[0].date, "2026-09-17");
assert.equal(filled.reduce((s, d) => s + d.value, 0), 3);
assert.equal(filled.find((d) => d.date === "2026-09-22").value, 0);

console.log("dashboard derivations: all checks passed");
