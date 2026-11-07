"use client";

import { useState } from "react";
import { importMany } from "./actions";

/** Imports films one at a time from the browser, so a long list never hits a server time limit. */
export default function BulkImport({ films, label = "poster" }: { films: { id: string; title: string }[]; label?: "poster" | "synopsis" }) {
  const [log, setLog] = useState<{ ok: boolean; message: string }[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);

  if (!films.length) return <p className="muted">Nothing to import for missing {label === "poster" ? "posters" : "synopses"}.</p>;

  const run = async () => {
    setRunning(true);
    setLog([]);
    // Three films at a time: quick, and well inside TMDB's rate limit.
    for (let i = 0; i < films.length; i += 3) {
      const results = await importMany(films.slice(i, i + 3).map((f) => f.id));
      setLog((l) => [...results.reverse(), ...l]);
      setDone(Math.min(i + 3, films.length));
      if (results.some((r) => !r.ok && r.message.includes("rejected the API key"))) break;
    }
    setRunning(false);
  };

  return (
    <div className="form">
      <p className="muted">
        {films.length} films are queued for missing {label === "poster" ? "posters" : "synopses"}. Imports fill empty fields and preserve existing descriptions.
      </p>
      <div className="actions">
        <button className="button" type="button" onClick={run} disabled={running}>
          {running ? `Importing ${done} of ${films.length}…` : `Import ${films.length} ${label === "poster" ? "posters" : "synopses"} from TMDB`}
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
