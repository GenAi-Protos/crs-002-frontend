"use client";

// The composer and the scrollback. Layout benchmark: the Anomali Copilot
// screenshots CPX sent. Session history is a popover, not a rail: the
// conversation stays the whole page.
//
// Two sections, because they are two jobs. Ask puts a question to the held
// corpus. IOC Lookup checks one observable and leaves the region to do it.
// Mixing them put an egress control inside the reading flow, which is the one
// place it should never be.

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useConsoleUser } from "@/lib/role-context";
import { canSee } from "@/lib/access";
// lib/turn, not lib/ask: the resolver there imports the fixture set, and this
// page only needs to open a turn.
import { makeTurn, STARTER_PROMPTS } from "@/lib/turn";
import type { Advisory, Client, Investigation, PirHit, Turn, Workflow } from "@/lib/types";
import { askIntelligence, getDashboardData, getInvestigations, getReports, isUnreachable } from "@/lib/api";
import { TurnView, type TurnRequest } from "@/components/intelligence/AnswerCard";
import { EntityDrawer } from "@/components/intelligence/EntityDrawer";
import { WORKFLOWS } from "@/lib/fixtures";
import { DEFAULT_ASK_OPTIONS, optionsAreDefault, type AskOptions } from "@/lib/ask-options";
import { AskOptionsBar } from "@/components/intelligence/AskOptionsBar";
import { LookupPanel } from "@/components/intelligence/LookupPanel";
import { gstDate } from "@/lib/format";
import { IconChevronDown, IconPlus, IconSend } from "@/components/icons";
import Link from "next/link";
import { PageHeader, buttonClass, useDismiss, OfflineNote } from "@/components/ui";
import { EvidenceUploader, evidencePending } from "@/components/evidence/EvidenceUploader";
import { AddToCase } from "@/components/investigations/AddToCase";
import { getEvidence, workspaceRequest } from "@/lib/workspace-api";
import type { EvidenceFile } from "@/lib/workspace-types";

interface StoredSession {
  id: string;
  title: string;
  turns: Turn[];
}

const SESSIONS_KEY = "nestor-intel-sessions";

function readSessions(userId: string): StoredSession[] {
  try {
    return JSON.parse(sessionStorage.getItem(`${SESSIONS_KEY}:${userId}`) ?? "[]");
  } catch {
    return [];
  }
}

function writeSessions(userId: string, s: StoredSession[]) {
  sessionStorage.setItem(`${SESSIONS_KEY}:${userId}`, JSON.stringify(s));
}

function IntelligenceInner() {
  const { user } = useConsoleUser();
  const params = useSearchParams();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<EvidenceFile[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [allowPartial, setAllowPartial] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [turnFiles, setTurnFiles] = useState<Record<string, EvidenceFile[]>>({});
  const [entity, setEntity] = useState<{ id: string; name: string; type: string } | null>(null);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [hits, setHits] = useState<PirHit[]>([]);
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [section, setSection] = useState<"ask" | "lookup">(
    params.get("lookup") ? "lookup" : "ask",
  );
  const [options, setOptions] = useState<AskOptions>(DEFAULT_ASK_OPTIONS);
  const [clients, setClients] = useState<Client[]>([]);
  const [workflows] = useState<Workflow[]>(WORKFLOWS);
  const [workflowAvailability, setWorkflowAvailability] = useState<{ ref: string; available: boolean; mode: string; reason?: string | null }[]>([]);
  useEffect(() => {
    let active = true;
    workspaceRequest<{ items: typeof workflowAvailability }>(user.id, "/intelligence/workflows").then((result) => { if (active) setWorkflowAvailability(result.items); }).catch(() => { if (active) setWorkflowAvailability([]); });
    return () => { active = false; };
  }, [user.id]);
  const endRef = useRef<HTMLDivElement>(null);
  const seededRef = useRef<string | null>(null);
  // What each turn asked for, keyed by turn id (the local id and, once the
  // backend has answered, its id too). Only a turn asked in this session has
  // an entry, so a stored conversation never claims a workflow it cannot know.
  const [requests, setRequests] = useState<Record<string, TurnRequest>>({});
  // One controller per in-flight ask, so Stop ends exactly that request.
  const controllers = useRef(new Map<string, AbortController>());
  // The history popover is non-modal: the page stays live behind it. Escape or a
  // click outside the header row closes it.
  const [offline, setOffline] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const closeHistory = useCallback(() => setHistoryOpen(false), []);
  useDismiss(headerRef, closeHistory, historyOpen);

  useEffect(() => {
    let active = true;
    const missing = turns.filter((turn) => turn.attachmentIds?.length && turnFiles[turn.id]?.length !== turn.attachmentIds.length);
    missing.forEach((turn) => Promise.all((turn.attachmentIds ?? []).map((id) => getEvidence(user.id, id))).then((files) => active && setTurnFiles((previous) => ({ ...previous, [turn.id]: files }))).catch(() => undefined));
    return () => { active = false; };
  }, [turns, turnFiles, user.id]);

  useEffect(() => {
    let active = true;
    controllers.current.forEach((controller) => controller.abort());
    setSessions(readSessions(user.id)); setTurns([]); setSessionId(null); setAttachments([]); setTurnFiles({}); setDraft(""); setAskError(null); setInvestigations([]); setRequests({});
    Promise.all([getInvestigations(user.id), getDashboardData(user.id), getReports(user.id)])
      .then(([items, data, reports]) => { if (active) { setInvestigations(items); setHits(data.hits); setAdvisories(reports); setClients(data.clients); setOffline(false); } })
      .catch((e) => { if (active) { setInvestigations([]); setOffline(isUnreachable(e)); } });
    return () => { active = false; };
  }, [user.id]);

  // The dashboard's Draft advisory action and the top bar search land here.
  // Keyed by the param value so a second navigation seeds again.
  useEffect(() => {
    const q = params.get("q") ?? params.get("prompt");
    const hitId = params.get("draft");
    // ?lookup= opens the IOC Lookup instead of seeding the composer.
    if (params.get("lookup")) return;
    const key = hitId ? `draft:${hitId}` : q ? `q:${q}` : null;
    if (!key || seededRef.current === key) return;
    if (hitId) {
      const hit = hits.find((h) => h.id === hitId);
      if (hit) {
        seededRef.current = key;
        setDraft(`Create an intelligence advisory for ${hit.title}`);
      }
    } else if (q) {
      seededRef.current = key;
      setDraft(q);
    }
  }, [params, hits]);

  useEffect(() => {
    // No behaviour option: the scroll region carries scroll-smooth in CSS, so
    // prefers-reduced-motion can turn it off (a JS "smooth" cannot be).
    endRef.current?.scrollIntoView();
  }, [turns]);

  // Every completed exchange lands in the session store, so History is
  // always current without a save control.
  const persist = useCallback(
    (id: string, title: string, nextTurns: Turn[]) => {
      const all = readSessions(user.id);
      const existing = all.find((s) => s.id === id);
      let next: StoredSession[];
      if (existing) {
        next = all.map((s) => (s.id === id ? { ...s, turns: nextTurns } : s));
      } else {
        next = [{ id, title, turns: nextTurns }, ...all];
      }
      writeSessions(user.id, next);
      setSessions(next);
    },
    [user.id],
  );

  if (!canSee(user.role, "intelligence")) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <p className="text-base">Not permitted at this access level.</p>
        <Link href="/" className="text-sm text-link underline underline-offset-2">
          Dashboard
        </Link>
      </div>
    );
  }

  const ask = (question: string, files = attachments) => {
    if (uploadBusy || evidencePending(files) || files.some((f) => f.status === "failed") || (files.some((f) => f.status === "partial") && !allowPartial)) {
      setAskError("Wait for processing, remove failed files, or accept partial extraction.");
      return;
    }
    setAskError(null);
    const turn = makeTurn(question);
    turn.attachmentIds = files.map((f) => f.id);
    setTurnFiles((previous) => ({ ...previous, [turn.id]: files }));
    const id = sessionId ?? `s-${Date.now().toString(36)}`;
    const title =
      sessions.find((s) => s.id === id)?.title ??
      investigations.find((i) => i.id === id)?.title ??
      question.replace(/[?.]+$/, "").slice(0, 64);
    if (!sessionId) setSessionId(id);
    const request: TurnRequest = {
      clientId: options.clientId,
      workflow: options.workflow
        ? (workflows.find((w) => w.ref === options.workflow)?.name ?? options.workflow)
        : null,
    };
    setRequests((r) => ({ ...r, [turn.id]: request }));
    const controller = new AbortController();
    controllers.current.set(turn.id, controller);
    setTurns((t) => [...t, turn]);
    setDraft("");
    setAttachments([]);
    askIntelligence(user.id, question, sessionId ?? undefined, options, controller.signal, files.map((f) => f.id), allowPartial)
      .then(({ investigationId, turn: backendTurn }) => {
        setTurnFiles((previous) => ({ ...previous, [backendTurn.id]: files }));
        setRequests((r) => ({ ...r, [backendTurn.id]: request }));
        setTurns((t) => {
          // The user may have switched sessions while the answer was pending;
          // only complete and persist if this turn is still on screen.
          if (!t.some((x) => x.id === turn.id)) return t;
          const next = t.map((x) =>
            x.id === turn.id ? backendTurn : x,
          );
          // Never persist an incomplete turn: an unmounted timeout would leave
          // an eternal skeleton in the stored session.
          setSessionId(investigationId);
          persist(investigationId, title, next.filter((x) => x.status === "complete"));
          return next;
        });
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setAskError(error.message);
        setTurns((t) =>
          t.map((x) =>
            x.id === turn.id
              ? { ...x, status: controller.signal.aborted ? "stopped" : "failed" }
              : x,
          ),
        );
      })
      .finally(() => controllers.current.delete(turn.id));
  };

  const stop = (turnId: string) => controllers.current.get(turnId)?.abort();

  // A failed or stopped turn is asked again in its place: the record of the
  // failure is replaced by the new attempt, not stacked under it.
  const retry = (t: Turn) => {
    setTurns((ts) => ts.filter((x) => x.id !== t.id));
    ask(t.question, turnFiles[t.id] ?? []);
  };

  const newSession = () => {
    setTurns([]);
    setSessionId(null);
    setDraft("");
    setAttachments([]);
    setAskError(null);
    setHistoryOpen(false);
  };

  const openStored = (s: StoredSession) => {
    setTurns(s.turns.filter((t) => t.status === "complete" && t.answer));
    setSessionId(s.id);
    setHistoryOpen(false);
  };

  const openInvestigation = (invId: string) => {
    const inv = investigations.find((i) => i.id === invId);
    if (!inv) return;
    // A fixture conversation forks into a local session lazily, on the first
    // ask, so "Continued" only appears after an actual continuation.
    const id = inv.id;
    const stored = sessions.find((s) => s.id === id);
    setTurns(stored ? stored.turns : inv.turns);
    setSessionId(id);
    setHistoryOpen(false);
  };

  const localOnly = sessions.filter((s) => !s.id.startsWith("fx-"));
  const forked = new Set(sessions.map((s) => s.id));

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-1 flex-col px-6">
      <PageHeader
        className="pt-4"
        title="Intelligence"
        meta={offline ? <OfflineNote /> : undefined}
        action={
          <div ref={headerRef} className="relative flex items-center gap-1">
        {/* Two jobs, two sections. Neither replaces the other. */}
        <div className="flex border border-cpx-grey-100">
          {(["ask", "lookup"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setSection(k)}
              className={`h-7 px-3 text-xs ${
                section === k
                  ? "bg-cpx-purple font-medium text-white"
                  : "text-cpx-grey-500 hover:bg-cpx-grey-50"
              }`}
            >
              {k === "ask" ? "Ask" : "IOC Lookup"}
            </button>
          ))}
        </div>
        <button
          onClick={() => setHistoryOpen(!historyOpen)}
          disabled={section !== "ask"}
          className={buttonClass("ghost", "sm")}
        >
          History
          <span className="bg-cpx-grey-50 px-1 text-2xs">
            {localOnly.length + investigations.length}
          </span>
          <IconChevronDown className={historyOpen ? "rotate-180" : ""} />
        </button>
        <button
          onClick={newSession}
          disabled={section !== "ask"}
          className={buttonClass("ghost", "sm")}
        >
          <IconPlus />
          New
        </button>
        {historyOpen && (
          <>
            <div className="reveal absolute right-0 top-9 z-40 w-96 max-w-full border border-cpx-grey-100 bg-white shadow-pop">
              <ul className="max-h-80 overflow-y-auto">
                {localOnly.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => openStored(s)}
                      className={`flex w-full items-baseline gap-2 px-3 py-2 text-left hover:bg-cpx-grey-50 ${s.id === sessionId ? "bg-cpx-grey-50" : ""}`}
                    >
                      <span
                        className="min-w-0 flex-1 truncate text-xs"
                        title={s.title}
                      >
                        {s.title}
                      </span>
                      <span className="shrink-0 text-2xs text-cpx-grey-500">
                        This session
                      </span>
                    </button>
                  </li>
                ))}
                {investigations.map((inv) => (
                  <li key={inv.id}>
                    <button
                      onClick={() => openInvestigation(inv.id)}
                      className={`flex w-full items-baseline gap-2 px-3 py-2 text-left hover:bg-cpx-grey-50 ${sessionId === `fx-${inv.id}` ? "bg-cpx-grey-50" : ""}`}
                    >
                      <span
                        className="min-w-0 flex-1 truncate text-xs"
                        title={inv.title}
                      >
                        {inv.title}
                      </span>
                      <span className="shrink-0 text-2xs text-cpx-grey-500">
                        {forked.has(`fx-${inv.id}`)
                          ? "Continued"
                          : gstDate(inv.createdAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
          </div>
        }
      />

      {section === "lookup" && (
        <LookupPanel initial={params.get("lookup") ?? undefined} />
      )}

      {section === "ask" && (
        <>
      <div className="flex flex-1 flex-col space-y-8 py-6">
        {turns.length === 0 && (
          // Centred in the space above the composer: an empty console that
          // stacks its openers against the bottom edge reads as a broken feed.
          <div className="flex flex-1 flex-col justify-end gap-2 pb-2">
            {STARTER_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => ask(p)}
                className="border border-cpx-grey-100 bg-white px-4 py-2.5 text-left text-sm transition-colors duration-150 hover:border-cpx-green"
              >
                {p}
              </button>
            ))}
          </div>
        )}
        {turns.map((t) => (
          <div key={t.id} className="space-y-3">
          <TurnView
            turn={t}
            request={requests[t.id]}
            onStop={t.status === "streaming" ? () => stop(t.id) : undefined}
            onRetry={
              t.status === "failed" || t.status === "stopped" ? () => retry(t) : undefined
            }
            onEntity={(id, entities) =>
              setEntity(entities.find((e) => e.id === id) ?? null)
            }
          />
          {!!turnFiles[t.id]?.length && <p className="text-xs text-cpx-grey-500">Attached: {turnFiles[t.id].map((f) => f.fileName).join(", ")}</p>}
          {t.status === "complete" && sessionId && <AddToCase title={t.question} conversationId={sessionId} turnId={t.id} runId={t.answer?.runId} files={turnFiles[t.id] ?? []} clientId={requests[t.id]?.clientId} />}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 bg-canvas pb-6 pt-2">
        <form
          className="border border-cpx-grey-100 bg-white"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) ask(draft.trim());
          }}
        >
          {/* The controls sit above the question, because they are read before
              it is written, not after. */}
          <AskOptionsBar
            options={options}
            onChange={setOptions}
            clients={clients}
            workflows={workflows}
            availability={workflowAvailability}
          />
          <div className="border-b border-cpx-grey-100 px-4 py-3">
            <EvidenceUploader value={attachments} onChange={setAttachments} tlp={options.tlpCeiling ?? "AMBER"} clientId={options.clientId} onBusy={setUploadBusy} />
            {attachments.some((f) => f.status === "partial") && <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={allowPartial} onChange={(e) => setAllowPartial(e.target.checked)} />Use extracted portions and show coverage gaps</label>}
          </div>
          <div className="flex items-center gap-2 pl-4 pr-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask a question"
              aria-label="Question"
              className="h-12 flex-1 bg-transparent text-base focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={!draft.trim() || uploadBusy || evidencePending(attachments) || attachments.some((f) => f.status === "failed") || (attachments.some((f) => f.status === "partial") && !allowPartial)}
              className="flex h-9 w-9 items-center justify-center bg-cpx-green text-cpx-black disabled:bg-cpx-grey-50 disabled:text-cpx-grey-400"
            >
              <IconSend />
            </button>
          </div>
        </form>
        {askError && <p role="alert" className="mt-2 text-xs text-cpx-red-700">{askError}</p>}
        {!optionsAreDefault(options) && (
          <p className="mt-1.5 text-2xs text-cpx-grey-500">
            These settings are sent with the question and change the answer. They
            do not filter what is already on screen.
          </p>
        )}
      </div>
        </>
      )}

      <EntityDrawer entity={entity} hits={hits} advisories={advisories} onClose={() => setEntity(null)} />
    </div>
  );
}

export default function IntelligencePage() {
  return (
    <Suspense>
      <IntelligenceInner />
    </Suspense>
  );
}
