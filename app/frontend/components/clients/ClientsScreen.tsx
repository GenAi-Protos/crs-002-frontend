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
import { EmptyRow, TypeBadge, T_HEAD, T_NUM, T_ROW, T_TABLE, T_TD, T_TH } from "@/components/table";
import { defang } from "@/lib/defang";
import {
  Banner,
  Button,
  CenterMessage,
  Dialog,
  downloadCsv,
  fieldClass,
  IconButton,
  ListMeta,
  NotPermitted,
  OfflineNote,
  Panel,
  SearchBox,
  Select,
  SkeletonPanel,
  SkeletonRows,
  StatusPill,
  Tabs,
  type StatusTone,
} from "@/components/ui";
import { IconCheck, IconClose, IconPlus } from "@/components/icons";

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
  // Loading is not "no clients": the empty sentence waits for an answer.
  const [loaded, setLoaded] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailTry, setDetailTry] = useState(0);

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
      })
      .finally(() => live && setLoaded(true));
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
    setDetailError(null);
    getClient(user.id, targetId)
      .then((d) => live && setDetail(d))
      .catch((e: Error) => {
        if (!live) return;
        // Not zeros: a detail that did not load says so (rule 8).
        setDetail(null);
        setDetailError(e.message);
      });
    return () => {
      live = false;
    };
  }, [user.id, targetId, detailTry]);

  if (!canSee(user.role, "clients")) return <NotPermitted />;

  if (!loaded) {
    return (
      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 border-r border-cpx-grey-100 bg-white p-4">
          <div className="mb-3 h-6 w-24 bg-cpx-grey-100" />
          <SkeletonRows rows={5} height="h-10" />
        </aside>
        <section className="flex-1 space-y-3 bg-band p-4">
          <SkeletonPanel rows={2} />
          <SkeletonPanel rows={5} />
        </section>
      </div>
    );
  }

  if (allClients.length === 0) {
    return <CenterMessage action={<span />}>No clients yet.</CenterMessage>;
  }

  if (selectedId && !allClients.some((c) => c.id === selectedId)) {
    return (
      <CenterMessage
        action={
          <Link href="/clients" className="link-quiet text-sm">
            Clients
          </Link>
        }
      >
        No client with this reference.
      </CenterMessage>
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
      <aside className="w-72 shrink-0 border-r border-cpx-grey-100 bg-white">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <h1 className="text-lg font-semibold tracking-tightish">Clients</h1>
          <span className="flex items-center gap-1.5">
            <span className="text-xs tabular-nums text-cpx-grey-500">
              {list.length} of {allClients.length}
            </span>
            <IconButton label="Add client" onClick={() => setShowAdd(true)}>
              <IconPlus />
            </IconButton>
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
            <li className="px-4 py-3 text-sm text-cpx-grey-500">
              <span className="font-medium text-cpx-black">0 clients</span> matched
            </li>
          )}
          {list.map((c) => (
            <li key={c.id}>
              <Link
                href={`/clients/${c.id}`}
                aria-current={c.id === client.id ? "page" : undefined}
                className={`block border-l-2 px-4 py-2 transition-colors duration-150 ${
                  c.id === client.id
                    ? "border-cpx-green bg-cpx-green-50/60"
                    : "border-transparent hover:border-cpx-grey-200 hover:bg-cpx-grey-50"
                }`}
              >
                <span className="block truncate text-sm font-medium" title={c.name}>
                  {c.name}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-2xs text-cpx-grey-500">
                  <span className="font-mono">{c.id}</span>· {c.sector} · {c.region}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      <section className="@container/page min-w-0 flex-1 space-y-3 bg-band px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tightish">{client.name}</h2>
            <p className="mt-0.5 text-xs text-cpx-grey-500">
              <span className="font-mono">{client.id}</span> · {client.sector} · {client.region} ·{" "}
              {client.products.length} products · {client.subscribedPirRefs.length} PIRs
            </p>
          </div>
          <span className="flex items-center gap-2">
            <Button
              variant={editing ? "primary" : "secondary"}
              aria-pressed={editing}
              onClick={() => setEditing(!editing)}
            >
              {editing ? "Done" : "Edit"}
            </Button>
          </span>
        </div>
        {/* A write that did not land must say so: the edit is still on screen. */}
        {saveError && <Banner tone="warn">Not saved: {saveError}</Banner>}
        {detailError && (
          <Banner action={<Button size="sm" onClick={() => setDetailTry((n) => n + 1)}>Retry</Button>}>
            This client&apos;s items and deliveries could not be loaded. {detailError}
          </Banner>
        )}

        <Panel title="Open against this client" count={detailError ? undefined : drp.length} flush enter={0}>
          {detailError ? (
            <p className="px-3 py-3 text-sm text-cpx-grey-500">Not loaded.</p>
          ) : drp.length === 0 ? (
            <p className="px-3 py-3 text-sm">
              <span className="font-medium">0 open items</span>
            </p>
          ) : (
            <ul>
              {drp.map((d) => (
                <li key={d.id} className="flex items-center gap-3 border-b border-cpx-grey-100 px-3 py-1.5 text-sm last:border-b-0">
                  <span className="w-36 shrink-0 font-medium @3xl/page:w-44">
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
        </Panel>

        <Panel flush enter={1}>
          <Tabs
            className="px-2 pt-1"
            tabs={[
              { key: "profile" as const, label: "Profile" },
              { key: "sent" as const, label: "Sent", count: detailError ? undefined : sent.length },
            ]}
            value={tab}
            onChange={setTab}
          />

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
          <div className="max-w-3xl space-y-3 p-3">
            <Row label="Sector">
              {editing ? (
                <Select
                  aria-label="Sector"
                  value={client.sector}
                  onChange={(e) => update((c) => ({ ...c, sector: e.target.value }))}
                >
                  {["Banking", "Energy", "Transport", "Aviation", "Government", "Telecom"].map(
                    (s) => (
                      <option key={s}>{s}</option>
                    ),
                  )}
                </Select>
              ) : (
                <span className="text-sm">{client.sector}</span>
              )}
            </Row>
            <Row label="Region">
              {editing ? (
                <Select
                  aria-label="Region"
                  value={client.region}
                  onChange={(e) => update((c) => ({ ...c, region: e.target.value }))}
                >
                  {["UAE", "GCC", "MENA"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
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
                    className="flex h-6 items-center gap-1 rounded-sm border border-cpx-grey-100 bg-cpx-grey-50 pl-2 pr-1 text-xs"
                  >
                    {p}
                    {editing && (
                      <IconButton
                        size="sm"
                        label={`Remove ${p}`}
                        className="h-4 w-4 hover:bg-cpx-red-50 hover:text-cpx-red-700"
                        onClick={() =>
                          update((c) => ({
                            ...c,
                            products: c.products.filter((x) => x !== p),
                          }))
                        }
                      >
                        <IconClose />
                      </IconButton>
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
                {pirs.length === 0 && (
                  <p className="pt-1 text-sm text-cpx-grey-500">{offline ? "Not loaded." : "0 PIRs held."}</p>
                )}
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
                        aria-pressed={ticked}
                        title={p.question}
                        className={`inline-flex h-7 min-w-11 items-center justify-center gap-1 rounded-sm border px-2 text-xs tabular-nums transition-colors duration-150 ${
                          ticked
                            ? "border-cpx-green bg-cpx-green-50 font-medium text-cpx-black"
                            : "border-cpx-grey-100 bg-white text-cpx-grey-500 hover:border-cpx-grey-200 hover:text-cpx-black"
                        } ${expandedPir === p.ref ? "ring-1 ring-cpx-green" : ""}`}
                      >
                        {ticked && <IconCheck className="text-green-contrast" />}
                        {p.ref.replace("PIR", "")}
                      </button>
                    );
                  })}
                </div>
                {expandedPir && (
                  <div className="reveal mt-3 rounded-sm border border-cpx-grey-100 bg-cpx-grey-50 p-3">
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
        </Panel>
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
            <span className="text-xs font-medium text-cpx-grey-700">Name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-cpx-grey-700">Sector</span>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className={fieldClass}
            >
              {["Banking", "Energy", "Transport", "Aviation", "Government", "Telecom"].map(
                (s) => (
                  <option key={s}>{s}</option>
                ),
              )}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-cpx-grey-700">Region</span>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className={fieldClass}
            >
              {["UAE", "GCC", "MENA"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        {error && <Banner className="mt-3">{error}</Banner>}
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
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
          >
            Create
          </Button>
        </div>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 border-b border-cpx-grey-100 pb-3 last:border-b-0 last:pb-0">
      <span className="w-20 shrink-0 pt-1 text-xs font-medium text-cpx-grey-600">
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
      <IconButton label="Add product" size="sm" className="border border-dashed border-cpx-grey-200" onClick={() => setOpen(true)}>
        <IconPlus />
      </IconButton>
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
        aria-label="Product name"
        className="h-6 w-40 rounded-sm border border-cpx-green px-1.5 text-xs focus:outline-none"
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
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-cpx-grey-100 px-3 py-2">
        <SearchBox value={q} onChange={setQ} className="w-full max-w-64" />
        <div className="flex-1" />
        <ListMeta
          shown={rows.length}
          total={deliveries.length}
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
      <div className="overflow-x-auto">
      <table className={`${T_TABLE} table-fixed bg-white text-sm`}>
        <colgroup>
          <col className="w-48" />
          <col className="w-20" />
          <col />
          <col className="w-20" />
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
            <EmptyRow colSpan={5}>
              <span className="font-medium text-cpx-black">0 deliveries</span>
            </EmptyRow>
          )}
          {rows.map((d, i) => (
            <tr key={i} className={T_ROW}>
              <td className={`${T_TD} whitespace-nowrap`}>
                <Link
                  href={`/reports/${encodeURIComponent(d.advisoryRef)}`}
                  className="link-quiet font-mono text-xs"
                >
                  {d.advisoryRef}
                </Link>
              </td>
              <td className={`${T_TD} ${T_NUM}`}>v{d.advisoryVersion}</td>
              <td className={`${T_TD}`}>{d.channel}</td>
              <td className={`${T_TD}`}>
                <TypeBadge label={d.format.toUpperCase()} />
              </td>
              <td className={`${T_TD} whitespace-nowrap text-xs text-cpx-grey-700`}>
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
