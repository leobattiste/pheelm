"use client";

import { useActionState } from "react";
import { setNewsletterSubscription, type NewsletterState } from "./newsletter-actions";

export default function NewsletterSubscribe({ email, initialSubscribed }: { email: string; initialSubscribed: boolean }) {
  const [state, action, pending] = useActionState<NewsletterState, FormData>(setNewsletterSubscription, null);
  const subscribed = state?.ok ? state.subscribed : initialSubscribed;
  return (
    <form action={action} className="settings-form">
      <p className="muted">Newsletter updates are sent to {email}.</p>
      <p className="muted">{subscribed ? "You're currently subscribed." : "You're not subscribed."}</p>
      <input type="hidden" name="subscribe" value={String(!subscribed)} />
      <button className="button ghost" type="submit" disabled={pending}>
        {pending ? "Saving…" : subscribed ? "Unsubscribe" : "Subscribe"}
      </button>
      {state && <p className={state.ok ? "notice ok" : "notice error"} role="status">{state.message}</p>}
    </form>
  );
}
