"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import { toast } from "./Toast";

/** Opens the phone's share sheet, or copies the link where there isn't one. */
export default function ShareButton({ title, item = false, url: shareUrl }: { title: string; item?: boolean; url?: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = shareUrl ?? window.location.href.split("#")[0];
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
      toast.success("Link copied");
    } catch {
      toast.error("Couldn’t copy the link. Copy it from the address bar.");
    }
  };

  if (item) {
    return (
      <button type="button" className="button ghost" data-action="share" onClick={share}>
        {copied ? (
          <Icon name="check" />
        ) : (
          <Icon name="share" />
        )}
        <span aria-live="polite">{copied ? "Link copied" : "Share"}</span>
      </button>
    );
  }

  return (
    <button type="button" className="round-button" data-action="share" onClick={share} aria-label={copied ? "Link copied" : `Share ${title}`} title={copied ? "Link copied" : "Share"}>
      {copied ? (
        <Icon name="check" />
      ) : (
        <Icon name="share" />
      )}
      <span className="visually-hidden" aria-live="polite">{copied ? "Link copied" : ""}</span>
    </button>
  );
}
