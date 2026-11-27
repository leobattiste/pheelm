"use client";

import { usePathname, useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import {
  TOUR_REPLAY_EVENT, TOUR_STORAGE_KEY, canShowTour, cleanTourState, emptyTourState, finishTour, mergeTourState,
  sameTourState, startTour, turnOffTours, type Intent, type TourState,
} from "@/lib/tour";
import { countTour } from "@/lib/tour-stats";
import { MENU_TOUR, toursFor, tourCopy, type Tour, type TourStep } from "@/lib/tours";

// Pages where a tour would get in the way.
const SKIP = /^\/(login|auth|welcome|offline|admin)(\/|$)/;
const START_DELAY_MS = 1500;
// A tour waits for the visitor's first tap, scroll or key press, so it never lands on someone who is
// still reading the page. Someone who does nothing at all gets it after this long anyway.
const IDLE_START_MS = 8000;
const SWIPE_PX = 50;

/** A first-time visitor says what brought them here and lands somewhere that fits, then the menu tour starts. */
const WELCOME_CHOICES: { intent: Intent; label: string; to: string }[] = [
  { intent: "discover", label: "Discover new films", to: "/films" },
  { intent: "save", label: "Save and share watchlists", to: "/watchlists" },
  { intent: "directors", label: "Support Black filmmakers", to: "/directors" },
];

const visible = (el: Element | null): el is HTMLElement => !!el && (el as HTMLElement).getBoundingClientRect().width > 0;
const findTarget = (targets: string[]): HTMLElement | null => {
  for (const sel of targets) {
    const el = [...document.querySelectorAll(sel)].find(visible);
    if (el) return el;
  }
  return null;
};

type Running = { tour: Tour; steps: TourStep[] };

/**
 * Tours: a dimmed page, the thing being explained in a spotlight and a small card with Back and
 * Next. On a page, the menu tour goes first until it is finished or used up; after that the page's
 * own tour. A tour comes back after it is closed or the page is refreshed, twice more, then stops;
 * finishing it or "Don't show again" stops it at once. The memory is in the browser, and for
 * signed-in members on their account too (lib/tour.ts, lib/tours.ts).
 */
export default function Tour() {
  const path = usePathname();
  const router = useRouter();
  const [welcome, setWelcome] = useState(false);
  const [running, setRunning] = useState<Running | null>(null);
  const [step, setStep] = useState(0);
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const memory = useRef<{ state: TourState; userId: string | null } | null>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const last = useRef<HTMLElement | null>(null);
  const seen = useRef(new Set<string>());
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const [announce, setAnnounce] = useState("");

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

  /** The steps of a tour whose targets are on screen right now; none means the tour is not offered. */
  const stepsOf = useCallback((tour: Tour): TourStep[] => tour.steps(!!memory.current?.userId).filter((s) => findTarget(s.targets)), []);

  const open = useCallback((tour: Tour, steps: TourStep[], state: TourState) => {
    save(state);
    last.current = document.activeElement as HTMLElement | null;
    seen.current = new Set();
    countTour(tour.id, 0, "started");
    setStep(0);
    setRunning({ tour, steps });
  }, [save]);

  // Open the first tour this page has left to show, once the page has settled.
  useEffect(() => {
    setRunning(null); setBox(null); setWelcome(false);
    if (SKIP.test(path)) return;
    // Automated browsers (the site's own checks) don't get tours unless a test asks for them.
    try { if (navigator.webdriver && !localStorage.getItem("pheelm:tour:test")) return; } catch {}
    let cancelled = false;
    let begun = false;
    const instant = (() => { try { return navigator.webdriver && localStorage.getItem("pheelm:tour:test") === "instant"; } catch { return false; } })();
    const begin = async () => {
      if (begun) return;
      begun = true;
      if (cancelled || document.documentElement.dataset.chrome !== "app" || document.querySelector("dialog[open]")) return;
      await loadMemory();
      if (cancelled || !memory.current || document.querySelector("dialog[open]")) return;
      const st = memory.current.state;
      if (!st.off && !st.intent && !st.tours.menu && stepsOf(MENU_TOUR).length) { last.current = document.activeElement as HTMLElement | null; setWelcome(true); return; }
      for (const tour of toursFor(path)) {
        if (!canShowTour(memory.current.state, tour.id)) continue;
        const steps = stepsOf(tour);
        if (!steps.length) continue;
        open(tour, steps, startTour(memory.current.state, tour.id));
        return;
      }
    };
    // Ready once the page has settled; then it starts on the first sign the visitor is there.
    const events = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
    let ready = false;
    let idle = 0;
    const onTouch = () => { if (!ready) return; cleanup(); void begin(); };
    const cleanup = () => { events.forEach((e) => window.removeEventListener(e, onTouch, true)); window.clearTimeout(idle); };
    const timer = window.setTimeout(() => {
      ready = true;
      if (instant) { void begin(); return; }
      idle = window.setTimeout(() => { cleanup(); void begin(); }, IDLE_START_MS - START_DELAY_MS);
    }, START_DELAY_MS);
    if (!instant) events.forEach((e) => window.addEventListener(e, onTouch, true));
    return () => { cancelled = true; window.clearTimeout(timer); cleanup(); };
  }, [path, open, loadMemory, stepsOf]);

  // Settings → Display → "Replay": forget everything seen and start the menu tour from the first step.
  useEffect(() => {
    const replay = async () => {
      if (document.documentElement.dataset.chrome !== "app") return;
      await loadMemory();
      if (!memory.current) return;
      const steps = stepsOf(MENU_TOUR);
      if (!steps.length) return;
      open(MENU_TOUR, steps, { off: false, intent: memory.current.state.intent || "skip", tours: { menu: { shown: 1, done: false } } });
    };
    window.addEventListener(TOUR_REPLAY_EVENT, replay);
    return () => window.removeEventListener(TOUR_REPLAY_EVENT, replay);
  }, [loadMemory, open, stepsOf]);

  const current = running?.steps[step];

  // Keep the spotlight on the step's target.
  useEffect(() => {
    if (!current) return;
    const place = () => {
      const el = findTarget(current.targets);
      if (!el) return setBox(null);
      const r = el.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    if (current.scroll) findTarget(current.targets)?.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [current]);

  useEffect(() => { if (current || welcome) primary.current?.focus({ preventScroll: true }); }, [current, box, welcome]);

  const close = useCallback(() => { setRunning(null); setBox(null); last.current?.focus?.({ preventScroll: true }); }, []);
  /** Closed with X, Esc or a tap outside: counted as skipped, and the tour comes back later as before. */
  const skip = useCallback(() => { if (running) countTour(running.tour.id, step, "skipped"); close(); }, [close, running, step]);
  /** Answer (or skip) the welcome card; the menu tour follows on the page they land on. */
  const answer = useCallback((intent: Intent, to?: string) => {
    setWelcome(false);
    countTour("welcome", 0, intent === "skip" ? "skipped" : "finished");
    const m = memory.current;
    if (!m) return;
    const next = { ...m.state, intent };
    if (to && to !== path) { save(next); router.push(to); return; }
    const steps = stepsOf(MENU_TOUR);
    if (steps.length) open(MENU_TOUR, steps, startTour(next, "menu")); else save(next);
  }, [open, path, router, save, stepsOf]);

  /** X, Esc or a tap outside the welcome card: same as "Don’t show again", no tours at all. */
  const dismissWelcome = useCallback(() => {
    setWelcome(false);
    countTour("welcome", 0, "off");
    if (memory.current) save(turnOffTours({ ...memory.current.state, intent: memory.current.state.intent || "skip" }));
  }, [save]);

  useEffect(() => {
    if (!welcome) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismissWelcome(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [welcome, dismissWelcome]);

  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { skip(); return; }
      if (e.key === "ArrowRight" && step < running.steps.length - 1) { e.preventDefault(); setStep(step + 1); }
      else if (e.key === "ArrowLeft" && step > 0) { e.preventDefault(); setStep(step - 1); }
      else if (e.key === "Tab") {
        // Tab stays inside the card while the tour is open.
        const items = [...document.querySelectorAll<HTMLElement>(".tour-card button")].filter(visible);
        if (!items.length) return;
        const first = items[0], end = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus(); }
        else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
        else if (!items.includes(document.activeElement as HTMLElement)) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, skip, step]);

  // Count each step the first time it is shown, and say it aloud for screen readers.
  useEffect(() => {
    if (!running || !current) return;
    const key = `${running.tour.id}:${step}`;
    if (!seen.current.has(key)) { seen.current.add(key); countTour(running.tour.id, step, "step"); }
    setAnnounce(`Step ${step + 1} of ${running.steps.length}: ${current.title}. ${current.text}`);
  }, [running, current, step]);

  // Tapping the highlighted menu item goes to the next step instead of leaving the page.
  useEffect(() => {
    if (!running || !current || !current.targets.some((t) => t.startsWith(".tab-bar"))) return;
    const onTap = (e: MouseEvent) => {
      const el = findTarget(current.targets);
      if (!el || !(e.target instanceof Node) || !el.contains(e.target) || (e.target as Element).closest?.(".tour-card")) return;
      e.preventDefault();
      e.stopPropagation();
      if (step < running.steps.length - 1) setStep(step + 1);
    };
    document.addEventListener("click", onTap, true);
    return () => document.removeEventListener("click", onTap, true);
  }, [running, current, step]);

  // A sign-in sheet or any dialog opening takes over; the tour steps aside.
  useEffect(() => {
    if (!running && !welcome) return;
    const watch = new MutationObserver(() => { if (document.querySelector("dialog[open]")) { close(); setWelcome(false); } });
    watch.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
    return () => watch.disconnect();
  }, [running, welcome, close]);

  /** A swipe left goes to the next step, a swipe right to the one before. */
  const swipeStart = (e: React.TouchEvent) => { const t = e.touches[0]; swipe.current = t ? { x: t.clientX, y: t.clientY } : null; };
  const swipeEnd = (e: React.TouchEvent) => {
    const from = swipe.current; swipe.current = null;
    const t = e.changedTouches[0];
    if (!from || !t || !running) return;
    const dx = t.clientX - from.x, dy = t.clientY - from.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && step < running.steps.length - 1) setStep(step + 1);
    else if (dx > 0 && step > 0) setStep(step - 1);
  };

  if (welcome) {
    return (
      <div className="tour" role="presentation">
        <div className="tour-scrim" onClick={dismissWelcome} />
        <section className="tour-card tour-welcome" role="dialog" aria-modal="true" aria-label="Welcome to Pheelm" style={{ left: (window.innerWidth - Math.min(480, window.innerWidth - 40)) / 2, width: Math.min(480, window.innerWidth - 40) }}>
          <button type="button" className="icon-button tour-x" aria-label="Close" onClick={dismissWelcome}><Icon name="close" /></button>
          <h2 className="tour-title">What brings you here?</h2>
          <p className="tour-text">Pick one and we will point you to a good place to start.</p>
          <div className="tour-choices">
            {WELCOME_CHOICES.map((c, i) => <button key={c.intent} type="button" className="button ghost" ref={i === 0 ? primary : undefined} onClick={() => answer(c.intent, c.to)}>{c.label}</button>)}
          </div>
          <button type="button" className="tour-off" onClick={() => answer("skip")}>Skip for now</button>
        </section>
      </div>
    );
  }

  if (!running || !current || !box) return null;

  const { tour, steps } = running;
  const total = steps.length;
  const isLast = step === total - 1;
  const pad = 6;
  // The dimmed page has a hole over the target (a shadow would be cut by the site-wide no-shadow rule).
  const hole = { l: box.left - pad, t: box.top - pad, r: box.left + box.width + pad, b: box.top + box.height + pad };
  const rad = Math.min(28, (hole.r - hole.l) / 2, (hole.b - hole.t) / 2);
  const below = box.top < window.innerHeight / 2;
  // Same width as the dialogs, centred on the screen.
  const cardWidth = Math.min(480, window.innerWidth - 40);
  const left = (window.innerWidth - cardWidth) / 2;
  const cardStyle: React.CSSProperties = current.place === "bottom"
    ? { left, width: cardWidth, bottom: 110 }
    : { left, width: cardWidth, ...(below ? { top: box.top + box.height + pad + 14 } : { bottom: window.innerHeight - box.top + pad + 14 }) };

  const tappable = current.targets.some((t) => t.startsWith(".tab-bar"));
  return (
    <div className={tappable ? "tour tour-tap" : "tour"} role="presentation">
      <div className="tour-scrim" onClick={skip} onTouchStart={swipeStart} onTouchEnd={swipeEnd} style={{ clipPath: `path(evenodd, "M0 0H${window.innerWidth}V${window.innerHeight}H0Z M${hole.l + rad} ${hole.t}H${hole.r - rad}A${rad} ${rad} 0 0 1 ${hole.r} ${hole.t + rad}V${hole.b - rad}A${rad} ${rad} 0 0 1 ${hole.r - rad} ${hole.b}H${hole.l + rad}A${rad} ${rad} 0 0 1 ${hole.l} ${hole.b - rad}V${hole.t + rad}A${rad} ${rad} 0 0 1 ${hole.l + rad} ${hole.t}Z")` }} />
      <span className="tour-spot" aria-hidden="true" style={{ top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2, borderRadius: rad }} />
      <section className="tour-card" role="dialog" aria-modal="true" aria-label={`Tour: ${current.title}`} style={cardStyle} onTouchStart={swipeStart} onTouchEnd={swipeEnd}>
        <button type="button" className="icon-button tour-x" aria-label="Close the tour" onClick={skip}><Icon name="close" /></button>
        <p className="tour-count">{step + 1} of {total}</p>
        <p className="visually-hidden" role="status" aria-live="polite">{announce}</p>
        {/* Every step's words sit in the same cell, so all the cards are as tall as the longest one. */}
        <div className="tour-copy">
          {tourCopy(tour).map((c) => (
            <div key={c.title} className={c.title === current.title ? "tour-copy-item is-current" : "tour-copy-item"} aria-hidden={c.title === current.title ? undefined : true}>
              <h2 className="tour-title">{c.title}</h2>
              <p className="tour-text">{c.text}</p>
            </div>
          ))}
        </div>
        <div className="tour-actions">
          {step > 0 && <button type="button" className="button ghost" onClick={() => setStep(step - 1)}>Back</button>}
          <button ref={primary} type="button" className="button" onClick={() => {
            if (isLast) { countTour(tour.id, step, "finished"); if (memory.current) save(finishTour(memory.current.state, tour.id)); close(); }
            else setStep(step + 1);
          }}>{isLast ? tour.doneLabel : "Next"}</button>
        </div>
        <button type="button" className="tour-off" onClick={() => { countTour(tour.id, step, "off"); if (memory.current) save(turnOffTours(memory.current.state)); close(); }}>Don’t show again</button>
      </section>
    </div>
  );
}
