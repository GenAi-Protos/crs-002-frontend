"use client";

// New report, in three steps: type, then template, then the report itself.
//
//   Select report type  >  Select template  >  Create report
//
// Template selection is its own step and happens before the editor opens. A
// document's structure is decided once, at the start; offering it again inside
// the editor would invite an analyst to change the format of something already
// half written.
//
// A custom template is read and shown before Continue is available, so the
// console never opens an editor around a structure the analyst has not seen.
// It is not held to the standard format: a client who asked for their own
// structure has not made a mistake. Only a file no structure could be read
// from is refused.

import { useEffect, useState } from "react";
import type { Client } from "@/lib/types";
import {
  REPORT_TYPES,
  TEMPLATES,
  type ReportType,
  type TemplateSection,
} from "@/lib/report-templates";
import { TemplateStep } from "./TemplateStep";
import { Dialog, buttonClass } from "@/components/ui";

export interface TemplateChoice {
  kind: "standard" | "custom";
  name: string;
  sections: TemplateSection[];
}

type Step = "type" | "template" | "details";

export function NewReportDialog({
  clients,
  onClose,
  onCreateRfi,
  onCreateReport,
}: {
  clients: Client[];
  onClose: () => void;
  onCreateRfi: (draft: {
    requester: string;
    question: string;
    clientId: string;
    dueAt: string;
  }) => Promise<void>;
  onCreateReport: (
    type: ReportType,
    title: string,
    template: TemplateChoice,
  ) => Promise<void>;
}) {
  const [type, setType] = useState<ReportType | null>(null);
  const [step, setStep] = useState<Step>("type");
  const [choice, setChoice] = useState<TemplateChoice | null>(null);

  const pickType = (t: ReportType) => {
    setType(t);
    // An RFI is a work order, not a document, so it has no template step.
    setStep(t === "RFI" ? "details" : "template");
  };

  return (
    <Dialog title="New report" onClose={onClose} className="mb-auto mt-10 max-w-lg">
      <Steps current={step} hasTemplate={type !== "RFI"} />

        {step === "type" && <TypePicker onPick={pickType} onClose={onClose} />}

        {step === "template" && type && type !== "RFI" && (
          <TemplateStep
            type={type}
            onBack={() => setStep("type")}
            onContinue={(c) => {
              setChoice(c);
              setStep("details");
            }}
          />
        )}

        {step === "details" && type === "RFI" && (
          <RfiForm
            clients={clients}
            onBack={() => setStep("type")}
            onCreate={onCreateRfi}
          />
        )}

        {step === "details" && type && type !== "RFI" && choice && (
          <TitleForm
            type={type}
            choice={choice}
            onBack={() => setStep("template")}
            onCreate={(title) => onCreateReport(type, title, choice)}
          />
        )}
    </Dialog>
  );
}

function Steps({ current, hasTemplate }: { current: Step; hasTemplate: boolean }) {
  const steps: { key: Step; label: string }[] = [
    { key: "type", label: "Type" },
    ...(hasTemplate ? [{ key: "template" as Step, label: "Template" }] : []),
    { key: "details", label: "Create" },
  ];
  return (
    <span className="flex items-center gap-1.5 text-2xs text-cpx-grey-500">
      {steps.map((s, i) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className={current === s.key ? "font-medium text-cpx-black" : ""}>
            {s.label}
          </span>
          {i < steps.length - 1 && <span aria-hidden>&rsaquo;</span>}
        </span>
      ))}
    </span>
  );
}

// --- step 1 ------------------------------------------------------------------

function TypePicker({
  onPick,
  onClose,
}: {
  onPick: (t: ReportType) => void;
  onClose: () => void;
}) {
  return (
    <>
      <p className="mt-3 text-xs text-cpx-grey-500">Report type</p>
      <ul className="mt-2 border border-cpx-grey-100">
        {REPORT_TYPES.map((t) => {
          const template = TEMPLATES[t];
          return (
            <li key={t} className="border-b border-cpx-grey-100 last:border-b-0">
              <button
                onClick={() => onPick(t)}
                className="block w-full px-3 py-2.5 text-left hover:bg-cpx-grey-50"
              >
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-2xs text-cpx-grey-500">{t}</span>
                  <span className="text-sm font-medium">{template.name}</span>
                  <span className="ml-auto bg-cpx-grey-50 px-1.5 text-2xs">
                    {template.workOrder
                      ? "Work order"
                      : `${template.sections.length} ${template.sections.length === 1 ? "section" : "sections"}`}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-cpx-grey-500">
                  {template.purpose}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex justify-end">
        <button
          onClick={onClose}
          className={buttonClass()}
        >
          Cancel
        </button>
      </div>
    </>
  );
}

// --- step 3 ------------------------------------------------------------------

function TitleForm({
  type,
  choice,
  onBack,
  onCreate,
}: {
  type: ReportType;
  choice: TemplateChoice;
  onBack: () => void;
  onCreate: (title: string) => Promise<void>;
}) {
  const template = TEMPLATES[type];
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <p className="mt-3 flex flex-wrap items-baseline gap-2 text-xs text-cpx-grey-500">
        <span className="bg-cpx-grey-50 px-1.5 text-2xs text-cpx-black">{type}</span>
        {template.name}
      </p>

      <div className="mt-3 border border-cpx-grey-100 px-3 py-2">
        <span className="text-2xs text-cpx-grey-500">Template</span>
        <span className="mt-0.5 block break-all text-sm font-medium">
          {choice.kind === "standard" ? "Standard template" : choice.name}
        </span>
        <span className="mt-0.5 block text-xs text-cpx-grey-500">
          {choice.sections.length}{" "}
          {choice.sections.length === 1 ? "section" : "sections"} detected
        </span>
      </div>

      <label className="mt-4 block">
        <span className="text-xs text-cpx-grey-500">Title</span>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 h-9 w-full border border-cpx-grey-100 px-3 text-sm focus:border-cpx-green focus:outline-none"
        />
      </label>

      <ol className="mt-3 max-h-44 overflow-y-auto border border-cpx-grey-100">
        {choice.sections.map((s, i) => (
          <li
            key={`${i}-${s.heading}`}
            className="flex gap-2 border-b border-cpx-grey-100 px-3 py-1.5 text-xs last:border-b-0"
          >
            {/* One number, this list's own: the heading arrived stripped of
                whatever numbering its source document carried. */}
            <span className="text-cpx-grey-500">{i + 1}.</span>
            <span className="">{s.heading}</span>
          </li>
        ))}
      </ol>
      {/* The CPX structure and its requirement references describe the standard
          format. They say nothing about a template someone else wrote. */}
      <p className="mt-2 text-2xs text-cpx-grey-500">
        {choice.kind === "standard"
          ? template.basis
          : "Structure based on the uploaded custom template."}
      </p>

      {error && (
        <p className="mt-3 text-xs text-status-warn-ink">{error}</p>
      )}

      <div className="mt-5 flex items-center gap-2">
        <button
          onClick={onBack}
          className={buttonClass()}
        >
          Back
        </button>
        <span className="text-2xs text-cpx-grey-500">
          Creates a draft. A lead analyst approves before it reaches a client.
        </span>
        <div className="flex-1" />
        <button
          disabled={!title.trim() || busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onCreate(title.trim());
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
          className={buttonClass("primary")}
        >
          {busy ? "Creating" : "Create report"}
        </button>
      </div>
    </>
  );
}

// --- RFI, unchanged ----------------------------------------------------------

function RfiForm({
  clients,
  onBack,
  onCreate,
}: {
  clients: Client[];
  onBack: () => void;
  onCreate: (draft: {
    requester: string;
    question: string;
    clientId: string;
    dueAt: string;
  }) => Promise<void>;
}) {
  const [requester, setRequester] = useState("");
  const [question, setQuestion] = useState("");
  const [clientId, setClientId] = useState("");
  const [due, setDue] = useState("2026-08-09");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId && clients.length) setClientId(clients[0].id);
  }, [clients, clientId]);

  return (
    <>
      <p className="mt-3 flex items-baseline gap-2 text-xs text-cpx-grey-500">
        <span className="bg-cpx-grey-50 px-1.5 text-2xs text-cpx-black">RFI</span>
        Request for Information
      </p>
      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="text-xs text-cpx-grey-500">Requester</span>
          <input
            value={requester}
            onChange={(e) => setRequester(e.target.value)}
            className="mt-1 h-9 w-full border border-cpx-grey-100 px-3 text-sm focus:border-cpx-green focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs text-cpx-grey-500">Question</span>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            className="mt-1 w-full border border-cpx-grey-100 px-3 py-2 text-sm focus:border-cpx-green focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs text-cpx-grey-500">Client</span>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="mt-1 h-9 w-full border border-cpx-grey-100 bg-white px-2 text-sm focus:outline-none"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} · {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-cpx-grey-500">Due date</span>
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="mt-1 h-9 w-full border border-cpx-grey-100 px-3 text-sm focus:outline-none"
          />
        </label>
      </div>
      {error && (
        <p className="mt-3 text-xs text-status-warn-ink">{error}</p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onBack}
          className={buttonClass("secondary", "md", "mr-auto")}
        >
          Back
        </button>
        <button
          disabled={!requester.trim() || !question.trim() || !clientId || busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onCreate({
                requester: requester.trim(),
                question: question.trim(),
                clientId,
                dueAt: `${due}T12:00:00Z`,
              });
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
          className={buttonClass("primary")}
        >
          {busy ? "Filing" : "Create"}
        </button>
      </div>
    </>
  );
}
