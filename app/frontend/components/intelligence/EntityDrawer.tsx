"use client";

// Entity click opens this 480px right drawer. The page does not change.

import { assembleAdvisories } from "@/lib/access";
import type { Advisory, PirHit } from "@/lib/types";
import { useConsoleUser } from "@/lib/role-context";
import { gstDate } from "@/lib/format";
import { IconClose } from "@/components/icons";
import Link from "next/link";

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
    <>
      <button
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/20"
      />
      <aside className="fixed bottom-0 right-0 top-14 z-50 w-[480px] max-w-full overflow-y-auto border-l border-black/10 bg-white">
        <div className="flex items-center justify-between border-b border-black/10 px-5 py-3">
          <div>
            <h2 className="text-[16px] font-medium tracking-tightish">
              {entity.name}
            </h2>
            <span className="text-[11px] font-light uppercase tracking-wide text-cpx-grey">
              {entity.type}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center text-black/40 hover:bg-black/5"
          >
            <IconClose />
          </button>
        </div>
        <div className="space-y-5 p-5">
          <section>
            <h3 className="mb-2 text-[12px] font-medium uppercase tracking-wide text-cpx-grey">
              Findings
            </h3>
            <p className="text-[12px] font-light text-cpx-grey">
              <span className="font-medium text-cpx-black">{relatedHits.length}</span>{" "}
              matched
            </p>
            <ul className="mt-2 space-y-2">
              {relatedHits.map((h) => (
                <li key={h.id} className="border border-black/10 p-2.5">
                  <p className="text-[13px] font-normal">{h.title}</p>
                  <p className="mt-1 text-[11px] font-light text-cpx-grey">
                    {h.pirRef} · {gstDate(h.firedAt)} · {h.confidence}%
                  </p>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-2 text-[12px] font-medium uppercase tracking-wide text-cpx-grey">
              Advisories
            </h3>
            <p className="text-[12px] font-light text-cpx-grey">
              <span className="font-medium text-cpx-black">
                {relatedAdvisories.length}
              </span>{" "}
              matched
            </p>
            <ul className="mt-2 space-y-2">
              {relatedAdvisories.map((a) => (
                <li key={a.ref}>
                  <Link
                    href={`/reports/${encodeURIComponent(a.ref)}`}
                    className="text-[13px] text-cat-4 underline underline-offset-2"
                  >
                    {a.ref}
                  </Link>
                  <span className="ml-2 text-[12px] font-light">{a.title}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>
    </>
  );
}
