"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pinMovieOfTheWeek } from "../../actions";

/** Make this film Explore's Movie of the week until Monday, or take it off again. */
export default function PinMovieOfTheWeek({ filmId, pinned, current, published }: { filmId: string; pinned: boolean; current: string | null; published: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const run = () => start(async () => {
    setError("");
    const r = await pinMovieOfTheWeek(filmId, !pinned);
    if (!r.ok) setError(r.message);
    router.refresh();
  });
  return (
    <div className="admin-pin">
      <p className="muted">
        {pinned ? "This film is the Movie of the week on Explore until Monday."
          : current ? `${current} is pinned this week. Pinning this film replaces it.`
          : "Explore picks a film on its own each week. Pin this one to show it instead, until Monday."}
      </p>
      <span className="admin-job-action">
        <button type="button" className={pinned ? "button ghost small" : "button small"} onClick={run} disabled={pending || (!pinned && !published)}>
          {pending ? "Saving…" : pinned ? "Unpin" : "Pin as movie of the week"}
        </button>
        {!published && !pinned && <span className="muted">Publish the film first.</span>}
        {error && <span className="admin-job-error" role="alert">{error}</span>}
      </span>
    </div>
  );
}
