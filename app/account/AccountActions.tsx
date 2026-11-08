"use client";

import { useActionState, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { deleteAccount, type DeleteState } from "./actions";

/** Signs you out on every device and browser, this one included. */
export function SignOutEverywhere() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    const db = getBrowserClient();
    if (!db) return;
    setBusy(true);
    setError(null);
    const { error } = await db.auth.signOut({ scope: "global" });
    if (error) { setError("Couldn't sign out everywhere. Try again."); setBusy(false); return; }
    window.location.assign("/");
  };
  return <div className="form"><button type="button" className="button ghost" onClick={run} disabled={busy}>{busy ? "Signing out…" : "Sign out everywhere"}</button>{error && <p className="notice error" role="status">{error}</p>}</div>;
}

/** Deletes the account and everything in it, once the member types DELETE to confirm. */
export function DeleteAccount() {
  const [typed, setTyped] = useState("");
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccount, null);
  return (
    <form action={action} className="form settings-form danger-zone">
      <label className="field">
        Type DELETE to confirm
        <input name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
      </label>
      {state && !state.ok && <p className="notice error" role="status">{state.message}</p>}
      <div className="actions">
        <button type="submit" className="button danger" disabled={pending || typed !== "DELETE"}>{pending ? "Deleting…" : "Delete my account"}</button>
      </div>
    </form>
  );
}
