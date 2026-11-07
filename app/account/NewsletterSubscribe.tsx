"use client";

import { useActionState } from "react";
import { subscribeSignedIn, type NewsletterState } from "./newsletter-actions";

export default function NewsletterSubscribe({ email }: { email: string }) {
  const [state, action, pending] = useActionState<NewsletterState, FormData>(subscribeSignedIn, null);
  return (
    <form action={action} className="settings-form">
      <p className="muted">Updates will be sent to {email}.</p>
      <button className="button ghost" type="submit" disabled={pending || state?.ok}>
        {pending ? "Subscribing…" : state?.ok ? "Subscribed" : "Subscribe to newsletter"}
      </button>
      {state && <p className={state.ok ? "notice ok" : "notice error"} role="status">{state.message}</p>}
    </form>
  );
}
