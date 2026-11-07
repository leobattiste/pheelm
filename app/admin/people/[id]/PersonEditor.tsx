"use client";

import { useActionState } from "react";
import type { PersonRow } from "@/lib/types";
import { savePerson, type Result } from "../../actions";

export default function PersonEditor({ person }: { person: PersonRow }) {
  const [state, action, pending] = useActionState<Result, FormData>(savePerson, { ok: false, message: "" });
  return (
    <form action={action} className="fieldset form">
      <input type="hidden" name="id" value={person.id} />
      <div className="form-row">
        <label className="field">Name<input name="name" defaultValue={person.name} required /></label>
        <label className="field">Address<input name="slug" defaultValue={person.slug} /></label>
      </div>
      <div className="form-row">
        <label className="field">Country <span className="hint">two-letter code, e.g. SN</span><input name="country" maxLength={2} defaultValue={person.country ?? ""} /></label>
        <label className="field">Birth year<input name="birth_year" inputMode="numeric" defaultValue={person.birth_year ?? ""} /></label>
        <label className="field">TMDB id<input name="tmdb_id" inputMode="numeric" defaultValue={person.tmdb_id ?? ""} /></label>
      </div>
      <label className="field">Biography<textarea name="bio" defaultValue={person.bio ?? ""} rows={6} /></label>
      <div className="form-row">
        <label className="field">Portrait link<input name="photo_url" type="url" defaultValue={person.photo_url ?? ""} /></label>
        <label className="field">…or upload<input name="photo_file" type="file" accept="image/jpeg,image/png,image/webp" /></label>
      </div>
      {/* Shown once the database has the column (supabase/collection-follows.sql). */}
      {"in_directory" in person && (
        <label className="check">
          <input type="hidden" name="has_in_directory" value="1" />
          <input type="checkbox" name="in_directory" defaultChecked={person.in_directory !== false} /> Show on the Directors page
          <span className="hint">Untick for co-directors who aren&rsquo;t Black filmmakers: they stay in the film&rsquo;s credits.</span>
        </label>
      )}
      <div className="actions">
        <button className="button" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
      </div>
      {state.message && <p className={`notice ${state.ok ? "ok" : "error"}`} role="status">{state.message}</p>}
    </form>
  );
}
