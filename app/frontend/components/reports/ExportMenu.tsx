"use client";

// One dropdown shape, used for Export report, Export template and the row
// actions menu. A menu rather than a row of buttons, because the toolbar on a
// report already carries the decisions that matter and export is not one of
// them.

import { useEffect, useRef, useState } from "react";
import { IconChevronDown } from "@/components/icons";
import { buttonClass } from "@/components/ui";

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
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

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
            ? "flex h-7 w-7 items-center justify-center text-cpx-grey hover:bg-black/5 disabled:text-black/20"
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
          className={`absolute z-50 mt-1 min-w-[13rem] border border-black/10 bg-white py-1 shadow-sm ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((it) => (
            <div key={it.key}>
              {it.separated && <div className="my-1 border-t border-black/10" />}
              <button
                role="menuitem"
                disabled={it.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onSelect(it.key);
                }}
                className="block w-full px-3 py-1.5 text-left text-xs hover:bg-black/[0.04] disabled:text-black/25 disabled:hover:bg-transparent"
              >
                {it.label}
                {it.hint && (
                  <span className="mt-0.5 block text-2xs text-cpx-grey">
                    {it.hint}
                  </span>
                )}
              </button>
            </div>
          ))}
          {footer && (
            <p className="mt-1 border-t border-black/10 px-3 pt-1.5 text-2xs text-cpx-grey">
              {footer}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
