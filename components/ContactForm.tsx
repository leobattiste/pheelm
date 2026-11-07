"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import Icon from "./Icon";
import Turnstile from "./Turnstile";
import { sendMessage, type FormState } from "@/app/platform-actions";

const TOPICS: [string, string][] = [
  ["general", "A question or idea"],
  ["feedback", "Feedback about Pheelm"],
  ["correction", "A correction to a film or person"],
  ["partnership", "Partnership"],
  ["press", "Press"],
  ["privacy", "My data and privacy"],
];

/** The contact form. On the partnerships page it asks for an organisation and starts on Partnership. */
export default function ContactForm({ topic = "general", partnership = false, about }: { topic?: string; partnership?: boolean; about?: { page: string; title: string } }) {
  const [on, setOn] = useState(true);
  const ref = on ? about : undefined;
  const [state, action, pending] = useActionState<FormState, FormData>(sendMessage, null);

  if (state?.ok) {
    return <p className="notice ok" role="status">{state.message}</p>;
  }

  return (
    <form action={action} className="form contact-form">
      {ref && (
        <div className="feedback-about">
          <span className="muted">About</span>
          <Link href={ref.page}>{ref.title}</Link>
          <button type="button" className="icon-button" onClick={() => setOn(false)} aria-label="Not about this page"><Icon name="close" /></button>
          <input type="hidden" name="page" value={ref.page} />
          <input type="hidden" name="page_title" value={ref.title} />
        </div>
      )}
      <div className="form-row">
        <label className="field">Your name<input name="name" autoComplete="name" maxLength={200} /></label>
        <label className="field">Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
      </div>
      {partnership ? (
        <>
          <label className="field">Organisation<input name="organization" autoComplete="organization" maxLength={200} /></label>
          <input type="hidden" name="topic" value="partnership" />
        </>
      ) : (
        <label className="field">
          What&rsquo;s it about?
          <select name="topic" defaultValue={topic}>
            {TOPICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      )}
      <label className="field">
        Message
        <textarea name="body" required maxLength={5000} placeholder={partnership ? "Tell us about your organisation and what you have in mind." : ""} />
      </label>
      <input name="website" tabIndex={-1} autoComplete="off" className="visually-hidden" aria-hidden="true" />
      <Turnstile />
      {state && !state.ok && <p className="notice error" role="alert">{state.message}</p>}
      <div className="actions">
        <button className="button" type="submit" disabled={pending}>{pending ? "Sending…" : "Send message"}</button>
      </div>
    </form>
  );
}
