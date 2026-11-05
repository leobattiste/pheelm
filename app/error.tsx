"use client";

import Link from "next/link";
import { useEffect } from "react";

/** After a new version goes live, a page opened earlier asks for code files that no longer exist. */
const isStaleVersion = (e: Error) =>
  /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed/i.test(`${e.name} ${e.message}`);

/**
 * Shown when a page fails in the browser. If the cause is a page left open across an update, it
 * reloads once to pick up the new version; otherwise it explains and offers a way back.
 */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    if (!isStaleVersion(error)) return;
    // Reload at most once a minute, so a real problem can't cause a reload loop.
    try {
      const last = Number(sessionStorage.getItem("reloaded-for-update") ?? 0);
      if (Date.now() - last < 60_000) return;
      sessionStorage.setItem("reloaded-for-update", String(Date.now()));
    } catch {
      return;
    }
    window.location.reload();
  }, [error]);

  return (
    <section className="page narrow error-page">
      <h1>Something went wrong</h1>
      <p className="lead">This page hit a problem while loading. Trying again usually fixes it.</p>
      <div className="actions">
        <button type="button" className="button" onClick={() => window.location.reload()}>Reload the page</button>
        <Link className="button ghost" href="/">Go to the home page</Link>
      </div>
      <p className="error-detail">{error.message || "Unknown error"}{error.digest ? ` (${error.digest})` : ""}</p>
    </section>
  );
}
