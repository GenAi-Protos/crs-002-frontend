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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4">
      <div className="mt-10 w-full max-w-lg border border-black/10 bg-white p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[16px] font-medium tracking-tightish">New report</h2>
          <Steps current={step} hasTemplate={type !== "RFI"} />
        </div>

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
      </div>
    </div>
  );
}

function Steps({ current, hasTemplate }: { current: Step; hasTemplate: boolean }) {
  const steps: { key: Step; label: string }[] = [
    { key: "type", label: "Type" },
    ...(hasTemplate ? [{ key: "template" as Step, label: "Template" }] : []),
    { key: "details", label: "Create" },
  ];
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-light text-cpx-grey">
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
      <p className="mt-3 text-[12px] font-light text-cpx-grey">Report type</p>
      <ul className="mt-2 border border-black/10">
        {REPORT_TYPES.map((t) => {
          const template = TEMPLATES[t];
          return (
            <li key={t} className="border-b border-black/10 last:border-b-0">
              <button
                onClick={() => onPick(t)}
                className="block w-full px-3 py-2.5 text-left hover:bg-black/[0.03]"
              >
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-[11.5px] text-cpx-grey">{t}</span>
                  <span className="text-[13px] font-medium">{template.name}</span>
                  <span className="ml-auto bg-black/5 px-1.5 text-[11px] font-light">
                    {template.workOrder
                      ? "Work order"
                      : `${template.sections.length} sections`}
                  </span>
                </span>
                <span className="mt-0.5 block text-[12px] font-light text-cpx-grey">
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
          className="h-8 border border-black/15 px-3 text-[13px] font-light hover:bg-black/5"
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
      <p className="mt-3 flex flex-wrap items-baseline gap-2 text-[12px] font-light text-cpx-grey">
        <span className="bg-black/5 px-1.5 text-[11px] text-cpx-black">{type}</span>
        {template.name}
      </p>

      <div className="mt-3 border border-black/10 px-3 py-2">
        <span className="text-[11.5px] font-light text-cpx-grey">Template</span>
        <span className="mt-0.5 block break-all text-[13px] font-medium">
          {choice.kind === "standard" ? "Standard template" : choice.name}
        </span>
        <span className="mt-0.5 block text-[12px] font-light text-cpx-grey">
          {choice.sections.length}{" "}
          {choice.sections.length === 1 ? "section" : "sections"} detected
        </span>
      </div>

      <label className="mt-4 block">
        <span className="text-[12px] font-light text-cpx-grey">Title</span>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 h-9 w-full border border-black/15 px-3 text-[13px] font-light focus:border-cpx-purple focus:outline-none"
        />
      </label>

      <ol className="mt-3 max-h-44 overflow-y-auto border border-black/10">
        {choice.sections.map((s, i) => (
          <li
            key={`${i}-${s.heading}`}
            className="flex gap-2 border-b border-black/5 px-3 py-1.5 text-[12.5px] last:border-b-0"
          >
            {/* One number, this list's own: the heading arrived stripped of
                whatever numbering its source document carried. */}
            <span className="text-cpx-grey">{i + 1}.</span>
            <span className="font-light">{s.heading}</span>
          </li>
        ))}
      </ol>
      {/* The CPX structure and its requirement references describe the standard
          format. They say nothing about a template someone else wrote. */}
      <p className="mt-2 text-[11px] font-light text-cpx-grey">
        {choice.kind === "standard"
          ? template.basis
          : "Structure based on the uploaded custom template."}
      </p>

      {error && (
        <p className="mt-3 text-[12px] font-light text-status-warn-ink">{error}</p>
      )}

      <div className="mt-5 flex items-center gap-2">
        <button
          onClick={onBack}
          className="h-8 border border-black/15 px-3 text-[13px] font-light hover:bg-black/5"
        >
          Back
        </button>
        <span className="text-[11px] font-light text-cpx-grey">
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
          className="h-8 whitespace-nowrap bg-cpx-green px-3 text-[13px] font-medium text-cpx-black disabled:bg-black/10 disabled:text-black/40"
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
      <p className="mt-3 flex items-baseline gap-2 text-[12px] font-light text-cpx-grey">
        <span className="bg-black/5 px-1.5 text-[11px] text-cpx-black">RFI</span>
        Request for Information
      </p>
      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="text-[12px] font-light text-cpx-grey">Requester</span>
          <input
            value={requester}
            onChange={(e) => setRequester(e.target.value)}
            className="mt-1 h-9 w-full border border-black/15 px-3 text-[13px] font-light focus:border-cpx-purple focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[12px] font-light text-cpx-grey">Question</span>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            className="mt-1 w-full border border-black/15 px-3 py-2 text-[13px] font-light focus:border-cpx-purple focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[12px] font-light text-cpx-grey">Client</span>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="mt-1 h-9 w-full border border-black/15 bg-white px-2 text-[13px] font-light focus:outline-none"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} · {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[12px] font-light text-cpx-grey">Due date</span>
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="mt-1 h-9 w-full border border-black/15 px-3 text-[13px] font-light focus:outline-none"
          />
        </label>
      </div>
      {error && (
        <p className="mt-3 text-[12px] font-light text-status-warn-ink">{error}</p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onBack}
          className="mr-auto h-8 border border-black/15 px-3 text-[13px] font-light hover:bg-black/5"
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
          className="h-8 bg-cpx-green px-3 text-[13px] font-medium text-cpx-black disabled:bg-black/10 disabled:text-black/40"
        >
          {busy ? "Filing" : "Create"}
        </button>
      </div>
    </>
  );
}
