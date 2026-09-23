import type { Advisory, Tlp } from "./types";

export interface EvidenceFile {
  id: string;
  fileName: string;
  mediaType: string;
  size: number;
  sha256: string;
  status: "processing" | "indexing" | "ready" | "partial" | "failed";
  tlp: Tlp;
  clientId: string | null;
  createdAt: string;
  createdBy: string;
  warnings: string[];
  error?: string;
  chunkCount: number;
}

export interface AnalystSubmissionInput {
  title: string;
  description: string;
  sourceName: string;
  sourceCategory: string;
  observedOn: string;
  tlp: Tlp;
  confidence: "Low" | "Medium" | "High";
  clientId: string | null;
  tags: string[];
  attachmentIds: string[];
  idempotencyKey: string;
}

export interface AnalystSubmission extends AnalystSubmissionInput {
  id: string;
  status: string;
  createdAt: string;
  createdBy: string;
  error?: string;
  warnings: string[];
}

export type SavedAdvisory = Advisory & { revision?: number; updatedAt?: string };

export type CaseStatus = "draft" | "active" | "awaiting-review" | "changes-requested" | "completed" | "archived";
export interface InvestigationCase {
  id: string; title: string; objective: string; entities: { type: string; value: string }[];
  clientId: string | null; workflowRef: string; specialists: string[]; status: CaseStatus;
  priority: "low" | "medium" | "high" | "critical"; assignedTo?: string; createdBy: string; createdAt: string; updatedAt: string;
  revision: number; evidenceIds: string[]; notes: { id: string; text: string; by: string; at: string }[];
  selectedSourceIds?: string[] | null;
  reportRefs: string[]; activeRunId: string | null;
}
export interface CaseContribution {
  id: string; caseId: string; runId: string; agentId: string; area: string; label: string;
  status: "running" | "done" | "failed" | "omitted";
  findings: { claim: string; citationIds: string[] }[];
  evidence: { id: string; label: string; source: string; text: string; observedAt: string; url?: string; tlp?: Tlp }[];
  negativeResults: unknown[]; limitations: string[]; error?: string; excluded: boolean; createdAt: string;
  contradictions?: { subject: string; claims: string[] }[];
  exclusionReason?: string;
}
export interface CaseDetail {
  case: InvestigationCase; contributions: CaseContribution[];
  relationships?: { entity: string; type: "mentioned-in"; evidenceId: string; label: string; excerpt: string; fileId: string | null }[];
  runs: { id: string; status?: string; workflowRef?: string; createdAt?: string; startedAt?: string; error?: string }[];
  reports: SavedAdvisory[];
}
export interface CaseCreate {
  title: string; objective: string; entities: { type: string; value: string }[]; clientId: string | null;
  workflowRef: string; specialists: string[]; priority?: InvestigationCase["priority"];
  selectedSourceIds?: string[] | null;
}

export interface CaseOptions {
  specialists: { id: string; label: string; available: boolean }[];
  workflows: { id: string; label: string }[];
  assignees: { id: string; name: string }[];
  sources: { id: string; name: string; status: string; reason?: string; available: boolean }[];
}
