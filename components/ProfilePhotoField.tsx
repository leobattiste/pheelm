"use client";

import { useEffect, useId, useRef, useState } from "react";
import UserAvatar from "./UserAvatar";
import Icon from "./Icon";

/** The selected image is only uploaded when the surrounding profile form is saved. */
export default function ProfilePhotoField({ photo, name, disabled }: { photo: string | null; name: string; disabled?: boolean }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const src = preview || (!removed ? photo : null);
  return (
    <div className="profile-photo-field">
      <UserAvatar person={{ avatar_url: src, display_name: name }} className="profile-photo-preview" />
      <div className="profile-photo-controls">
        <span className="profile-photo-label">Profile photo</span>
        <div className="profile-photo-actions">
          <button type="button" className="round-button profile-photo-action" disabled={disabled} onClick={() => input.current?.click()} aria-controls={id} aria-label={src ? "Change profile photo" : "Choose profile photo"} title={src ? "Change profile photo" : "Choose profile photo"}><Icon name="camera" /></button>
          <input ref={input} id={id} type="file" className="visually-hidden" tabIndex={-1} aria-label="Profile photo file" name="avatar_file" accept="image/jpeg,image/png,image/webp" disabled={disabled} aria-describedby={error ? `${id}-error` : undefined} aria-invalid={!!error} onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 3 * 1024 * 1024) {
              setError("Choose a JPG, PNG or WebP image up to 3 MB.");
              e.target.value = "";
              setPreview(null);
              return;
            }
            setError(""); setRemoved(false); setPreview(URL.createObjectURL(file));
          }} />

        <input type="hidden" name="remove_avatar" value={removed ? "1" : "0"} />
        {src && <button type="button" className="round-button profile-photo-action" aria-label="Remove profile photo" title="Remove profile photo" disabled={disabled} onClick={() => { if (input.current) input.current.value = ""; setPreview(null); setRemoved(true); setError(""); }}><Icon name="trash" /></button>}
        </div>
        {error && <p className="notice error" id={`${id}-error`} role="alert">{error}</p>}
      </div>
    </div>
  );
}
