// Labels for an observable, shared by the lookup, the investigation view and
// the search matcher. A three-line map of its own so the matcher, which runs
// in the shell on every route, does not import the held lookup records.

import type { ObservableKind } from "./types";

export const KIND_LABEL: Record<ObservableKind, string> = {
  ip: "IP address",
  domain: "Domain",
  hash: "File hash",
};
