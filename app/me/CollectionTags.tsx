"use client";

import { useActionState, useEffect, useRef } from "react";
import { tagMember, untagMember, type TagState } from "./actions";

type Person = { id: string; handle: string; display_name: string | null };

/**
 * On your own public collection: the people you've tagged (co-curators, or anyone you made it
 * with), with a field to tag someone by @handle. Only members with a public profile can be tagged.
 */
export default function CollectionTags({ listId, isPublic, tagged }: { listId: string; isPublic: boolean; tagged: Person[] }) {
  const [state, action, pending] = useActionState<TagState, FormData>(tagMember, null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);

  if (!isPublic) {
    return <p className="label collection-tags-note">Make this collection public to tag people on it.</p>;
  }

  return (
    <section className="collection-tags" aria-labelledby={`tags-${listId}`}>
      <h3 id={`tags-${listId}`}>Tagged</h3>
      {tagged.length > 0 && (
        <ul className="chip-list">
          {tagged.map((p) => (
            <li key={p.id}>
              <form action={untagMember}>
                <input type="hidden" name="list_id" value={listId} />
                <input type="hidden" name="user_id" value={p.id} />
                <input type="hidden" name="back" value={`/me?c=${listId}`} />
                <button type="submit" className="chip" aria-label={`Remove @${p.handle}`}>
                  @{p.handle}
                  <svg className="x" viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8M14 6l-8 8" /></svg>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <form ref={form} action={action} className="tag-form">
        <input type="hidden" name="list_id" value={listId} />
        <label className="visually-hidden" htmlFor={`tag-input-${listId}`}>Tag someone by handle</label>
        <input id={`tag-input-${listId}`} name="handle" placeholder="@handle" autoCapitalize="none" spellCheck={false} maxLength={25} required />
        <button type="submit" className="button ghost small" disabled={pending}>{pending ? "Tagging…" : "Tag"}</button>
      </form>
      {state && <p className={state.ok ? "form-note" : "notice error"} role="status">{state.message}</p>}
    </section>
  );
}
