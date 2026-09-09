// IOC lookup: which kind of observable this is, and what we hold on it.
//
// The demo records use reserved documentation ranges only, so nothing on this
// screen resolves even if a value were copied out of it: TEST-NET-2
// (198.51.100.0/24), TEST-NET-3 (203.0.113.0/24) and .example domains. That is
// deliberate. A screenshot of this feature must never carry a live indicator.

import lookupsJson from "@/fixtures/lookups.json";
import type { LookupRecord, ObservableKind } from "./types";

export const LOOKUPS = lookupsJson as unknown as LookupRecord[];

export const KIND_LABEL: Record<ObservableKind, string> = {
  ip: "IP address",
  domain: "Domain",
  hash: "File hash",
};

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const HASH = /^[a-f0-9]{32}$|^[a-f0-9]{40}$|^[a-f0-9]{64}$/i;
const DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

// Best effort only. The dropdown is authoritative: this fills it in when the
// analyst pastes rather than chooses.
export function detectKind(value: string): ObservableKind | null {
  const v = value.trim();
  if (HASH.test(v)) return "hash";
  if (IPV4.test(v)) return "ip";
  if (DOMAIN.test(v)) return "domain";
  return null;
}

export function hashAlgorithm(value: string): string {
  const n = value.trim().length;
  if (n === 32) return "MD5";
  if (n === 40) return "SHA-1";
  if (n === 64) return "SHA-256";
  return "Unrecognised length";
}

// A value the analyst can click to see the feature work, one per kind.
export function samplesFor(kind: ObservableKind): string[] {
  return LOOKUPS.filter((l) => l.kind === kind).map((l) => l.observable);
}

export function findLookup(observable: string): LookupRecord | null {
  const v = observable.trim().toLowerCase();
  return LOOKUPS.find((l) => l.observable.toLowerCase() === v) ?? null;
}

// Wrong kind chosen for the value typed. Worth saying, never worth blocking:
// the analyst may know something the pattern does not.
export function kindMismatch(value: string, chosen: ObservableKind): boolean {
  const detected = detectKind(value);
  return detected !== null && detected !== chosen;
}

export const VERDICT_LABEL = {
  malicious: "Malicious",
  suspicious: "Suspicious",
  benign: "Benign",
  unknown: "Unknown",
} as const;

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
