"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { removeCollaborator, requestCollaboration, type CollabState } from "@/app/c/actions";
import { openSignIn } from "./SignInSheet";

type Props = {
  listId: string;
  ownerHandle: string | null;
  signedIn: boolean;
  hasProfile: boolean;
  /** The visitor's current status on this collection. */
  status: "requested" | "declined" | null;
  /** When a declined visitor can ask again. */
  againOn: string | null;
};

/**
 * "Ask to collaborate" on someone's public collection: a short optional note to the owner, then
 * "Requested" until they answer. Visitors are asked to sign in, members without a handle to
 * create their profile first.
 */
export default function AskToCollaborate({ listId, ownerHandle, signedIn, hasProfile, status, againOn }: Props) {
  const modal = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<CollabState, FormData>(requestCollaboration, null);
  const [sent, setSent] = useState(status === "requested");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (state?.ok) { setSent(true); modal.current?.close(); }
  }, [state]);

  if (sent) {
    return (
      <form action={removeCollaborator} className="ask-sent">
        <input type="hidden" name="list_id" value={listId} />
        <input type="hidden" name="back" value={`/c/${listId}`} />
        <span className="button ghost is-static" aria-live="polite">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>
          Requested
        </span>
        <button type="submit" className="link-button">Withdraw</button>
      </form>
    );
  }

  if (status === "declined" && againOn) {
    return <span className="button ghost is-static" title={`You can ask again on ${againOn}`}>Ask again on {againOn}</span>;
  }

  const open = () => {
    if (!signedIn) { openSignIn(); return; }
    modal.current?.showModal();
  };

  return (
    <>
      <button type="button" className="button ghost" aria-haspopup="dialog" onClick={open}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8" cy="7" r="2.8" /><path d="M3 16c.7-2.6 2.6-4 5-4s4.3 1.4 5 4M15 7v5M12.5 9.5h5" /></svg>
        Ask to collaborate
      </button>
      <dialog ref={modal} className="modal" aria-labelledby={`ask-${listId}`} onClick={(e) => { if (e.target === modal.current) modal.current?.close(); }}>
        <div className="modal-head">
          <span className="sheet-handle" aria-hidden="true" />
          <h2 id={`ask-${listId}`}>Ask to collaborate</h2>
          <button type="button" className="icon-button" onClick={() => modal.current?.close()} aria-label="Close">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
          </button>
        </div>
        {hasProfile ? (
          <form action={action} className="form profile-form">
            <input type="hidden" name="list_id" value={listId} />
            <div className="modal-body">
              <p className="muted">
                Collaborators add films and edit this collection with {ownerHandle ? `@${ownerHandle}` : "its owner"}. They&rsquo;ll get your request and can approve it.
              </p>
              <label className="field">
                Note <span className="hint">optional</span>
                <textarea name="note" rows={3} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What would you add? e.g. the 90s films, more documentaries" />
                <span className="hint">{280 - note.length} characters left</span>
              </label>
              {state && !state.ok && <p className="notice error" role="status">{state.message}</p>}
            </div>
            <div className="modal-foot">
              <button type="button" className="button ghost" onClick={() => modal.current?.close()}>Cancel</button>
              <button type="submit" className="button" disabled={pending}>{pending ? "Sending…" : "Send request"}</button>
            </div>
          </form>
        ) : (
          <div className="modal-body">
            <p>Collaborators are shown by name and @handle, so you&rsquo;ll need a profile first.</p>
            <div className="actions"><Link className="button" href="/profile">Create your profile</Link></div>
          </div>
        )}
      </dialog>
    </>
  );
}
