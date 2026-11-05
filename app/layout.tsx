import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import Link from "next/link";
import Script from "next/script";
import SiteHeader from "@/components/SiteHeader";
import ThemeToggle from "@/components/ThemeToggle";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { SITE_URL } from "@/lib/supabase/config";
import { themeScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: { siteName: SITE_NAME, type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Bowlby+One&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Script id="theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <footer className="site-footer">
          <div className="footer-top">
            <div className="footer-about">
              <Link href="/" className="footer-mark">
                {SITE_NAME}
              </Link>
              <p>{SITE_TAGLINE} Posters and stills belong to their filmmakers and distributors.</p>
            </div>
            <nav aria-label="Footer">
              <Link href="/films">Films</Link>
              <Link href="/directors">Directors</Link>
              <Link href="/collections">Collections</Link>
              <Link href="/journal">Journal</Link>
              <Link href="/submit">Submit a film</Link>
              <Link href="/me">Your watchlist</Link>
            </nav>
          </div>
          <div className="footer-bottom">
            <ThemeToggle />
            {/* TMDB's free tier requires this credit once its data is in use. */}
            {process.env.TMDB_API_KEY && (
              <p className="footer-credit">Film data and posters from TMDB. This site uses the TMDB API but is not endorsed or certified by TMDB.</p>
            )}
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
