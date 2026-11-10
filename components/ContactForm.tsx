"use client";
import { PARTNERSHIP_TYPES } from "@/lib/partnership";
import EmailInput from "@/components/EmailInput";

import Link from "next/link";
import { useActionState, useState } from "react";
import Icon from "./Icon";
import Turnstile from "./Turnstile";
import { sendMessage, type FormState } from "@/app/platform-actions";

const TOPICS: [string, string][] = [
  ["general", "General enquiry"],
  ["press", "Press"],
  ["privacy", "My data and privacy"],
];

/** Separate enquiry, feedback and partnership topics, with one inbox delivery action. */
export default function ContactForm({ topic = "general", partnership = false, feedback = false, about }: { topic?: string; partnership?: boolean; feedback?: boolean; about?: { page: string; title: string } }) {
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
        <label className="field">{partnership ? "Full name *" : "Your name"}<input name="name" autoComplete="name" required={partnership} maxLength={200} /></label>
        <label className="field">{partnership ? "Email address *" : "Email"}<EmailInput name="email"  autoComplete="email" required maxLength={254} /></label>
      </div>
      {partnership ? (
        <>
          <label className="field">Organization or project<input name="organization" autoComplete="organization" maxLength={200} /></label>
          <label className="field">Website or social media<input name="partnership_url" type="url" autoComplete="url" maxLength={500} placeholder="https://" /></label>
          <label className="field">Partnership type *<select name="partnership_type" aria-label="Partnership type" required defaultValue=""><option value="" disabled>Choose a partnership type</option>{PARTNERSHIP_TYPES.map(type=><option key={type} value={type}>{type}</option>)}</select></label>
          <input type="hidden" name="topic" value="partnership" />
        </>
      ) : (
        <label className="field">
          What&rsquo;s it about?
          <select name="topic" defaultValue={topic}>
            {(feedback ? [["feedback", "Problem or improvement"], ["correction", "Film or person correction"]] : TOPICS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      )}
      <label className="field">
        {partnership ? "Tell us about your proposal *" : feedback ? "Your feedback" : "Message"}
        <textarea name="body" required maxLength={partnership ? 4000 : 5000} placeholder={partnership ? "Tell us about your organisation and what you have in mind." : feedback ? "Tell us what happened, what you expected, or what needs correcting." : "How can we help?"} />
      </label>
      <input name="website" tabIndex={-1} autoComplete="off" className="visually-hidden" aria-hidden="true" />
      <Turnstile />
      {state && !state.ok && <p className="notice error" role="alert">{state.message}</p>}
      <div className="actions">
        <button className="button" type="submit" disabled={pending}>{pending ? "Sending…" : partnership ? "Submit Inquiry" : feedback ? "Send feedback" : "Send message"}</button>
      </div>
    </form>
  );
}
