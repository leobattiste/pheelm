"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * A check beside a member's name with what they do at Pheelm. Shows on hover or focus, and on a
 * tap on phones; tapping again or anywhere else hides it.
 */
export default function VerifiedBadge({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", key); };
  }, [open]);

  return (
    <span className="verified" ref={wrap} data-open={open || undefined}>
      <button type="button" className="verified-mark" aria-label={`Verified: ${title}`} aria-describedby={id} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path className="verified-seal" d="M10 1.8l2.1 1.6 2.6-.2.9 2.5 2.3 1.2-.6 2.6 1.1 2.4-2 1.7-.3 2.6-2.6.4L12.2 18 10 16.6 7.8 18l-1.9-1.8-2.6-.4-.3-2.6-2-1.7 1.1-2.4-.6-2.6 2.3-1.2.9-2.5 2.6.2z" />
          <path className="verified-tick" d="m6.8 10.2 2.2 2.2 4.3-4.6" />
        </svg>
      </button>
      <span role="tooltip" id={id} className="verified-tip">{title}</span>
    </span>
  );
}
