"use client";

import { useEffect, useState } from "react";
import { IconButton } from "@/components/ui";
import { IconMoon, IconSun } from "@/components/icons";
import { THEME_KEY, type Theme } from "@/lib/theme";

const DARK = "(prefers-color-scheme: dark)";

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

// The pre-paint script (lib/theme.ts) has already set data-theme; this only
// flips it. A click crossfades the whole console over 200ms through a view
// transition; reduced motion, or a browser without the API, switches at once.
function apply(theme: Theme, animate: boolean) {
  const set = () => {
    document.documentElement.dataset.theme = theme;
  };
  if (animate && document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.startViewTransition(set);
  } else {
    set();
  }
}

// A toggle button with one constant name, "Dark theme", and aria-pressed for
// its state. Both icons are drawn and the theme decides which shows, so the
// icon is right from first paint, before this component has hydrated.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    // Until the analyst picks, the console follows the OS as it changes.
    const mq = matchMedia(DARK);
    const onChange = () => {
      if (stored()) return;
      const next = mq.matches ? "dark" : "light";
      apply(next, false);
      setTheme(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggle = () => {
    const next: Theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Not remembered; still applied for this visit.
    }
    apply(next, true);
    setTheme(next);
  };

  const icon = "transition-[opacity,rotate,scale] duration-200 ease-out-quart";
  return (
    <IconButton
      label="Dark theme"
      aria-pressed={theme === null ? undefined : theme === "dark"}
      title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggle}
      className="relative"
    >
      <IconMoon className={`${icon} dark:rotate-90 dark:scale-50 dark:opacity-0`} />
      <IconSun className={`${icon} absolute -rotate-90 scale-50 opacity-0 dark:rotate-0 dark:scale-100 dark:opacity-100`} />
    </IconButton>
  );
}
