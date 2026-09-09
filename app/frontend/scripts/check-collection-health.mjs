// One runnable check for the collection-health ladder.
//
// The day encoding is the only non-obvious logic in that module: three states
// and four quartiles, where getting a boundary wrong silently paints a healthy
// category as a failing one. Run: node scripts/check-collection-health.mjs
//
// It re-implements dayLevel rather than importing it, because the module is
// TypeScript and this repo has no test runner and does not need one for a
// ladder this size. The two must agree; if you change one, change both.

import assert from "node:assert/strict";

function dayLevel(d) {
  if (d.attempted === 0) return "no-attempt";
  if (d.producing === 0) return "nothing-held";
  const share = d.sources === 0 ? 0 : d.producing / d.sources;
  if (share <= 0.25) return "q1";
  if (share <= 0.5) return "q2";
  if (share <= 0.75) return "q3";
  return "q4";
}

const day = (sources, attempted, producing) => ({
  date: "2026-07-04",
  sources,
  attempted,
  producing,
  items: producing,
});

// Nothing polled beats everything else, even when a stale count says otherwise.
assert.equal(dayLevel(day(100, 0, 0)), "no-attempt");
assert.equal(dayLevel(day(100, 0, 7)), "no-attempt");

// Polled, and every poll came back empty. Distinct from never having tried.
assert.equal(dayLevel(day(100, 100, 0)), "nothing-held");
assert.equal(dayLevel(day(100, 1, 0)), "nothing-held");

// The four boundaries land on the quarter, not just past it.
assert.equal(dayLevel(day(100, 100, 25)), "q1");
assert.equal(dayLevel(day(100, 100, 26)), "q2");
assert.equal(dayLevel(day(100, 100, 50)), "q2");
assert.equal(dayLevel(day(100, 100, 51)), "q3");
assert.equal(dayLevel(day(100, 100, 75)), "q3");
assert.equal(dayLevel(day(100, 100, 76)), "q4");
assert.equal(dayLevel(day(100, 100, 100)), "q4");

// A single producing source in a big category is still the palest step, never
// "nothing": the distinction between none and a few is the one that matters.
assert.equal(dayLevel(day(106, 106, 1)), "q1");

// A one-source category is all or nothing, and must not divide by zero.
assert.equal(dayLevel(day(1, 1, 1)), "q4");
assert.equal(dayLevel(day(0, 0, 0)), "no-attempt");

// The denominator is the category's size, not what was polled: a day where
// half the category was never polled has to read pale, or a scheduler outage
// hides behind the sources that did run.
assert.equal(dayLevel(day(100, 50, 50)), "q2");

console.log("collection-health: ladder OK");
