// The matcher. Pure: records in, hits out, no fetching and no React.
//
// Two passes, because "find me everything about this address" is the actual
// question. The first pass matches the query against the records themselves.
// The second follows what the first found - an address sits on a campaign, a
// campaign has an advisory, an advisory names the malware - and returns those
// as related hits, labelled as related so nobody mistakes a connection for a
// mention.
//
// Access is applied here, in the payload. A hit the role may not receive is
// never built into a group; it is counted and the count is returned, which is
// the same rule the dashboards follow.

import { canSee, seesRawIocs } from "../access";
import { defang } from "../defang";
import type {
  Advisory,
  Investigation,
  LookupRecord,
  Pir,
  RoleKey,
} from "../types";
import { KIND_LABEL } from "../lookup";
import {
  CATEGORY_LABEL,
  type SearchCategory,
  type SearchCorpus,
  type SearchFilter,
  type SearchGroup,
  type SearchHit,
  type SearchResult,
} from "./types";

/** How many hits a group shows before it reports the rest as a count. */
const PER_GROUP = 6;

// --- access ------------------------------------------------------------------

export interface SearchAccess {
  /** Investigations, and the ask surface a result may link to. */
  intelligence: boolean;
  reports: boolean;
  /** PIRs live in Manage. */
  pirs: boolean;
  /**
   * Indicators, malware, threat actors and technique ids. Without it a query
   * that is an indicator matches nothing, rather than matching quietly and
   * being hidden in the markup.
   */
  technical: boolean;
}

export function searchAccessFor(role: RoleKey): SearchAccess {
  return {
    intelligence: canSee(role, "intelligence"),
    reports: canSee(role, "reports"),
    pirs: canSee(role, "manage"),
    technical: seesRawIocs(role),
  };
}

// --- normalising -------------------------------------------------------------

/**
 * Analysts paste what is on the screen, and what is on the screen is defanged.
 * `198[.]51[.]100[.]47` and `hxxps://x[.]example` have to find the record they
 * came from.
 */
export function refang(value: string): string {
  return value
    .replace(/\[\s*\.\s*\]/g, ".")
    .replace(/\[\s*at\s*\]/gi, "@")
    .replace(/^hxxp/i, "http")
    .replace(/^fxp/i, "ftp")
    .replace(/\[\s*:\s*\/\/\s*\]/g, "://");
}

const norm = (value: string) => refang(value).trim().toLowerCase();

const has = (haystack: string | undefined, needle: string) =>
  !!haystack && haystack.toLowerCase().includes(needle);

const hasAny = (fields: (string | undefined)[], needle: string) =>
  fields.some((f) => has(f, needle));

/** One line, trimmed to a length a dropdown row can hold. */
function snip(text: string, limit = 120): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1)}…`;
}

// --- the expansion set -------------------------------------------------------
//
// What the query is connected to. Built from held records only: nothing here is
// inferred, and nothing here leaves the region to find out.

interface Related {
  /** Lower-cased terms that count as a related match. */
  terms: Set<string>;
  /** Advisory refs reached through a campaign or an IOC record. */
  refs: Set<string>;
  /** What the query resolved to, for the context line. */
  anchor: string | null;
}

function expand(
  corpus: SearchCorpus,
  needle: string,
  access: SearchAccess,
): Related {
  const terms = new Set<string>();
  const refs = new Set<string>();
  let anchor: string | null = null;

  const add = (value: string | undefined) => {
    if (value && value.trim()) terms.add(value.trim().toLowerCase());
  };

  if (access.technical) {
    // An observable we hold: take its whole investigation graph.
    const record = corpus.lookups.find(
      (l) => l.observable.toLowerCase() === needle,
    );
    if (record) {
      anchor = defang(record.observable);
      const g = record.investigation;
      g.infrastructure.forEach((i) => add(i.value));
      g.malware.forEach((m) => add(m.name));
      g.actors.forEach((a) => {
        add(a.name);
        a.aliases.forEach(add);
      });
      g.campaigns.forEach((c) => {
        add(c.name);
        if (c.ref) refs.add(c.ref);
      });
    }

    // An indicator on a campaign: take the campaign and everything on it.
    const indicator = corpus.dataset.indicators.find(
      (i) => i.value.toLowerCase() === needle,
    );
    if (indicator?.campaignId) {
      const campaign = corpus.dataset.campaigns.find(
        (c) => c.id === indicator.campaignId,
      );
      if (campaign) {
        anchor = anchor ?? defang(indicator.value);
        add(campaign.name);
        if (campaign.advisoryRef) refs.add(campaign.advisoryRef);
        const actor = corpus.dataset.actors.find((a) => a.id === campaign.actorId);
        if (actor) {
          add(actor.name);
          actor.aliases.forEach(add);
        }
        corpus.dataset.malware
          .filter((m) => m.campaignId === campaign.id)
          .forEach((m) => add(m.name));
      }
    }
  }

  // A campaign, actor or malware family named directly: take its advisory.
  for (const c of corpus.dataset.campaigns) {
    if (norm(c.name) === needle || has(c.name, needle)) {
      anchor = anchor ?? c.name;
      if (c.advisoryRef) refs.add(c.advisoryRef);
    }
  }

  terms.delete(needle);
  return { terms, refs, anchor };
}

const relatedTo = (fields: (string | undefined)[], r: Related): string | null => {
  for (const term of r.terms) if (hasAny(fields, term)) return term;
  return null;
};

// --- hit builders ------------------------------------------------------------

function intelligenceHits(
  corpus: SearchCorpus,
  needle: string,
  r: Related,
): SearchHit[] {
  const hits: SearchHit[] = [];
  const seen = new Set<string>();

  for (const l of corpus.lookups) {
    const value = l.observable;
    const direct =
      has(value, needle) ||
      hasAny(l.threatCategories, needle) ||
      has(l.verdictReason, needle) ||
      (l.kind === "hash" && hasAny([l.fileName, l.malwareFamily], needle));
    const via = direct ? null : relatedTo([value], r);
    if (!direct && !via) continue;

    seen.add(value.toLowerCase());
    hits.push({
      id: `ioc:${value}`,
      category: "intelligence",
      title: defang(value),
      badge: KIND_LABEL[l.kind],
      mono: true,
      related: !direct,
      context: direct
        ? snip(l.verdictReason)
        : `Seen with ${r.anchor ?? "this observable"}. ${snip(l.verdictReason, 70)}`,
      href: `/intelligence?lookup=${encodeURIComponent(value)}`,
      score: (norm(value) === needle ? 200 : direct ? 120 : 60) + l.riskScore / 100,
    });
  }

  // Indicators held on a campaign but with no lookup record of their own.
  for (const i of corpus.dataset.indicators) {
    if (seen.has(i.value.toLowerCase())) continue;
    const direct = has(i.value, needle) || has(i.note, needle);
    const via = direct ? null : relatedTo([i.value], r);
    if (!direct && !via) continue;
    hits.push({
      id: `ind:${i.value}`,
      category: "intelligence",
      title: defang(i.value),
      badge: "Indicator",
      mono: true,
      related: !direct,
      context: `${snip(i.note, 80)} · confidence ${i.confidence}%`,
      href: `/intelligence?lookup=${encodeURIComponent(i.value)}`,
      score: norm(i.value) === needle ? 190 : direct ? 110 : 55,
    });
  }

  for (const m of corpus.dataset.malware) {
    const direct = hasAny([m.name, m.family, m.behaviour], needle);
    const via = direct ? null : relatedTo([m.name], r);
    if (!direct && !via) continue;
    hits.push({
      id: `mal:${m.name}`,
      category: "intelligence",
      title: m.name,
      badge: "Malware",
      related: !direct,
      context: `${m.family}. ${snip(m.behaviour, 80)}`,
      href: `/intelligence?q=${encodeURIComponent(m.name)}`,
      score: norm(m.name) === needle ? 180 : direct ? 105 : 55,
    });
  }

  for (const a of corpus.dataset.actors) {
    const direct = hasAny([a.name, a.motivation, ...a.aliases], needle);
    const via = direct ? null : relatedTo([a.name, ...a.aliases], r);
    if (!direct && !via) continue;
    hits.push({
      id: `act:${a.id}`,
      category: "intelligence",
      title: a.name,
      badge: "Threat actor",
      related: !direct,
      context: `${a.aliases.length > 0 ? `Also ${a.aliases.join(", ")}. ` : ""}${a.records} records held`,
      href: `/intelligence?q=${encodeURIComponent(a.name)}`,
      score: norm(a.name) === needle ? 185 : direct ? 108 : 58,
    });
  }

  return hits;
}

function reportHits(
  advisories: Advisory[],
  needle: string,
  r: Related,
  access: SearchAccess,
): SearchHit[] {
  const hits: SearchHit[] = [];

  for (const a of advisories) {
    let why: string | null = null;
    let score = 0;

    if (norm(a.ref) === needle) {
      why = "Reference match";
      score = 200;
    } else if (has(a.ref, needle)) {
      why = "Reference match";
      score = 150;
    } else if (has(a.title, needle)) {
      why = "Title match";
      score = 140;
    } else if (a.pirRefs.some((p) => norm(p) === needle)) {
      why = `Raised against ${a.pirRefs.find((p) => norm(p) === needle)}`;
      score = 120;
    } else if (access.technical && a.techniques.some((t) => has(t.techniqueId, needle))) {
      const t = a.techniques.find((x) => has(x.techniqueId, needle))!;
      why = `Maps ${t.techniqueId} ${t.techniqueName}`;
      score = 115;
    } else if (a.cvss.some((c) => has(c.cveId, needle))) {
      why = `Assesses ${a.cvss.find((c) => has(c.cveId, needle))!.cveId}`;
      score = 115;
    } else {
      // The body last: a section match is the weakest reason to surface a
      // report, and the strongest way to flood the list.
      const section = a.sections.find((s) => has(s.body, needle) || has(s.heading, needle));
      if (section) {
        why = `${section.heading} section`;
        score = 100;
      }
    }

    if (!why && r.refs.has(a.ref)) {
      why = `Covers ${r.anchor ?? "this activity"}`;
      score = 70;
    }
    if (!why) {
      const term = relatedTo(
        [a.title, ...a.sections.map((s) => s.body)],
        r,
      );
      if (term) {
        why = `Names ${term}, related to ${r.anchor ?? "this query"}`;
        score = 60;
      }
    }
    if (!why) continue;

    hits.push({
      id: `rep:${a.ref}`,
      category: "reports",
      title: a.title,
      badge: a.type,
      related: score < 100,
      context: `${a.ref} · ${a.status} · ${why}`,
      href: `/reports/${encodeURIComponent(a.ref)}`,
      score,
    });
  }

  return hits;
}

function investigationHits(
  investigations: Investigation[],
  needle: string,
  r: Related,
): SearchHit[] {
  const hits: SearchHit[] = [];

  for (const inv of investigations) {
    let why: string | null = null;
    let score = 0;

    if (norm(inv.id) === needle) {
      why = "Record match";
      score = 200;
    } else if (has(inv.title, needle)) {
      why = "Title match";
      score = 140;
    } else {
      const turnIndex = inv.turns.findIndex(
        (t) => has(t.question, needle) || answerMentions(t.answer, needle),
      );
      if (turnIndex >= 0) {
        why = `Mentioned at turn ${turnIndex + 1}`;
        score = 110;
      }
    }

    if (!why) {
      const term = relatedTo(
        [inv.title, ...inv.turns.map((t) => t.question)],
        r,
      );
      if (term) {
        why = `Covers ${term}, related to ${r.anchor ?? "this query"}`;
        score = 60;
      }
    }
    if (!why) continue;

    hits.push({
      id: `inv:${inv.id}`,
      category: "investigations",
      title: inv.title,
      badge: `${inv.turns.length} ${inv.turns.length === 1 ? "turn" : "turns"}`,
      related: score < 100,
      context: `${why} · ${inv.createdBy}`,
      href: `/intelligence/${encodeURIComponent(inv.id)}`,
      score,
    });
  }

  return hits;
}

function answerMentions(answer: Investigation["turns"][number]["answer"], needle: string) {
  if (!answer) return false;
  if (has(answer.title, needle)) return true;
  return answer.blocks.some((b) => {
    if (b.kind === "prose") return has(b.text, needle);
    if (b.kind === "list") return b.items.some((i) => has(i, needle));
    if (b.kind === "table") return b.rows.some((row) => row.some((c) => has(c, needle)));
    return b.values.some((v) => has(v, needle));
  });
}

function campaignHits(
  corpus: SearchCorpus,
  needle: string,
  r: Related,
  access: SearchAccess,
  advisoryRefs: Set<string>,
): SearchHit[] {
  const hits: SearchHit[] = [];

  for (const c of corpus.dataset.campaigns) {
    const actor = corpus.dataset.actors.find((a) => a.id === c.actorId);
    let why: string | null = null;
    let score = 0;

    if (has(c.name, needle)) {
      why = "Name match";
      score = 150;
    } else if (has(c.summary, needle) || c.sectors.some((s) => has(s, needle))) {
      why = "Summary match";
      score = 110;
    } else if (access.technical) {
      // Technical roles only: an indicator, technique or malware family is a
      // reason to surface a campaign. For everyone else it is not a reason,
      // because they may not receive it at all.
      const indicator = corpus.dataset.indicators.find(
        (i) => i.campaignId === c.id && has(i.value, needle),
      );
      const technique = c.techniqueIds.find((t) => has(t, needle));
      const malware = corpus.dataset.malware.find(
        (m) => m.campaignId === c.id && has(m.name, needle),
      );
      if (indicator) {
        why = `Indicator ${defang(indicator.value)} sits on this campaign`;
        score = 130;
      } else if (technique) {
        why = `Uses ${technique}`;
        score = 105;
      } else if (malware) {
        why = `Deploys ${malware.name}`;
        score = 105;
      } else if (actor && hasAny([actor.name, ...actor.aliases], needle)) {
        why = `Attributed to ${actor.name}`;
        score = 105;
      }
    }

    if (!why && actor && access.technical) {
      const term = relatedTo([c.name, actor.name], r);
      if (term) {
        why = `Connected to ${term}`;
        score = 60;
      }
    }
    if (!why) continue;

    // A campaign has no page of its own. Its advisory is the record; without
    // one the dashboard is where it appears.
    const href =
      c.advisoryRef && advisoryRefs.has(c.advisoryRef)
        ? `/reports/${encodeURIComponent(c.advisoryRef)}`
        : "/";

    hits.push({
      id: `cam:${c.id}`,
      category: "campaigns",
      title: c.name,
      badge: c.status,
      related: score < 100,
      context: `${why} · ${c.sectors.join(", ")}`,
      href,
      score,
    });
  }

  return hits;
}

function pirHits(pirs: Pir[], needle: string): SearchHit[] {
  const hits: SearchHit[] = [];

  for (const p of pirs) {
    let why: string | null = null;
    let score = 0;
    if (norm(p.ref) === needle) {
      why = "Reference match";
      score = 200;
    } else if (has(p.ref, needle)) {
      why = "Reference match";
      score = 150;
    } else if (has(p.question, needle)) {
      why = "PIR text match";
      score = 120;
    } else if (has(p.category, needle) || has(p.coverage, needle)) {
      why = "Category or coverage match";
      score = 90;
    }
    if (!why) continue;

    hits.push({
      id: `pir:${p.ref}`,
      category: "pirs",
      title: p.question,
      badge: p.ref,
      context: `${p.category} · ${p.coverage} · ${why}`,
      href: `/manage?tab=pirs&q=${encodeURIComponent(p.ref)}`,
      score,
    });
  }

  return hits;
}

// --- the search --------------------------------------------------------------

const ORDER: SearchCategory[] = [
  "intelligence",
  "reports",
  "investigations",
  "campaigns",
  "pirs",
];

export function runSearch(
  corpus: SearchCorpus,
  role: RoleKey,
  rawQuery: string,
  filter: SearchFilter = "all",
): SearchResult {
  const query = rawQuery.trim();
  const needle = norm(query);
  if (needle.length < 2) {
    return { query, groups: [], total: 0, withheld: 0 };
  }

  const access = searchAccessFor(role);
  const related = expand(corpus, needle, access);
  const advisoryRefs = new Set(corpus.advisories.map((a) => a.ref));

  // Built first, filtered second, so what a role may not have can be counted
  // rather than silently never existing.
  const candidates: { hit: SearchHit; allowed: boolean }[] = [
    ...intelligenceHits(corpus, needle, related).map((hit) => ({
      hit,
      allowed: access.technical && access.intelligence,
    })),
    ...reportHits(corpus.advisories, needle, related, access).map((hit) => ({
      hit,
      allowed: access.reports,
    })),
    ...investigationHits(corpus.investigations, needle, related).map((hit) => ({
      hit,
      allowed: access.intelligence,
    })),
    ...campaignHits(corpus, needle, related, access, advisoryRefs).map((hit) => ({
      hit,
      allowed: true,
    })),
    ...pirHits(corpus.pirs, needle).map((hit) => ({ hit, allowed: access.pirs })),
  ];

  const withheld = candidates.filter((c) => !c.allowed).length;
  const allowed = candidates.filter((c) => c.allowed).map((c) => c.hit);

  const groups: SearchGroup[] = [];
  let total = 0;

  for (const category of ORDER) {
    if (filter !== "all" && filter !== category) continue;
    const hits = allowed
      .filter((h) => h.category === category)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
    if (hits.length === 0) continue;
    total += hits.length;
    groups.push({
      category,
      label: CATEGORY_LABEL[category],
      hits: hits.slice(0, PER_GROUP),
      more: Math.max(0, hits.length - PER_GROUP),
    });
  }

  return { query, groups, total, withheld };
}

/** Counts per filter chip, computed on the unfiltered result. */
export function countsFor(
  corpus: SearchCorpus,
  role: RoleKey,
  query: string,
): Record<SearchFilter, number> {
  const all = runSearch(corpus, role, query, "all");
  const counts = {
    all: all.total,
    intelligence: 0,
    reports: 0,
    investigations: 0,
    campaigns: 0,
    pirs: 0,
  } as Record<SearchFilter, number>;
  for (const g of all.groups) counts[g.category] = g.hits.length + g.more;
  return counts;
}
