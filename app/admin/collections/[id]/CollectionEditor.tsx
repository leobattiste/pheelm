"use client";

import { useActionState, useState } from "react";
import type { CollectionRow } from "@/lib/types";
import { deleteCollection, saveCollection, type Result } from "../../actions";

type FilmOption = { id: string; title: string; year: number };

export default function CollectionEditor({ collection, films, chosen }: { collection: CollectionRow; films: FilmOption[]; chosen: string[] }) {
  const [state, action, pending] = useActionState<Result, FormData>(saveCollection, { ok: false, message: "" });
  const [filter, setFilter] = useState("");
  const [picked, setPicked] = useState(new Set(chosen));
  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };
  const shown = films.filter((f) => !filter || f.title.toLowerCase().includes(filter.toLowerCase()));

  return (
    <form action={action} className="form">
      <input type="hidden" name="id" value={collection.id} />
      <fieldset className="fieldset">
        <legend>Details</legend>
        <div className="form-row">
          <label className="field">Title<input name="title" defaultValue={collection.title} required /></label>
          <label className="field">Address<input name="slug" defaultValue={collection.slug} /></label>
        </div>
        <div className="form-row">
          <label className="field">Kind
            <select name="kind" defaultValue={collection.kind}>
              <option value="movement">Movement</option>
              <option value="theme">Theme</option>
              <option value="country">Country or region</option>
              <option value="genre">Genre</option>
              <option value="decade">Decade</option>
            </select>
          </label>
          <label className="field">Order <span className="hint">lower comes first</span><input name="sort_order" inputMode="numeric" defaultValue={collection.sort_order} /></label>
        </div>
        <label className="field">Description<textarea name="description" defaultValue={collection.description ?? ""} /></label>
        <label className="check"><input type="checkbox" name="featured" defaultChecked={collection.featured} /> Feature on the home page</label>
      </fieldset>
      <fieldset className="fieldset">
        <legend>Films ({picked.size})</legend>
        <input className="search-input" placeholder="Filter films" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter films" />
        {/* Picked films stay in the form even when filtered out of view. */}
        {[...picked].filter((id) => !shown.some((f) => f.id === id)).map((id) => <input key={id} type="hidden" name="films" value={id} />)}
        <div className="film-picker">
          {shown.map((f) => (
            <label key={f.id}>
              <input type="checkbox" name="films" value={f.id} checked={picked.has(f.id)} onChange={() => toggle(f.id)} /> {f.title} <span className="muted">{f.year}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="actions">
        <button className="button" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <button className="button danger small" type="submit" formAction={deleteCollection} formNoValidate
          onClick={(e) => { if (!confirm("Delete this collection? The films stay in the directory.")) e.preventDefault(); }}>
          Delete collection
        </button>
      </div>
      {state.message && <p className={`notice ${state.ok ? "ok" : "error"}`} role="status">{state.message}</p>}
    </form>
  );
}
