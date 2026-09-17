"use client";

import { useEffect, useState } from "react";

// Everyone lands here, and what they get resolves from their role.
//
// The TI Analyst has a dashboard of its own. Every other role is a projection
// of one shared intelligence dataset, so no two roles can be shown different
// counts of the same findings. What changes per role is which widgets are
// built and how much detail each carries, and that is decided in
// lib/dashboard, never here.

import { useConsoleUser } from "@/lib/role-context";
import { getHealth } from "@/lib/api";
import { DEMO_NOW, gstTime } from "@/lib/format";
import { PageHeader } from "@/components/ui";

import { AnalystDashboard } from "@/components/dashboard/AnalystDashboard";
import { RoleDashboard } from "@/components/dashboard/RoleDashboard";
import { getAnalystDashboard, getRoleDashboard } from "@/lib/dashboard/service";
import type { DashboardResult, RoleDashboardResult } from "@/lib/dashboard/types";

export default function Dashboard() {
  const { user } = useConsoleUser();
  const [backend, setBackend] = useState<"checking" | "connected" | "offline">("checking");
  const [advisoryCount, setAdvisoryCount] = useState<number>();
  // The TI Analyst dashboard comes through its own service, which is the one
  // seam between mock data now and the backend feed later.
  const [analyst, setAnalyst] = useState<DashboardResult>({
    state: "loading",
    source: "mock",
    data: null,
  });
  const [roleView, setRoleView] = useState<RoleDashboardResult>({
    state: "loading",
    source: "mock",
    data: null,
  });

  useEffect(() => {
    let live = true;
    getHealth()
      .then((health) => {
        if (!live) return;
        setBackend(health.status === "ok" ? "connected" : "offline");
        setAdvisoryCount(health.counts.advisories);
      })
      .catch(() => live && setBackend("offline"));
    return () => {
      live = false;
    };
  }, [user.id]);

  useEffect(() => {
    // Neither service throws: each resolves to a state the dashboard can draw.
    // `live` drops a projection that lands after the role has changed: the
    // stored role is applied a tick after first render, and the first role's
    // (empty) projection must not overwrite the second's.
    let live = true;
    getAnalystDashboard(user.id).then((r) => live && setAnalyst(r));
    setRoleView({ state: "loading", source: "mock", data: null });
    getRoleDashboard(user.id, user.role).then((r) => live && setRoleView(r));
    return () => {
      live = false;
    };
  }, [user.id, user.role]);

  const stamp = `as of ${gstTime(DEMO_NOW)}`;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
      <PageHeader
        title="Dashboard"
        action={
          <span className="text-xs text-cpx-grey-500">
            {backend === "connected" ? `Backend connected · ${advisoryCount} advisories` : `Backend ${backend}`} · {stamp}
          </span>
        }
      />
      {/* The TI Analyst keeps its own dashboard. Every other role is a
          projection of the shared intelligence dataset, drawn by one renderer,
          so the five views stay one product. */}
      {user.role === "analyst" ? (
        <AnalystDashboard result={analyst} />
      ) : (
        <RoleDashboard result={roleView} />
      )}
    </div>
  );
}
