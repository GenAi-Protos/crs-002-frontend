"use client";

// Connector card, four facts, nothing more: name, Held/Live/Both,
// connection state or last new item, residency. No transport, no credential,
// no cron.

import { CONNECTORS } from "@/lib/fixtures";
import { captureModeLabel } from "@/lib/derive";
import { agoFromNow } from "@/lib/format";
import type { Connector } from "@/lib/types";
import { StatusPill } from "@/components/ui";
import { IconEgress } from "@/components/icons";

export function ConnectorsTab({ initialRows = CONNECTORS }: { initialRows?: Connector[] }) {
  const commercial = initialRows.filter((c) => !c.ourProposal && !c.noRouteYet);
  const proposal = initialRows.filter((c) => c.ourProposal);
  const noRoute = initialRows.filter((c) => c.noRouteYet);

  return (
    <div className="mt-4 space-y-6">
      <Group label={`Named by CPX · ${commercial.length}`} rows={commercial} />
      <Group label={`Our proposal · ${proposal.length}`} rows={proposal} />
      <Group label={`No route yet · ${noRoute.length}`} rows={noRoute} />
    </div>
  );
}

function Group({ label, rows }: { label: string; rows: Connector[] }) {
  return (
    <section>
      <h2 className="font-sans text-xs font-medium uppercase tracking-wide text-cpx-grey">
        {label}
      </h2>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((c) => (
          <ConnectorCard key={c.id} c={c} />
        ))}
      </div>
    </section>
  );
}

function ConnectorCard({ c }: { c: Connector }) {
  return (
    <div className="border border-black/10 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-medium tracking-tightish">{c.name}</h3>
        {!c.verified && (
          <span className="bg-status-warn-fill px-1.5 py-0.5 text-2xs font-medium text-status-warn-ink">
            UNVERIFIED
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-cpx-grey">
        {captureModeLabel[c.captureMode]}
      </p>
      <div className="mt-3">
        {c.connected ? (
          <StatusPill
            tone="good"
            label={
              c.lastNewItemAt ? `Last item ${agoFromNow(c.lastNewItemAt)}` : "Connected"
            }
          />
        ) : (
          <StatusPill tone="idle" label="Not connected" />
        )}
      </div>
      <p className="mt-2 flex items-center gap-1 text-2xs text-cpx-grey">
        {c.residency === "egress" ? (
          <>
            <IconEgress />
            Egress
          </>
        ) : (
          "In region"
        )}
      </p>
    </div>
  );
}
