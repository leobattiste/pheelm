"use client";

import { useState } from "react";
import { addQueued } from "../actions";

type Item = { t: string; y: number; d: string[]; n?: string };
type Log = { status: "added" | "exists" | "not-found"; message: string };

/**
 * The queue of films picked for Pheelm (essential films of the directors in the directory) that
 * aren't on the site yet. One press adds them all, three at a time, each checked against its
 * director on TMDB and published when it matches.
 */
export default function FilmQueue({ items }: { items: Item[] }) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [log, setLog] = useState<Log[]>([]);
  if (!items.length && !log.length) return null;

  const run = async () => {
    setRunning(true);
    setLog([]);
    setDone(0);
    for (let i = 0; i < items.length; i += 3) {
      const results = await addQueued(items.slice(i, i + 3));
      setLog((l) => [...results.reverse(), ...l]);
      setDone(Math.min(i + 3, items.length));
      if (results.some((r) => r.message.includes("TMDB_API_KEY") || r.message.includes("rejected the API key"))) break;
    }
    setRunning(false);
  };

  const added = log.filter((l) => l.status === "added").length;
  const existing = log.filter((l) => l.status === "exists").length;
  const missed = log.filter((l) => l.status === "not-found");

  return (
    <div className="fieldset form">
      <h2>Film queue</h2>
      <p className="hint">
        {items.length} essential films by directors in the directory aren&rsquo;t on Pheelm yet. Each is added only when TMDB credits the expected director, and published straight away. Keep this page open while it runs.
      </p>
      <div className="actions">
        <button className="button" type="button" onClick={run} disabled={running || !items.length}>
          {running ? `Adding ${done} of ${items.length}…` : `Add ${items.length} queued films`}
        </button>
        {log.length > 0 && !running && <span className="label">{added} added, {existing} already here, {missed.length} not matched</span>}
      </div>
      {missed.length > 0 && !running && (
        <p className="notice error">Not matched: {missed.map((m) => m.message.split(":")[0]).join("; ")}. These need a TMDB id by hand, or aren&rsquo;t on TMDB.</p>
      )}
      {log.length > 0 && (
        <ul className="import-log">
          {log.map((l, i) => <li key={i} className={l.status === "not-found" ? "notice error" : "muted"}>{l.message}</li>)}
        </ul>
      )}
    </div>
  );
}
