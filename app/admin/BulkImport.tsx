"use client";

import { useState } from "react";
import { importOne } from "./actions";

/** Imports films one at a time from the browser, so a long list never hits a server time limit. */
export default function BulkImport({ films }: { films: { id: string; title: string }[] }) {
  const [log, setLog] = useState<{ ok: boolean; message: string }[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);

  if (!films.length) return <p className="muted">On. Every film has a poster. Use &ldquo;Import from TMDB&rdquo; in a film&rsquo;s editor to refresh it.</p>;

  const run = async () => {
    setRunning(true);
    setLog([]);
    for (const [i, f] of films.entries()) {
      const r = await importOne(f.id);
      setLog((l) => [r, ...l]);
      setDone(i + 1);
      if (!r.ok && r.message.includes("rejected the API key")) break;
      await new Promise((res) => setTimeout(res, 250));
    }
    setRunning(false);
  };

  return (
    <div className="form">
      <p className="muted">
        On. {films.length} films have no poster yet. Importing fills only empty fields, adds missing cast and crew, and refreshes viewing options.
      </p>
      <div className="actions">
        <button className="button" type="button" onClick={run} disabled={running}>
          {running ? `Importing ${done} of ${films.length}…` : `Import ${films.length} films from TMDB`}
        </button>
      </div>
      {log.length > 0 && (
        <ul className="import-log">
          {log.map((l, i) => (
            <li key={i} className={l.ok ? "muted" : "notice error"}>{l.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
