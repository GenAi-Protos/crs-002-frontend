"use client";

// Addressable so an RFI row can link a conversation. Never navigated to
// from anywhere else; there is no list of these.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { investigationById } from "@/lib/fixtures";
import { getDashboardData, getInvestigation, getReports, isUnreachable } from "@/lib/api";
import type { Advisory, PirHit, Turn } from "@/lib/types";
import { useConsoleUser } from "@/lib/role-context";
import { canSee } from "@/lib/access";
import { TurnView } from "@/components/intelligence/AnswerCard";
import { EntityDrawer } from "@/components/intelligence/EntityDrawer";
import { PageHeader, OfflineNote, SkeletonRows } from "@/components/ui";

export default function InvestigationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useConsoleUser();
  const [entity, setEntity] = useState<{ id: string; name: string; type: string } | null>(null);
  const fallback = investigationById(id);
  const [turns, setTurns] = useState<Turn[]>(fallback?.turns ?? []);
  const [found, setFound] = useState(!!fallback);
  const [loading, setLoading] = useState(!fallback);
  const [offline, setOffline] = useState(false);
  // The entity drawer resolves a clicked entity against real hits and advisories:
  // it was reading fixtures here, so a linked conversation showed demo context.
  const [hits, setHits] = useState<PirHit[]>([]);
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  useEffect(() => {
    getInvestigation(user.id, id)
      .then((next) => { setTurns(next); setFound(true); setOffline(false); })
      .catch((e) => setOffline(isUnreachable(e)))
      .finally(() => setLoading(false));
    getDashboardData(user.id).then((d) => setHits(d.hits)).catch(() => setHits([]));
    getReports(user.id).then(setAdvisories).catch(() => setAdvisories([]));
  }, [user.id, id]);

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

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[880px] px-6 py-8">
        <PageHeader title="Intelligence" />
        <SkeletonRows rows={5} />
      </div>
    );
  }

  if (!found) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <p className="text-base">No conversation with this reference.</p>
        <Link
          href="/intelligence"
          className="text-sm text-link underline underline-offset-2"
        >
          Intelligence
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[880px] px-6 py-8">
      <PageHeader title="Intelligence" meta={offline ? <OfflineNote /> : undefined} />
      <div className="space-y-8">
      {turns.map((t) => (
        <TurnView
          key={t.id}
          turn={t}
          onEntity={(eid, entities) =>
            setEntity(entities.find((e) => e.id === eid) ?? null)
          }
        />
      ))}
      </div>
      <EntityDrawer entity={entity} hits={hits} advisories={advisories} onClose={() => setEntity(null)} />
    </div>
  );
}
