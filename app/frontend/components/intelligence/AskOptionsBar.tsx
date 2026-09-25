"use client";

// Client, TLP, Depth, Workflow and Output: the row CPX drew above the composer.
//
// Every control here is sent with the question and changes the answer. Nothing
// on this row is decorative, and nothing on it filters what is already on
// screen. Where a setting would be misread, the row says what it means rather
// than trusting the label: a TLP ceiling limits what may be used, and does not
// mark the answer.

import type { Client, Tlp } from "@/lib/types";
import type { AskOptions } from "@/lib/ask-options";
import { DEPTHS, OUTPUTS, TLP_CEILINGS } from "@/lib/ask-options";
import type { Workflow } from "@/lib/types";

export function AskOptionsBar({
  options,
  onChange,
  clients,
  workflows,
  availability,
  disabled,
}: {
  options: AskOptions;
  onChange: (next: AskOptions) => void;
  clients: Client[];
  workflows: Workflow[];
  availability: { ref: string; available: boolean; mode: string; reason?: string | null }[];
  disabled?: boolean;
}) {
  const set = <K extends keyof AskOptions>(key: K, value: AskOptions[K]) =>
    onChange({ ...options, [key]: value });

  // Only a published workflow can be asked for by name. A draft is listed as
  // unavailable rather than hidden, so the roster stays honest.
  const selectable = availability.filter((item) => item.mode !== "investigation");

  const depthHint = DEPTHS.find((d) => d.value === options.depth)?.hint;
  const outputHint = OUTPUTS.find((o) => o.value === options.output)?.hint;

  return (
    <div className="@container border-b border-rule bg-inset/60 px-3 py-2">
      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 @md:grid-cols-3 @2xl:grid-cols-5">
        <Field label="Client">
          <select
            aria-label="Client"
            disabled={disabled}
            value={options.globalOnly ? "__global__" : options.clientId ?? ""}
            onChange={(e) => onChange({ ...options, clientId: e.target.value === "__global__" ? null : e.target.value || null, globalOnly: e.target.value === "__global__" })}
          >
            <option value="">All permitted clients</option>
            <option value="__global__">Global intelligence</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="TLP ceiling">
          <select
            aria-label="TLP ceiling"
            disabled={disabled}
            value={options.tlpCeiling ?? ""}
            onChange={(e) => set("tlpCeiling", (e.target.value || null) as Tlp | null)}
          >
            <option value="">No ceiling</option>
            {TLP_CEILINGS.map((t) => (
              <option key={t} value={t}>
                TLP:{t}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Depth">
          <select
            aria-label="Depth"
            disabled={disabled}
            value={options.depth}
            onChange={(e) => set("depth", e.target.value as AskOptions["depth"])}
          >
            {DEPTHS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Workflow">
          <select
            aria-label="Workflow"
            disabled={disabled}
            value={options.workflow ?? ""}
            onChange={(e) => set("workflow", e.target.value || null)}
          >
            <option value="">Auto-select</option>
            {selectable.map((w) => (
              <option key={w.ref} value={w.ref} disabled={!w.available}>
                {workflows.find((workflow) => workflow.ref === w.ref)?.name ?? w.ref}{!w.available ? " (unavailable)" : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Output">
          <select
            aria-label="Output"
            disabled={disabled}
            value={options.output}
            onChange={(e) => set("output", e.target.value as AskOptions["output"])}
          >
            {OUTPUTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <p className="mt-1.5 text-2xs text-mute">
        {options.tlpCeiling
          ? `Evidence above TLP:${options.tlpCeiling} is excluded and counted. The ceiling does not mark the answer.`
          : `${depthHint} ${outputHint}`}
        {options.workflow && availability.find((item) => item.ref === options.workflow)?.reason}
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-0.5">
      <span className="text-2xs font-medium text-ink-3">{label}</span>
      <span className="[&>select]:h-7 [&>select]:w-full [&>select]:min-w-0 [&>select]:rounded-sm [&>select]:border [&>select]:border-rule [&>select]:bg-surface [&>select]:px-1.5 [&>select]:text-xs [&>select]:transition-colors [&>select]:duration-150 [&>select:hover]:border-rule-strong [&>select:disabled]:text-faint [&>select:focus]:outline-none [&>select:focus]:border-cpx-green">
        {children}
      </span>
    </label>
  );
}
