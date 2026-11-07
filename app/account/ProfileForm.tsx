"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { updatePublicName, type NameState } from "@/app/me/actions";
import { COUNTRY_OPTIONS } from "@/lib/countries";

type Props = { handle: string | null; displayName: string | null; isPrivate: boolean; country: string | null };

/** Settings → Profile: name, handle and country, saved together (privacy has its own tab). */
export default function ProfileForm({ handle, displayName, isPrivate, country }: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState<NameState, FormData>(updatePublicName, null);

  useEffect(() => {
    if (!state?.ok) return;
    window.dispatchEvent(new Event("profilechange"));
    router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="form settings-form">
      <label className="field">
        Name
        <input name="display_name" defaultValue={displayName ?? ""} maxLength={60} placeholder="Your name" autoComplete="name" />
        <span className="hint">Shown on your profile and next to your comments.</span>
      </label>
      <label className="field">
        Handle
        <input name="handle" defaultValue={handle ?? ""} required maxLength={24} pattern="[A-Za-z0-9_]{3,24}" autoCapitalize="none" spellCheck={false} aria-describedby="settings-handle-hint" />
        <span className="hint" id="settings-handle-hint">Your page is pheelm.com/@handle. 3 to 24 letters, numbers or _</span>
      </label>
      <label className="field">
        Country
        <select name="country" defaultValue={country ?? ""}>
          <option value="">Not shown</option>
          {COUNTRY_OPTIONS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
      </label>
      {state && <p className={`notice ${state.ok ? "ok" : "error"}`} role="status">{state.message}</p>}
      <div className="actions">
        <button type="submit" className="button" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
      </div>
    </form>
  );
}
