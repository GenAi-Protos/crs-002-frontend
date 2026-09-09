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
  disabled,
}: {
  options: AskOptions;
  onChange: (next: AskOptions) => void;
  clients: Client[];
  workflows: Workflow[];
  disabled?: boolean;
}) {
  const set = <K extends keyof AskOptions>(key: K, value: AskOptions[K]) =>
    onChange({ ...options, [key]: value });

  // Only a published workflow can be asked for by name. A draft is listed as
  // unavailable rather than hidden, so the roster stays honest.
  const published = workflows.filter((w) => w.status === "published");
  const draftCount = workflows.length - published.length;

  const depthHint = DEPTHS.find((d) => d.value === options.depth)?.hint;
  const outputHint = OUTPUTS.find((o) => o.value === options.output)?.hint;

  return (
    <div className="border-b border-cpx-grey-100 px-3 py-2.5">
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
        <Field label="Client">
          <select
            disabled={disabled}
            value={options.clientId ?? ""}
            onChange={(e) => set("clientId", e.target.value || null)}
          >
            <option value="">Global</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="TLP ceiling">
          <select
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
            disabled={disabled}
            value={options.workflow ?? ""}
            onChange={(e) => set("workflow", e.target.value || null)}
          >
            <option value="">Auto-select</option>
            {published.map((w) => (
              <option key={w.ref} value={w.ref}>
                {w.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Output">
          <select
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

      <p className="mt-2 text-2xs text-cpx-grey-500">
        {options.tlpCeiling
          ? `Evidence above TLP:${options.tlpCeiling} is excluded and counted. The ceiling does not mark the answer.`
          : `${depthHint} ${outputHint}`}
        {options.workflow === null && draftCount > 0 && (
          <>
            {" "}
            {draftCount} further {draftCount === 1 ? "workflow is" : "workflows are"}{" "}
            in draft and cannot be requested by name.
          </>
        )}
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-0.5">
      <span className="text-2xs text-cpx-grey-500">{label}</span>
      <span className="[&>select]:h-8 [&>select]:w-full [&>select]:min-w-0 [&>select]:border [&>select]:border-cpx-grey-100 [&>select]:bg-white [&>select]:px-2 [&>select]:text-xs [&>select:disabled]:text-cpx-grey-400 [&>select:focus]:outline-none [&>select:focus]:border-cpx-green">
        {children}
      </span>
    </label>
  );
}
