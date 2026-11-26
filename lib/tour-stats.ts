import { getBrowserClient } from "./supabase/client";

export type TourEvent = "started" | "step" | "finished" | "skipped" | "off";

/**
 * Adds one to a private total (tour, step, what happened). Nothing about the person goes with it:
 * no id, no address. Fire and forget; a failure is ignored.
 */
export function countTour(tour: string, step: number, event: TourEvent) {
  const db = getBrowserClient();
  if (!db) return;
  void Promise.resolve(db.rpc("tour_count", { p_tour: tour, p_step: step, p_event: event })).then(() => {}, () => {});
}
