"use client";
import ProfileLinksFields from "@/components/ProfileLinksFields";
import type { ProfileLinks } from "@/lib/profile-links";
import ProfileBioField from "@/components/ProfileBioField";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { updatePublicName, type NameState } from "@/app/me/actions";
import { COUNTRY_OPTIONS } from "@/lib/countries";
import ProfilePhotoField from "./ProfilePhotoField";
import Icon from "@/components/Icon";
import { useResultToast } from "@/components/Toast";

type Props = { handle: string; displayName: string | null; isPrivate: boolean; country: string | null; avatarUrl: string | null; bio?: string | null; unlimitedBio?: boolean; links?: ProfileLinks };

/**
 * "Edit profile" on your own profile page: name, country, handle and the private setting, in a modal.
 * Opens on its own when the page is reached with ?edit (from the account menu).
 */
export default function ProfileEditor({ handle, displayName, isPrivate, country, avatarUrl, bio, unlimitedBio = false, links }: Props) {
  const router = useRouter();
  const [photoVersion, setPhotoVersion] = useState(0);
  const modal = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<NameState, FormData>(updatePublicName, null);
  useResultToast(state);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("edit")) return;
    modal.current?.showModal();
    url.searchParams.delete("edit");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, []);

  useEffect(() => {
    if (!state?.ok) return;
    window.dispatchEvent(new Event("profilechange"));
    modal.current?.close();
    if (state.handle && state.handle !== handle) router.replace(`/@${state.handle}`);
    else router.refresh();
  }, [state, handle, router]);

  return (
    <>
      <button type="button" className="button ghost" aria-haspopup="dialog" onClick={() => modal.current?.showModal()}>
        <Icon name="pencil" />
        Edit profile
      </button>
      <dialog ref={modal} className="modal" onClose={() => { modal.current?.querySelector("form")?.reset(); setPhotoVersion(v => v + 1); }} aria-labelledby="edit-profile-title" onClick={(e) => { if (e.target === modal.current) modal.current?.close(); }}>
        <div className="modal-head">
          <span className="sheet-handle" aria-hidden="true" />
          <h2 id="edit-profile-title">Edit profile</h2>
          <button type="button" className="icon-button" onClick={() => modal.current?.close()} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <form action={action} className="form profile-form">
          <div className="modal-body">
            <ProfilePhotoField key={`${avatarUrl ?? "none"}:${photoVersion}`} photo={avatarUrl} name={displayName || handle} disabled={pending} />
            <label className="field">
              Name
              <input name="display_name" defaultValue={displayName ?? ""} maxLength={60} placeholder="Your name" autoComplete="name" />
            </label>
            <ProfileBioField key={`${photoVersion}:${bio ?? ""}`} bio={bio} unlimited={unlimitedBio} disabled={pending} />
      <ProfileLinksFields key={`links:${photoVersion}`} links={links} disabled={pending} />
            <label className="field">
              Country
              <select name="country" defaultValue={country ?? ""}>
                <option value="">Not shown</option>
                {COUNTRY_OPTIONS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </label>
            <label className="field">
              Handle
              <input name="handle" defaultValue={handle} required maxLength={24} pattern="[A-Za-z0-9_]{3,24}" autoCapitalize="none" spellCheck={false} aria-describedby="edit-handle-hint" />
              <span className="hint" id="edit-handle-hint">Your page is pheelm.com/@handle. 3 to 24 letters, numbers or _</span>
            </label>
            <input type="hidden" name="has_private" value="1" />
            <label className="switch-row">
              <span>
                <span className="switch-label">Private profile</span>
                <span className="hint">Only you can see your profile. Watchlists you make public stay in the community.</span>
              </span>
              <input type="checkbox" role="switch" className="switch" name="is_private" defaultChecked={isPrivate} />
            </label>
          </div>
          <div className="modal-foot">
            <button type="button" className="button ghost" onClick={() => modal.current?.close()}>Cancel</button>
            <button type="submit" className="button" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
