import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_UPDATED, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "Terms", description: `The terms for using ${SITE_NAME}.` };

export default function TermsPage() {
  return (
    <article className="page narrow info-page">
      <header className="page-head">
        <h1>Terms</h1>
        <p className="lead">The terms for using {SITE_NAME}. Updated {LEGAL_UPDATED}.</p>
      </header>
      <div className="prose">
        <h2>Using {SITE_NAME}</h2>
        <p>
          {SITE_NAME} is free to browse. By using it you agree to these terms. If you don&rsquo;t agree, please don&rsquo;t use the site.
        </p>

        <h2>Your account</h2>
        <p>
          You need an account to keep a watchlist, make collections or suggest films. Keep access to your email secure, since
          that&rsquo;s how you sign in. You can delete your account at any time by <Link href="/contact?topic=privacy">contacting us</Link>.
        </p>

        <h2>What you add</h2>
        <p>
          Collections you make public, and films you suggest, should be your own work and lawful. By adding them you let {SITE_NAME} show them on
          the site. We may edit or remove anything that breaks these terms. Suggested films are reviewed before they&rsquo;re added, and we
          decide what goes in the directory.
        </p>

        <h2>Please don&rsquo;t</h2>
        <ul>
          <li>Copy the directory in bulk, scrape it, or overload the site.</li>
          <li>Use the forms to send spam, abuse or anything unlawful.</li>
          <li>Try to get into accounts or parts of the site that aren&rsquo;t yours.</li>
        </ul>

        <h2>Films, posters and information</h2>
        <p>
          Posters, stills and trailers belong to their filmmakers and distributors and are shown to help people find the films. Film information
          comes partly from TMDB and JustWatch. {SITE_NAME} uses the TMDB API but is not endorsed or certified by TMDB. We work to keep everything
          accurate, but details, awards and where-to-watch information can be incomplete or change. <Link href="/contact?topic=correction">Tell us</Link>{" "}
          about mistakes and we&rsquo;ll fix them.
        </p>

        <h2>Other sites</h2>
        <p>Links to streaming services, IMDb, Instagram and others take you to sites we don&rsquo;t run, where their own terms apply.</p>

        <h2>No guarantees</h2>
        <p>
          {SITE_NAME} is provided as it is. We can&rsquo;t promise it will always be available or free of errors, and to the extent the law
          allows, we&rsquo;re not responsible for losses from using it.
        </p>

        <h2>Changes</h2>
        <p>We may update these terms. The date at the top shows when they last changed. Using the site after a change means you accept the new terms.</p>

        <h2>Questions</h2>
        <p><Link href="/contact">Contact us</Link> with any questions about these terms.</p>
      </div>
    </article>
  );
}
