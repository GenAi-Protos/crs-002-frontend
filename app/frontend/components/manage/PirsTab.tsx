"use client";

// PIR management.
//
// The 24 PIRs are CPX's own, taken verbatim from their sheet including the
// grammar. Nothing on this screen rewrites one, and the category list is a
// fixed set: a PIR filed under a category CPX does not use is an invented
// category, which is worse than an unfiled PIR.
//
// Reading is not editing. Every console user who reaches Manage sees the whole
// list; only the lead analyst gets the Add and Edit controls, and hiding those
// controls is not the access rule - the backend refuses the write.
//
// Basis: FR-PIR-01 to FR-PIR-05; Abhinav Singh, 2 September 2026 (24:54).
// Client parameter lists remain outstanding at open item B2, which is what the
// derived-parameter line records rather than asserts.

import { useMemo, useState } from "react";
import { canAdminister } from "@/lib/access";
import { createPir, patchPir } from "@/lib/api";
import { useConsoleUser } from "@/lib/role-context";
import type { ParameterKey, Pir, PirCategory } from "@/lib/types";
import {
  Banner,
  Button,
  buttonClass,
  downloadCsv,
  ListMeta,
  Panel,
  SearchBox,
  Select,
} from "@/components/ui";
import { IconPlus } from "@/components/icons";
import {
  TypeBadge,
  T_HEAD,
  T_ROW,
  T_SCROLL,
  T_TABLE,
  T_TD,
  T_TH,
  EmptyRow,
} from "@/components/table";

/** CPX's categories. Not a suggestion list: a PIR belongs to one of these. */
const CATEGORIES: PirCategory[] = [
  "Enterprise",
  "Industry Threat and Events",
  "Vulnerabilities",
  "Global Threat and Events",
  "Geopolitical Threat and Events",
  "Deep and Dark Web",
  "Major Cyber Event",
];

const ALL = "All";

/** PIR10 sorts after PIR9. Sorting the refs as text puts it after PIR1. */
const refNumber = (ref: string) => Number(ref.replace(/\D/g, "")) || 0;

// A question carries what it is asked about as a placeholder. The parameter
// list is derived from the text on both sides of the wire, so the two cannot
// drift apart.
const PLACEHOLDERS: Record<ParameterKey, RegExp> = {
  client: /\[\s*client\s*\]/i,
  industry: /\[\s*industry\s*\]/i,
  techStack: /\[\s*tech\s*stack\s*\]/i,
};

const PARAMETER_LABEL: Record<ParameterKey, string> = {
  client: "[Client]",
  industry: "[Industry]",
  techStack: "[Tech Stack]",
};

function parametersIn(question: string): ParameterKey[] {
  return (Object.keys(PLACEHOLDERS) as ParameterKey[]).filter((k) =>
    PLACEHOLDERS[k].test(question),
  );
}

type Draft = {
  category: PirCategory;
  question: string;
  coverage: string;
  stixNative: boolean;
};

const blankDraft = (): Draft => ({
  category: "Enterprise",
  question: "",
  coverage: "",
  stixNative: false,
});

const draftOf = (p: Pir): Draft => ({
  category: p.category,
  question: p.question,
  coverage: p.coverage,
  stixNative: p.stixNative,
});

export function PirsTab({
  pirs,
  onChange,
  initialQuery = "",
}: {
  pirs: Pir[];
  onChange: (next: Pir[]) => void;
  /** Global search sends the ref it matched, so the tab opens on that row. */
  initialQuery?: string;
}) {
  const { user } = useConsoleUser();
  const editable = canAdminister(user.role);

  const [q, setQ] = useState(initialQuery);
  const [category, setCategory] = useState<string>(ALL);
  const [coverage, setCoverage] = useState<string>(ALL);
  const [adding, setAdding] = useState(false);
  const [editingRef, setEditingRef] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...pirs].sort((a, b) => refNumber(a.ref) - refNumber(b.ref)),
    [pirs],
  );

  // Filter options come from the data, never from a hardcoded list: a coverage
  // value CPX adds tomorrow appears here without an edit.
  const coverages = useMemo(
    () => [...new Set(sorted.map((p) => p.coverage))].sort(),
    [sorted],
  );
  const categoriesPresent = useMemo(
    () =>
      CATEGORIES.filter((c) => sorted.some((p) => p.category === c)),
    [sorted],
  );

  const needle = q.trim().toLowerCase();
  const rows = sorted.filter(
    (p) =>
      (category === ALL || p.category === category) &&
      (coverage === ALL || p.coverage === coverage) &&
      (needle === "" ||
        p.ref.toLowerCase().includes(needle) ||
        p.category.toLowerCase().includes(needle) ||
        p.coverage.toLowerCase().includes(needle) ||
        p.question.toLowerCase().includes(needle)),
  );

  const save = async (draft: Draft, ref: string | null) => {
    if (ref === null) {
      const created = await createPir(user.id, draft);
      onChange([...pirs, created]);
      setAdding(false);
    } else {
      const updated = await patchPir(user.id, ref, draft);
      onChange(pirs.map((p) => (p.ref === ref ? updated : p)));
      setEditingRef(null);
    }
  };

  return (
    <div>
      <Panel
        title="Priority intelligence requirements"
        count={pirs.length}
        action={
          editable ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setAdding((a) => !a);
                setEditingRef(null);
              }}
            >
              <IconPlus />
              Add PIR
            </Button>
          ) : undefined
        }
        enter={0}
        flush
      >
      <div className="flex flex-wrap items-center gap-2 border-b border-cpx-grey-100 px-3 py-2">
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder="Search ref, category or PIR"
          className="w-full max-w-72"
        />
        <Filter
          label="Category"
          value={category}
          options={categoriesPresent}
          onChange={setCategory}
        />
        <Filter
          label="Coverage"
          value={coverage}
          options={coverages}
          onChange={setCoverage}
        />
        <div className="flex-1" />
        <ListMeta
          shown={rows.length}
          total={pirs.length}
          sort="Ref ascending"
          onExport={() =>
            downloadCsv(
              "pirs.csv",
              ["Category", "Ref", "PIR", "Coverage"],
              rows.map((p) => [p.category, p.ref, p.question, p.coverage]),
            )
          }
        />
      </div>

      {adding && (
        <div className="reveal border-b border-cpx-grey-100 bg-cpx-grey-50 p-4">
          <PirForm
            heading="Add PIR"
            initial={blankDraft()}
            onCancel={() => setAdding(false)}
            onSave={(d) => save(d, null)}
          />
        </div>
      )}

      <div className={T_SCROLL}>
        <table className={`${T_TABLE} table-fixed bg-white text-sm`}>
          <colgroup>
            <col className="w-44" />
            <col className="w-16" />
            <col />
            <col className="w-44" />
            {editable && <col className="w-20" />}
          </colgroup>
          <thead>
            <tr className={T_HEAD}>
              <th scope="col" className={T_TH}>Category</th>
              <th scope="col" className={T_TH}>Ref</th>
              <th scope="col" className={T_TH}>PIR</th>
              <th scope="col" className={T_TH}>Coverage</th>
              {editable && (
                <th className={T_TH}>
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <EmptyRow colSpan={editable ? 5 : 4}>
                <span className="font-medium text-cpx-black">0 PIRs</span> matched
              </EmptyRow>
            )}
            {rows.map((p) => {
              const editing = editingRef === p.ref;
              return (
                <RowGroup key={p.ref}>
                  <tr className={`${T_ROW} ${editing ? "bg-cpx-green-50/60" : ""}`}>
                    <td className={`${T_TD} text-cpx-grey-700`}>{p.category}</td>
                    <td className={`${T_TD} whitespace-nowrap font-mono text-xs`}>
                      {p.ref}
                    </td>
                    {/* The question wraps in full. A PIR that is cut off is a
                        PIR nobody can answer. Held to a readable measure: at
                        full table width a question ran past 90 characters. */}
                    <td className={`${T_TD} leading-relaxed`}>
                      {/* The cap sits on a block inside the cell: max-width on a
                          cell itself is ignored while the table lays out auto. */}
                      <span className="block max-w-[62ch]">{p.question}</span>
                    </td>
                    <td className={T_TD}>
                      <TypeBadge label={p.coverage} />
                    </td>
                    {editable && (
                      <td className={`${T_TD} text-right`}>
                        <button
                          onClick={() => {
                            setEditingRef(editing ? null : p.ref);
                            setAdding(false);
                          }}
                          aria-expanded={editing}
                          className={buttonClass("ghost", "sm", "text-link hover:text-cpx-purple")}
                        >
                          {editing ? "Close" : "Edit"}
                        </button>
                      </td>
                    )}
                  </tr>
                  {editing && (
                    <tr className="border-b border-cpx-grey-100 bg-cpx-grey-50">
                      <td colSpan={5} className="px-3 py-4">
                        <PirForm
                          heading={`Edit ${p.ref}`}
                          initial={draftOf(p)}
                          onCancel={() => setEditingRef(null)}
                          onSave={(d) => save(d, p.ref)}
                        />
                      </td>
                    </tr>
                  )}
                </RowGroup>
              );
            })}
          </tbody>
        </table>
      </div>
      </Panel>
    </div>
  );
}

// A fragment with a key, so a row and its editor stay one unit in the tbody.
function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Filter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-cpx-grey-500">
      {label}
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-[15rem]"
      >
        <option value={ALL}>{ALL}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
    </label>
  );
}

function PirForm({
  heading,
  initial,
  onCancel,
  onSave,
}: {
  heading: string;
  initial: Draft;
  onCancel: () => void;
  onSave: (draft: Draft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const question = draft.question.trim();
  const valid = question.length >= 10 && draft.coverage.trim() !== "";
  const parameters = parametersIn(question);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...draft, question, coverage: draft.coverage.trim() });
    } catch (e) {
      // The backend states its reason: 403 wrong role, 409 duplicate question.
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div>
      <h3 className="text-sm font-medium tracking-tightish">{heading}</h3>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-2xs text-cpx-grey-500">Category</span>
          <select
            value={draft.category}
            onChange={(e) =>
              setDraft({ ...draft, category: e.target.value as PirCategory })
            }
            className="mt-1 h-8 w-full border border-cpx-grey-100 bg-white px-2 text-sm focus:border-cpx-green focus:outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-2xs text-cpx-grey-500">Coverage</span>
          <input
            value={draft.coverage}
            onChange={(e) => setDraft({ ...draft, coverage: e.target.value })}
            list="pir-coverage-values"
            placeholder="Threat Actors"
            className="mt-1 h-8 w-full border border-cpx-grey-100 bg-white px-2 text-sm focus:border-cpx-green focus:outline-none"
          />
          <datalist id="pir-coverage-values">
            {[
              "Threat Actors",
              "TTPs",
              "Malware/Ransomware",
              "Campaigns",
              "Technology Stack",
              "Global Events",
              "Geopolitical",
              "Data Leaks",
              "Cyber Security Event",
              "Vulnerabilities",
            ].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
      </div>

      <label className="mt-3 block">
        <span className="text-2xs text-cpx-grey-500">PIR</span>
        <textarea
          value={draft.question}
          onChange={(e) => setDraft({ ...draft, question: e.target.value })}
          rows={3}
          placeholder="What threat actors are actively targeting [Client]'s industry?"
          className="mt-1 w-full border border-cpx-grey-100 bg-white px-2 py-1.5 text-sm leading-relaxed focus:border-cpx-green focus:outline-none"
        />
      </label>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={draft.stixNative}
            onChange={(e) => setDraft({ ...draft, stixNative: e.target.checked })}
            className="h-3.5 w-3.5"
          />
          Answerable from STIX objects alone
        </label>
        {/* Derived from the text, never typed: the parameters and the question
            cannot disagree. Per-client lists sit at open item B2. */}
        <span className="text-2xs text-cpx-grey-500">
          Parameters{" "}
          {parameters.length === 0 ? (
            <span className="text-cpx-black">none</span>
          ) : (
            parameters.map((p) => (
              <span key={p} className="ml-1 bg-cpx-grey-50 px-1.5 text-cpx-black">
                {PARAMETER_LABEL[p]}
              </span>
            ))
          )}
        </span>
      </div>

      {error && <Banner className="mt-3">{error}</Banner>}

      <div className="mt-3 flex items-center gap-2">
        <Button variant="primary" onClick={submit} disabled={!valid || saving}>
          {saving ? "Saving" : "Save"}
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
