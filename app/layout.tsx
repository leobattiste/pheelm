import { publicPageMetadata, seoText } from "@/lib/seo";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import Link from "next/link";
import BackToTop from "@/components/BackToTop";
import NewsletterForm from "@/components/NewsletterForm";
import TabBar from "@/components/TabBar";
import PhotoZoom from "@/components/PhotoZoom";
import WelcomeNudge from "@/components/WelcomeNudge";
import Toaster from "@/components/Toast";
import NotificationToasts from "@/components/NotificationToasts";
import SiteHeader from "@/components/SiteHeader";
import ThemeToggle from "@/components/ThemeToggle";
import { TransitionWatcher } from "@/components/Transitions";
import NavProgress from "@/components/NavProgress";
import NavProgressLine from "@/components/NavProgressLine";
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

const SWITZER_CSS = "https://api.fontshare.com/v2/css?f[]=switzer@300,400,500,600,700,800&display=swap";
// Turns the font on the moment it lands, whether or not its load event has already gone by.
const SWITZER_SCRIPT = `(function(){var l=document.getElementById('switzer');if(!l)return;var on=function(){l.media='all'};l.addEventListener('load',on);try{if(l.sheet)on()}catch(e){}})()`;

const FOCUS_INPUT_SCRIPT = `(() => {
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
          })();`;

export const metadata: Metadata = {
  ...publicPageMetadata("/"),
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME}: ${SITE_TAGLINE.replace(/\.$/, "")}`, template: `%s | ${SITE_NAME}` },
  description: seoText(SITE_DESCRIPTION),
  applicationName: SITE_NAME,
  keywords: ["Black directors", "Black cinema", "African cinema", "Black filmmakers", "films by Black directors", "Nollywood", "FESPACO", "where to watch", "film directory"],
  category: "entertainment",

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
        {/* Switzer, by the Indian Type Foundry, from Fontshare (ITF Free Font License). Loaded
            without blocking the first paint: media="print" keeps it out of the critical path and
            the script below switches it on once it has arrived. Until then, and if Fontshare is
            slow or unreachable, text is set in Inter, which the site serves itself. */}
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
        <link id="switzer" rel="stylesheet" media="print" href={SWITZER_CSS} />
        <noscript><link rel="stylesheet" href={SWITZER_CSS} /></noscript>
        <link rel="preconnect" href="https://image.tmdb.org" />
        {/* Plain inline scripts, so they run before the first paint: next/script's beforeInteractive
            only runs once the page's JavaScript starts, which showed "Sign in" to members while a
            page was still loading. */}
        <script id="switzer-on" dangerouslySetInnerHTML={{ __html: SWITZER_SCRIPT }} />
        <script id="theme" dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script id="focus-input" dangerouslySetInnerHTML={{ __html: FOCUS_INPUT_SCRIPT }} />
      </head>
      <body>
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
              <p>New films and watchlists, once a month at most.</p>
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
              {/* Footer links sit on every page; the catalogue pages are too big to fetch unasked. */}
              <Link href="/films" prefetch={false}>Films</Link>
              <Link href="/watchlists" prefetch={false}>Watchlists</Link>
              <Link href="/directors" prefetch={false}>Directors</Link>
            </nav>
            <nav aria-labelledby="footer-pheelm">
              <h2 id="footer-pheelm">{SITE_NAME}</h2>
              <Link href="/about">About</Link>
              <Link href="/help">Help</Link>
              <Link href="/shop">Shop</Link>
              <Link href="/partnerships">Partnership</Link>
              <Link href="/contact">Contact</Link>
              <Link className="member-only" href="/submit">Suggest a film</Link>
            </nav>
            <nav className="member-only" aria-labelledby="footer-you">
              <h2 id="footer-you">You</h2>
              <Link className="member-only" href="/me">Watchlists</Link>
              <Link className="member-only" href="/profile">Profile</Link>
              <Link className="member-only" href="/account">Settings</Link>
              {INSTAGRAM_URL && <a className="footer-social-link platform-link" aria-label="Pheelm on Instagram" title="Instagram" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"><Icon name="instagram" /></a>}
              {THREADS_URL && <a className="footer-social-link platform-link" aria-label="Pheelm on Threads" title="Threads" href={THREADS_URL} target="_blank" rel="noopener noreferrer"><Icon name="threads" /></a>}
            </nav>
            <nav aria-labelledby="footer-legal">
              <h2 id="footer-legal">Legal</h2>
              <Link href="/legal#privacy">Privacy</Link>
              <Link href="/legal#terms">Terms</Link>
              <Link href="/legal#copyright">Copyright</Link>
              <Link href="/legal#community-guidelines">Community guidelines</Link>
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
        <PhotoZoom />
        <BackToTop />
        <InstallBanner />
        <WelcomeNudge />
        <Toaster />
        <NotificationToasts />
        <TransitionWatcher />
        <NavProgress />
        <NavProgressLine top />
        <Analytics />
      </body>
    </html>
  );
}
