"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { supabaseEnabled } from "@/lib/supabase/config";

const googleEnabled = process.env.NEXT_PUBLIC_ENABLE_GOOGLE === "true";

function safeNext(v: string | null) {
  return v && v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : "/me";
}

const LINK_ERRORS: Record<string, string> = {
  expired: "That sign-in link has expired or was already used. Send yourself a new one below.",
  browser: "That link was opened in a different browser from the one you signed in on. Enter the 6-digit code from the same email instead, or send a new link.",
  link: "That sign-in link didn't work. Send yourself a new one below.",
  setup: "Sign-in isn't connected yet. The site needs its Supabase keys.",
};

/** Turns Supabase's messages into ones that say what to do next. */
function explain(message: string) {
  if (/rate limit|too many|security purposes/i.test(message)) return "Too many emails sent in a short time. Wait a minute, then try again.";
  if (/expired|invalid/i.test(message)) return "That code is wrong or has expired. Check the latest email, or send a new one.";
  if (/signups not allowed/i.test(message)) return "New accounts are switched off. Ask the site owner to turn on sign-ups in Supabase.";
  if (/sending|smtp|email/i.test(message)) return "The email couldn't be sent. If this keeps happening, the site's email settings need attention.";
  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "verifying">("idle");
  const [error, setError] = useState("");
  const [next, setNext] = useState("/me");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const n = safeNext(p.get("next"));
    setNext(n);
    const e = p.get("error");
    if (e) setError(LINK_ERRORS[e] ?? LINK_ERRORS.link);
    // Already signed in? Go straight on.
    getBrowserClient()?.auth.getSession().then(({ data }) => {
      if (data.session && !e) router.replace(n);
    });
  }, [router]);

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    const db = getBrowserClient();
    if (!db) return;
    setStatus("sending");
    setError("");
    // Remembered so a link that comes back without "next" still returns here.
    document.cookie = `signin_next=${encodeURIComponent(next)}; path=/; max-age=3600; samesite=lax`;
    const { error } = await db.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo(), shouldCreateUser: true },
    });
    if (error) {
      setStatus("idle");
      setError(explain(error.message));
      return;
    }
    setStatus("sent");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    const db = getBrowserClient();
    if (!db) return;
    setStatus("verifying");
    setError("");
    const { error } = await db.auth.verifyOtp({ email: email.trim(), token: code.replace(/\D/g, ""), type: "email" });
    if (error) {
      setStatus("sent");
      setError(explain(error.message));
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function google() {
    const db = getBrowserClient();
    if (!db) return;
    const { error } = await db.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
    if (error) setError(explain(error.message));
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
      {status === "sent" || status === "verifying" ? (
        <>
          <p className="lead">
            We sent an email to <strong>{email}</strong>. Open the link in it, or enter the 6-digit code here.
          </p>
          <form onSubmit={verifyCode} className="form">
            <label className="field">
              Code from the email
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,8}"
                maxLength={8}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="code-input"
                autoFocus
              />
            </label>
            <button className="button" type="submit" disabled={status === "verifying"}>
              {status === "verifying" ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="label">
            No email? Check spam, or{" "}
            <button type="button" className="link-button" onClick={() => { setStatus("idle"); setCode(""); setError(""); }}>
              use a different address
            </button>
            .
          </p>
        </>
      ) : (
        <>
          <p className="lead">Keep a watchlist, mark what you&rsquo;ve seen and suggest films. No password needed.</p>
          <form onSubmit={sendLink} className="form">
            <label className="field">
              Email
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button className="button" type="submit" disabled={status === "sending"}>
              {status === "sending" ? "Sending…" : "Email me a sign-in link"}
            </button>
          </form>
          {googleEnabled && (
            <button className="button ghost" type="button" onClick={google}>
              Continue with Google
            </button>
          )}
        </>
      )}
      {error && <p className="notice error" role="alert">{error}</p>}
    </section>
  );
}
