import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { RoleProvider } from "@/lib/role-context";
import { TopBar } from "@/components/shell/TopBar";
import { NavRail } from "@/components/shell/NavRail";
import { PRODUCT_NAME, PRODUCT_SUBTITLE } from "@/lib/agent";
import { publicEnv } from "@/lib/runtime-env";

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
    <html
      lang="en"
      className={`${unbounded.variable} ${inter.variable} ${plexArabic.variable}`}
    >
      <body className="font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: envScript }} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:bg-white focus:px-3 focus:py-2 focus:text-cpx-black"
        >
          Skip to content
        </a>
        <RoleProvider>
          <TopBar />
          <NavRail />
          <main
            id="main"
            tabIndex={-1}
            className="ml-16 mt-14 min-h-[calc(100vh-3.5rem)] focus:outline-none rail:ml-60"
          >
            {children}
          </main>
        </RoleProvider>
      </body>
    </html>
  );
}
