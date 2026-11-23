"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import {
  TOUR_STORAGE_KEY, canShowTour, cleanTourState, emptyTourState, finishTour, mergeTourState,
  sameTourState, startTour, turnOffTours, type TourState,
} from "@/lib/tour";

type Step = { labels: string[]; title: string; text: string };

/** The menu bar tour. A step points at the first of its labels that is on screen (Profile or Sign in). */
const MENU_TOUR: Step[] = [
  { labels: ["Films"], title: "Films", text: "Browse every film. The order is shuffled each visit, so there is always something new." },
  { labels: ["Watchlists"], title: "Watchlists", text: "Collections by theme, country and era, plus the ones people make." },
  { labels: ["Directors"], title: "Directors", text: "Black directors from around the world, with every film they have made." },
  { labels: ["Profile", "Sign in"], title: "You", text: "Sign in to save films, make watchlists and mark what you have watched. Members find their profile here." },
  { labels: ["More"], title: "More", text: "Notifications, settings, ways to support Pheelm, and help." },
];

// Pages where the tour would get in the way.
const SKIP = /^\/(login|auth|welcome|offline|admin)(\/|$)/;
const START_DELAY_MS = 1500;

const visible = (el: Element | null): el is HTMLElement => !!el && (el as HTMLElement).getBoundingClientRect().width > 0;
const findTarget = (labels: string[]): HTMLElement | null => {
  for (const label of labels) {
    const el = [...document.querySelectorAll(".tab-bar [aria-label]")].find((n) => (n.getAttribute("aria-label") ?? "").startsWith(label) && visible(n));
    if (el) return el as HTMLElement;
  }
  return null;
};

/**
 * First-visit tour of the menu bar: a dimmed page, the tab in a spotlight and a small card with
 * Back and Next. It comes back after it is closed or the page is refreshed, twice more, then
 * stops; finishing it or "Don't show again" stops it at once. The memory is in the browser, and
 * for signed-in members on their account too (lib/tour.ts).
 */
export default function Tour() {
  const path = usePathname();
  const [step, setStep] = useState<number | null>(null);
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const memory = useRef<{ state: TourState; userId: string | null } | null>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const last = useRef<HTMLElement | null>(null);

  const save = useCallback((next: TourState) => {
    const m = memory.current;
    if (!m) return;
    m.state = next;
    try { localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(next)); } catch {}
    const db = getBrowserClient();
    if (m.userId && db) void db.from("tour_progress").upsert({ user_id: m.userId, state: next, updated_at: new Date().toISOString() }).then(() => {}, () => {});
  }, []);

  // Open it once the page has settled, if this person has any showings left.
  useEffect(() => {
    if (SKIP.test(path)) return;
    // Automated browsers (the site's own checks) don't get the tour unless a test asks for it.
    try { if (navigator.webdriver && !localStorage.getItem("pheelm:tour:test")) return; } catch {}
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled || document.documentElement.dataset.chrome !== "app" || document.querySelector("dialog[open]")) return;
      if (!findTarget(MENU_TOUR[0].labels)) return;
      if (!memory.current) {
        let local = emptyTourState();
        try { local = cleanTourState(JSON.parse(localStorage.getItem(TOUR_STORAGE_KEY) ?? "null")); } catch {}
        let userId: string | null = null;
        let state = local;
        const db = getBrowserClient();
        if (db) {
          try {
            const { data: { session } } = await db.auth.getSession();
            userId = session?.user?.id ?? null;
            if (userId) {
              const { data } = await db.from("tour_progress").select("state").eq("user_id", userId).maybeSingle();
              const remote = cleanTourState(data?.state);
              state = mergeTourState(local, remote);
              if (!data || !sameTourState(state, remote)) void db.from("tour_progress").upsert({ user_id: userId, state, updated_at: new Date().toISOString() }).then(() => {}, () => {});
              try { localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(state)); } catch {}
            }
          } catch {}
        }
        memory.current = { state, userId };
      }
      if (cancelled || !memory.current || !canShowTour(memory.current.state, "menu") || document.querySelector("dialog[open]")) return;
      save(startTour(memory.current.state, "menu"));
      last.current = document.activeElement as HTMLElement | null;
      setStep(0);
    }, START_DELAY_MS);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [path, save]);

  // Keep the spotlight on the step's tab.
  useEffect(() => {
    if (step === null) return;
    const place = () => {
      const el = findTarget(MENU_TOUR[step].labels);
      if (!el) return setBox(null);
      const r = el.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [step]);

  useEffect(() => { if (step !== null) primary.current?.focus({ preventScroll: true }); }, [step, box]);

  const close = useCallback(() => { setStep(null); setBox(null); last.current?.focus?.({ preventScroll: true }); }, []);
  useEffect(() => {
    if (step === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, close]);

  // A sign-in sheet or any dialog opening takes over; the tour steps aside.
  useEffect(() => {
    if (step === null) return;
    const watch = new MutationObserver(() => { if (document.querySelector("dialog[open]")) close(); });
    watch.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
    return () => watch.disconnect();
  }, [step, close]);

  if (step === null || !box) return null;

  const total = MENU_TOUR.length;
  const s = MENU_TOUR[step];
  const isLast = step === total - 1;
  const pad = 6;
  // The dimmed page has a hole over the tab (a shadow would be cut by the site-wide no-shadow rule).
  const hole = { l: box.left - pad, t: box.top - pad, r: box.left + box.width + pad, b: box.top + box.height + pad };
  const rad = Math.min(hole.r - hole.l, hole.b - hole.t) / 2;
  const below = box.top < window.innerHeight / 2;
  const cardWidth = Math.min(320, window.innerWidth - 40);
  const left = Math.min(Math.max(20, box.left + box.width / 2 - cardWidth / 2), window.innerWidth - cardWidth - 20);
  const cardStyle: React.CSSProperties = { left, width: cardWidth, ...(below ? { top: box.top + box.height + pad + 14 } : { bottom: window.innerHeight - box.top + pad + 14 }) };

  return (
    <div className="tour" role="presentation">
      <div className="tour-scrim" onClick={close} style={{ clipPath: `path(evenodd, "M0 0H${window.innerWidth}V${window.innerHeight}H0Z M${hole.l + rad} ${hole.t}H${hole.r - rad}A${rad} ${rad} 0 0 1 ${hole.r} ${hole.t + rad}V${hole.b - rad}A${rad} ${rad} 0 0 1 ${hole.r - rad} ${hole.b}H${hole.l + rad}A${rad} ${rad} 0 0 1 ${hole.l} ${hole.b - rad}V${hole.t + rad}A${rad} ${rad} 0 0 1 ${hole.l + rad} ${hole.t}Z")` }} />
      <span className="tour-spot" aria-hidden="true" style={{ top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 }} />
      <section className="tour-card" role="dialog" aria-label={`Tour: ${s.title}`} style={cardStyle}>
        <button type="button" className="icon-button tour-x" aria-label="Close the tour" onClick={close}>×</button>
        <p className="tour-count">{step + 1} of {total}</p>
        <h2 className="tour-title">{s.title}</h2>
        <p className="tour-text">{s.text}</p>
        <div className="tour-actions">
          {step > 0 && <button type="button" className="button ghost" onClick={() => setStep(step - 1)}>Back</button>}
          <button ref={primary} type="button" className="button" onClick={() => {
            if (isLast) { if (memory.current) save(finishTour(memory.current.state, "menu")); close(); }
            else setStep(step + 1);
          }}>{isLast ? "Done" : "Next"}</button>
        </div>
        <button type="button" className="tour-off" onClick={() => { if (memory.current) save(turnOffTours(memory.current.state)); close(); }}>Don’t show again</button>
      </section>
    </div>
  );
}
