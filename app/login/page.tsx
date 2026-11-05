"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { supabaseEnabled } from "@/lib/supabase/config";

const googleEnabled = process.env.NEXT_PUBLIC_ENABLE_GOOGLE === "true";

function safeNext(v: string | null) {
  return v && v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : "/me";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const [next, setNext] = useState("/me");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setNext(safeNext(p.get("next")));
    if (p.get("error")) setError("That sign-in link has expired or was already used. Send yourself a new one.");
  }, []);

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    const db = getBrowserClient();
    if (!db) return;
    setStatus("sending");
    setError("");
    const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo(), shouldCreateUser: true } });
    if (error) {
      setStatus("idle");
      setError(error.message);
      return;
    }
    setStatus("sent");
  }

  async function google() {
    const db = getBrowserClient();
    if (!db) return;
    const { error } = await db.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
    if (error) setError(error.message);
  }

  if (!supabaseEnabled) {
    return (
      <section className="panel">
        <h1>Sign in</h1>
        <p className="lead">Accounts switch on once the site is connected to Supabase.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h1>Sign in</h1>
      <p className="lead">Keep a watchlist, mark what you&rsquo;ve seen and suggest films for the directory. No password needed.</p>
      {status === "sent" ? (
        <p className="notice ok" role="status">
          Check {email} for a sign-in link. It works once and expires in an hour.
        </p>
      ) : (
        <form onSubmit={sendLink} className="form">
          <label className="field">
            Email
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="button" type="submit" disabled={status === "sending"}>
            {status === "sending" ? "Sending link…" : "Email me a sign-in link"}
          </button>
        </form>
      )}
      {googleEnabled && status !== "sent" && (
        <button className="button ghost" type="button" onClick={google}>
          Continue with Google
        </button>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
