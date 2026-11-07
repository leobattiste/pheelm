"use client";

import { useActionState } from "react";
import { subscribe, type FormState } from "@/app/platform-actions";
import Turnstile from "./Turnstile";

/** Email sign-up for the newsletter, used in the footer and on the newsletter page. */
export default function NewsletterForm({ source = "footer", id = "newsletter-email" }: { source?: string; id?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(subscribe, null);
  return (
    <form action={action} className="newsletter-form">
      <label htmlFor={id} className="visually-hidden">Email address</label>
      <div className="newsletter-row">
        <input id={id} name="email" type="email" autoComplete="email" placeholder="you@example.com" required disabled={state?.ok} />
        <button className="button" type="submit" disabled={pending || state?.ok}>{pending ? "Subscribing…" : "Subscribe"}</button>
      </div>
      {/* Left empty by people; bots fill it in. */}
      <input name="website" tabIndex={-1} autoComplete="off" className="visually-hidden" aria-hidden="true" />
      <input type="hidden" name="source" value={source} />
      <Turnstile />
      <p className={`form-note${state && !state.ok ? " is-error" : ""}`} role="status">{state?.message ?? ""}</p>
    </form>
  );
}
