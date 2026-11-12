"use client";

import { safeInternalPath } from "@/lib/safe-navigation";
import { useSessionEmail } from "@/lib/session-email";

import { PAGE_COPY } from "@/lib/site";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { supabaseEnabled } from "@/lib/supabase/config";
import { toast } from "@/components/Toast";
import { needsPassword, MIN_PASSWORD } from "@/lib/password";

const googleEnabled = process.env.NEXT_PUBLIC_ENABLE_GOOGLE === "true";

/** "signup" creates an account (email, password, then the emailed code); "signin" uses the password. */
export type SignInMode = "signin" | "signup";
/** Where the form is: the email (and password) step, the code step, the reset step, or choosing a password. */
export type SignInStep = "start" | "code" | "reset" | "new-password";
type CodeType = "email" | "signup" | "recovery";

export function safeNext(value: string | null) {
  return safeInternalPath(value) ?? "/me";
}

export const LINK_ERRORS: Record<string, string> = {
  expired: "That link has expired or was already used. Request a new code below.",
  browser: "This link opened in a different browser. Use the six-digit code from the email, or request a new one.",
  link: "The link could not be verified. Request a new code below.",
  setup: "Sign-in is not configured yet. Please contact the site owner.",
};

function explain(message: string) {
  if (/rate limit|too many|security purposes/i.test(message)) return "Too many requests. Wait a little before trying again.";
  if (/invalid login credentials/i.test(message)) return "That email and password don't match. Try again, or reset your password.";
  if (/expired|invalid/i.test(message)) return "That code is incorrect or expired. Check the latest email or request a new code.";
  if (/signups not allowed/i.test(message)) return "New account registration is disabled.";
  if (/weak|pwned|leaked|known to be/i.test(message)) return "Choose a stronger password. That one is too common or has appeared in a data breach.";
  if (/same.*password|different from the old/i.test(message)) return "Choose a password different from your current one.";
  if (/reauthenticat/i.test(message)) return "For your security, sign in again with a code, then set your password.";
  if (/sending|smtp/i.test(message)) return "We couldn't send the email. Please try again later.";
  return message;
}

/**
 * Sign in with email and password, or with a six-digit code from an email (or Google, when switched
 * on). New accounts confirm their email with a code. Members without a password are asked to choose
 * one. Used by the sign-in sheet and by the /login page.
 */
export default function SignInForm({ next, initialError = "", onDone, titleId, mode: initialMode = "signin", initialStep = "start", resetting = false }: {
  next: string; initialError?: string; onDone?: () => void; titleId?: string; mode?: SignInMode; initialStep?: SignInStep; resetting?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<SignInMode>(initialMode);
  const signup = mode === "signup";
  const [step, setStep] = useState<SignInStep>(initialStep);
  const [codeType, setCodeType] = useState<CodeType>(resetting ? "recovery" : "email");
  const [email, setEmail] = useState("");
  const sessionEmail = useSessionEmail();
  useEffect(() => { if (sessionEmail) setEmail(current => current || sessionEmail); }, [sessionEmail]);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState("");
  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const address = () => email.trim().toLowerCase();

  /** Runs a step: clears messages, shows progress, and turns failures into plain words. */
  async function run(work: (db: NonNullable<ReturnType<typeof getBrowserClient>>) => Promise<void>) {
    const db = getBrowserClient();
    if (!db) return setError(LINK_ERRORS.setup);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work(db);
    } catch (cause) {
      setError(explain(cause instanceof Error ? cause.message : "Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  function finish() {
    // Members' header and pages show from here on (set before paint on later visits).
    document.documentElement.dataset.auth = "in";
    toast.success("Signed in");
    onDone?.();
    // From the sheet you stay where you were, except on the home page, which leads to Films.
    if (!onDone || next !== window.location.pathname) router.replace(next);
    router.refresh();
  }

  function toCode(type: CodeType, message?: string) {
    setCodeType(type);
    setCode("");
    setStep("code");
    if (message) setNotice(message);
  }

  const submitStart = (event: React.FormEvent) => {
    event.preventDefault();
    return run(async (db) => {
      if (signup) {
        if (password.length < MIN_PASSWORD) throw new Error(`Use at least ${MIN_PASSWORD} characters for your password.`);
        const { data, error } = await db.auth.signUp({
          email: address(), password,
          options: { emailRedirectTo: redirectTo(), data: { has_password: true } },
        });
        if (error) throw error;
        // Supabase answers an existing address with an empty identity list and sends nothing.
        if (data.user && data.user.identities?.length === 0) {
          setMode("signin");
          throw new Error("There's already an account with this email. Sign in, or reset your password.");
        }
        if (data.session) return finish();
        setEmail(address());
        toCode("signup");
        return;
      }
      const { data, error } = await db.auth.signInWithPassword({ email: address(), password });
      if (error) {
        if (/not confirmed/i.test(error.message)) {
          const resent = await db.auth.resend({ type: "signup", email: address(), options: { emailRedirectTo: redirectTo() } });
          if (resent.error) throw resent.error;
          return toCode("signup", "Confirm your email first. We sent you a new code.");
        }
        throw error;
      }
      if (data.session) finish();
    });
  };

  const sendCode = () => run(async (db) => {
    if (!address()) throw new Error("Enter your email first.");
    const { error } = await db.auth.signInWithOtp({ email: address(), options: { emailRedirectTo: redirectTo(), shouldCreateUser: true } });
    if (error) throw error;
    setEmail(address());
    toCode("email");
  });

  const sendReset = (event: React.FormEvent) => {
    event.preventDefault();
    return run(async (db) => {
      const back = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error } = await db.auth.resetPasswordForEmail(address(), { redirectTo: back });
      if (error) throw error;
      setEmail(address());
      toCode("recovery");
    });
  };

  const verify = (event: React.FormEvent) => {
    event.preventDefault();
    return run(async (db) => {
      const { data, error } = await db.auth.verifyOtp({ email: address(), token: code.replace(/\D/g, ""), type: codeType });
      if (error) throw error;
      if (!data.session) throw new Error("Your session could not be created. Request a new code.");
      // A reset always ends with a new password; anyone else without one is asked to choose one.
      if (codeType === "recovery" || needsPassword(data.user)) {
        setPassword("");
        setStep("new-password");
        return;
      }
      finish();
    });
  };

  const savePassword = (event: React.FormEvent) => {
    event.preventDefault();
    return run(async (db) => {
      if (password.length < MIN_PASSWORD) throw new Error(`Use at least ${MIN_PASSWORD} characters for your password.`);
      const { error } = await db.auth.updateUser({ password, data: { has_password: true } });
      if (error) throw error;
      finish();
    });
  };

  const resend = () => run(async (db) => {
    if (codeType === "recovery") {
      const { error } = await db.auth.resetPasswordForEmail(address(), { redirectTo: redirectTo() });
      if (error) throw error;
    } else if (codeType === "signup") {
      const { error } = await db.auth.resend({ type: "signup", email: address(), options: { emailRedirectTo: redirectTo() } });
      if (error) throw error;
    } else {
      const { error } = await db.auth.signInWithOtp({ email: address(), options: { emailRedirectTo: redirectTo(), shouldCreateUser: true } });
      if (error) throw error;
    }
    setCode("");
    setNotice("We sent a new code.");
  });

  async function google() {
    const db = getBrowserClient();
    if (!db) return setError(LINK_ERRORS.setup);
    setError("");
    const { error: oauthError } = await db.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
    if (oauthError) setError(explain(oauthError.message));
  }

  const restart = (to: SignInStep = "start") => { setStep(to); setCode(""); setError(""); setNotice(""); };

  const title = step === "new-password" ? "Choose a password"
    : step === "reset" ? "Reset your password"
    : step === "code" ? (codeType === "signup" ? "Confirm your email" : codeType === "recovery" ? "Reset your password" : "Sign in")
    : signup ? "Sign up to get early access" : "Sign in";

  if (!supabaseEnabled) {
    return <div className="signin"><h2 id={titleId}>{title}</h2><p className="lead">Sign-in isn&rsquo;t available yet. Check back soon.</p></div>;
  }

  const passwordField = (label: string, autoComplete: "current-password" | "new-password") => (
    <label className="field">
      {label}
      <span className="password-field">
        <input type={show ? "text" : "password"} required minLength={autoComplete === "new-password" ? MIN_PASSWORD : undefined}
          autoComplete={autoComplete} value={password} onChange={(event) => setPassword(event.target.value)} />
        <button type="button" className="link-button" onClick={() => setShow((s) => !s)} aria-pressed={show}>{show ? "Hide" : "Show"}</button>
      </span>
      {autoComplete === "new-password" && <span className="field-hint">At least {MIN_PASSWORD} characters.</span>}
    </label>
  );

  return (
    <div className="signin">
      <h2 id={titleId}>{title}</h2>

      {step === "new-password" && (
        <>
          <p className="lead">{codeType === "recovery" ? "Choose a new password for your account." : "Pheelm now uses passwords. Choose one to sign in with from now on."}</p>
          <form onSubmit={savePassword} className="form">
            {passwordField("New password", "new-password")}
            <button className="button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
          </form>
        </>
      )}

      {step === "code" && (
        <>
          <p className="lead">We sent a six-digit code to <strong>{email}</strong>. Enter it below, or open the link in the email.</p>
          <form onSubmit={verify} className="form">
            <label className="field">
              Code from the email
              <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required
                value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="code-input" autoFocus />
            </label>
            <button className="button" type="submit" disabled={busy || code.length !== 6}>
              {busy ? "Checking…" : codeType === "signup" ? "Confirm email" : "Continue"}
            </button>
          </form>
          <p className="label">No email? Check spam, or{" "}
            <button type="button" className="link-button" onClick={resend} disabled={busy}>send a new code</button>.{" "}
            <button type="button" className="link-button" onClick={() => restart()}>Use a different email</button>
          </p>
        </>
      )}

      {step === "reset" && (
        <>
          <p className="lead">Enter your email and we&rsquo;ll send you a code to choose a new password.</p>
          <form onSubmit={sendReset} className="form">
            <label className="field">Email
              <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <button className="button" type="submit" disabled={busy}>{busy ? "Sending…" : "Send code"}</button>
          </form>
          <p className="label"><button type="button" className="link-button" onClick={() => restart()}>Back to sign in</button></p>
        </>
      )}

      {step === "start" && (
        <>
          <p className="lead">
            {signup
              ? <>It&rsquo;s free. Choose a password, then confirm your email with the code we send you.</>
              : PAGE_COPY.signIn}
          </p>
          <form onSubmit={submitStart} className="form">
            <label className="field">Email
              <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            {passwordField("Password", signup ? "new-password" : "current-password")}
            <button className="button" type="submit" disabled={busy}>
              {busy ? (signup ? "Creating account…" : "Signing in…") : signup ? "Get early access" : "Sign in"}
            </button>
          </form>
          {googleEnabled && <button className="button ghost" type="button" onClick={google}>Continue with Google</button>}
          <p className="label signin-links">
            {signup ? (
              <>Already have an account? <button type="button" className="link-button" onClick={() => { setMode("signin"); restart(); }}>Sign in</button></>
            ) : (
              <>
                <button type="button" className="link-button" onClick={() => restart("reset")}>Forgot password?</button>{" "}
                <button type="button" className="link-button" onClick={sendCode} disabled={busy}>Email me a code instead</button>{" "}
                <span>New here? <button type="button" className="link-button" onClick={() => { setMode("signup"); restart(); }}>Create an account</button></span>
              </>
            )}
          </p>
        </>
      )}

      {notice && <p className="notice ok" role="status">{notice}</p>}
      {error && <p className="notice error" role="alert">{error}</p>}
    </div>
  );
}
