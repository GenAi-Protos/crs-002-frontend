"use client";

// Connect a feed, see what went quiet. Four tabs, default Connectors.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useConsoleUser } from "@/lib/role-context";
import { canSee } from "@/lib/access";
import { REQUESTS, SOURCES, WATCHES } from "@/lib/fixtures";
import { getConnectors, getHealth, getRequests, getSources, getWatches } from "@/lib/api";
import type { Connector, KeywordWatch, Source, SourceRequest } from "@/lib/types";
import { PageHeader, Tabs, OfflineNote } from "@/components/ui";
import { ConnectorsTab } from "@/components/collection/ConnectorsTab";
import { SourcesTab } from "@/components/collection/SourcesTab";
import { WatchesTab } from "@/components/collection/WatchesTab";
import { RequestsTab } from "@/components/collection/RequestsTab";

type TabKey = "connectors" | "sources" | "watches" | "requests";

function CollectionInner() {
  const { user } = useConsoleUser();
  const params = useSearchParams();
  const initial = (params.get("tab") as TabKey) ?? "connectors";
  const [tab, setTab] = useState<TabKey>(
    ["connectors", "sources", "watches", "requests"].includes(initial)
      ? initial
      : "connectors",
  );
  const [sources, setSources] = useState<Source[]>(SOURCES);
  const [requests, setRequests] = useState<SourceRequest[]>(REQUESTS);
  const [watches, setWatches] = useState<KeywordWatch[]>(WATCHES);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  // Whether a sweep is actually scheduled is the backend's answer, not an
  // assumption. False until /health says otherwise, so the card never
  // promises a collection that will not run.
  const [schedulerOn, setSchedulerOn] = useState(false);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    getSources(user.id).then(setSources).catch(() => setOffline(true));
    getRequests(user.id).then(setRequests).catch(() => setOffline(true));
    getWatches(user.id).then(setWatches).catch(() => setOffline(true));
    getConnectors(user.id).then(setConnectors).catch(() => setOffline(true));
    getHealth().then((h) => setSchedulerOn(h.scheduler)).catch(() => setSchedulerOn(false));
  }, [user.id]);

  if (!canSee(user.role, "collection")) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <p className="text-base">Not permitted at this access level.</p>
        <Link href="/" className="text-sm text-link underline underline-offset-2">
          Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-6">
      <PageHeader title="Collection" meta={offline ? <OfflineNote /> : undefined} />
      <Tabs<TabKey>
        tabs={[
          { key: "connectors", label: "Connectors" },
          { key: "sources", label: "Sources", count: sources.length },
          { key: "watches", label: "Watches", count: watches.length },
          { key: "requests", label: "Requests", count: requests.length },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "connectors" && <ConnectorsTab initialRows={connectors} />}
      {tab === "sources" && (
        <SourcesTab
          initialRows={sources}
          schedulerOn={schedulerOn}
          connectors={connectors}
          onRequestSource={() => setTab("requests")}
        />
      )}
      {tab === "watches" && <WatchesTab initialRows={watches} />}
      {tab === "requests" && <RequestsTab initialRows={requests} requestedBy={user.name} />}
    </div>
  );
}

export default function CollectionPage() {
  return (
    <Suspense>
      <CollectionInner />
    </Suspense>
  );
}
