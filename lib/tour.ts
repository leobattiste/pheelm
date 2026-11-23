/**
 * The onboarding tour's memory, kept apart from the screen so it can be tested.
 * A tour shows again after it is closed or the page is refreshed, up to TOUR_LIMIT times in all,
 * and stops for good once it is finished or "Don't show again" is tapped. Signed-out visitors keep
 * this in the browser; signed-in members keep it on their account (table tour_progress).
 */
export const TOUR_LIMIT = 3;
export const TOUR_STORAGE_KEY = "pheelm:tour:v1";

export type TourEntry = { shown: number; done: boolean };
export type TourState = { off: boolean; tours: Record<string, TourEntry> };

export const emptyTourState = (): TourState => ({ off: false, tours: {} });

/** Reads whatever was stored (browser or database) and keeps only what is valid. */
export function cleanTourState(raw: unknown): TourState {
  const out = emptyTourState();
  if (!raw || typeof raw !== "object") return out;
  const r = raw as { off?: unknown; tours?: unknown };
  out.off = r.off === true;
  if (r.tours && typeof r.tours === "object") {
    for (const [id, v] of Object.entries(r.tours as Record<string, unknown>).slice(0, 40)) {
      if (!/^[a-z0-9-]{1,40}$/.test(id) || !v || typeof v !== "object") continue;
      const e = v as { shown?: unknown; done?: unknown };
      const shown = typeof e.shown === "number" && Number.isFinite(e.shown) ? Math.min(TOUR_LIMIT, Math.max(0, Math.floor(e.shown))) : 0;
      out.tours[id] = { shown, done: e.done === true };
    }
  }
  return out;
}

/** Two copies of the same person's memory (this browser and their account): nothing seen is forgotten. */
export function mergeTourState(a: TourState, b: TourState): TourState {
  const out = emptyTourState();
  out.off = a.off || b.off;
  for (const id of new Set([...Object.keys(a.tours), ...Object.keys(b.tours)])) {
    const x = a.tours[id], y = b.tours[id];
    out.tours[id] = { shown: Math.max(x?.shown ?? 0, y?.shown ?? 0), done: !!x?.done || !!y?.done };
  }
  return out;
}

export const sameTourState = (a: TourState, b: TourState) => JSON.stringify(a) === JSON.stringify(b);

export function canShowTour(state: TourState, id: string): boolean {
  const e = state.tours[id];
  return !state.off && !e?.done && (e?.shown ?? 0) < TOUR_LIMIT;
}

/** Opening the tour counts as one showing, so a refresh uses one up too. */
export function startTour(state: TourState, id: string): TourState {
  const e = state.tours[id];
  return { ...state, tours: { ...state.tours, [id]: { shown: Math.min(TOUR_LIMIT, (e?.shown ?? 0) + 1), done: !!e?.done } } };
}

export function finishTour(state: TourState, id: string): TourState {
  return { ...state, tours: { ...state.tours, [id]: { shown: state.tours[id]?.shown ?? 1, done: true } } };
}

export const turnOffTours = (state: TourState): TourState => ({ ...state, off: true });
