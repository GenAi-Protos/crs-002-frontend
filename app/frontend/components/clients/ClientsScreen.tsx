"use client";

// Master-detail. Profile holds the facts that decide relevance; Sent is the
// delivery ledger that makes the no-client-login decision auditable.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConsoleUser } from "@/lib/role-context";
import { canSee } from "@/lib/access";
import { CLIENTS } from "@/lib/fixtures";
import { createClient, getClient, getClients, getPirs, patchClient, type ClientDetail, type ClientPatch, isUnreachable } from "@/lib/api";
import type { Client, Delivery, DrpItem, Pir } from "@/lib/types";
import { gstDate, gstDateTime } from "@/lib/format";
import { TypeBadge, T_HEAD, T_NUM, T_ROW, T_TABLE, T_TD, T_TH } from "@/components/table";
import { defang } from "@/lib/defang";
import { downloadCsv, ListMeta, SearchBox, StatusPill, Tabs, type StatusTone, Dialog, buttonClass, OfflineNote } from "@/components/ui";
import { IconPlus } from "@/components/icons";

const DRP_KIND_LABEL: Record<DrpItem["kind"], string> = {
  "leaked-credential": "Leaked credential",
  "impersonating-domain": "Impersonating domain",
  "phishing-campaign": "Phishing campaign",
  "brand-abuse": "Brand abuse",
};

const DRP_TONE: Record<DrpItem["status"], { tone: StatusTone; label: string }> = {
  new: { tone: "critical", label: "New" },
  triaged: { tone: "warn", label: "Triaged" },
  closed: { tone: "idle", label: "Closed" },
};

export function ClientsScreen({ selectedId }: { selectedId?: string }) {
  const { user } = useConsoleUser();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"profile" | "sent">("profile");
  const [editing, setEditing] = useState(false);
  const [expandedPir, setExpandedPir] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Client>>({});
  const [apiClients, setApiClients] = useState<Client[]>([]);
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [pirs, setPirs] = useState<Pir[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [offline, setOffline] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    // Fixtures stand in when the backend is down, labelled as such (hard rule 1).
    // `live` drops a response that lands after the role changed: the stored
    // role applies a tick after first render, and the first role's refusal
    // must not overwrite the rows the second role was allowed.
    let live = true;
    getClients(user.id)
      .then((cs) => {
        if (!live) return;
        setApiClients(cs);
        setOffline(false);
      })
      .catch((e) => {
        if (!live) return;
        setApiClients(CLIENTS);
        setOffline(isUnreachable(e));
      });
    getPirs(user.id).then((p) => live && setPirs(p)).catch(() => live && setPirs([]));
    return () => {
      live = false;
    };
  }, [user.id]);

  const allClients = apiClients;

  // One write per pause in typing, not one per keystroke. The timer is keyed by
  // client id so switching client mid-edit still flushes the edit that was made.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueSave = (id: string, patch: ClientPatch) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      patchClient(user.id, id, patch)
        .then((saved) => {
          setSaveError(null);
          // profileComplete is derived server-side; take the server's answer.
          setApiClients((cs) => cs.map((c) => (c.id === saved.id ? saved : c)));
          setOverrides((o) => {
            const rest = { ...o };
            delete rest[id];
            return rest;
          });
        })
        .catch((e: Error) => setSaveError(e.message));
    }, 600);
  };
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const list = useMemo(
    () =>
      allClients
        .filter(
          (c) =>
            q === "" ||
            c.name.toLowerCase().includes(q.toLowerCase()) ||
            c.id.toLowerCase().includes(q.toLowerCase()),
        )
        .sort((a, b) => a.id.localeCompare(b.id)),
    [q, allClients],
  );

  const targetId = useMemo(() => {
    if (!allClients.length) return null;
    const found = allClients.find((c) => c.id === selectedId);
    return (found ?? list[0] ?? allClients[0])?.id ?? null;
  }, [allClients, list, selectedId]);

  useEffect(() => {
    if (!targetId) return;
    let live = true;
    getClient(user.id, targetId)
      .then((d) => live && setDetail(d))
      .catch(() => live && setDetail(null));
    return () => {
      live = false;
    };
  }, [user.id, targetId]);

  if (!canSee(user.role, "clients")) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <p className="text-base">Not permitted at this access level.</p>
        <Link href="/" className="text-sm text-link underline underline-offset-2">
          Dashboard
        </Link>
      </div>
    );
  }

  if (allClients.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-base">No clients yet.</p>
      </div>
    );
  }

  if (selectedId && !allClients.some((c) => c.id === selectedId)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <p className="text-base">No client with this reference.</p>
        <Link
          href="/clients"
          className="text-sm text-link underline underline-offset-2"
        >
          Clients
        </Link>
      </div>
    );
  }

  const baseSelected =
    allClients.find((c) => c.id === selectedId) ?? list[0] ?? allClients[0];
  const client = overrides[baseSelected.id] ?? baseSelected;
  const drp: DrpItem[] = detail?.client.id === client.id ? detail.drpItems : [];
  const sent: Delivery[] =
    detail?.client.id === client.id
      ? [...detail.deliveries].sort((a, b) => +new Date(b.sentAt) - +new Date(a.sentAt))
      : [];

  const update = (fn: (c: Client) => Client) => {
    const next = fn(client);
    setOverrides((o) => ({ ...o, [client.id]: next }));
    queueSave(client.id, {
      name: next.name,
      sector: next.sector,
      region: next.region,
      products: next.products,
      subscribedPirRefs: next.subscribedPirRefs,
    });
  };

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="w-80 shrink-0 border-r border-cpx-grey-100 bg-white">
        <div className="flex items-center justify-between px-4 pb-2 pt-5">
          <h1 className="text-xl font-semibold tracking-tightish">Clients</h1>
          <span className="flex items-center gap-2">
            <span className="text-xs text-cpx-grey-500">
              {allClients.length}
            </span>
            <button
              onClick={() => setShowAdd(true)}
              aria-label="Add client"
              className="flex h-6 w-6 items-center justify-center border border-cpx-grey-100 text-cpx-grey-500 hover:bg-cpx-grey-50"
            >
              <IconPlus />
            </button>
          </span>
        </div>
        {offline && (
          <div className="px-4 pb-2">
            <OfflineNote />
          </div>
        )}
        <div className="px-4 pb-3">
          <SearchBox value={q} onChange={setQ} />
        </div>
        <ul>
          {list.length === 0 && (
            <li className="px-4 py-3 text-sm">
              <span className="font-medium">0 clients</span> matched
            </li>
          )}
          {list.map((c) => (
            <li key={c.id}>
              <Link
                href={`/clients/${c.id}`}
                className={`block border-l-2 px-4 py-2.5 ${
                  c.id === client.id
                    ? "border-cpx-green bg-cpx-green-50/40"
                    : "border-transparent hover:bg-cpx-grey-50"
                }`}
              >
                <span className="font-mono text-xs font-medium">{c.id}</span>
                <span
                  className="mt-0.5 block truncate text-sm"
                  title={c.name}
                >
                  {c.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      <section className="min-w-0 flex-1 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tightish">
              {client.id} · {client.name}
            </h2>
            <p className="mt-1 text-xs text-cpx-grey-500">
              {client.sector} · {client.region} · {client.products.length} products ·{" "}
              {client.subscribedPirRefs.length} PIRs
            </p>
          </div>
          <span className="flex items-center gap-3">
            {/* A write that did not land must say so: the edit is still on screen. */}
            {saveError && (
              <span className="text-xs text-status-warn-ink">Not saved: {saveError}</span>
            )}
            <button
              onClick={() => setEditing(!editing)}
              className={`h-8 px-3 text-sm ${
                editing
                  ? "border border-cpx-green bg-cpx-green-50 font-medium text-cpx-black"
                  : "border border-cpx-grey-100 hover:bg-cpx-grey-50"
              }`}
            >
              {editing ? "Done" : "Edit"}
            </button>
          </span>
        </div>

        <div className="mt-5 border border-cpx-grey-100 bg-white p-4">
          <span className="text-xs text-cpx-grey-500">
            Open against this client
          </span>
          {drp.length === 0 ? (
            <p className="mt-2 text-sm">
              <span className="font-medium">0 open items</span>
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-cpx-grey-100">
              {drp.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-44 shrink-0 font-medium">
                    {DRP_KIND_LABEL[d.kind]}
                  </span>
                  <span
                    className="min-w-0 flex-1 truncate"
                    title={
                      d.kind === "impersonating-domain"
                        ? defang(d.subject)
                        : d.subject
                    }
                  >
                    {d.kind === "impersonating-domain" ? defang(d.subject) : d.subject}
                  </span>
                  <span className="text-2xs text-cpx-grey-500">
                    {gstDate(d.firstSeen)}
                  </span>
                  <StatusPill {...DRP_TONE[d.status]} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-5">
          <Tabs
            tabs={[
              { key: "profile" as const, label: "Profile" },
              { key: "sent" as const, label: "Sent", count: sent.length },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>

        {showAdd && (
          <AddClientDialog
            onClose={() => setShowAdd(false)}
            onCreate={async (draft) => {
              const created = await createClient(user.id, draft);
              setApiClients((cs) => [...cs, created]);
              setShowAdd(false);
              router.push(`/clients/${created.id}`);
            }}
          />
        )}

        {tab === "profile" ? (
          <div className="mt-4 max-w-2xl space-y-4">
            <Row label="Sector">
              {editing ? (
                <select
                  value={client.sector}
                  onChange={(e) => update((c) => ({ ...c, sector: e.target.value }))}
                  className="h-8 border border-cpx-grey-100 bg-white px-2 text-sm focus:outline-none"
                >
                  {["Banking", "Energy", "Transport", "Aviation", "Government", "Telecom"].map(
                    (s) => (
                      <option key={s}>{s}</option>
                    ),
                  )}
                </select>
              ) : (
                <span className="text-sm">{client.sector}</span>
              )}
            </Row>
            <Row label="Region">
              {editing ? (
                <select
                  value={client.region}
                  onChange={(e) => update((c) => ({ ...c, region: e.target.value }))}
                  className="h-8 border border-cpx-grey-100 bg-white px-2 text-sm focus:outline-none"
                >
                  {["UAE", "GCC", "MENA"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              ) : (
                <span className="text-sm">{client.region}</span>
              )}
            </Row>
            <Row label="Products">
              <div className="flex flex-wrap items-center gap-1.5">
                {client.products.length === 0 && !editing && (
                  <span className="text-sm">
                    <span className="font-medium">0 products</span>
                  </span>
                )}
                {client.products.map((p) => (
                  <span
                    key={p}
                    className="flex items-center gap-1 bg-cpx-grey-50 px-2 py-0.5 text-xs"
                  >
                    {p}
                    {editing && (
                      <button
                        onClick={() =>
                          update((c) => ({
                            ...c,
                            products: c.products.filter((x) => x !== p),
                          }))
                        }
                        className="text-cpx-grey-400 hover:text-cpx-red"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                {editing && (
                  <AddProduct
                    onAdd={(p) =>
                      update((c) =>
                        c.products.includes(p)
                          ? c
                          : { ...c, products: [...c.products, p] },
                      )
                    }
                  />
                )}
              </div>
            </Row>
            <Row label="PIRs">
              <div>
                <div className="flex flex-wrap gap-1.5">
                  {pirs.map((p) => {
                    const ticked = client.subscribedPirRefs.includes(p.ref);
                    return (
                      <button
                        key={p.ref}
                        onClick={() => {
                          if (editing) {
                            update((c) => ({
                              ...c,
                              subscribedPirRefs: ticked
                                ? c.subscribedPirRefs.filter((r) => r !== p.ref)
                                : [...c.subscribedPirRefs, p.ref],
                            }));
                          } else {
                            setExpandedPir(expandedPir === p.ref ? null : p.ref);
                          }
                        }}
                        className={`px-2 py-1 text-xs ${
                          ticked
                            ? "border border-cpx-green bg-cpx-green-50 font-medium text-cpx-black"
                            : "border border-cpx-grey-100 text-cpx-grey-500"
                        } ${expandedPir === p.ref ? "outline outline-1 outline-cpx-green" : ""}`}
                      >
                        {ticked ? "☑" : "☐"} {p.ref.replace("PIR", "")}
                      </button>
                    );
                  })}
                </div>
                {expandedPir && (
                  <div className="mt-3 border border-cpx-grey-100 bg-cpx-grey-50 p-3">
                    <span className="font-mono text-2xs font-medium">{expandedPir}</span>
                    <p className="mt-1 text-sm leading-relaxed">
                      {pirs.find((p) => p.ref === expandedPir)?.question}
                    </p>
                    {(pirs.find((p) => p.ref === expandedPir)?.parameters.length ?? 0) > 0 &&
                      pirs.find((p) => p.ref === expandedPir)?.parametersUnverified && (
                        <p className="mt-1 text-2xs text-status-warn-ink">
                          Parameters pending:{" "}
                          {pirs.find((p) => p.ref === expandedPir)?.parameters.join(", ")}
                        </p>
                      )}
                  </div>
                )}
              </div>
            </Row>
          </div>
        ) : (
          <SentLedger clientId={client.id} deliveries={sent} />
        )}
      </section>
    </div>
  );
}

// A row create, not an onboarding wizard: the relevance facts are edited on
// the Profile tab it lands on, and the profile starts honestly incomplete.
function AddClientDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (draft: { name: string; sector: string; region: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [sector, setSector] = useState("Banking");
  const [region, setRegion] = useState("UAE");
  const [busy, setBusy] = useState(false);
  // The backend refuses a duplicate name with a stated reason. Show it here
  // rather than closing the dialog on a write that did not happen.
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog title="New client" onClose={onClose} className="max-w-sm">
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-cpx-grey-500">Name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 h-9 w-full border border-cpx-grey-100 px-3 text-sm focus:border-cpx-green focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-cpx-grey-500">Sector</span>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="mt-1 h-9 w-full border border-cpx-grey-100 bg-white px-2 text-sm focus:outline-none"
            >
              {["Banking", "Energy", "Transport", "Aviation", "Government", "Telecom"].map(
                (s) => (
                  <option key={s}>{s}</option>
                ),
              )}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-cpx-grey-500">Region</span>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="mt-1 h-9 w-full border border-cpx-grey-100 bg-white px-2 text-sm focus:outline-none"
            >
              {["UAE", "GCC", "MENA"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="mt-3 text-xs text-status-warn-ink">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className={buttonClass()}
          >
            Cancel
          </button>
          <button
            disabled={!name.trim() || busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onCreate({ name: name.trim(), sector, region });
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
            className={buttonClass("primary")}
          >
            Create
          </button>
        </div>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <span className="w-24 shrink-0 pt-1 text-xs text-cpx-grey-500">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function AddProduct({ onAdd }: { onAdd: (p: string) => void }) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex h-6 w-6 items-center justify-center border border-cpx-grey-100 text-cpx-grey-500 hover:bg-cpx-grey-50"
      >
        <IconPlus />
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) {
          onAdd(value.trim());
          setValue("");
          setOpen(false);
        }
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => setOpen(false)}
        className="h-6 w-40 border border-cpx-green px-1.5 text-xs focus:outline-none"
      />
    </form>
  );
}

// The ledger is handed the deliveries the detail call already returned, rather
// than fetching its own: one call per client, not one per tab.
function SentLedger({ clientId, deliveries }: { clientId: string; deliveries: Delivery[] }) {
  const [q, setQ] = useState("");
  const rows = deliveries.filter(
    (d) => q === "" || d.advisoryRef.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="mt-4">
      <div className="flex items-center gap-3">
        <SearchBox value={q} onChange={setQ} className="w-64" />
        <div className="flex-1" />
        <ListMeta
          shown={rows.length}
          total={rows.length}
          sort="Most recent first"
          onExport={() =>
            downloadCsv(
              `sent-${clientId}.csv`,
              ["Advisory", "Version", "Channel", "Format", "Sent"],
              rows.map((d) => [
                d.advisoryRef,
                String(d.advisoryVersion),
                d.channel,
                d.format,
                gstDateTime(d.sentAt),
              ]),
            )
          }
        />
      </div>
      <div className="mt-3 overflow-x-auto">
      <table className={`${T_TABLE} min-w-[42rem] bg-white text-sm`}>
        <colgroup>
          <col className="w-52" />
          <col className="w-20" />
          <col />
          <col className="w-24" />
          <col className="w-44" />
        </colgroup>
        <thead>
          <tr className={T_HEAD}>
            <th scope="col" className={T_TH}>Advisory</th>
            <th scope="col" className={`${T_TH} ${T_NUM}`}>Version</th>
            <th scope="col" className={T_TH}>Channel</th>
            <th scope="col" className={T_TH}>Format</th>
            <th scope="col" className={T_TH}>Sent</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center">
                <span className="font-medium">0 deliveries</span>
              </td>
            </tr>
          )}
          {rows.map((d, i) => (
            <tr key={i} className={T_ROW}>
              <td className={`${T_TD} whitespace-nowrap`}>
                <Link
                  href={`/reports/${encodeURIComponent(d.advisoryRef)}`}
                  className="font-mono text-xs text-link underline underline-offset-2"
                >
                  {d.advisoryRef}
                </Link>
              </td>
              <td className={`${T_TD} ${T_NUM}`}>v{d.advisoryVersion}</td>
              <td className={`${T_TD}`}>{d.channel}</td>
              <td className={`${T_TD}`}>
                <TypeBadge label={d.format.toUpperCase()} />
              </td>
              <td className={`${T_TD} whitespace-nowrap`}>
                {gstDateTime(d.sentAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
