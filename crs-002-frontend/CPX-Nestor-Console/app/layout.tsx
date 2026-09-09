import type { Metadata } from "next";
import { Unbounded, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { RoleProvider } from "@/lib/role-context";
import { TopBar } from "@/components/shell/TopBar";
import { NavRail } from "@/components/shell/NavRail";
import { PRODUCT_NAME, PRODUCT_SUBTITLE } from "@/lib/agent";

const unbounded = Unbounded({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-unbounded",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500"],
  variable: "--font-plex-arabic",
});

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} · ${PRODUCT_SUBTITLE}`,
  description: PRODUCT_SUBTITLE,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${unbounded.variable} ${plexArabic.variable}`}>
      <body className="font-sans antialiased">
        <RoleProvider>
          <TopBar />
          <NavRail />
          <main className="ml-16 mt-14 min-h-[calc(100vh-3.5rem)] min-[1100px]:ml-60">
            {children}
          </main>
        </RoleProvider>
      </body>
    </html>
  );
}
