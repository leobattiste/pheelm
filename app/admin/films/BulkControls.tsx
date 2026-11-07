"use client";

import { useState } from "react";
import Link from "next/link";
import Poster from "@/components/Poster";
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
      <div className="table-wrap"><table className="admin-table">
        <thead><tr><th aria-label="Select"/><th className="thumb"/><th>Title</th><th>Director</th><th>Year</th><th>Type</th><th>Status</th><th>TMDB</th></tr></thead>
        <tbody>{films.map(f=>(
          <tr key={f.id}>
            <td><input type="checkbox" name="ids" value={f.id} checked={selected.includes(f.id)} onChange={e=>toggle(f.id,e.target.checked)} aria-label={`Select ${f.title}`} /></td>
            <td className="thumb"><Poster title={f.title} year={f.year} directors={[]} src={f.poster_url}/></td>
            <td><Link href={`/admin/films/${f.id}`}>{f.title}</Link>{f.featured&&" ★"}</td>
            <td>{(f.credits??[]).filter(c=>c.role==="director").map(c=>c.people?.name).filter(Boolean).join(", ")}</td>
            <td>{f.year}</td>
            <td>{TYPE_LABELS[f.type as FilmType] ?? f.type}</td>
            <td><span className={`status-pill ${f.status}`}>{f.status}</span></td>
            <td>{f.tmdb_id?"✓":"—"}</td>
          </tr>
        ))}</tbody>
      </table></div>
    </>
  );
}
