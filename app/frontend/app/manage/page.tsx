"use client";

// Manage: the settings that steer collection, and the record of who changed
// what. Two tabs, PIRs and Audit. Agents and Workflows were removed at the
// user's request on 23 September 2026; the run behind an answer is still
// openable from the answer and the case (hard rule 4).

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useConsoleUser } from "@/lib/role-context";
import { canSee } from "@/lib/access";
import { PIRS } from "@/lib/fixtures";
import { getPirs, isUnreachable } from "@/lib/api";
import type { Pir } from "@/lib/types";
import { NotPermitted, OfflineNote, Page, PageHeader, tabPanelProps, Tabs } from "@/components/ui";
import { AuditTab } from "@/components/manage/AuditTab";
import { PirsTab } from "@/components/manage/PirsTab";

type TabKey = "pirs" | "audit";

function ManageInner() {
  const { user } = useConsoleUser();
  const params = useSearchParams();
  const [tab, setTab] = useState<TabKey>(params.get("tab") === "audit" ? "audit" : "pirs");
  const [pirs, setPirs] = useState<Pir[]>(PIRS);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // PIRs are live; the fixture stands in only when the backend is down.
    // `live` drops a response that lands after a role switch.
    let live = true;
    getPirs(user.id)
      .then((rows) => {
        if (!live) return;
        setPirs(rows.length > 0 ? rows : PIRS);
        setOffline(false);
      })
      .catch((e) => {
        if (!live) return;
        setPirs(PIRS);
        setOffline(isUnreachable(e));
      });
    return () => {
      live = false;
    };
  }, [user.id]);

  if (!canSee(user.role, "manage")) return <NotPermitted />;

  return (
    <Page band>
      <PageHeader title="Manage" meta={offline && tab === "pirs" ? <OfflineNote /> : undefined} />
      <Tabs<TabKey>
        tabs={[
          { key: "pirs", label: "PIRs", count: pirs.length },
          { key: "audit", label: "Audit" },
        ]}
        value={tab}
        onChange={setTab}
        id="manage"
        label="Manage"
        className="mb-3"
      />

      <div {...tabPanelProps("manage", tab)}>
        {tab === "pirs" && <PirsTab pirs={pirs} onChange={setPirs} initialQuery={params.get("q") ?? ""} />}
        {tab === "audit" && <AuditTab />}
      </div>
    </Page>
  );
}

export default function ManagePage() {
  return (
    <Suspense>
      <ManageInner />
    </Suspense>
  );
}
