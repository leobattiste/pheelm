"use client";

import { useEffect } from "react";

/** The last-resort error page, for failures in the site's frame itself. Plain on purpose. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error);
    if (!/ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed/i.test(`${error.name} ${error.message}`)) return;
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
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0b0b", color: "#fafafa", fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <div style={{ maxWidth: 480 }}>
          <h1 style={{ fontSize: 33, margin: "0 0 12px" }}>Something went wrong</h1>
          <p style={{ color: "#8c8c8c", margin: "0 0 24px" }}>Pheelm hit a problem while loading. Reloading usually fixes it.</p>
          <button type="button" onClick={() => window.location.reload()} style={{ height: 44, padding: "0 20px", border: 0, borderRadius: 999, background: "#fafafa", color: "#0b0b0b", font: "inherit", fontWeight: 700, cursor: "pointer" }}>
            Reload the page
          </button>
          <p style={{ marginTop: 24, color: "#8c8c8c", fontSize: 12 }}>{error.message || "Unknown error"}{error.digest ? ` (${error.digest})` : ""}</p>
        </div>
      </body>
    </html>
  );
}
