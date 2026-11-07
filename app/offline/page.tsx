import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };

/** Shown by the app when there's no connection and the page wasn't saved for offline. */
export default function OfflinePage() {
  return (
    <section className="page narrow">
      <header className="page-head">
        <h1>You&rsquo;re offline</h1>
        <p className="lead">Pheelm needs a connection for this page. Pages you&rsquo;ve opened recently still work offline.</p>
      </header>
      <div className="actions">
        <a className="button" href="/">Try again</a>
      </div>
    </section>
  );
}
