"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { REPLY_TEMPLATES } from "@/lib/inbox";
import { replyToMessage, saveNotes } from "./actions";

/** Writing a reply: start from a template if one fits, edit, send. Optionally close the message. */
export function ReplyForm({ id, topic, name, email, closed }: { id: string; topic: string; name: string; email: string; closed: boolean }) {
  const [state, action, pending] = useActionState(replyToMessage, null);
  const [text, setText] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const templates = REPLY_TEMPLATES.filter((t) => t.topics.includes(topic));
  useEffect(() => { if (state?.ok) setText(""); }, [state]);
  return (
    <form ref={form} action={action} className="form admin-reply">
      <input type="hidden" name="id" value={id} />
      {templates.length > 0 && (
        <div className="admin-templates" role="group" aria-label="Start from a template">
          {templates.map((t) => (
            <button key={t.id} type="button" className="chip" onClick={() => setText(t.text(name.split(/\s+/)[0] || "there"))}>{t.label}</button>
          ))}
        </div>
      )}
      <label className="field">
        Reply to {email}
        <textarea name="reply" rows={8} maxLength={5000} required value={text} onChange={(e) => setText(e.currentTarget.value)} />
        <span className="field-hint">Sent from notifications@pheelm.com. If they answer, it goes to hey@pheelm.com.</span>
      </label>
      <label className="check"><input type="checkbox" name="close" defaultChecked={!closed && topic !== "partnership"} /> Mark as done after sending</label>
      <div className="actions">
        <button className="button small" disabled={pending || !text.trim()}>{pending ? "Sending…" : "Send reply"}</button>
        <a className="button ghost small" href={`mailto:${email}?subject=${encodeURIComponent("Re: your message to Pheelm")}`}>Write from my email instead</a>
      </div>
      {state && <p role="status" className={state.ok ? "notice ok" : "notice error"}>{state.message}</p>}
    </form>
  );
}

/** Notes only admins see: what was agreed, who to follow up with. */
export function NotesForm({ id, notes }: { id: string; notes: string | null }) {
  const [state, action, pending] = useActionState(saveNotes, null);
  return (
    <form action={action} className="form">
      <input type="hidden" name="id" value={id} />
      <label className="field">
        <span className="visually-hidden">Notes</span>
        <textarea name="notes" rows={4} maxLength={10000} defaultValue={notes ?? ""} placeholder="Only admins see these." />
      </label>
      <div className="actions">
        <button className="button ghost small" disabled={pending}>{pending ? "Saving…" : "Save notes"}</button>
        {state && <span role="status" className={state.ok ? "muted" : "notice error"}>{state.message}</span>}
      </div>
    </form>
  );
}
