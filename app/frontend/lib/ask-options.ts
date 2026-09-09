// The five controls that sit above the composer.
//
// Each one is sent to the backend and changes the answer. None of them is a
// display filter, and none of them can make the agent assert something it did
// not retrieve: they steer register, shape and scope, and the TLP ceiling only
// ever removes material.
//
// TLP here is a handling ceiling on what may be used, never a marking stamped
// on the result. An answer's own TLP is settled by its content and renders only
// when classificationSettled is true.

import type { Tlp } from "./types";

export type AskDepth = "executive" | "analyst" | "technical";
export type AskOutput = "narrative" | "bullets" | "table";

export interface AskOptions {
  clientId: string | null;
  tlpCeiling: Tlp | null;
  depth: AskDepth;
  workflow: string | null;
  output: AskOutput;
}

export const DEFAULT_ASK_OPTIONS: AskOptions = {
  clientId: null,
  tlpCeiling: null,
  depth: "analyst",
  workflow: null,
  output: "narrative",
};

export const DEPTHS: { value: AskDepth; label: string; hint: string }[] = [
  {
    value: "executive",
    label: "Executive",
    hint: "Consequence and decision. No commands, no raw indicators.",
  },
  {
    value: "analyst",
    label: "Analyst",
    hint: "Findings, the evidence behind them, and technique detail.",
  },
  {
    value: "technical",
    label: "Technical",
    hint: "Affected versions and detection content where the evidence carries it.",
  },
];

export const OUTPUTS: { value: AskOutput; label: string; hint: string }[] = [
  { value: "narrative", label: "Narrative brief", hint: "A short written brief." },
  { value: "bullets", label: "Bullet points", hint: "A list rather than prose." },
  {
    value: "table",
    label: "Table",
    hint: "A table where the evidence is comparable, prose where it is not.",
  },
];

export const TLP_CEILINGS: Tlp[] = ["CLEAR", "GREEN", "AMBER", "AMBER+STRICT", "RED"];

// True when the analyst has moved anything off its default, which is what the
// composer uses to decide whether to say so on the turn.
export function optionsAreDefault(o: AskOptions): boolean {
  return (
    o.clientId === null &&
    o.tlpCeiling === null &&
    o.depth === "analyst" &&
    o.workflow === null &&
    o.output === "narrative"
  );
}
