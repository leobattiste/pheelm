"use client";

import { useEffect, useRef, useState } from "react";

// A strip of stills; tapping one opens it large in a modal (arrows, swipe-free: tap sides or use keys).
export default function FilmStills({ stills, title }: { stills: string[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const ref = useRef<HTMLDialogElement>(null);

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
      <dialog ref={ref} className="still-modal" onClose={() => setOpen(null)} onClick={(e) => { if (e.target === ref.current) setOpen(null); }}>
        {open !== null && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={stills[open].replace("/w1280/", "/original/")} alt={`Still ${open + 1} from ${title}`} onClick={() => setOpen((open + 1) % stills.length)} />
            <button type="button" className="still-close" onClick={() => setOpen(null)} aria-label="Close">×</button>
          </>
        )}
      </dialog>
    </>
  );
}
