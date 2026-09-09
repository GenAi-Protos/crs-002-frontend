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
import { makeTurn, STARTER_PROMPTS } from "@/lib/ask";
import type { Advisory, Client, Investigation, PirHit, Turn, Workflow } from "@/lib/types";
import { askIntelligence, getDashboardData, getInvestigations, getReports } from "@/lib/api";
import { TurnView } from "@/components/intelligence/AnswerCard";
import { EntityDrawer } from "@/components/intelligence/EntityDrawer";
import { INVESTIGATIONS as FALLBACK_INVESTIGATIONS, WORKFLOWS } from "@/lib/fixtures";
import { DEFAULT_ASK_OPTIONS, optionsAreDefault, type AskOptions } from "@/lib/ask-options";
import { AskOptionsBar } from "@/components/intelligence/AskOptionsBar";
import { LookupPanel } from "@/components/intelligence/LookupPanel";
import { gstDate } from "@/lib/format";
import { IconChevronDown, IconPlus, IconSend } from "@/components/icons";
import Link from "next/link";

interface StoredSession {
  id: string;
  title: string;
  turns: Turn[];
}

const SESSIONS_KEY = "nestor-intel-sessions";

function readSessions(): StoredSession[] {
  try {
    return JSON.parse(sessionStorage.getItem(SESSIONS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeSessions(s: StoredSession[]) {
  sessionStorage.setItem(SESSIONS_KEY, JSON.stringify(s));
}

function IntelligenceInner() {
  const { user } = useConsoleUser();
  const params = useSearchParams();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [draft, setDraft] = useState("");
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
  const endRef = useRef<HTMLDivElement>(null);
  const seededRef = useRef<string | null>(null);

  useEffect(() => {
    setSessions(readSessions());
    Promise.all([getInvestigations(user.id), getDashboardData(user.id), getReports(user.id)])
      .then(([items, data, reports]) => { setInvestigations(items); setHits(data.hits); setAdvisories(reports); setClients(data.clients); })
      .catch(() => { setInvestigations(FALLBACK_INVESTIGATIONS); });
  }, [user.id]);

  // The dashboard's Draft advisory action and the top bar search land here.
  // Keyed by the param value so a second navigation seeds again.
  useEffect(() => {
    const q = params.get("q");
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
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  // Every completed exchange lands in the session store, so History is
  // always current without a save control.
  const persist = useCallback(
    (id: string, title: string, nextTurns: Turn[]) => {
      const all = readSessions();
      const existing = all.find((s) => s.id === id);
      let next: StoredSession[];
      if (existing) {
        next = all.map((s) => (s.id === id ? { ...s, turns: nextTurns } : s));
      } else {
        next = [{ id, title, turns: nextTurns }, ...all];
      }
      writeSessions(next);
      setSessions(next);
    },
    [],
  );

  if (!canSee(user.role, "intelligence")) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <p className="text-[14px] font-light">Not permitted at this access level.</p>
        <Link href="/" className="text-[13px] text-cat-4 underline underline-offset-2">
          Dashboard
        </Link>
      </div>
    );
  }

  const ask = (question: string) => {
    const turn = makeTurn(question);
    const id = sessionId ?? `s-${Date.now().toString(36)}`;
    const title =
      sessions.find((s) => s.id === id)?.title ??
      investigations.find((i) => i.id === id)?.title ??
      question.replace(/[?.]+$/, "").slice(0, 64);
    if (!sessionId) setSessionId(id);
    setTurns((t) => [...t, turn]);
    setDraft("");
    askIntelligence(user.id, question, sessionId ?? undefined, options).then(({ investigationId, turn: backendTurn }) => {
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
    }).catch(() => setTurns((t) => t.map((x) => x.id === turn.id ? { ...x, status: "failed" } : x)));
  };

  const newSession = () => {
    setTurns([]);
    setSessionId(null);
    setDraft("");
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
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-[880px] flex-col px-6">
      <div className="relative flex items-center gap-1 pt-4">
        {/* Two jobs, two sections. Neither replaces the other. */}
        <div className="flex border border-black/10">
          {(["ask", "lookup"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setSection(k)}
              className={`h-7 px-3 text-[12.5px] ${
                section === k
                  ? "bg-cpx-purple font-medium text-white"
                  : "font-light text-cpx-grey hover:bg-black/5"
              }`}
            >
              {k === "ask" ? "Ask" : "IOC Lookup"}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setHistoryOpen(!historyOpen)}
          disabled={section !== "ask"}
          className="flex h-7 items-center gap-1.5 px-2 text-[12px] font-light text-cpx-grey hover:bg-black/5 disabled:text-black/25 disabled:hover:bg-transparent"
        >
          History
          <span className="bg-black/5 px-1 text-[11px]">
            {localOnly.length + investigations.length}
          </span>
          <IconChevronDown className={historyOpen ? "rotate-180" : ""} />
        </button>
        <button
          onClick={newSession}
          disabled={section !== "ask"}
          className="flex h-7 items-center gap-1.5 px-2 text-[12px] font-light text-cpx-grey hover:bg-black/5 disabled:text-black/25 disabled:hover:bg-transparent"
        >
          <IconPlus />
          New
        </button>
        {historyOpen && (
          <>
            <button
              aria-label="Close"
              onClick={() => setHistoryOpen(false)}
              className="fixed inset-0 z-30 cursor-default"
            />
            <div className="absolute right-0 top-11 z-40 w-96 max-w-full border border-black/10 bg-white shadow-sm">
              <ul className="max-h-80 overflow-y-auto">
                {localOnly.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => openStored(s)}
                      className={`flex w-full items-baseline gap-2 px-3 py-2 text-left hover:bg-black/[0.03] ${s.id === sessionId ? "bg-black/[0.03]" : ""}`}
                    >
                      <span
                        className="min-w-0 flex-1 truncate text-[12.5px] font-light"
                        title={s.title}
                      >
                        {s.title}
                      </span>
                      <span className="shrink-0 text-[11px] font-light text-cpx-grey">
                        This session
                      </span>
                    </button>
                  </li>
                ))}
                {investigations.map((inv) => (
                  <li key={inv.id}>
                    <button
                      onClick={() => openInvestigation(inv.id)}
                      className={`flex w-full items-baseline gap-2 px-3 py-2 text-left hover:bg-black/[0.03] ${sessionId === `fx-${inv.id}` ? "bg-black/[0.03]" : ""}`}
                    >
                      <span
                        className="min-w-0 flex-1 truncate text-[12.5px] font-light"
                        title={inv.title}
                      >
                        {inv.title}
                      </span>
                      <span className="shrink-0 text-[11px] font-light text-cpx-grey">
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

      {section === "lookup" && (
        <LookupPanel initial={params.get("lookup") ?? undefined} />
      )}

      {section === "ask" && (
        <>
      <div className="flex-1 space-y-8 py-6">
        {turns.length === 0 && (
          <div className="flex min-h-[50vh] flex-col justify-end gap-2">
            {STARTER_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => ask(p)}
                className="border border-black/10 bg-white px-4 py-2.5 text-left text-[13px] font-light hover:border-cpx-purple"
              >
                {p}
              </button>
            ))}
          </div>
        )}
        {turns.map((t) => (
          <TurnView
            key={t.id}
            turn={t}
            onEntity={(id, entities) =>
              setEntity(entities.find((e) => e.id === id) ?? null)
            }
          />
        ))}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 bg-[#fafafa] pb-6 pt-2">
        <form
          className="border border-black/15 bg-white"
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
          />
          <div className="flex items-center gap-2 pl-4 pr-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask a question"
              className="h-12 flex-1 bg-transparent text-[14px] font-light focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={!draft.trim()}
              className="flex h-9 w-9 items-center justify-center bg-cpx-green text-cpx-black disabled:bg-black/5 disabled:text-black/30"
            >
              <IconSend />
            </button>
          </div>
        </form>
        {!optionsAreDefault(options) && (
          <p className="mt-1.5 text-[11px] font-light text-cpx-grey">
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
