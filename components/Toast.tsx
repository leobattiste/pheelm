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

const GAP = 12;

/**
 * How far up the toast sits: just above whatever is pinned to the bottom of the screen right now,
 * such as the app's menu bar, a film's action bar or a sheet that's open, so it never covers them.
 */
function clearance(region: HTMLElement): number {
  const vh = window.innerHeight;
  const boxes: DOMRect[] = [];
  for (const el of document.body.getElementsByTagName("*")) {
    // Fixed elements have no offset parent; skip everything else cheaply, and the toast itself.
    if (!(el instanceof HTMLElement) || el.offsetParent !== null || region.contains(el)) continue;
    const style = getComputedStyle(el);
    if (style.position !== "fixed" || style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) continue;
    const box = el.getBoundingClientRect();
    // On screen, and not a full-screen layer.
    if (box.height > 0 && box.width > 0 && box.top < vh - 1 && box.top > vh * 0.08) boxes.push(box);
  }
  // Work up from the bottom edge: anything within reach of the current edge pushes it up, so bars
  // stacked above each other (a film's action bar above the menu bar) are all cleared.
  let edge = vh;
  for (let moved = true; moved; ) {
    moved = false;
    for (const box of boxes) {
      if (box.top < edge && box.bottom >= edge - 48) { edge = box.top; moved = true; }
    }
  }
  return edge < vh ? vh - edge + GAP : 0;
}

/**
 * The one place toasts appear: bottom centre, as wide as a modal, above the phone's home bar and
 * anything pinned to the bottom. A new message replaces the current one. Stays 5 seconds (longer
 * while hovered), and screen readers hear it. It's a popover, so it shows above an open dialog.
 */
export default function Toaster() {
  const [item, setItem] = useState<{ id: number; message: string } | null>(null);
  const [held, setHeld] = useState(false);
  const region = useRef<HTMLDivElement>(null);
  const [lift, setLift] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const show = (e: Event) => setItem({ id: Date.now(), message: (e as CustomEvent<string>).detail });
    window.addEventListener(EVENT, show);
    return () => window.removeEventListener(EVENT, show);
  }, []);

  // Re-open on each message so it lands on top of whatever is open now.
  useEffect(() => {
    const el = region.current;
    if (!el) return;
    if (typeof el.showPopover === "function") {
      try {
        if (el.matches(":popover-open")) el.hidePopover();
        if (item) el.showPopover();
      } catch {}
    }
    if (!item) return;
    // Keep clear of bottom bars, which can appear or move while it's showing (a film's action bar
    // slides in on scroll).
    const measure = () => setLift(clearance(el));
    measure();
    const every = setInterval(measure, 400);
    window.addEventListener("resize", measure);
    return () => { clearInterval(every); window.removeEventListener("resize", measure); };
  }, [item]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (item && !held) timer.current = setTimeout(() => setItem(null), 5000);
    return () => clearTimeout(timer.current);
  }, [item, held]);

  return (
    <div ref={region} popover="manual" className="toast-region" role="status" aria-live="polite"
      style={lift ? ({ "--toast-lift": `${lift}px` } as React.CSSProperties) : undefined}>
      {item && (
        <div key={item.id} className="toast" onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)}>
          {/* A suggested word like “b-word” never breaks across lines. */}
          <span>{item.message.replace(/“[^”]+”/g, (quoted) => quoted.replace(/-/g, "\u2011"))}</span>
          <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => setItem(null)}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
