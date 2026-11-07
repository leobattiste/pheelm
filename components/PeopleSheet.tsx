"use client";

import Icon from "./Icon";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { inviteCollaborator, removeCollaborator, respondToRequest, type CollabState } from "@/app/c/actions";
import type { Member } from "@/lib/community";
import type { Person } from "@/lib/collab";
import { initials } from "@/lib/format";
import { getBrowserClient } from "@/lib/supabase/client";

type Props = {
  listId: string;
  owner: Member | null;
  collaborators: Person[];
  invited: Person[];
  requests: Person[];
  isOwner: boolean;
  isCollaborator: boolean;
  max: number;
};

export function Avatar({ m, size = 36 }: { m: Pick<Member, "handle" | "display_name">; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size < 32 ? 11 : 13 }} aria-hidden="true">
      {initials((m.display_name || m.handle).replace(/^@/, ""))}
    </span>
  );
}

function Who({ m }: { m: Member }) {
  const name = m.display_name || `@${m.handle}`;
  return (
    <span className="person-row-who">
      {m.is_private ? <span className="person-row-name">{name}</span> : <Link className="person-row-name" href={`/@${m.handle}`}>{name}</Link>}
      <span className="person-row-handle">@{m.handle}</span>
    </span>
  );
}

/** A small form button that runs a server action, with the collection's id and a way back. */
function Act({ action, listId, userId, extra, label, kind = "ghost", back }: {
  action: (f: FormData) => Promise<void>; listId: string; userId?: string; extra?: Record<string, string>; label: string; kind?: "ghost" | "solid" | "danger"; back?: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="list_id" value={listId} />
      {userId && <input type="hidden" name="user_id" value={userId} />}
      <input type="hidden" name="back" value={back ?? `/c/${listId}?people`} />
      {extra && Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button type="submit" className={`button small ${kind === "solid" ? "" : kind === "danger" ? "ghost danger-text" : "ghost"}`}>{label}</button>
    </form>
  );
}

/** Find members to invite by handle or name, as you type. Arrow keys and Enter pick one. */
function InviteField({ listId, exclude, full }: { listId: string; exclude: string[]; full: boolean }) {
  const [state, action, pending] = useActionState<CollabState, FormData>(inviteCollaborator, null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Member[]>([]);
  const [active, setActive] = useState(-1);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const skip = useMemo(() => new Set(exclude), [exclude]);

  useEffect(() => {
    if (state?.ok) { setQ(""); setHits([]); }
  }, [state]);

  useEffect(() => {
    const term = q.trim().replace(/^@/, "");
    if (term.length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      const db = getBrowserClient();
      if (!db) return;
      const safe = term.replace(/[%_,()]/g, "");
      const { data } = await db
        .from("member_profiles")
        .select("id, handle, display_name")
        .eq("is_private", false)
        .or(`handle.ilike.${safe}%,display_name.ilike.%${safe}%`)
        .limit(8);
      setHits(((data ?? []) as Member[]).filter((m) => !skip.has(m.id)).slice(0, 5));
      setActive(-1);
    }, 180);
    return () => clearTimeout(t);
  }, [q, skip]);

  const pick = (m: Member) => {
    setQ(`@${m.handle}`);
    setHits([]);
    requestAnimationFrame(() => form.current?.requestSubmit());
  };

  if (full) return <p className="people-note">This collection has the most collaborators it can have.</p>;

  return (
    <form ref={form} action={action} className="invite-form" autoComplete="off">
      <input type="hidden" name="list_id" value={listId} />
      <div className="invite-row">
        <div className="invite-combo">
          <label className="visually-hidden" htmlFor={`invite-${listId}`}>Invite by handle or name</label>
          <input
            ref={input}
            id={`invite-${listId}`}
            name="handle"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Invite by @handle or name"
            autoCapitalize="none"
            spellCheck={false}
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-controls={`invite-hits-${listId}`}
            aria-activedescendant={active >= 0 ? `hit-${hits[active]?.id}` : undefined}
            onKeyDown={(e) => {
              if (!hits.length) return;
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % hits.length); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a <= 0 ? hits.length - 1 : a - 1)); }
              if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(hits[active]); }
              if (e.key === "Escape") { e.stopPropagation(); setHits([]); }
            }}
          />
          {hits.length > 0 && (
            <ul className="invite-hits" id={`invite-hits-${listId}`} role="listbox">
              {hits.map((m, i) => (
                <li key={m.id} id={`hit-${m.id}`} role="option" aria-selected={i === active}>
                  <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(m)}>
                    <Avatar m={m} size={28} />
                    <span className="person-row-who"><span className="person-row-name">{m.display_name || `@${m.handle}`}</span><span className="person-row-handle">@{m.handle}</span></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="submit" className="button small" disabled={pending || !q.trim()}>{pending ? "Inviting…" : "Invite"}</button>
      </div>
      {state && <p className={state.ok ? "people-note ok" : "notice error"} role="status">{state.message}</p>}
    </form>
  );
}

/**
 * The "People" button on a collection and the sheet it opens: the owner and collaborators, and
 * for the owner, requests to answer, invites waiting, and inviting someone new.
 */
export default function PeopleSheet({ listId, owner, collaborators, invited, requests, isOwner, isCollaborator, max }: Props) {
  const modal = useRef<HTMLDialogElement>(null);
  const [leaving, setLeaving] = useState(false);

  // Reopen after an action (the page comes back with ?people).
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("people")) return;
    modal.current?.showModal();
    url.searchParams.delete("people");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, []);

  const pending = isOwner ? requests.length : 0;
  const total = collaborators.length + invited.length;

  return (
    <>
      <button type="button" className="button ghost people-button" aria-haspopup="dialog" onClick={() => modal.current?.showModal()}>
        <Icon name="users" />
        People
        {pending > 0 && <span className="badge" aria-label={`${pending} waiting`}>{pending}</span>}
      </button>
      <dialog ref={modal} className="modal" aria-labelledby={`people-${listId}`} onClick={(e) => { if (e.target === modal.current) modal.current?.close(); }}>
        <div className="modal-head">
          <span className="sheet-handle" aria-hidden="true" />
          <h2 id={`people-${listId}`}>People</h2>
          <button type="button" className="icon-button" onClick={() => modal.current?.close()} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body people-body">
          {isOwner && requests.length > 0 && (
            <section className="people-group" aria-labelledby={`req-${listId}`}>
              <h3 id={`req-${listId}`}>Asking to collaborate</h3>
              <ul>
                {requests.map((p) => (
                  <li key={p.id} className="person-row is-request">
                    <Avatar m={p} />
                    <div className="person-row-main">
                      <Who m={p} />
                      {p.note && <p className="person-row-note">&ldquo;{p.note}&rdquo;</p>}
                      <div className="person-row-actions">
                        <Act action={respondToRequest} listId={listId} userId={p.id} extra={{ accept: "1" }} label="Approve" kind="solid" />
                        <Act action={respondToRequest} listId={listId} userId={p.id} extra={{ accept: "0" }} label="Decline" />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="people-group" aria-labelledby={`crew-${listId}`}>
            <h3 id={`crew-${listId}`}>Collaborators{collaborators.length ? ` (${collaborators.length})` : ""}</h3>
            <ul>
              {owner && (
                <li className="person-row">
                  <Avatar m={owner} />
                  <Who m={owner} />
                  <span className="person-role">Owner</span>
                </li>
              )}
              {collaborators.map((p) => (
                <li key={p.id} className="person-row">
                  <Avatar m={p} />
                  <Who m={p} />
                  {isOwner ? <Act action={removeCollaborator} listId={listId} userId={p.id} label="Remove" /> : <span className="person-role">Collaborator</span>}
                </li>
              ))}
            </ul>
            {!collaborators.length && <p className="people-note">{isOwner ? "No one yet. Invite people to add films and edit this collection with you." : "Just the owner for now."}</p>}
          </section>

          {isOwner && invited.length > 0 && (
            <section className="people-group" aria-labelledby={`inv-${listId}`}>
              <h3 id={`inv-${listId}`}>Invited</h3>
              <ul>
                {invited.map((p) => (
                  <li key={p.id} className="person-row is-pending">
                    <Avatar m={p} />
                    <Who m={p} />
                    <Act action={removeCollaborator} listId={listId} userId={p.id} label="Cancel invite" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {isOwner && (
            <section className="people-group" aria-labelledby={`add-${listId}`}>
              <h3 id={`add-${listId}`}>Invite <span className="people-count">{total} of {max}</span></h3>
              <InviteField listId={listId} exclude={[...(owner ? [owner.id] : []), ...collaborators.map((p) => p.id), ...invited.map((p) => p.id)]} full={total >= max} />
              <p className="people-note">Collaborators add and remove films and edit the name and description. Only you choose who joins, make it public or private, and delete it.</p>
            </section>
          )}

          {isCollaborator && (
            <div className="danger-zone">
              {leaving ? (
                <>
                  <p>Leave this collection? Films you added stay in it. You&rsquo;d need a new invite to come back.</p>
                  <div className="actions">
                    <Act action={removeCollaborator} listId={listId} label="Leave collection" kind="danger" back="/me" />
                    <button type="button" className="button ghost small" onClick={() => setLeaving(false)}>Stay</button>
                  </div>
                </>
              ) : (
                <button type="button" className="button ghost small danger-text" onClick={() => setLeaving(true)}>Leave collection</button>
              )}
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
