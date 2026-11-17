"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

/** The full-size version of a profile photo: TMDB's large size, or the original behind Next's image optimiser. */
function large(src: string) {
  let url = src;
  try {
    const u = new URL(src, location.href);
    if (u.pathname.startsWith("/_next/image")) url = u.searchParams.get("url") ?? src;
  } catch {}
  return url.replace(/\/t\/p\/(w|h)\d+\//, "/t/p/h632/");
}

/** Tapping the photo on a member's or a director's profile opens it bigger. */
export default function PhotoZoom() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [photo, setPhoto] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    const SEL = ".person-head img.portrait, .person-head .portrait img";
    const mark = () => document.querySelectorAll<HTMLImageElement>(SEL).forEach((img) => {
      if (img.dataset.zoom) return;
      img.dataset.zoom = "";
      img.tabIndex = 0;
      img.setAttribute("role", "button");
      img.setAttribute("aria-label", `View ${img.alt || "photo"} bigger`);
    });
    const open = (img: HTMLImageElement) => {
      setPhoto({ src: large(img.currentSrc || img.src), alt: img.alt });
      dialog.current?.showModal();
    };
    const click = (e: MouseEvent) => {
      const img = (e.target as Element | null)?.closest<HTMLImageElement>(SEL);
      if (img) open(img);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const img = (e.target as Element | null)?.closest<HTMLImageElement>(SEL);
      if (img) { e.preventDefault(); open(img); }
    };
    mark();
    const seen = new MutationObserver(mark);
    seen.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", click);
    document.addEventListener("keydown", key);
    return () => { seen.disconnect(); document.removeEventListener("click", click); document.removeEventListener("keydown", key); };
  }, []);

  return (
    <dialog ref={dialog} className="photo-zoom" aria-label={photo?.alt ? `${photo.alt}, bigger` : "Photo"} onClick={() => dialog.current?.close()} onClose={() => setPhoto(null)}>
      {photo && <img src={photo.src} alt={photo.alt} />}
      <button type="button" className="icon-button photo-zoom-close" aria-label="Close photo" onClick={() => dialog.current?.close()}><Icon name="close" /></button>
    </dialog>
  );
}
