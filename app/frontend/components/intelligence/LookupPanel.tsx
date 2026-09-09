"use client";

// IOC Lookup. Its own section inside Intelligence, because checking one
// observable against external providers is a different job from asking the
// corpus a question, and it leaves the UAE region to do it.
//
// Lookup answers "what is this" in one screen. Investigate answers "what is it
// part of" and is a separate view, opened deliberately.
//
// Three rules hold everywhere on this screen. Every observable renders defanged
// and inert. A score never appears without the sentence that explains it. And
// nothing held is not the same as clean: an empty panel is a statement about
// our coverage, not about the observable.

import { useEffect, useState } from "react";
import { useConsoleUser } from "@/lib/role-context";
import { reputationLookup } from "@/lib/api";
import type {
  DomainLookup, HashLookup, IpLookup, LookupRecord, LookupVerdict, ObservableKind, ProviderVerdict, } from "@/lib/types";
import { KIND_LABEL, VERDICT_LABEL, bytes, detectKind, findLookup, hashAlgorithm, kindMismatch, samplesFor } from "@/lib/lookup";
import { gstDate, gstDateTime } from "@/lib/format";
import { IndicatorChip, StatusPill, TlpBadge, type StatusTone, buttonClass } from "@/components/ui";
import { IconEgress, IconSearch } from "@/components/icons";
import {
  CopyButton,
  TypeBadge,
  T_FLUSH,
  T_HEAD,
  T_NUM,
  T_ROW,
  T_TABLE,
  T_TD,
  T_TH,
} from "@/components/table";
import { defang } from "@/lib/defang";
import { InvestigationView } from "./InvestigationView";

const VERDICT_TONE: Record<LookupVerdict, StatusTone> = {
  malicious: "critical",
  suspicious: "warn",
  benign: "good",
  unknown: "idle",
};

const PROVIDER_STATUS: Record<string, { tone: StatusTone; label: string }> = {
  live: { tone: "good", label: "Answered" },
  mock: { tone: "idle", label: "Mock provider" },
  "missing-credentials": { tone: "warn", label: "No credential" },
  "rate-limited": { tone: "warn", label: "Rate limited" },
  timeout: { tone: "warn", label: "Timed out" },
  failed: { tone: "critical", label: "Failed" },
};

const statusOf = (s: string) =>
  PROVIDER_STATUS[s] ?? { tone: "idle" as StatusTone, label: s };

type LiveResult = {
  observable: string;
  mode: string;
  results: ProviderVerdict[];
};

export function LookupPanel({ initial }: { initial?: string } = {}) {
  const { user } = useConsoleUser();
  const [kind, setKind] = useState<ObservableKind>("ip");
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [record, setRecord] = useState<LookupRecord | null>(null);
  const [live, setLive] = useState<LiveResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [investigating, setInvestigating] = useState(false);

  const reset = () => {
    setRecord(null);
    setLive(null);
    setFailure(null);
    setInvestigating(false);
  };

  const run = (raw: string, forKind: ObservableKind) => {
    const observable = raw.trim();
    reset();
    const held = findLookup(observable);
    if (held) {
      setRecord(held);
      return;
    }
    // Nothing held. The providers are still worth asking, and the panel says
    // plainly that no enrichment came with the answer.
    setPending(true);
    reputationLookup(user.id, observable)
      .then((result) => setLive({ ...result, observable } as LiveResult))
      .catch(() =>
        setFailure("The lookup service could not be reached. Nothing was sent."),
      )
      .finally(() => setPending(false));
    void forKind;
  };

  const pick = (value: string) => {
    setInput(value);
    const k = detectKind(value) ?? kind;
    setKind(k);
    run(value, k);
  };

  // Arriving from global search with an observable. It fills the field and
  // shows what is held, and stops there: asking the providers is an egress
  // query and stays a deliberate act, never a side effect of a link.
  useEffect(() => {
    const value = initial?.trim();
    if (!value) return;
    setInput(value);
    const k = detectKind(value);
    if (k) setKind(k);
    setRecord(findLookup(value));
    setLive(null);
    setFailure(null);
    setInvestigating(false);
  }, [initial]);

  const mismatch = input.trim() !== "" && kindMismatch(input, kind);

  if (investigating && record) {
    return (
      <InvestigationView record={record} onBack={() => setInvestigating(false)} />
    );
  }

  return (
    <div className="py-6">
      <form
        className="flex flex-wrap items-stretch gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) run(input, kind);
        }}
      >
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as ObservableKind)}
          className="h-11 border border-black/15 bg-white px-2 text-sm focus:border-cpx-purple focus:outline-none"
        >
          {(["ip", "domain", "hash"] as ObservableKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <div className="flex min-w-[16rem] flex-1 items-center gap-2 border border-black/15 bg-white pl-3 pr-2">
          <IconSearch className="shrink-0 text-cpx-grey" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              kind === "ip"
                ? "198.51.100.47"
                : kind === "domain"
                  ? "fleet-update.example"
                  : "MD5, SHA-1 or SHA-256"
            }
            className="h-11 min-w-0 flex-1 bg-transparent font-mono text-sm focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || pending}
            className={buttonClass("primary")}
          >
            {pending ? "Checking" : "Check"}
          </button>
        </div>
      </form>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-2xs text-cpx-grey">Demo records</span>
        {samplesFor(kind).map((s) => (
          <button
            key={s}
            onClick={() => pick(s)}
            className="bg-black/5 px-1.5 py-0.5 font-mono text-2xs text-cpx-grey hover:bg-black/10"
          >
            {s.length > 28 ? `${s.slice(0, 16)}...${s.slice(-6)}` : s}
          </button>
        ))}
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-2xs text-cpx-grey">
        <IconEgress />
        A lookup sends the observable to the configured providers. It leaves the
        UAE region and is recorded.
      </p>

      {mismatch && (
        <p className="mt-3 border border-black/10 bg-black/[0.02] px-3 py-2 text-xs">
          That value looks like {KIND_LABEL[detectKind(input)!].toLowerCase()} and{" "}
          {KIND_LABEL[kind].toLowerCase()} is selected. The lookup will run as
          selected.
        </p>
      )}

      {failure && (
        <p className="mt-4 border border-black/10 bg-status-warn-fill px-3 py-2 text-xs text-status-warn-ink">
          {failure}
        </p>
      )}

      {record && (
        <Result record={record} onInvestigate={() => setInvestigating(true)} />
      )}

      {live && <NothingHeld live={live} />}

      {!record && !live && !failure && (
        <p className="mt-6 text-xs text-cpx-grey">
          Each provider is asked separately, and one failing does not silence the
          others.
        </p>
      )}
    </div>
  );
}

// --- a held record -----------------------------------------------------------

function Result({
  record,
  onInvestigate,
}: {
  record: LookupRecord;
  onInvestigate: () => void;
}) {
  return (
    <div className="mt-6 space-y-3">
      <Verdict record={record} />
      <Providers providers={record.providers} />
      {record.kind === "ip" && <IpDetail record={record} />}
      {record.kind === "domain" && <DomainDetail record={record} />}
      {record.kind === "hash" && <HashDetail record={record} />}

      <div className="border border-black/10 bg-white p-4">
        <button
          onClick={onInvestigate}
          className="h-9 bg-cpx-purple px-4 text-sm font-medium text-white hover:brightness-110"
        >
          Investigate
        </button>
        <p className="mt-2 text-2xs text-cpx-grey">
          Lookup is the check on this observable. Investigate is what it is part
          of: infrastructure, malware, actor, campaign, techniques and the
          detection content that covers them.
        </p>
      </div>
    </div>
  );
}

function Verdict({ record }: { record: LookupRecord }) {
  return (
    <section className="border border-black/10 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <IndicatorChip value={record.observable} />
            {/* Copies the defanged form, which is the form on screen. */}
            <CopyButton
              value={defang(record.observable)}
              what="observable as shown"
            />
            <TypeBadge
              label={
                record.kind === "hash"
                  ? hashAlgorithm(record.observable)
                  : KIND_LABEL[record.kind]
              }
            />
          </div>
          {/* A score never renders on its own. */}
          <p className="mt-2 max-w-2xl text-sm leading-relaxed">
            {record.verdictReason}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <TlpBadge tlp={record.tlp} />
          <StatusPill
            tone={VERDICT_TONE[record.verdict]}
            label={VERDICT_LABEL[record.verdict]}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-black/10 pt-3 text-xs sm:grid-cols-4">
        <Fact
          label="Risk score"
          value={`${record.riskScore} of 100`}
          warn={record.riskScore >= 70}
        />
        <Fact label="First seen" value={gstDate(record.firstSeen)} />
        <Fact label="Last seen" value={gstDate(record.lastSeen)} />
        <Fact label="Held records" value={record.recordCount} />
      </div>

      {record.threatCategories.length > 0 && (
        <div className="mt-3 flex flex-wrap items-baseline gap-1.5 border-t border-black/10 pt-3">
          <span className="text-2xs text-cpx-grey">
            Threat categories{" "}
            <span className="text-cpx-black">{record.threatCategories.length}</span>
          </span>
          {record.threatCategories.map((c) => (
            <span key={c} className="bg-black/5 px-1.5 text-2xs">
              {c}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function Providers({ providers }: { providers: ProviderVerdict[] }) {
  const answered = providers.filter((p) => p.status === "live").length;
  return (
    <Panel
      title="Provider verdicts"
      meta={`${answered} of ${providers.length} answered`}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {providers.map((p) => {
          const s = statusOf(p.status);
          return (
            <div key={p.provider} className="border border-black/10 p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium">{p.provider}</span>
                <StatusPill {...s} />
              </div>
              <div className="mt-2.5 flex items-end justify-between gap-2">
                <span>
                  <span className="text-2xs text-cpx-grey">Score</span>
                  <span className="mt-0.5 block text-lg font-display font-medium leading-none tracking-tightish">
                    {/* Zero is a verdict. Not returned is a different one. */}
                    {p.score === null ? "Not returned" : p.score}
                  </span>
                </span>
                {p.verdict && (
                  <span
                    className={`text-2xs font-medium ${
                      p.verdict === "malicious"
                        ? "text-cpx-red"
                        : p.verdict === "suspicious"
                          ? "text-status-warn-ink"
                          : "text-cpx-grey"
                    }`}
                  >
                    {VERDICT_LABEL[p.verdict]}
                  </span>
                )}
              </div>
              {p.categories.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.categories.map((c) => (
                    <span
                      key={c}
                      className="bg-black/5 px-1.5 text-2xs"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
              {p.error && (
                <p className="mt-2 border-t border-black/10 pt-2 text-2xs text-status-warn-ink">
                  {p.error}
                </p>
              )}
              {p.checkedAt && (
                <p className="mt-2 text-2xs text-cpx-grey">
                  {gstDateTime(p.checkedAt)}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-2xs text-cpx-grey">
        Providers are asked separately and disagreement is kept. No verdict here
        is averaged into another.
      </p>
    </Panel>
  );
}

// --- per-kind detail ---------------------------------------------------------

function IpDetail({ record }: { record: IpLookup }) {
  return (
    <Panel title="Address detail">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-4">
        <Fact label="Country" value={record.country} />
        <Fact label="ASN" value={record.asn} />
        <Fact label="ASN organisation" value={record.asnOrg} />
        <Fact label="Organisation" value={record.organisation} />
      </div>
      <Sub
        label="Associated domains"
        count={record.associatedDomains.length}
        values={record.associatedDomains}
      />
    </Panel>
  );
}

function DomainDetail({ record }: { record: DomainLookup }) {
  return (
    <Panel title="Domain detail">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-4">
        <Fact label="Registrar" value={record.registrar} />
        <Fact label="Created" value={gstDate(record.createdAt)} />
        <Fact label="Classification" value={record.classification} />
        <Fact label="DNS records" value={record.dnsRecords.length} />
      </div>

      <div className="mt-4 border-t border-black/10 pt-3">
        <span className="text-2xs text-cpx-grey">
          DNS records <span className="text-cpx-black">{record.dnsRecords.length}</span>
        </span>
        <div className="mt-2 overflow-x-auto">
          <table className={`${T_TABLE} min-w-[26rem] text-xs`}>
            <colgroup>
              <col className="w-20" />
              <col />
              <col className="w-24" />
            </colgroup>
            <thead>
              <tr className={T_HEAD}>
                <th scope="col" className={`${T_TH} ${T_FLUSH}`}>Type</th>
                <th scope="col" className={`${T_TH} ${T_FLUSH}`}>Value</th>
                <th scope="col" className={`${T_TH} ${T_FLUSH} ${T_NUM}`}>TTL</th>
              </tr>
            </thead>
            <tbody>
              {record.dnsRecords.map((r) => (
                <tr key={`${r.type}-${r.value}`} className={T_ROW}>
                  <td className={`${T_TD} ${T_FLUSH}`}>
                    <TypeBadge label={r.type} />
                  </td>
                  <td className={`${T_TD} ${T_FLUSH}`}>
                    <span className="flex items-start gap-1.5">
                      <IndicatorChip value={r.value} />
                      <CopyButton
                        value={defang(r.value)}
                        what="record as shown"
                        className="mt-0.5"
                      />
                    </span>
                  </td>
                  <td
                    className={`${T_TD} ${T_FLUSH} ${T_NUM} text-cpx-grey`}
                  >
                    {r.ttl}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Sub
        label="Associated addresses"
        count={record.associatedIps.length}
        values={record.associatedIps}
      />
      <Sub
        label="Related domains"
        count={record.relatedDomains.length}
        values={record.relatedDomains}
      />
    </Panel>
  );
}

function HashDetail({ record }: { record: HashLookup }) {
  const { detected, total } = record.detectionRatio;
  return (
    <Panel title="File detail" meta={`${detected} of ${total} engines detect`}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-4">
        <Fact label="File name" value={record.fileName} />
        <Fact label="Type" value={record.fileType} />
        <Fact label="Size" value={bytes(record.fileSize)} />
        <Fact label="Malware family" value={record.malwareFamily} />
      </div>

      <div className="mt-4 border-t border-black/10 pt-3">
        <span className="text-2xs text-cpx-grey">
          Detection ratio
        </span>
        <div className="mt-1.5 flex items-center gap-3">
          <span className="text-xl font-display font-medium leading-none tracking-tightish">
            {detected} <span className="text-cpx-grey">/ {total}</span>
          </span>
          <span className="h-2 flex-1 bg-black/10">
            <span
              className="block h-2 bg-cpx-red"
              style={{ width: `${Math.round((detected / total) * 100)}%` }}
            />
          </span>
        </div>
      </div>

      <div className="mt-4 border-t border-black/10 pt-3">
        <span className="text-2xs text-cpx-grey">
          Behaviour <span className="text-cpx-black">{record.behaviours.length}</span>
        </span>
        <ul className="mt-2 space-y-1.5">
          {record.behaviours.map((b) => (
            <li key={b} className="flex gap-2 text-xs">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-black/30" />
              {b}
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

// --- nothing held ------------------------------------------------------------

function NothingHeld({ live }: { live: LiveResult }) {
  const answered = live.results.filter((r) => r.status === "live").length;
  return (
    <div className="mt-6 space-y-3">
      <section className="border border-black/10 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <IndicatorChip value={live.observable} />
          <StatusPill tone="idle" label="Nothing held" />
          {live.mode !== "LIVE" && (
            <span className="bg-black/5 px-1.5 text-2xs">
              {live.mode} mode
            </span>
          )}
        </div>
        <p className="mt-2 text-sm">
          The repository holds no record of this observable.{" "}
          <span className="font-medium">{answered}</span> of {live.results.length}{" "}
          providers answered.
        </p>
        {live.mode !== "LIVE" && (
          <p className="mt-2 border border-black/10 bg-black/[0.02] px-3 py-2 text-xs">
            Reputation providers are in {live.mode.toLowerCase()} mode. No provider
            was contacted and no verdict below is a real one.
          </p>
        )}
      </section>

      <Providers providers={live.results} />

      <p className="text-2xs text-cpx-grey">
        Holding nothing is not the same as the observable being clean. There is
        nothing to investigate because there is nothing held, not because there
        is nothing there.
      </p>
    </div>
  );
}

// --- shared ------------------------------------------------------------------

function Panel({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-black/10 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium tracking-tightish">{title}</h3>
        {meta && <span className="text-2xs text-cpx-grey">{meta}</span>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Fact({
  label,
  value,
  warn,
}: {
  label: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <div className="min-w-0">
      <span className="block text-cpx-grey">{label}</span>
      <span className={`block font-medium ${warn ? "text-cpx-red" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function Sub({
  label,
  count,
  values,
}: {
  label: string;
  count: number;
  values: string[];
}) {
  return (
    <div className="mt-4 border-t border-black/10 pt-3">
      <span className="text-2xs text-cpx-grey">
        {label} <span className="text-cpx-black">{count}</span>
      </span>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {values.length === 0 ? (
          <span className="text-xs">None held</span>
        ) : (
          values.map((v) => <IndicatorChip key={v} value={v} />)
        )}
      </div>
    </div>
  );
}
