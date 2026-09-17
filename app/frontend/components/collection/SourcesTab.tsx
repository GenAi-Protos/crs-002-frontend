"use client";

// The 185-row table plus the health heatmap. `Last item` is lastNewItemAt,
// not lastSuccess: a 200-with-no-items source looks healthy on every other field.

import { useMemo, useState } from "react";
import Link from "next/link";
import { SOURCES } from "@/lib/fixtures-sources";
import { patchSource } from "@/lib/api";
import { SourcesDashboard, type CategoryFilter } from "./SourcesDashboard";
import { CategoryDays, NeedsAttention } from "./CollectionHealth";
import { CATEGORY_DEFINITIONS } from "@/lib/collection-workflows";
import { useConsoleUser } from "@/lib/role-context";
import type { Connector, Rhythm, Source } from "@/lib/types";
import { agoFromNow } from "@/lib/format";
import { redactUrlForExport } from "@/lib/defang";
import { downloadCsv, InertUrl, ListMeta, SearchBox, StatusPill, type StatusTone, buttonClass } from "@/components/ui";
import { IconChevronDown } from "@/components/icons";
import { T_HEAD, T_ROW, T_TABLE, T_TD, T_TH } from "@/components/table";

const STATE_META: Record<Source["state"], { tone: StatusTone; label: string }> = {
  healthy: { tone: "good", label: "Healthy" },
  "silent-expected": { tone: "idle", label: "Silent, expected" },
  "silent-unexplained": { tone: "warn", label: "Silent, unexplained" },
  failing: { tone: "critical", label: "Failing" },
  "blocked-needs-credential": { tone: "warn", label: "Blocked, needs credential" },
  "not-collected": { tone: "idle", label: "Not collected" },
};

// The state filter options, once: the same list on every render.
const STATE_OPTIONS = ["All", ...Object.keys(STATE_META)];

const RHYTHMS: Rhythm[] = ["continuous", "hourly", "daily", "weekly"];

export function SourcesTab({
  initialRows = SOURCES,
  connectors = [],
  // The scheduler ships off. Passed in rather than assumed so the card can say
  // "Not scheduled" truthfully instead of promising a sweep that will not run.
  schedulerOn = false,
  onRequestSource,
}: {
  connectors?: Connector[];
  schedulerOn?: boolean;
  initialRows?: Source[];
  onRequestSource?: () => void;
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [sheet, setSheet] = useState("All");
  const [state, setState] = useState("All");
  const [rhythms, setRhythms] = useState<Record<string, Rhythm>>({});
  const [shown, setShown] = useState(50);
  // Closed on arrival: the Needs attention list above is what the tab is opened
  // for, and this answers a slower question.
  const [heatOpen, setHeatOpen] = useState(false);

  const { user } = useConsoleUser();
  const [rhythmError, setRhythmError] = useState<string | null>(null);

  const inCategory = useMemo(() => {
    if (category === "all") return initialRows;
    const def = CATEGORY_DEFINITIONS.find((d) => d.key === category);
    if (!def?.sourceCategory) return [];
    return initialRows.filter((s) => s.category === def.sourceCategory);
  }, [category, initialRows]);

  const rows = useMemo(
    () =>
      inCategory.filter(
        (s) =>
          (sheet === "All" || s.sheet === sheet) &&
          (state === "All" || s.state === state) &&
          (q === "" ||
            s.name.toLowerCase().includes(q.toLowerCase()) ||
            s.url.toLowerCase().includes(q.toLowerCase())),
      ).sort((a, b) => +new Date(a.lastNewItemAt) - +new Date(b.lastNewItemAt)),
    [q, sheet, state, inCategory],
  );

  const sheets = useMemo(
    () => ["All", ...new Set(initialRows.map((s) => s.sheet))],
    [initialRows],
  );
  const visible = rows.slice(0, shown);

  return (
    <div>
      {/* The alarm first, unfiltered: it is what the tab is opened for. */}
      <NeedsAttention sources={initialRows} />

      <div className="mt-4">
        <SourcesDashboard
          sources={initialRows}
          connectors={connectors}
          schedulerOn={schedulerOn}
          value={category}
          onChange={setCategory}
        />
      </div>

      <button
        onClick={() => setHeatOpen(!heatOpen)}
        aria-expanded={heatOpen}
        className="mt-4 flex items-center gap-2 text-xs text-cpx-grey-500"
      >
        <IconChevronDown className={heatOpen ? "rotate-180" : ""} />
        30 days by category
      </button>
      {/* Every source, never the filtered rows: the colour is a share of a
          category's sources, so a filtered denominator would make it lie. */}
      {heatOpen && <CategoryDays sources={initialRows} />}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={setQ} className="w-72" />
        <select
          value={sheet}
          onChange={(e) => setSheet(e.target.value)}
          aria-label="Sheet"
          className="h-8 border border-cpx-grey-100 bg-white px-2 text-sm focus:outline-none"
        >
          {sheets.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          aria-label="State"
          className="h-8 border border-cpx-grey-100 bg-white px-2 text-sm focus:outline-none"
        >
          {STATE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === "All" ? "All" : STATE_META[s as Source["state"]].label}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        {onRequestSource && (
          <button
            onClick={onRequestSource}
            className={buttonClass("secondary", "sm")}
          >
            Request a source
          </button>
        )}
        {rhythmError && (
          <span className="text-xs text-status-warn-ink">Not saved: {rhythmError}</span>
        )}
        <ListMeta
          shown={visible.length}
          total={rows.length}
          sort="Quietest first"
          onExport={() =>
            downloadCsv(
              "sources.csv",
              ["Source", "Host", "Sheet", "Class", "Rhythm", "Last item", "State"],
              rows.map((s) => [
                s.name,
                redactUrlForExport(s.url),
                s.sheet,
                s.collectorClass,
                rhythms[s.id] ?? s.expectedRhythm,
                s.lastNewItemAt,
                s.state,
              ]),
            )
          }
        />
      </div>

      <div className="mt-3 overflow-x-auto xl:overflow-x-visible">
      <table className={`${T_TABLE} min-w-[56rem] bg-white text-sm`}>
        <colgroup>
          <col className="w-[22rem]" />
          <col />
          <col className="w-40" />
          <col className="w-36" />
          <col className="w-32" />
          <col className="w-36" />
        </colgroup>
        <thead>
          <tr className={T_HEAD}>
            {["Source", "Sheet", "Class", "Rhythm", "Last item", "State"].map((h) => (
              <th
                key={h}
                scope="col"
                className={`${T_TH} xl:sticky xl:top-0 xl:z-10`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-8 text-center">
                <span className="font-medium">0 sources</span> matched
              </td>
            </tr>
          )}
          {visible.map((s) => (
            <tr key={s.id} className={T_ROW}>
              <td className={T_TD}>
                <Link
                  href={`/collection/sources/${s.id}`}
                  className="text-link underline underline-offset-2"
                >
                  {s.name}
                </Link>
                <span className="mt-0.5 block">
                  <InertUrl url={s.url} />
                </span>
              </td>
              <td className={`${T_TD}`}>{s.sheet}</td>
              <td className={`${T_TD}`}>{s.collectorClass}</td>
              <td className={T_TD}>
                <select
                  value={rhythms[s.id] ?? s.expectedRhythm}
                  onChange={(e) => {
                    const v = e.target.value as Rhythm;
                    const previous = rhythms[s.id] ?? s.expectedRhythm;
                    setRhythms((r) => ({ ...r, [s.id]: v }));
                    setRhythmError(null);
                    // Rhythm tells the alarm what normal looks like, so a write
                    // that failed must roll back rather than look saved.
                    patchSource(user.id, s.id, { expectedRhythm: v }).catch((err: Error) => {
                      setRhythms((r) => ({ ...r, [s.id]: previous }));
                      setRhythmError(err.message);
                    });
                  }}
                  aria-label="Expected rhythm"
                  className="h-7 border border-cpx-grey-100 bg-white px-1 text-xs focus:outline-none"
                >
                  {RHYTHMS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </td>
              <td className={`${T_TD} whitespace-nowrap`}>
                {s.itemsLast30d === 0 && !s.enabled
                  ? "-"
                  : agoFromNow(s.lastNewItemAt)}
              </td>
              <td className={T_TD}>
                <StatusPill {...STATE_META[s.state]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {rows.length > shown && (
        <button
          onClick={() => setShown(shown + 50)}
          className={buttonClass("secondary", "sm", "mt-3")}
        >
          Show more
        </button>
      )}
    </div>
  );
}

