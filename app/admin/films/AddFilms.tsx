"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon, { type IconName } from "@/components/Icon";
import { parseList } from "@/lib/parse-list";
import { addMany, addOne, createFilm } from "../actions";
import { clearQueue, removeFromQueue, runQueue, saveToQueue, type QueueItem } from "./queue-actions";

type Method = "one" | "list" | "queue";
type Log = { status: "added" | "exists" | "not-found"; message: string };

const METHODS: { id: Method; icon: IconName; title: string; detail: string }[] = [
  { id: "one", icon: "plus", title: "One film", detail: "Find a film on TMDB by its title and year." },
  { id: "list", icon: "stack", title: "Paste a list", detail: "Add many at once, or save them for later." },
  { id: "queue", icon: "clock", title: "Queue", detail: "Films saved to add later." },
];

/** Shows how a run went: added, already here, not found, then each line. */
function Results({ log, running }: { log: Log[]; running: boolean }) {
  if (!log.length) return null;
  const added = log.filter((l) => l.status === "added").length;
  const existing = log.filter((l) => l.status === "exists").length;
  const missed = log.filter((l) => l.status === "not-found").length;
  return (
    <div className="add-results" aria-live="polite">
      {!running && <p className="add-summary"><strong>{added} added</strong>{existing > 0 && <span>{existing} already here</span>}{missed > 0 && <span className="is-error">{missed} not found</span>}</p>}
      <ul className="import-log">{log.map((l, i) => <li key={i} className={l.status === "not-found" ? "is-error" : l.status === "added" ? "is-added" : ""}>{l.message}</li>)}</ul>
    </div>
  );
}

function Publish({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return <label className="check"><input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} /> Publish right away (otherwise they're saved as drafts)</label>;
}

export default function AddFilms({ queue, collections, initial }: { queue: QueueItem[]; collections: { id: string; title: string }[]; initial: Method }) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>(initial);
  const [publish, setPublish] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [log, setLog] = useState<Log[]>([]);
  const [pending, start] = useTransition();
  // One film
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  // A list
  const [text, setText] = useState("");
  const [collection, setCollection] = useState("");
  const [note, setNote] = useState("");
  const list = useMemo(() => parseList(text), [text]);

  const choose = (m: Method) => { setMethod(m); setLog([]); setNote(""); history.replaceState(null, "", `?method=${m}`); };

  const addSingle = async () => {
    setRunning(true); setLog([]);
    const r = await addOne(title.trim(), /^\d{4}$/.test(year) ? Number(year) : null, publish, null);
    setLog([r]); setRunning(false);
    if (r.status === "added") { setTitle(""); setYear(""); }
  };

  const addList = async () => {
    setRunning(true); setLog([]); setNote("");
    for (let i = 0; i < list.length; i += 3) {
      setProgress(`Adding ${Math.min(i + 3, list.length)} of ${list.length}…`);
      const results = await addMany(list.slice(i, i + 3), publish, collection || null);
      setLog((l) => [...results.reverse(), ...l]);
      if (results.some((r) => r.message.includes("TMDB_API_KEY") || r.message.includes("rejected the API key"))) break;
    }
    setRunning(false); setProgress("");
  };

  const saveList = () => start(async () => {
    const r = await saveToQueue(list);
    setNote(r.message);
    if (r.ok) { setText(""); router.refresh(); }
  });

  const addQueue = async () => {
    setRunning(true); setLog([]);
    const ids = queue.map((q) => q.id);
    for (let i = 0; i < ids.length; i += 3) {
      setProgress(`Adding ${Math.min(i + 3, ids.length)} of ${ids.length}…`);
      const results = await runQueue(ids.slice(i, i + 3), publish);
      setLog((l) => [...results.reverse(), ...l]);
      if (results.some((r) => r.message.includes("TMDB_API_KEY") || r.message.includes("rejected the API key"))) break;
    }
    setRunning(false); setProgress("");
    router.refresh();
  };

  return (
    <div className="add-films">
      <div className="add-methods" role="radiogroup" aria-label="How to add films">
        {METHODS.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={method === m.id} className="add-method" onClick={() => choose(m.id)} disabled={running}>
            <Icon name={m.icon} />
            <span className="add-method-text"><strong>{m.title}{m.id === "queue" && <span className="add-method-count">{queue.length}</span>}</strong><span>{m.detail}</span></span>
          </button>
        ))}
      </div>

      <section className="add-panel" aria-label={METHODS.find((m) => m.id === method)!.title}>
        {method === "one" && (
          <>
            <form className="add-one" onSubmit={(e) => { e.preventDefault(); void addSingle(); }}>
              <label className="field">Title<input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Daughters of the Dust" /></label>
              <label className="field add-year">Year<input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" pattern="[0-9]{4}" placeholder="1991" /></label>
              <button className="button" disabled={running || !title.trim()}>{running ? "Adding…" : "Add film"}</button>
            </form>
            <Publish value={publish} onChange={setPublish} />
            <Results log={log} running={running} />
            <details className="add-manual">
              <summary>Not on TMDB? Create a draft by hand</summary>
              <form action={createFilm} className="add-manual-form">
                <label className="field">Title<input name="title" required /></label>
                <label className="field">Year<input name="year" inputMode="numeric" pattern="[0-9]{4}" required /></label>
                <label className="field">Director<input name="director" required /></label>
                <label className="field">TMDB id <span className="hint">optional</span><input name="tmdb_id" inputMode="numeric" /></label>
                <button className="button ghost">Create draft</button>
              </form>
            </details>
          </>
        )}

        {method === "list" && (
          <>
            <label className="field">
              One film per line
              <span className="hint">Like &ldquo;Moonlight (2016)&rdquo; or &ldquo;Killer of Sheep, 1978&rdquo;. A Letterboxd list export works too. Films already on Pheelm are skipped.</span>
              <textarea className="tall" value={text} onChange={(e) => setText(e.target.value)} placeholder={"Do the Right Thing (1989)\nAtlantics (2019)\nKiller of Sheep, 1978"} />
            </label>
            <div className="add-options">
              <label className="field">Also add them to a collection
                <select value={collection} onChange={(e) => setCollection(e.target.value)}>
                  <option value="">No collection</option>
                  {collections.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </label>
              <Publish value={publish} onChange={setPublish} />
            </div>
            <div className="actions">
              <button className="button" type="button" onClick={() => void addList()} disabled={running || !list.length}>
                {running ? progress : list.length ? `Add ${list.length} ${list.length === 1 ? "film" : "films"} now` : "Add films now"}
              </button>
              <button className="button ghost" type="button" onClick={saveList} disabled={running || pending || !list.length}>Save to queue</button>
            </div>
            {note && <p className="notice ok" role="status">{note}</p>}
            <Results log={log} running={running} />
          </>
        )}

        {method === "queue" && (
          queue.length === 0 && !log.length ? (
            <p className="empty">The queue is empty. Paste a list and choose &ldquo;Save to queue&rdquo; to line films up for later.</p>
          ) : (
            <>
              <div className="add-queue-head">
                <p><strong>{queue.length} {queue.length === 1 ? "film" : "films"} waiting.</strong> Each is matched on TMDB by title and year, and by director when known. Keep this page open while it runs.</p>
                <div className="actions">
                  <button className="button" type="button" onClick={() => void addQueue()} disabled={running || !queue.length}>{running ? progress : `Add all ${queue.length}`}</button>
                  <button className="button ghost" type="button" disabled={running || pending || !queue.length}
                    onClick={() => { if (confirm(`Remove all ${queue.length} films from the queue? Films already added stay.`)) start(async () => { await clearQueue(); router.refresh(); }); }}>Clear queue</button>
                </div>
              </div>
              <Publish value={publish} onChange={setPublish} />
              <Results log={log} running={running} />
              {queue.length > 0 && (
                <ul className="add-queue">
                  {queue.map((q) => (
                    <li key={q.id}>
                      <span className="add-queue-main">
                        <strong>{q.title}{q.year ? ` (${q.year})` : ""}</strong>
                        <span>{[q.director_name, q.synopsis ? "Essay ready" : null].filter(Boolean).join(" · ")}</span>
                        {q.last_error && <span className="is-error">{q.last_error}</span>}
                      </span>
                      <button type="button" className="icon-button" aria-label={`Remove ${q.title} from the queue`} title="Remove" disabled={running || pending}
                        onClick={() => start(async () => { await removeFromQueue(q.id); router.refresh(); })}><Icon name="close" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )
        )}
      </section>
    </div>
  );
}
