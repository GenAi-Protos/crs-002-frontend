"use client";

// The 185-row table plus the health heatmap. `Last item` is lastNewItemAt,
// not lastSuccess: a 200-with-no-items source looks healthy on every other field.

import { useMemo, useState } from "react";
import Link from "next/link";
import { SOURCES } from "@/lib/fixtures";
import { patchSource } from "@/lib/api";
import { SourcesDashboard, type CategoryFilter } from "./SourcesDashboard";
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

const RHYTHMS: Rhythm[] = ["continuous", "hourly", "daily", "weekly"];
const CLASS_ORDER = ["feed", "bulk", "scrape", "social", "portal"] as const;

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
  const [heatOpen, setHeatOpen] = useState(true);

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

  const sheets = ["All", ...new Set(initialRows.map((s) => s.sheet))];
  const states = ["All", ...Object.keys(STATE_META)];
  const visible = rows.slice(0, shown);

  return (
    <div>
      <SourcesDashboard
        sources={initialRows}
        connectors={connectors}
        schedulerOn={schedulerOn}
        value={category}
        onChange={setCategory}
      />

      <button
        onClick={() => setHeatOpen(!heatOpen)}
        className="mt-4 flex items-center gap-2 text-xs text-cpx-grey"
      >
        <IconChevronDown className={heatOpen ? "rotate-180" : ""} />
        30 days by class
      </button>
      {heatOpen && <Heatmap sources={rows} />}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={setQ} className="w-72" />
        <select
          value={sheet}
          onChange={(e) => setSheet(e.target.value)}
          aria-label="Sheet"
          className="h-8 border border-black/15 bg-white px-2 text-sm focus:outline-none"
        >
          {sheets.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          aria-label="State"
          className="h-8 border border-black/15 bg-white px-2 text-sm focus:outline-none"
        >
          {states.map((s) => (
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
                className={`${T_TH} xl:sticky xl:top-14 xl:z-10`}
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
                  className="h-7 border border-black/10 bg-white px-1 text-xs focus:outline-none"
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

// A silent failure appears as a horizontal grey stripe with a start date.
// 45 degree hatch marks attempted-with-zero-items.
function Heatmap({ sources }: { sources: Source[] }) {
  const [openClasses, setOpenClasses] = useState<Set<string>>(
    new Set(CLASS_ORDER),
  );
  const groups = CLASS_ORDER.map((cls) => ({
    cls,
    rows: sources.filter((s) => s.collectorClass === cls),
  })).filter((g) => g.rows.length > 0);

  const cellColour = (attempted: number, items: number) => {
    // The sequential ramp from globals.css, so a palette change reaches the heatmap.
    if (attempted === 0) return "var(--color-inset)";
    if (items === 0) return "hatch";
    if (items <= 2) return "var(--color-seq-2)";
    if (items <= 8) return "var(--color-seq-3)";
    if (items <= 30) return "var(--color-seq-4)";
    if (items <= 90) return "var(--color-seq-5)";
    if (items <= 200) return "var(--color-seq-6)";
    return "var(--color-seq-7)";
  };

  return (
    <div className="mt-2 border border-black/10 bg-white p-4">
      <div className="flex items-center gap-4 text-2xs text-cpx-grey">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 bg-seq-4" /> items held
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3"
            style={{
              background:
                "repeating-linear-gradient(45deg,var(--color-rule) 0,var(--color-rule) 2px,white 2px,white 4px)",
            }}
          />
          attempted, zero items
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 bg-inset" /> no attempt
        </span>
      </div>
      <div className="mt-3 space-y-2 xl:columns-2 xl:gap-10 xl:space-y-0">
        {groups.map((g) => {
          const open = openClasses.has(g.cls);
          return (
            <div key={g.cls} className="xl:mb-2">
              <button
                onClick={() => {
                  const next = new Set(openClasses);
                  if (open) next.delete(g.cls);
                  else next.add(g.cls);
                  setOpenClasses(next);
                }}
                className="flex items-center gap-1.5 text-xs font-medium"
              >
                <IconChevronDown className={open ? "rotate-180" : ""} />
                {g.cls}
                <span className="bg-black/5 px-1 text-2xs">
                  {g.rows.length}
                </span>
              </button>
              {open && (
                <div className="mt-1">
                  {g.rows.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 py-px"
                      style={{ breakInside: "avoid" }}
                    >
                      <span
                        className="w-44 shrink-0 truncate text-2xs text-cpx-grey"
                        title={s.name}
                      >
                        {s.name}
                      </span>
                      <div className="flex gap-[2px]">
                        {s.dailyItems.map((d) => {
                          const c = cellColour(d.attempted, d.items);
                          return (
                            <span
                              key={d.date}
                              title={`${d.date}: ${d.items} items, ${d.attempted} attempts`}
                              className="inline-block h-3 w-3"
                              style={
                                c === "hatch"
                                  ? {
                                      background:
                                        "repeating-linear-gradient(45deg,var(--color-rule) 0,var(--color-rule) 2px,white 2px,white 4px)",
                                    }
                                  : { background: c }
                              }
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
