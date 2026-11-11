"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Icon from "@/components/Icon";
import { useRouter, useSearchParams } from "next/navigation";
import { importSelectedFromTmdb, type ImportResult } from "./import-selected";

export type BulkOperation = "publish" | "draft" | "delete" | "feature" | "unfeature" | "import";

function useSelectionState(key: "films" | "people") {
  const storageKey = `pheelm:admin-selection:${key}:v1`;
  const updated = useSearchParams().get("updated");
  const [selected, setSelected] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      if (updated !== null) {
        sessionStorage.removeItem(storageKey);
        setSelected([]);
      } else {
        const saved: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "[]");
        if (Array.isArray(saved)) setSelected(saved.filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)).slice(0, 1000));
      }
    } catch { setSelected([]); }
    setReady(true);
  }, [storageKey, updated]);

  useEffect(() => {
    if (!ready) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify(selected)); } catch { /* storage unavailable */ }
  }, [selected, storageKey, ready]);

  const toggle = (id: string, checked: boolean) => setSelected((prev) =>
    checked ? (prev.includes(id) ? prev : [...prev, id].slice(0, 1000)) : prev.filter((item) => item !== id)
  );
  const togglePage = (ids: string[], checked: boolean) => setSelected((prev) =>
    checked ? [...new Set([...prev, ...ids])].slice(0, 1000) : prev.filter((id) => !ids.includes(id))
  );
  return { selected, toggle, togglePage, clear: () => setSelected([]) };
}

type SelectionState = ReturnType<typeof useSelectionState>;
const SelectionContext = createContext<{entity:"films"|"people";state:SelectionState}|null>(null);
export function AdminSelectionProvider({entity,children}:{entity:"films"|"people";children:ReactNode}) {
  const state=useSelectionState(entity);
  return <SelectionContext.Provider value={{entity,state}}>{children}</SelectionContext.Provider>;
}
export function useAdminSelection(entity:"films"|"people") {
  const value=useContext(SelectionContext);
  if(!value||value.entity!==entity)throw new Error("Selection controls must be inside their catalog provider.");
  return value.state;
}

export function AdminSelectionTools({entity,ids,canDelete,action}:{entity:"films"|"people";ids:string[];canDelete:boolean;action:(form:FormData)=>void|Promise<void>}) {
  const {selected,togglePage,clear}=useAdminSelection(entity);
  const all=ids.length>0&&ids.every(id=>selected.includes(id));
  const some=ids.some(id=>selected.includes(id));
  return <details className="admin-filter-section admin-filter-selection" aria-label="Manage selection" open={selected.length>0}>
    <summary>Selection<Icon name="arrowDown"/></summary>
    <div className="admin-filter-selection-body">
    <label className="check"><input type="checkbox" checked={all} disabled={!ids.length} ref={node=>{if(node)node.indeterminate=some&&!all;}} onChange={event=>togglePage(ids,event.target.checked)}/>Select displayed</label>
    {!selected.length&&<p className="muted">Select individual cards or all displayed items to manage them.</p>}
    <form action={action}><AdminSelectionBar selected={selected} onClear={clear} entity={entity} canDelete={canDelete} hasFeatured={entity==="films"}/></form>
    </div>
  </details>;
}

/** Contextual bulk actions are shown only after items have been selected. */
export function AdminSelectionBar({ selected, onClear, entity, canDelete, hasFeatured = false }: {
  selected: string[]; onClear: () => void; entity: "films" | "people";
  canDelete: boolean; hasFeatured?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [operation, setOperation] = useState<BulkOperation>("publish");
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [importError, setImportError] = useState("");
  const stop = useRef(false);
  const mounted = useRef(true);
  const importing = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; stop.current = true; }; }, []);
  const runImport = async (ids: string[]) => {
    if (importing.current) return;
    importing.current = true;
    const queue = [...ids];
    stop.current = false;
    setRunning(true); setStopping(false); setTotal(queue.length); setResults([]); setImportError("");
    dialog.current?.close();
    try {
      for (let i = 0; i < queue.length && !stop.current; i += 3) {
        const batch = await importSelectedFromTmdb(entity, queue.slice(i, i + 3));
        if (!mounted.current) return;
        setResults(previous => [...previous, ...batch]);
      }
    } catch (error) {
      if (mounted.current) setImportError(error instanceof Error ? error.message : "Import stopped. Please try again.");
    } finally {
      importing.current = false;
      if (mounted.current) { setRunning(false); router.refresh(); }
    }
  };
  if (!selected.length && !running) return null;
  const noun = entity === "films" ? (selected.length === 1 ? "film" : "films") : (selected.length === 1 ? "person" : "people");
  const label = operation === "import" ? "Import from TMDB" : operation === "publish" ? "Publish" : operation === "draft" ? "Move to draft" : operation === "delete" ? "Delete permanently" : operation === "feature" ? "Feature" : "Remove feature";
  const ask = (next: BulkOperation) => { setOperation(next); dialog.current?.showModal(); };
  return (
    <div className="admin-selection-panel" role="region" aria-label="Selected items">
      {selected.map((id) => <input type="hidden" name="ids" value={id} key={id} />)}
      <input type="hidden" name="operation" value={operation} />
      <div className="admin-selection-heading">
        <strong>{selected.length.toLocaleString()} {noun} selected</strong>
        <button type="button" className="link-button" disabled={running} onClick={onClear}>Clear selection</button>
      </div>
      <fieldset className="actions admin-selection-actions" disabled={running || !selected.length} aria-label="Selection actions">
        <button className="button ghost small" type="button" onClick={() => ask("import")}><Icon name="clapper" />Import from TMDB</button>
        <button className="button ghost small" type="button" onClick={() => ask("publish")}><Icon name="check" />Publish</button>
        <button className="button ghost small" type="button" onClick={() => ask("draft")}><Icon name="pencil" />Draft</button>
        {hasFeatured && <>
          <button className="button ghost small" type="button" onClick={() => ask("feature")}><Icon name="sparkle" />Feature</button>
          <button className="button ghost small" type="button" onClick={() => ask("unfeature")}>Unfeature</button>
        </>}
        {canDelete && <button className="button ghost small danger-text" type="button" onClick={() => ask("delete")}><Icon name="close" />Delete</button>}
      </fieldset>
      {total > 0 && <div className="admin-import-progress" aria-busy={running}>
        <p role="status">{running ? "Importing" : results.length < total ? "Import stopped" : "Import complete"}: {results.length} of {total}. {results.filter(result => result.ok).length} succeeded; {results.filter(result => !result.ok).length} failed.</p>
        {running && <button type="button" className="button ghost small" disabled={stopping} onClick={() => { stop.current = true; setStopping(true); }}>{stopping ? "Stopping after this batch…" : "Stop after this batch"}</button>}
        {importError && <p className="notice error" role="alert">{importError}</p>}
        {results.length > 0 && <details><summary>Import results</summary><ul className="import-log">{results.map(result => <li key={result.id} className={result.ok ? "muted" : "notice error"}>{result.message}</li>)}</ul></details>}
        {!running && results.some(result => !result.ok) && <button type="button" className="button ghost small" onClick={() => runImport(results.filter(result => !result.ok).map(result => result.id))}>Retry failed imports</button>}
      </div>}
      <dialog ref={dialog} className="modal" aria-label={label} onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}>
        <div className="modal-head"><h2>{label} {selected.length} {noun}?</h2><button type="button" className="icon-button" aria-label="Close confirmation" onClick={() => dialog.current?.close()}><Icon name="close" /></button></div>
        <div className="modal-body">
          {operation === "import" ? (
            <p>Import TMDB details for all {selected.length} selected {noun}, including selections on other pages. Existing edited fields and publication status stay unchanged. {entity === "people" && "Directors need a TMDB person ID in their editor."} You can stop after any batch and retry failures.</p>
          ) : operation === "delete" ? (
            <p className="notice error">{entity === "films" ? "This permanently deletes the selected films and their related records. It cannot be undone." : "This permanently deletes the selected people. People with film credits cannot be deleted in bulk; remove those credits first. This cannot be undone."}</p>
          ) : (
            <p>Apply “{label}” to all {selected.length} selected {noun}, including any selected on other pages?</p>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="button ghost" onClick={() => dialog.current?.close()}>Cancel</button>
          {operation === "import" ? <button type="button" className="button" onClick={() => runImport(selected)}>Import {selected.length}</button> : <button type="submit" className={operation === "delete" ? "button danger" : "button"}>{label} {selected.length}</button>}
        </div>
      </dialog>
    </div>
  );
}
