import { publicEnv } from "./runtime-env";
import type { Tlp } from "./types";
import type { AnalystSubmission, AnalystSubmissionInput, EvidenceFile, SavedAdvisory, CaseCreate, CaseDetail, InvestigationCase } from "./workspace-types";

export class WorkspaceError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function workspaceRequest<T>(userId: string, path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${publicEnv().API_BASE_URL}${path}`, {
      ...init,
      cache: "no-store",
      headers: { "X-Nestor-User": userId, ...init.headers },
      signal: init.signal ?? AbortSignal.timeout(120_000),
    });
  } catch {
    throw new WorkspaceError("The service could not be reached. Retry when the backend is available.", 0);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const checks = Array.isArray(body?.detail?.checks) ? body.detail.checks.filter((check: { passed?: boolean }) => !check.passed).map((check: { label?: string; detail?: string }) => check.label ?? check.detail).filter(Boolean).join("; ") : "";
    const validation = Array.isArray(body?.detail) ? body.detail.map((item: { loc?: string[]; msg?: string }) => `${item.loc?.slice(1).join(".") ?? "Field"}: ${item.msg ?? "Invalid value"}`).join("; ") : "";
    const detail = typeof body?.detail === "string" ? body.detail : [body?.detail?.message ?? body?.detail?.error, checks, validation].filter(Boolean).join(" · ") || `Request failed (${response.status}). Check the fields and retry.`;
    throw new WorkspaceError(detail, response.status);
  }
  if (typeof window !== "undefined" && init.method && init.method.toUpperCase() !== "GET") window.dispatchEvent(new Event("nestor:workspace-changed"));
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export function workspaceWrite<T>(userId: string, path: string, body: unknown, method = "POST") {
  return workspaceRequest<T>(userId, path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export async function uploadEvidence(userId: string, files: File[], tlp: Tlp, clientId: string | null, purpose: "conversation" | "submission") {
  const data = new FormData();
  files.forEach((file) => data.append("files", file));
  data.append("tlp", tlp);
  data.append("purpose", purpose);
  if (clientId) data.append("clientId", clientId);
  return workspaceRequest<{ items: EvidenceFile[] }>(userId, "/evidence", { method: "POST", body: data });
}

export const getEvidence = (userId: string, id: string) => workspaceRequest<EvidenceFile>(userId, `/evidence/${encodeURIComponent(id)}`);
export const retryEvidence = (userId: string, id: string) => workspaceWrite<EvidenceFile>(userId, `/evidence/${encodeURIComponent(id)}/retry`, {});
export const createSubmission = (userId: string, body: AnalystSubmissionInput) => workspaceWrite<AnalystSubmission>(userId, "/collection/submissions", body);
export const saveReport = (userId: string, ref: string, body: unknown) => workspaceWrite<{ advisory: SavedAdvisory }>(userId, `/reports/${encodeURIComponent(ref)}`, body, "PATCH");
export const getCases = (userId: string, offset = 0) => workspaceRequest<{ items: InvestigationCase[]; total: number }>(userId, `/investigations?limit=100&offset=${offset}`);
export const getCase = (userId: string, id: string) => workspaceRequest<CaseDetail>(userId, `/investigations/${encodeURIComponent(id)}`);
export const createCase = (userId: string, body: CaseCreate) => workspaceWrite<InvestigationCase>(userId, "/investigations", body);
export const updateCase = (userId: string, id: string, body: unknown) => workspaceWrite<InvestigationCase>(userId, `/investigations/${encodeURIComponent(id)}`, body, "PATCH");
export const caseAction = <T = InvestigationCase>(userId: string, id: string, action: string, body: unknown) => workspaceWrite<T>(userId, `/investigations/${encodeURIComponent(id)}/${action}`, body);

export async function downloadEvidence(userId: string, file: EvidenceFile) {
  const response = await fetch(`${publicEnv().API_BASE_URL}/evidence/${encodeURIComponent(file.id)}/download`, { headers: { "X-Nestor-User": userId } });
  if (!response.ok) throw new Error("The evidence file could not be downloaded. Retry.");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url; link.download = file.fileName; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
