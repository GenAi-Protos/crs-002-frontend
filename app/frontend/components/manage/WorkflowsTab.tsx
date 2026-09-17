"use client";

// The workflow library. CPX asked for it on 2 September (Praveen Singh, 29:21
// to 31:45) and it is FR-WFL-01: what runs, which agents it dispatches, which
// tools and sources it touches, who approves, and which version is current.
//
// Three things this does that a static catalogue does not.
//
// Each workflow carries its own agents, tools and sources, because they differ.
// A library where every card lists the same agents is a picture of a library,
// not one.
//
// Each step names the agent that carries it, and the name crosses to the agent
// specification. The two Manage tabs are one model seen from two sides, and
// since they are, they are laid out the same way: a list on the left and one
// specification on the right. As a grid of cards this held nineteen chips on a
// single face, three wrapping groups deep, and buried the only fact that says
// whether a workflow can run at all.
//
// Nothing has run, so no card claims a run. "Never run" is the honest reading
// and a success rate would be an invented metric (hard rule 8).

import { useEffect, useMemo, useState } from "react";
import { useConsoleUser } from "@/lib/role-context";
import { canAdminister } from "@/lib/access";
import type { Agent, Workflow, WorkflowStatus, WorkflowTrigger } from "@/lib/types";
import { agoFromNow, gstDateTime } from "@/lib/format";
import {
  DetailRow,
  Fact,
  FilterChip,
  ListMeta,
  SearchBox,
  StatusPill,
  StepRail,
  type StatusTone,
  buttonClass,
} from "@/components/ui";

const STATUS: Record<WorkflowStatus, { tone: StatusTone; label: string }> = {
  published: { tone: "good", label: "Published" },
  draft: { tone: "idle", label: "Draft" },
  disabled: { tone: "warn", label: "Disabled" },
};

const TRIGGER: Record<WorkflowTrigger, string> = {
  "analyst-request": "Analyst request",
  scheduled: "Scheduled",
  "on-collection": "On collection",
  "on-approval": "On approval",
};

type Filter = "all" | WorkflowStatus;

/** How much of a workflow actually exists. The one fact that decides if it runs. */
function readiness(w: Workflow, agents: Agent[]) {
  const built = w.agentRefs.filter(
    (id) => agents.find((a) => a.id === id)?.status === "active",
  ).length;
  return { built, total: w.agentRefs.length };
}

export function WorkflowsTab({
  workflows,
  agents,
  openRef,
  onOpenAgent,
}: {
  workflows: Workflow[];
  agents: Agent[];
  // Set when the reader arrived from an agent's workflow list. That workflow
  // is selected, so the cross-link lands on the thing it named.
  openRef?: string | null;
  onOpenAgent: (agentId: string) => void;
}) {
  const { user } = useConsoleUser();
  const admin = canAdminister(user.role);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedRef, setSelectedRef] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      all: workflows.length,
      published: workflows.filter((w) => w.status === "published").length,
      draft: workflows.filter((w) => w.status === "draft").length,
      disabled: workflows.filter((w) => w.status === "disabled").length,
    }),
    [workflows],
  );

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return workflows
      .filter((w) => filter === "all" || w.status === filter)
      .filter(
        (w) =>
          needle === "" ||
          w.name.toLowerCase().includes(needle) ||
          w.purpose.toLowerCase().includes(needle) ||
          w.sourceScope.some((s) => s.toLowerCase().includes(needle)) ||
          w.toolNames.some((t) => t.toLowerCase().includes(needle)),
      )
      // Published first, then by name: what runs today reads before what might.
      .sort((a, b) =>
        a.status === b.status
          ? a.name.localeCompare(b.name)
          : a.status === "published"
            ? -1
            : b.status === "published"
              ? 1
              : a.name.localeCompare(b.name),
      );
  }, [workflows, q, filter]);

  useEffect(() => {
    if (openRef) setSelectedRef(openRef);
  }, [openRef]);

  if (workflows.length === 0) {
    return (
      <p className="mt-4 text-sm">
        <span className="font-medium">0 workflows</span>
      </p>
    );
  }

  // A cross-link from an agent must land even on a workflow this search hides.
  const workflow =
    list.find((w) => w.ref === selectedRef) ??
    workflows.find((w) => w.ref === selectedRef) ??
    list[0];

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={setQ} className="w-64" />
        <div className="flex gap-1.5">
          {(["all", "published", "draft", "disabled"] as Filter[])
            .filter((f) => f === "all" || counts[f] > 0)
            .map((f) => (
              <FilterChip
                key={f}
                label={f === "all" ? "All" : STATUS[f].label}
                count={counts[f]}
                active={filter === f}
                onClick={() => setFilter(f)}
              />
            ))}
        </div>
        <div className="flex-1" />
        <ListMeta
          shown={list.length}
          total={workflows.length}
          sort="Published first, then by name"
        />
      </div>

      <p className="mt-2 text-xs text-cpx-grey-500">
        <span className="font-medium text-cpx-black">{counts.published}</span> published
        · <span className="font-medium text-cpx-black">{counts.draft}</span> draft ·{" "}
        {admin ? "You may edit" : "Read only at this access level"}
      </p>

      {list.length === 0 ? (
        <p className="mt-6 text-sm">
          <span className="font-medium">0 workflows</span> match this search
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[18rem_1fr]">
          <ul className="border border-cpx-grey-100 bg-white">
            {list.map((w) => {
              const { built, total } = readiness(w, agents);
              return (
                <li key={w.ref}>
                  <button
                    onClick={() => setSelectedRef(w.ref)}
                    className={`block w-full border-l-2 px-3 py-2.5 text-left transition-colors duration-150 ${
                      w.ref === workflow.ref
                        ? "border-cpx-green bg-cpx-green-50/40"
                        : "border-transparent hover:bg-cpx-grey-50"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-medium">
                        {w.name}
                      </span>
                      <span className="shrink-0 font-mono text-2xs text-cpx-grey-500">
                        {w.version}
                      </span>
                    </span>
                    <span className="mt-1 block text-2xs text-cpx-grey-500">
                      {STATUS[w.status].label} · {built} of {total} agents built
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <WorkflowDetail
            workflow={workflow}
            agents={agents}
            admin={admin}
            onOpenAgent={onOpenAgent}
          />
        </div>
      )}
    </div>
  );
}

function WorkflowDetail({
  workflow: w,
  agents,
  admin,
  onOpenAgent,
}: {
  workflow: Workflow;
  agents: Agent[];
  admin: boolean;
  onOpenAgent: (agentId: string) => void;
}) {
  const nameOf = (id: string) => agents.find((a) => a.id === id)?.name ?? id;
  const { built, total } = readiness(w, agents);

  return (
    <section className="min-w-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tightish">{w.name}</h2>
          <p className="mt-1 text-sm leading-relaxed">{w.purpose}</p>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-2xs text-cpx-grey-500">{w.version}</span>
          <StatusPill {...STATUS[w.status]} />
        </span>
      </div>

      {/* Readiness leads, because a workflow that dispatches agents nobody has
          built cannot run, and that was buried in an 11px line before. */}
      <div className="mt-4 border border-cpx-grey-100 bg-white p-3">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-2xs font-medium uppercase tracking-wide text-cpx-grey-500">
            Readiness
          </span>
          <span className="text-xs">
            <span className="font-medium">{built}</span> of {total} agents built
          </span>
        </span>
        <span
          aria-hidden
          className="mt-2 flex h-1.5 w-full overflow-hidden bg-cpx-grey-100"
        >
          <span
            className={built === total ? "bg-cpx-green" : "bg-cpx-bright"}
            style={{ width: `${total === 0 ? 0 : (built / total) * 100}%` }}
          />
        </span>
        {/* The run count is a held field and it is zero: said, not hidden. */}
        <span className="mt-2 block text-2xs text-cpx-grey-500">
          {w.steps.length} steps · {w.runsLast30d}{" "}
          {w.runsLast30d === 1 ? "run" : "runs"} in 30 days · {w.updateCount}{" "}
          {w.updateCount === 1 ? "change" : "changes"} · updated{" "}
          {gstDateTime(w.updatedAt)}
        </span>
      </div>

      {w.gap && (
        <p className="mt-3 border border-cpx-grey-100 bg-cpx-grey-50 px-3 py-2 text-xs">
          {w.gap}
        </p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 text-xs sm:grid-cols-4">
        <Fact label="Trigger" value={TRIGGER[w.trigger]} title={w.triggerDetail} />
        <Fact
          label="Approval"
          value={w.approval === "none" ? "None" : "Lead analyst"}
        />
        <Fact label="Owner" value={w.owner} />
        <Fact
          label="Last run"
          value={w.lastRunAt ? agoFromNow(w.lastRunAt) : "Never run"}
          title={w.lastRunAt ? gstDateTime(w.lastRunAt) : undefined}
        />
      </dl>

      {/* Full width, so a chip group is a group rather than a ragged wrap
          around a 60px label gutter. */}
      <DetailRow label="Agents" count={w.agentRefs.length}>
        <div className="flex flex-wrap gap-1.5">
          {w.agentRefs.map((id) => (
            <button
              key={id}
              onClick={() => onOpenAgent(id)}
              className="bg-cpx-grey-50 px-1.5 text-2xs hover:bg-cpx-grey-100"
            >
              {nameOf(id)}
            </button>
          ))}
        </div>
      </DetailRow>

      <DetailRow label="Tools" count={w.toolNames.length}>
        <div className="flex flex-wrap gap-1.5">
          {w.toolNames.map((t) => (
            <span key={t} className="bg-cpx-grey-50 px-1.5 font-mono text-2xs">
              {t}
            </span>
          ))}
        </div>
      </DetailRow>

      <DetailRow label="Sources" count={w.sourceScope.length}>
        <div className="flex flex-wrap gap-1.5">
          {w.sourceScope.map((s) => (
            <span key={s} className="bg-cpx-grey-50 px-1.5 text-2xs">
              {s}
            </span>
          ))}
        </div>
      </DetailRow>

      <DetailRow label="The run" count={w.steps.length}>
        {/* The shared rail, every marker pending: this is the definition, and
            nothing has run. The same drawing carries state on the Collection
            cards and under an answer. */}
        <StepRail
          steps={w.steps.map((s) => ({
            key: s.label,
            title: s.label,
            detail: s.detail,
            state: "pending",
            aside: (
              <button
                onClick={() => onOpenAgent(s.agentRef)}
                className="bg-cpx-grey-50 px-1 text-2xs transition-colors duration-150 hover:bg-cpx-grey-100"
              >
                {nameOf(s.agentRef)}
              </button>
            ),
          }))}
        />
      </DetailRow>

      <DetailRow label="Outputs" count={w.outputs.length}>
        <ul className="space-y-1">
          {w.outputs.map((o) => (
            <li key={o} className="text-xs">
              {o}
            </li>
          ))}
        </ul>
      </DetailRow>

      <DetailRow label="Basis">
        <p className="text-xs text-cpx-grey-500">{w.basis}</p>
      </DetailRow>

      <Actions workflow={w} admin={admin} />
    </section>
  );
}

// The seven controls CPX drew, with the mutating ones behind the administrator
// and every one of them honest about whether it is wired. A control that looks
// live and does nothing is worse than one that says why it is not.
function Actions({ workflow: w, admin }: { workflow: Workflow; admin: boolean }) {
  return (
    <div className="mt-5 border-t border-cpx-grey-100 pt-4">
      <div className="flex flex-wrap gap-2">
        <Action label="Open" primary />
        {admin && (
          <>
            <Action label="Edit" />
            <Action label="Clone" />
            <Action label="Test" />
            <Action
              label={w.status === "published" ? "Disable" : "Publish"}
              disabled={w.status === "draft" && w.gap !== undefined}
            />
            <Action label="Roll back" disabled={w.updateCount === 0} />
          </>
        )}
      </div>
      <p className="mt-2 text-2xs text-cpx-grey-500">
        {admin
          ? "Publishing a workflow does not publish its output. A lead analyst approves every client-facing artefact."
          : "Read only at this access level. The administrator changes a workflow."}
      </p>
    </div>
  );
}

function Action({
  label,
  disabled,
  primary,
}: {
  label: string;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      className={buttonClass(primary ? "primary" : "secondary")}
    >
      {label}
    </button>
  );
}
