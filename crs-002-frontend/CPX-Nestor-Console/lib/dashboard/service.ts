// The dashboard data service. The single seam between where the numbers come
// from and what draws them.
//
//   today      mock fixture ──┐
//                             ├─> service ──> components
//   later      backend API ───┘
//
// Components never call fetch and never import the fixture. When
// GET /dashboard/analyst exists, the only edit is inside `load` below: the
// endpoint is already attempted first, so the switch is deleting the catch, not
// rewriting a screen.
//
// The service never throws. A dashboard that renders nothing because one block
// failed is worse than one that says which block it could not reach.

import mock from "@/fixtures/analyst-dashboard.json";
import type { AnalystDashboard, DashboardResult } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

/** The mock payload, typed against the same contract the API will satisfy. */
export const MOCK_ANALYST_DASHBOARD = mock as unknown as AnalystDashboard;

function isEmpty(d: AnalystDashboard): boolean {
  // Empty is a real state, not a failure: a quiet day holds nothing to show.
  return (
    d.kpis.length === 0 &&
    d.priorityQueue.length === 0 &&
    d.severityDistribution.every((s) => s.value === 0)
  );
}

export async function getAnalystDashboard(userId: string): Promise<DashboardResult> {
  try {
    const response = await fetch(`${API_BASE}/dashboard/analyst`, {
      cache: "no-store",
      headers: { "X-Nestor-User": userId },
    });
    if (response.ok) {
      const payload = (await response.json()) as { data: AnalystDashboard };
      const data = payload.data;
      return {
        state: isEmpty(data) ? "empty" : "ok",
        source: "live",
        data,
      };
    }
    // A 404 is the expected answer until the endpoint is built. It is not an
    // error worth showing an analyst, so it falls through to the fixture.
    if (response.status !== 404) {
      return {
        state: "unavailable",
        source: "live",
        data: null,
        note: `The dashboard service returned ${response.status}.`,
      };
    }
  } catch {
    // Network-level failure: the backend is not running. Same fall-through.
  }

  return {
    state: isEmpty(MOCK_ANALYST_DASHBOARD) ? "empty" : "ok",
    source: "mock",
    data: MOCK_ANALYST_DASHBOARD,
    note: "Demonstration data. No dashboard feed is connected yet.",
  };
}

// --- role dashboards ---------------------------------------------------------
//
// Same seam, one dataset. The service fetches (or falls back to) the shared
// intelligence dataset and hands it to the projector, which builds the widgets
// that role receives. Swapping mock for a live feed changes this function and
// nothing else.

import dataset from "@/fixtures/intelligence-dataset.json";
import type { RoleKey } from "../types";
import { projectDashboard } from "./project";
import type { IntelligenceDataset, RoleDashboardResult } from "./types";

export const MOCK_DATASET = dataset as unknown as IntelligenceDataset;

function datasetIsEmpty(d: IntelligenceDataset): boolean {
  return d.findings.length === 0 && d.campaigns.length === 0;
}

export async function getRoleDashboard(
  userId: string,
  role: RoleKey,
): Promise<RoleDashboardResult> {
  let data: IntelligenceDataset | null = null;
  let source: "live" | "mock" = "mock";
  let note: string | undefined =
    "Demonstration data. No intelligence feed is connected yet.";

  try {
    const response = await fetch(`${API_BASE}/dashboard/intelligence`, {
      cache: "no-store",
      headers: { "X-Nestor-User": userId },
    });
    if (response.ok) {
      const payload = (await response.json()) as { data: IntelligenceDataset };
      data = payload.data;
      source = "live";
      note = undefined;
    } else if (response.status !== 404) {
      // A 404 is the expected answer until the endpoint exists and falls
      // through to the fixture. Anything else is worth saying out loud.
      return {
        state: "unavailable",
        source: "live",
        data: null,
        note: `The intelligence service returned ${response.status}.`,
      };
    }
  } catch {
    // Network-level failure: the backend is not running.
  }

  if (!data) data = MOCK_DATASET;

  // The projection is the same whichever source the dataset came from, which is
  // what keeps the components ignorant of the difference.
  return {
    state: datasetIsEmpty(data) ? "empty" : "ok",
    source,
    data: projectDashboard(data, role),
    note,
  };
}
