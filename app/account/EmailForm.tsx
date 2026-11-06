"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

/** Changes the email used to sign in. Supabase emails a confirmation link before the change applies. */
export default function EmailForm({ email }: { email: string }) {
  const [value, setValue] = useState(email);
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = value.trim().toLowerCase();
    if (next === email) return setState({ ok: false, message: "That's already your email." });
    const db = getBrowserClient();
    if (!db) return;
    setBusy(true);
    const { error } = await db.auth.updateUser({ email: next }, { emailRedirectTo: `${window.location.origin}/auth/callback?next=/account` });
    setBusy(false);
    setState(error ? { ok: false, message: error.message } : { ok: true, message: `Check ${next} (and ${email}) for a link to confirm the change.` });
  };

  return (
    <form onSubmit={save} className="form account-email">
      <label className="field">
        Email
        <input type="email" value={value} onChange={(e) => setValue(e.target.value)} required autoComplete="email" />
      </label>
      {state && <p className={state.ok ? "notice ok" : "notice error"} role="status">{state.message}</p>}
      <div className="actions"><button className="button ghost" type="submit" disabled={busy}>{busy ? "Sending…" : "Change email"}</button></div>
    </form>
  );
}
