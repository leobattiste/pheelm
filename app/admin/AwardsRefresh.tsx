"use client";

import { useState } from "react";
import { refreshAwards } from "./actions";

/** Updates every film's awards and nominations from Wikidata, ten films at a time. */
export default function AwardsRefresh() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState("");

  const run = async () => {
    setRunning(true);
    setMessage("");
    let offset = 0, updated = 0;
    for (;;) {
      const r = await refreshAwards(offset);
      if (!r.ok) { setMessage(r.message); break; }
      updated += r.updated;
      setProgress({ done: r.next, total: r.total });
      if (r.next >= r.total || r.next === offset) { setMessage(`Done. ${updated} ${updated === 1 ? "film has" : "films have"} awards from Wikidata.`); break; }
      offset = r.next;
    }
    setRunning(false);
  };

  return (
    <div className="form">
      <p className="muted">TMDB has no awards, so wins and nominations come from Wikidata, matched by each film&rsquo;s TMDB id. Films Wikidata knows nothing about keep the awards they have. New films get their awards when they&rsquo;re added.</p>
      <div className="actions">
        <button className="button" type="button" onClick={run} disabled={running}>
          {running ? `Updating… ${progress ? `${progress.done} of ${progress.total}` : ""}` : "Update awards"}
        </button>
      </div>
      {message && <p className="muted" role="status">{message}</p>}
    </div>
  );
}
