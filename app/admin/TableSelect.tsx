"use client";

import { useAdminSelection } from "./AdminSelectionBar";

/** A row's checkbox, tied to the page's selection (kept as you change pages). */
export function SelectCell({ entity, id, label }: { entity: "films" | "people"; id: string; label: string }) {
  const { selected, toggle } = useAdminSelection(entity);
  return (
    <label className="admin-check">
      <input type="checkbox" checked={selected.includes(id)} onChange={(e) => toggle(id, e.target.checked)} aria-label={`Select ${label}`} />
    </label>
  );
}

/** The header checkbox: selects or clears every row on this page. */
export function SelectAll({ entity, ids }: { entity: "films" | "people"; ids: string[] }) {
  const { selected, togglePage } = useAdminSelection(entity);
  const all = ids.length > 0 && ids.every((id) => selected.includes(id));
  const some = !all && ids.some((id) => selected.includes(id));
  return (
    <label className="admin-check">
      <input type="checkbox" checked={all} ref={(el) => { if (el) el.indeterminate = some; }} onChange={(e) => togglePage(ids, e.target.checked)} aria-label="Select every row on this page" />
    </label>
  );
}
