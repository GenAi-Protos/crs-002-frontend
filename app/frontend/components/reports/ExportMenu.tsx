"use client";

// One dropdown shape, used for Export report, Export template and the row
// actions menu. A menu rather than a row of buttons, because the toolbar on a
// report already carries the decisions that matter and export is not one of
// them.

import { useCallback, useState } from "react";
import { IconChevronDown } from "@/components/icons";
import { buttonClass, useMenu } from "@/components/ui";

export interface MenuItem<T extends string> {
  key: T;
  label: string;
  hint?: string;
  disabled?: boolean;
  // Set on an item that ends the report's working life, so it can be separated
  // from the rest rather than sitting flush against Duplicate.
  separated?: boolean;
}

export function Menu<T extends string>({
  label,
  items,
  onSelect,
  align = "right",
  trigger = "button",
  disabled,
  footer,
}: {
  label: string;
  items: MenuItem<T>[];
  onSelect: (key: T) => void;
  align?: "left" | "right";
  trigger?: "button" | "icon";
  disabled?: boolean;
  footer?: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  // Dismissal, arrow keys and focus return, from the one menu model in ui.tsx.
  const box = useMenu(open, close);

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={trigger === "icon" ? label : undefined}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className={
          trigger === "icon"
            ? "flex h-7 w-7 items-center justify-center text-cpx-grey-500 hover:bg-cpx-grey-50 disabled:text-cpx-grey-400"
            : buttonClass("secondary", "sm")
        }
      >
        {trigger === "icon" ? (
          <span aria-hidden className="text-md leading-none">
            &#8942;
          </span>
        ) : (
          <>
            {label}
            <IconChevronDown className={open ? "rotate-180" : ""} />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={`reveal absolute z-50 mt-1 min-w-[13rem] border border-cpx-grey-100 bg-white py-1 shadow-pop ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((it) => (
            <div key={it.key}>
              {it.separated && <div className="my-1 border-t border-cpx-grey-100" />}
              <button
                role="menuitem"
                disabled={it.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onSelect(it.key);
                }}
                className="block w-full px-3 py-1.5 text-left text-xs hover:bg-cpx-grey-50 disabled:text-cpx-grey-400 disabled:hover:bg-transparent"
              >
                {it.label}
                {it.hint && (
                  <span className="mt-0.5 block text-2xs text-cpx-grey-500">
                    {it.hint}
                  </span>
                )}
              </button>
            </div>
          ))}
          {footer && (
            <p className="mt-1 border-t border-cpx-grey-100 px-3 pt-1.5 text-2xs text-cpx-grey-500">
              {footer}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
