"use client";

import Icon from "@/components/Icon";
import { useEffect, useRef, useState } from "react";

// A strip of stills; tapping one opens it large in a modal (swipe or arrow keys to move between them).
export default function FilmStills({ stills, title }: { stills: string[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const startX = useRef<number | null>(null);
  const go = (d: number) => setOpen((i) => (i === null ? i : (i + d + stills.length) % stills.length));

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open !== null && !d.open) d.showModal();
    if (open === null && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % stills.length));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i - 1 + stills.length) % stills.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, stills.length]);

  return (
    <>
      <ul className="film-stills">
        {stills.map((src, i) => (
          <li key={src}>
            <button type="button" onClick={() => setOpen(i)} aria-label={`Open still ${i + 1} from ${title}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src.replace("/w1280/", "/w780/")} alt="" loading="lazy" decoding="async" />
            </button>
          </li>
        ))}
      </ul>
      <dialog ref={ref} className="trailer-dialog" aria-label={`${title} stills`} onClose={() => setOpen(null)} onClick={(e) => { if (e.target === ref.current) setOpen(null); }}>
        <div className="trailer-head">
          <span className="still-count">{open !== null ? `${open + 1} / ${stills.length}` : ""}</span>
          <button type="button" className="icon-button" onClick={() => setOpen(null)} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div
          className="trailer-frame still-frame"
          onTouchStart={(e) => { startX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (startX.current === null) return;
            const dx = e.changedTouches[0].clientX - startX.current;
            startX.current = null;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          }}
        >
          {open !== null && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={stills[open].replace("/w1280/", "/original/")} alt={`Still ${open + 1} from ${title}`} draggable={false} />
          )}
        </div>
      </dialog>
    </>
  );
}
