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
    <button type="button" className="round-button" onClick={share} aria-label={copied ? "Link copied" : `Share ${title}`} title={copied ? "Link copied" : "Share"}>
      {copied ? (
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10.5 3.2 3.2L15 7" /></svg>
      ) : (
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v10M6 7l4-4 4 4M4 12v4h12v-4" /></svg>
      )}
      <span className="visually-hidden" aria-live="polite">{copied ? "Link copied" : ""}</span>
    </button>
  );
}
