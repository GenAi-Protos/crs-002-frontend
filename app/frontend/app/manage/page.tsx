"use client";

// Manage: what the system is made of, and the settings that steer it.
// One destination with tabs, the way CPX grouped it on 2 September 2026.
//
// Agents and Workflows are one model seen from two sides, so the selection
// lives here: a step in a workflow crosses to the agent that carries it, and
// an agent's workflow list crosses back.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useConsoleUser } from "@/lib/role-context";
import { canSee } from "@/lib/access";
import { AGENTS, PIRS, WORKFLOWS } from "@/lib/fixtures";
import { getPirs } from "@/lib/api";
import type { Agent, Pir, Workflow } from "@/lib/types";
import { PageHeader, Tabs, OfflineNote } from "@/components/ui";
import { AgentsTab } from "@/components/manage/AgentsTab";
import { PirsTab } from "@/components/manage/PirsTab";
import { WorkflowsTab } from "@/components/manage/WorkflowsTab";

type TabKey = "agents" | "workflows" | "pirs" | "audit";

const TAB_KEYS: TabKey[] = ["agents", "workflows", "pirs", "audit"];

function ManageInner() {
  const { user } = useConsoleUser();
  const params = useSearchParams();
  const initial = (params.get("tab") as TabKey) ?? "agents";
  const [tab, setTab] = useState<TabKey>(
    TAB_KEYS.includes(initial) ? initial : "agents",
  );
  const [agents, setAgents] = useState<Agent[]>(AGENTS);
  const [workflows, setWorkflows] = useState<Workflow[]>(WORKFLOWS);
  const [pirs, setPirs] = useState<Pir[]>(PIRS);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [highlightWorkflow, setHighlightWorkflow] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // Both rosters come from the backend once /agents and /workflows exist.
    // Until then the fixture is the fallback, as it is on every other screen.
    setAgents(AGENTS);
    setWorkflows(WORKFLOWS);
    // PIRs are live already. The fixture stands in only when the backend is
    // down, the same fallback every other screen uses.
    getPirs(user.id)
      .then((rows) => setPirs(rows.length > 0 ? rows : PIRS))
      .catch(() => {
        setPirs(PIRS);
        setOffline(true);
      });
  }, [user.id]);

  if (!canSee(user.role, "manage")) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <p className="text-base">Not permitted at this access level.</p>
        <Link href="/" className="text-sm text-link underline underline-offset-2">
          Dashboard
        </Link>
      </div>
    );
  }

  const openAgent = (id: string) => {
    setSelectedAgentId(id);
    setTab("agents");
  };

  const openWorkflow = (ref: string) => {
    setHighlightWorkflow(ref);
    setTab("workflows");
  };

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-6">
      <PageHeader title="Manage" meta={offline ? <OfflineNote /> : undefined} />
      <Tabs<TabKey>
        tabs={[
          { key: "agents", label: "Agents", count: agents.length },
          { key: "workflows", label: "Workflows", count: workflows.length },
          { key: "pirs", label: "PIRs", count: pirs.length },
          { key: "audit", label: "Audit" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "agents" && (
        <AgentsTab
          agents={agents}
          workflows={workflows}
          selectedId={selectedAgentId}
          onSelect={setSelectedAgentId}
          onOpenWorkflow={openWorkflow}
        />
      )}
      {tab === "workflows" && (
        <WorkflowsTab
          workflows={workflows}
          agents={agents}
          openRef={highlightWorkflow}
          onOpenAgent={openAgent}
        />
      )}
      {tab === "pirs" && (
        <PirsTab
          pirs={pirs}
          onChange={setPirs}
          initialQuery={params.get("q") ?? ""}
        />
      )}
      {tab === "audit" && <NotBuiltYet tab="audit" />}
    </div>
  );
}

// An empty tab says what it will hold and what it is waiting on, rather than
// rendering a blank panel that reads as a defect.
const PENDING: Record<"audit", { what: string; basis: string }> = {
  audit: {
    what:
      "Which agent ran what, which sources it triggered, and which reports were generated, edited or modified.",
    basis: "FR-AUD-01 to FR-AUD-03.",
  },
};

function NotBuiltYet({ tab }: { tab: "audit" }) {
  const p = PENDING[tab];
  return (
    <div className="mt-6 max-w-2xl border border-black/10 bg-black/[0.02] p-4">
      <p className="text-sm">{p.what}</p>
      <p className="mt-2 text-2xs text-cpx-grey">{p.basis}</p>
    </div>
  );
}

export default function ManagePage() {
  return (
    <Suspense>
      <ManageInner />
    </Suspense>
  );
}
