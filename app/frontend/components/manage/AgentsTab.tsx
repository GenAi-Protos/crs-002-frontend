"use client";

// What an agent is made of. CPX asked for this on 2 September (Praveen Singh,
// 13:45): purpose, instruction, skills, tools, scripts, sources, workflows,
// permissions, instruction version and update count.
//
// Two rules govern the screen. Everyone who reaches Manage reads it; the
// administrator alone edits (15:17), and the edit control is absent rather than
// disabled for everyone else. And an agent the BRD specifies but we have not
// built says so, because an empty success rate reads as a broken agent rather
// than an unbuilt one.

import { useMemo, useState } from "react";
import { useConsoleUser } from "@/lib/role-context";
import { canAdminister } from "@/lib/access";
import type { Agent, Workflow } from "@/lib/types";
import { agoFromNow, gstDateTime } from "@/lib/format";
import { DetailRow, ListMeta, SearchBox, StatusPill, type StatusTone, buttonClass } from "@/components/ui";
import { IconEgress } from "@/components/icons";
import { CATEGORY_DEFINITIONS } from "@/lib/collection-workflows";

// An agent's source scope is a collection category, never a source URL
// (FR-SAF-01). Resolve it to the label the Collection screen uses, so the two
// destinations name the same thing the same way.
function sourceLabel(ref: string): string {
  if (ref === "held-corpus") return "Held repository";
  return CATEGORY_DEFINITIONS.find((c) => c.key === ref)?.label ?? ref;
}

const STATUS: Record<Agent["status"], { tone: StatusTone; label: string }> = {
  active: { tone: "good", label: "Active" },
  idle: { tone: "idle", label: "Idle" },
  disabled: { tone: "warn", label: "Disabled" },
  specified: { tone: "idle", label: "Specified, not built" },
};

export function AgentsTab({
  agents,
  workflows,
  selectedId,
  onSelect,
  onOpenWorkflow,
}: {
  agents: Agent[];
  workflows: Workflow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenWorkflow: (ref: string) => void;
}) {
  const { user } = useConsoleUser();
  const [q, setQ] = useState("");
  const admin = canAdminister(user.role);

  const list = useMemo(
    () =>
      agents
        .filter(
          (a) =>
            q === "" ||
            a.name.toLowerCase().includes(q.toLowerCase()) ||
            a.purpose.toLowerCase().includes(q.toLowerCase()),
        )
        // Supervisor first, then specialists by name: the roster reads as the
        // shape of the system, not as an alphabetical list.
        .sort((a, b) =>
          a.kind === b.kind
            ? a.name.localeCompare(b.name)
            : a.kind === "supervisor"
              ? -1
              : 1,
        ),
    [agents, q],
  );

  // A cross-link from the workflow library must always land, even on an agent
  // the current search would hide.
  const agent =
    list.find((a) => a.id === selectedId) ??
    agents.find((a) => a.id === selectedId) ??
    list[0];
  const built = agents.filter((a) => a.status === "active").length;

  if (agents.length === 0) {
    return (
      <p className="mt-4 text-sm">
        <span className="font-medium">0 agents</span>
      </p>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3">
        <SearchBox value={q} onChange={setQ} className="w-64" />
        <div className="flex-1" />
        <ListMeta
          shown={list.length}
          total={agents.length}
          sort="Supervisor first, then by name"
        />
      </div>

      <p className="mt-2 text-xs text-cpx-grey-500">
        <span className="font-medium text-cpx-black">{built}</span> of{" "}
        <span className="font-medium text-cpx-black">{agents.length}</span> built ·{" "}
        {admin ? "You may edit" : "Read only at this access level"}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[18rem_1fr]">
        <ul className="border border-cpx-grey-100 bg-white">
          {list.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => onSelect(a.id)}
                className={`block w-full border-l-2 px-3 py-2.5 text-left transition-colors duration-150 ${
                  a.id === agent.id
                    ? "border-cpx-green bg-cpx-green-50/40"
                    : "border-transparent hover:bg-cpx-grey-50"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm font-medium">{a.name}</span>
                  {a.kind === "supervisor" && (
                    <span className="bg-cpx-grey-50 px-1 text-2xs">
                      Supervisor
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-2xs text-cpx-grey-500">
                  {STATUS[a.status].label}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <AgentDetail
          agent={agent}
          admin={admin}
          roster={agents}
          workflows={workflows}
          onOpenWorkflow={onOpenWorkflow}
        />
      </div>
    </div>
  );
}

function AgentDetail({
  agent,
  admin,
  roster,
  workflows,
  onOpenWorkflow,
}: {
  agent: Agent;
  admin: boolean;
  roster: Agent[];
  workflows: Workflow[];
  onOpenWorkflow: (ref: string) => void;
}) {
  const nameOf = (id: string) => roster.find((a) => a.id === id)?.name ?? id;
  const workflowName = (ref: string) =>
    workflows.find((w) => w.ref === ref)?.name ?? ref;
  const egressTools = agent.tools.filter((t) => t.egress);

  return (
    <section className="min-w-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tightish">{agent.name}</h2>
          <p className="mt-1 text-sm leading-relaxed">{agent.purpose}</p>
        </div>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="flex items-center gap-2">
            <StatusPill {...STATUS[agent.status]} />
            {admin && (
              <button className={buttonClass()}>
                Edit
              </button>
            )}
          </span>
          {/* A held field, read the same way the workflow library reads it:
              "Never run" is the honest reading, not an absent line. */}
          <span
            className="text-2xs text-cpx-grey-500"
            title={agent.lastRunAt ? gstDateTime(agent.lastRunAt) : undefined}
          >
            {agent.lastRunAt ? `Last run ${agoFromNow(agent.lastRunAt)}` : "Never run"}
          </span>
        </span>
      </div>

      {agent.status === "specified" && (
        <p className="mt-3 border border-cpx-grey-100 bg-cpx-grey-50 px-3 py-2 text-xs">
          Specified in the BRD and not built yet. What follows is the
          specification, not a running configuration, and nothing has run, so
          there is no success rate to show.
        </p>
      )}

      <DetailRow label="Instruction">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {agent.instruction.text}
        </p>
        <p className="mt-2 text-2xs text-cpx-grey-500">
          Version {agent.instruction.version} · {agent.updateCount}{" "}
          {agent.updateCount === 1 ? "change" : "changes"} · {agent.instruction.updatedBy}{" "}
          · {gstDateTime(agent.instruction.updatedAt)}
        </p>
      </DetailRow>

      <DetailRow label="Skills" count={agent.skills.length}>
        {agent.skills.length === 0 ? (
          <Zero what="skills" />
        ) : (
          <ul className="space-y-2">
            {agent.skills.map((s) => (
              <li key={s.name}>
                <span className="text-sm font-medium">{s.name}</span>
                <span className="mt-0.5 block text-xs text-cpx-grey-500">
                  {s.description}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DetailRow>

      <DetailRow label="Tools" count={agent.tools.length}>
        {agent.tools.length === 0 ? (
          <Zero what="tools" />
        ) : (
          <>
            <ul className="space-y-1.5">
              {agent.tools.map((t) => (
                <li key={t.name} className="flex items-baseline gap-2">
                  <span className="font-mono text-xs">{t.name}</span>
                  {/* The one thing an analyst must be able to see at a glance:
                      which tool leaves the region. NFR-SEC-04 and NFR-SEC-06. */}
                  {t.egress && (
                    <span className="inline-flex items-center gap-1 bg-status-warn-fill px-1 text-2xs text-status-warn-ink">
                      <IconEgress />
                      Leaves region
                    </span>
                  )}
                  <span className="text-xs text-cpx-grey-500">
                    {t.purpose}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-2xs text-cpx-grey-500">
              <span className="font-medium text-cpx-black">{egressTools.length}</span>{" "}
              of {agent.tools.length} leave the UAE region
            </p>
          </>
        )}
      </DetailRow>

      {agent.dispatches.length > 0 && (
        <DetailRow label="Dispatches" count={agent.dispatches.length}>
          <p className="text-sm">
            {agent.dispatches.map(nameOf).join(", ")}
          </p>
        </DetailRow>
      )}

      <DetailRow label="Sources" count={agent.sourceRefs.length}>
        {agent.sourceRefs.length === 0 ? (
          <Zero what="sources" />
        ) : (
          <p className="text-sm">
            {agent.sourceRefs.map(sourceLabel).join(", ")}
          </p>
        )}
      </DetailRow>

      <DetailRow label="Workflows" count={agent.workflowRefs.length}>
        {agent.workflowRefs.length === 0 ? (
          <Zero what="workflows" />
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {agent.workflowRefs.map((ref) => (
              <button
                key={ref}
                onClick={() => onOpenWorkflow(ref)}
                className="bg-cpx-grey-50 px-1.5 text-xs hover:bg-cpx-grey-100"
              >
                {workflowName(ref)}
              </button>
            ))}
          </div>
        )}
      </DetailRow>

      <DetailRow label="Permissions" count={agent.permissions.length}>
        <ul className="space-y-1">
          {agent.permissions.map((p) => (
            <li key={p} className="text-sm">
              {p}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-2xs text-cpx-grey-500">
          No agent may release a client-facing artefact. A lead analyst approves.
        </p>
      </DetailRow>

      <DetailRow label="Basis">
        <p className="text-xs text-cpx-grey-500">{agent.basis}</p>
      </DetailRow>
    </section>
  );
}


// Counts render including zero, and a zero says what it is a zero of.
function Zero({ what }: { what: string }) {
  return (
    <p className="text-sm">
      <span className="font-medium">0 {what}</span>
    </p>
  );
}
