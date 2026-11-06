"use client";

import { useRef, useState } from "react";
import { deleteCollection, updateCollection } from "@/app/me/actions";

type Props = {
  list: { id: string; title: string; description: string | null; is_public: boolean; comments_enabled?: boolean };
  /** Owners also choose public or private and can delete; collaborators edit the words only. */
  isOwner: boolean;
  collaborators?: number;
};

/** "Edit" on a collection's page: name and description, and for the owner, privacy and delete. */
export default function CollectionEditor({ list, isOwner, collaborators = 0 }: Props) {
  const modal = useRef<HTMLDialogElement>(null);
  const [confirming, setConfirming] = useState(false);
  const close = () => { modal.current?.close(); setConfirming(false); };

  return (
    <>
      <button type="button" className="button ghost" aria-haspopup="dialog" onClick={() => modal.current?.showModal()}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M13.5 4.5l2 2L8 14l-3 1 1-3z" /></svg>
        Edit
      </button>
      <dialog ref={modal} className="modal" aria-labelledby={`edit-${list.id}`} onClick={(e) => { if (e.target === modal.current) close(); }} onClose={() => setConfirming(false)}>
        <div className="modal-head">
          <span className="sheet-handle" aria-hidden="true" />
          <h2 id={`edit-${list.id}`}>Edit collection</h2>
          <button type="button" className="icon-button" onClick={close} aria-label="Close">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
          </button>
        </div>
        <form action={updateCollection} className="form profile-form">
          <input type="hidden" name="id" value={list.id} />
          <div className="modal-body">
            <label className="field">
              Name
              <input name="title" defaultValue={list.title} maxLength={80} required />
            </label>
            <label className="field">
              Description
              <textarea name="description" defaultValue={list.description ?? ""} maxLength={500} rows={3} placeholder="What ties these films together?" />
            </label>
            {isOwner ? (
              <>
                <input type="hidden" name="has_public" value="1" />
                <label className="switch-row">
                  <span>
                    <span className="switch-label">Public</span>
                    <span className="hint">Anyone with the link can see it, and it can appear in the community. Private collections are only visible to you{collaborators ? " and your collaborators" : ""}.</span>
                  </span>
                  <input type="checkbox" role="switch" className="switch" name="is_public" defaultChecked={list.is_public} />
                </label>
                <input type="hidden" name="has_comments" value="1" />
                <label className="switch-row">
                  <span>
                    <span className="switch-label">Allow comments</span>
                    <span className="hint">When off, existing comments stay visible but no one can add new ones.</span>
                  </span>
                  <input type="checkbox" role="switch" className="switch" name="comments_enabled" defaultChecked={list.comments_enabled ?? true} />
                </label>
                <div className="danger-zone">
                  {confirming ? (
                    <>
                      <p>Delete &ldquo;{list.title}&rdquo;{collaborators ? ` for you and ${collaborators} ${collaborators === 1 ? "collaborator" : "collaborators"}` : ""}? Its comments go too. The films stay in everyone&rsquo;s saved films.</p>
                      <div className="actions">
                        <button className="button danger small" type="submit" formAction={deleteCollection} formNoValidate>Delete collection</button>
                        <button className="button ghost small" type="button" onClick={() => setConfirming(false)}>Keep it</button>
                      </div>
                    </>
                  ) : (
                    <button className="button ghost small danger-text" type="button" onClick={() => setConfirming(true)}>Delete collection</button>
                  )}
                </div>
              </>
            ) : null}
          </div>
          <div className="modal-foot">
            <button type="button" className="button ghost" onClick={close}>Cancel</button>
            <button type="submit" className="button">Save</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
