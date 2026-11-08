"use client";

import { useActionState, useRef } from "react";
import { updatePrivacy, type PrivacyState } from "./actions";

type Props = { isPrivate: boolean; hideWatched: boolean; hideFollowing: boolean };

/** Settings → Privacy switches. Each saves as soon as it's flipped. */
export default function PrivacyForm({ isPrivate, hideWatched, hideFollowing }: Props) {
  const [state, action, pending] = useActionState<PrivacyState, FormData>(updatePrivacy, null);
  const form = useRef<HTMLFormElement>(null);
  const save = () => form.current?.requestSubmit();

  return (
    <form ref={form} action={action} className="form settings-form" aria-busy={pending}>
      <label className="switch-row">
        <span>
          <span className="switch-label">Private profile</span>
          <span className="hint">Only you can see your profile, what you&rsquo;ve watched and who you follow. Collections you make public stay in the community.</span>
        </span>
        <input type="checkbox" role="switch" className="switch" disabled={pending} name="is_private" defaultChecked={isPrivate} onChange={save} />
      </label>
      <label className="switch-row">
        <span>
          <span className="switch-label">Hide Watched</span>
          <span className="hint">Keep the films you&rsquo;ve watched off your public profile.</span>
        </span>
        <input type="checkbox" role="switch" className="switch" disabled={pending} name="hide_watched" defaultChecked={hideWatched} onChange={save} />
      </label>
      <label className="switch-row">
        <span>
          <span className="switch-label">Hide Following</span>
          <span className="hint">Keep the directors you follow off your public profile.</span>
        </span>
        <input type="checkbox" role="switch" className="switch" disabled={pending} name="hide_following" defaultChecked={hideFollowing} onChange={save} />
      </label>
      <p className={`notice ${state?.ok === false ? "error" : "ok"}`} role="status" hidden={!state}>{state?.message}</p>
    </form>
  );
}
