"use client";

import { useEffect } from "react";

/** Glass controls that respond to touch: they swell and light up from where the finger is. */
const GLASS = ".button, .chip, .pill-button, .round-button, .icon-button, .search-trigger, .link-chip, .watch-platform, .back-to-top, .segmented button, .theme-toggle button, .grid-toggle button";

/**
 * Liquid Glass's touch behaviour, as Apple describes it for interactive glass: pressing a control
 * makes it flex larger and glow from the point of contact, and it springs back on release. This
 * only tracks the pointer; app/globals.css draws the response.
 */
export default function LiquidGlass() {
  useEffect(() => {
    let held: HTMLElement | null = null;
    const place = (el: HTMLElement, e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--lg-x", `${e.clientX - r.left}px`);
      el.style.setProperty("--lg-y", `${e.clientY - r.top}px`);
    };
    const release = () => { if (held) { delete held.dataset.lgPress; held = null; } };
    const down = (e: PointerEvent) => {
      if (!e.isPrimary || e.button > 0) return;
      const el = (e.target as Element | null)?.closest<HTMLElement>(GLASS);
      if (!el || el.matches(":disabled, [role=tab], .more-button") || el.closest(".more-panel, .tab-bar")) return;
      release();
      held = el;
      place(el, e);
      el.dataset.lgPress = "";
    };
    const move = (e: PointerEvent) => { if (held && e.isPrimary) place(held, e); };
    document.addEventListener("pointerdown", down, { passive: true });
    document.addEventListener("pointermove", move, { passive: true });
    for (const t of ["pointerup", "pointercancel", "dragstart"]) document.addEventListener(t, release, { passive: true });
    window.addEventListener("blur", release);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointermove", move);
      for (const t of ["pointerup", "pointercancel", "dragstart"]) document.removeEventListener(t, release);
      window.removeEventListener("blur", release);
    };
  }, []);
  return null;
}
