"use client";

import { useEffect, useId, useRef, useState } from "react";
import UserAvatar from "./UserAvatar";

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
        <label className="field" htmlFor={id}>
          Profile photo
          <input ref={input} id={id} type="file" name="avatar_file" accept="image/jpeg,image/png,image/webp" disabled={disabled} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`} aria-invalid={!!error} onChange={(e) => {
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
        </label>
        <span className="hint" id={`${id}-hint`}>JPG, PNG or WebP, up to 3 MB. Your photo is cropped to fit.</span>
        <input type="hidden" name="remove_avatar" value={removed ? "1" : "0"} />
        {src && <button type="button" className="link-button" disabled={disabled} onClick={() => { if (input.current) input.current.value = ""; setPreview(null); setRemoved(true); setError(""); }}>Remove photo</button>}
        {error && <p className="notice error" id={`${id}-error`} role="alert">{error}</p>}
      </div>
    </div>
  );
}
