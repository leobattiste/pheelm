"use client";

import { useState } from "react";
import { checkTmdbAwards } from "./actions";

type Row = { path: string; status: number | string; found: boolean; sample: string };

/** Asks TMDB's API, with our key, whether it serves a film's awards. Nothing is saved. */
export default function TmdbAwardsCheck() {
  const [id, setId] = useState("1233413");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [message, setMessage] = useState("");

  const run = async () => {
    setBusy(true);
    setMessage("");
    setRows(null);
    const r = await checkTmdbAwards(Number(id));
    if (r.ok) {
      setRows(r.results);
      setMessage(r.results.some((x) => x.found) ? "TMDB answered at least one awards address. Send this to Claude." : "TMDB's API doesn't serve awards at any of these addresses.");
    } else setMessage(r.message);
    setBusy(false);
  };

  return (
    <div className="form">
      <p className="muted">TMDB shows awards on its website. This checks whether its API serves them too, for one film. Nothing is saved.</p>
      <div className="actions">
        <label className="visually-hidden" htmlFor="tmdb-awards-id">TMDB id</label>
        <input id="tmdb-awards-id" inputMode="numeric" value={id} onChange={(e) => setId(e.currentTarget.value.replace(/\D/g, ""))} placeholder="TMDB id" style={{ maxWidth: 160 }} />
        <button className="button ghost" type="button" onClick={run} disabled={busy || !id}>{busy ? "Checking…" : "Check TMDB for awards"}</button>
      </div>
      {message && <p className="muted" role="status">{message}</p>}
      {rows && (
        <ul className="tmdb-awards-check">
          {rows.map((r) => (
            <li key={r.path}>
              <strong>{r.found ? "Answered" : "No"}</strong> <code>{r.path}</code> <span className="muted">{r.status}</span>
              {r.found && r.sample && <pre>{r.sample}</pre>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
