"use client";

import { useActionState } from "react";
import { saveEditorial, type EditorialResult } from "./actions";

export default function EditorialEditor({ filmId, essay, sources, status }: { filmId:string; essay:string; sources:string; status:"draft"|"published" }) {
  const [state, action, pending] = useActionState<EditorialResult, FormData>(saveEditorial,{ok:true,message:""});
  return (
    <form action={action} className="fieldset form">
      <input type="hidden" name="film_id" value={filmId} />
      <label className="field">Our perspective
        <span className="hint">Write original commentary, context and analysis. Separate paragraphs with a blank line. Keep the film synopsis in the Films editor.</span>
        <textarea name="essay" rows={14} defaultValue={essay} placeholder="Write a researched editorial perspective on this film…" />
      </label>
      <label className="field">Sources
        <span className="hint">One full source URL per line. These are displayed beneath published essays.</span>
        <textarea name="sources" rows={5} defaultValue={sources} placeholder="https://…" />
      </label>
      <label className="field">Publication status
        <select name="status" defaultValue={status}>
          <option value="draft">Draft — admin only</option>
          <option value="published">Published — visible on the film page</option>
        </select>
      </label>
      <div className="actions"><button type="submit" className="button" disabled={pending}>{pending ? "Saving…" : "Save editorial"}</button></div>
      {state.message && <p className={`notice ${state.ok ? "ok" : "error"}`} role="status">{state.message}</p>}
    </form>
  );
}
