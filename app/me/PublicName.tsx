"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import ProfileLinksFields from "@/components/ProfileLinksFields";
import type { ProfileLinks } from "@/lib/profile-links";
import ProfilePhotoField from "@/components/ProfilePhotoField";
import ProfileBioField from "@/components/ProfileBioField";
import { updatePublicName, type NameState } from "./actions";

/** Choosing a name and handle for the first time, with a live preview. Once saved, goes to /@handle. */
export default function PublicName({ handle, displayName, avatarUrl = null, bio = null, links }: { handle: string | null; displayName: string | null; avatarUrl?: string | null; bio?: string | null; links?: ProfileLinks }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<NameState, FormData>(updatePublicName, null);
  const [name, setName] = useState(displayName ?? "");
  const [h, setH] = useState(handle ?? "");

  useEffect(() => {
    if (!state?.ok) return;
    window.dispatchEvent(new Event("profilechange"));
    if (state.handle) router.push(`/@${state.handle}`);
  }, [state, router]);

  const clean = h.trim().toLowerCase().replace(/^@/, "");
  return (
    <form action={action} className="create-profile">
      <ProfilePhotoField photo={avatarUrl} name={name || clean || "You"} disabled={pending} />
      <label className="field">
        Name
        <input name="display_name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Your name" autoComplete="name" />
        <span className="hint">Shown on your profile, your collections and your comments.</span>
      </label>
      <label className="field">
        Handle
        <input name="handle" value={h} onChange={(e) => setH(e.target.value)} required maxLength={24} pattern="@?[A-Za-z0-9_]{3,24}" autoCapitalize="none" spellCheck={false} placeholder="yourname" aria-describedby="handle-hint" />
        <span className="hint" id="handle-hint">Your page will be pheelm.com/@{clean || "handle"}. 3 to 24 letters, numbers or _</span>
      </label>
      <ProfileBioField bio={bio} disabled={pending} />
      <ProfileLinksFields links={links} disabled={pending} />
      {state && !state.ok && <p className="notice error" role="alert">{state.message}</p>}
      <div className="actions"><button className="button" type="submit" disabled={pending}>{pending ? "Creating…" : "Create profile"}</button></div>
    </form>
  );
}
