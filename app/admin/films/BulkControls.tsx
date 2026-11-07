"use client";

import { useState } from "react";

/** Uses the admin table's checkboxes; only the selected current-page records are affected. */
export default function BulkControls({ ids }: { ids: string[] }) {
  const [selected,setSelected]=useState<string[]>([]);
  const toggle=(id:string,checked:boolean)=>setSelected((all)=>checked?[...all,id]:all.filter(x=>x!==id));
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
      {ids.map(id=><input key={id} type="hidden" name="ids" value={selected.includes(id)?id:""}/>)}
      <span className="visually-hidden">{/* This form sends only checked IDs; empty values are discarded server-side. */}</span>
    </>
  );
}
