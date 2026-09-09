"use client";

// The source-management dashboard: one summary across everything, a horizontal
// category filter, then one expandable workflow card per category.
//
// It scales by not knowing about any particular category. The chips and the
// cards are both rendered from CATEGORY_DEFINITIONS, so a new category is a
// registry entry and this file does not change.

import { useMemo, useState } from "react";
import type { Connector, Source } from "@/lib/types";
import { needsAttention } from "@/lib/collection-health";
import { FilterChip } from "@/components/ui";
import {
  CATEGORY_DEFINITIONS,
  statusFor,
  unitsFor,
  type CategoryKey,
} from "@/lib/collection-workflows";
import { agoFromNow, gstDateTime } from "@/lib/format";
import { WorkflowCard } from "./WorkflowCard";

export type CategoryFilter = "all" | CategoryKey;

export function SourcesDashboard({
  sources,
  connectors,
  schedulerOn,
  value,
  onChange,
}: {
  sources: Source[];
  connectors: Connector[];
  schedulerOn: boolean;
  value: CategoryFilter;
  onChange: (v: CategoryFilter) => void;
}) {
  const [openKeys, setOpenKeys] = useState<Set<CategoryKey>>(new Set());

  const rows = useMemo(
    () =>
      CATEGORY_DEFINITIONS.map((definition) => {
        const units = unitsFor(definition, sources, connectors);
        return { definition, status: statusFor(definition, units) };
      }),
    [sources, connectors],
  );

  const shown = value === "all" ? rows : rows.filter((r) => r.definition.key === value);

  const toggle = (key: CategoryKey) =>
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div>
      <Summary rows={rows} sources={sources} />

      <div className="mt-5 flex flex-wrap gap-1.5">
        <FilterChip
          label="All sources"
          count={rows.reduce((n, r) => n + r.status.units, 0)}
          active={value === "all"}
          onClick={() => onChange("all")}
        />
        {rows.map(({ definition, status }) => (
          <FilterChip
            key={definition.key}
            label={definition.label}
            count={status.units}
            active={value === definition.key}
            onClick={() => onChange(definition.key)}
          />
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {shown.map(({ definition }) => (
          <WorkflowCard
            key={definition.key}
            definition={definition}
            sources={sources}
            connectors={connectors}
            schedulerOn={schedulerOn}
            open={openKeys.has(definition.key) || value === definition.key}
            onToggle={() => toggle(definition.key)}
            onViewSources={() => onChange(definition.key)}
          />
        ))}
      </div>
    </div>
  );
}

type Row = { definition: (typeof CATEGORY_DEFINITIONS)[number]; status: ReturnType<typeof statusFor> };

function Summary({ rows, sources }: { rows: Row[]; sources: Source[] }) {
  const units = rows.reduce((n, r) => n + r.status.units, 0);
  const enabled = rows.reduce((n, r) => n + r.status.enabled, 0);
  const items = rows.reduce((n, r) => n + r.status.items, 0);
  // "With issues" counts units, not categories: an analyst chasing a problem
  // wants the number of things to fix. It counts exactly what the Needs
  // attention list above holds, so the two cannot disagree on one screen.
  const issues = needsAttention(sources).length;
  const latest = rows
    .map((r) => r.status.lastCollection)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);
  const emptyCategories = rows.filter((r) => r.status.units === 0).length;

  return (
    <div className="grid grid-cols-2 gap-px border border-cpx-grey-100 bg-cpx-grey-100 sm:grid-cols-3 lg:grid-cols-5">
      <Tile label="Total sources" value={units.toLocaleString("en-GB")} />
      <Tile
        label="Enabled"
        value={`${enabled.toLocaleString("en-GB")} of ${units.toLocaleString("en-GB")}`}
      />
      <Tile label="Items, last 30 days" value={items.toLocaleString("en-GB")} />
      <Tile label="Sources with issues" value={issues} warn={issues > 0} />
      <Tile
        label="Latest collection"
        value={latest ? agoFromNow(latest) : "never"}
        hint={
          latest
            ? gstDateTime(latest)
            : emptyCategories > 0
              ? `${emptyCategories} categories hold nothing yet`
              : undefined
        }
      />
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string | number;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div className="bg-white px-4 py-3">
      <span className="text-2xs text-cpx-grey-500">{label}</span>
      <span
        className={`mt-1 block text-xl font-display font-medium leading-none tracking-tightish ${
          warn ? "text-status-warn-ink" : ""
        }`}
      >
        {value}
      </span>
      {hint && <span className="mt-1.5 block text-2xs text-cpx-grey-500">{hint}</span>}
    </div>
  );
}

