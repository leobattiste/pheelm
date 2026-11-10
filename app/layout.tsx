import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import Link from "next/link";
import Script from "next/script";
import BackToTop from "@/components/BackToTop";
import NewsletterForm from "@/components/NewsletterForm";
import Search from "@/components/Search";
import TabBar from "@/components/TabBar";
import WelcomeNudge from "@/components/WelcomeNudge";
import SiteHeader from "@/components/SiteHeader";
import ThemeToggle from "@/components/ThemeToggle";
import { TransitionWatcher } from "@/components/Transitions";
import Icon from "@/components/Icon";
import { WORDMARK, INSTAGRAM_URL, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, THREADS_URL } from "@/lib/site";
import { SITE_URL } from "@/lib/supabase/config";
import { themeScript } from "@/lib/theme";
import "./globals.css";
import InstallBanner from "@/components/InstallBanner";

// The typeface is Switzer, loaded from Fontshare in the head. Inter (SIL Open Font License), served
// from the site itself, backs it up: for letters Switzer doesn't have, like ẹ and ọ in Yoruba
// titles, and while Switzer loads.
const inter = localFont({
  src: "./fonts/Inter-Latin.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
  preload: false,
});
const interExt = localFont({
  src: "./fonts/Inter-LatinExt.woff2",
  weight: "100 900",
  variable: "--font-inter-ext",
  display: "swap",
  preload: false,
});

// The wordmark only: Beth Ellen by Rob Jelinski (SIL Open Font License).
const bethEllen = localFont({
  src: "./fonts/BethEllen-Regular.woff2",
  weight: "400",
  variable: "--font-wordmark",
  display: "block",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME}: ${SITE_TAGLINE.replace(/\.$/, "")}`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["Black directors", "Black cinema", "African cinema", "Black filmmakers", "films by Black directors", "Nollywood", "FESPACO", "where to watch", "film directory"],
  category: "entertainment",
  openGraph: { siteName: SITE_NAME, type: "website", locale: "en_US" },
  twitter: { card: "summary_large_image" },
  // Added to a home screen, Pheelm opens full screen like an app (see app/manifest.ts).
  appleWebApp: { capable: true, title: "Pheelm", statusBarStyle: "black" },
  formatDetection: { telephone: false },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
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
    <html lang="en" data-theme="dark" data-grid="large" className={`${inter.variable} ${interExt.variable} ${bethEllen.variable}`} suppressHydrationWarning>
      <head>
        {/* Switzer, by the Indian Type Foundry, from Fontshare (ITF Free Font License). */}
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=switzer@300,400,500,600,700,800&display=swap" />
        <link rel="preconnect" href="https://image.tmdb.org" />
      </head>
      <body>
        <Script id="focus-input" strategy="beforeInteractive">
          {`(() => {
            const root = document.documentElement;
            document.addEventListener("pointerdown", (event) => {
              if (event.pointerType === "touch") root.dataset.focusInput = "touch";
              else delete root.dataset.focusInput;
            }, true);
            document.addEventListener("keydown", (event) => {
              if (!event.altKey && !event.ctrlKey && !event.metaKey) {
                delete root.dataset.focusInput;
              }
            }, true);
          })();`}
        </Script>
        <Script id="theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <a className="skip" href="#main">Skip to content</a>
        <SiteHeader />
        <main id="main" tabIndex={-1}>{children}</main>
        <footer className="site-footer">
          <div className="footer-top">
            <div className="footer-about">
              <Link href="/" className="footer-mark wordmark-type" aria-label={`${SITE_NAME}, home`}>{WORDMARK}</Link>
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
                        <Icon name="instagram" />
                      </a>
                    </li>
                  )}
                  {THREADS_URL && (
                    <li>
                      <a href={THREADS_URL} target="_blank" rel="noopener noreferrer" className="icon-button" aria-label="Pheelm on Threads">
                        <Icon name="threads" />
                      </a>
                    </li>
                  )}
                </ul>
              )}
            </section>
          </div>
          <div className="footer-links">
            <nav className="member-only" aria-labelledby="footer-explore">
              <h2 id="footer-explore">Explore</h2>
              <Link href="/films">Films</Link>
              <Link href="/collections">Watchlists</Link>
              <Link href="/directors">Directors</Link>
            </nav>
            <nav aria-labelledby="footer-pheelm">
              <h2 id="footer-pheelm">{SITE_NAME}</h2>
              <Link href="/about">About</Link>
              <Link href="/help">Help</Link>
              <Link href="/partnerships">Partnership</Link>
              <Link href="/contact">Contact</Link>
              <Link className="member-only" href="/submit">Suggest a film</Link>
            </nav>
            <nav aria-labelledby="footer-you">
              <h2 id="footer-you">You</h2>
              <Link className="member-only" href="/me">Watchlist</Link>
              <Link className="member-only" href="/profile">Profile</Link>
              <Link className="member-only" href="/account">Settings</Link>
              <Link href="/newsletter">Newsletter</Link>
              {INSTAGRAM_URL && <a className="footer-social-link platform-link" aria-label="Pheelm on Instagram" title="Instagram" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"><Icon name="instagram" /></a>}
              {THREADS_URL && <a className="footer-social-link platform-link" aria-label="Pheelm on Threads" title="Threads" href={THREADS_URL} target="_blank" rel="noopener noreferrer"><Icon name="threads" /></a>}
            </nav>
            <nav aria-labelledby="footer-legal">
              <h2 id="footer-legal">Legal</h2>
              <Link href="/legal">Legal</Link>
            </nav>
          </div>
          <div className="footer-bottom">
            <div className="footer-tools">
              <ThemeToggle />
            </div>
            <p>
              &copy; {new Date().getFullYear()} {SITE_NAME}. A project by Leo Battiste with the courtesy of TMDB.
            </p>
          </div>
        </footer>
        <TabBar />
        <BackToTop />
        <InstallBanner />
        <WelcomeNudge />
        <Search />
        <TransitionWatcher />
        <Analytics />
      </body>
    </html>
  );
}
