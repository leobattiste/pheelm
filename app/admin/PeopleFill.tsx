"use client";

import { useState } from "react";
import { fillPeople } from "./actions";

/** Fills in everyone's TMDB details ten at a time, so it never hits a server time limit. */
export default function PeopleFill({ waiting }: { waiting: number | null }) {
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(waiting);
  const [message, setMessage] = useState("");

  if (waiting === null) {
    return <p className="muted">To add birth dates, birthplaces and IMDb and Instagram links, run <code>supabase/people-details.sql</code> in Supabase, then come back here.</p>;
  }

  const run = async () => {
    setRunning(true);
    setMessage("");
    for (;;) {
      const r = await fillPeople();
      setLeft(r.remaining);
      if (!r.ok) { setMessage(r.message); break; }
      if (r.remaining === 0) { setMessage("Everyone is filled in."); break; }
      await new Promise((res) => setTimeout(res, 300));
    }
    setRunning(false);
  };

  return (
    <div className="form">
      <p className="muted">
        {left ? `${left} people don't have their TMDB details yet: biography, birth and death dates, birthplace, IMDb and Instagram.` : "Everyone has their TMDB details. New films fill theirs when imported."}
      </p>
      {!!left && (
        <div className="actions">
          <button className="button" type="button" onClick={run} disabled={running}>
            {running ? `Filling in… ${left} left` : `Fill in ${left} people from TMDB`}
          </button>
        </div>
      )}
      {message && <p className={message.startsWith("Run") ? "notice error" : "muted"}>{message}</p>}
    </div>
  );
}
