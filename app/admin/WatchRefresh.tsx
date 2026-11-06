"use client";

import { useState } from "react";
import { refreshWatch } from "./actions";

/** Refreshes every film's streaming services and logos from TMDB, fifteen at a time. */
export default function WatchRefresh() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState("");

  const run = async () => {
    setRunning(true);
    setMessage("");
    let offset = 0;
    for (;;) {
      const r = await refreshWatch(offset);
      if (!r.ok) { setMessage(r.message); break; }
      setProgress({ done: r.next, total: r.total });
      if (r.next >= r.total || r.next === offset) { setMessage("Where to watch is up to date, with service logos."); break; }
      offset = r.next;
    }
    setRunning(false);
  };

  return (
    <div className="form">
      <p className="muted">Streaming services change often. This checks TMDB again for every film and adds each service&rsquo;s logo. Links you added by hand stay.</p>
      <div className="actions">
        <button className="button" type="button" onClick={run} disabled={running}>
          {running ? `Refreshing… ${progress ? `${progress.done} of ${progress.total}` : ""}` : "Refresh where to watch"}
        </button>
      </div>
      {message && <p className="muted" role="status">{message}</p>}
    </div>
  );
}
