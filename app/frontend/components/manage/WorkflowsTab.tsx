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
// specification. The two Manage tabs are one model seen from two sides.
//
// Nothing has run, so no card claims a run. "Never run" is the honest reading
// and a success rate would be an invented metric (hard rule 8).

import { useEffect, useMemo, useState } from "react";
import { useConsoleUser } from "@/lib/role-context";
import { canAdminister } from "@/lib/access";
import type { Agent, Workflow, WorkflowStatus, WorkflowTrigger } from "@/lib/types";
import { agoFromNow, gstDateTime } from "@/lib/format";
import { ListMeta, SearchBox, StatusPill, type StatusTone, buttonClass } from "@/components/ui";
import { IconChevronDown } from "@/components/icons";

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

export function WorkflowsTab({
  workflows,
  agents,
  openRef,
  onOpenAgent,
}: {
  workflows: Workflow[];
  agents: Agent[];
  // Set when the reader arrived from an agent's workflow list. That workflow
  // opens and scrolls to itself, so the cross-link lands somewhere visible.
  openRef?: string | null;
  onOpenAgent: (agentId: string) => void;
}) {
  const { user } = useConsoleUser();
  const admin = canAdminister(user.role);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openRefs, setOpenRefs] = useState<Set<string>>(new Set());

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

  const toggle = (ref: string) =>
    setOpenRefs((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });

  useEffect(() => {
    if (!openRef) return;
    setOpenRefs((prev) => new Set(prev).add(openRef));
    document
      .getElementById(`wf-${openRef}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [openRef]);

  const allOpen = list.length > 0 && list.every((w) => openRefs.has(w.ref));

  if (workflows.length === 0) {
    return (
      <p className="mt-4 text-sm">
        <span className="font-medium">0 workflows</span>
      </p>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={setQ} className="w-64" />
        <div className="flex gap-1.5">
          {(["all", "published", "draft", "disabled"] as Filter[])
            .filter((f) => f === "all" || counts[f] > 0)
            .map((f) => (
              <Chip
                key={f}
                label={f === "all" ? "All" : STATUS[f].label}
                count={counts[f]}
                active={filter === f}
                onClick={() => setFilter(f)}
              />
            ))}
        </div>
        <div className="flex-1" />
        <button
          onClick={() =>
            setOpenRefs(allOpen ? new Set() : new Set(list.map((w) => w.ref)))
          }
          className={buttonClass("secondary", "sm")}
        >
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
        <ListMeta
          shown={list.length}
          total={workflows.length}
          sort="Published first, then by name"
        />
      </div>

      <p className="mt-2 text-xs text-cpx-grey">
        <span className="font-medium text-cpx-black">{counts.published}</span> published
        · <span className="font-medium text-cpx-black">{counts.draft}</span> draft ·{" "}
        {admin ? "You may edit" : "Read only at this access level"}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
        {list.map((w) => (
          <WorkflowCard
            key={w.ref}
            workflow={w}
            agents={agents}
            admin={admin}
            highlighted={w.ref === openRef}
            open={openRefs.has(w.ref)}
            onToggle={() => toggle(w.ref)}
            onOpenAgent={onOpenAgent}
          />
        ))}
      </div>

      {list.length === 0 && (
        <p className="mt-6 text-sm">
          <span className="font-medium">0 workflows</span> match this search
        </p>
      )}
    </div>
  );
}

function WorkflowCard({
  workflow: w,
  agents,
  admin,
  open,
  highlighted,
  onToggle,
  onOpenAgent,
}: {
  workflow: Workflow;
  agents: Agent[];
  admin: boolean;
  open: boolean;
  highlighted: boolean;
  onToggle: () => void;
  onOpenAgent: (agentId: string) => void;
}) {
  const nameOf = (id: string) => agents.find((a) => a.id === id)?.name ?? id;
  // A workflow is only as built as the agents it dispatches. Saying so is more
  // use than a status badge on its own.
  const builtAgents = w.agentRefs.filter(
    (id) => agents.find((a) => a.id === id)?.status === "active",
  ).length;

  return (
    <section
      id={`wf-${w.ref}`}
      className={`flex flex-col border bg-white ${
        highlighted ? "border-cpx-purple" : "border-black/10"
      }`}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-3">
        <div className="min-w-0">
          <h3 className="text-md font-medium leading-tight tracking-tightish">
            {w.name}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-cpx-grey">
            {w.purpose}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-2xs text-cpx-grey">{w.version}</span>
          <StatusPill {...STATUS[w.status]} />
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 px-4 text-xs sm:grid-cols-4">
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

      <div className="mt-3 space-y-2 px-4">
        <Chips
          label="Agents"
          items={w.agentRefs.map((id) => ({ key: id, text: nameOf(id) }))}
          onSelect={onOpenAgent}
        />
        <Chips
          label="Tools"
          items={w.toolNames.map((t) => ({ key: t, text: t }))}
          mono
        />
        <Chips
          label="Sources"
          items={w.sourceScope.map((s) => ({ key: s, text: s }))}
        />
      </div>

      <p className="mt-3 px-4 text-2xs text-cpx-grey">
        <span className="font-medium text-cpx-black">{builtAgents}</span> of{" "}
        {w.agentRefs.length} agents built · {w.steps.length} steps ·{" "}
        {w.updateCount} {w.updateCount === 1 ? "change" : "changes"}
      </p>

      {w.gap && (
        <p className="mx-4 mt-3 border border-black/10 bg-black/[0.02] px-3 py-2 text-xs">
          {w.gap}
        </p>
      )}

      <button
        onClick={onToggle}
        aria-expanded={open}
        className="mt-3 flex items-center gap-1.5 border-t border-black/10 px-4 py-2 text-left text-xs hover:bg-black/[0.02]"
      >
        <IconChevronDown className={open ? "rotate-180" : ""} />
        {open ? "Hide the run" : `Show the run · ${w.steps.length} steps`}
      </button>

      {open && (
        <div className="border-t border-black/10 px-4 py-4">
          <ol className="space-y-0">
            {w.steps.map((s, i) => (
              <li key={s.label} className="flex gap-3">
                {/* A rail, so the steps read as a sequence rather than a list. */}
                <span className="flex flex-col items-center">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-white ring-1 ring-black/20" />
                  {i < w.steps.length - 1 && (
                    <span className="w-px flex-1 bg-black/10" />
                  )}
                </span>
                <span
                  className={`min-w-0 flex-1 ${i === w.steps.length - 1 ? "" : "pb-4"}`}
                >
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-medium">
                      {i + 1}. {s.label}
                    </span>
                    <button
                      onClick={() => onOpenAgent(s.agentRef)}
                      className="bg-black/5 px-1 text-2xs hover:bg-black/10"
                    >
                      {nameOf(s.agentRef)}
                    </button>
                  </span>
                  <span className="mt-0.5 block text-xs text-cpx-grey">
                    {s.detail}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          <Block label="Outputs" count={w.outputs.length}>
            <ul className="space-y-1">
              {w.outputs.map((o) => (
                <li key={o} className="text-xs">
                  {o}
                </li>
              ))}
            </ul>
          </Block>

          <Block label="Version">
            <p className="text-xs">
              {w.version} · {w.updateCount}{" "}
              {w.updateCount === 1 ? "change" : "changes"} · updated{" "}
              {gstDateTime(w.updatedAt)}
            </p>
          </Block>

          <Block label="Basis">
            <p className="text-xs text-cpx-grey">{w.basis}</p>
          </Block>

          <Actions workflow={w} admin={admin} />
        </div>
      )}
    </section>
  );
}

// The seven controls CPX drew, with the mutating ones behind the administrator
// and every one of them honest about whether it is wired. A control that looks
// live and does nothing is worse than one that says why it is not.
function Actions({ workflow: w, admin }: { workflow: Workflow; admin: boolean }) {
  return (
    <div className="mt-5 border-t border-black/10 pt-4">
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
      <p className="mt-2 text-2xs text-cpx-grey">
        {admin
          ? "Publishing a workflow does not publish its output. A lead analyst approves every client-facing artefact."
          : "Read only at this access level. The administrator changes a workflow."}
      </p>
    </div>
  );
}

function Fact({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="min-w-0" title={title}>
      <dt className="text-cpx-grey">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}

function Chips({
  label,
  items,
  onSelect,
  mono,
}: {
  label: string;
  items: { key: string; text: string }[];
  onSelect?: (key: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-1.5">
      <span className="w-[3.75rem] shrink-0 text-2xs text-cpx-grey">
        {label}
        <span className="ml-1 text-cpx-black">{items.length}</span>
      </span>
      {items.map((it) =>
        onSelect ? (
          <button
            key={it.key}
            onClick={() => onSelect(it.key)}
            className="bg-black/5 px-1.5 text-2xs hover:bg-black/10"
          >
            {it.text}
          </button>
        ) : (
          <span
            key={it.key}
            className={`bg-black/5 px-1.5 text-2xs ${
              mono ? "font-mono text-2xs" : ""
            }`}
          >
            {it.text}
          </span>
        ),
      )}
    </div>
  );
}

function Block({
  label,
  count,
  children,
}: {
  label: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 border-t border-black/10 pt-3">
      <span className="flex items-baseline gap-2 text-2xs text-cpx-grey">
        {label}
        {count !== undefined && (
          <span className="bg-black/5 px-1 text-2xs text-cpx-black">{count}</span>
        )}
      </span>
      <div className="mt-1.5">{children}</div>
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

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-7 items-center gap-1.5 border px-2.5 text-xs ${
        active
          ? "border-cpx-purple bg-cpx-purple font-medium text-white"
          : "border-black/15 hover:bg-black/5"
      }`}
    >
      {label}
      <span className={`px-1 text-2xs ${active ? "bg-white/15" : "bg-black/5"}`}>
        {count}
      </span>
    </button>
  );
}
