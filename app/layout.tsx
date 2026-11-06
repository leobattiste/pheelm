import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import Link from "next/link";
import Script from "next/script";
import BackToTop from "@/components/BackToTop";
import NewsletterForm from "@/components/NewsletterForm";
import Search from "@/components/Search";
import SiteHeader from "@/components/SiteHeader";
import ThemeToggle from "@/components/ThemeToggle";
import { TransitionWatcher } from "@/components/Transitions";
import Icon from "@/components/Icon";
import { INSTAGRAM_URL, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, THREADS_URL } from "@/lib/site";
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
  ],
  variable: "--font-nacelle",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME}: ${SITE_TAGLINE.replace(/\.$/, "")}`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: { siteName: SITE_NAME, type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0b" },
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
          <div className="footer-top">
            <div className="footer-about">
              <Link href="/" className="footer-mark">{SITE_NAME}</Link>
              <p>{SITE_TAGLINE}</p>
            </div>
            <section className="footer-follow" aria-labelledby="footer-follow">
              <h2 id="footer-follow">Get the newsletter</h2>
              <p>New films and collections, once a month at most.</p>
              <NewsletterForm />
              {(INSTAGRAM_URL || THREADS_URL) && (
                <ul className="footer-social" aria-label="Follow Pheelm">
                  {INSTAGRAM_URL && (
                    <li>
                      <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="icon-button" aria-label="Pheelm on Instagram">
                        <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="4" /><circle cx="10" cy="10" r="3.2" /><circle cx="14.2" cy="5.8" r="0.6" /></svg>
                      </a>
                    </li>
                  )}
                  {THREADS_URL && (
                    <li>
                      <a href={THREADS_URL} target="_blank" rel="noopener noreferrer" className="icon-button" aria-label="Pheelm on Threads">
                        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M13.6 9.3c-.4-2.3-2-3.3-3.8-3.3-2.2 0-3.6 1.6-3.6 4 0 2.6 1.5 4.1 3.8 4.1 1.9 0 3.2-1.1 3.2-2.6 0-1.6-1.4-2.4-3.2-2.4-1.3 0-2.2.6-2.2 1.5 0 .8.7 1.3 1.6 1.3 1.6 0 2.4-1.3 2.4-3.6 0-3.6-1.9-5.3-4.9-5.3C5.4 3 3 5.5 3 10s2.4 7 6 7c2.6 0 4.6-1.2 5.6-3.2" /></svg>
                      </a>
                    </li>
                  )}
                </ul>
              )}
            </section>
          </div>
          <div className="footer-links">
            <nav aria-labelledby="footer-explore">
              <h2 id="footer-explore">Explore</h2>
              <Link href="/films">Films</Link>
              <Link href="/collections">Collections</Link>
              <Link href="/directors">Directors</Link>
            </nav>
            <nav aria-labelledby="footer-pheelm">
              <h2 id="footer-pheelm">{SITE_NAME}</h2>
              <Link href="/about">About</Link>
              <Link href="/partnerships">Partnerships</Link>
              <Link href="/contact">Contact</Link>
              <Link href="/submit">Submit a film</Link>
            </nav>
            <nav aria-labelledby="footer-you">
              <h2 id="footer-you">You</h2>
              <Link href="/me">Watchlist</Link>
              <Link href="/profile">Profile</Link>
              <Link href="/account">Settings</Link>
              <Link href="/newsletter">Newsletter</Link>
              {INSTAGRAM_URL && <a className="footer-social-link" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"><Icon name="instagram" />Instagram</a>}
              {THREADS_URL && <a className="footer-social-link" href={THREADS_URL} target="_blank" rel="noopener noreferrer"><Icon name="threads" />Threads</a>}
            </nav>
            <nav aria-labelledby="footer-legal">
              <h2 id="footer-legal">Legal</h2>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
            </nav>
          </div>
          <div className="footer-bottom">
            <div className="footer-tools">
              <ThemeToggle />
              <BackToTop />
            </div>
            <p>
              &copy; {new Date().getFullYear()} {SITE_NAME}. Posters and stills belong to their filmmakers and distributors.
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
