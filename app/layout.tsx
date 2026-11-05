import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import Link from "next/link";
import Script from "next/script";
import Search from "@/components/Search";
import SiteHeader from "@/components/SiteHeader";
import ThemeToggle from "@/components/ThemeToggle";
import { TransitionWatcher } from "@/components/Transitions";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { SITE_URL } from "@/lib/supabase/config";
import { themeScript } from "@/lib/theme";
import "./globals.css";

// One typeface, Nacelle by Dotcolon (SIL Open Font License), served from the site itself.
const nacelle = localFont({
  src: [
    { path: "./fonts/Nacelle-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Nacelle-Italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/Nacelle-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/Nacelle-Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/Nacelle-Heavy.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-nacelle",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: { siteName: SITE_NAME, type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0c" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" data-grid="large" className={nacelle.variable} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://image.tmdb.org" />
      </head>
      <body>
        <Script id="theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <a className="skip" href="#main">Skip to content</a>
        <SiteHeader />
        <main id="main">{children}</main>
        <footer className="site-footer">
          <div className="footer-about">
            <Link href="/" className="footer-mark">{SITE_NAME}</Link>
            <p>{SITE_TAGLINE}</p>
          </div>
          <nav aria-label="Footer">
            <Link href="/films">Films</Link>
            <Link href="/directors">Directors</Link>
            <Link href="/collections">Collections</Link>
            <Link href="/journal">Journal</Link>
            <Link href="/submit">Submit a film</Link>
            <Link href="/me">Watchlist</Link>
          </nav>
          <div className="footer-bottom">
            <ThemeToggle />
            <p>
              Posters and stills belong to their filmmakers and distributors.
              {/* TMDB's free tier requires this credit once its data is in use. */}
              {process.env.TMDB_API_KEY && " Film data and images from TMDB. This site uses the TMDB API but is not endorsed or certified by TMDB."}
            </p>
          </div>
        </footer>
        <Search />
        <TransitionWatcher />
        <Analytics />
      </body>
    </html>
  );
}
