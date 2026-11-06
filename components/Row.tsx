"use client";

import Link from "next/link";
import { useRef } from "react";

/** A short, curated row that scrolls sideways, with arrow buttons on desktop. */
export default function Row({ title, href, linkLabel, intro, bare, children }: {
  title: string;
  /** No heading or link, only the arrows: for rows a statement above already introduces. */
  bare?: boolean;
  href?: string;
  linkLabel?: string;
  intro?: string;
  children: React.ReactNode;
}) {
  const track = useRef<HTMLUListElement>(null);
  const page = (dir: 1 | -1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className={`row${bare ? " is-bare" : ""}`} aria-label={bare ? title : undefined}>
      <div className="row-head">
        {!bare && (
          <div className="row-title">
            <h2>{title}</h2>
            {intro && <p>{intro}</p>}
          </div>
        )}
        <div className="row-tools">
          {href && !bare && <Link href={href}>{linkLabel ?? "See all"}</Link>}
          <button type="button" className="row-arrow" onClick={() => page(-1)} aria-label={`Scroll ${title} back`}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5" /></svg>
          </button>
          <button type="button" className="row-arrow" onClick={() => page(1)} aria-label={`Scroll ${title} forward`}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5 13 10l-5.5 5.5" /></svg>
          </button>
        </div>
      </div>
      <ul className="row-track" ref={track}>
        {children}
      </ul>
    </section>
  );
}
