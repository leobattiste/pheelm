"use client";

import { useState } from "react";
import { refreshCastAndCrew } from "./actions";

/** Adds every film's missing cast and crew from TMDB, ten films at a time. */
export default function CreditsRefresh() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState("");

  const run = async () => {
    setRunning(true);
    setMessage("");
    let offset = 0, added = 0, failed = 0;
    for (;;) {
      const r = await refreshCastAndCrew(offset);
      if (!r.ok) { setMessage(r.message); break; }
      added += r.added;
      failed += r.failed;
      setProgress({ done: r.next, total: r.total });
      if (r.next >= r.total || r.next === offset) {
        setMessage(`Done. Added ${added.toLocaleString()} cast and crew credits${failed ? `; ${failed} ${failed === 1 ? "film" : "films"} couldn't be reached on TMDB (run it again to retry)` : ""}. Then run "Fill people details" for the new people's biographies.`);
        break;
      }
      offset = r.next;
    }
    setRunning(false);
  };

  return (
    <div className="form">
      <p className="muted">Films added earlier kept only the first 12 of the cast and 3 producers. This adds everyone else TMDB lists, in billing order. Nothing already there is changed or removed.</p>
      <div className="actions">
        <button className="button" type="button" onClick={run} disabled={running}>
          {running ? `Adding… ${progress ? `${progress.done} of ${progress.total}` : ""}` : "Add full cast and crew"}
        </button>
      </div>
      {message && <p className="muted" role="status">{message}</p>}
    </div>
  );
}
