"use client";
import { useSessionEmail } from "@/lib/session-email";

import { PAGE_COPY } from "@/lib/site";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { supabaseEnabled } from "@/lib/supabase/config";

const googleEnabled = process.env.NEXT_PUBLIC_ENABLE_GOOGLE === "true";

/** "signup" is the early-access invitation on the home page; the form works the same either way. */
export type SignInMode = "signin" | "signup";

export function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/me";
}

export const LINK_ERRORS: Record<string, string> = {
  expired: "That sign-in link has expired or was already used. Request a new one below.",
  browser: "This link opened in a different browser. Use the six-digit code from the email, or request a new link.",
  link: "The sign-in link could not be verified. Request a new one below.",
  setup: "Sign-in is not configured yet. Please contact the site owner.",
};

function explain(message: string) {
  if (/rate limit|too many|security purposes/i.test(message)) return "Too many sign-in requests. Wait a little before trying again.";
  if (/expired|invalid/i.test(message)) return "That code is incorrect or expired. Check the latest email or request a new code.";
  if (/signups not allowed/i.test(message)) return "New account registration is disabled.";
  if (/sending|smtp|email/i.test(message)) return "We couldn't send the email. Please try again later.";
  return message;
}

/**
 * Sign in with an emailed link or six-digit code (or Google, when switched on). Used by the
 * sign-in sheet in the header and by the /login page.
 */
export default function SignInForm({ next, initialError = "", onDone, titleId, mode = "signin" }: { next: string; initialError?: string; onDone?: () => void; titleId?: string; mode?: SignInMode }) {
  const signup = mode === "signup";
  const router = useRouter();
  const [email, setEmail] = useState("");
  const sessionEmail = useSessionEmail();
  useEffect(() => { if (sessionEmail) setEmail(current => current || sessionEmail); }, [sessionEmail]);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "verifying">("idle");
  const [error, setError] = useState(initialError);
  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    const db = getBrowserClient();
    if (!db) return setError(LINK_ERRORS.setup);
    setStatus("sending");
    setError("");
    const address = email.trim().toLowerCase();
    try {
      const result = await db.auth.signInWithOtp({
        email: address,
        options: { emailRedirectTo: redirectTo(), shouldCreateUser: true },
      });
      if (result.error) throw result.error;
      setEmail(address);
      setStatus("sent");
    } catch (cause) {
      setStatus("idle");
      setError(explain(cause instanceof Error ? cause.message : "Unable to send your sign-in email."));
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    const db = getBrowserClient();
    if (!db) return setError(LINK_ERRORS.setup);
    setStatus("verifying");
    setError("");
    try {
      const { data, error: otpError } = await db.auth.verifyOtp({
        email: email.trim().toLowerCase(), token: code.replace(/\D/g, ""), type: "email",
      });
      if (otpError) throw otpError;
      if (!data.session) throw new Error("Your session could not be created. Request a new code.");
      // Members' header and pages show from here on (set before paint on later visits).
      document.documentElement.dataset.auth = "in";
      onDone?.();
      // From the sheet you stay where you were, except on the home page, which leads to Films.
      if (!onDone || next !== window.location.pathname) router.replace(next);
      router.refresh();
    } catch (cause) {
      setStatus("sent");
      setError(explain(cause instanceof Error ? cause.message : "Unable to verify this code."));
    }
  }

  async function google() {
    const db = getBrowserClient();
    if (!db) return setError(LINK_ERRORS.setup);
    setError("");
    try {
      const { error: oauthError } = await db.auth.signInWithOAuth({
        provider: "google", options: { redirectTo: redirectTo() },
      });
      if (oauthError) throw oauthError;
    } catch (cause) {
      setError(explain(cause instanceof Error ? cause.message : "Google sign-in failed."));
    }
  }

  if (!supabaseEnabled) {
    return <div className="signin"><h2 id={titleId}>{signup ? "Sign up to get early access" : "Sign in"}</h2><p className="lead">Sign-in isn&rsquo;t available yet. Check back soon.</p></div>;
  }

  return (
    <div className="signin">
      <h2 id={titleId}>{signup ? "Sign up to get early access" : "Sign in"}</h2>
      {status === "sent" || status === "verifying" ? (
        <>
          <p className="lead">We sent an email to <strong>{email}</strong>. Open its link or enter the six-digit code below.</p>
          <form onSubmit={verifyCode} className="form">
            <label className="field">
              Code from the email
              <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required
                value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="code-input" autoFocus />
            </label>
            <button className="button" type="submit" disabled={status === "verifying" || code.length !== 6}>
              {status === "verifying" ? "Signing in…" : signup ? "Continue" : "Sign in"}
            </button>
          </form>
          <p className="label">No email? Check spam, or{" "}
            <button type="button" className="link-button" onClick={() => { setStatus("idle"); setCode(""); setError(""); }}>
              try again
            </button>.
          </p>
        </>
      ) : (
        <>
          <p className="lead">
            {signup
              ? <>It&rsquo;s free. Pheelm just launched: sign up and you&rsquo;re in. We&rsquo;ll email you a link, so there&rsquo;s no password.</>
              : <>{PAGE_COPY.signIn} We&rsquo;ll email you a link, so there&rsquo;s no password.</>}
          </p>
          <form onSubmit={sendLink} className="form">
            <label className="field">Email
              <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <button className="button" type="submit" disabled={status === "sending"}>
              {status === "sending" ? "Sending…" : signup ? "Get early access" : "Email me a sign-in link"}
            </button>
          </form>
          {googleEnabled && <button className="button ghost" type="button" onClick={google}>Continue with Google</button>}
        </>
      )}
      {error && <p className="notice error" role="alert">{error}</p>}
    </div>
  );
}
