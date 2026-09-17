"use client";

// Step 2 of creating a report: which template, and what shape it has.
//
// The custom block states what was uploaded and how many sections came out of
// it. Nothing here measures the upload against the standard format: a client
// who asked for their own structure has not made a mistake, and a compatibility
// score on that screen would read as one.
//
// The structure itself is shown below, read-only, with an explicit Edit
// template. Editing is deliberate rather than ambient: a template is a shape
// many reports inherit, and a field that is always live invites a stray
// keystroke into something structural.

import { useState } from "react";
import { ACCEPTED, TEMPLATES, type ReportType, type TemplateSection } from "@/lib/report-templates";
// Type only: the parser (and the ZIP reader behind it) loads on the first
// upload, inside `choose` below, not with the dialog.
import type { ImportedTemplate } from "@/lib/template-import";
import type { TemplateChoice } from "./NewReportDialog";
import { buttonClass } from "@/components/ui";

export function TemplateStep({
  type,
  onBack,
  onContinue,
}: {
  type: ReportType;
  onBack: () => void;
  onContinue: (c: TemplateChoice) => void;
}) {
  const standard = TEMPLATES[type];
  const [kind, setKind] = useState<"standard" | "custom">("standard");
  const [imported, setImported] = useState<ImportedTemplate | null>(null);
  const [reading, setReading] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  // Edits live beside the source template rather than replacing it, so Cancel
  // has something to go back to and switching source starts clean.
  const [edited, setEdited] = useState<TemplateSection[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TemplateSection[]>([]);

  const base = kind === "standard" ? standard.sections : (imported?.sections ?? []);
  const sections = edited ?? base;

  // A template is usable when it has a structure. Whether that structure
  // resembles the standard format is not a condition.
  const usable = sections.length > 0 && !editing;

  const resetEdits = () => {
    setEdited(null);
    setEditing(false);
  };

  const choose = async (file: File) => {
    setReading(true);
    resetEdits();
    try {
      const { importTemplate } = await import("@/lib/template-import");
      const result = await importTemplate(file);
      setImported(result);
      if (result.sections.length > 0) setShowPreview(true);
    } catch (e) {
      setImported({ name: file.name, sections: [], warnings: [(e as Error).message] });
    } finally {
      setReading(false);
    }
  };

  const startEditing = () => {
    setDraft(sections.map((x) => ({ ...x })));
    setEditing(true);
    setShowPreview(true);
  };

  const save = () => {
    // A section with no heading is not a section. Nothing else is enforced.
    setEdited(
      draft
        .map((x) => ({ heading: x.heading.trim(), guidance: x.guidance.trim() }))
        .filter((x) => x.heading !== ""),
    );
    setEditing(false);
  };

  // An edited structure is no longer the format CPX publishes, whichever one it
  // started as, so it travels as a custom template and says so.
  const choice = (): TemplateChoice => {
    if (edited) {
      return {
        kind: "custom",
        name:
          kind === "standard"
            ? "Standard template, edited"
            : `${imported?.name ?? "Custom template"}, edited`,
        sections: edited,
      };
    }
    return kind === "standard"
      ? { kind: "standard", name: "Standard template", sections: standard.sections }
      : {
          kind: "custom",
          name: imported?.name ?? "Custom template",
          sections: imported?.sections ?? [],
        };
  };

  return (
    <>
      <p className="mt-3 flex items-baseline gap-2 text-xs text-cpx-grey-500">
        <span className="bg-cpx-grey-50 px-1.5 text-2xs text-cpx-black">{type}</span>
        {standard.name}
      </p>

      <h3 className="mt-4 text-sm font-medium tracking-tightish">
        Template selection
      </h3>

      <div className="mt-2 border border-cpx-grey-100">
        <Option
          checked={kind === "standard"}
          onSelect={() => {
            setKind("standard");
            resetEdits();
          }}
          label="Use standard template"
          note={`The ${standard.sections.length} sections CPX publishes this format with.`}
        />
        <div className="border-t border-cpx-grey-100">
          <Option
            checked={kind === "custom"}
            onSelect={() => {
              setKind("custom");
              resetEdits();
            }}
            label="Upload custom template"
            note="Supported formats: DOCX, Markdown, JSON."
          />
          {kind === "custom" && (
            <div className="px-3 pb-3 pl-9">
              <label className={buttonClass("secondary", "md", "cursor-pointer")}>
                {reading ? "Reading" : "Choose file"}
                <input
                  type="file"
                  accept={ACCEPTED}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void choose(f);
                  }}
                />
              </label>

              {/* A file the console could not read is the only failure here. */}
              {imported?.warnings.map((w) => (
                <p
                  key={w}
                  className="mt-2 border border-cpx-grey-100 bg-status-warn-fill px-2.5 py-1.5 text-xs text-status-warn-ink"
                >
                  {w}
                </p>
              ))}

              {imported && imported.sections.length > 0 && (
                <div className="mt-2 border border-cpx-grey-100 bg-cpx-grey-50 px-2.5 py-2">
                  <p className="text-xs font-medium">Custom template</p>
                  <p className="mt-0.5 break-all text-xs text-cpx-grey-500">
                    {imported.name}
                  </p>
                  <p className="mt-1 text-xs">
                    <span className="font-medium">{sections.length}</span>{" "}
                    {sections.length === 1 ? "section" : "sections"} detected
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showPreview && (sections.length > 0 || editing) && (
        <TemplatePreview
          sections={editing ? draft : sections}
          editing={editing}
          edited={edited !== null}
          onEdit={startEditing}
          onChange={setDraft}
          onSave={save}
          onCancel={() => setEditing(false)}
        />
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={onBack}
          disabled={editing}
          className={buttonClass()}
        >
          Back
        </button>
        <button
          onClick={() => setShowPreview(!showPreview)}
          disabled={sections.length === 0 || editing}
          className={buttonClass()}
        >
          {showPreview ? "Hide template" : "Preview template"}
        </button>
        <div className="flex-1" />
        <button
          disabled={!usable}
          onClick={() => onContinue(choice())}
          className={buttonClass("primary")}
        >
          Continue
        </button>
      </div>

      {!usable && (
        <p className="mt-2 text-right text-2xs text-cpx-grey-500">
          {editing
            ? "Save or cancel your changes to continue."
            : kind === "custom" && imported
              ? "No sections could be read from that file."
              : kind === "custom"
                ? "Choose a template file to continue."
                : ""}
        </p>
      )}
    </>
  );
}

function TemplatePreview({
  sections,
  editing,
  edited,
  onEdit,
  onChange,
  onSave,
  onCancel,
}: {
  sections: TemplateSection[];
  editing: boolean;
  edited: boolean;
  onEdit: () => void;
  onChange: (next: TemplateSection[]) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const set = (i: number, patch: Partial<TemplateSection>) =>
    onChange(sections.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const remove = (i: number) => onChange(sections.filter((_, j) => j !== i));
  const add = () => onChange([...sections, { heading: "", guidance: "" }]);

  return (
    <div className="mt-3 border border-cpx-grey-100">
      <div className="flex items-center gap-2 border-b border-cpx-grey-100 px-3 py-1.5">
        <span className="text-2xs text-cpx-grey-500">
          Template preview <span className="text-cpx-black">{sections.length}</span>
        </span>
        {edited && !editing && (
          <span className="bg-cpx-grey-50 px-1.5 text-2xs">Edited</span>
        )}
        <div className="flex-1" />
        {editing ? (
          <>
            <button
              onClick={onCancel}
              className={buttonClass("secondary", "sm")}
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={sections.every((s) => s.heading.trim() === "")}
              className={buttonClass("primary", "sm")}
            >
              Save changes
            </button>
          </>
        ) : (
          <button
            onClick={onEdit}
            className={buttonClass("secondary", "sm")}
          >
            Edit template
          </button>
        )}
      </div>

      <ol className="max-h-64 overflow-y-auto">
        {sections.map((s, i) => (
          <li key={i} className="border-b border-cpx-grey-100 px-3 py-2 last:border-b-0">
            {editing ? (
              <>
                <span className="flex items-center gap-2">
                  <span className="w-4 shrink-0 text-xs text-cpx-grey-500">
                    {i + 1}.
                  </span>
                  <input
                    value={s.heading}
                    onChange={(e) => set(i, { heading: e.target.value })}
                    placeholder="Section title"
                    className="h-8 min-w-0 flex-1 border border-cpx-grey-100 px-2 text-xs font-medium focus:border-cpx-green focus:outline-none"
                  />
                  <button
                    onClick={() => remove(i)}
                    aria-label={`Remove section ${i + 1}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center border border-cpx-grey-100 text-cpx-grey-500 hover:bg-cpx-grey-50"
                  >
                    &times;
                  </button>
                </span>
                <textarea
                  value={s.guidance}
                  onChange={(e) => set(i, { guidance: e.target.value })}
                  rows={2}
                  placeholder="What belongs in this section"
                  className="ml-6 mt-1.5 w-[calc(100%-3.5rem)] resize-y border border-cpx-grey-100 px-2 py-1 text-xs focus:border-cpx-green focus:outline-none"
                />
              </>
            ) : (
              <>
                <span className="flex gap-2 text-xs">
                  {/* One number, this list's own: a heading arrives stripped of
                      whatever numbering its source document carried. */}
                  <span className="text-cpx-grey-500">{i + 1}.</span>
                  <span className="font-medium">{s.heading}</span>
                </span>
                {s.guidance && (
                  <span className="mt-0.5 block pl-5 text-2xs text-cpx-grey-500">
                    {s.guidance}
                  </span>
                )}
              </>
            )}
          </li>
        ))}
      </ol>

      {editing && (
        <div className="border-t border-cpx-grey-100 px-3 py-2">
          <button
            onClick={add}
            className={buttonClass("secondary", "sm")}
          >
            Add section
          </button>
        </div>
      )}
    </div>
  );
}

function Option({
  checked,
  onSelect,
  label,
  note,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
  note: string;
}) {
  return (
    <button
      onClick={onSelect}
      role="radio"
      aria-checked={checked}
      className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-cpx-grey-50"
    >
      <span
        className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
          checked ? "border-cpx-purple" : "border-cpx-grey-100"
        }`}
      >
        {checked && <span className="h-1.5 w-1.5 rounded-full bg-cpx-purple" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs text-cpx-grey-500">{note}</span>
      </span>
    </button>
  );
}
