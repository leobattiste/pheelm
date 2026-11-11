"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { BackToTopButton } from "./BackToTop";

/**
 * Once Trailer, Watchlist and Share scroll out of view, the same three buttons sit in a
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
    window.addEventListener("resize", onScroll);
    // Mirror the watchlist button's saved state.
    const watch = actions.querySelector<HTMLElement>("[data-action='watchlist']");
    const read = () => setSaved(watch?.getAttribute("aria-pressed") === "true");
    read();
    const mo = watch ? new MutationObserver(read) : null;
    if (watch && mo) mo.observe(watch, { attributes: true, attributeFilter: ["aria-pressed"] });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      mo?.disconnect();
    };
  }, []);

  const press = (action: string) => document.querySelector<HTMLElement>(`.film-actions [data-action='${action}']`)?.click();

  if (!show) return null;

  return (
    <div className="floating-controls film-floating">
      <div className="film-bar" data-show={show} aria-hidden={!show} inert={!show}>
        <button type="button" className="pill-button" onClick={() => press("trailer")} aria-label="Trailer" title="Trailer">
          <Icon name="play" className="solid" />
        </button>
        <button type="button" className="pill-button" aria-pressed={saved} onClick={() => press("watchlist")} aria-label={saved ? "Change watchlists" : "Add to watchlist"} title={saved ? "Change watchlists" : "Add to watchlist"}>
          {saved ? (
            <Icon name="check" />
          ) : (
            <Icon name="plus" />
          )}
        </button>
        <button type="button" className="round-button" onClick={() => press("share")} aria-label={`Share ${title}`} title="Share">
          <Icon name="share" />
        </button>
      </div>
      <BackToTopButton />
    </div>
  );
}
