"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { removeCollaborator, requestCollaboration, type CollabState } from "@/app/c/actions";
import { openSignIn } from "./SignInSheet";
import Icon from "@/components/Icon";

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
          <Icon name="check" />
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
        <Icon name="userPlus" />
        Ask to co-curate
      </button>
      <dialog ref={modal} className="modal" aria-labelledby={`ask-${listId}`} onClick={(e) => { if (e.target === modal.current) modal.current?.close(); }}>
        <div className="modal-head">
          <span className="sheet-handle" aria-hidden="true" />
          <h2 id={`ask-${listId}`}>Ask to co-curate</h2>
          <button type="button" className="icon-button" onClick={() => modal.current?.close()} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {hasProfile ? (
          <form action={action} className="form profile-form">
            <input type="hidden" name="list_id" value={listId} />
            <div className="modal-body">
              <p className="muted">
                Co-curators add films and edit this collection with {ownerHandle ? `@${ownerHandle}` : "its curator"}. They&rsquo;ll get your request and can approve it.
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
            <p>Curators are shown by name and @handle, so you&rsquo;ll need a profile first.</p>
            <div className="actions"><Link className="button" href="/profile">Create your profile</Link></div>
          </div>
        )}
      </dialog>
    </>
  );
}
