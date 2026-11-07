"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import Icon from "@/components/Icon";

/**
 * A short, curated row that scrolls sideways, with arrow buttons on desktop.
 * Interactive rows move each poster's image slightly against the scroll (parallax), tilt the
 * poster under the pointer toward it with a soft glare, and can be dragged sideways with a mouse.
 */
export default function Row({ title, href, linkLabel, intro, bare, interactive, fit, className = "", children }: {
  title: string;
  href?: string;
  linkLabel?: string;
  intro?: string;
  /** No heading or link, only the arrows: for rows a statement above already introduces. */
  bare?: boolean;
  interactive?: boolean;
  /** Size the posters to the row's height (the row fills the space it's given). */
  fit?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const track = useRef<HTMLUListElement>(null);
  const viewport = useRef<HTMLDivElement>(null);

  // Fit: posters as tall as the row allows (2:3), never wider than most of the screen.
  useEffect(() => {
    const box = viewport.current;
    const el = track.current;
    if (!fit || !box || !el) return;
    const size = () => {
      const h = box.clientHeight - 16;
      const w = Math.max(120, Math.min((h * 2) / 3, window.innerWidth * 0.72, 640));
      el.style.setProperty("--poster-w", `${Math.round(w)}px`);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(box);
    return () => ro.disconnect();
  }, [fit]);

  // Parallax: as the row moves, each poster's image drifts within its frame, against the scroll.
  useEffect(() => {
    const el = track.current;
    if (!el || !interactive || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const view = el.getBoundingClientRect();
      const mid = view.left + view.width / 2;
      for (const card of el.querySelectorAll<HTMLElement>(".film-card")) {
        const r = card.getBoundingClientRect();
        if (r.right < view.left - r.width || r.left > view.right + r.width) continue;
        // -1 at the left edge of the row, 0 in the middle, 1 at the right edge.
        const t = Math.max(-1, Math.min(1, (r.left + r.width / 2 - mid) / (view.width / 2)));
        card.style.setProperty("--px", `${(-t * 8).toFixed(2)}%`);
      }
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    el.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, [interactive]);

  const page = (dir: 1 | -1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  useEffect(() => {
    const el = track.current;
    if (!el || !interactive) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let active: HTMLElement | null = null;
    let frame = 0;
    let dragging = false;
    let down: { x: number; left: number } | null = null;

    const reset = (card: HTMLElement | null) => {
      if (!card) return;
      card.classList.remove("is-active");
      card.style.removeProperty("--rx");
      card.style.removeProperty("--ry");
    };

    // Tilt: the card under the pointer leans toward it.
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || dragging) return;
      const card = (e.target as HTMLElement).closest<HTMLElement>(".film-card");
      if (card !== active) { reset(active); active = card; }
      if (!card || still) { card?.classList.add("is-active"); return; }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        card.classList.add("is-active");
        card.style.setProperty("--rx", `${((x - 0.5) * 16).toFixed(2)}deg`);
        card.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
        card.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
      });
    };
    const leave = () => { cancelAnimationFrame(frame); reset(active); active = null; };

    // Drag to scroll with a mouse; a drag doesn't count as a click on the poster.
    const press = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = { x: e.clientX, left: el.scrollLeft };
    };
    const drag = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - down.x;
      if (!dragging && Math.abs(dx) > 6) {
        dragging = true;
        el.classList.add("is-dragging");
        el.setPointerCapture(e.pointerId);
        leave();
      }
      if (dragging) el.scrollLeft = down.left - dx;
    };
    const release = () => {
      down = null;
      if (!dragging) return;
      el.classList.remove("is-dragging");
      // Let the click that ends the drag pass by first.
      setTimeout(() => { dragging = false; }, 0);
    };
    const click = (e: MouseEvent) => { if (dragging) { e.preventDefault(); e.stopPropagation(); } };
    const noGhost = (e: DragEvent) => e.preventDefault();

    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("pointerdown", press);
    window.addEventListener("pointermove", drag);
    window.addEventListener("pointerup", release);
    el.addEventListener("click", click, true);
    el.addEventListener("dragstart", noGhost);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("pointerdown", press);
      window.removeEventListener("pointermove", drag);
      window.removeEventListener("pointerup", release);
      el.removeEventListener("click", click, true);
      el.removeEventListener("dragstart", noGhost);
    };
  }, [interactive]);

  return (
    <section className={`row${bare ? " is-bare" : ""}${interactive ? " is-interactive" : ""} ${className}`.trim()} aria-label={bare ? title : undefined}>
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
            <Icon name="arrowLeft" />
          </button>
          <button type="button" className="row-arrow" onClick={() => page(1)} aria-label={`Scroll ${title} forward`}>
            <Icon name="arrowRight" />
          </button>
        </div>
      </div>
      <div className="row-viewport" ref={viewport}>
        <ul className="row-track" ref={track}>
          {children}
        </ul>
      </div>
    </section>
  );
}
