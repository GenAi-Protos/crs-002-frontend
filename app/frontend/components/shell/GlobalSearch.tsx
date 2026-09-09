"use client";

// Global search. Find a record that already exists, anywhere in the console.
//
// It is not the IOC Lookup and it is not the Ask box. Lookup checks one
// observable against external providers and leaves the region to do it; Ask
// puts a question to the corpus. This finds what we already hold and takes you
// to it, and nothing it does causes a query to leave the region.
//
// The panel draws hits. It does not decide what anyone may see: by the time a
// group reaches here the search layer has already removed what the role may not
// receive and counted it.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConsoleUser } from "@/lib/role-context";
import { canSee } from "@/lib/access";
import {
  clearRecent,
  countsFor,
  loadCorpus,
  pushRecent,
  readRecent,
  runSearch,
} from "@/lib/search/service";
import {
  FILTERS,
  type SearchCorpus,
  type SearchFilter,
  type SearchHit,
} from "@/lib/search/types";
import { IconSearch } from "@/components/icons";
import { buttonClass } from "@/components/ui";

const FILTER_LABEL: Record<SearchFilter, string> = {
  all: "All",
  intelligence: "Intelligence",
  reports: "Reports",
  investigations: "Investigations",
  campaigns: "Campaigns",
  pirs: "PIRs",
};

export function GlobalSearch() {
  const { user } = useConsoleUser();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<SearchFilter>("all");
  const [corpus, setCorpus] = useState<SearchCorpus | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);

  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The corpus loads once, on first open. Searching is then local and
  // instant; nothing is fetched per keystroke.
  useEffect(() => {
    if (!open || corpus) return;
    let live = true;
    loadCorpus(user).then((r) => {
      if (live) setCorpus(r.corpus);
    });
    return () => {
      live = false;
    };
  }, [open, corpus, user]);

  // A change of role changes what may be found, so the corpus is rebuilt.
  useEffect(() => {
    setCorpus(null);
  }, [user.id, user.role]);

  useEffect(() => {
    if (open) setRecent(readRecent());
  }, [open]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const result = useMemo(
    () => (corpus ? runSearch(corpus, user.role, q, filter) : null),
    [corpus, user.role, q, filter],
  );

  const counts = useMemo(
    () => (corpus && q.trim().length >= 2 ? countsFor(corpus, user.role, q) : null),
    [corpus, user.role, q],
  );

  // One flat list behind the groups, so the arrow keys move through what is
  // on screen rather than through a structure.
  const flat: SearchHit[] = useMemo(
    () => (result ? result.groups.flatMap((g) => g.hits) : []),
    [result],
  );

  useEffect(() => {
    setCursor(0);
  }, [q, filter]);

  const go = useCallback(
    (href: string, query: string) => {
      setRecent(pushRecent(query));
      setOpen(false);
      setQ("");
      router.push(href);
    },
    [router],
  );

  const askInstead = canSee(user.role, "intelligence");

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = flat[cursor];
      if (hit) go(hit.href, q);
      else if (askInstead && q.trim())
        go(`/intelligence?q=${encodeURIComponent(q.trim())}`, q);
    }
  };

  return (
    <div ref={boxRef} className="relative hidden md:block">
      <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search records"
        aria-label="Search records across the console"
        role="combobox"
        aria-expanded={open}
        aria-controls="global-search-results"
        className="h-8 w-64 border border-white/20 bg-white/10 pl-8 pr-3 text-sm text-white placeholder:text-white/50 focus:border-cpx-green focus:outline-none xl:w-80"
      />

      {open && (
        <div
          id="global-search-results"
          className="absolute right-0 top-10 z-50 max-h-[70vh] w-[38rem] overflow-y-auto border border-black/15 bg-white text-cpx-black shadow-pop"
        >
          {/* Filters stay visible while typing: the counts are the fastest way
              to see where a match actually lives. */}
          <div className="sticky top-0 flex flex-wrap items-center gap-1 border-b border-black/10 bg-white px-3 py-2">
            {FILTERS.map((f) => {
              const n = counts?.[f];
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex items-center gap-1 border px-2 py-0.5 text-xs ${
                    filter === f
                      ? "border-cpx-purple bg-cpx-purple text-white"
                      : "border-black/15 hover:bg-black/5"
                  }`}
                >
                  {FILTER_LABEL[f]}
                  {n !== undefined && n > 0 && (
                    <span
                      className={filter === f ? "text-white/70" : "text-cpx-grey"}
                    >
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {q.trim().length < 2 ? (
            <Recent
              items={recent}
              onPick={(r) => {
                setQ(r);
                inputRef.current?.focus();
              }}
              onClear={() => setRecent(clearRecent())}
            />
          ) : !corpus ? (
            <p className="px-3 py-6 text-center text-xs text-cpx-grey">
              Loading records
            </p>
          ) : result && result.total > 0 ? (
            <>
              {result.groups.map((group) => (
                <section key={group.category}>
                  <h3 className="border-b border-black/[0.06] bg-band px-3 py-1.5 text-2xs font-medium uppercase tracking-[0.06em] text-cpx-grey">
                    {group.label}
                  </h3>
                  <ul>
                    {group.hits.map((hit) => {
                      const index = flat.indexOf(hit);
                      return (
                        <li key={hit.id}>
                          <button
                            onMouseEnter={() => setCursor(index)}
                            onClick={() => go(hit.href, q)}
                            className={`flex w-full items-start gap-2 border-b border-black/[0.06] px-3 py-2 text-left ${
                              index === cursor ? "bg-black/[0.04]" : "hover:bg-black/[0.02]"
                            }`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-baseline gap-2">
                                <span
                                  className={hit.mono ? "break-all font-mono text-xs" : "text-sm"}
                                >
                                  {hit.title}
                                </span>
                                {hit.badge && (
                                  <span className="rounded-[2px] bg-black/[0.06] px-1.5 text-2xs text-cpx-grey">
                                    {hit.badge}
                                  </span>
                                )}
                                {hit.related && (
                                  <span className="rounded-[2px] bg-black/[0.06] px-1.5 text-2xs text-cpx-grey">
                                    related
                                  </span>
                                )}
                              </span>
                              {/* Why it matched. Without this a result list is
                                  a guess the reader has to check. */}
                              <span className="mt-0.5 block text-2xs leading-snug text-cpx-grey">
                                {hit.context}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {group.more > 0 && (
                    <p className="border-b border-black/[0.06] px-3 py-1.5 text-2xs text-cpx-grey">
                      {group.more} more in {group.label}. Narrow the search or open
                      the destination.
                    </p>
                  )}
                </section>
              ))}
              <Footer
                result={result}
                askInstead={askInstead}
                onAsk={() => go(`/intelligence?q=${encodeURIComponent(q.trim())}`, q)}
              />
            </>
          ) : (
            <div className="px-3 py-5">
              <p className="text-sm">
                <span className="font-medium">0 results</span> for {q.trim()}
              </p>
              {/* A zero here means we hold nothing that matches, never that the
                  observable is clean. */}
              <p className="mt-1 text-2xs text-cpx-grey">
                Nothing held matches. This is a statement about our records, not
                about the value.
              </p>
              {result && result.withheld > 0 && (
                <p className="mt-1 text-2xs text-cpx-grey">
                  {result.withheld} withheld at this access level.
                </p>
              )}
              {askInstead && (
                <button
                  onClick={() =>
                    go(`/intelligence?q=${encodeURIComponent(q.trim())}`, q)
                  }
                  className={buttonClass("secondary", "sm", "mt-3")}
                >
                  Ask Nestor about {q.trim()}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Recent({
  items,
  onPick,
  onClear,
}: {
  items: string[];
  onPick: (q: string) => void;
  onClear: () => void;
}) {
  if (items.length === 0) {
    return (
      <p className="px-3 py-5 text-xs text-cpx-grey">
        Search an address, domain, hash, malware family, threat actor, campaign,
        report reference or PIR.
      </p>
    );
  }
  return (
    <div>
      <div className="flex items-center justify-between border-b border-black/[0.06] bg-band px-3 py-1.5">
        <h3 className="text-2xs font-medium uppercase tracking-[0.06em] text-cpx-grey">
          Recent searches
        </h3>
        <button
          onClick={onClear}
          className="text-2xs text-cpx-grey hover:text-cpx-black"
        >
          Clear
        </button>
      </div>
      <ul>
        {items.map((r) => (
          <li key={r}>
            <button
              onClick={() => onPick(r)}
              className="block w-full border-b border-black/[0.06] px-3 py-2 text-left text-xs hover:bg-black/[0.02]"
            >
              {r}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Footer({
  result,
  askInstead,
  onAsk,
}: {
  result: { total: number; withheld: number; query: string };
  askInstead: boolean;
  onAsk: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-2xs text-cpx-grey">
      <span>
        {result.total} {result.total === 1 ? "record" : "records"} held
        {result.withheld > 0 && (
          <> · {result.withheld} withheld at this access level</>
        )}
      </span>
      {askInstead && (
        <button onClick={onAsk} className="underline underline-offset-2 hover:text-cpx-black">
          Ask Nestor instead
        </button>
      )}
    </div>
  );
}
