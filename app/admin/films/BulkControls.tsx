"use client";

import { useState } from "react";
import FilmCard from "@/components/FilmCard";
import { TYPE_LABELS } from "@/lib/format";
import type { FilmType } from "@/lib/types";

export type AdminFilmRow = {
  id:string; slug:string; title:string; year:number; type:string; status:string;
  poster_url:string|null; featured:boolean; tmdb_id:number|null;
  credits:{role:string;people:{name:string}|null}[];
};

export default function BulkControls({ films }: { films:AdminFilmRow[] }) {
  const [selected,setSelected]=useState<string[]>([]);
  const ids=films.map(f=>f.id);
  const toggle=(id:string,checked:boolean)=>setSelected(all=>checked?[...all,id]:all.filter(x=>x!==id));
  return (
    <>
      <div className="actions admin-bulk-bar">
        <label className="check"><input type="checkbox" checked={selected.length===ids.length&&ids.length>0} onChange={e=>setSelected(e.target.checked?[...ids]:[])} /> Select page</label>
        <label className="field">Action
          <select name="operation" defaultValue="publish">
            <option value="publish">Publish selected</option>
            <option value="draft">Move selected to draft</option>
            <option value="feature">Feature selected</option>
            <option value="unfeature">Unfeature selected</option>
          </select>
        </label>
        <button className="button ghost small" type="submit" disabled={!selected.length} onClick={e=>{ if(!confirm(`Apply this change to ${selected.length} films?`)) e.preventDefault(); }}>Apply to {selected.length} films</button>
        <span className="muted">Current page only. No deletions.</span>
      </div>
      <ul className="film-grid admin-film-grid">
        {films.map(f => <FilmCard key={f.id} href={`/admin/films/${f.id}`} film={{
          id: f.id, slug: f.slug, title: f.title, year: f.year, type: f.type as FilmType,
          poster_url: f.poster_url, directors: (f.credits ?? []).filter(c => c.role === "director").map(c => c.people?.name).filter((name): name is string => !!name),
          countries: [], languages: [], genres: [], runtime: null, wins: 0,
        }} extra={TYPE_LABELS[f.type as FilmType] ?? f.type} controls={
          <div className="admin-film-controls">
            <label className="check"><input type="checkbox" name="ids" value={f.id} checked={selected.includes(f.id)} onChange={e => toggle(f.id, e.target.checked)} aria-label={`Select ${f.title}`} />Select</label>
            <span className={`status-pill ${f.status}`}>{f.status}</span>
            {f.featured && <span className="status-pill">Featured</span>}
            <span className="visually-hidden">{f.tmdb_id ? "Matched on TMDB" : "No TMDB match"}</span>
          </div>
        } />)}
      </ul>
    </>
  );
}
