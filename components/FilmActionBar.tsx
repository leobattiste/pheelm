"use client";

import { useEffect, useState } from "react";

/**
 * On phones, once Trailer, Watchlist and Share scroll out of view, the same three buttons sit in a
 * bar at the bottom of the screen. Its buttons press the originals, so the watchlist state and the
 * trailer player stay in one place.
 */
export default function FilmActionBar({ title }: { title: string }) {
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const actions = document.querySelector(".film-actions");
    if (!actions) return;
    // Checked on every scroll, so a fast flick past the buttons can't skip it.
    const onScroll = () => setShow(actions.getBoundingClientRect().bottom < 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    // Mirror the watchlist button's saved state.
    const watch = actions.querySelector<HTMLElement>("[data-action='watchlist']");
    const read = () => setSaved(watch?.getAttribute("aria-pressed") === "true");
    read();
    const mo = watch ? new MutationObserver(read) : null;
    if (watch && mo) mo.observe(watch, { attributes: true, attributeFilter: ["aria-pressed"] });
    return () => {
      window.removeEventListener("scroll", onScroll);
      mo?.disconnect();
    };
  }, []);

  const press = (action: string) => document.querySelector<HTMLElement>(`.film-actions [data-action='${action}']`)?.click();

  return (
    <div className="film-bar" data-show={show} aria-hidden={!show} inert={!show}>
      <button type="button" className="pill-button" onClick={() => press("trailer")}>
        <svg className="solid" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4.5v11l9-5.5z" /></svg>
        Trailer
      </button>
      <button type="button" className="pill-button" aria-pressed={saved} onClick={() => press("watchlist")}>
        {saved ? (
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10.5 3.2 3.2L15 7" /></svg>
        ) : (
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 5v10M5 10h10" /></svg>
        )}
        {saved ? "Saved" : "Watchlist"}
      </button>
      <button type="button" className="round-button" onClick={() => press("share")} aria-label={`Share ${title}`}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v10M6 7l4-4 4 4M4 12v4h12v-4" /></svg>
      </button>
    </div>
  );
}
