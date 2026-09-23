"use client";

// Addressable so an RFI row can link a conversation. Never navigated to
// from anywhere else; there is no list of these.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getDashboardData, getInvestigation, getReports, isUnreachable } from "@/lib/api";
import type { Advisory, PirHit, Turn } from "@/lib/types";
import { useConsoleUser } from "@/lib/role-context";
import { canSee } from "@/lib/access";
import { TurnView } from "@/components/intelligence/AnswerCard";
import { EntityDrawer } from "@/components/intelligence/EntityDrawer";
import { CenterMessage, NotPermitted, OfflineNote, Page, PageHeader, SkeletonRows } from "@/components/ui";

export default function InvestigationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useConsoleUser();
  const [entity, setEntity] = useState<{ id: string; name: string; type: string } | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [found, setFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  // The entity drawer resolves a clicked entity against real hits and advisories:
  // it was reading fixtures here, so a linked conversation showed demo context.
  const [hits, setHits] = useState<PirHit[]>([]);
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  useEffect(() => {
    let active = true; setTurns([]); setFound(false); setLoading(true);
    getInvestigation(user.id, id)
      .then((next) => { if (active) { setTurns(next); setFound(true); setOffline(false); } })
      .catch((e) => { if (active) setOffline(isUnreachable(e)); })
      .finally(() => { if (active) setLoading(false); });
    getDashboardData(user.id).then((d) => setHits(d.hits)).catch(() => setHits([]));
    getReports(user.id).then(setAdvisories).catch(() => setAdvisories([]));
    return () => { active = false; };
  }, [user.id, id]);

  if (!canSee(user.role, "intelligence")) return <NotPermitted />;

  if (loading) {
    return (
      <Page narrow>
        <PageHeader title="Intelligence" />
        <SkeletonRows rows={5} />
      </Page>
    );
  }

  // An outage is not an absence: a conversation the backend could not be
  // asked about says so instead of claiming it does not exist.
  if (!found) {
    return (
      <CenterMessage
        action={
          <Link href="/intelligence" className="link-quiet text-sm">
            Intelligence
          </Link>
        }
      >
        {offline
          ? "Conversations could not be reached. Retry when the backend is available."
          : "No conversation with this reference."}
      </CenterMessage>
    );
  }

  return (
    <Page narrow>
      <PageHeader title="Intelligence" meta={offline ? <OfflineNote /> : undefined} />
      <div className="space-y-6">
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
    </Page>
  );
}
