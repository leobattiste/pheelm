"use client";

import { TOUR_REPLAY_EVENT } from "@/lib/tour";

/** Settings → Display: starts the menu bar tour again from the first step. */
export default function ReplayTour() {
  return <button type="button" className="button ghost" onClick={() => window.dispatchEvent(new Event(TOUR_REPLAY_EVENT))}>Replay</button>;
}
