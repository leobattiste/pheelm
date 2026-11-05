"use client";

import { useState } from "react";

/** Opens the phone's share sheet, or copies the link where there isn't one. */
export default function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href.split("#")[0];
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Cancelled, or not allowed: fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <button type="button" className="button ghost icon-pill" onClick={share} aria-label={copied ? "Link copied" : `Share ${title}`}>
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v10M6 7l4-4 4 4M4 12v4h12v-4" /></svg>
      <span className="icon-pill-label" aria-live="polite">{copied ? "Copied" : "Share"}</span>
    </button>
  );
}
