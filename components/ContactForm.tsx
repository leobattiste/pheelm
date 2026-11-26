"use client";
import { PARTNERSHIP_TYPES } from "@/lib/partnership";
import EmailInput from "@/components/EmailInput";

import Link from "next/link";
import { useActionState, useState } from "react";
import Icon from "./Icon";
import Turnstile from "./Turnstile";
import { sendMessage, type FormState } from "@/app/platform-actions";
import { useResultToast } from "@/components/Toast";

const TOPICS: [string, string][] = [
  ["general", "General enquiry"],
  ["press", "Press"],
  ["privacy", "My data and privacy"],
];

/** Separate enquiry, feedback and partnership topics, with one inbox delivery action. */
export default function ContactForm({ topic = "general", partnership = false, feedback = false, about }: { topic?: string; partnership?: boolean; feedback?: boolean; about?: { page: string; title: string } }) {
  const [on, setOn] = useState(true);
  // Controlled partnership fields retain their values if the server rejects a proposal.
  const [proposal, setProposal] = useState({
    name: "",
    organization: "",
    partnership_url: "",
    partnership_type: "",
    body: "",
  });
  const updateProposal = (field: keyof typeof proposal, value: string) =>
    setProposal((current) => ({ ...current, [field]: value }));
  const ref = on ? about : undefined;
  const [state, action, pending] = useActionState<FormState, FormData>(sendMessage, null);
  useResultToast(state);

  if (state?.ok) {
    return <p className="notice ok" role="status">{state.message}</p>;
  }

  return (
    <form action={action} className="form contact-form">
      {state && !state.ok && <p className="notice error" role="alert">{state.message}</p>}
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
        <label className="field">{partnership ? "Full name *" : "Your name"}<input name="name" autoComplete="name" required={partnership} maxLength={200} value={partnership ? proposal.name : undefined} onChange={partnership ? (event) => updateProposal("name", event.target.value) : undefined} /></label>
        <label className="field">{partnership ? "Email address *" : "Email"}<EmailInput name="email"  autoComplete="email" required maxLength={254} /></label>
      </div>
      {partnership ? (
        <>
          <label className="field">Organization or project<input name="organization" autoComplete="organization" maxLength={200} value={proposal.organization} onChange={(event) => updateProposal("organization", event.target.value)} /></label>
          <label className="field">Website or social media<input name="partnership_url" type="url" autoComplete="url" maxLength={500} placeholder="https://" value={proposal.partnership_url} onChange={(event) => updateProposal("partnership_url", event.target.value)} /></label>
          <label className="field">Partnership type *<select name="partnership_type" aria-label="Partnership type" required value={proposal.partnership_type} onChange={(event) => updateProposal("partnership_type", event.target.value)}><option value="" disabled>Choose a partnership type</option>{PARTNERSHIP_TYPES.map(type=><option key={type} value={type}>{type}</option>)}</select></label>
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
        <textarea name="body" required maxLength={partnership ? 4000 : 5000} value={partnership ? proposal.body : undefined} onChange={partnership ? (event) => updateProposal("body", event.target.value) : undefined} placeholder={partnership ? "Tell us about your idea, what you hope to achieve, and how Pheelm could be involved." : feedback ? "Tell us what happened, what you expected, or what needs correcting." : "How can we help?"} />
      </label>
      <input name="website" tabIndex={-1} autoComplete="off" className="visually-hidden" aria-hidden="true" />
      <Turnstile />
      <div className="actions">
        <button className="button" type="submit" disabled={pending}>{pending ? "Sending…" : partnership ? "Send proposal" : feedback ? "Send feedback" : "Send message"}</button>
      </div>
    </form>
  );
}
