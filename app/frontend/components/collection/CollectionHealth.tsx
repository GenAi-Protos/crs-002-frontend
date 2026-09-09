"use client";

// Collection health: what needs a person today, and whether collection is
// holding up over the window.
//
// This replaces a 185-row by 30-day grid of about 5,500 cells that was open on
// arrival. Two things went wrong in that grid and are fixed here. It grouped by
// collector class while everything else on the tab groups by category, and its
// legend named three states while eight fills actually rendered, with no key
// for the six ramp steps. Here the key renders from the same map as the cells,
// so they cannot drift.

import { useState } from "react";
import Link from "next/link";
import {
  attentionReason,
  categoryStrips,
  dayLevel,
  dayTooltip,
  daysSummary,
  needsAttention,
  sourceDayState,
  DAY_LEVEL_LABEL,
  type DayLevel,
  type SourceDayState,
} from "@/lib/collection-health";
import { gstDate } from "@/lib/format";
import type { Source } from "@/lib/types";
import { IconChevronDown } from "@/components/icons";
import { StatusPill, buttonClass, type StatusTone } from "@/components/ui";

const HATCH =
  "repeating-linear-gradient(45deg,var(--color-rule) 0,var(--color-rule) 2px,white 2px,white 4px)";

// Four steps of the sequential ramp, spaced apart so four buckets stay
// separable, ending on Dark Purple as docs/03 defines the ramp. The lightest
// step starts at seq-3: seq-2 and the hatch are within a few points of
// lightness and would be confusable at this size.
const DAY_FILL: Record<DayLevel, string> = {
  "no-attempt": "var(--color-inset)",
  "nothing-held": HATCH,
  q1: "var(--color-seq-3)",
  q2: "var(--color-seq-5)",
  q3: "var(--color-seq-7)",
  q4: "var(--color-seq-9)",
};

const SOURCE_FILL: Record<SourceDayState, string> = {
  held: "var(--color-cat-1)",
  "nothing-held": HATCH,
  "no-attempt": "var(--color-inset)",
};

const STATE_META: Record<Source["state"], { tone: StatusTone; label: string }> = {
  healthy: { tone: "good", label: "Healthy" },
  "silent-expected": { tone: "idle", label: "Silent, expected" },
  "silent-unexplained": { tone: "warn", label: "Silent, unexplained" },
  failing: { tone: "critical", label: "Failing" },
  "blocked-needs-credential": { tone: "warn", label: "Blocked, needs credential" },
  "not-collected": { tone: "idle", label: "Not collected" },
};

/**
 * The alarm. It sits above the category filter because it is the thing a person
 * arrives for, and filtering it could hide half of it.
 */
export function NeedsAttention({ sources }: { sources: Source[] }) {
  const list = needsAttention(sources);
  return (
    <section className="border border-cpx-grey-100 bg-white">
      <div className="flex items-center gap-2 border-b border-cpx-grey-100 px-4 py-2.5">
        <h2 className="font-sans text-xs font-medium">Needs attention</h2>
        <span className="bg-cpx-grey-50 px-1 text-2xs">{list.length}</span>
      </div>
      {list.length === 0 ? (
        <p className="px-4 py-3 text-base">No source is failing or blocked.</p>
      ) : (
        <div className="max-h-64 overflow-y-auto">
          {list.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-cpx-grey-100 px-4 py-2 first:border-t-0"
            >
              <StatusPill {...STATE_META[s.state]} />
              {/* The internal detail route only. An inventory URL is never an
                  anchor: FR-SAF-01. */}
              <Link
                href={`/collection/sources/${s.id}`}
                className="text-sm text-link underline underline-offset-2"
              >
                {s.name}
              </Link>
              <span className="text-xs text-cpx-grey-500">
                {attentionReason(s)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Thirty days, one row per category.
 *
 * It reads every source, never the search-filtered rows: the colour is a share
 * of a category's sources, so a filtered denominator would make every cell lie.
 * The table below keeps its own filters and states its own honest total.
 */
export function CategoryDays({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const strips = categoryStrips(sources);
  const withRecord = strips.filter((s) => s.units > 0);
  const dates = withRecord[0]?.days ?? [];

  return (
    <div className="mt-2 overflow-x-auto border border-cpx-grey-100 bg-white p-4">
      <div className="min-w-[52rem]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-2xs text-cpx-grey-500">
          <span>Share of a category&apos;s sources returning items, by day</span>
          {(Object.keys(DAY_LEVEL_LABEL) as DayLevel[]).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3"
                style={{ background: DAY_FILL[k] }}
              />
              {DAY_LEVEL_LABEL[k]}
            </span>
          ))}
        </div>

        <div className="mt-3">
          {strips.map((strip) => (
            <CategoryRow
              key={strip.key}
              strip={strip}
              sources={sources}
              open={open === strip.key}
              onToggle={() => setOpen(open === strip.key ? null : strip.key)}
            />
          ))}
        </div>

        {dates.length > 0 && (
          <div className="mt-2 flex justify-between text-2xs text-cpx-grey-500">
            <span>{gstDate(`${dates[0].date}T12:00:00Z`)}</span>
            <span>
              {gstDate(`${dates[dates.length - 1].date}T12:00:00Z`)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryRow({
  strip,
  sources,
  open,
  onToggle,
}: {
  strip: ReturnType<typeof categoryStrips>[number];
  sources: Source[];
  open: boolean;
  onToggle: () => void;
}) {
  const empty = strip.units === 0;
  return (
    <div className="border-t border-cpx-grey-100 py-1.5 first:border-t-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          aria-expanded={open}
          disabled={empty}
          className="flex w-56 shrink-0 items-center gap-1.5 text-left text-xs disabled:text-cpx-grey-400"
        >
          {!empty && <IconChevronDown className={open ? "rotate-180" : ""} />}
          <span className="truncate">{strip.label}</span>
          <span className="bg-cpx-grey-50 px-1 text-2xs">{strip.units}</span>
        </button>

        {empty ? (
          <span className="text-2xs text-cpx-grey-500">No sources</span>
        ) : (
          <>
            <div className="flex gap-[2px]">
              {strip.days.map((d) => (
                <span
                  key={d.date}
                  title={dayTooltip(d)}
                  className="inline-block h-4 w-4"
                  style={{ background: DAY_FILL[dayLevel(d)] }}
                />
              ))}
            </div>
            {/* The row still reads with colour removed. */}
            <span className="text-2xs text-cpx-grey-500">
              {daysSummary(strip.days)}
            </span>
          </>
        )}
      </div>

      {open && !empty && (
        <SourceDayGrid
          sources={sources.filter((s) => s.category === strip.sourceCategory)}
        />
      )}
    </div>
  );
}

/** One category's sources, quietest first, so pagination cannot hide a problem. */
function SourceDayGrid({ sources }: { sources: Source[] }) {
  const [shown, setShown] = useState(50);
  const list = [...sources].sort(
    (a, b) => +new Date(a.lastNewItemAt) - +new Date(b.lastNewItemAt),
  );

  return (
    <div className="pb-2 pl-7 pt-1">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 py-1 text-2xs text-cpx-grey-500">
        <span>
          {Math.min(shown, list.length)} of {list.length} sources, quietest first
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3"
            style={{ background: SOURCE_FILL.held }}
          />
          items held
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3"
            style={{ background: HATCH }}
          />
          attempted, none held
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 bg-inset" /> not attempted
        </span>
      </div>

      {list.slice(0, shown).map((s) => (
        <div key={s.id} className="flex items-center gap-2 py-px">
          <Link
            href={`/collection/sources/${s.id}`}
            title={s.name}
            className="w-48 shrink-0 truncate text-2xs text-cpx-grey-500 hover:text-link"
          >
            {s.name}
          </Link>
          <div className="flex gap-[2px]">
            {s.dailyItems.map((d) => (
              <span
                key={d.date}
                title={`${gstDate(`${d.date}T12:00:00Z`)}: ${d.items} items, ${d.attempted} attempts`}
                className="inline-block h-3 w-3"
                style={{ background: SOURCE_FILL[sourceDayState(d)] }}
              />
            ))}
          </div>
        </div>
      ))}

      {list.length > shown && (
        <button
          onClick={() => setShown(shown + 50)}
          className={buttonClass("secondary", "sm", "mt-2")}
        >
          Show more
        </button>
      )}
    </div>
  );
}
