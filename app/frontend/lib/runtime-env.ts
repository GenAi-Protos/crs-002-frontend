/**
 * Runtime public config, read in BOTH server and browser, with NO image rebuild.
 *
 * These are plain (non-NEXT_PUBLIC_) env vars, so Next never inlines them into the
 * browser bundle at build time. The server reads them from the live container env on
 * each request (the root layout is force-dynamic); RootLayout serialises them into
 * `window.__ENV` so client components read the same values after hydration. Set them as
 * Container App env vars and they take effect on the next restart. The dev image is
 * promoted to uat unchanged, which is why these cannot be build-time values.
 */
export type PublicEnv = {
  API_BASE_URL: string;
  // "true" shows the dev-only role switcher in the top bar. It changes the view, never
  // the data contract (CLAUDE.md rule 9).
  ROLE_SWITCHER: string;
};

const DEFAULTS: PublicEnv = {
  API_BASE_URL: "http://localhost:8000",
  ROLE_SWITCHER: "false",
};

declare global {
  interface Window {
    __ENV?: Partial<PublicEnv>;
  }
}

export function publicEnv(): PublicEnv {
  const src: Partial<PublicEnv> =
    typeof window !== "undefined"
      ? (window.__ENV ?? {})
      : {
          API_BASE_URL: process.env.API_BASE_URL,
          ROLE_SWITCHER: process.env.ROLE_SWITCHER,
        };
  // `||` (not `??`) so a blank env value falls back too.
  return {
    API_BASE_URL: src.API_BASE_URL || DEFAULTS.API_BASE_URL,
    ROLE_SWITCHER: src.ROLE_SWITCHER || DEFAULTS.ROLE_SWITCHER,
  };
}
