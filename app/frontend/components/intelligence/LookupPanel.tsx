"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useConsoleUser } from "@/lib/role-context";
import { workspaceWrite } from "@/lib/workspace-api";
import type { ProviderVerdict, Tlp } from "@/lib/types";
import { gstDateTime } from "@/lib/format";
import { IndicatorChip, StatusPill, TlpBadge, Button, SkeletonRows } from "@/components/ui";
import { IconEgress, IconSearch } from "@/components/icons";
import { AddToCase } from "@/components/investigations/AddToCase";
import { defang } from "@/lib/defang";

interface LookupResult {
  observable: string;
  reputation: { mode: string; results: ProviderVerdict[] };
  matches: { id: string; title: string; excerpt: string; source: string; tlp: Tlp; observedAt: string }[];
  cases: { id: string; title: string; status: string }[];
  coverage: { repositoryMatches: number; relatedCases: number };
}

export function LookupPanel({ initial }: { initial?: string } = {}) {
  const { user } = useConsoleUser();
  const [input, setInput] = useState(initial ?? "");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setInput(initial ?? ""); setResult(null); setError(null); }, [initial, user.id]);

  async function run() {
    setPending(true); setResult(null); setError(null);
    try { setResult(await workspaceWrite<LookupResult>(user.id, "/intelligence/lookup", { observable: input.trim() })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The lookup could not be completed. Retry."); }
    finally { setPending(false); }
  }

  return <div className="space-y-5 py-6">
    <form onSubmit={(event) => { event.preventDefault(); if (input.trim()) void run(); }}>
      <label htmlFor="observable" className="mb-2 block text-xs font-medium">IP address, domain or file hash</label>
      <div className="flex items-center gap-3 border border-cpx-grey-100 bg-white p-2 pl-3"><IconSearch className="shrink-0 text-cpx-grey-500" /><input id="observable" value={input} onChange={(event) => setInput(event.target.value)} className="h-8 min-w-0 flex-1 bg-transparent font-mono text-sm focus:outline-none" placeholder="IP address, domain, MD5, SHA-1 or SHA-256" required /><Button type="submit" variant="primary" disabled={pending || !input.trim()}>{pending ? "Checking…" : "Check"}</Button></div>
      <p className="mt-2 flex items-center gap-2 text-2xs text-cpx-grey-500"><IconEgress />Checks the accessible repository and configured reputation providers. External provider calls may leave the UAE region and are recorded.</p>
    </form>
    {error && <p role="alert" className="border border-cpx-grey-100 bg-status-warn-fill p-3 text-sm text-status-warn-ink">{error}</p>}
    {pending && <SkeletonRows rows={4} />}
    {result && <>
      <div className="flex flex-wrap items-center justify-between gap-4 border-y border-cpx-grey-100 py-4"><div><IndicatorChip value={result.observable} /><p className="mt-2 text-xs text-cpx-grey-500">{result.coverage.repositoryMatches} repository matches · {result.coverage.relatedCases} related investigations</p></div><AddToCase title={`Investigate ${defang(result.observable)}`} lookup={{ observable: result.observable, results: result.reputation.results, mode: result.reputation.mode, matches: result.matches, coverage: result.coverage }} /></div>
      {result.reputation.mode !== "LIVE" && <p className="bg-status-warn-fill p-3 text-xs text-status-warn-ink">{result.reputation.mode === "LOCAL" ? "External reputation was not requested for this private, reserved or internal address. Repository results are shown below." : `Reputation providers are in ${result.reputation.mode.toLowerCase()} mode. Provider results marked mock are demonstration responses.`}</p>}
      <section><h3 className="mb-3 text-md font-semibold">Reputation providers</h3><div className="grid gap-3 sm:grid-cols-3">{result.reputation.results.map((provider) => <div key={provider.provider} className="border border-cpx-grey-100 p-4"><div className="flex items-center justify-between gap-2"><h4 className="text-sm font-medium">{provider.provider}</h4><StatusPill tone={provider.status === "live" ? "good" : provider.status === "failed" ? "critical" : "warn"} label={provider.status.replaceAll("-", " ")} /></div><p className="mt-3 text-sm">{provider.verdict ?? "No verdict returned"}{provider.score !== null && provider.score !== undefined ? ` · Score ${provider.score}` : ""}</p>{provider.categories?.length > 0 && <p className="mt-2 text-xs text-cpx-grey-500">{provider.categories.join(", ")}</p>}{provider.error && <p className="mt-2 text-xs text-status-warn-ink">{provider.error}</p>}{provider.checkedAt && <p className="mt-2 text-2xs text-cpx-grey-500">{gstDateTime(provider.checkedAt)}</p>}</div>)}</div>{!result.reputation.results.length && <p className="text-sm">0 provider responses. Repository coverage is shown below.</p>}</section>
      <section><h3 className="mb-3 text-md font-semibold">Repository evidence</h3>{!result.matches.length && <p className="text-sm">0 accessible matches. A missing record does not establish that an observable is benign.</p>}<div className="divide-y divide-cpx-grey-100">{result.matches.map((match) => <article key={match.id} className="py-4"><div className="flex items-start justify-between gap-3"><h4 className="text-sm font-medium">{match.title}</h4><TlpBadge tlp={match.tlp} /></div><p className="mt-2 whitespace-pre-wrap text-sm">{defang(match.excerpt)}</p><p className="mt-2 text-2xs text-cpx-grey-500">{match.source} · {match.id}{match.observedAt ? ` · ${gstDateTime(match.observedAt)}` : ""}</p></article>)}</div></section>
      <section><h3 className="mb-3 text-md font-semibold">Related investigations</h3><ul className="space-y-2">{result.cases.map((item) => <li key={item.id} className="flex items-center gap-3 text-sm"><Link href={`/investigations/${encodeURIComponent(item.id)}`} className="text-link underline">{item.title}</Link><span className="text-xs text-cpx-grey-500">{item.status.replaceAll("-", " ")}</span></li>)}</ul>{!result.cases.length && <p className="text-sm">0 related investigations.</p>}</section>
    </>}
  </div>;
}
