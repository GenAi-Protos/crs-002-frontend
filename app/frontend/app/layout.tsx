import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { RoleProvider } from "@/lib/role-context";
import { TopBar } from "@/components/shell/TopBar";
import { NavRail } from "@/components/shell/NavRail";
import { PRODUCT_NAME, PRODUCT_SUBTITLE } from "@/lib/agent";
import { publicEnv } from "@/lib/runtime-env";
import { themeScript } from "@/lib/theme";

// Read the live container env on every request (not at build) so the runtime config
// injected below reflects the Container App env vars without a rebuild.
export const dynamic = "force-dynamic";

// CPX brand type, self-hosted from app/fonts: no build-time fetch, because the CPX
// build runner has no egress to font CDNs. See app/fonts/README.md for the files.
const unbounded = localFont({
  src: "./fonts/unbounded-latin-wght-normal.woff2",
  weight: "200 900",
  variable: "--font-unbounded",
  display: "swap",
});

const inter = localFont({
  src: "./fonts/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
});

// Declared for Arabic content; not preloaded, so it only downloads when used.
const plexArabic = localFont({
  src: [
    { path: "./fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2", weight: "400" },
    { path: "./fonts/ibm-plex-sans-arabic-arabic-500-normal.woff2", weight: "500" },
  ],
  variable: "--font-plex-arabic",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} · ${PRODUCT_SUBTITLE}`,
  description: PRODUCT_SUBTITLE,
  icons: { icon: "/cpx-logo-primary.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Runtime public config for client components. `<` is escaped so a stray "</script>"
  // in a value cannot break out of the tag. Runs in document order, before the app
  // bundle, so window.__ENV exists at hydration.
  const envScript = `window.__ENV=${JSON.stringify(publicEnv()).replace(/</g, "\\u003c")}`;
  return (
    // suppressHydrationWarning: the theme script sets data-theme on <html>
    // before React hydrates, so the server's markup never carries it.
    <html
      lang="en"
      className={`${unbounded.variable} ${inter.variable} ${plexArabic.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Before first paint: the stored theme, else the OS preference (lib/theme.ts). */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      {/* The Teams-tab shell, the same shape as the other CPX consoles: the body
          is a fixed-height box that never scrolls, and <main> is the one scroll
          region. Inside a Teams tab that means one scrollbar, sticky bars that
          measure against the tab rather than the window, and a composer that
          pins to the tab's own bottom edge. tabIndex=0 on main because a scroll
          container is not focusable by default, and without focus PageDown and
          End do nothing in a non-scrolling document. */}
      <body className="flex h-dvh flex-col overflow-hidden font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: envScript }} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:bg-surface focus:px-3 focus:py-2 focus:text-ink"
        >
          Skip to content
        </a>
        <RoleProvider>
          <TopBar />
          <div className="flex min-h-0 flex-1">
            <NavRail />
            <main
              id="main"
              tabIndex={0}
              aria-label="Page content"
              className="cpx-scroll flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden scroll-smooth focus-visible:-outline-offset-2"
            >
              {children}
            </main>
          </div>
        </RoleProvider>
      </body>
    </html>
  );
}
