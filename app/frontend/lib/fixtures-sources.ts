// The 185-row source inventory, on its own. It is the one heavy fixture: 30
// days of collection counts per source, and four derivations per row at load.
// Only the Collection screens read it, so it lives apart from lib/fixtures.ts
// and no other route carries it in its bundle.
//
// Derived fields are computed here, at load, so no component ever derives or
// stores collector class, capture mode or residency.

import sourcesJson from "@/fixtures/sources.json";
import type { Source } from "./types";
import { deriveCaptureMode, deriveCategory, deriveClass, deriveResidency } from "./derive";

type StoredSource = Omit<Source, "collectorClass" | "captureMode" | "residency" | "category">;

export const SOURCES: Source[] = (sourcesJson as StoredSource[]).map((s) => {
  const collectorClass = deriveClass(s.url);
  return {
    ...s,
    collectorClass,
    captureMode: deriveCaptureMode(collectorClass),
    category: deriveCategory(s),
    residency: deriveResidency(s.url),
  };
});
