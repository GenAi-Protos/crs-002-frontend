"use client";

// The per-row actions menu. One glyph in a narrow column, so the table keeps
// the five columns it had.
//
// Export opens a second level inside the same popover rather than a nested
// menu: a submenu that flies out of a table row is the wrong control at this
// size, and the level has a way back.
//
// Actions the report cannot take are shown disabled with the reason, never
// hidden. An analyst who cannot archive a published advisory should learn why
// once rather than wonder where the control went.

import { useEffect, useRef, useState } from "react";
import type { Advisory } from "@/lib/types";
import {
  FORMAT_LABEL,
  formatsFor,
  type ReportFormat,
  type TemplateFormat,
} from "@/lib/report-export";
import { templateFor } from "@/lib/report-templates";

const TEMPLATE_FORMATS: TemplateFormat[] = ["docx", "pdf", "md", "json"];

type Level = "root" | "report" | "template";

export function RowActions({
  advisory: a,
  writable,
  onView,
  onEdit,
  onPreview,
  onDuplicate,
  onExportReport,
  onExportTemplate,
  onArchive,
}: {
  advisory: Advisory;
  writable: boolean;
  onView: () => void;
  onEdit: () => void;
  onPreview: () => void;
  onDuplicate: () => void;
  onExportReport: (f: ReportFormat) => void;
  onExportTemplate: (f: TemplateFormat) => void;
  onArchive: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<Level>("root");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setLevel("root");
  }, [open]);

  const close = () => setOpen(false);
  const editable = writable && (a.status === "draft" || a.status === "in-review");
  const template = templateFor(a.type);
  // /reports/draft creates IA, VA and DG. An RFI is a work order and is filed,
  // not copied.
  const duplicable = writable && a.type !== "RFI";
  const archivable = writable && a.status !== "published" && a.status !== "archived";

  return (
    <div ref={box} className="relative flex justify-end">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${a.ref}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="flex h-7 w-7 items-center justify-center text-cpx-grey hover:bg-black/5"
      >
        <span aria-hidden className="text-md leading-none">
          &#8942;
        </span>
      </button>

      {open && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-8 z-50 min-w-[14rem] border border-black/10 bg-white py-1 text-left shadow-sm"
        >
          {level === "root" && (
            <>
              <Item label="View" onClick={() => (close(), onView())} />
              <Item
                label="Edit"
                disabled={!editable}
                hint={
                  editable
                    ? undefined
                    : a.status === "published"
                      ? "Published. Issue an update instead."
                      : a.status === "archived"
                        ? "Archived."
                        : "Not editable at this access level."
                }
                onClick={() => (close(), onEdit())}
              />
              <Item label="Preview" onClick={() => (close(), onPreview())} />
              <Item
                label="Duplicate"
                disabled={!duplicable}
                hint={
                  duplicable
                    ? undefined
                    : a.type === "RFI"
                      ? "An RFI is filed, not copied."
                      : "Not permitted at this access level."
                }
                onClick={() => (close(), onDuplicate())}
              />
              <Divider />
              <Item label="Export report" chevron onClick={() => setLevel("report")} />
              <Item
                label="Export template"
                chevron
                disabled={!template || template.workOrder === true}
                hint={
                  template?.workOrder ? "An RFI has no document template." : undefined
                }
                onClick={() => setLevel("template")}
              />
              <Divider />
              <Item
                label="Archive"
                disabled={!archivable}
                hint={
                  archivable
                    ? undefined
                    : a.status === "published"
                      ? "A published advisory is withdrawn or superseded, not archived."
                      : a.status === "archived"
                        ? "Already archived."
                        : "Not permitted at this access level."
                }
                onClick={() => (close(), onArchive())}
              />
            </>
          )}

          {level === "report" && (
            <>
              <Back onClick={() => setLevel("root")} label="Export report" />
              {formatsFor(a).map((f) => (
                <Item
                  key={f}
                  label={FORMAT_LABEL[f]}
                  hint={f === "pdf" ? "Opens the print dialogue" : undefined}
                  onClick={() => (close(), onExportReport(f))}
                />
              ))}
              <Footer>
                Indicators leave defanged. An unsafe citation URL never leaves.
              </Footer>
            </>
          )}

          {level === "template" && (
            <>
              <Back onClick={() => setLevel("root")} label="Export template" />
              {TEMPLATE_FORMATS.map((f) => (
                <Item
                  key={f}
                  label={`${FORMAT_LABEL[f]} template`}
                  hint={f === "pdf" ? "Opens the print dialogue" : undefined}
                  onClick={() => (close(), onExportTemplate(f))}
                />
              ))}
              <Footer>The empty {a.type} structure, without this report&apos;s content.</Footer>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Item({
  label,
  hint,
  disabled,
  chevron,
  onClick,
}: {
  label: string;
  hint?: string;
  disabled?: boolean;
  chevron?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="block w-full px-3 py-1.5 text-left text-xs hover:bg-black/[0.04] disabled:text-black/25 disabled:hover:bg-transparent"
    >
      <span className="flex items-center gap-2">
        {label}
        {chevron && <span className="ml-auto text-cpx-grey">&rsaquo;</span>}
      </span>
      {hint && <span className="mt-0.5 block text-2xs text-cpx-grey">{hint}</span>}
    </button>
  );
}

function Back({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="mb-1 flex w-full items-center gap-2 border-b border-black/10 px-3 pb-1.5 text-left text-2xs text-cpx-grey hover:text-cpx-black"
    >
      <span aria-hidden>&lsaquo;</span>
      {label}
    </button>
  );
}

function Divider() {
  return <div className="my-1 border-t border-black/10" />;
}

function Footer({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 border-t border-black/10 px-3 pt-1.5 text-2xs text-cpx-grey">
      {children}
    </p>
  );
}
