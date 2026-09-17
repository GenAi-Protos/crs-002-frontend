// The pieces of a turn the Intelligence page needs before any answer exists.
// No fixture import here: lib/ask.ts carries the fixture-backed resolver, and
// a page that only needs to open a turn must not pay for the investigations.

import type { Turn } from "./types";

let seq = 0;
export function nextTurnId(): string {
  seq += 1;
  return `local-${seq}`;
}

export function makeTurn(question: string): Turn {
  return { id: nextTurnId(), question, status: "streaming" };
}

export const STARTER_PROMPTS = [
  "What do we know about the wp2shell campaign and which clients are exposed?",
  "Trace the DPRK fleet software supply chain campaign and its reach into GCC logistics operators.",
  "Create an intelligence advisory for the DPRK fleet software supply chain campaign.",
];
