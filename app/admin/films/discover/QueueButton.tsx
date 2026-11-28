"use client";

import { useState, useTransition } from "react";
import { saveToQueue } from "../queue-actions";

/** Saves one TMDB result to the film queue. */
export default function QueueButton({ title, year, queued }: { title: string; year: number | null; queued: boolean }) {
  const [done, setDone] = useState(queued);
  const [pending, start] = useTransition();
  return (
    <button type="button" className="button ghost small" disabled={done || pending} onClick={() => start(async () => {
      const r = await saveToQueue([{ title, year }]);
      if (r.ok) setDone(true);
    })}>
      {done ? "In the queue" : pending ? "Adding…" : "Add to queue"}
    </button>
  );
}
