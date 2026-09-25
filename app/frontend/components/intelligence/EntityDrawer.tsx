"use client";

// Entity click opens this 480px right drawer. The page does not change.

import { assembleAdvisories } from "@/lib/access";
import type { Advisory, PirHit } from "@/lib/types";
import { useConsoleUser } from "@/lib/role-context";
import { gstDate } from "@/lib/format";
import Link from "next/link";
import { Drawer } from "@/components/ui";

export function EntityDrawer({
  entity,
  onClose,
  hits,
  advisories,
}: {
  entity: { id: string; name: string; type: string } | null;
  onClose: () => void;
  hits: PirHit[];
  advisories: Advisory[];
}) {
  const { user } = useConsoleUser();
  if (!entity) return null;
  const relatedHits = hits.filter((h) =>
    h.title.toLowerCase().includes(entity.name.toLowerCase().split(" ")[0]),
  );
  // Assembled through the access predicate, so drafts never leak to
  // published-only roles through an entity lookup.
  const relatedAdvisories = assembleAdvisories(advisories, user).filter(
    (a) =>
      a.title.toLowerCase().includes(entity.name.toLowerCase().split(" ")[0]) &&
      a.status !== "withdrawn",
  );

  return (
    <Drawer
      onClose={onClose}
      title={
        <>
          <h2 className="text-md font-semibold tracking-tightish">{entity.name}</h2>
          <span className="text-2xs uppercase tracking-wide text-mute">
            {entity.type}
          </span>
        </>
      }
    >
        <div className="space-y-5">
          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-mute">
              Findings
            </h3>
            <p className="text-xs text-mute">
              <span className="font-medium text-ink">{relatedHits.length}</span>{" "}
              matched
            </p>
            <ul className="mt-2 space-y-2">
              {relatedHits.map((h) => (
                <li key={h.id} className="border border-rule p-2.5">
                  <p className="text-sm font-medium">{h.title}</p>
                  <p className="mt-1 text-2xs text-mute">
                    {h.pirRef} · {gstDate(h.firedAt)} · {h.confidence}%
                  </p>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-mute">
              Advisories
            </h3>
            <p className="text-xs text-mute">
              <span className="font-medium text-ink">
                {relatedAdvisories.length}
              </span>{" "}
              matched
            </p>
            <ul className="mt-2 space-y-2">
              {relatedAdvisories.map((a) => (
                <li key={a.ref}>
                  <Link
                    href={`/reports/${encodeURIComponent(a.ref)}`}
                    className="text-sm text-link underline underline-offset-2"
                  >
                    {a.ref}
                  </Link>
                  <span className="ml-2 text-xs">{a.title}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
    </Drawer>
  );
}
