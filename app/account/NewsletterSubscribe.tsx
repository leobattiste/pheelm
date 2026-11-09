"use client";

import { useActionState } from "react";
import { setNewsletterSubscription, type NewsletterState } from "./newsletter-actions";

export default function NewsletterSubscribe({ email, initialStatus }: { email: string; initialStatus: "off" | "pending" | "confirmed" }) {
  const [state, action, pending] = useActionState<NewsletterState, FormData>(setNewsletterSubscription, null);
  const status = state?.ok ? state.subscribed ? "pending" : "off" : initialStatus;
  const subscribed = status !== "off";
  return (
    <form action={action} className="settings-form">
      <p className="muted">Newsletter updates are sent to {email}.</p>
      <p className="muted">{status === "confirmed" ? "You're currently subscribed." : status === "pending" ? "Check your inbox to confirm your subscription." : "You're not subscribed."}</p>
      <input type="hidden" name="subscribe" value={String(!subscribed)} />
      <button className="button ghost" type="submit" disabled={pending}>
        {pending ? "Saving…" : status === "pending" ? "Cancel subscription request" : subscribed ? "Unsubscribe" : "Subscribe"}
      </button>
      {state && <p className={state.ok ? "notice ok" : "notice error"} role="status">{state.message}</p>}
    </form>
  );
}
