"use client";

import { useState } from "react";
import type { MouseEvent } from "react";

const SHARE_URL = "https://www.pheelm.com";

export default function SharePheelmButton() {
  const [copied, setCopied] = useState(false);

  async function handleShare(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    setCopied(false);
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Pheelm",
          text: "Discover films by Black directors from around the world.",
          url: SHARE_URL,
        });
        return;
      }

      await navigator.clipboard.writeText(SHARE_URL);
      setCopied(true);
    } catch (error) {
      // Closing the native share sheet is not an error that needs a fallback.
      if (error instanceof DOMException && error.name === "AbortError") return;
      window.prompt("Copy this link to share Pheelm:", SHARE_URL);
    }
  }

  return (
    <>
      <a href={SHARE_URL} onClick={handleShare}>share Pheelm</a>
      {copied && <span role="status"> (link copied)</span>}
    </>
  );
}
