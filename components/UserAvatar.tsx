"use client";

import { useState } from "react";
import { initials } from "@/lib/format";

type Person = { handle?: string | null; display_name?: string | null; avatar_url?: string | null };

/** Uploaded photos and initials share the same frame everywhere a member appears. */
export default function UserAvatar({ person, className = "avatar", size }: { person: Person; className?: string; size?: number }) {
  const [failed, setFailed] = useState<string | null>(null);
  const src = person.avatar_url;
  const style = size ? { width: size, height: size } : undefined;
  if (src && failed !== src) return <img className={`${className} user-photo`} src={src} alt="" aria-hidden="true" style={style} loading="lazy" ref={(image) => { if (image?.complete && !image.naturalWidth) setFailed(src); }} onError={() => setFailed(src)} />;
  return <span className={`${className}${className.includes("portrait") ? " portrait-initials" : ""}`} aria-hidden="true" style={style}>{initials((person.display_name || person.handle || "?").replace(/^@/, ""))}</span>;
}
