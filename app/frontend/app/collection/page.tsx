"use client";

// Connect a feed, see what went quiet. Four tabs, default Connectors.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useConsoleUser } from "@/lib/role-context";
import { canSee } from "@/lib/access";
import { REQUESTS, WATCHES } from "@/lib/fixtures";
import { getConnectors, getHealth, getRequests, getWatches, isUnreachable } from "@/lib/api";
import type { Connector, KeywordWatch, SourceRequest } from "@/lib/types";
import { PageHeader, Tabs, OfflineNote, tabPanelProps } from "@/components/ui";
import { ConnectorsTab } from "@/components/collection/ConnectorsTab";
import { IntelligenceSourcesTab } from "@/components/collection/IntelligenceSourcesTab";
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
  const [requests, setRequests] = useState<SourceRequest[]>(REQUESTS);
  const [watches, setWatches] = useState<KeywordWatch[]>(WATCHES);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  // Whether a sweep is actually scheduled is the backend's answer, not an
  // assumption. False until /health says otherwise, so the card never
  // promises a collection that will not run.
  const [schedulerOn, setSchedulerOn] = useState(false);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    // Five reads in flight at once; `live` drops any that land after a role
    // switch, so a stale payload never overwrites the new role's rows.
    let live = true;
    getRequests(user.id).then((r) => live && setRequests(r)).catch((e) => live && setOffline(isUnreachable(e)));
    getWatches(user.id).then((w) => live && setWatches(w)).catch((e) => live && setOffline(isUnreachable(e)));
    getConnectors(user.id).then((c) => live && setConnectors(c)).catch((e) => live && setOffline(isUnreachable(e)));
    getHealth().then((h) => live && setSchedulerOn(h.scheduler)).catch(() => live && setSchedulerOn(false));
    return () => {
      live = false;
    };
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
    <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
      <PageHeader title="Collection" meta={offline ? <OfflineNote /> : undefined} />
      <Tabs<TabKey>
        tabs={[
          { key: "connectors", label: "Connectors" },
          { key: "sources", label: "Sources" },
          { key: "watches", label: "Watches", count: watches.length },
          { key: "requests", label: "Requests", count: requests.length },
        ]}
        value={tab}
        onChange={setTab}
        id="collection"
        label="Collection"
      />
      <div {...tabPanelProps("collection", tab)}>
        {tab === "connectors" && <ConnectorsTab initialRows={connectors} />}
        {tab === "sources" && (
          <IntelligenceSourcesTab
            schedulerOn={schedulerOn}
            connectors={connectors}
            onRequestSource={() => setTab("requests")}
          />
        )}
        {tab === "watches" && <WatchesTab initialRows={watches} />}
        {tab === "requests" && <RequestsTab initialRows={requests} requestedBy={user.name} />}
      </div>
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
