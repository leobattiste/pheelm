"use client";

import { useMemo, useState } from "react";
import { parseList } from "@/lib/parse-list";
import { addMany } from "../actions";

type Log = { status: "added" | "exists" | "not-found"; message: string };

export default function BulkAdd({ collections }: { collections: { id: string; title: string }[] }) {
  const [text, setText] = useState("");
  const [publish, setPublish] = useState(true);
  const [collection, setCollection] = useState("");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [log, setLog] = useState<Log[]>([]);
  const list = useMemo(() => parseList(text), [text]);

  const run = async () => {
    setRunning(true);
    setLog([]);
    setDone(0);
    // Three films at a time: quick, and well inside TMDB's rate limit.
    for (let i = 0; i < list.length; i += 3) {
      const results = await addMany(list.slice(i, i + 3), publish, collection || null);
      setLog((l) => [...results.reverse(), ...l]);
      setDone(Math.min(i + 3, list.length));
      if (results.some((r) => r.message.includes("TMDB_API_KEY") || r.message.includes("rejected the API key"))) break;
    }
    setRunning(false);
  };

  const added = log.filter((l) => l.status === "added").length;
  const existing = log.filter((l) => l.status === "exists").length;
  const missed = log.filter((l) => l.status === "not-found");

  return (
    <div className="fieldset form">
      <h2>Add many films</h2>
      <label className="field">
        Paste a list
        <span className="hint">
          One film per line, like &ldquo;Moonlight (2016)&rdquo;, or a Letterboxd list export (the CSV). Each film is found on TMDB and filled in; films already here are skipped.
        </span>
        <textarea className="tall" value={text} onChange={(e) => setText(e.target.value)} placeholder={"Do the Right Thing (1989)\nAtlantics (2019)\nKiller of Sheep, 1978"} />
      </label>
      <div className="form-row">
        <label className="field">
          Also add them to a collection
          <select value={collection} onChange={(e) => setCollection(e.target.value)}>
            <option value="">No collection</option>
            {collections.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        <label className="check" style={{ alignSelf: "end", minHeight: 44 }}>
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} /> Publish right away (otherwise as drafts)
        </label>
      </div>
      <div className="actions">
        <button className="button" type="button" onClick={run} disabled={running || !list.length}>
          {running ? `Adding ${done} of ${list.length}…` : list.length ? `Add ${list.length} ${list.length === 1 ? "film" : "films"}` : "Add films"}
        </button>
        {log.length > 0 && !running && (
          <span className="label">{added} added, {existing} already here, {missed.length} not found</span>
        )}
      </div>
      {missed.length > 0 && !running && (
        <p className="notice error">Not found: {missed.map((m) => m.message.split(":")[0]).join("; ")}. Add these by hand with their TMDB id.</p>
      )}
      {log.length > 0 && (
        <ul className="import-log">
          {log.map((l, i) => <li key={i} className={l.status === "not-found" ? "notice error" : "muted"}>{l.message}</li>)}
        </ul>
      )}
    </div>
  );
}
