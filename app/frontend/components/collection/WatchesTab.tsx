"use client";

// Keyword watches: full create, edit, delete. This is where real per-row
// analyst judgement lives. Seeded from PIR17, PIR18, PIR19.

import { useEffect, useState } from "react";
import { WATCHES } from "@/lib/fixtures";
import { createWatch, deleteWatch, getPirs, patchWatch } from "@/lib/api";
import { useConsoleUser } from "@/lib/role-context";
import type { KeywordWatch, Pir, Rhythm } from "@/lib/types";
import { gstDateTime } from "@/lib/format";
import { IconChevronDown, IconPlus } from "@/components/icons";

const CADENCES: Rhythm[] = ["continuous", "hourly", "daily", "weekly"];

export function WatchesTab({ initialRows = WATCHES }: { initialRows?: KeywordWatch[] }) {
  const [watches, setWatches] = useState<KeywordWatch[]>(initialRows);
  const [open, setOpen] = useState<string | null>(WATCHES[0]?.id ?? null);
  const [editing, setEditing] = useState<KeywordWatch | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const { user } = useConsoleUser();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setWatches(initialRows), [initialRows]);

  return (
    <div className="mt-4 max-w-3xl xl:max-w-none">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-light text-cpx-grey">
          <span className="font-medium text-cpx-black">{watches.length}</span> watches ·
          Name A to Z
        </span>
        <button
          onClick={() => setCreating(true)}
          className="flex h-8 items-center gap-1.5 bg-cpx-green px-3 text-[13px] font-medium text-cpx-black hover:brightness-95"
        >
          <IconPlus />
          New watch
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 items-start gap-2 xl:grid-cols-2">
        {watches.length === 0 && (
          <p className="text-[13px] font-light">
            <span className="font-medium">0 watches</span>
          </p>
        )}
        {[...watches]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((w) => {
            const isOpen = open === w.id;
            return (
              <div key={w.id} className="border border-black/10 bg-white">
                <button
                  onClick={() => setOpen(isOpen ? null : w.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="flex-1 text-[14px] font-medium tracking-tightish">
                    {w.name}
                  </span>
                  {w.pirRefs.map((p) => (
                    <span key={p} className="bg-black/5 px-1.5 py-0.5 text-[11px]">
                      {p}
                    </span>
                  ))}
                  <span className="text-[12px] font-light text-cpx-grey">{w.cadence}</span>
                  <IconChevronDown className={isOpen ? "rotate-180" : ""} />
                </button>
                {isOpen && (
                  <div className="border-t border-black/5 px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {w.terms.map((t) => (
                        <span
                          key={t}
                          className="bg-black/5 px-2 py-0.5 font-mono text-[12px]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-[12px] font-light text-cpx-grey">
                      {w.language} · {w.region}
                    </p>
                    {w.lastRun ? (
                      <div className="mt-3">
                        <p className="text-[12px] font-light text-cpx-grey">
                          Last run {gstDateTime(w.lastRun.at)}
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {w.lastRun.results.map((r) => (
                            <li
                              key={r.sourceName}
                              className="flex justify-between text-[12.5px]"
                            >
                              <span className="font-light">{r.sourceName}</span>
                              <span className="font-medium">{r.count}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="mt-3 text-[12.5px] font-light">
                        <span className="font-medium">0 runs</span>
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => setEditing(w)}
                        className="h-7 border border-black/15 px-2.5 text-[12px] font-light hover:bg-black/5"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirming === w.id) {
                            setConfirming(null);
                            setError(null);
                            deleteWatch(user.id, w.id)
                              .then(() => setWatches((ws) => ws.filter((x) => x.id !== w.id)))
                              .catch((e: Error) => setError(e.message));
                          } else {
                            setConfirming(w.id);
                          }
                        }}
                        onBlur={() => setConfirming(null)}
                        className={`h-7 px-2.5 text-[12px] ${
                          confirming === w.id
                            ? "bg-cpx-red font-medium text-white"
                            : "border border-black/15 font-light text-cpx-red hover:bg-black/5"
                        }`}
                      >
                        {confirming === w.id ? "Confirm delete" : "Delete"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {error && (
        <p className="mt-3 text-[12px] font-light text-cat-1">Not deleted: {error}</p>
      )}

      {(creating || editing) && (
        <WatchDialog
          initial={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={async (draft) => {
            // The server issues the id on create and owns lastRun on both paths.
            const saved = editing
              ? await patchWatch(user.id, editing.id, draft)
              : await createWatch(user.id, draft);
            setWatches((ws) =>
              ws.some((x) => x.id === saved.id)
                ? ws.map((x) => (x.id === saved.id ? saved : x))
                : [...ws, saved],
            );
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function WatchDialog({
  initial,
  onClose,
  onSave,
}: {
  initial?: KeywordWatch;
  onClose: () => void;
  onSave: (draft: {
    name: string;
    terms: string[];
    language: string;
    region: string;
    pirRefs: string[];
    cadence: Rhythm;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [terms, setTerms] = useState(initial?.terms.join(", ") ?? "");
  const [language, setLanguage] = useState(initial?.language ?? "English");
  const { user } = useConsoleUser();
  const [pirs, setPirs] = useState<Pir[]>([]);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  useEffect(() => {
    getPirs(user.id).then(setPirs).catch(() => setPirs([]));
  }, [user.id]);
  const [region, setRegion] = useState(initial?.region ?? "Middle East");
  const [pirRefs, setPirRefs] = useState<string[]>(initial?.pirRefs ?? []);
  const [cadence, setCadence] = useState<Rhythm>(initial?.cadence ?? "daily");

  const valid = name.trim() !== "" && terms.trim() !== "" && pirRefs.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto border border-black/10 bg-white p-5">
        <h2 className="text-[16px] font-medium tracking-tightish">
          {initial ? "Edit watch" : "New watch"}
        </h2>
        <div className="mt-4 space-y-3">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 w-full border border-black/15 px-3 text-[13px] font-light focus:border-cpx-purple focus:outline-none"
            />
          </Field>
          <Field label="Terms, comma separated">
            <input
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              className="h-9 w-full border border-black/15 px-3 font-mono text-[12.5px] focus:border-cpx-purple focus:outline-none"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Language">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="h-9 w-full border border-black/15 bg-white px-2 text-[13px] font-light focus:outline-none"
              >
                {["English", "Arabic", "English and Arabic"].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Region">
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="h-9 w-full border border-black/15 bg-white px-2 text-[13px] font-light focus:outline-none"
              >
                {["Global", "Middle East", "UAE"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="PIRs served">
            <div className="flex flex-wrap gap-1.5">
              {pirs.filter((p) => !p.stixNative).map((p) => (
                <button
                  key={p.ref}
                  onClick={() =>
                    setPirRefs((prev) =>
                      prev.includes(p.ref)
                        ? prev.filter((x) => x !== p.ref)
                        : [...prev, p.ref],
                    )
                  }
                  title={p.question}
                  className={`px-2 py-1 text-[12px] ${
                    pirRefs.includes(p.ref)
                      ? "bg-cpx-purple font-medium text-white"
                      : "border border-black/15 font-light text-cpx-grey"
                  }`}
                >
                  {p.ref}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Cadence">
            <select
              value={cadence}
              onChange={(e) => setCadence(e.target.value as Rhythm)}
              className="h-9 w-full border border-black/15 bg-white px-2 text-[13px] font-light focus:outline-none"
            >
              {CADENCES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
        {saveError && <p className="mt-3 text-[12px] font-light text-cat-1">{saveError}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-8 border border-black/15 px-3 text-[13px] font-light hover:bg-black/5"
          >
            Cancel
          </button>
          <button
            disabled={!valid || busy}
            onClick={async () => {
              setBusy(true);
              setSaveError(null);
              try {
                await onSave({
                  name: name.trim(),
                  terms: terms.split(",").map((t) => t.trim()).filter(Boolean),
                  language,
                  region,
                  pirRefs,
                  cadence,
                });
              } catch (e) {
                setSaveError((e as Error).message);
                setBusy(false);
              }
            }}
            className="h-8 bg-cpx-green px-3 text-[13px] font-medium text-cpx-black disabled:bg-black/10 disabled:text-black/40"
          >
            {busy ? "Saving" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] font-light text-cpx-grey">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
