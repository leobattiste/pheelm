"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isBannedWordMessage } from "@/lib/banned-words";

const EVENT = "pheelm:toast";
const LATER = "pheelm:toast-next";
const MAX_SHOWN = 3;

export type ToastKind = "success" | "error" | "info";
/** A button on the toast: Undo, View… Give it `run` to do something, or `href` to go somewhere. */
export type ToastAction = { label: string; run?: () => void | Promise<void>; href?: string };
export type ToastOptions = { kind?: ToastKind; action?: ToastAction; /** Milliseconds on screen. */ duration?: number };

/** Shows a short message that slides up from the bottom of the screen, then goes away. */
export function toast(message: string, options: ToastOptions = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, ...options } }));
}
toast.success = (message: string, options: Omit<ToastOptions, "kind"> = {}) => toast(message, { ...options, kind: "success" });
toast.error = (message: string, options: Omit<ToastOptions, "kind"> = {}) => toast(message, { ...options, kind: "error" });

/**
 * Shows a toast on the next page, for when the page is about to be replaced (a full reload, a
 * sign-in or a redirect). The message is kept for 30 seconds, and shown once.
 */
export function toastNext(message: string, kind: ToastKind = "success") {
  try { sessionStorage.setItem(LATER, JSON.stringify({ message, kind, at: Date.now() })); } catch {}
}

/** Shows a toast when a form's result is a refusal for a banned word. */
export function useBannedWordToast(state: { ok: boolean; message?: string } | null | undefined) {
  useEffect(() => {
    if (state && !state.ok && isBannedWordMessage(state.message)) toast.error(state.message!);
  }, [state]);
}

/** Shows a toast for the result of a server action: its message when it worked, or why it didn't. */
export function useResultToast(state: { ok: boolean; message?: string } | null | undefined, success?: string) {
  useEffect(() => {
    if (!state) return;
    if (state.ok) { if (success || state.message) toast.success(success ?? state.message!); }
    else if (state.message) toast.error(state.message);
  }, [state, success]);
}

const GAP = 12;

/**
 * How far up the toasts sit: just above whatever is pinned to the bottom of the screen right now,
 * such as the app's menu bar, a film's action bar or a sheet that's open, so they never cover them.
 */
function clearance(region: HTMLElement): number {
  const vh = window.innerHeight;
  const boxes: DOMRect[] = [];
  for (const el of document.body.getElementsByTagName("*")) {
    // Fixed elements have no offset parent; skip everything else cheaply, and the toasts themselves.
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

type Item = { id: number; message: string; kind: ToastKind; action?: ToastAction; duration: number };
let counter = 0;

const ICONS: Record<ToastKind, React.ReactNode> = {
  success: <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  error: <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 7.5v5.5M12 16.4v.1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>,
  info: <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 11v5.5M12 7.9v.1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>,
};

function ToastCard({ item, onDone }: { item: Item; onDone: () => void }) {
  const router = useRouter();
  const [held, setHeld] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (held) return;
    const timer = setTimeout(() => done.current(), item.duration);
    return () => clearTimeout(timer);
  }, [held, item.duration]);

  const act = async () => {
    const { action } = item;
    if (!action) return;
    onDone();
    if (action.href) router.push(action.href);
    try { await action.run?.(); } catch {}
  };

  return (
    <div className={`toast toast-${item.kind}`} role={item.kind === "error" ? "alert" : "status"}
      onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)} onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}>
      {item.kind !== "info" && <span className="toast-icon">{ICONS[item.kind]}</span>}
      {/* A suggested word like “b-word” never breaks across lines. */}
      <span className="toast-text">{item.message.replace(/“[^”]+”/g, (quoted) => quoted.replace(/-/g, "‑"))}</span>
      {item.action && <button type="button" className="toast-action" onClick={act}>{item.action.label}</button>}
      <button type="button" className="toast-close" aria-label="Dismiss" onClick={onDone}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}

/**
 * The one place toasts appear: bottom centre, as wide as a modal, above the phone's home bar and
 * anything pinned to the bottom. Up to three show at once, newest at the bottom; the same message
 * twice shows once. Each stays 5 seconds (6 with a button; longer while hovered), and screen
 * readers hear it. It's a popover, so it shows above an open dialog.
 */
export default function Toaster() {
  const [items, setItems] = useState<Item[]>([]);
  const region = useRef<HTMLDivElement>(null);
  const [lift, setLift] = useState(0);
  const path = usePathname();

  useEffect(() => {
    const show = (e: Event) => {
      const d = (e as CustomEvent<{ message: string } & ToastOptions>).detail;
      if (!d?.message) return;
      const next: Item = { id: ++counter, message: d.message, kind: d.kind ?? "info", action: d.action, duration: d.duration ?? (d.action ? 7000 : 5000) };
      setItems((all) => [...all.filter((i) => i.message !== next.message), next].slice(-MAX_SHOWN));
    };
    window.addEventListener(EVENT, show);
    return () => window.removeEventListener(EVENT, show);
  }, []);

  // A toast saved for the next page (see toastNext, or withToast on a server redirect): shown once the page is here.
  useEffect(() => {
    try {
      const cookie = document.cookie.split("; ").find((c) => c.startsWith("pheelm_toast="));
      if (cookie) {
        document.cookie = "pheelm_toast=; path=/; max-age=0";
        const sent = JSON.parse(decodeURIComponent(cookie.slice("pheelm_toast=".length))) as { m: string; k: ToastKind };
        if (sent.m) toast(sent.m, { kind: sent.k });
      }
    } catch {}
    try {
      const raw = sessionStorage.getItem(LATER);
      if (!raw) return;
      sessionStorage.removeItem(LATER);
      const saved = JSON.parse(raw) as { message: string; kind: ToastKind; at: number };
      if (saved.message && Date.now() - saved.at < 30000) toast(saved.message, { kind: saved.kind });
    } catch {}
  }, [path]);

  const count = items.length;
  const latest = items[items.length - 1]?.id;
  // Re-open when a new message arrives so it lands on top of whatever is open now.
  useEffect(() => {
    const el = region.current;
    if (!el) return;
    if (typeof el.showPopover === "function") {
      try {
        if (el.matches(":popover-open")) el.hidePopover();
        if (count) el.showPopover();
      } catch {}
    }
    if (!count) return;
    // Keep clear of bottom bars, which can appear or move while it's showing (a film's action bar
    // slides in on scroll).
    const measure = () => setLift(clearance(el));
    measure();
    const every = setInterval(measure, 400);
    window.addEventListener("resize", measure);
    return () => { clearInterval(every); window.removeEventListener("resize", measure); };
  }, [latest, count]);

  return (
    <div ref={region} popover="manual" className="toast-region" aria-live="polite"
      style={lift ? ({ "--toast-lift": `${lift}px` } as React.CSSProperties) : undefined}>
      {items.map((item) => (
        <ToastCard key={item.id} item={item} onDone={() => setItems((all) => all.filter((i) => i.id !== item.id))} />
      ))}
    </div>
  );
}
