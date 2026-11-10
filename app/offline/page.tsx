import { privateMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = privateMetadata("Offline");

/** Shown by the app when there's no connection and the page wasn't saved for offline. */
export default function OfflinePage() {
  return (
    <section className="page narrow">
      <header className="page-head">
        <h1>You&rsquo;re offline</h1>
        <p className="lead">Pheelm needs a connection for this page. Previously opened public information pages can still work offline; profiles, collections and account pages need a connection.</p>
      </header>
      <div className="actions">
        <a className="button" href="/">Try again</a>
      </div>
    </section>
  );
}
