// The theme choice: light or dark, stored per browser once the analyst picks,
// the OS preference until then. No "use client": the root layout (a server
// component) inlines the script below and ThemeToggle shares the key.

export type Theme = "light" | "dark";

export const THEME_KEY = "nestor:theme";

// Runs in <head>, before first paint, so a dark console never flashes light.
// Storage can throw in a locked-down Teams webview; the OS preference decides
// then. Tokens in app/globals.css resolve through color-scheme, which this sets
// via the data-theme attribute.
export const themeScript = `(function(){var t;try{t=localStorage.getItem("${THEME_KEY}")}catch(e){}if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t})()`;
