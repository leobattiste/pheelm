"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { updatePublicName, type NameState } from "./actions";

/** Choosing a name and handle for the first time. Once saved, goes to the new profile at /@handle. */
export default function PublicName({ handle, displayName }: { handle: string | null; displayName: string | null }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<NameState, FormData>(updatePublicName, null);

  useEffect(() => {
    if (!state?.ok) return;
    window.dispatchEvent(new Event("profilechange"));
    if (state.handle) router.push(`/@${state.handle}`);
  }, [state, router]);

  return (
    <section className="public-name" aria-labelledby="public-name-h">
      <h2 id="public-name-h">Name and handle</h2>
      <p className="muted">Shown on your profile and on collections you make public.</p>
      <form action={action} className="form">
        <div className="form-row">
          <label className="field">
            Name
            <input name="display_name" defaultValue={displayName ?? ""} maxLength={60} placeholder="Your name" autoComplete="name" />
          </label>
          <label className="field">
            Handle
            <input name="handle" defaultValue={handle ?? ""} required maxLength={24} pattern="[A-Za-z0-9_]{3,24}" autoCapitalize="none" spellCheck={false} aria-describedby="handle-hint" />
            <span className="hint" id="handle-hint">Your page will be pheelm.com/@handle. 3 to 24 letters, numbers or _</span>
          </label>
        </div>
        {state && <p className={state.ok ? "notice ok" : "notice error"} role="status">{state.message}</p>}
        <div className="actions"><button className="button" type="submit" disabled={pending}>{pending ? "Saving…" : "Create profile"}</button></div>
      </form>
    </section>
  );
}
