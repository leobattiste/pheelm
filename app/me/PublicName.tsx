"use client";

import { useActionState } from "react";
import { updatePublicName, type NameState } from "./actions";

/** The name shown on a member's public collections, and the address of their page (/@handle). */
export default function PublicName({ handle, displayName }: { handle: string | null; displayName: string | null }) {
  const [state, action, pending] = useActionState<NameState, FormData>(updatePublicName, null);
  return (
    <section className="public-name" aria-labelledby="public-name-h">
      <h2 id="public-name-h">Your public name</h2>
      <p className="muted">Shown on collections you make public, with a page that lists them all{handle ? <> at <a href={`/@${handle}`}>pheelm.com/@{handle}</a></> : ""}.</p>
      <form action={action} className="form">
        <div className="form-row">
          <label className="field">
            Name
            <input name="display_name" defaultValue={displayName ?? ""} maxLength={60} placeholder="Leo Baptiste" autoComplete="name" />
          </label>
          <label className="field">
            Handle
            <input name="handle" defaultValue={handle ?? ""} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" placeholder="leo" autoCapitalize="none" spellCheck={false} aria-describedby="handle-hint" />
            <span className="hint" id="handle-hint">3 to 24 letters, numbers or _</span>
          </label>
        </div>
        {state && <p className={state.ok ? "notice ok" : "notice error"} role="status">{state.message}</p>}
        <div className="actions"><button className="button" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button></div>
      </form>
    </section>
  );
}
