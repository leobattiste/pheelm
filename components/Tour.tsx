"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import {
  TOUR_REPLAY_EVENT, TOUR_STORAGE_KEY, canShowTour, cleanTourState, emptyTourState, finishTour, mergeTourState,
  sameTourState, startTour, turnOffTours, type TourState,
} from "@/lib/tour";

type Copy = { title: string; text: string };
type Step = Copy & { labels: string[] };

/** The menu bar tour. A step points at the first of its labels that is on screen (Profile or Sign in). */
const menuTour = (member: boolean): Step[] => [
  { labels: ["Films"], title: "Films", text: "Browse films by Black directors from around the world. Search, filter, and find something new to watch." },
  { labels: ["Watchlists"], title: "Watchlists", text: "Discover and create watchlists, share your favorites, and connect with other film enthusiasts through comments." },
  { labels: ["Directors"], title: "Directors", text: "Learn about filmmakers, explore their work, and follow your favorites." },
  { labels: ["Profile", "Sign in"], ...(member
    ? { title: "Your profile", text: "View your profile, share your interests, and connect with other film enthusiasts." }
    : { title: "Join the community", text: "Sign in or create a free account to save films, follow directors, and join conversations." }) },
  { labels: ["More"], title: "More", text: "Access your settings, notifications, help, and other pages on Pheelm." },
];
const ALL_COPY: Copy[] = [...menuTour(true), ...menuTour(false)].filter((c, i, all) => all.findIndex((d) => d.title === c.title) === i);

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
  const [member, setMember] = useState(false);
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

  const loadMemory = useCallback(async () => {
    if (memory.current) return;
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
  }, []);

  // Open it once the page has settled, if this person has any showings left.
  useEffect(() => {
    if (SKIP.test(path)) return;
    // Automated browsers (the site's own checks) don't get the tour unless a test asks for it.
    try { if (navigator.webdriver && !localStorage.getItem("pheelm:tour:test")) return; } catch {}
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled || document.documentElement.dataset.chrome !== "app" || document.querySelector("dialog[open]")) return;
      if (!findTarget(menuTour(false)[0].labels)) return;
      await loadMemory();
      if (cancelled || !memory.current || !canShowTour(memory.current.state, "menu") || document.querySelector("dialog[open]")) return;
      save(startTour(memory.current.state, "menu"));
      setMember(!!memory.current.userId);
      last.current = document.activeElement as HTMLElement | null;
      setStep(0);
    }, START_DELAY_MS);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [path, save, loadMemory]);

  // Settings → Display → "Replay the tour": forget what was seen and start from the first step.
  useEffect(() => {
    const replay = async () => {
      if (document.documentElement.dataset.chrome !== "app" || !findTarget(menuTour(false)[0].labels)) return;
      await loadMemory();
      if (!memory.current) return;
      setMember(!!memory.current.userId);
      save({ off: false, tours: { ...memory.current.state.tours, menu: { shown: 1, done: false } } });
      last.current = document.activeElement as HTMLElement | null;
      setStep(0);
    };
    window.addEventListener(TOUR_REPLAY_EVENT, replay);
    return () => window.removeEventListener(TOUR_REPLAY_EVENT, replay);
  }, [loadMemory, save]);

  const tourSteps = menuTour(member);

  // Keep the spotlight on the step's tab.
  useEffect(() => {
    if (step === null) return;
    const place = () => {
      const el = findTarget(tourSteps[step].labels);
      if (!el) return setBox(null);
      const r = el.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [step, tourSteps]);

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

  const total = tourSteps.length;
  const s = tourSteps[step];
  const isLast = step === total - 1;
  const pad = 6;
  // The dimmed page has a hole over the tab (a shadow would be cut by the site-wide no-shadow rule).
  const hole = { l: box.left - pad, t: box.top - pad, r: box.left + box.width + pad, b: box.top + box.height + pad };
  const rad = Math.min(hole.r - hole.l, hole.b - hole.t) / 2;
  const below = box.top < window.innerHeight / 2;
  // Same width as the dialogs, centred on the screen.
  const cardWidth = Math.min(480, window.innerWidth - 40);
  const left = (window.innerWidth - cardWidth) / 2;
  const cardStyle: React.CSSProperties = { left, width: cardWidth, ...(below ? { top: box.top + box.height + pad + 14 } : { bottom: window.innerHeight - box.top + pad + 14 }) };

  return (
    <div className="tour" role="presentation">
      <div className="tour-scrim" onClick={close} style={{ clipPath: `path(evenodd, "M0 0H${window.innerWidth}V${window.innerHeight}H0Z M${hole.l + rad} ${hole.t}H${hole.r - rad}A${rad} ${rad} 0 0 1 ${hole.r} ${hole.t + rad}V${hole.b - rad}A${rad} ${rad} 0 0 1 ${hole.r - rad} ${hole.b}H${hole.l + rad}A${rad} ${rad} 0 0 1 ${hole.l} ${hole.b - rad}V${hole.t + rad}A${rad} ${rad} 0 0 1 ${hole.l + rad} ${hole.t}Z")` }} />
      <span className="tour-spot" aria-hidden="true" style={{ top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 }} />
      <section className="tour-card" role="dialog" aria-label={`Tour: ${s.title}`} style={cardStyle}>
        <button type="button" className="icon-button tour-x" aria-label="Close the tour" onClick={close}>×</button>
        <p className="tour-count">{step + 1} of {total}</p>
        {/* Every step's words sit in the same cell, so all the cards are as tall as the longest one. */}
        <div className="tour-copy">
          {ALL_COPY.map((c) => (
            <div key={c.title} className={c.title === s.title ? "tour-copy-item is-current" : "tour-copy-item"} aria-hidden={c.title === s.title ? undefined : true}>
              <h2 className="tour-title">{c.title}</h2>
              <p className="tour-text">{c.text}</p>
            </div>
          ))}
        </div>
        <div className="tour-actions">
          {step > 0 && <button type="button" className="button ghost" onClick={() => setStep(step - 1)}>Back</button>}
          <button ref={primary} type="button" className="button" onClick={() => {
            if (isLast) { if (memory.current) save(finishTour(memory.current.state, "menu")); close(); }
            else setStep(step + 1);
          }}>{isLast ? "Start exploring" : "Next"}</button>
        </div>
        <button type="button" className="tour-off" onClick={() => { if (memory.current) save(turnOffTours(memory.current.state)); close(); }}>Don’t show again</button>
      </section>
    </div>
  );
}
