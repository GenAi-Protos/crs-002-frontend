"use client";

// One expandable card per collection category.
//
// Collapsed it answers the operational question: is this area covered, is it
// current, and is anything wrong. Expanded it shows the pipeline that category
// actually runs - the stages differ per category because the pipelines differ,
// and they come from the registry rather than being hard-coded here.
//
// Every number on the card is derived from collection state already held on
// the sources and connectors. A category that has never collected says
// "Pending" rather than showing a success rate nothing produced.

import { useState } from "react";
import type { Connector, Source } from "@/lib/types";
import {
  RUN_STATE_LABEL,
  nextCollectionLabel,
  stageStates,
  statusFor,
  unitsFor,
  type CategoryDefinition,
  type RunState,
} from "@/lib/collection-workflows";
import { agoFromNow, gstDateTime } from "@/lib/format";
import { StatusPill, type StatusTone } from "@/components/ui";
import { IconChevronDown } from "@/components/icons";

const TONE: Record<RunState, StatusTone> = {
  pending: "idle",
  running: "idle",
  completed: "good",
  partial: "warn",
  failed: "critical",
  "awaiting-review": "warn",
};

export function WorkflowCard({
  definition,
  sources,
  connectors,
  schedulerOn,
  open,
  onToggle,
  onViewSources,
}: {
  definition: CategoryDefinition;
  sources: Source[];
  connectors: Connector[];
  schedulerOn: boolean;
  open: boolean;
  onToggle: () => void;
  onViewSources: () => void;
}) {
  const units = unitsFor(definition, sources, connectors);
  const status = statusFor(definition, units);
  const stages = stageStates(status, definition.stages);

  return (
    <section className="border border-black/10 bg-white">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-black/[0.02]"
      >
        <IconChevronDown className={`mt-1 shrink-0 ${open ? "rotate-180" : ""}`} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-medium tracking-tightish">
              {definition.label}
            </span>
            <StatusPill tone={TONE[status.state]} label={RUN_STATE_LABEL[status.state]} />
            <span className="bg-black/5 px-1.5 text-[11px] font-light">
              {definition.origin === "inventory"
                ? "Inventory"
                : definition.origin === "connector"
                  ? "Connector"
                  : "Analyst"}
            </span>
          </span>

          <span className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px] sm:grid-cols-3 lg:grid-cols-5">
            <Fact label="Sources" value={status.units} />
            <Fact label="Enabled" value={`${status.enabled} of ${status.units}`} />
            <Fact label="Items, 30 days" value={status.items.toLocaleString("en-GB")} />
            <Fact
              label="Last collection"
              value={status.lastCollection ? agoFromNow(status.lastCollection) : "never"}
              title={status.lastCollection ? gstDateTime(status.lastCollection) : undefined}
            />
            <Fact label="Next collection" value={nextCollectionLabel(schedulerOn)} />
          </span>

          {status.problem && (
            <span className="mt-2 block text-[12px] font-light text-status-warn-ink">
              {status.problem}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="border-t border-black/10 px-4 py-4">
          {definition.gap && (
            <p className="mb-4 border border-black/10 bg-black/[0.02] px-3 py-2 text-[12.5px] font-light">
              {definition.gap}
            </p>
          )}

          <ol className="space-y-0">
            {definition.stages.map((stage, i) => (
              <Stage
                key={stage.label}
                index={i + 1}
                label={stage.label}
                detail={stage.detail}
                state={stages[i]}
                last={i === definition.stages.length - 1}
              />
            ))}
          </ol>

          <Actions
            status={status}
            schedulerOn={schedulerOn}
            onViewSources={onViewSources}
          />
        </div>
      )}
    </section>
  );
}

function Fact({
  label,
  value,
  title,
}: {
  label: string;
  value: string | number;
  title?: string;
}) {
  return (
    <span className="flex flex-col" title={title}>
      <span className="font-light text-cpx-grey">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

function Stage({
  index,
  label,
  detail,
  state,
  last,
}: {
  index: number;
  label: string;
  detail: string;
  state: RunState;
  last: boolean;
}) {
  return (
    <li className="flex gap-3">
      {/* The rail: a marker per stage, joined by a line so the order reads as
          a sequence rather than a list of unrelated steps. */}
      <span className="flex flex-col items-center">
        <Marker state={state} />
        {!last && <span className="w-px flex-1 bg-black/10" />}
      </span>
      <span className={`min-w-0 flex-1 ${last ? "pb-0" : "pb-4"}`}>
        <span className="flex flex-wrap items-baseline gap-2">
          <span className="text-[13px] font-medium">
            {index}. {label}
          </span>
          <span
            className={`text-[11px] font-light ${
              state === "failed"
                ? "text-status-warn-ink"
                : state === "pending"
                  ? "text-cpx-grey"
                  : "text-green-contrast"
            }`}
          >
            {RUN_STATE_LABEL[state]}
          </span>
        </span>
        <span className="mt-0.5 block text-[12px] font-light text-cpx-grey">{detail}</span>
      </span>
    </li>
  );
}

function Marker({ state }: { state: RunState }) {
  const cls =
    state === "completed"
      ? "bg-cpx-green ring-cpx-purple"
      : state === "failed"
        ? "bg-cpx-red ring-cpx-red"
        : state === "partial" || state === "awaiting-review"
          ? "bg-status-warn-fill ring-status-warn-ink"
          : "bg-white ring-black/20";
  return <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-1 ${cls}`} />;
}

// Actions are enabled only where something is genuinely wired. A control that
// looks live and does nothing is worse than one that says why it is not.
function Actions({
  status,
  schedulerOn,
  onViewSources,
}: {
  status: ReturnType<typeof statusFor>;
  schedulerOn: boolean;
  onViewSources: () => void;
}) {
  const nothingToRun = status.enabled === 0;
  return (
    <div className="mt-5 border-t border-black/10 pt-4">
      <div className="flex flex-wrap gap-2">
        <Action label="Start collection" disabled={nothingToRun} primary />
        <Action label="Stop collection" disabled={status.state !== "running"} />
        <Action label="Schedule collection" disabled={!schedulerOn} />
        <Action label="View sources" onClick={onViewSources} />
        <Action label="View extracted intelligence" disabled={status.items === 0} />
        <Action label="View errors" disabled={status.failing + status.blocked === 0} />
        <Action label="Send to repository" disabled={status.state !== "awaiting-review"} />
      </div>
      <p className="mt-2 text-[11.5px] font-light text-cpx-grey">
        {/* The one thing that must never be misread on this screen. */}
        Collection runs on the server. No console action fetches a source URL.
      </p>
    </div>
  );
}

function Action({
  label,
  onClick,
  disabled,
  primary,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-8 px-3 text-[12.5px] ${
        primary
          ? "bg-cpx-green font-medium text-cpx-black hover:brightness-95 disabled:bg-black/10 disabled:text-black/40"
          : "border border-black/15 font-light hover:bg-black/5 disabled:border-black/10 disabled:text-black/30 disabled:hover:bg-transparent"
      }`}
    >
      {label}
    </button>
  );
}
