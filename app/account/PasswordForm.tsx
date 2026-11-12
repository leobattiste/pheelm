"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { MIN_PASSWORD } from "@/lib/password";

/**
 * Sets or changes the password. When Supabase asks for proof it's you (secure password change),
 * it emails a six-digit code and the form asks for it before saving.
 */
export default function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [nonce, setNonce] = useState<string | null>(null);
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [has, setHas] = useState(hasPassword);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) return setState({ ok: false, message: `Use at least ${MIN_PASSWORD} characters.` });
    const db = getBrowserClient();
    if (!db) return;
    setBusy(true);
    setState(null);
    const { error } = await db.auth.updateUser({ password, data: { has_password: true }, ...(nonce ? { nonce } : {}) });
    if (error && /reauthenticat|nonce/i.test(error.message) && nonce === null) {
      const sent = await db.auth.reauthenticate();
      setBusy(false);
      if (sent.error) return setState({ ok: false, message: sent.error.message });
      setNonce("");
      return setState({ ok: true, message: "We emailed you a six-digit code. Enter it to save your password." });
    }
    setBusy(false);
    if (error) {
      const message = /weak|pwned|leaked|known to be/i.test(error.message) ? "Choose a stronger password. That one is too common or has appeared in a data breach."
        : /same.*password|different from the old/i.test(error.message) ? "Choose a password different from your current one."
        : /expired|invalid/i.test(error.message) ? "That code is incorrect or expired." : error.message;
      return setState({ ok: false, message });
    }
    setPassword("");
    setNonce(null);
    setHas(true);
    setState({ ok: true, message: "Password saved." });
  };

  return (
    <form onSubmit={save} className="form account-password">
      <label className="field">
        {has ? "New password" : "Password"}
        <span className="password-field">
          <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={MIN_PASSWORD} autoComplete="new-password" />
          <button type="button" className="link-button" onClick={() => setShow((s) => !s)} aria-pressed={show}>{show ? "Hide" : "Show"}</button>
        </span>
        <span className="field-hint">At least {MIN_PASSWORD} characters.</span>
      </label>
      {nonce !== null && (
        <label className="field">
          Code from the email
          <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required className="code-input"
            value={nonce} onChange={(e) => setNonce(e.target.value.replace(/\D/g, "").slice(0, 6))} />
        </label>
      )}
      {state && <p className={state.ok ? "notice ok" : "notice error"} role="status">{state.message}</p>}
      <div className="actions"><button className="button ghost" type="submit" disabled={busy}>{busy ? "Saving…" : has ? "Change password" : "Set password"}</button></div>
    </form>
  );
}
