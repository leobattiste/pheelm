"use client";

import { useEffect, useRef, useState } from "react";
import { isBannedWordMessage } from "@/lib/banned-words";

const EVENT = "pheelm:toast";

/** Shows a short message that slides up from the bottom of the screen, then goes away. */
export function toast(message: string) {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: message }));
}

/** Shows a toast when a form's result is a refusal for a banned word. */
export function useBannedWordToast(state: { ok: boolean; message?: string } | null | undefined) {
  useEffect(() => {
    if (state && !state.ok && isBannedWordMessage(state.message)) toast(state.message!);
  }, [state]);
}

/**
 * The one place toasts appear: bottom centre, above the phone's home bar. A new message replaces
 * the current one. Stays 5 seconds (longer while hovered), and screen readers hear it. It's a
 * popover, so it shows above an open dialog such as Edit profile.
 */
export default function Toaster() {
  const [item, setItem] = useState<{ id: number; message: string } | null>(null);
  const [held, setHeld] = useState(false);
  const region = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const show = (e: Event) => setItem({ id: Date.now(), message: (e as CustomEvent<string>).detail });
    window.addEventListener(EVENT, show);
    return () => window.removeEventListener(EVENT, show);
  }, []);

  // Re-open on each message so it lands on top of whatever is open now.
  useEffect(() => {
    const el = region.current;
    if (!el || typeof el.showPopover !== "function") return;
    try {
      if (el.matches(":popover-open")) el.hidePopover();
      if (item) el.showPopover();
    } catch {}
  }, [item]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (item && !held) timer.current = setTimeout(() => setItem(null), 5000);
    return () => clearTimeout(timer.current);
  }, [item, held]);

  return (
    <div ref={region} popover="manual" className="toast-region" role="status" aria-live="polite">
      {item && (
        <div key={item.id} className="toast" onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)}>
          <span>{item.message}</span>
          <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => setItem(null)}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
