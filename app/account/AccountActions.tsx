"use client";

import { useActionState, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { deleteAccount, type DeleteState } from "./actions";
import { toast, toastNext, useResultToast } from "@/components/Toast";

/** Signs you out on every device and browser, this one included. */
export function SignOutEverywhere() {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    const db = getBrowserClient();
    if (!db) return;
    setBusy(true);
    const { error } = await db.auth.signOut({ scope: "global" });
    if (error) { toast.error("Couldn’t sign out everywhere. Try again."); setBusy(false); return; }
    toastNext("Signed out everywhere");
    window.location.assign("/");
  };
  return <div className="form"><button type="button" className="button ghost" onClick={run} disabled={busy}>{busy ? "Signing out…" : "Sign out everywhere"}</button></div>;
}

/** Deletes the account and everything in it, once the member types DELETE to confirm. */
export function DeleteAccount() {
  const [typed, setTyped] = useState("");
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccount, null);
  useResultToast(state);
  return (
    <form action={action} className="form settings-form danger-zone">
      <label className="field">
        Type DELETE to confirm
        <input name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
      </label>
      <div className="actions">
        <button type="submit" className="button danger" disabled={pending || typed !== "DELETE"}>{pending ? "Deleting…" : "Delete my account"}</button>
      </div>
    </form>
  );
}
