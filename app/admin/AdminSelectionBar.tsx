"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { useSearchParams } from "next/navigation";

export type BulkOperation = "publish" | "draft" | "delete" | "feature" | "unfeature";

export function useAdminSelection(key: "films" | "people") {
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

/** Contextual bulk actions are shown only after items have been selected. */
export function AdminSelectionBar({ selected, onClear, entity, canDelete, hasFeatured = false }: {
  selected: string[]; onClear: () => void; entity: "films" | "people";
  canDelete: boolean; hasFeatured?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [operation, setOperation] = useState<BulkOperation>("publish");
  if (!selected.length) return null;
  const noun = entity === "films" ? (selected.length === 1 ? "film" : "films") : (selected.length === 1 ? "person" : "people");
  const label = operation === "publish" ? "Publish" : operation === "draft" ? "Move to draft" : operation === "delete" ? "Delete permanently" : operation === "feature" ? "Feature" : "Remove feature";
  const ask = (next: BulkOperation) => { setOperation(next); dialog.current?.showModal(); };
  return (
    <div className="admin-selection-panel" role="region" aria-label="Selected items">
      {selected.map((id) => <input type="hidden" name="ids" value={id} key={id} />)}
      <input type="hidden" name="operation" value={operation} />
      <div className="admin-selection-heading">
        <strong>{selected.length.toLocaleString()} {noun} selected</strong>
        <button type="button" className="link-button" onClick={onClear}>Clear selection</button>
      </div>
      <div className="actions admin-selection-actions">
        <button className="button ghost small" type="button" onClick={() => ask("publish")}><Icon name="check" />Publish</button>
        <button className="button ghost small" type="button" onClick={() => ask("draft")}><Icon name="pencil" />Draft</button>
        {hasFeatured && <>
          <button className="button ghost small" type="button" onClick={() => ask("feature")}><Icon name="sparkle" />Feature</button>
          <button className="button ghost small" type="button" onClick={() => ask("unfeature")}>Unfeature</button>
        </>}
        {canDelete && <button className="button ghost small danger-text" type="button" onClick={() => ask("delete")}><Icon name="close" />Delete</button>}
      </div>
      <dialog ref={dialog} className="modal" aria-label={label} onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}>
        <div className="modal-head"><h2>{label} {selected.length} {noun}?</h2><button type="button" className="icon-button" aria-label="Cancel" onClick={() => dialog.current?.close()}><Icon name="close" /></button></div>
        <div className="modal-body">
          {operation === "delete" ? (
            <p className="notice error">{entity === "films" ? "This permanently deletes the selected films and their related records. It cannot be undone." : "This permanently deletes the selected people. People with film credits cannot be deleted in bulk; remove those credits first. This cannot be undone."}</p>
          ) : (
            <p>Apply “{label}” to all {selected.length} selected {noun}, including any selected on other pages?</p>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="button ghost" onClick={() => dialog.current?.close()}>Cancel</button>
          <button type="submit" className={operation === "delete" ? "button danger" : "button"}>{label} {selected.length}</button>
        </div>
      </dialog>
    </div>
  );
}
