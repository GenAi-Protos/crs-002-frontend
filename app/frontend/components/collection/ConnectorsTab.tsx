"use client";

// Connector card, four facts, nothing more: name, Held/Live/Both,
// connection state or last new item, residency. No transport, no credential,
// no cron.

import { CONNECTORS } from "@/lib/fixtures";
import { captureModeLabel } from "@/lib/derive";
import { agoFromNow } from "@/lib/format";
import type { Connector } from "@/lib/types";
import { Panel, StatusPill } from "@/components/ui";
import { IconEgress } from "@/components/icons";

export function ConnectorsTab({ initialRows = CONNECTORS }: { initialRows?: Connector[] }) {
  const commercial = initialRows.filter((c) => !c.ourProposal && !c.noRouteYet);
  const proposal = initialRows.filter((c) => c.ourProposal);
  const noRoute = initialRows.filter((c) => c.noRouteYet);

  return (
    <div className="space-y-3">
      <Group label="Named by CPX" rows={commercial} enter={0} />
      <Group label="Our proposal" rows={proposal} enter={1} />
      <Group label="No route yet" rows={noRoute} enter={2} />
    </div>
  );
}

function Group({ label, rows, enter }: { label: string; rows: Connector[]; enter: number }) {
  return (
    <Panel title={label} count={rows.length} enter={enter} flush bodyClassName="overflow-hidden">
      {rows.length === 0 ? (
        <p className="px-3 py-3 text-sm text-cpx-grey-500">0 connectors.</p>
      ) : (
        // Each card draws its own right and bottom hairline; the grid is pulled
        // 1px past the clipped body so the outer ones disappear under the frame.
        <div className="-mb-px -mr-px grid grid-cols-1 @xl/page:grid-cols-2 @4xl/page:grid-cols-3 @6xl/page:grid-cols-4">
          {rows.map((c) => (
            <ConnectorCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function ConnectorCard({ c }: { c: Connector }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 border-b border-r border-cpx-grey-100 bg-white px-3 py-2.5 transition-colors duration-150 hover:bg-cpx-grey-50">
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-semibold tracking-tightish" title={c.name}>
          {c.name}
        </h3>
        {!c.verified && (
          <span className="shrink-0 rounded-sm border border-cpx-bright-200 bg-cpx-bright-50 px-1.5 text-2xs font-medium text-cpx-bright-700">
            Unverified
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
        <span className="text-2xs text-cpx-grey-500">{captureModeLabel[c.captureMode]}</span>
        <span className="flex items-center gap-1 text-2xs text-cpx-grey-500">
          {c.residency === "egress" ? (
            <>
              <IconEgress />
              Egress
            </>
          ) : (
            "In region"
          )}
        </span>
      </div>
    </div>
  );
}
