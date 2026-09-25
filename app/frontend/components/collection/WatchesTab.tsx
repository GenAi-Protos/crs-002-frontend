"use client";

// Keyword watches: full create, edit, delete. This is where real per-row
// analyst judgement lives. Seeded from PIR17, PIR18, PIR19.

import { useEffect, useState } from "react";
import { TypeBadge } from "@/components/table";
import { WATCHES } from "@/lib/fixtures";
import { createWatch, deleteWatch, getPirs, patchWatch } from "@/lib/api";
import { useConsoleUser } from "@/lib/role-context";
import type { KeywordWatch, Pir, Rhythm } from "@/lib/types";
import { gstDateTime } from "@/lib/format";
import { IconChevronDown, IconPlus } from "@/components/icons";
import { Banner, Button, Dialog, ListMeta, Panel, SearchBox, buttonClass } from "@/components/ui";

const CADENCES: Rhythm[] = ["continuous", "hourly", "daily", "weekly"];

export function WatchesTab({ initialRows = WATCHES }: { initialRows?: KeywordWatch[] }) {
  const [watches, setWatches] = useState<KeywordWatch[]>(initialRows);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<KeywordWatch | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const { user } = useConsoleUser();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setWatches(initialRows), [initialRows]);

  const needle = q.toLowerCase();
  const rows = [...watches]
    .filter((w) => !needle || `${w.name} ${w.terms.join(" ")} ${w.pirRefs.join(" ")}`.toLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-3">
      {error && <Banner tone="warn">Not deleted: {error}</Banner>}
      <Panel
        title="Keyword watches"
        count={watches.length}
        action={
          <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
            <IconPlus />
            New watch
          </Button>
        }
        enter={0}
        flush
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-rule px-3 py-2">
          <SearchBox value={q} onChange={setQ} placeholder="Search watches" className="w-full max-w-72" />
          <div className="flex-1" />
          <ListMeta shown={rows.length} total={watches.length} sort="Name A to Z" />
        </div>
        {rows.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-mute">
            <span className="font-medium text-ink">0 watches</span>
            {q ? " match." : "."}
          </p>
        )}
        <ul>
          {rows.map((w) => {
            const isOpen = open === w.id;
            return (
              <li key={w.id} className="border-b border-rule last:border-b-0">
                <button
                  onClick={() => setOpen(isOpen ? null : w.id)}
                  aria-expanded={isOpen}
                  className={`row-link flex w-full items-center gap-3 px-3 py-2 text-left ${isOpen ? "bg-wash" : ""}`}
                >
                  <IconChevronDown className={`text-faint ${isOpen ? "" : "-rotate-90"}`} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{w.name}</span>
                  <span className="hidden flex-wrap gap-1 @xl/page:flex">
                    {w.pirRefs.map((p) => (
                      <TypeBadge key={p} label={p} />
                    ))}
                  </span>
                  <span className="w-20 shrink-0 text-right text-xs capitalize text-mute">{w.cadence}</span>
                  <span className="w-20 shrink-0 text-right text-xs tabular-nums text-mute">
                    {w.terms.length} {w.terms.length === 1 ? "term" : "terms"}
                  </span>
                </button>
                {isOpen && (
                  <div className="reveal grid gap-3 border-t border-rule bg-inset/60 px-3 py-3 pl-9 @3xl/page:grid-cols-2">
                    <div>
                      <div className="flex flex-wrap gap-1.5">
                        {w.terms.map((t) => (
                          <span key={t} className="rounded-sm border border-rule bg-surface px-1.5 py-0.5 font-mono text-xs">
                            {t}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-mute">
                        {w.language} · {w.region}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" onClick={() => setEditing(w)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
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
                          // The darker edge marks the armed state over the danger button's own.
                          className={confirming === w.id ? "border-danger!" : ""}
                        >
                          {confirming === w.id ? "Confirm delete" : "Delete"}
                        </Button>
                      </div>
                    </div>
                    {w.lastRun ? (
                      <div>
                        <p className="text-xs text-mute">Last run {gstDateTime(w.lastRun.at)}</p>
                        <ul className="mt-1 divide-y divide-rule rounded-sm border border-rule bg-surface">
                          {w.lastRun.results.map((r) => (
                            <li key={r.sourceName} className="flex justify-between px-2 py-1 text-xs">
                              <span>{r.sourceName}</span>
                              <span className="font-medium tabular-nums">{r.count}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-xs">
                        <span className="font-medium">0 runs</span>
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>

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
    <Dialog title={initial ? "Edit watch" : "New watch"} onClose={onClose} className="max-w-lg">
        <div className="space-y-3">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 w-full border border-rule px-3 text-sm focus:border-cpx-green focus:outline-none"
            />
          </Field>
          <Field label="Terms, comma separated">
            <input
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              className="h-9 w-full border border-rule px-3 font-mono text-xs focus:border-cpx-green focus:outline-none"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Language">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="h-9 w-full border border-rule bg-surface px-2 text-sm focus:outline-none"
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
                className="h-9 w-full border border-rule bg-surface px-2 text-sm focus:outline-none"
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
                  className={`px-2 py-1 text-xs ${
                    pirRefs.includes(p.ref)
                      ? "border border-cpx-green bg-select font-medium text-ink"
                      : "border border-rule text-mute"
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
              className="h-9 w-full border border-rule bg-surface px-2 text-sm focus:outline-none"
            >
              {CADENCES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
        {saveError && <p className="mt-3 text-xs text-status-warn-ink">{saveError}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className={buttonClass()}
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
            className={buttonClass("primary")}
          >
            {busy ? "Saving" : "Save"}
          </button>
        </div>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-mute">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
